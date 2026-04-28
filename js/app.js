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

let addFormShiftType = 'both';
let addFormGender    = null;
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
  fill('add-morning-route', MORNING_ROUTES);
  fill('add-evening-route', EVENING_ROUTES);
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
    { name: '莊薏玄',  dayShifts: {0:'both',1:'morning',2:'both',3:'morning',4:'both',5:'morning',6:'both',7:'both',8:'both',9:'both',10:'both',11:'both',12:'morning',13:'both'}, morningRoutePref: '路線二',  eveningRoutePref: null },
    { name: '黃子家',  dayShifts: {0:'morning',1:'morning',2:'morning',3:'morning',4:'morning',5:'morning',6:'morning',7:'morning',8:'morning',9:'morning',10:'morning',11:'morning',12:'morning',13:'morning'}, morningRoutePref: '路線一',  eveningRoutePref: null },
    { name: '莊璦如',  dayShifts: {1:'morning',3:'morning',4:'morning',5:'morning',6:'morning',8:'morning',9:'morning',10:'morning',11:'morning',12:'morning',13:'morning'}, morningRoutePref: '路線四',  eveningRoutePref: null },
    { name: '楊建宇',  dayShifts: {0:'morning',1:'morning',2:'morning',3:'morning',4:'morning',5:'morning',6:'morning',7:'morning',8:'morning',9:'morning',10:'morning',11:'morning',12:'morning',13:'morning'}, morningRoutePref: '路線二',  eveningRoutePref: null },
    { name: '楊凱晴',  dayShifts: {0:'morning',1:'morning',2:'morning',3:'morning',4:'morning',5:'morning',6:'morning',7:'morning',8:'morning',9:'morning',10:'morning',11:'morning',12:'morning',13:'morning'}, morningRoutePref: '路線二',  eveningRoutePref: null },
    { name: '徐翎臻',  dayShifts: {0:'morning',3:'morning',4:'morning',7:'morning'}, morningRoutePref: '路線六',  eveningRoutePref: null },
    { name: '楊雅妏',  dayShifts: {0:'morning',1:'morning',2:'morning',4:'morning',7:'morning',8:'morning',9:'morning',10:'morning'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '角浩之',  dayShifts: {0:'morning',2:'morning',3:'morning',4:'morning',5:'morning',6:'morning',7:'morning',8:'morning',10:'morning',11:'morning',12:'morning'}, morningRoutePref: '路線五',  eveningRoutePref: null },
    { name: '劉冠霆',  dayShifts: {0:'morning',3:'morning',4:'morning',6:'morning',7:'morning',10:'morning',11:'morning',13:'morning'}, morningRoutePref: '路線七',  eveningRoutePref: null },
    { name: '阿寧',    dayShifts: {1:'both',2:'both',3:'both',4:'both',7:'both',8:'both',9:'both',10:'both',11:'both',12:'both',13:'both'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '你行你上',dayShifts: {0:'morning',1:'morning',2:'morning',3:'morning',4:'morning',5:'morning',6:'morning',7:'morning',8:'morning',9:'morning',10:'morning',11:'morning',12:'morning',13:'morning'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '@',       dayShifts: {4:'evening',5:'both',6:'evening'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '雅典娜',  dayShifts: {1:'evening',3:'evening',4:'evening',6:'evening',7:'evening',8:'evening',9:'evening',10:'evening',11:'evening',12:'evening',13:'evening'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '翁劭瑜',  dayShifts: {4:'morning',10:'morning'}, morningRoutePref: '路線十',  eveningRoutePref: null },
    { name: '許星羽',  dayShifts: {0:'morning',1:'morning',2:'morning',3:'morning',4:'morning',5:'morning',6:'morning',7:'morning',8:'morning',9:'morning',10:'morning',11:'morning',12:'morning',13:'morning'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '葉峻州',  dayShifts: {0:'morning',1:'morning',2:'morning',3:'morning',4:'morning',5:'morning',6:'morning',7:'morning',8:'morning',9:'morning',10:'morning',11:'morning',12:'morning',13:'morning'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '李瑜庭',  dayShifts: {}, morningRoutePref: null, eveningRoutePref: null },
    { name: '翁仕佑',  dayShifts: {1:'evening',3:'evening',4:'evening',8:'evening',10:'evening'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '楊敬誠',  dayShifts: {0:'evening',1:'evening',2:'evening',3:'evening',4:'evening',5:'evening',6:'evening',7:'evening',8:'evening',9:'evening',10:'evening',11:'evening',12:'evening',13:'evening'}, morningRoutePref: null, eveningRoutePref: '路線一' },
    { name: '王鼎鈞',  dayShifts: {2:'evening',5:'both',6:'both',7:'evening',8:'both',9:'morning',11:'evening',12:'morning',13:'morning'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '鍾秀芬',  dayShifts: {0:'evening',1:'evening',2:'evening',3:'evening',4:'evening',5:'evening',6:'evening',7:'evening',8:'evening',9:'evening',10:'evening',11:'evening',12:'evening',13:'evening'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '陳采妮',  dayShifts: {6:'evening',13:'evening'}, morningRoutePref: null, eveningRoutePref: '路線六' },
    { name: '黃興志',  dayShifts: {0:'evening',1:'evening',2:'evening',3:'evening',4:'evening',5:'evening',6:'evening',7:'evening',8:'evening',9:'evening',10:'evening',11:'evening',12:'evening',13:'evening'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '陳信儒',  dayShifts: {0:'evening',1:'evening',2:'evening',3:'evening',4:'evening',5:'evening',6:'evening',7:'evening',8:'evening',9:'evening',10:'evening',11:'evening',12:'evening',13:'evening'}, morningRoutePref: null, eveningRoutePref: '路線七' },
    { name: '翁郁琇',  dayShifts: {0:'evening',1:'evening',2:'evening',3:'evening',4:'evening',5:'evening',6:'evening',7:'evening',8:'evening',9:'evening',10:'evening',11:'evening',12:'evening',13:'evening'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '戴運維',  dayShifts: {1:'evening',8:'evening'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '李詠順',  dayShifts: {0:'evening',1:'evening',2:'evening',3:'evening',4:'evening',5:'evening',6:'evening',7:'evening',8:'evening',9:'evening',10:'evening',11:'evening',12:'evening',13:'evening'}, morningRoutePref: null, eveningRoutePref: '路線六' },
    { name: '陳映璇',  dayShifts: {0:'evening',1:'evening',2:'evening',3:'evening',4:'evening',5:'evening',6:'evening',7:'evening',8:'evening',9:'evening',10:'evening',11:'evening',12:'evening',13:'evening'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '呂芸葳',  dayShifts: {9:'evening',10:'evening'}, morningRoutePref: null, eveningRoutePref: '路線九' },
    { name: '洪子軒',  dayShifts: {1:'evening',3:'evening',7:'evening',9:'evening'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '詹舜元',  dayShifts: {0:'evening',1:'evening',2:'evening',3:'evening',4:'evening',5:'evening',6:'evening',7:'evening',8:'evening',9:'evening',10:'evening',11:'evening',12:'evening',13:'evening'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '吳明坤',  dayShifts: {0:'evening',2:'evening',4:'evening',5:'evening',7:'evening',9:'evening',11:'evening',12:'evening',13:'evening'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '雷司',    dayShifts: {0:'evening',3:'evening',4:'evening',5:'evening',8:'evening',9:'evening',10:'evening',11:'evening',12:'evening'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '西瓜',    dayShifts: {0:'both',1:'both',2:'both',3:'both',4:'both',5:'both',6:'both',7:'both',8:'both',9:'both',10:'both',11:'both',12:'both',13:'both'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '楊宸祐',  dayShifts: {0:'evening',1:'evening',2:'evening',3:'evening',4:'evening',6:'evening',7:'evening',8:'evening',9:'evening',10:'evening',12:'evening',13:'evening'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '蕭先育',  dayShifts: {0:'evening',1:'evening',2:'evening',3:'evening',5:'evening',6:'evening',7:'evening',8:'evening',9:'evening',10:'evening',11:'evening'}, morningRoutePref: null, eveningRoutePref: '路線十二' },
    { name: '吳秉叡',  dayShifts: {0:'evening',1:'evening',2:'evening',3:'evening',4:'evening',5:'evening',6:'evening',7:'evening',8:'evening',9:'evening',10:'evening',11:'evening',12:'evening',13:'evening'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '楊韻如',  dayShifts: {0:'evening',3:'evening',4:'evening',6:'evening',9:'evening',10:'evening',13:'evening'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '謝燕宣',  dayShifts: {0:'evening',1:'evening',2:'evening',3:'evening',4:'evening',5:'evening',6:'evening',7:'evening',8:'evening',9:'evening',10:'evening',11:'evening',12:'evening',13:'evening'}, morningRoutePref: null, eveningRoutePref: null },
    { name: '店長',    dayShifts: {0:'both',1:'both',2:'both',3:'both',4:'both',5:'both',6:'both',7:'both',8:'both',9:'both',10:'both',11:'both',12:'both',13:'both'}, morningRoutePref: null, eveningRoutePref: null, backup: true },
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
  const routes = type === 'morning' ? MORNING_ROUTES : EVENING_ROUTES;
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
        const normPref = p => Array.isArray(p) ? p.filter(Boolean) : (p ? [p] : []);
        return { ...s, morningRoutePref: normPref(s.morningRoutePref), eveningRoutePref: normPref(s.eveningRoutePref) };
      });
    }
    if (data.schedule)  state.schedule  = data.schedule;
    if (data.startDate) state.startDate = data.startDate;
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
        const isExtra = ri?.isExtra;
        const badgeClass = isExtra ? 'route-badge route-badge-extra' : 'route-badge';
        const routeBadge = ri?.label ? `<span class="${badgeClass}">${escHtml(ri.label)}</span>` : '';
        const earlyBadge = (showEarlyStart && ri?.earlyStart) ? `<span class="early-start-badge">18:00起</span>` : '';

        let storesHtml, countHtml;
        if (ri?.extraType === 'packing') {
          storesHtml = `<span class="extra-task-badge extra-packing">打包</span>`;
          countHtml  = '—';
        } else if (ri?.extraType === 'scs') {
          storesHtml = `<span class="extra-task-badge extra-scs">SCS 上架</span>`;
          countHtml  = '—';
        } else {
          storesHtml = stores.map(s => `<span class="store-chip">${escHtml(s)}</span>`).join('');
          countHtml  = `${stores.length}家`;
        }

        return `<tr${isExtra ? ' class="row-extra-staff"' : ''}>
          <td class="sa-person">${escHtml(name)}${ri ? `<div class="sa-route-info">${routeBadge}${earlyBadge}</div>` : ''}</td>
          <td class="sa-stores">${storesHtml}</td>
          <td class="sa-count">${countHtml}</td>
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
