// ============================================================
// services/storage-service.js — 统一 storage 操作层
// 所有 storage.local 读写通过此服务，便于统一错误处理与测试
// ============================================================

import { storageAPI } from '../utils/browser-api.js';

/**
 * 读取单个 key 的值
 * @param {string} key
 * @param {*} defaultValue - 若 key 不存在时返回的默认值
 * @returns {Promise<*>}
 */
export async function getValue(key, defaultValue = null) {
  try {
    const result = await storageAPI.get(key);
    return result[key] !== undefined ? result[key] : defaultValue;
  } catch (err) {
    console.error(`[StorageService] getValue(${key}) 失败:`, err);
    return defaultValue;
  }
}

/**
 * 读取多个 key 的值
 * @param {string[]} keys
 * @returns {Promise<object>}
 */
export async function getValues(keys) {
  try {
    return await storageAPI.get(keys);
  } catch (err) {
    console.error('[StorageService] getValues 失败:', err);
    return {};
  }
}

/**
 * 读取全部 storage 内容
 * @returns {Promise<object>}
 */
export async function getAll() {
  try {
    return await storageAPI.get(null);
  } catch (err) {
    console.error('[StorageService] getAll 失败:', err);
    return {};
  }
}

/**
 * 写入单个 key 的值
 * @param {string} key
 * @param {*} value
 * @returns {Promise<void>}
 */
export async function setValue(key, value) {
  try {
    await storageAPI.set({ [key]: value });
  } catch (err) {
    console.error(`[StorageService] setValue(${key}) 失败:`, err);
    throw err;
  }
}

/**
 * 批量写入多个 key
 * @param {object} items
 * @returns {Promise<void>}
 */
export async function setValues(items) {
  try {
    await storageAPI.set(items);
  } catch (err) {
    console.error('[StorageService] setValues 失败:', err);
    throw err;
  }
}

/**
 * 删除指定 key
 * @param {string|string[]} keys
 * @returns {Promise<void>}
 */
export async function removeValue(keys) {
  try {
    await storageAPI.remove(keys);
  } catch (err) {
    console.error('[StorageService] removeValue 失败:', err);
    throw err;
  }
}
