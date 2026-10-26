import test from 'node:test';
import assert from 'node:assert/strict';
import {sundayBackfillSummary} from '../src/today-view.js';
import {parseDate, startCycle, checkIn, backfillCheckIn, weeklyAwards, balance, validate} from '../src/model.js';
import {populatedState} from './fixtures.js';

const sunday = '2026-10-25';
const cycle = (id, frequency = {type: 'daily'}, fields = {}) => ({
  id, status: 'active', startDate: '2026-10-19', endDate: '2026-11-08', frequency, ...fields,
});
const records = (cycleId, dates) => dates.map(date => ({cycleId, date}));

test('review appears only on Sunday', () => {
  const state = {cycles: [cycle('daily')], checkins: []};
  assert.equal(sundayBackfillSummary(state, '2026-10-24'), null);
  assert.equal(sundayBackfillSummary(state, '2026-10-26'), null);
  assert.equal(sundayBackfillSummary(state, sunday).total, 6);
});

test('daily and selected-weekday shortfalls exclude today and non-execution days', () => {
  const state = {
    cycles: [cycle('daily'), cycle('fixed', {type: 'weekdays', days: [1, 3, 5, 0]})],
    checkins: [...records('daily', ['2026-10-19', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24']), ...records('fixed', ['2026-10-19', '2026-10-23'])],
  };
  const before = structuredClone(state);
  assert.deepEqual(sundayBackfillSummary(state, sunday), {items: [
    {cycleId: 'daily', dates: ['2026-10-20'], count: 1},
    {cycleId: 'fixed', dates: ['2026-10-21'], count: 1},
  ], total: 2});
  assert.deepEqual(state, before);
  state.checkins.push(...records('daily', [sunday]), ...records('fixed', [sunday]));
  assert.equal(sundayBackfillSummary(state, sunday).total, 2);
});

test('weekly quotas count only the required earlier shortfall, with dates available to choose', () => {
  const state = {cycles: [cycle('weekly', {type: 'weekly', times: 3})], checkins: records('weekly', ['2026-10-19'])};
  const review = sundayBackfillSummary(state, sunday);
  assert.equal(review.total, 1);
  assert.deepEqual(review.items[0].dates, ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24']);
  state.checkins.push(...records('weekly', [sunday]));
  assert.equal(sundayBackfillSummary(state, sunday).total, 1);
  state.checkins.push(...records('weekly', ['2026-10-20']));
  assert.deepEqual(sundayBackfillSummary(state, sunday), {items: [], total: 0});
});

test('a quota that can be finished today does not create a backfill reminder', () => {
  const state = {cycles: [cycle('weekly', {type: 'weekly', times: 3})], checkins: records('weekly', ['2026-10-19', '2026-10-21'])};
  assert.deepEqual(sundayBackfillSummary(state, sunday), {items: [], total: 0});
  state.checkins.push(...records('weekly', ['2026-10-23']));
  assert.equal(sundayBackfillSummary(state, sunday).total, 0);
});

test('partial weeks respect cycle boundaries and do not reserve a day after the cycle ended', () => {
  const state = {
    cycles: [cycle('ended-this-week', {type: 'weekly', times: 5}, {startDate: '2026-10-23', endDate: '2026-10-24'}), cycle('starts-today', {type: 'weekly', times: 5}, {startDate: sunday})],
    checkins: records('ended-this-week', ['2026-10-23']),
  };
  assert.deepEqual(sundayBackfillSummary(state, sunday), {items: [{cycleId: 'ended-this-week', dates: ['2026-10-24'], count: 1}], total: 1});
});

test('archived and future cycles are excluded, and previous weeks do not count', () => {
  const state = {
    cycles: [cycle('old', {type: 'weekly', times: 3}, {startDate: '2026-10-12'}), cycle('archived', undefined, {status: 'ended'}), cycle('future', undefined, {startDate: '2026-10-26'})],
    checkins: records('old', ['2026-10-12', '2026-10-13', '2026-10-14']),
  };
  const review = sundayBackfillSummary(state, sunday);
  assert.equal(review.total, 2);
  assert.equal(review.items.length, 1);
  assert.equal(review.items[0].cycleId, 'old');
  assert.ok(review.items[0].dates.every(date => date >= '2026-10-19' && date < sunday));
});

test('empty and fully completed weeks have zero pending backfills', () => {
  assert.deepEqual(sundayBackfillSummary({cycles: [], checkins: []}, sunday), {items: [], total: 0});
  const state = {cycles: [cycle('fixed', {type: 'weekdays', days: [1, 3]})], checkins: records('fixed', ['2026-10-19', '2026-10-21'])};
  assert.deepEqual(sundayBackfillSummary(state, sunday), {items: [], total: 0});
});

test('real Sunday check-in and backfill recalculate counts and preserve reward rules', t => {
  t.mock.timers.enable({apis: ['Date'], now: parseDate('2026-10-19')});
  const state = populatedState();
  const habit = startCycle(state, state.templates[0].id, '2026-10-19', '2026-11-08', {type: 'weekly', times: 3}, {points: 10, weeklyBonusPoints: 20, completionThreshold: 90});
  t.mock.timers.setTime(+parseDate(sunday));
  backfillCheckIn(state, habit.id, '2026-10-19');
  assert.equal(sundayBackfillSummary(state).total, 1);
  checkIn(state, habit.id);
  assert.equal(sundayBackfillSummary(state).total, 1);
  backfillCheckIn(state, habit.id, '2026-10-20');
  assert.equal(sundayBackfillSummary(state).total, 0);
  assert.equal(weeklyAwards(state).length, 1);
  assert.equal(balance(state), 50);
  t.mock.timers.setTime(+parseDate('2026-10-26'));
  assert.equal(sundayBackfillSummary(state), null);
  t.mock.timers.setTime(+parseDate('2026-11-01'));
  assert.equal(sundayBackfillSummary(state).total, 2);
  validate(state);
});
