import {today, parseDate} from './core.js';
import {weekProgress, weekStart, shiftDate, scheduled} from './habit-math.js';

// This is a view of the records, not a stored completion flag. The next week,
// a backfill, or an undo automatically produces a fresh list.
export function quickHabitCycles(state, date = today()) {
  return state.cycles.filter(cycle => {
    if (cycle.status !== 'active') return false;
    const {done, target} = weekProgress(state, cycle, date);
    // No scheduled work this week is different from having completed it.
    return target === 0 || done < target;
  });
}

export function sundayBackfillSummary(state, date = today()) {
  if (parseDate(date).getDay() !== 0) return null;
  const monday = weekStart(date);
  const earlierDays = Array.from({length: 6}, (_, index) => shiftDate(monday, index));
  const items = [];

  for (const cycle of state.cycles) {
    if (cycle.status !== 'active') continue;
    const {done, target} = weekProgress(state, cycle, date);
    if (target === 0 || done >= target) continue;
    const recorded = new Set(state.checkins.filter(record => record.cycleId === cycle.id).map(record => record.date));
    const dates = earlierDays.filter(day => scheduled(cycle, day) && !recorded.has(day));
    // Flexible weekly habits have a quota, not six individually required dates.
    // Reserve today's remaining opportunity before counting earlier shortfalls.
    const todayRemaining = scheduled(cycle, date) && !recorded.has(date) ? 1 : 0;
    const count = cycle.frequency.type === 'weekly'
      ? Math.min(dates.length, Math.max(0, target - done - todayRemaining))
      : dates.length;
    if (count > 0) items.push({cycleId: cycle.id, dates, count});
  }

  return {items, total: items.reduce((sum, item) => sum + item.count, 0)};
}
