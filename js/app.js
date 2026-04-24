// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_STORE_NAMES = [
  '中華', '振興', '民生', '民主', '自由',
  '鐵道', '經國', '南大二', '雙園', '高翠',
  '埔頂', '埔頂二', '關埔', '世傑', '慈雲',
  '世界', '大同', '寶山', '食品', '東山',
  '巨城', '國華', '博愛', '東光', '林森',
  '江山', '竹蓮', '陽光',
];

const MORNING_ROUTES = [
  { label: '路線一',  stores: ['鐵道', '經國', '國華'] },
  { label: '路線二',  stores: ['民生', '民主', '巨城'] },
  { label: '路線三',  stores: ['振興', '陽光', '南大二'] },
  { label: '路線四',  stores: ['中華', '林森', '竹蓮'] },
  { label: '路線五',  stores: ['江山', '世界', '大同'] },
  { label: '路線六',  stores: ['東山', '寶山', '食品'] },
  { label: '路線七',  stores: ['東光', '博愛', '自由'] },
  { label: '路線八',  stores: ['雙園', '高翠'] },
  { label: '路線九',  stores: ['關埔', '埔頂'] },
  { label: '路線十',  stores: ['世傑', '埔頂二', '慈雲'] },
];

const EVENING_ROUTES = [
  { label: '路線一',   stores: ['巨城', '國華'] },
  { label: '路線二',   stores: ['鐵道', '經國'] },
  { label: '路線三',   stores: ['民生', '民主'] },
  { label: '路線四',   stores: ['陽光', '南大二', '竹蓮'] },
  { label: '路線五',   stores: ['中華', '林森'] },
  { label: '路線六',   stores: ['世界', '大同'] },
  { label: '路線七',   stores: ['江山', '振興'] },
  { label: '路線八',   stores: ['東山', '寶山', '食品'] },
  { label: '路線九',   stores: ['東光', '博愛', '自由'] },
  { label: '路線十',   stores: ['雙園', '高翠'] },
  { label: '路線十一', stores: ['關埔', '埔頂'] },
  { label: '路線十二', stores: ['世傑', '埔頂二', '慈雲'] },
];

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  staff: [],
  schedule: null,
  startDate: '',
  storeSettings: {
    count: 28,
    customNames: DEFAULT_STORE_NAMES,
  },
  activeTab: 'schedule',
};

let addFormShiftType = 'both';  // default shift for newly added staff (applied to all 14 days)
let editingIndex     = null;
let addModalCtx      = { dayIndex: null, shiftType: null };

// Cycle order for each date-button click
const SHIFT_CYCLE  = { both: 'morning', morning: 'evening', evening: null };
const SHIFT_LABELS = { both: '早晚', morning: '早', evening: '晚' };

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();

  document.getElementById('start-date').value = state.startDate || getNextMonday();
  document.getElementById('setting-store-count').value = state.storeSettings.count;
  populateRouteSelects();

  renderStaff();
  renderSchedule();
  renderStoreAssignment();
  renderStats();

  document.getElementById('staff-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addStaff(); }
  });
  document.getElementById('add-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAddModal();
  });
  document.getElementById('edit-staff-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeEditStaffModal();
  });
  document.getElementById('store-names-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeStoreNamesModal();
  });
});

// ── Staff helpers ─────────────────────────────────────────────────────────────
function makeStaff(name, dayShifts, morningRoutePref, eveningRoutePref) {
  return {
    name,
    dayShifts: { ...(dayShifts || {}) },
    morningRoutePref: morningRoutePref || null,
    eveningRoutePref: eveningRoutePref || null,
  };
}

// Build a dayShifts object where all 14 days are set to the same shiftType
function makeUniformDayShifts(shiftType = 'both') {
  const shifts = {};
  for (let i = 0; i < 14; i++) shifts[i] = shiftType;
  return shifts;
}

function daysAvailableText(dayShifts) {
  if (!dayShifts) return '全 14 天';
  const entries = Object.values(dayShifts);
  const count   = entries.length;
  if (count === 0) return '無可上班日';
  if (count === 14 && entries.every(v => v === 'both')) return '全 14 天';

  const b = entries.filter(v => v === 'both').length;
  const m = entries.filter(v => v === 'morning').length;
  const e = entries.filter(v => v === 'evening').length;
  const parts = [];
  if (b) parts.push(`早晚×${b}`);
  if (m) parts.push(`早×${m}`);
  if (e) parts.push(`晚×${e}`);
  return `${count}天 (${parts.join(' ')})`;
}

// ── Add form: default shift type & route preference ───────────────────────────
function populateRouteSelects() {
  const fill = (id, routes) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '<option value="">無偏好</option>' +
      routes.map(r => `<option value="${escAttr(r.label)}">${escHtml(r.label)}</option>`).join('');
  };
  fill('add-morning-route', MORNING_ROUTES);
  fill('add-evening-route', EVENING_ROUTES);
}

function setShiftType(value) {
  addFormShiftType = value;
  document.querySelectorAll('#shift-type-group .st-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });
}

// ── Staff Management ──────────────────────────────────────────────────────────
function addStaff() {
  const raw = document.getElementById('staff-input').value.trim();
  if (!raw) return;

  const morningRoute = document.getElementById('add-morning-route')?.value || null;
  const eveningRoute = document.getElementById('add-evening-route')?.value || null;

  const names = raw.split(/[\n,，、]+/).map(s => s.trim()).filter(Boolean);
  let added = 0;
  names.forEach(name => {
    if (!state.staff.find(s => s.name === name)) {
      state.staff.push(makeStaff(name, makeUniformDayShifts(addFormShiftType), morningRoute || null, eveningRoute || null));
      added++;
    }
  });

  document.getElementById('staff-input').value = '';
  persist();
  renderStaff();
  if (added) showToast(`已新增 ${added} 位人員`);
}

function removeStaff(index) {
  state.staff.splice(index, 1);
  persist();
  renderStaff();
  renderSchedule();
  renderStats();
}

function clearAllStaff() {
  if (!confirm('確定要清除所有人員？')) return;
  state.staff = [];
  persist();
  renderStaff();
  renderSchedule();
  renderStats();
}

function importSampleStaff() {
  const samples = [
    '王小明','李美華','陳志偉','林佳蓉','黃建宏','吳淑芬','張家豪','劉雅婷',
    '蔡正義','許佩君','鄭文傑','葉美玲','賴宗翰','謝欣怡','洪志豪','周雅慧',
    '蘇家銘','邱秀英','廖建宏','江淑娟','曾志遠','彭美華','呂宗哲','盧雅文',
    '柯志成','潘淑惠','余建明','蕭美雲','何宗仁','朱雅芳','宋志豪','胡佳慧',
    '徐建成','馮秀蘭','魏宗達','翁淑貞','范志明','沈美華','孫宗憲','戴雅琪',
    '韓建文','施淑芳','杜志勇','鍾美麗','尤宗祥',
  ];
  samples.forEach(name => {
    if (!state.staff.find(s => s.name === name)) {
      state.staff.push(makeStaff(name, makeUniformDayShifts('both')));
    }
  });
  persist();
  renderStaff();
  showToast('已載入 45 位範例人員');
}

// ── Edit Staff Modal ──────────────────────────────────────────────────────────
function editStaff(index) {
  editingIndex = index;
  const s = state.staff[index];

  document.getElementById('edit-name-input').value = s.name;
  renderDateGrid(s.dayShifts || {});
  renderRoutePrefButtons('morning', s.morningRoutePref || null);
  renderRoutePrefButtons('evening', s.eveningRoutePref || null);

  document.getElementById('edit-staff-modal').classList.add('active');
}

function renderRoutePrefButtons(type, currentPref) {
  const routes = type === 'morning' ? MORNING_ROUTES : EVENING_ROUTES;
  const el = document.getElementById(`${type}-route-pref`);
  if (!el) return;
  const opts = [{ label: '無偏好', value: '' }, ...routes.map(r => ({ label: r.label, value: r.label }))];
  el.innerHTML = opts.map(opt => {
    const active = opt.value === (currentPref || '');
    return `<button class="route-pref-btn${active ? ' active' : ''}" data-value="${escAttr(opt.value)}"
      onclick="setRoutePref('${type}','${escAttr(opt.value)}')">${escHtml(opt.label)}</button>`;
  }).join('');
}

function setRoutePref(type, value) {
  document.querySelectorAll(`#${type}-route-pref .route-pref-btn`).forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });
}

function renderDateGrid(dayShifts) {
  const container = document.getElementById('edit-dates-grid');
  const startVal  = document.getElementById('start-date').value;
  const DOW = '日一二三四五六';

  let html = '';
  for (let i = 0; i < 14; i++) {
    const shift = dayShifts[i] ?? null;

    let dateStr, dowStr;
    if (startVal) {
      const d = new Date(startVal + 'T00:00:00');
      d.setDate(d.getDate() + i);
      dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
      dowStr  = DOW[d.getDay()];
    } else {
      dateStr = `第${i + 1}天`;
      dowStr  = '';
    }

    const shiftAttr  = shift ? `data-shift="${shift}"` : '';
    const shiftLabel = shift ? SHIFT_LABELS[shift] : '✕';
    const gapClass   = i === 7 ? ' week-gap' : '';

    html += `<button class="date-btn${gapClass}" data-offset="${i}" ${shiftAttr} onclick="cycleShiftBtn(this)">
      <span class="date-btn-top">${dateStr}</span>
      <span class="date-btn-dow">${dowStr}</span>
      <span class="date-btn-shift">${shiftLabel}</span>
    </button>`;
  }

  container.innerHTML = html;
}

// Click cycles: both → morning → evening → unavailable → both
function cycleShiftBtn(btn) {
  const current = btn.dataset.shift || null;
  const next    = current === null ? 'both' : (SHIFT_CYCLE[current] ?? null);
  applyShiftState(btn, next);
}

function applyShiftState(btn, shift) {
  if (shift) {
    btn.dataset.shift = shift;
  } else {
    delete btn.dataset.shift;
  }
  btn.querySelector('.date-btn-shift').textContent = shift ? SHIFT_LABELS[shift] : '✕';
}

function selectAllDates(shiftType = 'both') {
  document.querySelectorAll('#edit-dates-grid .date-btn').forEach(btn => {
    applyShiftState(btn, shiftType);
  });
}

function clearAllDates() {
  document.querySelectorAll('#edit-dates-grid .date-btn').forEach(btn => {
    applyShiftState(btn, null);
  });
}

function saveEditStaff() {
  if (editingIndex === null) return;

  const name = document.getElementById('edit-name-input').value.trim();
  if (!name) { showToast('姓名不能為空', 'error'); return; }

  const duplicate = state.staff.findIndex((s, i) => s.name === name && i !== editingIndex);
  if (duplicate !== -1) { showToast('已有同名人員', 'error'); return; }

  const dayShifts = {};
  document.querySelectorAll('#edit-dates-grid .date-btn').forEach(btn => {
    const shift = btn.dataset.shift;
    if (shift) dayShifts[parseInt(btn.dataset.offset)] = shift;
  });

  const morningPref = document.querySelector('#morning-route-pref .route-pref-btn.active')?.dataset.value || null;
  const eveningPref = document.querySelector('#evening-route-pref .route-pref-btn.active')?.dataset.value || null;

  state.staff[editingIndex] = makeStaff(name, dayShifts, morningPref || null, eveningPref || null);
  editingIndex = null;
  closeEditStaffModal();
  persist();
  renderStaff();
  renderStats();
  showToast('人員設定已更新');
}

function closeEditStaffModal() {
  document.getElementById('edit-staff-modal').classList.remove('active');
  editingIndex = null;
}

// ── Schedule Generation ───────────────────────────────────────────────────────
function generateSchedule() {
  const dateVal = document.getElementById('start-date').value;
  if (!dateVal) { showToast('請選擇開始日期', 'error'); return; }
  state.startDate = dateVal;

  try {
    state.schedule = Scheduler.generate(state.staff, dateVal, {
      stores: getStoreNames(),
      morningRoutes: MORNING_ROUTES,
      eveningRoutes: EVENING_ROUTES,
    });
    persist();
    renderSchedule();
    renderStoreAssignment();
    renderStats();
    switchTab('schedule');
    showToast('排班已產生！');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function clearSchedule() {
  if (!confirm('確定要清除排班表？')) return;
  state.schedule = null;
  persist();
  renderSchedule();
  renderStoreAssignment();
  renderStats();
}

// ── Shift Editing ─────────────────────────────────────────────────────────────
function toggleEndTime(dayIndex) {
  const day = state.schedule[dayIndex];
  day.evening.endTime = day.evening.endTime === '23:00' ? '22:00' : '23:00';
  persist();
  renderSchedule();
}

function removeFromShift(dayIndex, shiftType, name) {
  const day = state.schedule[dayIndex];
  if (shiftType === 'morning') {
    day.morning = day.morning.filter(s => s !== name);
  } else {
    day.evening.staff = day.evening.staff.filter(s => s !== name);
  }
  persist();
  renderSchedule();
  renderStats();
}

function openAddModal(dayIndex, shiftType) {
  addModalCtx = { dayIndex, shiftType };
  const day = state.schedule[dayIndex];
  const assignedToday = new Set([...day.morning, ...day.evening.staff]);

  // Only show staff who have the right preference for day dayIndex
  const available = state.staff.filter(s => {
    if (assignedToday.has(s.name)) return false;
    return shiftType === 'morning'
      ? Scheduler._canMorning(s, dayIndex)
      : Scheduler._canEvening(s, dayIndex);
  });

  const shiftLabel = shiftType === 'morning' ? '早班' : '晚班';
  document.getElementById('modal-title').textContent =
    `新增人員 — ${formatDateDisplay(day.date)}（${day.dayOfWeek}）${shiftLabel}`;

  const listEl = document.getElementById('modal-staff-list');
  listEl.innerHTML = available.length === 0
    ? '<p class="modal-empty">無可新增的人員</p>'
    : available.map(s =>
        `<button class="modal-staff-btn" onclick="addToShift('${escAttr(s.name)}')">${escHtml(s.name)}</button>`
      ).join('');

  document.getElementById('add-modal').classList.add('active');
}

function addToShift(name) {
  const { dayIndex, shiftType } = addModalCtx;
  const day = state.schedule[dayIndex];
  if (shiftType === 'morning') {
    if (!day.morning.includes(name)) day.morning.push(name);
  } else {
    if (!day.evening.staff.includes(name)) day.evening.staff.push(name);
  }
  closeAddModal();
  persist();
  renderSchedule();
  renderStats();
}

function closeAddModal() {
  document.getElementById('add-modal').classList.remove('active');
}

// ── Export ────────────────────────────────────────────────────────────────────
function exportCSV() {
  if (!state.schedule) { showToast('尚無排班可匯出', 'error'); return; }

  const rows = [['日期', '星期', '早班人數', '早班人員', '晚班人數', '晚班人員', '晚班結束時間']];
  state.schedule.forEach(day => {
    rows.push([
      day.date, day.dayOfWeek,
      day.morning.length, day.morning.join('、'),
      day.evening.staff.length, day.evening.staff.join('、'),
      day.evening.endTime,
    ]);
  });

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `排班表_${state.startDate || 'export'}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSV 已下載');
}

function printSchedule() { window.print(); }

// ── Render: Staff List ────────────────────────────────────────────────────────
function renderStaff() {
  const listEl  = document.getElementById('staff-list');
  const countEl = document.getElementById('staff-count');
  countEl.textContent = state.staff.length;

  if (state.staff.length === 0) {
    listEl.innerHTML = '<p class="sidebar-empty">尚未新增人員</p>';
    return;
  }

  listEl.innerHTML = state.staff.map((s, i) => {
    const prefParts = [];
    if (s.morningRoutePref) prefParts.push(`早:${s.morningRoutePref}`);
    if (s.eveningRoutePref) prefParts.push(`晚:${s.eveningRoutePref}`);
    const prefText = prefParts.join('・');
    return `
    <div class="staff-row">
      <div class="staff-row-main">
        <span class="staff-row-name">${escHtml(s.name)}</span>
        <button class="btn-edit-staff" onclick="editStaff(${i})" title="編輯">✎</button>
        <button class="btn-remove-staff" onclick="removeStaff(${i})" title="移除">×</button>
      </div>
      <span class="staff-days-text">${daysAvailableText(s.dayShifts)}</span>
      ${prefText ? `<span class="staff-pref-text">偏好 ${escHtml(prefText)}</span>` : ''}
    </div>`;
  }).join('');
}

// ── Render: Schedule Table ────────────────────────────────────────────────────
function renderSchedule() {
  const container = document.getElementById('tab-schedule');

  if (!state.schedule || state.schedule.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <p>請先新增人員，設定開始日期，然後點擊「產生排班」</p>
      </div>`;
    return;
  }

  const periodStart = formatDateDisplay(state.schedule[0].date);
  const periodEnd   = formatDateDisplay(state.schedule[state.schedule.length - 1].date);

  const rows = state.schedule.map((day, i) => {
    const isWeekend = day.dayOfWeek === '六' || day.dayOfWeek === '日';

    const morningTags = day.morning.map(s =>
      `<span class="tag tag-morning" onclick="removeFromShift(${i},'morning','${escAttr(s)}')" title="點擊移除">${escHtml(s)}</span>`
    ).join('');
    const eveningTags = day.evening.staff.map(s =>
      `<span class="tag tag-evening" onclick="removeFromShift(${i},'evening','${escAttr(s)}')" title="點擊移除">${escHtml(s)}</span>`
    ).join('');

    const morningBadge = `<span class="shift-badge">${day.morning.length} 人</span>`;
    const eveningBadge = `<span class="shift-badge">${day.evening.staff.length} 人</span>`;
    const rowClass = isWeekend ? 'row-weekend' : '';

    return `
      <tr class="${rowClass}">
        <td class="col-date">
          <span class="dow ${isWeekend ? 'dow-weekend' : ''}">${day.dayOfWeek}</span>
          <span class="date-str">${formatDateDisplay(day.date)}</span>
        </td>
        <td class="col-shift">
          <div class="shift-label shift-label-morning">
            早班 08:00–12:00 ${morningBadge}
          </div>
          <div class="tags-wrap">
            ${morningTags}
            <button class="btn-add-tag" onclick="openAddModal(${i},'morning')" title="新增人員">＋</button>
          </div>
        </td>
        <td class="col-shift">
          <div class="shift-label shift-label-evening">
            晚班 18:00–<button class="btn-endtime" onclick="toggleEndTime(${i})" title="點擊切換結束時間">${day.evening.endTime}</button>
            ${eveningBadge}
          </div>
          <div class="tags-wrap">
            ${eveningTags}
            <button class="btn-add-tag" onclick="openAddModal(${i},'evening')" title="新增人員">＋</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="schedule-header">
      <span class="schedule-period">📆 排班期間：${periodStart} ～ ${periodEnd}（14 天）</span>
      <div class="schedule-actions">
        <button class="btn btn-secondary" onclick="exportCSV()">匯出 CSV</button>
        <button class="btn btn-secondary" onclick="printSchedule()">列印</button>
        <button class="btn btn-danger-outline" onclick="clearSchedule()">清除排班</button>
      </div>
    </div>
    <div class="table-wrap">
      <table class="schedule-table">
        <thead>
          <tr>
            <th class="col-date">日期</th>
            <th class="col-shift">早班人員（08:00–12:00）</th>
            <th class="col-shift">晚班人員（18:00 起）</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── Render: Statistics ────────────────────────────────────────────────────────
function renderStats() {
  const container = document.getElementById('tab-stats');

  if (!state.schedule || state.staff.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>產生排班後可查看統計</p></div>';
    return;
  }

  const stats  = Scheduler.getStats(state.schedule, state.staff);
  const totals = state.staff.map(s => stats[s.name].total);
  const max    = Math.max(...totals);
  const min    = Math.min(...totals);
  const avg    = (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1);

  const sorted = [...state.staff].sort((a, b) => stats[b.name].total - stats[a.name].total);

  const rows = sorted.map(s => {
    const { morning, evening, total } = stats[s.name];
    const bar = max > 0 ? Math.round((total / max) * 100) : 0;
    return `
      <tr class="${total === max ? 'stat-max' : total === min ? 'stat-min' : ''}">
        <td>${escHtml(s.name)}</td>
        <td class="center">${morning}</td>
        <td class="center">${evening}</td>
        <td class="center"><strong>${total}</strong></td>
        <td class="col-bar">
          <div class="bar-track"><div class="bar-fill" style="width:${bar}%"></div></div>
        </td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="stats-summary">
      <div class="stat-card"><span class="stat-label">平均班數</span><span class="stat-value">${avg}</span></div>
      <div class="stat-card"><span class="stat-label">最多班數</span><span class="stat-value stat-value-max">${max}</span></div>
      <div class="stat-card"><span class="stat-label">最少班數</span><span class="stat-value stat-value-min">${min}</span></div>
      <div class="stat-card"><span class="stat-label">總人數</span><span class="stat-value">${state.staff.length}</span></div>
    </div>
    <div class="table-wrap">
      <table class="stats-table">
        <thead>
          <tr>
            <th>姓名</th>
            <th class="center">早班</th><th class="center">晚班</th>
            <th class="center">總計</th><th>分佈</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── Tab Switching ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tab}`);
  });
}

// ── Persistence ───────────────────────────────────────────────────────────────
function persist() {
  try {
    localStorage.setItem('shopee-schedule-v1', JSON.stringify({
      staff: state.staff, schedule: state.schedule,
      startDate: state.startDate,
      storeSettings: state.storeSettings,
    }));
  } catch (_) {}
}

function loadFromStorage() {
  try {
    const data = JSON.parse(localStorage.getItem('shopee-schedule-v1') || '{}');
    if (Array.isArray(data.staff)) {
      state.staff = data.staff.map(s => {
        if (typeof s === 'string') return makeStaff(s, makeUniformDayShifts('both'));
        if (!s.dayShifts) {
          const shiftType = s.shiftType || 'both';
          const dates = (s.availableDates && s.availableDates.length > 0)
            ? s.availableDates
            : Array.from({ length: 14 }, (_, i) => i);
          const dayShifts = {};
          dates.forEach(d => { dayShifts[d] = shiftType; });
          return makeStaff(s.name, dayShifts);
        }
        return s;
      });
    }
    if (data.schedule)  state.schedule  = data.schedule;
    if (data.startDate) state.startDate = data.startDate;
    if (data.storeSettings) {
      state.storeSettings = { ...state.storeSettings, ...data.storeSettings };
      if (!state.storeSettings.customNames || state.storeSettings.customNames.length === 0) {
        state.storeSettings.customNames = DEFAULT_STORE_NAMES;
      }
    }
  } catch (_) {}
}

// ── Store Management ──────────────────────────────────────────────────────────
function getStoreNames() {
  const { count, customNames } = state.storeSettings;
  if (customNames && customNames.length > 0) {
    // Pad or trim to match count
    if (customNames.length >= count) return customNames.slice(0, count);
    const extra = Array.from({ length: count - customNames.length }, (_, i) => `店${customNames.length + i + 1}`);
    return [...customNames, ...extra];
  }
  return Array.from({ length: count }, (_, i) => `店${i + 1}`);
}

function updateStoreCount() {
  state.storeSettings.count = parseInt(document.getElementById('setting-store-count').value) || 28;
  persist();
}

// Store Names Modal
function openStoreNamesModal() {
  const ta = document.getElementById('store-names-textarea');
  ta.value = getStoreNames().join('\n');
  updateStoreNamesCount();
  document.getElementById('store-names-modal').classList.add('active');
}

function updateStoreNamesCount() {
  const ta    = document.getElementById('store-names-textarea');
  const names = ta.value.split('\n').map(s => s.trim()).filter(Boolean);
  document.getElementById('store-names-count').textContent = names.length;
}

function saveStoreNames() {
  const ta    = document.getElementById('store-names-textarea');
  const names = ta.value.split('\n').map(s => s.trim()).filter(Boolean);
  if (names.length === 0) { showToast('請輸入至少一個店名', 'error'); return; }

  state.storeSettings.customNames = names;
  state.storeSettings.count       = names.length;
  document.getElementById('setting-store-count').value = names.length;
  closeStoreNamesModal();
  persist();
  showToast(`已儲存 ${names.length} 個店名`);
}

function closeStoreNamesModal() {
  document.getElementById('store-names-modal').classList.remove('active');
}

// ── Render: Store Assignment Tab ──────────────────────────────────────────────
function renderStoreAssignment() {
  const container = document.getElementById('tab-stores');
  if (!container) return;

  if (!state.schedule || !state.schedule[0]?.storeAssignments) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏪</div>
        <p>產生排班後可查看店家分配</p>
      </div>`;
    return;
  }

  const allStores = getStoreNames();

  const blocks = state.schedule.map((day, i) => {
    const isWeekend  = day.dayOfWeek === '六' || day.dayOfWeek === '日';
    const assignments = day.storeAssignments || { morning: {}, evening: {} };
    const mRouteInfo  = assignments.morningRouteInfo || {};
    const eRouteInfo  = assignments.eveningRouteInfo || {};

    function buildRows(assignMap, routeInfoMap, showEarlyStart) {
      const entries = Object.entries(assignMap);
      if (!entries.length) return '<tr><td colspan="3" class="store-no-staff">無排班人員</td></tr>';
      return entries.map(([name, stores]) => {
        const ri = routeInfoMap?.[name];
        const routeBadge = ri?.label ? `<span class="route-badge">${escHtml(ri.label)}</span>` : '';
        const earlyBadge = (showEarlyStart && ri?.earlyStart) ? `<span class="early-start-badge">18:00起</span>` : '';
        return `<tr>
          <td class="sa-person">${escHtml(name)}${ri ? `<div class="sa-route-info">${routeBadge}${earlyBadge}</div>` : ''}</td>
          <td class="sa-stores">${stores.map(s => `<span class="store-chip">${escHtml(s)}</span>`).join('')}</td>
          <td class="sa-count">${stores.length}家</td>
        </tr>`;
      }).join('');
    }

    const coveredMorn = new Set(Object.values(assignments.morning).flat());
    const coveredEve  = new Set(Object.values(assignments.evening).flat());
    const uncovMorn   = allStores.filter(s => !coveredMorn.has(s));
    const uncovEve    = allStores.filter(s => !coveredEve.has(s));

    return `
      <div class="store-day-block${isWeekend ? ' store-weekend' : ''}">
        <div class="store-day-header">
          <span class="dow${isWeekend ? ' dow-weekend' : ''}">${day.dayOfWeek}</span>
          <strong>${formatDateDisplay(day.date)}</strong>
          <span class="store-day-info">早 ${day.morning.length}人 / 晚 ${day.evening.staff.length}人</span>
        </div>

        <div class="store-shifts-grid">
          <div class="store-shift-col">
            <div class="store-col-title morning-title">早班（路線制，共 ${allStores.length} 家）</div>
            <table class="sa-table"><tbody>${buildRows(assignments.morning, mRouteInfo, false)}</tbody></table>
            ${uncovMorn.length ? `<div class="uncovered-warn">⚠ 未覆蓋 ${uncovMorn.length} 家：${uncovMorn.map(s => escHtml(s)).join('、')}</div>` : ''}
          </div>
          <div class="store-shift-col">
            <div class="store-col-title evening-title">晚班（路線制，共 ${allStores.length} 家）</div>
            <table class="sa-table"><tbody>${buildRows(assignments.evening, eRouteInfo, true)}</tbody></table>
            ${uncovEve.length ? `<div class="uncovered-warn">⚠ 未覆蓋 ${uncovEve.length} 家：${uncovEve.map(s => escHtml(s)).join('、')}</div>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = blocks;
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function getNextMonday() {
  const d = new Date();
  const diff = d.getDay() === 0 ? 1 : (8 - d.getDay());
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function formatDateDisplay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast toast-${type} show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}
