// ============================================================
// utils/browser-api.js — 统一封装 Chrome / Firefox WebExtensions API
// 业务代码通过此文件调用，避免直接散落 chrome.xxx
// ============================================================

/**
 * 获取浏览器 API 对象（兼容 Chrome MV3 和 Firefox）
 * Firefox 使用 browser（Promise-based），Chrome 使用 chrome（callback-based）
 */
const _browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

// ─────────────────────────────────────────────
// Storage API
// ─────────────────────────────────────────────

export const storageAPI = {
  /**
   * 读取 storage.local 数据
   * @param {string|string[]|null} keys - null 读取全部
   * @returns {Promise<object>}
   */
  get(keys) {
    return new Promise((resolve, reject) => {
      _browserAPI.storage.local.get(keys, (result) => {
        if (_browserAPI.runtime.lastError) {
          reject(_browserAPI.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  },

  /**
   * 写入 storage.local 数据
   * @param {object} items
   * @returns {Promise<void>}
   */
  set(items) {
    return new Promise((resolve, reject) => {
      _browserAPI.storage.local.set(items, () => {
        if (_browserAPI.runtime.lastError) {
          reject(_browserAPI.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },

  /**
   * 删除 storage.local 中的 key
   * @param {string|string[]} keys
   * @returns {Promise<void>}
   */
  remove(keys) {
    return new Promise((resolve, reject) => {
      _browserAPI.storage.local.remove(keys, () => {
        if (_browserAPI.runtime.lastError) {
          reject(_browserAPI.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },
};

// ─────────────────────────────────────────────
// Alarms API
// ─────────────────────────────────────────────

export const alarmsAPI = {
  /**
   * 创建 Alarm
   * @param {string} name
   * @param {chrome.alarms.AlarmCreateInfo} alarmInfo
   * @returns {Promise<void>}
   */
  create(name, alarmInfo) {
    return new Promise((resolve) => {
      _browserAPI.alarms.create(name, alarmInfo);
      resolve();
    });
  },

  /**
   * 获取指定 Alarm
   * @param {string} name
   * @returns {Promise<chrome.alarms.Alarm|undefined>}
   */
  get(name) {
    return new Promise((resolve) => {
      _browserAPI.alarms.get(name, (alarm) => resolve(alarm));
    });
  },

  /**
   * 获取所有 Alarm
   * @returns {Promise<chrome.alarms.Alarm[]>}
   */
  getAll() {
    return new Promise((resolve) => {
      _browserAPI.alarms.getAll((alarms) => resolve(alarms || []));
    });
  },

  /**
   * 清除指定 Alarm
   * @param {string} name
   * @returns {Promise<boolean>}
   */
  clear(name) {
    return new Promise((resolve) => {
      _browserAPI.alarms.clear(name, (wasCleared) => resolve(wasCleared));
    });
  },

  /**
   * 清除所有 Alarm
   * @returns {Promise<void>}
   */
  clearAll() {
    return new Promise((resolve) => {
      _browserAPI.alarms.clearAll(() => resolve());
    });
  },
};

// ─────────────────────────────────────────────
// Notifications API
// ─────────────────────────────────────────────

export const notificationsAPI = {
  /**
   * 创建通知
   * @param {string} id
   * @param {chrome.notifications.NotificationOptions} options
   * @returns {Promise<string>} 通知 ID
   */
  create(id, options) {
    return new Promise((resolve, reject) => {
      _browserAPI.notifications.create(id, options, (notifId) => {
        if (_browserAPI.runtime.lastError) {
          reject(_browserAPI.runtime.lastError);
        } else {
          resolve(notifId);
        }
      });
    });
  },

  /**
   * 清除通知
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  clear(id) {
    return new Promise((resolve) => {
      _browserAPI.notifications.clear(id, (wasCleared) => resolve(wasCleared));
    });
  },
};

// ─────────────────────────────────────────────
// Action (Badge) API
// ─────────────────────────────────────────────

export const actionAPI = {
  /**
   * 设置 Badge 文本
   * @param {string} text
   */
  setBadgeText(text) {
    if (_browserAPI.action) {
      _browserAPI.action.setBadgeText({ text });
    } else if (_browserAPI.browserAction) {
      // Firefox MV2 fallback
      _browserAPI.browserAction.setBadgeText({ text });
    }
  },

  /**
   * 设置 Badge 背景色
   * @param {string} color
   */
  setBadgeBackgroundColor(color) {
    if (_browserAPI.action) {
      _browserAPI.action.setBadgeBackgroundColor({ color });
    } else if (_browserAPI.browserAction) {
      _browserAPI.browserAction.setBadgeBackgroundColor({ color });
    }
  },
};

// ─────────────────────────────────────────────
// Runtime API
// ─────────────────────────────────────────────

export const runtimeAPI = {
  /**
   * 发送消息到 background
   * @param {object} message
   * @returns {Promise<any>}
   */
  sendMessage(message) {
    return new Promise((resolve, reject) => {
      _browserAPI.runtime.sendMessage(message, (response) => {
        if (_browserAPI.runtime.lastError) {
          // 如果 SW 未响应（已休眠），忽略错误
          resolve(null);
        } else {
          resolve(response);
        }
      });
    });
  },

  /**
   * 获取扩展资源 URL
   * @param {string} path
   * @returns {string}
   */
  getURL(path) {
    return _browserAPI.runtime.getURL(path);
  },

  /** 打开 Options 页面 */
  openOptionsPage() {
    _browserAPI.runtime.openOptionsPage();
  },
};

// 导出原始 API 对象（特殊情况备用）
export { _browserAPI as browserAPI };
