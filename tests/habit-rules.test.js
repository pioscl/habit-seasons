import test from 'node:test';
import assert from 'node:assert/strict';
import {populatedState} from './fixtures.js';
import {startCycle,checkIn,backfillCheckIn,undoCheckIn,finishCycle,validate,upgrade,balance,earnedPoints,parseDate,shiftDate,expected,requiredCheckins,cycleOutcome,weeklyAwards,cyclePoints,saveReward,redeem,canBackfill} from '../dist/model.js';
import {createGoal,addGoalProgress,editGoalProgress} from '../dist/goal-model.js';
const day='2026-09-21';
function setup(t,{start=day,end='2026-10-04',frequency={type:'weekly',times:3},rules={points:10,weeklyBonusPoints:10,completionThreshold:90}}={}){
 t.mock.timers.enable({apis:['Date'],now:parseDate(start)});
 const s=populatedState(),c=startCycle(s,s.templates[0].id,start,end,frequency,rules);
 return {s,c};
}
function at(t,date){t.mock.timers.setTime(+parseDate(date))}
function hit(t,s,c,date){at(t,date);return checkIn(s,c.id)}
function unchanged(s,fn){const before=structuredClone(s);assert.throws(fn);assert.deepEqual(s,before)}

test('new cycle rules default to 90 percent and no bonus, with independent point overrides',t=>{
 const {s,c}=setup(t,{rules:{}});assert.equal(c.completionThreshold,90);assert.equal(c.weeklyBonusPoints,0);assert.equal(c.snapshot.points,10);
 const rules={points:17,weeklyBonusPoints:9,completionThreshold:80};
 const other=startCycle(s,s.templates[1].id,day,'2026-10-04',{type:'daily'},rules);
 rules.points=99;s.templates[1].points=50;assert.equal(other.snapshot.points,17);assert.equal(other.weeklyBonusPoints,9);assert.equal(other.completionThreshold,80);
 assert.equal(s.templates[0].points,10);assert.equal(checkIn(s,other.id),17);validate(s);
});
test('invalid cycle rules never create a cycle',t=>{
 const {s}=setup(t);const id=s.templates[1].id;
 for(const rules of [null,{points:0},{points:1.5},{points:1001},{weeklyBonusPoints:-1},{weeklyBonusPoints:1.5},{weeklyBonusPoints:1000001},{completionThreshold:null},{completionThreshold:0},{completionThreshold:101},{completionThreshold:90.5}])unchanged(s,()=>startCycle(s,id,day,day,{type:'daily'},rules));
});
test('the last weekly check-in awards once and Monday starts a separate award',t=>{
 const {s,c}=setup(t);
 assert.equal(hit(t,s,c,day),10);assert.equal(hit(t,s,c,'2026-09-22'),10);assert.equal(balance(s),20);
 assert.equal(hit(t,s,c,'2026-09-23'),20);assert.equal(balance(s),40);assert.equal(weeklyAwards(s).length,1);
 unchanged(s,()=>checkIn(s,c.id));at(t,'2026-09-24');unchanged(s,()=>checkIn(s,c.id));
 assert.deepEqual(upgrade(JSON.parse(JSON.stringify(s))),s);assert.equal(balance(upgrade(s)),40);
 for(const date of ['2026-09-28','2026-09-29','2026-09-30'])hit(t,s,c,date);
 assert.equal(balance(s),80);assert.equal(weeklyAwards(s).length,2);assert.equal(cyclePoints(s,c),80);validate(s);
});
test('backfill triggers bonus and undo of today revokes the bonus even if backfill triggered it',t=>{
 const {s,c}=setup(t);hit(t,s,c,'2026-09-27');backfillCheckIn(s,c.id,day);
 assert.equal(backfillCheckIn(s,c.id,'2026-09-22'),20);assert.equal(balance(s),40);
 assert.equal(undoCheckIn(s,c.id),20);assert.equal(balance(s),20);assert.equal(weeklyAwards(s).length,0);
 assert.equal(checkIn(s,c.id),20);assert.equal(balance(s),40);assert.equal(weeklyAwards(s).length,1);validate(s);
});
test('spent bonus blocks undo atomically even when balance covers base points',t=>{
 const {s,c}=setup(t);hit(t,s,c,day);hit(t,s,c,'2026-09-22');hit(t,s,c,'2026-09-23');
 const reward=saveReward(s,{name:'奖励',cost:25});redeem(s,reward.id);assert.equal(balance(s),15);
 unchanged(s,()=>undoCheckIn(s,c.id));assert.equal(weeklyAwards(s).length,1);validate(s);
});
test('undo before weekly completion removes only base points',t=>{
 const {s,c}=setup(t);checkIn(s,c.id);assert.equal(undoCheckIn(s,c.id),10);assert.equal(balance(s),0);validate(s);
});
test('daily plans award on the seventh day without rewarding an incomplete week',t=>{
 const {s,c}=setup(t,{frequency:{type:'daily'}});
 for(let i=0;i<6;i++)assert.equal(hit(t,s,c,shiftDate(day,i)),10);
 assert.equal(balance(s),60);assert.equal(hit(t,s,c,'2026-09-27'),20);assert.equal(balance(s),80);
 hit(t,s,c,'2026-09-28');assert.equal(weeklyAwards(s).length,1);validate(s);
});
test('fixed weekdays and partial weeks award against their actual scheduled targets',t=>{
 const {s,c}=setup(t,{start:'2026-09-25',end:'2026-09-29',frequency:{type:'weekdays',days:[1,3,5]}});
 assert.equal(expected(c),2);assert.equal(checkIn(s,c.id),20);assert.equal(hit(t,s,c,'2026-09-28'),20);
 assert.equal(weeklyAwards(s).length,2);assert.equal(balance(s),40);validate(s);
});
test('weekly-count partial weeks cap goals but keep the configured fixed bonus',t=>{
 const {s,c}=setup(t,{start:'2026-09-25',end:'2026-09-29',frequency:{type:'weekly',times:4}});
 assert.equal(expected(c),5);
 for(const date of ['2026-09-25','2026-09-26','2026-09-27','2026-09-28','2026-09-29'])hit(t,s,c,date);
 assert.equal(balance(s),70);assert.equal(weeklyAwards(s).length,2);validate(s);
});
test('12 weeks at 4 times and 90 percent requires 44 check-ins; reaching it does not auto-close',t=>{
 const {s,c}=setup(t,{end:shiftDate(day,83),frequency:{type:'weekly',times:4}});
 assert.equal(expected(c),48);assert.equal(requiredCheckins(c),44);
 for(let w=0;w<11;w++)for(let d=0;d<4;d++)hit(t,s,c,shiftDate(day,w*7+d));
 assert.equal(c.status,'active');unchanged(s,()=>finishCycle(s,c.id,'completed'));
 at(t,c.endDate);const points=balance(s);assert.equal(finishCycle(s,c.id,'completed'),'completed');assert.equal(balance(s),points);validate(s);
});
test('settlement uses exact counts rather than a rounded displayed percentage',t=>{
 const {s,c}=setup(t,{end:shiftDate(day,200),frequency:{type:'daily'}});
 for(let i=0;i<180;i++)hit(t,s,c,shiftDate(day,i));
 assert.equal(Math.round(180/201*100),90);assert.equal(requiredCheckins(c),181);assert.equal(cycleOutcome(s,c),'failed');
 at(t,c.endDate);const points=balance(s);assert.equal(finishCycle(s,c.id,'completed'),'failed');assert.equal(balance(s),points);assert.ok(weeklyAwards(s).length>0);validate(s);
 assert.deepEqual(upgrade(JSON.parse(JSON.stringify(s))),s);
});
test('expired active cycles accept current-week backfill before settlement',t=>{
 const {s,c}=setup(t,{end:'2026-09-23'});at(t,'2026-09-24');
 assert.equal(c.status,'active');assert.equal(canBackfill(s,c,day),true);
 for(const date of [day,'2026-09-22','2026-09-23'])backfillCheckIn(s,c.id,date);
 assert.equal(balance(s),40);assert.equal(finishCycle(s,c.id,'completed'),'completed');
 assert.equal(canBackfill(s,c,day),false);unchanged(s,()=>backfillCheckIn(s,c.id,day));validate(s);
});
test('failed, early-ended and completed histories preserve previously earned base and weekly rewards',t=>{
 const {s,c}=setup(t);checkIn(s,c.id);hit(t,s,c,'2026-09-22');hit(t,s,c,'2026-09-23');
 assert.equal(finishCycle(s,c.id,'ended'),'ended');assert.equal(balance(s),40);assert.equal(cyclePoints(s,c),40);validate(s);
 const next=startCycle(s,c.templateId,'2026-09-23','2026-09-23');assert.equal(finishCycle(s,next.id,'completed'),'failed');assert.equal(s.cycles.length,2);assert.equal(balance(s),40);validate(s);
});
test('v3 migration keeps legacy cycles, statuses and wallet unchanged without retroactive bonuses',t=>{
 const {s,c}=setup(t,{end:day});checkIn(s,c.id);finishCycle(s,c.id,'completed');
 const oldActive=startCycle(s,s.templates[1].id,day,'2026-10-04');
 const oldZero=startCycle(s,s.templates[2].id,day,day);oldZero.status='completed';oldZero.endedAt=day;
 s.schemaVersion=3;for(const cycle of s.cycles){delete cycle.completionThreshold;delete cycle.weeklyBonusPoints;}
 const before=structuredClone(s),next=upgrade(s);
 assert.deepEqual(s,before);assert.equal(balance(next),10);assert.equal(next.schemaVersion,4);
 assert.deepEqual(next.cycles.map(x=>x.status),['completed','active','completed']);
 for(const cycle of next.cycles){assert.equal(cycle.weeklyBonusPoints,0);assert.equal(cycle.completionThreshold,null)}
 assert.equal(requiredCheckins(next.cycles[1]),null);assert.equal(checkIn(next,oldActive.id),20);
 at(t,'2026-10-04');assert.equal(finishCycle(next,oldActive.id,'completed'),'completed');validate(next);
});
test('imports reject missing rules, invalid thresholds and false completed/failed outcomes',t=>{
 const {s,c}=setup(t,{end:day});checkIn(s,c.id);finishCycle(s,c.id,'completed');
 for(const mutate of [x=>delete x.cycles[0].weeklyBonusPoints,x=>delete x.cycles[0].completionThreshold,x=>x.cycles[0].weeklyBonusPoints=-1,x=>x.cycles[0].completionThreshold=101,x=>x.cycles[0].status='failed',x=>x.checkins=[]]){
  const copy=structuredClone(s);mutate(copy);assert.throws(()=>validate(copy));
 }
});
test('weekly bonus and goal awards share one wallet and both obey rollback constraints',t=>{
 const {s,c}=setup(t,{frequency:{type:'weekly',times:1}});checkIn(s,c.id);assert.equal(earnedPoints(s),20);
 const g=createGoal(s,{title:'阅读',targetValue:1,unit:'页',completionPoints:10,deadline:null,milestones:[]});addGoalProgress(s,g.id,1);
 const r=saveReward(s,{name:'书',cost:15});redeem(s,r.id);assert.equal(balance(s),15);
 unchanged(s,()=>undoCheckIn(s,c.id));editGoalProgress(s,g.id,s.goals.find(x=>x.id===g.id).progressEvents[0].id,0.5);assert.equal(balance(s),5);
 assert.equal(weeklyAwards(s).length,1);validate(s);
});
