// ============================================================
// background/notification-manager.js — 系统通知管理
// 创建通知、防重复逻辑、处理通知按钮点击
// 修复：requireInteraction:true 防止系统强制收起，
//       由 setTimeout 按用户设定时长精确关闭
// ============================================================

import { notificationsAPI, actionAPI, runtimeAPI } from '../utils/browser-api.js';
import { NOTIFICATION_IDS, STORAGE_KEYS } from '../utils/constants.js';
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

    // ── 自动关闭：按用户设置的显示时长关闭通知 ──
    // MV3 Service Worker 在处理 alarm 事件后有 5 分钟生命周期，
    // 只要 notifDurationSeconds <= 300（5分钟）setTimeout 均可靠
    const rawMs = (settings.notifDurationSeconds ?? 30) * 1000;
    const autoCloseMs = Math.min(Math.max(rawMs, MIN_NOTIF_DURATION_MS), MAX_NOTIF_DURATION_MS);
    console.log('[NotifManager] 通知将在', autoCloseMs / 1000, '秒后自动关闭');
    setTimeout(async () => {
      try {
        await notificationsAPI.clear(notifId);
        console.log('[NotifManager] 通知已自动关闭:', notifId);
      } catch (e) {
        // 用户已手动关闭，忽略
      }
    }, autoCloseMs);

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

    // 按用户设定的外卖提醒显示时长自动关闭
    const rawMs = (settings.foodReminderDurationSeconds ?? 300) * 1000;
    const autoCloseMs = Math.min(Math.max(rawMs, MIN_NOTIF_DURATION_MS), MAX_NOTIF_DURATION_MS);
    console.log('[NotifManager] 点外卖通知将在', autoCloseMs / 1000, '秒后自动关闭');
    setTimeout(async () => {
      try {
        await notificationsAPI.clear(notifId);
        console.log('[NotifManager] 点外卖通知已自动关闭');
      } catch (e) { /* 用户已手动关闭，忽略 */ }
    }, autoCloseMs);

  } catch (err) {
    console.error('[NotifManager] 点外卖通知创建失败:', err);
  }
}
