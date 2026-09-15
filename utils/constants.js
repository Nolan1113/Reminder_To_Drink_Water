// ============================================================
// utils/constants.js — 全局常量定义
// 所有 Alarm 名称、Storage Key、默认配置集中在此文件
// ============================================================

/** Alarm 名称 */
export const ALARM_NAMES = {
  MAIN: 'water_reminder_main',           // 主循环提醒 Alarm
  SNOOZE: 'water_reminder_snooze',       // 稍后提醒 Alarm
  FOOD: 'food_reminder_daily',           // 点外卖每日定时 Alarm
  AUTO_CLOSE_WATER: 'notif_auto_close_water', // 喝水通知自动关闭 Alarm
  AUTO_CLOSE_FOOD:  'notif_auto_close_food',  // 外卖通知自动关闭 Alarm
};

/** chrome.storage.local 存储 Key */
export const STORAGE_KEYS = {
  SETTINGS: 'settings',           // 用户设置对象
  WATER_HISTORY: 'waterHistory',  // 饮水历史 { "2026-09-10": { total, records } }
  LAST_NOTIF_TIME: 'lastNotifTime', // 上次通知时间戳，用于防重复
  ACTIVE_NOTIF_ID: 'activeNotifId', // 当前活跃通知 ID
};

/** 通知 ID（固定值，系统自动替换旧通知，避免重复弹出） */
export const NOTIFICATION_IDS = {
  MAIN:  'water_reminder_notif',
  SNOOZE: 'water_reminder_snooze_notif',
  FOOD:  'food_reminder_notif',   // 点外卖提醒
};

/** 通知按钮索引 */
export const NOTIF_BUTTON = {
  DRANK: 0,   // "我喝了"
  SNOOZE: 1,  // "稍后提醒"
};

/** 默认设置值 */
export const DEFAULT_SETTINGS = {
  enabled: true,            // 是否启用提醒
  intervalMinutes: 60,      // 提醒间隔（分钟）
  dailyGoal: 2000,          // 每日目标（ml）
  defaultAmount: 200,       // 默认每次饮水量（ml）
  snoozeMinutes: 10,        // 稍后提醒间隔（分钟）
  startTime: '08:00',       // 每日提醒开始时间
  endTime: '22:00',         // 每日提醒结束时间
  // 提醒星期：1=周一, 2=周二, ..., 7=周日
  activeDays: [1, 2, 3, 4, 5, 6, 7],
  pauseUntil: 0,            // 暂停截止时间戳（0 表示未暂停）
  notifEnabled: true,       // 是否启用系统通知
  badgeEnabled: true,       // 是否启用 Badge 提醒
  soundEnabled: false,      // 是否启用声音提醒（预留）
  notifDurationSeconds: 30, // 通知自动关闭时长（秒），范围 1s ~ 600s（10分钟）
  // 点外卖提醒
  foodReminderEnabled: true,          // 是否启用点外卖提醒
  foodReminderTime: '11:20',          // 点外卖提醒时间
  foodReminderDurationSeconds: 300,   // 点外卖通知显示时长（秒），默认 5 分钟
};

/** 快捷饮水量选项（ml） */
export const QUICK_AMOUNTS = [200, 250, 300];

/** 暂停选项（分钟，-1 表示今天不再提醒） */
export const SNOOZE_OPTIONS = [
  { label: '暂停 30 分钟', value: 30 },
  { label: '暂停 1 小时', value: 60 },
  { label: '暂停 2 小时', value: 120 },
  { label: '今天不再提醒', value: -1 },
];
