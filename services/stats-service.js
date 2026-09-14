// ============================================================
// services/stats-service.js — 统计分析服务
// 连续打卡天数、周均值、达成率等
// ============================================================

import { getWaterHistory, getRecentDays } from './water-service.js';
import { getSettings } from './settings-service.js';
import { getTodayKey } from '../utils/date.js';

/**
 * 计算连续达标天数（含今天）
 * @returns {Promise<number>}
 */
export async function getStreakDays() {
  const history = await getWaterHistory();
  const settings = await getSettings();
  const goal = settings.dailyGoal;

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toLocaleDateString('zh-CA');

    const dayData = history[key];
    if (!dayData || dayData.total < goal) {
      break; // 连续中断
    }
    streak++;
  }

  return streak;
}

/**
 * 获取最近 7 天的每日饮水量与达标情况
 * @returns {Promise<Array>}
 */
export async function getWeeklyStats() {
  const settings = await getSettings();
  const goal = settings.dailyGoal;
  const recentDays = await getRecentDays(7);

  return recentDays.map((day) => ({
    date: day.date,
    total: day.total,
    goal,
    reached: day.total >= goal,
    percentage: Math.min(100, Math.round((day.total / goal) * 100)),
  }));
}

/**
 * 获取今日达成百分比
 * @param {number} todayTotal
 * @param {number} dailyGoal
 * @returns {number} 0-100
 */
export function getTodayPercentage(todayTotal, dailyGoal) {
  if (!dailyGoal || dailyGoal <= 0) return 0;
  return Math.min(100, Math.round((todayTotal / dailyGoal) * 100));
}

/**
 * 获取最近 7 天平均饮水量
 * @returns {Promise<number>}
 */
export async function getWeeklyAverage() {
  const recent = await getRecentDays(7);
  const total = recent.reduce((sum, d) => sum + d.total, 0);
  return Math.round(total / 7);
}

/**
 * 获取今日剩余需喝量（ml）
 * @param {number} todayTotal
 * @param {number} dailyGoal
 * @returns {number}
 */
export function getRemainingAmount(todayTotal, dailyGoal) {
  return Math.max(0, dailyGoal - todayTotal);
}
