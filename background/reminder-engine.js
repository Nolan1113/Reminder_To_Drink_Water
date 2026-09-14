// ============================================================
// background/reminder-engine.js — 提醒触发判断引擎
// 决定当前是否应该向用户发出喝水提醒
// 条件：启用 & 未暂停 & 在允许时间段 & 在允许星期
// ============================================================

import { getSettings } from '../services/settings-service.js';
import { isInTimeRange, getTodayWeekday } from '../utils/date.js';

/**
 * 判断当前时刻是否应该发出喝水提醒
 * @returns {Promise<{ shouldRemind: boolean, reason: string }>}
 */
export async function shouldRemindNow() {
  const settings = await getSettings();

  // 1. 检查是否启用
  if (!settings.enabled) {
    return { shouldRemind: false, reason: '提醒已关闭' };
  }

  // 2. 检查是否处于暂停状态
  if (settings.pauseUntil && Date.now() < settings.pauseUntil) {
    const remainingMin = Math.ceil((settings.pauseUntil - Date.now()) / 60000);
    return { shouldRemind: false, reason: `已暂停 (剩余 ${remainingMin} 分钟)` };
  }

  // 3. 检查当前星期是否在允许列表中
  const todayWeekday = getTodayWeekday(); // 1=周一, 7=周日
  if (!settings.activeDays.includes(todayWeekday)) {
    return { shouldRemind: false, reason: '今天不在提醒日期范围内' };
  }

  // 4. 检查当前时间是否在提醒时间段内
  if (!isInTimeRange(settings.startTime, settings.endTime)) {
    return { shouldRemind: false, reason: `当前不在提醒时间段 (${settings.startTime} ~ ${settings.endTime})` };
  }

  return { shouldRemind: true, reason: '条件满足，执行提醒' };
}

/**
 * 获取当前提醒状态描述（供 Popup 展示）
 * @returns {Promise<{ status: string, detail: string }>}
 */
export async function getReminderStatus() {
  const settings = await getSettings();
  const { shouldRemind, reason } = await shouldRemindNow();

  if (!settings.enabled) {
    return { status: 'disabled', detail: '提醒已关闭' };
  }

  if (settings.pauseUntil && Date.now() < settings.pauseUntil) {
    const remainingMin = Math.ceil((settings.pauseUntil - Date.now()) / 60000);
    const h = Math.floor(remainingMin / 60);
    const m = remainingMin % 60;
    const timeStr = h > 0 ? `${h}小时${m > 0 ? m + '分钟' : ''}` : `${m}分钟`;
    return { status: 'paused', detail: `已暂停，剩余 ${timeStr}` };
  }

  if (!shouldRemind) {
    return { status: 'inactive', detail: reason };
  }

  return { status: 'active', detail: '提醒已开启' };
}
