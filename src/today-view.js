import {today} from './core.js';
import {weekProgress} from './habit-math.js';

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
