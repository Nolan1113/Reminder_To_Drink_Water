// ============================================================
// background/alarm-manager.js — Alarm 生命周期管理
// 只负责 chrome.alarms 的创建、清除、查询
// 业务逻辑由 reminder-engine.js 决定
// ============================================================

import { alarmsAPI } from '../utils/browser-api.js';
import { ALARM_NAMES } from '../utils/constants.js';
import { getSettings } from '../services/settings-service.js';

/**
 * 创建（或重建）主提醒 Alarm
 * 使用 periodInMinutes 保证即使 SW 重启后 Alarm 也能持续触发
 * @param {number} [intervalMinutes] - 若不传则从 storage 读取
 * @returns {Promise<void>}
 */
export async function createMainAlarm(intervalMinutes) {
  // 先清除旧 Alarm，避免重复
  await alarmsAPI.clear(ALARM_NAMES.MAIN);

  if (!intervalMinutes) {
    const settings = await getSettings();
    intervalMinutes = settings.intervalMinutes;
  }

  // delayInMinutes: 第一次触发延迟（立即开始，等间隔后第一次响）
  // periodInMinutes: 循环间隔
  await alarmsAPI.create(ALARM_NAMES.MAIN, {
    delayInMinutes: intervalMinutes,
    periodInMinutes: intervalMinutes,
  });

  console.log(`[AlarmManager] 主 Alarm 已创建，间隔: ${intervalMinutes} 分钟`);
}

/**
 * 创建 Snooze Alarm（稍后提醒，单次触发）
 * @param {number} [snoozeMinutes] - 若不传则从 storage 读取
 * @returns {Promise<void>}
 */
export async function createSnoozeAlarm(snoozeMinutes) {
  // 先清除已有 Snooze Alarm，确保唯一
  await alarmsAPI.clear(ALARM_NAMES.SNOOZE);

  if (!snoozeMinutes) {
    const settings = await getSettings();
    snoozeMinutes = settings.snoozeMinutes;
  }

  await alarmsAPI.create(ALARM_NAMES.SNOOZE, {
    delayInMinutes: snoozeMinutes,
  });

  console.log(`[AlarmManager] Snooze Alarm 已创建，${snoozeMinutes} 分钟后触发`);
}

/**
 * 清除主提醒 Alarm
 * @returns {Promise<void>}
 */
export async function clearMainAlarm() {
  const wasCleared = await alarmsAPI.clear(ALARM_NAMES.MAIN);
  console.log(`[AlarmManager] 主 Alarm 已清除: ${wasCleared}`);
}

/**
 * 清除 Snooze Alarm
 * @returns {Promise<void>}
 */
export async function clearSnoozeAlarm() {
  await alarmsAPI.clear(ALARM_NAMES.SNOOZE);
}

/**
 * 清除所有 Alarm
 * @returns {Promise<void>}
 */
export async function clearAllAlarms() {
  await alarmsAPI.clearAll();
  console.log('[AlarmManager] 所有 Alarm 已清除');
}

/**
 * 检查主 Alarm 是否存在
 * @returns {Promise<boolean>}
 */
export async function isMainAlarmActive() {
  const alarm = await alarmsAPI.get(ALARM_NAMES.MAIN);
  return !!alarm;
}

/**
 * 获取主 Alarm 距下次触发的时间（毫秒）
 * @returns {Promise<number>} -1 表示 Alarm 不存在
 */
export async function getMainAlarmRemainingMs() {
  const alarm = await alarmsAPI.get(ALARM_NAMES.MAIN);
  if (!alarm) return -1;
  return Math.max(0, alarm.scheduledTime - Date.now());
}

/**
 * 当设置变更时重置主 Alarm（间隔变更时调用）
 * @param {number} newIntervalMinutes
 * @returns {Promise<void>}
 */
export async function resetMainAlarm(newIntervalMinutes) {
  await createMainAlarm(newIntervalMinutes);
}

// ─────────────────────────────────────────────
// 外卖提醒 Alarm（每日固定时刻，循环 24h）
// ─────────────────────────────────────────────

/**
 * 计算今天 HH:MM 对应的下次触发时间戳（毫秒）
 * 如果今天该时刻已过，则返回明天的同一时刻
 * @param {string} timeStr - "HH:MM" 格式
 * @returns {number} 触发时间戳（ms）
 */
function calcNextDailyMs(timeStr) {
  const [hh, mm] = timeStr.split(':').map(Number);
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
  if (target.getTime() <= now.getTime()) {
    // 今天已过，改为明天
    target.setDate(target.getDate() + 1);
  }
  return target.getTime();
}

/**
 * 创建（或重建）每日外卖提醒 Alarm
 * @param {string} [foodTime] - "HH:MM"，若不传则从 storage 读取
 * @returns {Promise<void>}
 */
export async function createFoodAlarm(foodTime) {
  await alarmsAPI.clear(ALARM_NAMES.FOOD);

  if (!foodTime) {
    const settings = await getSettings();
    foodTime = settings.foodReminderTime;
  }

  const whenMs = calcNextDailyMs(foodTime);
  // periodInMinutes = 1440 实现每日循环
  await alarmsAPI.create(ALARM_NAMES.FOOD, {
    when: whenMs,
    periodInMinutes: 24 * 60,
  });

  const nextTime = new Date(whenMs).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  console.log(`[AlarmManager] 外卖提醒 Alarm 已创建，首次触发: ${nextTime}，之后每 24h 循环`);
}

/**
 * 清除外卖提醒 Alarm
 * @returns {Promise<void>}
 */
export async function clearFoodAlarm() {
  const wasCleared = await alarmsAPI.clear(ALARM_NAMES.FOOD);
  console.log(`[AlarmManager] 外卖提醒 Alarm 已清除: ${wasCleared}`);
}

/**
 * 检查外卖提醒 Alarm 是否存在
 * @returns {Promise<boolean>}
 */
export async function isFoodAlarmActive() {
  const alarm = await alarmsAPI.get(ALARM_NAMES.FOOD);
  return !!alarm;
}

