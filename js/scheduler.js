const Scheduler = {
  generate(staff, startDate, options = {}) {
    const {
      days = 14,
      morningMin = 8,
      morningMax = 9,
      eveningCount = 9,
    } = options;

    if (!staff || staff.length === 0) throw new Error('請先新增人員');

    const canMorning = staff.filter(s => this._canMorning(s));
    const canEvening = staff.filter(s => this._canEvening(s));
    if (canMorning.length < morningMax) {
      throw new Error(`能上早班的人員不足（目前 ${canMorning.length} 人，至少需要 ${morningMax} 人）`);
    }
    if (canEvening.length < eveningCount) {
      throw new Error(`能上晚班的人員不足（目前 ${canEvening.length} 人，至少需要 ${eveningCount} 人）`);
    }

    const counts = {};
    staff.forEach(s => { counts[s.name] = { morning: 0, evening: 0, total: 0 }; });

    const schedule = [];
    const start = new Date(startDate + 'T00:00:00');

    for (let i = 0; i < days; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const dow = date.getDay();

      const morningSize = (i % 2 === 0) ? morningMin : morningMax;

      // Filter: can work morning shift AND available this day of week
      const eligibleMorning = staff.filter(s =>
        this._canMorning(s) && this._canWork(s, dow)
      );
      const orderedMorning = this._prioritizedOrder(eligibleMorning, counts);
      const morning = orderedMorning.slice(0, Math.min(morningSize, orderedMorning.length));
      const morningNameSet = new Set(morning.map(s => s.name));

      // Filter: can work evening shift AND available AND not already in morning
      const eligibleEvening = staff.filter(s =>
        this._canEvening(s) && this._canWork(s, dow) && !morningNameSet.has(s.name)
      );
      const orderedEvening = this._prioritizedOrder(eligibleEvening, counts);
      const evening = orderedEvening.slice(0, Math.min(eveningCount, orderedEvening.length));

      morning.forEach(s => { counts[s.name].morning++; counts[s.name].total++; });
      evening.forEach(s => { counts[s.name].evening++; counts[s.name].total++; });

      schedule.push({
        date: this._formatDate(date),
        dayOfWeek: '日一二三四五六'[dow],
        morning: morning.map(s => s.name),
        evening: {
          staff: evening.map(s => s.name),
          endTime: '23:00',
        },
      });
    }

    return schedule;
  },

  _canMorning(s) { return s.shiftType === 'morning' || s.shiftType === 'both'; },
  _canEvening(s) { return s.shiftType === 'evening' || s.shiftType === 'both'; },

  // availableDays: array of 0-6; empty or length===7 means all days
  _canWork(s, dow) {
    if (!s.availableDays || s.availableDays.length === 0 || s.availableDays.length === 7) return true;
    return s.availableDays.includes(dow);
  },

  // Group staff by total shift count, Fisher-Yates shuffle within each group
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
