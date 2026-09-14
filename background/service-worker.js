// ============================================================
// background/service-worker.js — Service Worker 入口
// 监听所有扩展事件，协调各模块
//
// ⚠️ 重要：MV3 Service Worker 随时可能被销毁！
//    所有状态必须存入 chrome.storage.local，不能依赖全局变量
// ============================================================

import { ALARM_NAMES, NOTIFICATION_IDS, NOTIF_BUTTON, DEFAULT_SETTINGS } from '../utils/constants.js';
import {
  createMainAlarm, createSnoozeAlarm,
  clearAllAlarms, isMainAlarmActive, resetMainAlarm,
  createFoodAlarm, clearFoodAlarm, isFoodAlarmActive,
} from './alarm-manager.js';
import { shouldRemindNow } from './reminder-engine.js';
import { sendReminderNotification, sendFoodReminderNotification, clearNotification, clearAllNotifications, updateBadge } from './notification-manager.js';
import { getSettings, saveSettings, patchSettings, setPause } from '../services/settings-service.js';
import { addWater, getTodayTotal } from '../services/water-service.js';

// ─────────────────────────────────────────────
// onInstalled：首次安装或插件更新
// ─────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[SW] onInstalled, reason:', details.reason);

  try {
    if (details.reason === 'install') {
      // 首次安装：写入默认设置（使用静态导入的 DEFAULT_SETTINGS）
      await saveSettings({ ...DEFAULT_SETTINGS });
      console.log('[SW] 默认设置已初始化:', DEFAULT_SETTINGS);
    }

    // 安装或更新后：清除旧 Alarm，重新创建确保正确
    await clearAllAlarms();
    await ensureMainAlarm();
    await refreshBadge();

    console.log('[SW] onInstalled 初始化完成');
  } catch (err) {
    console.error('[SW] onInstalled 出错:', err);
  }
});

// ─────────────────────────────────────────────
// onStartup：浏览器重新启动
// ─────────────────────────────────────────────
chrome.runtime.onStartup.addListener(async () => {
  console.log('[SW] onStartup：浏览器已启动，恢复 Alarm 状态');
  try {
    await ensureMainAlarm();
    await refreshBadge();
  } catch (err) {
    console.error('[SW] onStartup 出错:', err);
  }
});

// ─────────────────────────────────────────────
// onAlarm：定时提醒触发
// ─────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('[SW] ⏰ Alarm 触发:', alarm.name, '时间:', new Date().toLocaleTimeString());

  try {
    if (alarm.name === ALARM_NAMES.MAIN) {
      await handleMainAlarm();
    } else if (alarm.name === ALARM_NAMES.SNOOZE) {
      await handleSnoozeAlarm();
    } else if (alarm.name === ALARM_NAMES.FOOD) {
      await handleFoodAlarm();
    } else {
      console.log('[SW] 未知 Alarm 名称，忽略:', alarm.name);
    }
  } catch (err) {
    console.error('[SW] Alarm 处理出错:', err);
  }
});

// ─────────────────────────────────────────────
// onButtonClicked：通知按钮点击
// ─────────────────────────────────────────────
chrome.notifications.onButtonClicked.addListener(async (notifId, buttonIndex) => {
  console.log('[SW] 通知按钮点击, notifId:', notifId, 'buttonIndex:', buttonIndex);

  try {
    // 立即关闭通知
    await clearNotification(notifId);

    if (buttonIndex === NOTIF_BUTTON.DRANK) {
      await handleDrankButton();
    } else if (buttonIndex === NOTIF_BUTTON.SNOOZE) {
      await handleSnoozeButton();
    }
  } catch (err) {
    console.error('[SW] 通知按钮处理出错:', err);
  }
});

// 点击通知主体：关闭通知
chrome.notifications.onClicked.addListener(async (notifId) => {
  console.log('[SW] 通知主体被点击, notifId:', notifId);
  try {
    await clearNotification(notifId);
  } catch (err) {
    console.error('[SW] 关闭通知出错:', err);
  }
});

// ─────────────────────────────────────────────
// onMessage：来自 Popup / Options 的消息
// ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[SW] 收到消息:', message.type);

  // 必须返回 true 才能异步调用 sendResponse
  (async () => {
    try {
      const result = await handleMessage(message);
      sendResponse({ success: true, data: result });
    } catch (err) {
      console.error('[SW] 消息处理失败:', message.type, err);
      sendResponse({ success: false, error: err.message });
    }
  })();

  return true; // 表示将异步调用 sendResponse
});

// ─────────────────────────────────────────────
// 消息处理路由
// ─────────────────────────────────────────────
async function handleMessage(message) {
  switch (message.type) {

    case 'ADD_WATER': {
      const data = await addWater(message.amount);
      const settings = await getSettings();
      if (settings.badgeEnabled) {
        updateBadge(data.total, settings.dailyGoal);
      }
      return data;
    }

    case 'TOGGLE_ENABLED': {
      const settings = await getSettings();
      const newEnabled = !settings.enabled;
      await patchSettings({ enabled: newEnabled });

      if (newEnabled) {
        await ensureMainAlarm();
      } else {
        await clearAllAlarms();
        await clearAllNotifications();
      }
      return { enabled: newEnabled };
    }

    case 'SET_PAUSE': {
      const { minutes } = message;
      await setPause(minutes);
      const settings = await getSettings();
      return { pauseUntil: settings.pauseUntil };
    }

    case 'CANCEL_PAUSE': {
      await patchSettings({ pauseUntil: 0 });
      return { paused: false };
    }

    case 'SAVE_SETTINGS': {
      const { settings: newSettings } = message;
      console.log('[SW] SAVE_SETTINGS 收到, intervalMinutes:', newSettings.intervalMinutes);

      // 保存设置到 storage
      await saveSettings(newSettings);

      // ── 关键修复：不管什么情况，只要 enabled 为 true，都重置 Alarm ──
      // 旧代码只在 intervalMinutes 变化时重置，导致相同间隔时不生效
      if (newSettings.enabled) {
        await resetMainAlarm(newSettings.intervalMinutes);
        console.log('[SW] Alarm 已重置，新间隔:', newSettings.intervalMinutes, '分钟');
      } else {
        await clearAllAlarms();
        console.log('[SW] 提醒已禁用，清除所有 Alarm');
      }

      // 同步处理外卖提醒 Alarm
      if (newSettings.foodReminderEnabled) {
        await createFoodAlarm(newSettings.foodReminderTime);
        console.log('[SW] 外卖提醒 Alarm 已更新:', newSettings.foodReminderTime);
      } else {
        await clearFoodAlarm();
        console.log('[SW] 外卖提醒已禁用，清除 Alarm');
      }

      return { saved: true };
    }

    case 'GET_STATUS': {
      const settings = await getSettings();
      const todayTotal = await getTodayTotal();
      const alarmActive = await isMainAlarmActive();
      const { shouldRemind, reason } = await shouldRemindNow();
      return { settings, todayTotal, alarmActive, shouldRemind, reason };
    }

    case 'SNOOZE_10': {
      const settings = await getSettings();
      await createSnoozeAlarm(settings.snoozeMinutes);
      return { snoozed: true, minutes: settings.snoozeMinutes };
    }

    default:
      throw new Error(`未知消息类型: ${message.type}`);
  }
}

// ─────────────────────────────────────────────
// 内部辅助函数
// ─────────────────────────────────────────────

/**
 * 主 Alarm 触发处理
 */
async function handleMainAlarm() {
  const { shouldRemind, reason } = await shouldRemindNow();
  console.log('[SW] shouldRemind:', shouldRemind, '| reason:', reason);

  if (!shouldRemind) {
    console.log('[SW] 本次提醒已跳过:', reason);
    return;
  }

  console.log('[SW] 🔔 发送喝水提醒通知...');
  await sendReminderNotification({ notifId: NOTIFICATION_IDS.MAIN, isSnooze: false });
}

/**
 * Snooze Alarm 触发处理
 */
async function handleSnoozeAlarm() {
  const { shouldRemind, reason } = await shouldRemindNow();
  console.log('[SW] Snooze - shouldRemind:', shouldRemind, '| reason:', reason);

  if (!shouldRemind) {
    console.log('[SW] Snooze 提醒已跳过:', reason);
    return;
  }

  console.log('[SW] 🔔 发送 Snooze 提醒通知...');
  await sendReminderNotification({
    notifId: NOTIFICATION_IDS.SNOOZE,
    isSnooze: true,
  });
}

/**
 * 外卖 Alarm 触发处理
 */
async function handleFoodAlarm() {
  console.log('[SW] 🍜 外卖提醒 Alarm 触发');
  await sendFoodReminderNotification();
}

/**
 * 处理"我喝了"按钮
 */
async function handleDrankButton() {
  const settings = await getSettings();
  const data = await addWater(settings.defaultAmount);
  if (settings.badgeEnabled) {
    updateBadge(data.total, settings.dailyGoal);
  }
  console.log(`[SW] ✅ 已记录 ${settings.defaultAmount}ml，今日总计: ${data.total}ml`);
}

/**
 * 处理"稍后提醒"按钮
 */
async function handleSnoozeButton() {
  const settings = await getSettings();
  await createSnoozeAlarm(settings.snoozeMinutes);
  console.log(`[SW] ⏰ Snooze Alarm 已创建，${settings.snoozeMinutes} 分钟后提醒`);
}

/**
 * 确保主 Alarm 存在（若不存在则创建）
 * 用于 onInstalled / onStartup 场景
 */
async function ensureMainAlarm() {
  const settings = await getSettings();

  if (!settings.enabled) {
    console.log('[SW] 提醒未启用，跳过 Alarm 创建');
    return;
  }

  const active = await isMainAlarmActive();
  if (!active) {
    await createMainAlarm(settings.intervalMinutes);
    console.log('[SW] ✅ 主 Alarm 已创建，间隔:', settings.intervalMinutes, '分钟');
  } else {
    console.log('[SW] 主 Alarm 已存在，无需重建');
  }

  // 同步确保外卖提醒 Alarm
  if (settings.foodReminderEnabled) {
    const foodActive = await isFoodAlarmActive();
    if (!foodActive) {
      await createFoodAlarm(settings.foodReminderTime);
      console.log('[SW] ✅ 外卖提醒 Alarm 已创建，时间:', settings.foodReminderTime);
    } else {
      console.log('[SW] 外卖提醒 Alarm 已存在，无需重建');
    }
  }
}

/**
 * 刷新 Badge（浏览器重启时调用）
 */
async function refreshBadge() {
  try {
    const settings = await getSettings();
    const todayTotal = await getTodayTotal();
    if (settings.badgeEnabled) {
      updateBadge(todayTotal, settings.dailyGoal);
    }
  } catch (err) {
    console.error('[SW] refreshBadge 出错:', err);
  }
}
