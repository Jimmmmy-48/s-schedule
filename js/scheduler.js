const Scheduler = {
  /**
   * Generates a 14-day schedule with fair shift distribution.
   * No person is assigned both morning and evening on the same day.
   * People with fewer total shifts are prioritized each day.
   */
  generate(staff, startDate, options = {}) {
    const {
      days = 14,
      morningMin = 8,
      morningMax = 9,
      eveningCount = 9,
    } = options;

    if (!staff || staff.length === 0) throw new Error('請先新增人員');
    if (staff.length < morningMax + eveningCount) {
      throw new Error(`人員不足，至少需要 ${morningMax + eveningCount} 人才能排班`);
    }

    const counts = {};
    staff.forEach(s => { counts[s] = { morning: 0, evening: 0, total: 0 }; });

    const schedule = [];
    const start = new Date(startDate + 'T00:00:00');

    for (let i = 0; i < days; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);

      // Alternate morning size: even days = morningMin, odd days = morningMax
      const morningSize = (i % 2 === 0) ? morningMin : morningMax;

      // Sort staff by total shifts (fewest first), with random tiebreaking within same count
      const ordered = this._prioritizedOrder(staff, counts);

      const morning = ordered.slice(0, morningSize);
      const morningSet = new Set(morning);
      const remaining = ordered.filter(s => !morningSet.has(s));
      const evening = remaining.slice(0, eveningCount);

      morning.forEach(s => { counts[s].morning++; counts[s].total++; });
      evening.forEach(s => { counts[s].evening++; counts[s].total++; });

      schedule.push({
        date: this._formatDate(date),
        dayOfWeek: '日一二三四五六'[date.getDay()],
        morning: [...morning],
        evening: {
          staff: [...evening],
          endTime: '23:00',
        },
      });
    }

    return schedule;
  },

  // Groups staff by total shift count, then Fisher-Yates shuffles within each group.
  // This ensures people with equal priority are randomly ordered.
  _prioritizedOrder(staff, counts) {
    const groups = new Map();
    staff.forEach(s => {
      const t = counts[s].total;
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t).push(s);
    });

    const result = [];
    const sortedKeys = [...groups.keys()].sort((a, b) => a - b);
    sortedKeys.forEach(k => {
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
    staff.forEach(s => { stats[s] = { morning: 0, evening: 0, total: 0 }; });

    schedule.forEach(day => {
      day.morning.forEach(s => {
        if (stats[s]) { stats[s].morning++; stats[s].total++; }
      });
      day.evening.staff.forEach(s => {
        if (stats[s]) { stats[s].evening++; stats[s].total++; }
      });
    });

    return stats;
  },
};
