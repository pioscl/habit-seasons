import test from 'node:test';
import assert from 'node:assert/strict';
import {weeklyTarget,weekProgress,hasPendingWeek,initialState,startCycle,checkIn,backfillCheckIn,undoCheckIn,parseDate} from '../dist/model.js';
const cycle=(frequency,fields={})=>({id:'c',status:'active',startDate:'2026-09-21',endDate:'2026-10-11',frequency,...fields});
const state=dates=>({checkins:dates.map(date=>({cycleId:'c',date}))});
test('whole-week totals cover daily and fixed weekdays without treating future days as missed',()=>{
 const daily=cycle({type:'daily'}),fixed=cycle({type:'weekdays',days:[1,3,5]});
 const s=state(['2026-09-20','2026-09-21','2026-09-23']);
 assert.deepEqual(weekProgress(s,daily,'2026-09-23'),{done:2,target:7});
 assert.deepEqual(weekProgress(s,fixed,'2026-09-23'),{done:2,target:3});
 assert.equal(hasPendingWeek(s,fixed,'2026-09-23'),true);
 s.checkins.push({cycleId:'other',date:'2026-09-23'});
 assert.equal(weekProgress(s,fixed,'2026-09-23').done,2);
});
test('first and last partial weeks use only scheduled days within the cycle',()=>{
 for(const [frequency,first,last] of [[{type:'daily'},3,2],[{type:'weekdays',days:[1,3,5]},1,1],[{type:'weekly',times:4},3,2]]){
  const c=cycle(frequency,{startDate:'2026-09-25',endDate:'2026-10-06'});
  assert.equal(weeklyTarget(c,'2026-09-21'),first);assert.equal(weeklyTarget(c,'2026-10-05'),last);
  assert.equal(weeklyTarget(c,'2026-09-14'),0);assert.equal(weeklyTarget(c,'2026-10-12'),0);
 }
});
test('pending filter excludes met targets, archived cycles and weeks without plans',()=>{
 const c=cycle({type:'weekly',times:2}),s=state(['2026-09-21','2026-09-23']);
 assert.equal(hasPendingWeek(s,c,'2026-09-23'),false);
 assert.equal(hasPendingWeek(s,{...c,status:'completed'},'2026-09-28'),false);
 assert.equal(hasPendingWeek(s,{...c,status:'ended'},'2026-09-28'),false);
 assert.equal(hasPendingWeek(s,{...c,startDate:'2026-10-05'},'2026-09-28'),false);
 assert.equal(hasPendingWeek(s,cycle({type:'weekdays',days:[1]},{startDate:'2026-09-29'}),'2026-09-28'),false);
 assert.equal(hasPendingWeek(state([]),cycle({type:'daily'},{startDate:'2026-09-25'}),'2026-09-23'),true);
 assert.equal(hasPendingWeek(state([]),cycle({type:'daily'},{endDate:'2026-09-22'}),'2026-09-23'),true);
});
test('Sunday progress resets on Monday and unmet counts are not carried forward',()=>{
 const c=cycle({type:'weekly',times:3}),s=state(['2026-09-21','2026-09-27']);
 assert.deepEqual(weekProgress(s,c,'2026-09-27'),{done:2,target:3});
 assert.deepEqual(weekProgress(s,c,'2026-09-28'),{done:0,target:3});
 assert.equal(hasPendingWeek(s,c,'2026-09-28'),true);
});
test('checking today keeps a partly completed week pending; backfill and undo update membership',t=>{
 t.mock.timers.enable({apis:['Date'],now:parseDate('2026-09-21')});
 const s=initialState(),c=startCycle(s,s.templates[0].id,'2026-09-21','2026-10-04',{type:'weekly',times:3});
 t.mock.timers.setTime(+parseDate('2026-09-23'));
 backfillCheckIn(s,c.id,'2026-09-21');checkIn(s,c.id);
 assert.deepEqual(weekProgress(s,c),{done:2,target:3});assert.equal(hasPendingWeek(s,c),true);
 backfillCheckIn(s,c.id,'2026-09-22');assert.equal(hasPendingWeek(s,c),false);
 undoCheckIn(s,c.id);assert.deepEqual(weekProgress(s,c),{done:2,target:3});assert.equal(hasPendingWeek(s,c),true);
});
