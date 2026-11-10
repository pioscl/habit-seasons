import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,upgrade,validate,balance,earnedPoints,saveReward,redeem,startCycle,checkIn,undoCheckIn,today,dayPlanSummary} from '../src/model.js';
import {saveActivity,recordActivity,undoActivity,archiveActivity} from '../src/activity-model.js';
import {createGoal,addGoalProgress} from '../src/goal-model.js';
import {populatedState} from './fixtures.js';
const fields={name:'散步',icon:'run',points:5,description:'出门走一会儿'};
const unchanged=(s,fn)=>{const before=structuredClone(s);assert.throws(fn);assert.deepEqual(s,before)};

test('activities repeat on the same day without creating habits or goals',()=>{
 const s=initialState(),a=saveActivity(s,fields),before=dayPlanSummary(s,[]);
 const first=recordActivity(s,a.id),second=recordActivity(s,a.id);
 assert.notEqual(first.id,second.id);assert.equal(first.date,today());
 assert.equal(balance(s),10);assert.equal(earnedPoints(s),10);
 assert.deepEqual(s.cycles,[]);assert.deepEqual(s.goals,[]);assert.deepEqual(s.checkins,[]);
 assert.deepEqual(dayPlanSummary(s,[]),before);validate(s);
});
test('edits preserve historical names, icons and points; undo uses the original award',()=>{
 const s=initialState(),a=saveActivity(s,fields),old=recordActivity(s,a.id),snapshot=structuredClone(old);
 saveActivity(s,{...fields,name:'长距离散步',icon:'leaf',points:15},a.id);
 recordActivity(s,a.id);assert.deepEqual(s.activityEvents[0],snapshot);assert.equal(balance(s),20);
 undoActivity(s,old.id);assert.equal(balance(s),15);assert.equal(s.activityEvents.length,1);
 unchanged(s,()=>undoActivity(s,old.id));validate(s);
});
test('archive preserves history and balance; restoring allows new records',()=>{
 const s=initialState(),a=saveActivity(s,fields),event=recordActivity(s,a.id);
 archiveActivity(s,a.id);assert.equal(balance(s),5);assert.equal(s.activityEvents.length,1);
 unchanged(s,()=>recordActivity(s,a.id));undoActivity(s,event.id);assert.equal(balance(s),0);
 archiveActivity(s,a.id,false);recordActivity(s,a.id);validate(s);
});
test('activity rewards fund redemption and spent points prevent undo atomically',()=>{
 const s=initialState(),a=saveActivity(s,fields),e=recordActivity(s,a.id),r=saveReward(s,{name:'小奖励',cost:3});
 redeem(s,r.id);assert.equal(balance(s),2);unchanged(s,()=>undoActivity(s,e.id));
 recordActivity(s,a.id);undoActivity(s,e.id);assert.equal(balance(s),2);validate(s);
});
test('activities, habits and goals share the wallet without changing habit completion',()=>{
 const s=populatedState(),a=saveActivity(s,fields),event=recordActivity(s,a.id);
 const c=startCycle(s,s.templates[0].id,today(),today());checkIn(s,c.id);
 const r=saveReward(s,{name:'奖励',cost:10});redeem(s,r.id);
 unchanged(s,()=>undoCheckIn(s,c.id));
 const g=createGoal(s,{title:'读书',targetValue:1,unit:'页',completionPoints:20,milestones:[]});
 addGoalProgress(s,g.id,1);undoCheckIn(s,c.id);undoActivity(s,event.id);
 assert.equal(balance(s),10);assert.equal(s.goals[0].status,'completed');validate(s);
});
test('v4 migration preserves every existing collection and balance and never mutates the input',()=>{
 const s=populatedState(),c=startCycle(s,s.templates[0].id,today(),today());checkIn(s,c.id);
 s.schemaVersion=4;delete s.activities;delete s.activityEvents;
 const before=structuredClone(s),next=upgrade(s);
 assert.equal(next.schemaVersion,5);assert.deepEqual(next.activities,[]);assert.deepEqual(next.activityEvents,[]);
 for(const key of Object.keys(s))if(key!=='schemaVersion')assert.deepEqual(next[key],s[key]);
 assert.equal(balance(next),balance(s));assert.deepEqual(s,before);
});
test('backups retain archived activities, snapshots and repeated records without awarding again',()=>{
 const s=initialState(),a=saveActivity(s,{...fields,name:'<script>文字</script>'});
 recordActivity(s,a.id);recordActivity(s,a.id);archiveActivity(s,a.id);
 const copy=upgrade(JSON.parse(JSON.stringify(s)));assert.deepEqual(copy,s);assert.equal(balance(copy),10);
 assert.deepEqual(upgrade(copy),copy);
});
test('invalid fields, missing IDs and invalid imports are rejected',()=>{
 const s=initialState(),a=saveActivity(s,fields);recordActivity(s,a.id);
 for(const patch of [{name:''},{name:'字'.repeat(61)},{points:0},{points:1.5},{points:1001},{icon:'__proto__'},{description:null},{description:'字'.repeat(201)}]){
  unchanged(s,()=>saveActivity(s,{...fields,...patch}));unchanged(s,()=>saveActivity(s,{...fields,...patch},a.id));
 }
 unchanged(s,()=>saveActivity(s,fields,'missing'));unchanged(s,()=>recordActivity(s,'missing'));unchanged(s,()=>archiveActivity(s,a.id,'yes'));
 for(const change of [x=>delete x.activities,x=>delete x.activityEvents,x=>x.activities.push({...x.activities[0]}),x=>x.activityEvents.push({...x.activityEvents[0]}),x=>x.activityEvents[0].activityId='missing',x=>x.activityEvents[0].points=-1,x=>x.activityEvents[0].points=1.5,x=>x.activityEvents[0].date='2026-02-30',x=>x.activityEvents[0].date='9999-01-01',x=>x.activityEvents[0].createdAt='2026-02-30T00:00:00.000Z',x=>x.activityEvents[0].createdAt='not a date',x=>x.activityEvents[0].id='bad"id',x=>x.activityEvents[0].icon='missing']){
  const copy=structuredClone(s);change(copy);assert.throws(()=>upgrade(copy));
 }
});
