// ============================================================
// options/options.js — 设置页面逻辑
//
// ⚡ 关键设计：
//   保存设置时，选项页直接调用 chrome.alarms API 重置 Alarm，
//   而不是单纯依赖 SW 消息（SW 可能处于休眠状态未响应）。
//   同时向 SW 发送消息作为辅助通知。
// ============================================================

import { getSettings, saveSettings, resetSettings } from '../services/settings-service.js';
import { ALARM_NAMES } from '../utils/constants.js';
import { runtimeAPI } from '../utils/browser-api.js';

// ─────────────────────────────────────────────
// DOM 元素
// ─────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const fields = {
  dailyGoal:         $('daily-goal'),
  defaultAmount:     $('default-amount'),
  intervalMinutes:   $('interval-minutes'),
  snoozeMinutes:     $('snooze-minutes'),
  startTime:         $('start-time'),
  endTime:           $('end-time'),
  weekdaySelector:   $('weekday-selector'),
  notifEnabled:      $('notif-enabled'),
  badgeEnabled:      $('badge-enabled'),
  soundEnabled:      $('sound-enabled'),
  notifDuration:     $('notif-duration'),           // 喜水通知显示时长（秒）
  foodEnabled:       $('food-reminder-enabled'),    // 外卖提醒开关
  foodTime:          $('food-reminder-time'),       // 外卖提醒时间
  foodDuration:      $('food-reminder-duration'),   // 外卖通知显示时长（秒）
  btnSave:           $('btn-save'),
  btnReset:          $('btn-reset'),
  toast:             $('toast'),
};

// 当前选中的提醒星期（Set，1=周一，7=周日）
let selectedDays = new Set([1, 2, 3, 4, 5, 6, 7]);

// ─────────────────────────────────────────────
// 初始化
// ─────────────────────────────────────────────
async function init() {
  try {
    const settings = await getSettings();
    populateForm(settings);
    bindEvents();
    console.log('[Options] 初始化完成，当前设置:', settings);
  } catch (err) {
    console.error('[Options] 初始化失败:', err);
    showToast('加载设置失败，请刷新页面', 'error');
  }
}

// ─────────────────────────────────────────────
// 将设置值填入表单
// ─────────────────────────────────────────────
function populateForm(settings) {
  fields.dailyGoal.value = settings.dailyGoal;
  fields.defaultAmount.value = settings.defaultAmount;
  fields.snoozeMinutes.value = settings.snoozeMinutes;
  fields.startTime.value = settings.startTime;
  fields.endTime.value = settings.endTime;
  fields.notifEnabled.checked = settings.notifEnabled;
  fields.badgeEnabled.checked = settings.badgeEnabled;
  fields.soundEnabled.checked = settings.soundEnabled;

  // 喜水通知显示时长下拉
  const durStr = String(settings.notifDurationSeconds ?? 180);
  const durOption = fields.notifDuration.querySelector(`option[value="${durStr}"]`);
  fields.notifDuration.value = durOption ? durStr : '180';

  // 外卖提醒字段回填
  fields.foodEnabled.checked = settings.foodReminderEnabled ?? true;
  fields.foodTime.value = settings.foodReminderTime ?? '11:20';
  const foodDurStr = String(settings.foodReminderDurationSeconds ?? 300);
  const foodDurOpt = fields.foodDuration.querySelector(`option[value="${foodDurStr}"]`);
  fields.foodDuration.value = foodDurOpt ? foodDurStr : '300';

  // 提醒间隔下拉（直接匹配 1~100 中的任意值）
  const intervalStr = String(settings.intervalMinutes);
  // 如果当前值在选项内则选中，否则默认选 30
  const option = fields.intervalMinutes.querySelector(`option[value="${intervalStr}"]`);
  fields.intervalMinutes.value = option ? intervalStr : '30';

  // 提醒星期
  selectedDays = new Set(settings.activeDays);
  renderWeekdays();
}

// ─────────────────────────────────────────────
// 渲染星期按钮状态
// ─────────────────────────────────────────────
function renderWeekdays() {
  fields.weekdaySelector.querySelectorAll('.weekday-btn').forEach(btn => {
    const day = parseInt(btn.dataset.day, 10);
    const isActive = selectedDays.has(day);
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
}

// ─────────────────────────────────────────────
// 事件绑定
// ─────────────────────────────────────────────
function bindEvents() {
  // 星期选择
  fields.weekdaySelector.querySelectorAll('.weekday-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const day = parseInt(btn.dataset.day, 10);
      if (selectedDays.has(day)) {
        if (selectedDays.size <= 1) {
          showToast('至少保留一天', 'error');
          return;
        }
        selectedDays.delete(day);
      } else {
        selectedDays.add(day);
      }
      renderWeekdays();
    });
  });

  // 保存
  fields.btnSave.addEventListener('click', saveAll);

  // 重置
  fields.btnReset.addEventListener('click', async () => {
    if (!confirm('确认恢复所有设置为默认值？')) return;
    try {
      const defaults = await resetSettings();
      populateForm(defaults);
      await applyAlarmReset(defaults);
      showToast('✓ 已重置为默认设置', 'success');
    } catch (err) {
      console.error('[Options] 重置失败:', err);
      showToast('重置失败，请重试', 'error');
    }
  });
}

// ─────────────────────────────────────────────
// 读取表单值并保存
// ─────────────────────────────────────────────
async function saveAll() {
  // 读取并校验表单值
  const dailyGoal     = parseInt(fields.dailyGoal.value, 10);
  const defaultAmount = parseInt(fields.defaultAmount.value, 10);
  const snoozeMinutes = parseInt(fields.snoozeMinutes.value, 10);
  const startTime     = fields.startTime.value;
  const endTime       = fields.endTime.value;

  let intervalMinutes;
  intervalMinutes = parseInt(fields.intervalMinutes.value, 10);

  // ── 数据校验 ──
  if (!dailyGoal || dailyGoal < 100 || dailyGoal > 10000) {
    showToast('每日目标应在 100~10000ml 之间', 'error');
    fields.dailyGoal.focus();
    return;
  }
  if (!defaultAmount || defaultAmount < 50 || defaultAmount > 2000) {
    showToast('单次饮水量应在 50~2000ml 之间', 'error');
    fields.defaultAmount.focus();
    return;
  }
  if (!intervalMinutes || intervalMinutes < 1 || intervalMinutes > 480) {
    showToast('提醒间隔应在 1~480 分钟之间', 'error');
    return;
  }
  if (!snoozeMinutes || snoozeMinutes < 1 || snoozeMinutes > 120) {
    showToast('稍后提醒间隔应在 1~120 分钟之间', 'error');
    return;
  }
  if (!startTime || !endTime) {
    showToast('请设置开始和结束提醒时间', 'error');
    return;
  }
  if (selectedDays.size === 0) {
    showToast('至少选择一天开启提醒', 'error');
    return;
  }

  // 构建新设置（继承旧设置中的 pauseUntil 等运行时字段）
  const currentSettings = await getSettings();
  const newSettings = {
    ...currentSettings,
    dailyGoal,
    defaultAmount,
    intervalMinutes,
    snoozeMinutes,
    startTime,
    endTime,
    activeDays: Array.from(selectedDays).sort((a, b) => a - b),
    notifEnabled: fields.notifEnabled.checked,
    badgeEnabled: fields.badgeEnabled.checked,
    soundEnabled: fields.soundEnabled.checked,
    notifDurationSeconds: parseInt(fields.notifDuration.value, 10) || 180,
    // 外卖提醒
    foodReminderEnabled: fields.foodEnabled.checked,
    foodReminderTime: fields.foodTime.value || '11:20',
    foodReminderDurationSeconds: parseInt(fields.foodDuration.value, 10) || 300,
  };

  try {
    // 1. 先写入 storage（直接写，最可靠）
    await saveSettings(newSettings);
    console.log('[Options] 设置已写入 storage:', newSettings);

    // 2. 直接操作 chrome.alarms，不依赖 SW 是否在线
    //    这是修复"1分钟提醒无效"的关键修改
    await applyAlarmReset(newSettings);

    // 3. 同时通知 SW（最佳努力，SW 可能已在线或刚被唤醒）
    try {
      await runtimeAPI.sendMessage({ type: 'SAVE_SETTINGS', settings: newSettings });
    } catch (e) {
      // SW 消息失败不影响功能，alarm 已直接创建
      console.warn('[Options] SW 消息发送失败（非致命）:', e);
    }

    showToast(`✅ 设置已保存，提醒间隔：${intervalMinutes} 分钟`, 'success');
  } catch (err) {
    console.error('[Options] 保存失败:', err);
    showToast('保存失败，请重试', 'error');
  }
}

// ─────────────────────────────────────────────
// 直接重置 Alarm（不依赖 SW 消息）
// ─────────────────────────────────────────────
async function applyAlarmReset(settings) {
  // 清除所有旧 Alarm
  await new Promise((resolve) => chrome.alarms.clearAll(resolve));
  console.log('[Options] 所有旧 Alarm 已清除');

  if (settings.enabled) {
    // 主提醒循环 Alarm
    chrome.alarms.create(ALARM_NAMES.MAIN, {
      delayInMinutes: settings.intervalMinutes,
      periodInMinutes: settings.intervalMinutes,
    });
    console.log(`[Options] ✅ 主 Alarm 已创建，间隔: ${settings.intervalMinutes} 分钟`);
  } else {
    console.log('[Options] 提醒已禁用，不创建主 Alarm');
  }

  // 外卖提醒每日定时 Alarm
  if (settings.foodReminderEnabled) {
    const [hh, mm] = (settings.foodReminderTime || '11:20').split(':').map(Number);
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
    chrome.alarms.create(ALARM_NAMES.FOOD, {
      when: target.getTime(),
      periodInMinutes: 24 * 60,
    });
    const timeLabel = target.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    console.log(`[Options] ✅ 外卖提醒 Alarm 已创建，首次触发: ${timeLabel}`);
  } else {
    console.log('[Options] 外卖提醒已禁用，不创建 Alarm');
  }

  // 验证主 Alarm 创建是否成功
  setTimeout(() => {
    chrome.alarms.get(ALARM_NAMES.MAIN, (alarm) => {
      if (alarm) {
        console.log('[Options] Alarm 验证成功，下次触发时间:', new Date(alarm.scheduledTime).toLocaleTimeString());
      } else if (settings.enabled) {
        console.error('[Options] ⚠️ Alarm 创建后未找到，可能创建失败！');
      }
    });
  }, 200);
}

// ─────────────────────────────────────────────
// Toast 提示
// ─────────────────────────────────────────────
let toastTimer = null;
function showToast(message, type = '') {
  clearTimeout(toastTimer);
  fields.toast.textContent = message;
  fields.toast.className = `toast ${type} show`;
  toastTimer = setTimeout(() => {
    fields.toast.classList.remove('show');
  }, 3500);
}

// ─────────────────────────────────────────────
// 启动
// ─────────────────────────────────────────────
init().catch(console.error);
