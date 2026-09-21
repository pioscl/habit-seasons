import test from 'node:test';
import assert from 'node:assert/strict';
import {backfillCheckIn,canBackfill,parseDate,HABIT_ICONS,upgrade,weekStart,weekProgress,weeklyTarget,canCheckIn,initialState,today,shiftDate,monthEnd,daysBetween,expected,balance,validate,startCycle,checkIn,undoCheckIn,finishCycle,redeem} from '../dist/model.js';
function setup(){const s=initialState();const c=startCycle(s,s.templates[0].id,today(),shiftDate(today(),6));return{s,c}}
test('full lifecycle: snapshot, points, reward, archive and restart',()=>{const{s,c}=setup();s.templates[0].points=30;s.templates[0].name='新版';assert.equal(c.snapshot.points,10);assert.equal(c.snapshot.name,'轻断食');checkIn(s,c.id);s.rewards[0].cost=5;const r=redeem(s,s.rewards[0].id);s.rewards[0].cost=500;s.rewards[0].name='新版奖励';assert.equal(r.cost,5);assert.equal(r.name,'买一本书');assert.equal(balance(s),5);finishCycle(s,c.id,'ended');const next=startCycle(s,s.templates[0].id,today(),shiftDate(today(),3));assert.equal(next.snapshot.points,30);assert.equal(s.checkins.length,1);assert.equal(s.cycles.length,2);validate(s)});
test('duplicate check-ins and concurrent active cycles cannot mint points',()=>{const{s,c}=setup();checkIn(s,c.id);assert.throws(()=>checkIn(s,c.id));assert.throws(()=>startCycle(s,c.templateId,today(),today()));assert.equal(balance(s),10);assert.equal(s.checkins.length,1)});
test('undo cannot make spent balance negative',()=>{const{s,c}=setup();checkIn(s,c.id);s.rewards[0].cost=10;redeem(s,s.rewards[0].id);assert.throws(()=>undoCheckIn(s,c.id));assert.equal(balance(s),0);assert.equal(s.checkins.length,1)});
test('undo restores balance and allows one replacement check-in',()=>{const{s,c}=setup();checkIn(s,c.id);undoCheckIn(s,c.id);assert.equal(balance(s),0);checkIn(s,c.id);assert.equal(balance(s),10)});
test('early completion rejected; ending preserves original denominator',()=>{const{s,c}=setup();assert.throws(()=>finishCycle(s,c.id,'completed'));checkIn(s,c.id);finishCycle(s,c.id,'ended');assert.equal(expected(c),7);assert.equal(balance(s),10);assert.throws(()=>checkIn(s,c.id));assert.throws(()=>undoCheckIn(s,c.id))});
test('completion at end date and archive are separate from template',()=>{const s=initialState(),c=startCycle(s,s.templates[0].id,today(),today());checkIn(s,c.id);finishCycle(s,c.id,'completed');assert.equal(c.status,'completed');assert.equal(s.templates.length,3);assert.equal(c.endedAt,today());validate(s)});
test('weekly plans, future starts, and no scheduled days',()=>{const s=initialState();const dow=new Date(`${today()}T12:00:00`).getDay();const frequency={type:'weekdays',days:[(dow+1)%7]};assert.throws(()=>startCycle(s,s.templates[0].id,today(),today(),frequency));const c=startCycle(s,s.templates[0].id,shiftDate(today(),1),shiftDate(today(),7),frequency);assert.equal(expected(c),1);assert.throws(()=>checkIn(s,c.id));assert.throws(()=>finishCycle(s,c.id,'ended'))});
test('calendar math handles leap days and DST independently',()=>{assert.equal(monthEnd('2028-01-31',1),'2028-02-28');assert.equal(monthEnd('2026-09-21',4),'2027-01-20');assert.equal(daysBetween('2026-11-02','2026-10-31'),2);assert.equal(shiftDate('2028-02-28',1),'2028-02-29')});
test('backup roundtrip preserves complete state',()=>{const{s,c}=setup();checkIn(s,c.id);assert.deepEqual(validate(JSON.parse(JSON.stringify(s))),s)});
test('invalid and inconsistent imports rejected',()=>{const{s,c}=setup();checkIn(s,c.id);const mutate=fn=>{const copy=structuredClone(s);fn(copy);assert.throws(()=>validate(copy))};mutate(x=>x.schemaVersion=999);mutate(x=>x.templates[0].id='bad" onclick="x');mutate(x=>x.cycles[0].startDate='2026-02-30');mutate(x=>x.checkins[0].points=500);mutate(x=>x.checkins.push({...x.checkins[0],id:'different'}));mutate(x=>x.cycles[0].templateId='missing');mutate(x=>x.cycles[0].frequency={type:'weekdays',days:[]});mutate(x=>x.redemptions.push({id:'r',rewardId:x.rewards[0].id,name:'reward',cost:900,redeemedAt:new Date().toISOString()}));mutate(x=>x.templates[0].name='<script>'.repeat(20))});
test('disabled templates and rewards cannot be used',()=>{const s=initialState();s.templates[0].archived=true;assert.throws(()=>startCycle(s,s.templates[0].id,today(),today()));s.rewards[0].archived=true;assert.throws(()=>redeem(s,s.rewards[0].id))});
test('overspending does not create a redemption',()=>{const{s,c}=setup();checkIn(s,c.id);assert.throws(()=>redeem(s,s.rewards[0].id));assert.equal(s.redemptions.length,0);assert.equal(balance(s),10)});

test('frequency belongs to each cycle and is copied independently',()=>{
 const s=initialState(),frequency={type:'weekly',times:3};
 const c=startCycle(s,s.templates[0].id,today(),today(),frequency);
 assert.equal('days' in s.templates[0],false);assert.equal('frequency' in s.templates[0],false);assert.equal('days' in c.snapshot,false);
 frequency.times=7;assert.equal(c.frequency.times,3);finishCycle(s,c.id,'completed');
 const next=startCycle(s,s.templates[0].id,today(),today(),{type:'daily'});assert.equal(next.frequency.type,'daily');assert.equal(c.frequency.type,'weekly');
});
test('weekly targets use Monday boundaries and cap partial weeks by available days',()=>{
 const c={startDate:'2026-09-25',endDate:'2026-10-06',frequency:{type:'weekly',times:4}};
 assert.equal(weekStart('2026-09-27'),'2026-09-21');assert.equal(weekStart('2026-09-28'),'2026-09-28');
 assert.equal(weeklyTarget(c,'2026-09-25'),3);assert.equal(weeklyTarget(c,'2026-09-28'),4);assert.equal(weeklyTarget(c,'2026-10-05'),2);
 assert.equal(expected(c),9);assert.equal(expected(c,'2026-09-26'),3);assert.equal(expected(c,'2026-09-24'),0);
});
test('weekly quota blocks extra dates and resets next Monday',()=>{
 const c={id:'c',status:'active',startDate:'2026-09-21',endDate:'2026-10-04',frequency:{type:'weekly',times:2}};
 const s={checkins:[{cycleId:'c',date:'2026-09-21'},{cycleId:'c',date:'2026-09-23'}]};
 assert.equal(canCheckIn(s,c,'2026-09-24'),false);assert.equal(canCheckIn(s,c,'2026-09-28'),true);
 assert.deepEqual(weekProgress(s,c,'2026-09-24'),{done:2,target:2});assert.deepEqual(weekProgress(s,c,'2026-09-28'),{done:0,target:2});
});
test('weekly check-in and undo update quota and points together',()=>{
 const s=initialState(),c=startCycle(s,s.templates[0].id,today(),shiftDate(today(),10),{type:'weekly',times:1});
 checkIn(s,c.id);assert.equal(canCheckIn(s,c),false);assert.equal(weekProgress(s,c).done,1);undoCheckIn(s,c.id);assert.equal(canCheckIn(s,c),true);assert.equal(balance(s),0);validate(s);
});
test('v1 upgrade preserves the cycle snapshot schedule, history and balance',()=>{
 const s=initialState();const c=startCycle(s,s.templates[0].id,today(),today());checkIn(s,c.id);finishCycle(s,c.id,'completed');
 s.schemaVersion=1;for(const t of s.templates)t.days=[1,3,5];c.snapshot.days=[0,1,2,3,4,5,6];delete c.frequency;
 const original=structuredClone(s),v2=upgrade(s);assert.equal(v2.schemaVersion,2);assert.deepEqual(v2.cycles[0].frequency,{type:'daily'});
 assert.deepEqual(v2.checkins,s.checkins);assert.equal(balance(v2),10);assert.equal(v2.cycles[0].status,'completed');assert.deepEqual(s,original);
 assert.equal('days' in v2.templates[0],false);assert.equal('days' in v2.cycles[0].snapshot,false);assert.deepEqual(upgrade(v2),v2);
});
test('v1 weekday schedule migrates separately from current template settings',()=>{
 const s=initialState(),c=startCycle(s,s.templates[0].id,today(),shiftDate(today(),7));s.schemaVersion=1;
 for(const t of s.templates)t.days=[0,1,2,3,4,5,6];c.snapshot.days=[2,4];delete c.frequency;
 assert.deepEqual(upgrade(s).cycles[0].frequency,{type:'weekdays',days:[2,4]});c.snapshot.days=[9];assert.throws(()=>upgrade(s));
});
test('all 40 icons roundtrip and invalid frequencies fail without creating cycles',()=>{
 const s=initialState();assert.equal(Object.keys(HABIT_ICONS).length,40);
 for(const icon of Object.keys(HABIT_ICONS)){s.templates[0].icon=icon;validate(s)}
 for(const frequency of [{type:'weekly',times:0},{type:'weekly',times:8},{type:'weekly',times:1.5},{type:'weekdays',days:[]},{type:'weekdays',days:[1,1]},{type:'monthly'}])assert.throws(()=>startCycle(s,s.templates[0].id,today(),today(),frequency));
 assert.equal(s.cycles.length,0);
});


test('ending an empty cycle removes only that cycle and allows a fresh start',()=>{
 const {s,c}=setup(),templates=structuredClone(s.templates);
 const other=startCycle(s,s.templates[1].id,today(),today());checkIn(s,other.id);finishCycle(s,other.id,'completed');
 const preserved=structuredClone({other,checkins:s.checkins,points:balance(s)});
 assert.equal(finishCycle(s,c.id,'ended'),'deleted');
 assert.deepEqual(s.cycles,[preserved.other]);assert.deepEqual(s.templates,templates);
 assert.deepEqual(s.checkins,preserved.checkins);assert.equal(balance(s),preserved.points);
 const next=startCycle(s,c.templateId,today(),shiftDate(today(),6));
 assert.equal(s.cycles.filter(x=>x.templateId===c.templateId).length,1);assert.notEqual(next.id,c.id);
 validate(JSON.parse(JSON.stringify(s)));
});
test('ending after undoing the only check-in deletes the empty cycle',()=>{
 const {s,c}=setup();checkIn(s,c.id);undoCheckIn(s,c.id);
 assert.equal(finishCycle(s,c.id,'ended'),'deleted');assert.equal(s.cycles.length,0);
 assert.equal(s.checkins.length,0);assert.equal(balance(s),0);validate(s);
});
test('a real check-in is retained even when completion rounds to zero percent',()=>{
 const s=initialState(),c=startCycle(s,s.templates[0].id,today(),shiftDate(today(),365));checkIn(s,c.id);
 assert.equal(Math.round(100/expected(c)),0);assert.equal(finishCycle(s,c.id,'ended'),'ended');
 assert.equal(s.cycles[0].status,'ended');assert.equal(s.checkins.length,1);assert.equal(balance(s),10);validate(s);
});
test('explicit completion still archives a zero-check-in cycle at its end date',()=>{
 const s=initialState(),c=startCycle(s,s.templates[0].id,today(),today());
 assert.equal(finishCycle(s,c.id,'completed'),'completed');assert.equal(s.cycles.length,1);
 assert.equal(c.status,'completed');validate(s);
});


function backfillSetup(t,frequency={type:'daily'},start='2026-09-21',end='2026-10-04'){
 t.mock.timers.enable({apis:['Date'],now:parseDate(start)});
 const s=initialState(),c=startCycle(s,s.templates[0].id,start,end,frequency);
 t.mock.timers.setTime(+parseDate('2026-09-27'));
 return {s,c};
}
test('Sunday backfill accepts Monday and Saturday, credits snapshot points and survives backup',t=>{
 const {s,c}=backfillSetup(t);s.templates[0].points=50;
 for(const date of ['2026-09-21','2026-09-26']){
  assert.equal(canBackfill(s,c,date),true);assert.equal(backfillCheckIn(s,c.id,date),10);
  assert.equal(canBackfill(s,c,date),false);assert.throws(()=>backfillCheckIn(s,c.id,date));
 }
 assert.equal(balance(s),20);assert.deepEqual(s.checkins.map(x=>x.date),['2026-09-21','2026-09-26']);
 assert.deepEqual(upgrade(JSON.parse(JSON.stringify(s))),s);
});
test('backfill rejects previous weeks, today, future dates and invalid dates without mutations',t=>{
 const {s,c}=backfillSetup(t,{type:'daily'},'2026-09-14');const before=structuredClone(s);
 for(const date of ['2026-09-20','2026-09-27','2026-09-28','2026-09-31','invalid',null]){
  assert.equal(canBackfill(s,c,date),false);assert.throws(()=>backfillCheckIn(s,c.id,date));
 }
 assert.deepEqual(s,before);checkIn(s,c.id);assert.equal(balance(s),10);
});
test('backfill respects cycle dates and weekday schedules',t=>{
 const {s,c}=backfillSetup(t,{type:'weekdays',days:[3,5]},'2026-09-23','2026-09-25');
 for(const date of ['2026-09-21','2026-09-24','2026-09-26']){
  assert.equal(canBackfill(s,c,date),false);assert.throws(()=>backfillCheckIn(s,c.id,date));
 }
 backfillCheckIn(s,c.id,'2026-09-23');backfillCheckIn(s,c.id,'2026-09-25');
 assert.equal(s.checkins.length,2);validate(s);
});
test('backfill and today share the same weekly quota',t=>{
 const {s,c}=backfillSetup(t,{type:'weekly',times:2});checkIn(s,c.id);
 backfillCheckIn(s,c.id,'2026-09-21');assert.equal(weekProgress(s,c).done,2);
 assert.equal(canBackfill(s,c,'2026-09-22'),false);assert.throws(()=>backfillCheckIn(s,c.id,'2026-09-22'));
 assert.equal(balance(s),20);validate(s);
});
test('backfill reaching weekly quota prevents an extra check-in today',t=>{
 const {s,c}=backfillSetup(t,{type:'weekly',times:1});backfillCheckIn(s,c.id,'2026-09-21');
 assert.equal(canCheckIn(s,c),false);assert.throws(()=>checkIn(s,c.id));assert.equal(s.checkins.length,1);validate(s);
});
test('archived cycles reject backfill',t=>{
 const {s,c}=backfillSetup(t,{type:'daily'},'2026-09-21','2026-09-27');
 for(const status of ['completed','ended']){
  const copy=structuredClone(s);checkIn(copy,c.id);finishCycle(copy,c.id,status);
  assert.equal(canBackfill(copy,copy.cycles[0],'2026-09-21'),false);
  assert.throws(()=>backfillCheckIn(copy,c.id,'2026-09-21'));assert.equal(copy.checkins.length,1);validate(copy);
 }
});
test('Monday rollover rejects a date that was eligible when the dialog opened',t=>{
 const {s,c}=backfillSetup(t,{type:'daily'},'2026-09-21','2026-10-04');
 assert.equal(canBackfill(s,c,'2026-09-26'),true);
 t.mock.timers.setTime(+parseDate('2026-09-28'));
 for(const date of ['2026-09-26','2026-09-27','2026-09-28']){
  assert.equal(canBackfill(s,c,date),false);assert.throws(()=>backfillCheckIn(s,c.id,date));
 }
 checkIn(s,c.id);assert.equal(s.checkins.length,1);validate(s);
});
