// ============================================================
// services/settings-service.js — 用户设置管理
// 提供读取、写入、重置功能，并合并默认值
// ============================================================

import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../utils/constants.js';
import { getValue, setValue } from './storage-service.js';

/**
 * 读取当前设置（与默认值合并，保证字段完整）
 * @returns {Promise<object>}
 */
export async function getSettings() {
  const stored = await getValue(STORAGE_KEYS.SETTINGS, {});
  // 合并默认值，新字段自动补全
  return { ...DEFAULT_SETTINGS, ...stored };
}

/**
 * 保存完整设置对象
 * @param {object} settings
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  await setValue(STORAGE_KEYS.SETTINGS, settings);
}

/**
 * 更新部分设置字段（patch 方式）
 * @param {object} partial - 只包含要修改的字段
 * @returns {Promise<object>} 更新后的完整设置
 */
export async function patchSettings(partial) {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await saveSettings(updated);
  return updated;
}

/**
 * 重置为默认设置
 * @returns {Promise<object>}
 */
export async function resetSettings() {
  await saveSettings({ ...DEFAULT_SETTINGS });
  return { ...DEFAULT_SETTINGS };
}

/**
 * 设置暂停状态
 * @param {number} minutes - 暂停分钟数，-1 表示今天不再提醒，0 表示取消暂停
 * @returns {Promise<void>}
 */
export async function setPause(minutes) {
  let pauseUntil = 0;

  if (minutes === -1) {
    // 今天不再提醒：设置到今天 23:59:59
    const now = new Date();
    const todayEnd = new Date(
      now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999
    );
    pauseUntil = todayEnd.getTime();
  } else if (minutes > 0) {
    pauseUntil = Date.now() + minutes * 60 * 1000;
  } else {
    // 取消暂停
    pauseUntil = 0;
  }

  await patchSettings({ pauseUntil });
}

/**
 * 判断当前是否处于暂停状态
 * @returns {Promise<boolean>}
 */
export async function isPaused() {
  const settings = await getSettings();
  if (!settings.pauseUntil || settings.pauseUntil === 0) return false;
  return Date.now() < settings.pauseUntil;
}

/**
 * 获取暂停剩余分钟数
 * @returns {Promise<number>} 0 表示未暂停
 */
export async function getPauseRemainingMinutes() {
  const settings = await getSettings();
  if (!settings.pauseUntil || settings.pauseUntil === 0) return 0;
  const remaining = settings.pauseUntil - Date.now();
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / 60000);
}
