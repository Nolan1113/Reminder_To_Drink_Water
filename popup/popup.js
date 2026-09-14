// ============================================================
// popup/popup.js — Popup 界面逻辑
// 只负责 UI 渲染和用户交互，通过 chrome.runtime.sendMessage 与 SW 通信
// 不直接操作 Alarm
// ============================================================

import { runtimeAPI, alarmsAPI } from '../utils/browser-api.js';
import { getSettings } from '../services/settings-service.js';
import { getTodayData } from '../services/water-service.js';
import { getTodayPercentage } from '../services/stats-service.js';
import { ALARM_NAMES } from '../utils/constants.js';
import { formatCountdown } from '../utils/date.js';

// ─────────────────────────────────────────────
// DOM 元素引用
// ─────────────────────────────────────────────
const elems = {
  headerDate: document.getElementById('header-date'),
  todayTotal: document.getElementById('today-total'),
  dailyGoal: document.getElementById('daily-goal'),
  pctBadge: document.getElementById('pct-badge'),
  progressBar: document.getElementById('progress-bar'),
  reminderDot: document.getElementById('reminder-dot'),
  reminderStatusText: document.getElementById('reminder-status-text'),
  reminderCountdown: document.getElementById('reminder-countdown'),
  defaultAmount: document.getElementById('default-amount'),
  recordsList: document.getElementById('records-list'),
  btnDrank: document.getElementById('btn-drank'),
  btnToggle: document.getElementById('btn-toggle'),
  toggleIcon: document.getElementById('toggle-icon'),
  toggleText: document.getElementById('toggle-text'),
  btnPause: document.getElementById('btn-pause'),
  pauseBtnText: document.getElementById('pause-btn-text'),
  pauseDropdown: document.getElementById('pause-dropdown'),
  cancelPause: document.getElementById('cancel-pause'),
  btnSettings: document.getElementById('btn-settings'),
  footerSettingsBtn: document.getElementById('footer-settings-btn'),
  footerWeekday: document.getElementById('footer-weekday'),
  customModal: document.getElementById('custom-modal'),
  customAmountInput: document.getElementById('custom-amount-input'),
  modalCancel: document.getElementById('modal-cancel'),
  modalConfirm: document.getElementById('modal-confirm'),
  toast: document.getElementById('toast'),
};

// ─────────────────────────────────────────────
// 状态
// ─────────────────────────────────────────────
let currentSettings = null;
let countdownTimer = null;

// ─────────────────────────────────────────────
// 初始化
// ─────────────────────────────────────────────
async function init() {
  // 显示当前日期
  updateHeaderDate();

  // 加载数据并渲染
  await loadAndRender();

  // 绑定事件
  bindEvents();

  // 启动倒计时更新（每秒）
  startCountdownTimer();
}

// ─────────────────────────────────────────────
// 数据加载与渲染
// ─────────────────────────────────────────────
async function loadAndRender() {
  try {
    currentSettings = await getSettings();
    const todayData = await getTodayData();
    const pct = getTodayPercentage(todayData.total, currentSettings.dailyGoal);

    renderProgress(todayData.total, currentSettings.dailyGoal, pct);
    renderRecords(todayData.records);
    renderToggleState(currentSettings.enabled);
    renderPauseState(currentSettings.pauseUntil);
    updateDefaultAmountDisplay(currentSettings.defaultAmount);
    await updateCountdown();
  } catch (err) {
    console.error('[Popup] 数据加载失败:', err);
  }
}

// ─────────────────────────────────────────────
// 渲染函数
// ─────────────────────────────────────────────
function renderProgress(total, goal, pct) {
  elems.todayTotal.textContent = total;
  elems.dailyGoal.textContent = goal;

  const pctText = pct >= 100 ? '🎉 已达标！' : `${pct}%`;
  elems.pctBadge.textContent = pctText;

  const achieved = pct >= 100;
  elems.pctBadge.classList.toggle('achieved', achieved);
  elems.progressBar.style.width = `${Math.min(100, pct)}%`;
  elems.progressBar.classList.toggle('achieved', achieved);

  // 更新 ARIA
  elems.progressBar.parentElement.setAttribute('aria-valuenow', pct);
}

function renderRecords(records) {
  if (!records || records.length === 0) {
    elems.recordsList.innerHTML = '<span style="color: var(--text-muted); font-size: 12px;">暂无记录，喝点水吧 💧</span>';
    return;
  }

  // 最多显示最近 8 条
  const recent = records.slice(-8).reverse();
  elems.recordsList.innerHTML = recent.map(r =>
    `<span class="record-chip"><span class="time">${r.time}</span> +${r.amount}ml</span>`
  ).join('');
}

function renderToggleState(enabled) {
  elems.btnToggle.classList.toggle('active', enabled);
  elems.btnToggle.classList.toggle('disabled-state', !enabled);
  elems.toggleIcon.textContent = enabled ? '🔔' : '🔕';
  elems.toggleText.textContent = enabled ? '提醒已开启' : '提醒已关闭';
}

function renderPauseState(pauseUntil) {
  const isPaused = pauseUntil && Date.now() < pauseUntil;
  elems.btnPause.classList.toggle('active-pause', isPaused);
  elems.cancelPause.style.display = isPaused ? 'block' : 'none';

  if (isPaused) {
    const remainMin = Math.ceil((pauseUntil - Date.now()) / 60000);
    const h = Math.floor(remainMin / 60);
    const m = remainMin % 60;
    elems.pauseBtnText.textContent = h > 0 ? `已暂停 ${h}h${m > 0 ? m + 'm' : ''}` : `已暂停 ${m}m`;
  } else {
    elems.pauseBtnText.textContent = '暂停';
  }
}

function updateDefaultAmountDisplay(amount) {
  elems.defaultAmount.textContent = amount;
}

async function updateCountdown() {
  if (!currentSettings) return;

  const isPaused = currentSettings.pauseUntil && Date.now() < currentSettings.pauseUntil;
  const isEnabled = currentSettings.enabled;

  if (!isEnabled) {
    setCountdownDisplay('disabled', '已关闭', '提醒已关闭');
    return;
  }

  if (isPaused) {
    const remainSec = Math.ceil((currentSettings.pauseUntil - Date.now()) / 1000);
    const h = Math.floor(remainSec / 3600);
    const m = Math.floor((remainSec % 3600) / 60);
    const s = remainSec % 60;
    const display = h > 0
      ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    setCountdownDisplay('paused', '暂停中 · 剩余', display);
    return;
  }

  // 查询主 Alarm（使用原生 API 获取精确剩余时间）
  try {
    const alarm = await alarmsAPI.get(ALARM_NAMES.MAIN);
    if (!alarm) {
      setCountdownDisplay('active', '等待下次提醒', '初始化中...');
      return;
    }

    const remainMs = Math.max(0, alarm.scheduledTime - Date.now());
    const remainSec = Math.ceil(remainMs / 1000);
    const display = formatCountdown(remainSec);
    setCountdownDisplay('active', '下次提醒', display);
  } catch (e) {
    console.warn('[Popup] 获取 Alarm 失败:', e);
    setCountdownDisplay('active', '下次提醒', '--:--');
  }
}

function setCountdownDisplay(state, statusText, countdownText) {
  elems.reminderDot.className = 'reminder-dot ' + (state === 'active' ? '' : state);
  elems.reminderStatusText.textContent = statusText;
  elems.reminderCountdown.textContent = countdownText;
  elems.reminderCountdown.className = 'reminder-countdown ' + (state === 'active' ? '' : state);
}

function updateHeaderDate() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekday = weekdays[now.getDay()];
  elems.headerDate.textContent = `${dateStr} · ${weekday}`;
  elems.footerWeekday.textContent = `${now.toLocaleDateString('zh-CA')} ${weekday}`;
}

// ─────────────────────────────────────────────
// 事件绑定
// ─────────────────────────────────────────────
function bindEvents() {
  // 设置按钮
  elems.btnSettings.addEventListener('click', openOptions);
  elems.footerSettingsBtn.addEventListener('click', openOptions);

  // 快速饮水按钮
  document.querySelectorAll('.quick-btn[data-amount]').forEach(btn => {
    btn.addEventListener('click', () => {
      const amount = parseInt(btn.dataset.amount, 10);
      recordWater(amount);
    });
  });

  // 自定义按钮
  document.getElementById('btn-custom').addEventListener('click', () => {
    openCustomModal();
  });

  // 主"我喝水了"按钮
  elems.btnDrank.addEventListener('click', () => {
    const amount = currentSettings?.defaultAmount || 250;
    recordWater(amount);
  });

  // 启用/禁用开关
  elems.btnToggle.addEventListener('click', toggleReminder);

  // 暂停按钮（显示/隐藏下拉）
  elems.btnPause.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = elems.pauseDropdown.classList.contains('open');
    closePauseDropdown();
    if (!isOpen) {
      elems.pauseDropdown.classList.add('open');
      elems.btnPause.setAttribute('aria-expanded', 'true');
    }
  });

  // 暂停选项
  elems.pauseDropdown.querySelectorAll('.pause-option[data-minutes]').forEach(opt => {
    opt.addEventListener('click', () => {
      const minutes = parseInt(opt.dataset.minutes, 10);
      setPause(minutes);
      closePauseDropdown();
    });
  });

  // 取消暂停
  elems.cancelPause.addEventListener('click', () => {
    cancelPause();
    closePauseDropdown();
  });

  // 点击外部关闭下拉
  document.addEventListener('click', (e) => {
    if (!elems.pauseDropdown.contains(e.target) && e.target !== elems.btnPause) {
      closePauseDropdown();
    }
  });

  // 自定义弹窗
  elems.modalCancel.addEventListener('click', closeCustomModal);
  elems.modalConfirm.addEventListener('click', confirmCustomAmount);
  elems.customModal.addEventListener('click', (e) => {
    if (e.target === elems.customModal) closeCustomModal();
  });
  elems.customAmountInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmCustomAmount();
    if (e.key === 'Escape') closeCustomModal();
  });
}

function closePauseDropdown() {
  elems.pauseDropdown.classList.remove('open');
  elems.btnPause.setAttribute('aria-expanded', 'false');
}

// ─────────────────────────────────────────────
// 业务操作（通过 SW 消息或直接调用 service）
// ─────────────────────────────────────────────
async function recordWater(amount) {
  if (!amount || amount <= 0) return;

  try {
    const response = await runtimeAPI.sendMessage({ type: 'ADD_WATER', amount });
    if (response?.success) {
      const data = response.data;
      const pct = getTodayPercentage(data.total, currentSettings.dailyGoal);
      renderProgress(data.total, currentSettings.dailyGoal, pct);
      renderRecords(data.records);

      if (data.total >= currentSettings.dailyGoal) {
        showToast('🎉 恭喜达成今日目标！', 'success');
      } else {
        showToast(`✅ 已记录 +${amount}ml`, 'success');
      }
    }
  } catch (err) {
    console.error('[Popup] 记录饮水失败:', err);
    showToast('记录失败，请重试', '');
  }
}

async function toggleReminder() {
  try {
    const response = await runtimeAPI.sendMessage({ type: 'TOGGLE_ENABLED' });
    if (response?.success) {
      currentSettings.enabled = response.data.enabled;
      renderToggleState(currentSettings.enabled);
      showToast(currentSettings.enabled ? '🔔 提醒已开启' : '🔕 提醒已关闭', 'info');
      await updateCountdown();
    }
  } catch (err) {
    console.error('[Popup] 切换提醒失败:', err);
  }
}

async function setPause(minutes) {
  try {
    await runtimeAPI.sendMessage({ type: 'SET_PAUSE', minutes });
    // 更新本地状态
    if (minutes === -1) {
      const now = new Date();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      currentSettings.pauseUntil = end.getTime();
    } else {
      currentSettings.pauseUntil = Date.now() + minutes * 60 * 1000;
    }
    renderPauseState(currentSettings.pauseUntil);

    const label = minutes === -1 ? '今天不再提醒' :
      minutes >= 60 ? `已暂停 ${minutes / 60} 小时` : `已暂停 ${minutes} 分钟`;
    showToast(`⏸ ${label}`, 'info');
    await updateCountdown();
  } catch (err) {
    console.error('[Popup] 设置暂停失败:', err);
  }
}

async function cancelPause() {
  try {
    await runtimeAPI.sendMessage({ type: 'CANCEL_PAUSE' });
    currentSettings.pauseUntil = 0;
    renderPauseState(0);
    showToast('✓ 已恢复提醒', 'success');
    await updateCountdown();
  } catch (err) {
    console.error('[Popup] 取消暂停失败:', err);
  }
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}

// ─────────────────────────────────────────────
// 自定义饮水量弹窗
// ─────────────────────────────────────────────
function openCustomModal() {
  elems.customAmountInput.value = '';
  elems.customModal.classList.add('open');
  setTimeout(() => elems.customAmountInput.focus(), 100);
}

function closeCustomModal() {
  elems.customModal.classList.remove('open');
}

async function confirmCustomAmount() {
  const val = parseInt(elems.customAmountInput.value, 10);
  if (!val || val <= 0 || val > 5000) {
    elems.customAmountInput.style.borderColor = 'var(--accent-red)';
    setTimeout(() => { elems.customAmountInput.style.borderColor = ''; }, 1500);
    return;
  }
  closeCustomModal();
  await recordWater(val);
}

// ─────────────────────────────────────────────
// Toast 通知
// ─────────────────────────────────────────────
let toastTimer = null;
function showToast(message, type = '') {
  clearTimeout(toastTimer);
  elems.toast.textContent = message;
  elems.toast.className = `toast ${type} show`;
  toastTimer = setTimeout(() => {
    elems.toast.classList.remove('show');
  }, 2500);
}

// ─────────────────────────────────────────────
// 倒计时定时器
// ─────────────────────────────────────────────
function startCountdownTimer() {
  countdownTimer = setInterval(async () => {
    // 定期刷新设置（暂停状态可能在后台变更）
    currentSettings = await getSettings();
    renderPauseState(currentSettings.pauseUntil);
    await updateCountdown();
  }, 1000);
}

// ─────────────────────────────────────────────
// 启动
// ─────────────────────────────────────────────
init().catch(console.error);
