// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  staff: [],
  schedule: null,
  startDate: '',
  settings: {
    morningMin: 8,
    morningMax: 9,
    eveningCount: 9,
  },
  activeTab: 'schedule',
};

let addModalCtx = { dayIndex: null, shiftType: null };

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();

  // Default start date: next Monday
  const stored = state.startDate;
  const el = document.getElementById('start-date');
  el.value = stored || getNextMonday();
  if (stored) state.startDate = stored;

  // Settings inputs
  document.getElementById('setting-morning-min').value = state.settings.morningMin;
  document.getElementById('setting-morning-max').value = state.settings.morningMax;
  document.getElementById('setting-evening').value = state.settings.eveningCount;

  renderStaff();
  renderSchedule();
  renderStats();

  // Close modal when clicking backdrop
  document.getElementById('add-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAddModal();
  });

  // Enter key in single-name input adds staff
  document.getElementById('staff-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addStaff(); }
  });
});

// ── Staff Management ──────────────────────────────────────────────────────────
function addStaff() {
  const raw = document.getElementById('staff-input').value.trim();
  if (!raw) return;

  // Support pasting multiple names separated by newlines, commas, or Chinese commas
  const names = raw.split(/[\n,，、]+/).map(s => s.trim()).filter(Boolean);
  let added = 0;
  names.forEach(name => {
    if (!state.staff.includes(name)) {
      state.staff.push(name);
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
  samples.forEach(s => {
    if (!state.staff.includes(s)) state.staff.push(s);
  });
  persist();
  renderStaff();
  showToast('已載入 45 位範例人員');
}

// ── Schedule Generation ───────────────────────────────────────────────────────
function generateSchedule() {
  const dateVal = document.getElementById('start-date').value;
  if (!dateVal) { showToast('請選擇開始日期', 'error'); return; }

  // Read settings
  state.settings.morningMin = parseInt(document.getElementById('setting-morning-min').value) || 8;
  state.settings.morningMax = parseInt(document.getElementById('setting-morning-max').value) || 9;
  state.settings.eveningCount = parseInt(document.getElementById('setting-evening').value) || 9;
  state.startDate = dateVal;

  try {
    state.schedule = Scheduler.generate(state.staff, dateVal, state.settings);
    persist();
    renderSchedule();
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
  const available = state.staff.filter(s => !assignedToday.has(s));

  const shiftLabel = shiftType === 'morning' ? '早班' : '晚班';
  document.getElementById('modal-title').textContent =
    `新增人員 — ${formatDateDisplay(day.date)}（${day.dayOfWeek}）${shiftLabel}`;

  const listEl = document.getElementById('modal-staff-list');
  if (available.length === 0) {
    listEl.innerHTML = '<p class="modal-empty">今日所有人員均已排班</p>';
  } else {
    listEl.innerHTML = available.map(s =>
      `<button class="modal-staff-btn" onclick="addToShift('${escAttr(s)}')">${escHtml(s)}</button>`
    ).join('');
  }

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
      day.date,
      day.dayOfWeek,
      day.morning.length,
      day.morning.join('、'),
      day.evening.staff.length,
      day.evening.staff.join('、'),
      day.evening.endTime,
    ]);
  });

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `排班表_${state.startDate || 'export'}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSV 已下載');
}

function printSchedule() {
  window.print();
}

// ── Render: Staff List ────────────────────────────────────────────────────────
function renderStaff() {
  const listEl = document.getElementById('staff-list');
  const countEl = document.getElementById('staff-count');
  countEl.textContent = state.staff.length;

  if (state.staff.length === 0) {
    listEl.innerHTML = '<p class="sidebar-empty">尚未新增人員</p>';
    return;
  }

  listEl.innerHTML = state.staff.map((s, i) => `
    <div class="staff-row">
      <span class="staff-row-name">${escHtml(s)}</span>
      <button class="btn-remove-staff" onclick="removeStaff(${i})" title="移除">×</button>
    </div>
  `).join('');
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

    return `
      <tr class="${isWeekend ? 'row-weekend' : ''}">
        <td class="col-date">
          <span class="dow ${isWeekend ? 'dow-weekend' : ''}">${day.dayOfWeek}</span>
          <span class="date-str">${formatDateDisplay(day.date)}</span>
        </td>
        <td class="col-shift">
          <div class="shift-label shift-label-morning">
            早班 08:00–12:00
            <span class="shift-badge">${day.morning.length} 人</span>
          </div>
          <div class="tags-wrap">
            ${morningTags}
            <button class="btn-add-tag" onclick="openAddModal(${i},'morning')" title="新增人員">＋</button>
          </div>
        </td>
        <td class="col-shift">
          <div class="shift-label shift-label-evening">
            晚班 18:00–<button class="btn-endtime" onclick="toggleEndTime(${i})" title="點擊切換結束時間">${day.evening.endTime}</button>
            <span class="shift-badge">${day.evening.staff.length} 人</span>
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

  const stats = Scheduler.getStats(state.schedule, state.staff);
  const totals = state.staff.map(s => stats[s].total);
  const max = Math.max(...totals);
  const min = Math.min(...totals);
  const avg = (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1);

  // Sort by total desc
  const sorted = [...state.staff].sort((a, b) => stats[b].total - stats[a].total);

  const rows = sorted.map(s => {
    const { morning, evening, total } = stats[s];
    const isMax = total === max;
    const isMin = total === min;
    const bar = max > 0 ? Math.round((total / max) * 100) : 0;
    return `
      <tr class="${isMax ? 'stat-max' : isMin ? 'stat-min' : ''}">
        <td>${escHtml(s)}</td>
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
      <div class="stat-card">
        <span class="stat-label">平均班數</span>
        <span class="stat-value">${avg}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">最多班數</span>
        <span class="stat-value stat-value-max">${max}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">最少班數</span>
        <span class="stat-value stat-value-min">${min}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">總人數</span>
        <span class="stat-value">${state.staff.length}</span>
      </div>
    </div>
    <div class="table-wrap">
      <table class="stats-table">
        <thead>
          <tr>
            <th>姓名</th>
            <th class="center">早班</th>
            <th class="center">晚班</th>
            <th class="center">總計</th>
            <th>分佈</th>
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
      staff: state.staff,
      schedule: state.schedule,
      startDate: state.startDate,
      settings: state.settings,
    }));
  } catch (_) {}
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem('shopee-schedule-v1');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.staff)) state.staff = data.staff;
    if (data.schedule) state.schedule = data.schedule;
    if (data.startDate) state.startDate = data.startDate;
    if (data.settings) state.settings = { ...state.settings, ...data.settings };
  } catch (_) {}
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function getNextMonday() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? 1 : (8 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function formatDateDisplay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
