// ============================================================
// utils/date.js — 本地时区日期工具函数
// 必须使用本地时区，避免 toISOString() 导致日期偏移
// ============================================================

/**
 * 获取当前本地日期字符串，格式：YYYY-MM-DD
 * 使用 toLocaleDateString 配合 zh-CA（返回 YYYY-MM-DD 格式）
 * @returns {string} e.g. "2026-09-10"
 */
export function getTodayKey() {
  return new Date().toLocaleDateString('zh-CA'); // zh-CA locale 返回 YYYY-MM-DD
}

/**
 * 将日期对象格式化为 YYYY-MM-DD
 * @param {Date} date
 * @returns {string}
 */
export function formatDateKey(date) {
  return date.toLocaleDateString('zh-CA');
}

/**
 * 获取当前时间字符串，格式：HH:MM
 * @returns {string} e.g. "09:30"
 */
export function getCurrentTimeStr() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * 判断当前时间是否在 startTime ~ endTime 范围内
 * @param {string} startTime - "08:00"
 * @param {string} endTime   - "22:00"
 * @returns {boolean}
 */
export function isInTimeRange(startTime, endTime) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);

  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;

  // 支持跨午夜场景（如 22:00 ~ 06:00）
  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}

/**
 * 获取当前是星期几（1=周一, 7=周日）
 * @returns {number} 1-7
 */
export function getTodayWeekday() {
  const day = new Date().getDay(); // 0=周日, 1=周一, ..., 6=周六
  return day === 0 ? 7 : day;     // 转换为 1-7（周一到周日）
}

/**
 * 获取今天结束时间戳（本地时间 23:59:59）
 * @returns {number} 时间戳（毫秒）
 */
export function getTodayEndTimestamp() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return end.getTime();
}

/**
 * 将分钟数转为可读文本，例如 90 => "1小时30分钟"
 * @param {number} minutes
 * @returns {string}
 */
export function formatMinutes(minutes) {
  if (minutes < 1) return '不到1分钟';
  if (minutes < 60) return `${Math.round(minutes)}分钟`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
}

/**
 * 将秒数转为 mm:ss 格式
 * @param {number} seconds
 * @returns {string}
 */
export function formatCountdown(seconds) {
  if (seconds <= 0) return '即将提醒';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
