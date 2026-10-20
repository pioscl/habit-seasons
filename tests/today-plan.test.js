import test from 'node:test';
import assert from 'node:assert/strict';
import {todayPlan,dayPlanSummary,parseDate,startCycle,checkIn,undoCheckIn,backfillCheckIn,weeklyAwards,balance} from '../src/model.js';
import {populatedState} from './fixtures.js';

const cycle=(frequency={type:'weekly',times:5},fields={})=>({id:'c',status:'active',startDate:'2026-09-21',endDate:'2026-10-11',frequency,...fields});
const state=(dates=[],cycles=[])=>({checkins:dates.map(date=>({cycleId:'c',date})),cycles});

test('a weekly habit becomes required when remaining days equal the outstanding count',()=>{
 const c=cycle(),s=state(['2026-09-21','2026-09-22','2026-09-23']);
 const thursday=todayPlan(s,c,'2026-09-24');
 assert.equal(thursday.kind,'optional');assert.equal(thursday.remaining,2);assert.equal(thursday.daysLeft,4);
 const saturday=todayPlan(s,c,'2026-09-26');
 assert.equal(saturday.kind,'required');assert.equal(saturday.remaining,2);assert.equal(saturday.daysLeft,2);
 assert.equal(saturday.actionable,true);
});

test('required items stay in the denominator after today is checked or undone',()=>{
 const c=cycle(),s=state(['2026-09-21','2026-09-22','2026-09-23'],[c]),date='2026-09-26';
 assert.deepEqual(dayPlanSummary(s,s.cycles,date),{required:1,completedRequired:0,optional:0,behind:0,completed:0});
 s.checkins.push({cycleId:'c',date});
 assert.equal(todayPlan(s,c,date).kind,'required');assert.equal(todayPlan(s,c,date).done,true);
 assert.deepEqual(dayPlanSummary(s,s.cycles,date),{required:1,completedRequired:1,optional:0,behind:0,completed:1});
 s.checkins.pop();assert.equal(dayPlanSummary(s,s.cycles,date).required,1);assert.equal(dayPlanSummary(s,s.cycles,date).completedRequired,0);
});

test('optional check-ins never enter the required denominator, including the final weekly hit',()=>{
 const c=cycle({type:'weekly',times:1}),s=state([],[c]),date='2026-09-21';
 assert.equal(dayPlanSummary(s,s.cycles,date).optional,1);
 s.checkins.push({cycleId:'c',date});
 const plan=todayPlan(s,c,date);
 assert.equal(plan.done,true);assert.equal(plan.kind,'optional');assert.equal(plan.actionable,true);
 assert.deepEqual(dayPlanSummary(s,s.cycles,date),{required:0,completedRequired:0,optional:0,behind:0,completed:1});
 const next=todayPlan(s,c,'2026-09-22');assert.equal(next.kind,'met');assert.equal(next.actionable,false);
});

test('a late weekly plan reports the shortfall and still allows today to be recorded',()=>{
 const c=cycle(),s=state(['2026-09-21','2026-09-22'],[c]),date='2026-09-27';
 const plan=todayPlan(s,c,date);
 assert.equal(plan.kind,'behind');assert.equal(plan.remaining,3);assert.equal(plan.daysLeft,1);assert.equal(plan.shortfall,2);assert.equal(plan.actionable,true);
 assert.equal(dayPlanSummary(s,s.cycles,date).behind,1);
 s.checkins.push({cycleId:'c',date});
 const checked=todayPlan(s,c,date);assert.equal(checked.done,true);assert.equal(checked.kind,'behind');assert.equal(checked.shortfall,2);assert.equal(dayPlanSummary(s,s.cycles,date).behind,0);
 assert.equal(c.status,'active');
});

test('past dates that can be backfilled are not future opportunities',()=>{
 const c=cycle({type:'weekly',times:3}),s=state();
 const saturday=todayPlan(s,c,'2026-09-26');
 assert.equal(saturday.kind,'behind');assert.equal(saturday.daysLeft,2);assert.equal(saturday.shortfall,1);
});

test('daily and selected-weekday habits are required on execution days even after earlier misses',()=>{
 const daily=cycle({type:'daily'}),fixed=cycle({type:'weekdays',days:[1,3,5]}),s=state();
 assert.equal(todayPlan(s,daily,'2026-09-25').kind,'required');
 assert.equal(todayPlan(s,fixed,'2026-09-25').kind,'required');
 const rest=todayPlan(s,fixed,'2026-09-24');assert.equal(rest.kind,'rest');assert.equal(rest.actionable,false);
});

test('first and last partial weeks respect actual targets and the cycle end date',()=>{
 const c=cycle({type:'weekly',times:5},{startDate:'2026-09-25',endDate:'2026-09-29'});
 const first=todayPlan(state(),c,'2026-09-25');assert.equal(first.week.target,3);assert.equal(first.daysLeft,3);assert.equal(first.kind,'required');
 const last=todayPlan(state(),c,'2026-09-28');assert.equal(last.week.target,2);assert.equal(last.daysLeft,2);assert.equal(last.kind,'required');
 const finalDay=todayPlan(state(['2026-09-28']),c,'2026-09-29');assert.equal(finalDay.daysLeft,1);assert.equal(finalDay.kind,'required');
});

test('one-day cycles and every-day weekly quotas are required immediately',()=>{
 const one=cycle({type:'weekly',times:5},{endDate:'2026-09-21'});
 assert.equal(todayPlan(state(),one,'2026-09-21').week.target,1);assert.equal(todayPlan(state(),one,'2026-09-21').kind,'required');
 assert.equal(todayPlan(state(),cycle({type:'weekly',times:7}),'2026-09-21').kind,'required');
});

test('future, expired, closed and non-execution-day cycles are not included in required progress',()=>{
 const future=cycle(undefined,{id:'future',startDate:'2026-09-28'}),expired=cycle(undefined,{id:'expired',endDate:'2026-09-24'}),closed=cycle(undefined,{id:'closed',status:'completed'}),rest=cycle({type:'weekdays',days:[1,3]},{id:'rest'}),date='2026-09-25';
 for(const [c,kind] of [[future,'future'],[expired,'expired'],[closed,'inactive'],[rest,'rest']]){const p=todayPlan(state(),c,date);assert.equal(p.kind,kind);assert.equal(p.actionable,false)}
 const cycles=[future,expired,closed,rest];assert.deepEqual(dayPlanSummary(state([],cycles),cycles,date),{required:0,completedRequired:0,optional:0,behind:0,completed:0});
});

test('Sunday urgency resets on Monday without carrying forward missed counts',()=>{
 const c=cycle({type:'weekly',times:3}),s=state(['2026-09-21','2026-09-22']);
 assert.equal(todayPlan(s,c,'2026-09-27').kind,'required');
 const monday=todayPlan(s,c,'2026-09-28');assert.equal(monday.kind,'optional');assert.equal(monday.remaining,3);assert.equal(monday.daysLeft,7);
});

test('one habit cannot influence another and later records do not influence an earlier day',()=>{
 const c=cycle({type:'weekly',times:3}),s=state();
 s.checkins.push({cycleId:'other',date:'2026-09-21'},{cycleId:'c',date:'2026-09-29'});
 const p=todayPlan(s,c,'2026-09-26');assert.equal(p.remaining,3);assert.equal(p.kind,'behind');assert.equal(p.actionable,true);
});

test('mixed required, optional, behind and completed items are summarized independently',()=>{
 const required=cycle({type:'daily'},{id:'daily'}),optional=cycle({type:'weekly',times:1},{id:'optional'}),behind=cycle({type:'weekly',times:5},{id:'behind'}),s=state([],[required,optional,behind]),date='2026-09-26';
 s.checkins.push({cycleId:'daily',date});
 assert.deepEqual(dayPlanSummary(s,s.cycles,date),{required:1,completedRequired:1,optional:1,behind:1,completed:1});
});

test('real backfill, check-in, undo and weekly awards stay consistent with the plan',t=>{
 t.mock.timers.enable({apis:['Date'],now:parseDate('2026-09-21')});
 const s=populatedState(),c=startCycle(s,s.templates[0].id,'2026-09-21','2026-10-04',{type:'weekly',times:3},{points:10,weeklyBonusPoints:20,completionThreshold:90});
 t.mock.timers.setTime(+parseDate('2026-09-26'));
 assert.equal(todayPlan(s,c).kind,'behind');
 backfillCheckIn(s,c.id,'2026-09-21');assert.equal(todayPlan(s,c).kind,'required');
 backfillCheckIn(s,c.id,'2026-09-22');assert.equal(todayPlan(s,c).kind,'optional');
 assert.equal(checkIn(s,c.id),30);assert.equal(todayPlan(s,c).done,true);assert.equal(weeklyAwards(s).length,1);assert.equal(balance(s),50);
 undoCheckIn(s,c.id);assert.equal(todayPlan(s,c).kind,'optional');assert.equal(todayPlan(s,c).done,false);assert.equal(weeklyAwards(s).length,0);assert.equal(balance(s),20);
 backfillCheckIn(s,c.id,'2026-09-23');assert.equal(todayPlan(s,c).kind,'met');assert.equal(todayPlan(s,c).actionable,false);assert.equal(weeklyAwards(s).length,1);
});
