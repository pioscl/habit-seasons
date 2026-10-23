import test from 'node:test';
import assert from 'node:assert/strict';
import {quickHabitCycles} from '../src/today-view.js';
import {shiftDate, parseDate, startCycle, checkIn, undoCheckIn, backfillCheckIn, validate} from '../src/model.js';
import {populatedState} from './fixtures.js';

const cycle = (id, frequency = {type: 'weekly', times: 3}, fields = {}) => ({
  id, status: 'active', startDate: '2026-10-19', endDate: '2026-11-08', frequency, ...fields,
});
const records = (cycleId, dates) => dates.map(date => ({cycleId, date}));
const ids = cycles => cycles.map(cycle => cycle.id);

test('quick view hides completed weekly targets while preserving pending order and records', () => {
  const state = {
    cycles: [cycle('done'), cycle('pending'), cycle('other')],
    checkins: [...records('done', ['2026-10-19', '2026-10-21', '2026-10-23']), ...records('pending', ['2026-10-19'])],
  };
  const before = structuredClone(state);
  assert.deepEqual(ids(quickHabitCycles(state, '2026-10-23')), ['pending', 'other']);
  assert.deepEqual(state, before);
});

test('a daily habit checked today stays visible until the whole week is completed', () => {
  const state = {cycles: [cycle('daily', {type: 'daily'})], checkins: records('daily', Array.from({length: 5}, (_, i) => shiftDate('2026-10-19', i)))};
  assert.deepEqual(ids(quickHabitCycles(state, '2026-10-23')), ['daily']);
  state.checkins.push(...records('daily', ['2026-10-24', '2026-10-25']));
  assert.deepEqual(quickHabitCycles(state, '2026-10-25'), []);
  assert.deepEqual(ids(quickHabitCycles(state, '2026-10-26')), ['daily']);
});

test('selected weekdays hide after all scheduled days, rather than waiting for Sunday', () => {
  const state = {cycles: [cycle('fixed', {type: 'weekdays', days: [1, 3, 5]})], checkins: records('fixed', ['2026-10-19', '2026-10-21'])};
  assert.deepEqual(ids(quickHabitCycles(state, '2026-10-23')), ['fixed']);
  state.checkins.push(...records('fixed', ['2026-10-23']));
  assert.deepEqual(quickHabitCycles(state, '2026-10-23'), []);
});

test('short first and last weeks use their actual execution targets', () => {
  const state = {cycles: [cycle('short', {type: 'weekly', times: 5}, {startDate: '2026-10-23', endDate: '2026-10-27'})], checkins: records('short', ['2026-10-23', '2026-10-24', '2026-10-25'])};
  assert.deepEqual(quickHabitCycles(state, '2026-10-25'), []);
  assert.deepEqual(ids(quickHabitCycles(state, '2026-10-26')), ['short']);
  state.checkins.push(...records('short', ['2026-10-26', '2026-10-27']));
  assert.deepEqual(quickHabitCycles(state, '2026-10-27'), []);
});

test('zero targets are not treated as completion, and archived cycles are excluded', () => {
  const state = {cycles: [cycle('future', undefined, {startDate: '2026-10-26'}), cycle('expired', undefined, {startDate: '2026-10-05', endDate: '2026-10-18'}), cycle('closed', undefined, {status: 'ended'})], checkins: []};
  assert.deepEqual(ids(quickHabitCycles(state, '2026-10-23')), ['future', 'expired']);
});

test('check-in, undo, backfill and Monday turnover immediately update the derived list', t => {
  t.mock.timers.enable({apis: ['Date'], now: parseDate('2026-10-19')});
  const state = populatedState();
  const habit = startCycle(state, state.templates[0].id, '2026-10-19', '2026-11-08', {type: 'weekly', times: 3}, {points: 10, weeklyBonusPoints: 20, completionThreshold: 90});
  t.mock.timers.setTime(+parseDate('2026-10-23'));
  backfillCheckIn(state, habit.id, '2026-10-19');
  backfillCheckIn(state, habit.id, '2026-10-21');
  assert.deepEqual(ids(quickHabitCycles(state)), [habit.id]);
  checkIn(state, habit.id);
  assert.deepEqual(quickHabitCycles(state), []);
  undoCheckIn(state, habit.id);
  assert.deepEqual(ids(quickHabitCycles(state)), [habit.id]);
  backfillCheckIn(state, habit.id, '2026-10-22');
  assert.deepEqual(quickHabitCycles(state), []);
  t.mock.timers.setTime(+parseDate('2026-10-26'));
  assert.deepEqual(ids(quickHabitCycles(state)), [habit.id]);
  validate(state);
});
