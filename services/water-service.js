// ============================================================
// services/water-service.js — 饮水数据管理
// 按本地日期 Key 存储，自动跨天，保留历史记录
// ============================================================

import { STORAGE_KEYS } from '../utils/constants.js';
import { getTodayKey, getCurrentTimeStr } from '../utils/date.js';
import { getValue, setValue } from './storage-service.js';

/**
 * 读取完整的饮水历史记录
 * @returns {Promise<object>} { "2026-09-10": { total, records } }
 */
export async function getWaterHistory() {
  return await getValue(STORAGE_KEYS.WATER_HISTORY, {});
}

/**
 * 获取今日饮水数据
 * 第二天自动返回空记录（新 Key），不清空历史
 * @returns {Promise<{ total: number, records: Array }>}
 */
export async function getTodayData() {
  const history = await getWaterHistory();
  const todayKey = getTodayKey();

  if (!history[todayKey]) {
    return { total: 0, records: [] };
  }
  return history[todayKey];
}

/**
 * 获取今日已喝水量（ml）
 * @returns {Promise<number>}
 */
export async function getTodayTotal() {
  const data = await getTodayData();
  return data.total;
}

/**
 * 增加饮水量记录
 * @param {number} amount - 饮水量（ml）
 * @returns {Promise<{ total: number, records: Array }>} 更新后的今日数据
 */
export async function addWater(amount) {
  if (!amount || amount <= 0) {
    throw new Error(`无效的饮水量: ${amount}`);
  }

  const history = await getWaterHistory();
  const todayKey = getTodayKey();
  const timeStr = getCurrentTimeStr();

  // 初始化今日记录（若不存在）
  if (!history[todayKey]) {
    history[todayKey] = { total: 0, records: [] };
  }

  history[todayKey].total += amount;
  history[todayKey].records.push({ time: timeStr, amount });

  await setValue(STORAGE_KEYS.WATER_HISTORY, history);

  return history[todayKey];
}

/**
 * 获取指定日期的饮水数据
 * @param {string} dateKey - "2026-09-10"
 * @returns {Promise<{ total: number, records: Array }>}
 */
export async function getDateData(dateKey) {
  const history = await getWaterHistory();
  return history[dateKey] || { total: 0, records: [] };
}

/**
 * 获取最近 N 天的饮水记录（包含今天）
 * @param {number} days
 * @returns {Promise<Array<{ date: string, total: number, records: Array }>>}
 */
export async function getRecentDays(days = 7) {
  const history = await getWaterHistory();
  const result = [];
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toLocaleDateString('zh-CA');
    result.push({
      date: key,
      ...(history[key] || { total: 0, records: [] }),
    });
  }

  return result;
}

/**
 * 删除指定日期之前的历史记录（清理旧数据，保留最近 N 天）
 * @param {number} keepDays - 保留天数（默认 30 天）
 * @returns {Promise<void>}
 */
export async function pruneOldHistory(keepDays = 30) {
  const history = await getWaterHistory();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - keepDays);
  const cutoffKey = cutoffDate.toLocaleDateString('zh-CA');

  const cleaned = {};
  for (const key of Object.keys(history)) {
    if (key >= cutoffKey) {
      cleaned[key] = history[key];
    }
  }

  await setValue(STORAGE_KEYS.WATER_HISTORY, cleaned);
}
