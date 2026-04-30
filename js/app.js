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

// ── Store Metadata (type & zone) ─────────────────────────────────────────────
const STORE_META = {
  // 第一區
  '民生':  { type: 'large',    zone: 1 },
  '民主':  { type: 'shipping', zone: 1 },
  '自由':  { type: 'small',    zone: 1 },
  '鐵道':  { type: 'shipping', zone: 1 },
  '經國':  { type: 'small',    zone: 1 },
  '巨城':  { type: 'large',    zone: 1 },
  '國華':  { type: 'small',    zone: 1 },
  '世界':  { type: 'shipping', zone: 1 },
  '大同':  { type: 'small',    zone: 1 },
  '林森':  { type: 'shipping', zone: 1 },
  '江山':  { type: 'small',    zone: 1 },
  // 第二區
  '南大二':{ type: 'large',    zone: 2 },
  '陽光':  { type: 'small',    zone: 2 },
  '雙園':  { type: 'small',    zone: 2 },
  '高翠':  { type: 'small',    zone: 2 },
  '寶山':  { type: 'small',    zone: 2 },
  '食品':  { type: 'large',    zone: 2 },
  '東山':  { type: 'small',    zone: 2 },
  '竹蓮':  { type: 'small',    zone: 2 },
  '博愛':  { type: 'small',    zone: 2 },
  '東光':  { type: 'large',    zone: 2 },
  '中華':  { type: 'large',    zone: 2 },
  '振興':  { type: 'shipping', zone: 2 },
  // 第三區（無寄件大店）
  '埔頂':  { type: 'small',    zone: 3 },
  '埔頂二':{ type: 'small',    zone: 3 },
  '關埔':  { type: 'large',    zone: 3 },
  '世傑':  { type: 'large',    zone: 3 },
  '慈雲':  { type: 'small',    zone: 3 },
};

function getStoreZone(name) {
  return state.storeMeta[name]?.zone || null;
}

function getZoneShippingStore(zone) {
  const entry = Object.entries(state.storeMeta).find(([, m]) => m.zone === zone && m.type === 'shipping');
  return entry ? entry[0] : null;
}

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  staff: [],
  schedule: null,
  startDate: '',
  storeSettings: {
    count: 28,
    customNames: DEFAULT_STORE_NAMES,
  },
  routes: {
    morning: MORNING_ROUTES.map(r => ({ ...r, stores: [...r.stores] })),
    evening: EVENING_ROUTES.map(r => ({ ...r, stores: [...r.stores] })),
  },
  storeMeta: Object.fromEntries(Object.entries(STORE_META).map(([k, v]) => [k, { ...v }])),
  activeTab: 'staff-list',
};

let addFormShiftType  = 'both';
let addFormGender     = null;
let editingIndex      = null;
let addModalCtx       = { dayIndex: null, shiftType: null };
let routeActiveShift  = 'morning';
let routeEditIdx      = null;

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
  renderStaffTab();
  renderSchedule();
  renderStoreAssignment();
  renderStoreCoverage();
  renderStaffCoverage();
  renderStats();

  document.getElementById('staff-tab-search')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); renderStaffTab(); }
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
  document.getElementById('store-meta-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeStoreMetaModal();
  });
  document.getElementById('routes-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeRoutesModal();
  });

  initSidebarResizer();
});

// ── Sidebar resize & mobile toggle ───────────────────────────────────────────
function initSidebarResizer() {
  const resizer = document.getElementById('sidebar-resizer');
  const sidebar = document.getElementById('sidebar');
  if (!resizer || !sidebar) return;

  const saved = localStorage.getItem('sidebar-width');
  if (saved) { sidebar.style.width = saved; sidebar.style.minWidth = saved; }

  let startX, startWidth;
  resizer.addEventListener('mousedown', e => {
    e.preventDefault();
    startX     = e.clientX;
    startWidth = sidebar.getBoundingClientRect().width;
    resizer.classList.add('dragging');
    document.body.style.cursor    = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = e => {
      const w = Math.min(480, Math.max(180, startWidth + e.clientX - startX));
      sidebar.style.width    = w + 'px';
      sidebar.style.minWidth = w + 'px';
    };
    const onUp = () => {
      resizer.classList.remove('dragging');
      document.body.style.cursor    = '';
      document.body.style.userSelect = '';
      localStorage.setItem('sidebar-width', sidebar.style.width);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const isOpen   = sidebar.classList.toggle('open');
  backdrop.classList.toggle('open', isOpen);
}

// ── Staff helpers ─────────────────────────────────────────────────────────────
function makeStaff(name, dayShifts, morningRoutePref, eveningRoutePref, gender, backup) {
  const normPref = p => Array.isArray(p) ? p.filter(Boolean) : (p ? [p] : []);
  return {
    name,
    dayShifts: { ...(dayShifts || {}) },
    morningRoutePref: normPref(morningRoutePref),
    eveningRoutePref: normPref(eveningRoutePref),
    gender: gender || null,
    backup: backup || false,
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
      routes.map(r => `<option value="${escAttr(r.label)}">${escHtml(r.label)}（${escHtml(r.stores.join('・'))}）</option>`).join('');
  };
  fill('add-morning-route', state.routes.morning);
  fill('add-evening-route', state.routes.evening);
}

function setShiftType(value) {
  addFormShiftType = value;
  document.querySelectorAll('#shift-type-group .st-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });
}

function setAddGender(value) {
  const current = document.querySelector('#add-gender-group .st-btn.active')?.dataset.value;
  addFormGender = current === value ? null : value;
  document.querySelectorAll('#add-gender-group .st-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === addFormGender);
  });
}

function setEditGender(value) {
  const current = document.querySelector('#edit-gender-group .st-btn.active')?.dataset.value;
  const next = current === value ? null : value;
  document.querySelectorAll('#edit-gender-group .st-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === next);
  });
}

// ── Staff Management ──────────────────────────────────────────────────────────
function addStaff() {
  const raw = document.getElementById('staff-input').value.trim();
  if (!raw) return;

  const morningRoute = document.getElementById('add-morning-route')?.value ? [document.getElementById('add-morning-route').value] : [];
  const eveningRoute = document.getElementById('add-evening-route')?.value ? [document.getElementById('add-evening-route').value] : [];
  const gender  = document.querySelector('#add-gender-group .st-btn.active')?.dataset.value || null;
  const backup  = document.getElementById('add-backup-toggle')?.checked || false;

  const names = raw.split(/[\n,，、]+/).map(s => s.trim()).filter(Boolean);
  let added = 0;
  names.forEach(name => {
    if (!state.staff.find(s => s.name === name)) {
      state.staff.push(makeStaff(name, makeUniformDayShifts(addFormShiftType), morningRoute || null, eveningRoute || null, gender, backup));
      added++;
    }
  });

  document.getElementById('staff-input').value = '';
  persist();
  renderStaff();
  renderStaffTab();
  if (added) showToast(`已新增 ${added} 位人員`);
}

function removeStaff(index) {
  state.staff.splice(index, 1);
  persist();
  renderStaff();
  renderStaffTab();
  renderSchedule();
  renderStats();
}

function clearAllStaff() {
  if (!confirm('確定要清除所有人員？')) return;
  state.staff = [];
  persist();
  renderStaff();
  renderStaffTab();
  renderSchedule();
  renderStats();
}

function importSampleStaff() {
  const samples = [
    { name: '莊薏玄',  dayShifts: {}, morningRoutePref: '路線二',   eveningRoutePref: null },
    { name: '黃子家',  dayShifts: {}, morningRoutePref: '路線一',   eveningRoutePref: null },
    { name: '莊璦如',  dayShifts: {}, morningRoutePref: '路線四',   eveningRoutePref: null },
    { name: '楊建宇',  dayShifts: {}, morningRoutePref: '路線二',   eveningRoutePref: null },
    { name: '楊凱晴',  dayShifts: {}, morningRoutePref: '路線二',   eveningRoutePref: null },
    { name: '徐翎臻',  dayShifts: {}, morningRoutePref: '路線六',   eveningRoutePref: null },
    { name: '楊雅妏',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '角浩之',  dayShifts: {}, morningRoutePref: '路線五',   eveningRoutePref: null },
    { name: '劉冠霆',  dayShifts: {}, morningRoutePref: '路線七',   eveningRoutePref: null },
    { name: '阿寧',    dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '你行你上',dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '@',       dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '雅典娜',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '翁劭瑜',  dayShifts: {}, morningRoutePref: '路線十',   eveningRoutePref: null },
    { name: '許星羽',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '葉峻州',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '李瑜庭',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '翁仕佑',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '楊敬誠',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: '路線一' },
    { name: '王鼎鈞',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '鍾秀芬',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '陳采妮',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: '路線六' },
    { name: '黃興志',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '陳信儒',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: '路線七' },
    { name: '翁郁琇',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '戴運維',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '李詠順',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: '路線六' },
    { name: '陳映璇',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '呂芸葳',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: '路線九' },
    { name: '洪子軒',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '詹舜元',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '吳明坤',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '雷司',    dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '西瓜',    dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '楊宸祐',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '蕭先育',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: '路線十二' },
    { name: '吳秉叡',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '楊韻如',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '謝燕宣',  dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null },
    { name: '店長',    dayShifts: {}, morningRoutePref: null,       eveningRoutePref: null, backup: true },
  ];
  let added = 0;
  samples.forEach(s => {
    if (!state.staff.find(st => st.name === s.name)) {
      state.staff.push(makeStaff(s.name, s.dayShifts, s.morningRoutePref, s.eveningRoutePref, s.gender || null, s.backup || false));
      added++;
    }
  });
  persist();
  renderStaff();
  renderStaffTab();
  if (added) showToast(`已載入 ${added} 位人員`);
}

// ── Edit Staff Modal ──────────────────────────────────────────────────────────
function editStaff(index) {
  editingIndex = index;
  const s = state.staff[index];

  document.getElementById('edit-name-input').value = s.name;
  document.querySelectorAll('#edit-gender-group .st-btn').forEach(btn => {
    btn.classList.toggle('active', !!s.gender && btn.dataset.value === s.gender);
  });
  document.getElementById('edit-backup-toggle').checked = !!s.backup;
  renderDateGrid(s.dayShifts || {});
  renderRoutePrefButtons('morning', s.morningRoutePref || []);
  renderRoutePrefButtons('evening', s.eveningRoutePref || []);

  document.getElementById('edit-staff-modal').classList.add('active');
}

function renderRoutePrefButtons(type, currentPrefs) {
  const routes = type === 'morning' ? state.routes.morning : state.routes.evening;
  const el = document.getElementById(`${type}-route-pref`);
  if (!el) return;
  const prefs = Array.isArray(currentPrefs) ? currentPrefs.filter(Boolean) : (currentPrefs ? [currentPrefs] : []);
  el.innerHTML = routes.map(r => {
    const rank = prefs.indexOf(r.label);
    const isActive = rank >= 0;
    const rankBadge = isActive ? `<span class="rpb-rank">${rank + 1}</span>` : '';
    const sub = `<span class="rpb-stores">${escHtml(r.stores.join('・'))}</span>`;
    return `<button class="route-pref-btn${isActive ? ' active' : ''}" data-value="${escAttr(r.label)}" data-rank="${rank}"
      onclick="setRoutePref('${type}', this.dataset.value)">${escHtml(r.label)}${rankBadge}${sub}</button>`;
  }).join('');
}

function setRoutePref(type, value) {
  const el = document.getElementById(`${type}-route-pref`);
  if (!el) return;
  const currentPrefs = [];
  el.querySelectorAll('.route-pref-btn').forEach(btn => {
    const rank = parseInt(btn.dataset.rank);
    if (rank >= 0) currentPrefs[rank] = btn.dataset.value;
  });
  const idx = currentPrefs.indexOf(value);
  let newPrefs;
  if (idx >= 0) {
    newPrefs = currentPrefs.filter(v => v !== value);
  } else if (currentPrefs.filter(Boolean).length < 2) {
    newPrefs = [...currentPrefs.filter(Boolean), value];
  } else {
    showToast('最多選 2 個志願', 'warning');
    return;
  }
  renderRoutePrefButtons(type, newPrefs);
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

  const getOrderedPrefs = id => {
    const result = [];
    document.querySelectorAll(`#${id} .route-pref-btn`).forEach(btn => {
      const rank = parseInt(btn.dataset.rank);
      if (rank >= 0) result[rank] = btn.dataset.value;
    });
    return result.filter(Boolean);
  };
  const morningPref = getOrderedPrefs('morning-route-pref');
  const eveningPref = getOrderedPrefs('evening-route-pref');
  const gender      = document.querySelector('#edit-gender-group .st-btn.active')?.dataset.value || null;
  const backup      = document.getElementById('edit-backup-toggle')?.checked || false;

  state.staff[editingIndex] = makeStaff(name, dayShifts, morningPref, eveningPref, gender, backup);
  editingIndex = null;
  closeEditStaffModal();
  persist();
  renderStaff();
  renderStaffTab();
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
      morningRoutes: state.routes.morning,
      eveningRoutes: state.routes.evening,
    });
    persist();
    renderSchedule();
    renderStoreAssignment();
    renderStoreCoverage();
    renderStaffCoverage();
    renderStats();
    switchTab('staff-list');
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
  renderStoreCoverage();
  renderStaffCoverage();
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
    const mp = Array.isArray(s.morningRoutePref) ? s.morningRoutePref : (s.morningRoutePref ? [s.morningRoutePref] : []);
    const ep = Array.isArray(s.eveningRoutePref) ? s.eveningRoutePref : (s.eveningRoutePref ? [s.eveningRoutePref] : []);
    if (mp.length) prefParts.push(`早:${mp.join('>')}`);
    if (ep.length) prefParts.push(`晚:${ep.join('>')}`);
    const prefText = prefParts.join('・');
    return `
    <div class="staff-row">
      <div class="staff-row-main">
        ${s.gender ? `<span class="gender-tag gender-${escAttr(s.gender)}">${escHtml(s.gender)}</span>` : ''}
        <span class="staff-row-name">${escHtml(s.name)}</span>
        ${s.backup ? `<span class="backup-tag">備用</span>` : ''}
        <button class="btn-edit-staff" onclick="editStaff(${i})" title="編輯">✎</button>
        <button class="btn-remove-staff" onclick="removeStaff(${i})" title="移除">×</button>
      </div>
      <span class="staff-days-text">${daysAvailableText(s.dayShifts)}</span>
      ${prefText ? `<span class="staff-pref-text">偏好 ${escHtml(prefText)}</span>` : ''}
    </div>`;
  }).join('');
}

// ── Render: Staff Tab ─────────────────────────────────────────────────────────
function renderStaffTab() {
  const gridEl  = document.getElementById('stab-grid');
  const countEl = document.getElementById('stab-count');
  if (!gridEl) return;

  const q = document.getElementById('staff-tab-search')?.value.trim().toLowerCase() ?? '';
  const filtered = q ? state.staff.filter(s => s.name.toLowerCase().includes(q)) : state.staff;

  if (countEl) countEl.textContent = `${filtered.length} / ${state.staff.length} 人`;

  if (state.staff.length === 0) {
    gridEl.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p>尚未新增人員</p></div>';
    return;
  }

  const cards = filtered.map(s => {
    const realIdx = state.staff.indexOf(s);
    const mp = Array.isArray(s.morningRoutePref) ? s.morningRoutePref : (s.morningRoutePref ? [s.morningRoutePref] : []);
    const ep = Array.isArray(s.eveningRoutePref) ? s.eveningRoutePref : (s.eveningRoutePref ? [s.eveningRoutePref] : []);
    const prefParts = [];
    if (mp.length) prefParts.push(`早班偏好：${mp.join(' > ')}`);
    if (ep.length) prefParts.push(`晚班偏好：${ep.join(' > ')}`);
    return `
      <div class="stab-card">
        <div class="stab-card-header">
          ${s.gender ? `<span class="gender-tag gender-${escAttr(s.gender)}">${escHtml(s.gender)}</span>` : ''}
          <span class="stab-name">${escHtml(s.name)}</span>
          ${s.backup ? `<span class="backup-tag">備用</span>` : ''}
          <div class="stab-actions">
            <button class="btn-edit-staff" onclick="editStaff(${realIdx})" title="編輯">✎</button>
            <button class="btn-remove-staff" onclick="removeStaff(${realIdx})" title="移除">×</button>
          </div>
        </div>
        <div class="stab-meta">
          <span class="staff-days-text">${daysAvailableText(s.dayShifts)}</span>
          ${prefParts.map(p => `<span class="staff-pref-text">${escHtml(p)}</span>`).join('')}
        </div>
      </div>`;
  }).join('');

  gridEl.innerHTML = filtered.length
    ? `<div class="stab-grid">${cards}</div>`
    : '<p class="sidebar-empty" style="padding:16px">無符合人員</p>';
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
      routes: state.routes,
      storeMeta: state.storeMeta,
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
        const normPref = p => Array.isArray(p) ? p.filter(Boolean) : (p ? [p] : []);
        return { ...s, morningRoutePref: normPref(s.morningRoutePref), eveningRoutePref: normPref(s.eveningRoutePref) };
      });
    }
    if (data.schedule)  state.schedule  = data.schedule;
    if (data.startDate) state.startDate = data.startDate;
    if (data.routes) {
      state.routes = data.routes;
      if (!Array.isArray(state.routes.morning)) state.routes.morning = MORNING_ROUTES.map(r => ({ ...r, stores: [...r.stores] }));
      if (!Array.isArray(state.routes.evening)) state.routes.evening = EVENING_ROUTES.map(r => ({ ...r, stores: [...r.stores] }));
    }
    if (data.storeMeta && typeof data.storeMeta === 'object') {
      state.storeMeta = { ...state.storeMeta, ...data.storeMeta };
    }
    if (data.storeSettings) {
      state.storeSettings = { ...state.storeSettings, ...data.storeSettings };
      if (!state.storeSettings.customNames || state.storeSettings.customNames.length === 0) {
        state.storeSettings.customNames = DEFAULT_STORE_NAMES;
      } else {
        state.storeSettings.customNames = state.storeSettings.customNames.map(n =>
          n.replace(/\s*[(（][^)）]*[)）]/g, '').replace('寶山雙園', '雙園').trim()
        );
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
        const storesHtml = stores.map(s => `<span class="store-chip">${escHtml(s)}</span>`).join('');
        return `<tr>
          <td class="sa-person">${escHtml(name)}${ri ? `<div class="sa-route-info">${routeBadge}${earlyBadge}</div>` : ''}</td>
          <td class="sa-stores">${storesHtml}</td>
          <td class="sa-count">${stores.length}家</td>
        </tr>`;
      }).join('');
    }

    const morningUnassigned = assignments.morningUnassigned || [];
    const eveningUnassigned = assignments.eveningUnassigned || [];

    function buildUnassignedRows(unassigned) {
      return unassigned.map(rt => `
        <tr class="sa-unassigned-row">
          <td class="sa-person">
            <span class="unassigned-badge">缺人</span>
            <div class="sa-route-info"><span class="route-badge">${escHtml(rt.label)}</span></div>
          </td>
          <td class="sa-stores">${rt.stores.map(s => `<span class="store-chip store-chip-missing">${escHtml(s)}</span>`).join('')}</td>
          <td class="sa-count">${rt.stores.length}家</td>
        </tr>`).join('');
    }

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
            <table class="sa-table"><tbody>${buildRows(assignments.morning, mRouteInfo, false)}${buildUnassignedRows(morningUnassigned)}</tbody></table>
          </div>
          <div class="store-shift-col">
            <div class="store-col-title evening-title">晚班（路線制，共 ${allStores.length} 家）</div>
            <table class="sa-table"><tbody>${buildRows(assignments.evening, eRouteInfo, true)}${buildUnassignedRows(eveningUnassigned)}</tbody></table>
          </div>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = blocks;
}

// ── Render: Store Coverage Tab ────────────────────────────────────────────────
function renderStoreCoverage() {
  const container = document.getElementById('tab-coverage');
  if (!container) return;

  if (!state.schedule || !state.schedule[0]?.storeAssignments) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🗺️</div>
        <p>產生排班後可查看店家一覽</p>
      </div>`;
    return;
  }

  const allStores = getStoreNames();
  const days = state.schedule;

  // Invert assignments: store → dayIndex → { morning, evening }
  const coverageMap = {};
  allStores.forEach(s => { coverageMap[s] = {}; });

  days.forEach((day, di) => {
    const sa = day.storeAssignments || {};
    Object.entries(sa.morning || {}).forEach(([person, stores]) => {
      stores.forEach(s => {
        if (!coverageMap[s]) coverageMap[s] = {};
        if (!coverageMap[s][di]) coverageMap[s][di] = { morning: null, evening: null };
        coverageMap[s][di].morning = person;
      });
    });
    Object.entries(sa.evening || {}).forEach(([person, stores]) => {
      stores.forEach(s => {
        if (!coverageMap[s]) coverageMap[s] = {};
        if (!coverageMap[s][di]) coverageMap[s][di] = { morning: null, evening: null };
        coverageMap[s][di].evening = person;
      });
    });
  });

  // Group stores by zone
  const storesByZone = { 1: [], 2: [], 3: [] };
  allStores.forEach(s => {
    const z = state.storeMeta[s]?.zone;
    if (z && storesByZone[z]) storesByZone[z].push(s);
  });

  const zoneLabels = { 1: '第一區', 2: '第二區', 3: '第三區' };

  const dateHeaders = days.map(day => {
    const isWeekend = day.dayOfWeek === '六' || day.dayOfWeek === '日';
    return `<th class="cov-date-th${isWeekend ? ' cov-weekend' : ''}">${formatDateDisplay(day.date)}<br><span class="cov-dow">${day.dayOfWeek}</span></th>`;
  }).join('');

  let tableBody = '';
  [1, 2, 3].forEach(z => {
    const stores = storesByZone[z];
    if (!stores.length) return;

    tableBody += `<tr class="cov-zone-row"><td colspan="${days.length + 1}" class="cov-zone-header">${zoneLabels[z]}</td></tr>`;

    stores.forEach(s => {
      const meta = state.storeMeta[s];
      const typeLabel = meta?.type === 'large' ? '大' : meta?.type === 'shipping' ? '寄件' : '小';
      const typeCls   = meta?.type === 'large' ? 'cov-type-large' : meta?.type === 'shipping' ? 'cov-type-shipping' : 'cov-type-small';

      const cells = days.map((day, di) => {
        const entry = coverageMap[s]?.[di] || {};
        const m = entry.morning || null;
        const e = entry.evening || null;
        const isEmpty = !m && !e;
        const mHtml = m ? `<span class="cov-person cov-person-m">${escHtml(m)}</span>` : '';
        const eHtml = e ? `<span class="cov-person cov-person-e">${escHtml(e)}</span>` : '';
        return `<td class="cov-cell${isEmpty ? ' cov-empty' : ''}">${mHtml}${eHtml}</td>`;
      }).join('');

      tableBody += `<tr class="cov-store-row">
        <td class="cov-store-col"><span class="cov-type-badge ${typeCls}">${typeLabel}</span>${escHtml(s)}</td>
        ${cells}
      </tr>`;
    });
  });

  container.innerHTML = `
    <div class="cov-wrap">
      <div class="cov-legend">
        <span class="cov-person cov-person-m">早班</span>
        <span class="cov-person cov-person-e">晚班</span>
        <span class="cov-empty-legend">空格 = 無人</span>
      </div>
      <div class="table-wrap">
        <table class="cov-table">
          <thead><tr>
            <th class="cov-store-th">店家</th>
            ${dateHeaders}
          </tr></thead>
          <tbody>${tableBody}</tbody>
        </table>
      </div>
    </div>`;
}

// ── Render: Staff Coverage Tab ────────────────────────────────────────────────
function renderStaffCoverage() {
  const container = document.getElementById('tab-staff-cov');
  if (!container) return;

  if (!state.schedule || !state.schedule[0]?.storeAssignments) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👤</div>
        <p>產生排班後可查看人員一覽</p>
      </div>`;
    return;
  }

  const days = state.schedule;

  // Build: name → dayIdx → { mSched, mStores[], eSched, eStores[] }
  const staffMap = {};
  const allNames = new Set(state.staff.map(s => s.name));

  days.forEach((day, di) => {
    const sa   = day.storeAssignments || {};
    const mMap = sa.morning || {};
    const eMap = sa.evening || {};

    day.morning.forEach(name => {
      allNames.add(name);
      if (!staffMap[name]) staffMap[name] = {};
      staffMap[name][di] = staffMap[name][di] || {};
      staffMap[name][di].mSched  = true;
      staffMap[name][di].mStores = mMap[name] || [];
    });
    day.evening.staff.forEach(name => {
      allNames.add(name);
      if (!staffMap[name]) staffMap[name] = {};
      staffMap[name][di] = staffMap[name][di] || {};
      staffMap[name][di].eSched  = true;
      staffMap[name][di].eStores = eMap[name] || [];
    });
  });

  const dateHeaders = days.map(day => {
    const isWeekend = day.dayOfWeek === '六' || day.dayOfWeek === '日';
    return `<th class="scov-date-th${isWeekend ? ' scov-weekend' : ''}">${formatDateDisplay(day.date)}<br><span class="scov-dow">${day.dayOfWeek}</span></th>`;
  }).join('');

  const orderedNames = [
    ...state.staff.map(s => s.name),
    ...[...allNames].filter(n => !state.staff.find(s => s.name === n)),
  ];

  const buildTable = (shift) => {
    const isMorning = shift === 'morning';
    const schedKey  = isMorning ? 'mSched'  : 'eSched';
    const storeKey  = isMorning ? 'mStores' : 'eStores';
    const cellCls   = isMorning ? 'scov-shift-m' : 'scov-shift-e';
    const noLabel   = isMorning ? '早班' : '晚班';

    // Only show staff who have at least one scheduled day in this shift
    const names = orderedNames.filter(name =>
      Object.values(staffMap[name] || {}).some(d => d[schedKey])
    );

    if (!names.length) return '<p style="color:var(--text-muted);font-size:13px;padding:4px 0">本班無排班人員</p>';

    const rows = names.map(name => {
      const dayData = staffMap[name] || {};
      const cells = days.map((day, di) => {
        const d = dayData[di];
        if (!d?.[schedKey]) return `<td class="scov-cell scov-off"></td>`;
        const stores = d[storeKey];
        const content = stores.length
          ? `<div class="scov-shift ${cellCls}">${escHtml(stores.join('・'))}</div>`
          : `<div class="scov-shift ${cellCls} scov-nostore">${noLabel}</div>`;
        return `<td class="scov-cell">${content}</td>`;
      }).join('');
      return `<tr><td class="scov-name-col">${escHtml(name)}</td>${cells}</tr>`;
    }).join('');

    return `
      <div class="table-wrap" style="margin-bottom:24px">
        <table class="scov-table">
          <thead><tr>
            <th class="scov-name-th">人員</th>
            ${dateHeaders}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  };

  container.innerHTML = `
    <div class="scov-wrap">
      <div class="scov-export-bar">
        <button class="btn btn-secondary btn-sm" onclick="exportCoverageImage('scov-morning','早班人員班表')">⬇ 早班匯出圖片</button>
        <button class="btn btn-secondary btn-sm" onclick="exportCoverageImage('scov-evening','晚班人員班表')">⬇ 晚班匯出圖片</button>
      </div>
      <div id="scov-morning">
        <div class="scov-section-title scov-title-m">早班人員一覽</div>
        ${buildTable('morning')}
      </div>
      <div id="scov-evening">
        <div class="scov-section-title scov-title-e">晚班人員一覽</div>
        ${buildTable('evening')}
      </div>
    </div>`;
}

// ── Export Coverage Image ─────────────────────────────────────────────────────
async function exportCoverageImage(sectionId, filename) {
  const el = document.getElementById(sectionId);
  if (!el || typeof html2canvas === 'undefined') {
    showToast('無法匯出，請稍後再試', 'error'); return;
  }
  showToast('產生圖片中…');
  try {
    // Temporarily remove sticky so html2canvas captures correctly
    el.querySelectorAll('.scov-name-th, .scov-name-col').forEach(e => {
      e.dataset._pos = e.style.position;
      e.style.position = 'relative';
    });
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    el.querySelectorAll('.scov-name-th, .scov-name-col').forEach(e => {
      e.style.position = e.dataset._pos || '';
    });
    const link = document.createElement('a');
    link.download = filename + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('圖片已下載');
  } catch (err) {
    showToast('匯出失敗', 'error');
  }
}

// ── Store Meta Modal ──────────────────────────────────────────────────────────
function openStoreMetaModal() {
  renderStoreMetaTable();
  document.getElementById('store-meta-modal').classList.add('active');
}

function closeStoreMetaModal() {
  document.getElementById('store-meta-modal').classList.remove('active');
}

function renderStoreMetaTable() {
  const stores = getStoreNames();
  const zoneOpts = [1, 2, 3];
  const typeOpts = [
    { value: 'large',    label: '大店' },
    { value: 'small',    label: '小店' },
    { value: 'shipping', label: '寄件' },
  ];

  const rows = stores.map(s => {
    const meta = state.storeMeta[s] || {};
    const zoneBtns = zoneOpts.map(z =>
      `<button class="smeta-btn${meta.zone === z ? ' active' : ''}"
        onclick="toggleStoreMeta('${escAttr(s)}','zone',${z})">${z}區</button>`
    ).join('');
    const typeBtns = typeOpts.map(t =>
      `<button class="smeta-btn${meta.type === t.value ? ' active' : ''}"
        onclick="toggleStoreMeta('${escAttr(s)}','type','${t.value}')">${t.label}</button>`
    ).join('');
    return `<tr>
      <td class="smeta-name">${escHtml(s)}</td>
      <td><div class="smeta-btn-group">${zoneBtns}</div></td>
      <td><div class="smeta-btn-group">${typeBtns}</div></td>
    </tr>`;
  }).join('');

  document.getElementById('store-meta-wrap').innerHTML = `
    <table class="smeta-table">
      <thead><tr>
        <th class="smeta-th-name">店家</th>
        <th class="smeta-th">區域</th>
        <th class="smeta-th">類型</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function toggleStoreMeta(storeName, field, value) {
  if (!state.storeMeta[storeName]) state.storeMeta[storeName] = {};
  const current = state.storeMeta[storeName][field];
  state.storeMeta[storeName][field] = current === value ? undefined : value;
  persist();
  renderStoreMetaTable();
  if (state.schedule) {
    renderStoreCoverage();
  }
}

function resetStoreMeta() {
  if (!confirm('確定重設為預設區域設定？')) return;
  state.storeMeta = Object.fromEntries(Object.entries(STORE_META).map(([k, v]) => [k, { ...v }]));
  persist();
  renderStoreMetaTable();
  if (state.schedule) renderStoreCoverage();
  showToast('已重設為預設區域設定');
}

// ── Route Management Modal ────────────────────────────────────────────────────
function openRoutesModal(shift = 'morning') {
  routeActiveShift = shift;
  routeEditIdx = null;
  document.querySelectorAll('.route-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.shift === shift);
  });
  renderRoutesInModal();
  document.getElementById('routes-modal').classList.add('active');
}

function closeRoutesModal() {
  document.getElementById('routes-modal').classList.remove('active');
  routeEditIdx = null;
}

function switchRouteTab(shift) {
  routeActiveShift = shift;
  routeEditIdx = null;
  document.querySelectorAll('.route-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.shift === shift);
  });
  renderRoutesInModal();
}

function renderRoutesInModal() {
  const routes = state.routes[routeActiveShift];
  const el = document.getElementById('routes-list');
  if (!el) return;

  let html = '';
  routes.forEach((r, i) => {
    if (routeEditIdx === i) {
      html += buildRouteEditorHtml(r.label, r.stores, i);
    } else {
      html += `
        <div class="route-item">
          <div class="route-item-main">
            <span class="route-item-label">${escHtml(r.label)}</span>
            <span class="route-item-stores">${escHtml(r.stores.join('・'))}</span>
          </div>
          <div class="route-item-actions">
            <button class="link-btn" onclick="startEditRoute(${i})">編輯</button>
            <button class="link-btn danger" onclick="deleteRoute(${i})">刪除</button>
          </div>
        </div>`;
    }
  });

  if (routeEditIdx === -1) {
    html += buildRouteEditorHtml('', [], -1);
  }

  el.innerHTML = html || '<p style="color:var(--text-muted);padding:8px 0;font-size:13px">尚無路線</p>';
}

function buildRouteEditorHtml(label, selectedStores, idx) {
  const allStores = getStoreNames();
  const selectedSet = new Set(selectedStores);
  const checkboxes = allStores.map(s =>
    `<label class="store-check-label">
      <input type="checkbox" value="${escAttr(s)}"${selectedSet.has(s) ? ' checked' : ''}> ${escHtml(s)}
    </label>`
  ).join('');
  return `
    <div class="route-editor">
      <div class="route-editor-row">
        <label class="form-label" style="margin-bottom:4px">路線名稱</label>
        <input type="text" id="route-edit-label" class="edit-text-input" value="${escAttr(label)}"
          placeholder="例：路線一" autocomplete="off">
      </div>
      <div class="route-editor-row">
        <label class="form-label" style="margin-bottom:4px">包含店家</label>
        <div class="store-check-grid" id="route-edit-stores">${checkboxes}</div>
      </div>
      <div class="route-editor-footer">
        <button class="btn btn-secondary" onclick="cancelRouteEdit()">取消</button>
        <button class="btn btn-primary" style="width:auto;padding:7px 16px" onclick="saveRouteEdit(${idx})">儲存</button>
      </div>
    </div>`;
}

function startEditRoute(idx) {
  routeEditIdx = idx;
  renderRoutesInModal();
  setTimeout(() => {
    document.querySelector('.route-editor')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);
}

function cancelRouteEdit() {
  routeEditIdx = null;
  renderRoutesInModal();
}

function saveRouteEdit(idx) {
  const label = document.getElementById('route-edit-label')?.value.trim();
  if (!label) { showToast('請輸入路線名稱', 'error'); return; }
  const stores = [];
  document.querySelectorAll('#route-edit-stores input[type=checkbox]:checked').forEach(cb => {
    stores.push(cb.value);
  });
  if (!stores.length) { showToast('請至少選擇一家店', 'error'); return; }

  const routes = state.routes[routeActiveShift];
  if (idx === -1) {
    routes.push({ label, stores });
  } else {
    routes[idx] = { label, stores };
  }
  routeEditIdx = null;
  persist();
  populateRouteSelects();
  renderRoutesInModal();
  showToast('路線已儲存');
}

function deleteRoute(idx) {
  const routes = state.routes[routeActiveShift];
  if (!confirm(`確定刪除「${routes[idx].label}」？`)) return;
  routes.splice(idx, 1);
  if (routeEditIdx === idx) routeEditIdx = null;
  persist();
  populateRouteSelects();
  renderRoutesInModal();
  showToast('路線已刪除');
}

function resetDefaultRoutes() {
  if (!confirm('確定重設為預設路線？自訂路線將被清除。')) return;
  state.routes = {
    morning: MORNING_ROUTES.map(r => ({ ...r, stores: [...r.stores] })),
    evening: EVENING_ROUTES.map(r => ({ ...r, stores: [...r.stores] })),
  };
  routeEditIdx = null;
  persist();
  populateRouteSelects();
  renderRoutesInModal();
  showToast('已重設為預設路線');
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
