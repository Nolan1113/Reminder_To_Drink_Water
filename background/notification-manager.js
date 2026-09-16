// ============================================================
// background/notification-manager.js — 系统通知管理
// 创建通知、防重复逻辑、处理通知按钮点击
//
// ⚠️ 修复说明：
//   MV3 Service Worker 在 Alarm 触发后约 30s 内会被浏览器休眠，
//   setTimeout 超过此窗口的回调永远不会执行（1分钟/2分钟自动关闭失效）。
//   修复方案：改用 chrome.alarms 调度自动关闭 —— Alarm 不依赖 SW 存活，
//   到期后浏览器主动唤醒 SW，再执行 notificationsAPI.clear()。
// ============================================================

import { notificationsAPI, actionAPI, runtimeAPI } from '../utils/browser-api.js';
import { NOTIFICATION_IDS, ALARM_NAMES, STORAGE_KEYS } from '../utils/constants.js';
import { getSettings } from '../services/settings-service.js';
import { getTodayTotal } from '../services/water-service.js';
import { getValue, setValue } from '../services/storage-service.js';

/**
 * 防重复：两次通知最小间隔（毫秒）
 * 注意：snooze 触发的通知跳过此检查
 */
const MIN_NOTIF_INTERVAL_MS = 30 * 1000; // 30 秒

/**
 * 通知显示时长下限/上限（毫秒）
 * 用户可在设置页自定义，此处仅做边界保护
 */
const MIN_NOTIF_DURATION_MS = 1 * 1000;       // 最短 1 秒
const MAX_NOTIF_DURATION_MS = 10 * 60 * 1000; // 最长 10 分钟

/**
 * 发送主提醒通知
 * @param {object} [options]
 * @param {string} [options.notifId] - 通知 ID（默认为 MAIN）
 * @param {boolean} [options.isSnooze] - 是否为稍后提醒触发（跳过防重复检查）
 * @returns {Promise<void>}
 */
export async function sendReminderNotification({ notifId = NOTIFICATION_IDS.MAIN, isSnooze = false } = {}) {
  console.log('[NotifManager] sendReminderNotification called, id:', notifId, 'isSnooze:', isSnooze);

  const settings = await getSettings();

  // 防重复检查（Snooze 通知跳过此检查，避免被误拦截）
  if (!isSnooze) {
    const lastTime = await getValue(STORAGE_KEYS.LAST_NOTIF_TIME, 0);
    const now = Date.now();
    if (now - lastTime < MIN_NOTIF_INTERVAL_MS) {
      console.log('[NotifManager] 防重复：距上次通知仅', Math.round((now - lastTime) / 1000), '秒，跳过');
      return;
    }
  }

  // 记录本次通知时间（在创建通知前记录，防止并发重复）
  await setValue(STORAGE_KEYS.LAST_NOTIF_TIME, Date.now());

  // 读取今日数据
  const todayTotal = await getTodayTotal();
  const remaining = Math.max(0, settings.dailyGoal - todayTotal);
  const pct = Math.min(100, Math.round((todayTotal / settings.dailyGoal) * 100));

  // 构建通知内容
  const title = isSnooze ? '💧 稍后提醒到了！' : '💧 该喝水啦！';
  const message = [
    `建议喝 ${settings.defaultAmount}ml 水`,
    `今日已喝 ${todayTotal}ml（${pct}%）`,
    remaining > 0 ? `还差 ${remaining}ml 达成今日目标` : '🎉 已达成今日目标！',
  ].join('\n');

  // 获取图标 URL（使用 chrome.runtime.getURL 确保路径正确）
  const iconUrl = runtimeAPI.getURL('assets/icons/icon128.png');

  // 先关闭同 ID 的旧通知，确保新通知一定可见
  try {
    await notificationsAPI.clear(notifId);
  } catch (_) {
    // 忽略清除失败（旧通知不存在时会报错）
  }

  // 创建通知
  try {
    const createdId = await notificationsAPI.create(notifId, {
      type: 'basic',
      iconUrl,
      title,
      message,
      buttons: [
        { title: '✅ 我喝了' },
        { title: '⏰ 稍后提醒' },
      ],
      // requireInteraction: true —— 核心修复！
      // Windows/Mac 系统在 requireInteraction=false 时会在 5~20 秒内强制收起 Toast，
      // 无视我们的 setTimeout。改为 true 后，通知持续显示在屏幕上，
      // 直到用户点击按钮 OR 我们的 setTimeout 按用户设定时长主动调用 clear()。
      requireInteraction: true,
      priority: 1,
    });

    console.log('[NotifManager] 通知创建成功, id:', createdId);

    // ── 自动关闭：混合策略 ──
    // • < 60秒：用 setTimeout（SW 处理 Alarm 事件期间必然存活，可靠）
    // • ≥ 60秒：改用 chrome.alarms（SW 可能被休眠，setTimeout 回调永远不执行）
    // ── 喝水通知显示时长默认值 ──
    // 若用户未在设置页自定义，则使用此处的默认值（单位：秒）。
    // 如需手动调整默认时长，修改下方 DEFAULT_NOTIF_DURATION_SEC 的数值即可：
    //   30  → 30 秒
    //   60  → 1 分钟
    //   180 → 3 分钟（当前默认）
    //   300 → 5 分钟
    const DEFAULT_NOTIF_DURATION_SEC = 180; // ← 在此修改默认显示时长（秒）
    const rawSec = settings.notifDurationSeconds ?? DEFAULT_NOTIF_DURATION_SEC;
    const clampedMs = Math.min(Math.max(rawSec * 1000, MIN_NOTIF_DURATION_MS), MAX_NOTIF_DURATION_MS);
    console.log('[NotifManager] 通知将在', clampedMs / 1000, '秒后自动关闭');

    if (clampedMs < 60_000) {
      // 短时长：setTimeout 可靠，SW 在这个窗口内必然存活
      setTimeout(async () => {
        try { await notificationsAPI.clear(notifId); } catch (_) {}
        console.log('[NotifManager] 通知已自动关闭（setTimeout）:', notifId);
      }, clampedMs);
    } else {
      // 长时长：SW 可能已被休眠，改由浏览器持久管理的 Alarm 唤醒 SW 再关闭
      const delayInMinutes = clampedMs / 60_000;
      try { await chrome.alarms.clear(ALARM_NAMES.AUTO_CLOSE_WATER); } catch (_) {}
      chrome.alarms.create(ALARM_NAMES.AUTO_CLOSE_WATER, { delayInMinutes });
      console.log('[NotifManager] 通知自动关闭已通过 Alarm 调度，延迟', delayInMinutes, '分钟');
    }

    // 更新 Badge
    if (settings.badgeEnabled) {
      updateBadge(todayTotal, settings.dailyGoal);
    }
  } catch (err) {
    console.error('[NotifManager] 创建通知失败:', err);
    // 清空 lastNotifTime，允许下次重试
    await setValue(STORAGE_KEYS.LAST_NOTIF_TIME, 0);
  }
}

/**
 * 更新 Badge 显示今日饮水进度
 * @param {number} todayTotal
 * @param {number} dailyGoal
 */
export function updateBadge(todayTotal, dailyGoal) {
  if (!dailyGoal || dailyGoal <= 0) return;
  const pct = Math.round((todayTotal / dailyGoal) * 100);

  if (todayTotal >= dailyGoal) {
    actionAPI.setBadgeText('OK');
    actionAPI.setBadgeBackgroundColor('#22c55e');
  } else if (pct >= 50) {
    actionAPI.setBadgeText(`${pct}%`);
    actionAPI.setBadgeBackgroundColor('#3b82f6');
  } else {
    actionAPI.setBadgeText(`${pct}%`);
    actionAPI.setBadgeBackgroundColor('#f59e0b');
  }
}

/**
 * 清除指定通知
 * @param {string} notifId
 */
export async function clearNotification(notifId) {
  try {
    await notificationsAPI.clear(notifId);
  } catch (e) {
    // 通知已不存在时忽略
  }
}

/**
 * 清除所有提醒通知
 */
export async function clearAllNotifications() {
  await clearNotification(NOTIFICATION_IDS.MAIN);
  await clearNotification(NOTIFICATION_IDS.SNOOZE);
  await clearNotification(NOTIFICATION_IDS.FOOD);
}

/**
 * 发送点外卖提醒通知
 * 与喝水提醒结构一致：requireInteraction:true + 自定义时长自动关闭
 * @returns {Promise<void>}
 */
export async function sendFoodReminderNotification() {
  console.log('[NotifManager] sendFoodReminderNotification called');

  const settings = await getSettings();

  if (!settings.foodReminderEnabled) {
    console.log('[NotifManager] 点外卖提醒已关闭，跳过');
    return;
  }

  const iconUrl = runtimeAPI.getURL('assets/icons/icon128.png');
  const notifId = NOTIFICATION_IDS.FOOD;

  // 先关闭旧通知，确保新通知可见
  try { await notificationsAPI.clear(notifId); } catch (_) {}

  try {
    const createdId = await notificationsAPI.create(notifId, {
      type: 'basic',
      iconUrl,
      title: '🍜 该点外卖啦！',
      message: [
        '午餐时间将到，记得提前点餐哦~',
        `当前时间：${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
      ].join('\n'),
      buttons: [
        { title: '✅ 已点好了' },
        { title: '🔔 再提醒我' },
      ],
      // requireInteraction:true 防止系统在几秒内强制收起通知
      requireInteraction: true,
      priority: 2,
    });

    console.log('[NotifManager] 点外卖通知创建成功, id:', createdId);

    // 按用户设定的外卖提醒显示时长自动关闭（混合策略，同喝水通知）
    const rawSec = settings.foodReminderDurationSeconds ?? 300;
    const clampedMs = Math.min(Math.max(rawSec * 1000, MIN_NOTIF_DURATION_MS), MAX_NOTIF_DURATION_MS);
    console.log('[NotifManager] 点外卖通知将在', clampedMs / 1000, '秒后自动关闭');

    if (clampedMs < 60_000) {
      setTimeout(async () => {
        try { await notificationsAPI.clear(notifId); } catch (_) {}
        console.log('[NotifManager] 点外卖通知已自动关闭（setTimeout）');
      }, clampedMs);
    } else {
      const delayInMinutes = clampedMs / 60_000;
      try { await chrome.alarms.clear(ALARM_NAMES.AUTO_CLOSE_FOOD); } catch (_) {}
      chrome.alarms.create(ALARM_NAMES.AUTO_CLOSE_FOOD, { delayInMinutes });
      console.log('[NotifManager] 点外卖通知自动关闭已通过 Alarm 调度，延迟', delayInMinutes, '分钟');
    }

  } catch (err) {
    console.error('[NotifManager] 点外卖通知创建失败:', err);
  }
}
