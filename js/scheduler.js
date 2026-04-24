const Scheduler = {
  generate(staff, startDate, options = {}) {
    const {
      days = 14,
      morningRoutes = null,
      eveningRoutes = null,
    } = options;

    if (!staff || staff.length === 0) throw new Error('請先新增人員');

    const counts = {};
    staff.forEach(s => { counts[s.name] = { morning: 0, evening: 0, total: 0 }; });

    const morningPrefs = {};
    const eveningPrefs = {};
    staff.forEach(s => {
      if (s.morningRoutePref) morningPrefs[s.name] = s.morningRoutePref;
      if (s.eveningRoutePref) eveningPrefs[s.name] = s.eveningRoutePref;
    });

    const schedule = [];
    const start = new Date(startDate + 'T00:00:00');

    for (let i = 0; i < days; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);

      const eligibleMorning = staff.filter(s => this._canMorning(s, i));
      const morning         = this._prioritizedOrder(eligibleMorning, counts);
      const morningNameSet  = new Set(morning.map(s => s.name));

      const eligibleEvening = staff.filter(s =>
        this._canEvening(s, i) && !morningNameSet.has(s.name)
      );
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
            ? this._distributeWithRoutes(day.morning, morningRoutes, stores, morningPrefs)
            : { assignments: this._distribute(day.morning, stores), routeInfo: {} };
          const eResult = eveningRoutes
            ? this._distributeWithRoutes(day.evening.staff, eveningRoutes, stores, eveningPrefs)
            : { assignments: this._distribute(day.evening.staff, stores), routeInfo: {} };
          day.storeAssignments = {
            morning: mResult.assignments,
            evening: eResult.assignments,
            morningRouteInfo: mResult.routeInfo,
            eveningRouteInfo: eResult.routeInfo,
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

  _distributeWithRoutes(staffNames, routes, allStores, staffPrefs = {}) {
    if (!staffNames.length) return { assignments: {}, routeInfo: {} };

    const n = staffNames.length;
    const r = routes.length;

    const routeStoreSet = new Set(routes.flatMap(rt => rt.stores));
    const uncovered = allStores.filter(s => !routeStoreSet.has(s));

    const assignments = {};
    const routeInfo = {};
    staffNames.forEach(name => { assignments[name] = []; routeInfo[name] = null; });

    // Resolve conflicts: for each route, randomly pick one winner among preferring staff
    const winnerByRouteIdx = {};
    routes.forEach((rt, idx) => {
      const candidates = staffNames.filter(name => staffPrefs[name] === rt.label);
      if (candidates.length > 0) {
        winnerByRouteIdx[idx] = candidates[Math.floor(Math.random() * candidates.length)];
      }
    });

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

    if (n >= r) {
      for (let i = 0; i < r; i++) {
        const name = ordered[i];
        assignments[name] = [...routes[i].stores];
        routeInfo[name] = { label: routes[i].label, earlyStart: this._routeEarlyStart(routes[i].stores) };
      }
      const targets = n > r ? ordered.slice(r) : ordered;
      this._distributeInto(assignments, targets, uncovered);
    } else {
      const groups = routes.slice(0, n).map(rt => ({ stores: [...rt.stores], labels: [rt.label] }));
      for (let i = n; i < r; i++) {
        let minIdx = 0;
        for (let j = 1; j < n; j++) {
          if (groups[j].stores.length < groups[minIdx].stores.length) minIdx = j;
        }
        groups[minIdx].stores.push(...routes[i].stores);
        groups[minIdx].labels.push(routes[i].label);
      }
      for (let i = 0; i < n; i++) {
        const name = ordered[i];
        assignments[name] = groups[i].stores;
        routeInfo[name] = { label: groups[i].labels.join('+'), earlyStart: this._routeEarlyStart(groups[i].stores) };
      }
      if (uncovered.length > 0) this._distributeInto(assignments, ordered, uncovered);
    }

    return { assignments, routeInfo };
  },

  _routeEarlyStart(stores) {
    return stores.length >= 3;
  },

  _distributeInto(result, staffNames, stores) {
    stores.forEach(store => {
      let minName = staffNames[0];
      staffNames.forEach(n => {
        if (result[n].length < result[minName].length) minName = n;
      });
      result[minName].push(store);
    });
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
