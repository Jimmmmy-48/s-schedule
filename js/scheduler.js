const Scheduler = {
  generate(staff, startDate, options = {}) {
    const {
      days = 14,
      morningRoutes = null,
      eveningRoutes = null,
      storeZoneMap = {},
    } = options;

    if (!staff || staff.length === 0) throw new Error('請先新增人員');

    const counts = {};
    staff.forEach(s => { counts[s.name] = { morning: 0, evening: 0, total: 0 }; });

    const morningPrefs = {};
    const eveningPrefs = {};
    staff.forEach(s => {
      const mp = Array.isArray(s.morningRoutePref) ? s.morningRoutePref : (s.morningRoutePref ? [s.morningRoutePref] : []);
      const ep = Array.isArray(s.eveningRoutePref) ? s.eveningRoutePref : (s.eveningRoutePref ? [s.eveningRoutePref] : []);
      if (mp.length) morningPrefs[s.name] = mp;
      if (ep.length) eveningPrefs[s.name] = ep;
    });

    const regularStaff = staff.filter(s => !s.backup);
    const backupStaff  = staff.filter(s => s.backup);
    const minMorning   = morningRoutes ? morningRoutes.length : 1;
    const minEvening   = eveningRoutes ? eveningRoutes.length : 1;

    const schedule = [];
    const start = new Date(startDate + 'T00:00:00');

    for (let i = 0; i < days; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);

      const eligRegularMorning = regularStaff.filter(s => this._canMorning(s, i));
      const eligBackupMorning  = eligRegularMorning.length < minMorning
        ? backupStaff.filter(s => this._canMorning(s, i))
        : [];
      const eligibleMorning = [...eligRegularMorning, ...eligBackupMorning];
      const morning         = this._prioritizedOrder(eligibleMorning, counts);
      const morningNameSet  = new Set(morning.map(s => s.name));

      const eligRegularEvening = regularStaff.filter(s => this._canEvening(s, i) && !morningNameSet.has(s.name));
      const eligBackupEvening  = eligRegularEvening.length < minEvening
        ? backupStaff.filter(s => this._canEvening(s, i) && !morningNameSet.has(s.name))
        : [];
      const eligibleEvening = [...eligRegularEvening, ...eligBackupEvening];
      const evening = this._prioritizedOrder(eligibleEvening, counts);

      morning.forEach(s => { counts[s.name].morning++; counts[s.name].total++; });
      evening.forEach(s => { counts[s.name].evening++; counts[s.name].total++; });

      schedule.push({
        date: this._formatDate(date),
        dayOfWeek: '日一二三四五六'[date.getDay()],
        morning: morning.map(s => s.name),
        evening: { staff: evening.map(s => s.name), endTime: '23:00' },
      });
    }

    const stores = options.stores || [];
    if (stores.length > 0) {
      schedule.forEach(day => {
        if (morningRoutes || eveningRoutes) {
          const mResult = morningRoutes
            ? this._distributeWithRoutes(day.morning, morningRoutes, stores, morningPrefs, storeZoneMap)
            : { assignments: this._distribute(day.morning, stores), routeInfo: {} };
          const eResult = eveningRoutes
            ? this._distributeWithRoutes(day.evening.staff, eveningRoutes, stores, eveningPrefs, storeZoneMap)
            : { assignments: this._distribute(day.evening.staff, stores), routeInfo: {} };
          day.storeAssignments = {
            morning: mResult.assignments,
            evening: eResult.assignments,
            morningRouteInfo: mResult.routeInfo,
            eveningRouteInfo: eResult.routeInfo,
            morningUnassigned: mResult.unassignedRoutes,
            eveningUnassigned: eResult.unassignedRoutes,
          };
        } else {
          day.storeAssignments = {
            morning: this._distribute(day.morning, stores),
            evening: this._distribute(day.evening.staff, stores),
          };
        }
      });
    }

    return schedule;
  },

  // Distribute stores as evenly as possible among staffNames.
  // Returns { name: [storeA, storeB, ...], ... }
  _distribute(staffNames, stores) {
    if (!staffNames.length || !stores.length) return {};
    const base  = Math.floor(stores.length / staffNames.length);
    const extra = stores.length % staffNames.length;
    const result = {};
    let idx = 0;
    staffNames.forEach((name, i) => {
      const count = base + (i < extra ? 1 : 0);
      result[name] = stores.slice(idx, idx + count);
      idx += count;
    });
    return result;
  },

  _normalizeName(name) {
    return String(name).replace(/\s*[(（][^)）]*[)）]\s*$/, '').trim();
  },

  _distributeWithRoutes(staffNames, routes, allStores, staffPrefs = {}, storeZoneMap = {}) {
    if (!staffNames.length) return { assignments: {}, routeInfo: {}, unassignedRoutes: [] };

    const n = staffNames.length;
    const r = routes.length;

    // Build normalized-name → actual store name map
    const normalizedToActual = {};
    allStores.forEach(s => {
      const norm = this._normalizeName(s);
      if (!normalizedToActual[norm]) normalizedToActual[norm] = s;
    });

    // Resolve each route's store list to actual store names (strip suffix variants)
    const routesResolved = routes.map(rt => ({
      label: rt.label,
      stores: rt.stores.map(s => normalizedToActual[this._normalizeName(s)] || s),
    }));

    const assignments = {};
    const routeInfo = {};

    // Two-round preference matching: first preferences, then second preferences
    const winnerByRouteIdx = {};
    const alreadyWon = new Set();
    for (let round = 0; round < 2; round++) {
      routes.forEach((rt, idx) => {
        if (idx in winnerByRouteIdx) return;
        const candidates = staffNames.filter(name => {
          if (alreadyWon.has(name)) return false;
          const prefs = staffPrefs[name] || [];
          return prefs[round] === rt.label;
        });
        if (candidates.length > 0) {
          const winner = candidates[Math.floor(Math.random() * candidates.length)];
          winnerByRouteIdx[idx] = winner;
          alreadyWon.add(winner);
        }
      });
    }

    // Build ordered array: place winners at their preferred route's index (if index < n)
    const ordered = new Array(n).fill(null);
    const placed = new Set();
    Object.entries(winnerByRouteIdx).forEach(([idxStr, name]) => {
      const idx = parseInt(idxStr);
      if (idx < n && ordered[idx] === null) {
        ordered[idx] = name;
        placed.add(name);
      }
    });

    // Fill remaining slots with non-placed staff in original priority order
    let fi = 0;
    for (let i = 0; i < n; i++) {
      if (ordered[i] === null) {
        while (fi < staffNames.length && placed.has(staffNames[fi])) fi++;
        if (fi < staffNames.length) ordered[i] = staffNames[fi++];
      }
    }

    // Assign one route per person; extra staff get no stores
    const assignCount = Math.min(n, r);
    for (let i = 0; i < assignCount; i++) {
      const name = ordered[i];
      if (!name) continue;
      assignments[name] = [...routesResolved[i].stores];
      routeInfo[name] = { label: routes[i].label, earlyStart: this._routeEarlyStart(routes[i].stores) };
    }

    // Extra staff beyond routes (max 2)
    for (let i = r; i < Math.min(n, r + 2); i++) {
      const name = ordered[i];
      if (!name) continue;
      if (i === r) {
        // Extra person 1: zone-aware extraction — prefer zones 1 & 2 (have shipping stores)
        let donorName = null, donorMax = 1;

        // Pass 1: routes that contain at least one zone-1 or zone-2 store
        Object.entries(assignments).forEach(([p, s]) => {
          if (s.length > donorMax && s.some(st => { const z = storeZoneMap[st]; return z === 1 || z === 2; })) {
            donorMax = s.length; donorName = p;
          }
        });
        // Pass 2: fallback — any route with 2+ stores
        if (!donorName) {
          donorMax = 1;
          Object.entries(assignments).forEach(([p, s]) => {
            if (s.length > donorMax) { donorMax = s.length; donorName = p; }
          });
        }

        if (donorName) {
          const store = assignments[donorName].pop();
          assignments[name] = [store];
          routeInfo[name] = { label: '支援', earlyStart: false, isExtra: true, extraType: 'store' };
        } else {
          assignments[name] = [];
          routeInfo[name] = { label: 'SCS上架', earlyStart: false, isExtra: true, extraType: 'scs' };
        }
      } else {
        // Extra person 2: packing
        assignments[name] = [];
        routeInfo[name] = { label: '打包', earlyStart: false, isExtra: true, extraType: 'packing' };
      }
    }

    // Routes beyond available staff count are marked unassigned
    const unassignedRoutes = r > n ? routesResolved.slice(n) : [];

    return { assignments, routeInfo, unassignedRoutes };
  },

  _routeEarlyStart(stores) {
    return stores.length >= 3;
  },

  // dayShifts keys are day offsets (0–13); value: 'both'|'morning'|'evening'
  // A missing key means the person is not available that day.
  _canMorning(s, dayOffset) {
    const pref = s.dayShifts?.[dayOffset];
    return pref === 'morning' || pref === 'both';
  },
  _canEvening(s, dayOffset) {
    const pref = s.dayShifts?.[dayOffset];
    return pref === 'evening' || pref === 'both';
  },

  _prioritizedOrder(staff, counts) {
    const groups = new Map();
    staff.forEach(s => {
      const t = counts[s.name].total;
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t).push(s);
    });

    const result = [];
    [...groups.keys()].sort((a, b) => a - b).forEach(k => {
      const g = groups.get(k);
      for (let i = g.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [g[i], g[j]] = [g[j], g[i]];
      }
      result.push(...g);
    });
    return result;
  },

  _formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  getStats(schedule, staff) {
    const stats = {};
    staff.forEach(s => { stats[s.name] = { morning: 0, evening: 0, total: 0 }; });

    schedule.forEach(day => {
      day.morning.forEach(name => {
        if (stats[name]) { stats[name].morning++; stats[name].total++; }
      });
      day.evening.staff.forEach(name => {
        if (stats[name]) { stats[name].evening++; stats[name].total++; }
      });
    });

    return stats;
  },
};
