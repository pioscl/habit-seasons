import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,validate,upgrade,balance,today,startCycle,checkIn,undoCheckIn,redeem} from '../dist/model.js';
import {createGoal,addGoalProgress,editGoalProgress,changeGoalStatus,changeGoalDeadline,changeGoalIcon,saveGoalMilestone,deleteGoalMilestone,goalProgress,goalEarned,goalPercent,milestoneReached} from '../dist/goal-model.js';
const fields=()=>({title:'LeetCode 100 道',targetValue:100,unit:'题',completionPoints:500,deadline:null,milestones:[{percentage:25,points:50},{percentage:50,points:100},{percentage:80,points:150}]});
function setup(overrides={}){const s=initialState(),g=createGoal(s,{...fields(),...overrides});return {s,id:g.id}}
const goal=(s,id)=>s.goals.find(g=>g.id===id);
function unchanged(s,operation){const before=structuredClone(s);assert.throws(operation);assert.deepEqual(s,before)}

test('goals are independent and require a finite positive target and unit',()=>{
 const s=initialState();for(const change of [{targetValue:0},{targetValue:-1},{targetValue:Infinity},{targetValue:NaN},{targetValue:0.0000001},{targetValue:1000000001},{unit:''},{title:''},{completionPoints:-1},{completionPoints:1.5},{deadline:'2026-02-30'}])unchanged(s,()=>createGoal(s,{...fields(),...change}));
 const {s:state,id}=setup();assert.equal(state.cycles.length,0);assert.equal(goalProgress(goal(state,id)),0);assert.equal(balance(state),0);validate(state);
 const altered=structuredClone(state);altered.goals[0].targetValue=200;assert.throws(()=>validate(altered));
});
test('progress crosses several milestones and completion once, and rewards stack globally',()=>{
 const {s,id}=setup();assert.equal(addGoalProgress(s,id,48).pointsDelta,50);assert.equal(addGoalProgress(s,id,34).pointsDelta,250);
 assert.equal(goalProgress(goal(s,id)),82);assert.equal(balance(s),300);
 assert.equal(addGoalProgress(s,id,18).pointsDelta,500);assert.equal(goal(s,id).status,'completed');assert.ok(goal(s,id).completedAt);assert.equal(balance(s),800);
 unchanged(s,()=>addGoalProgress(s,id,1));assert.equal(goal(s,id).progressEvents.length,3);validate(s);
});
test('one final progress event grants both crossed milestones and completion',()=>{
 const {s,id}=setup();addGoalProgress(s,id,48);assert.equal(addGoalProgress(s,id,52).pointsDelta,750);assert.equal(balance(s),800);validate(s);
});
test('positive progress only, no overshoot, no silent clamping',()=>{
 const {s,id}=setup();addGoalProgress(s,id,37);
 for(const value of [0,-1,Infinity,NaN,0.0000001,64,'3'])unchanged(s,()=>addGoalProgress(s,id,value));
 addGoalProgress(s,id,3);assert.equal(goalProgress(goal(s,id)),40);validate(s);
});
test('decimal quantities reach the exact target without floating-point drift',()=>{
 const {s,id}=setup({targetValue:0.3,unit:'km',milestones:[{percentage:50,points:10}]});
 addGoalProgress(s,id,0.1);addGoalProgress(s,id,0.2);assert.equal(goalProgress(goal(s,id)),0.3);assert.equal(goalPercent(goal(s,id)),100);assert.equal(balance(s),510);validate(s);
 const next=createGoal(s,{...fields(),targetValue:1000000000,milestones:[{percentage:33.333333,points:1}]});
 addGoalProgress(s,next.id,333333329.999999);assert.equal(milestoneReached(goal(s,next.id),goal(s,next.id).milestones[0]),false);
 addGoalProgress(s,next.id,0.000001);assert.equal(milestoneReached(goal(s,next.id),goal(s,next.id).milestones[0]),true);validate(s);
});
test('progress editing recalculates milestones, reopens completion and retains edit history',()=>{
 const {s,id}=setup();addGoalProgress(s,id,100);const eventId=goal(s,id).progressEvents[0].id;
 assert.equal(editGoalProgress(s,id,eventId,70).pointsDelta,-650);assert.equal(balance(s),150);assert.equal(goal(s,id).status,'active');assert.equal(goal(s,id).completedAt,null);
 assert.equal(goal(s,id).milestones[2].firstReachedAt!==null,true);assert.equal(goal(s,id).progressEvents[0].originalValue,100);assert.equal(goal(s,id).progressEvents[0].edits[0].to,70);
 assert.equal(editGoalProgress(s,id,eventId,100).pointsDelta,650);assert.equal(balance(s),800);
 assert.equal(editGoalProgress(s,id,eventId,100).pointsDelta,0);assert.equal(balance(s),800);validate(s);
});
test('spent goal rewards block rollback atomically, including status and edit history',()=>{
 const {s,id}=setup();addGoalProgress(s,id,100);s.rewards[0].cost=400;redeem(s,s.rewards[0].id);
 unchanged(s,()=>editGoalProgress(s,id,goal(s,id).progressEvents[0].id,70));assert.equal(balance(s),400);assert.equal(goal(s,id).status,'completed');validate(s);
});
test('habit income can fund goal reward rollback and goal income can fund habit undo',()=>{
 const {s,id}=setup();addGoalProgress(s,id,100);s.rewards[0].cost=160;redeem(s,s.rewards[0].id);
 const cycle=startCycle(s,s.templates[0].id,today(),today());checkIn(s,cycle.id);
 editGoalProgress(s,id,goal(s,id).progressEvents[0].id,70);assert.equal(balance(s),0);
 unchanged(s,()=>undoCheckIn(s,cycle.id));addGoalProgress(s,id,10);undoCheckIn(s,cycle.id);assert.equal(balance(s),140);validate(s);
});
test('milestones lock forever after first reach, even following rollback',()=>{
 const {s,id}=setup();addGoalProgress(s,id,25);const m=goal(s,id).milestones[0];
 for(const operation of [()=>saveGoalMilestone(s,id,{percentage:30,points:70},m.id),()=>deleteGoalMilestone(s,id,m.id)])unchanged(s,operation);
 editGoalProgress(s,id,goal(s,id).progressEvents[0].id,10);
 unchanged(s,()=>deleteGoalMilestone(s,id,m.id));unchanged(s,()=>saveGoalMilestone(s,id,{percentage:30,points:70},m.id));
 addGoalProgress(s,id,15);assert.equal(balance(s),50);assert.equal(goal(s,id).milestones[0].firstReachedAt,m.firstReachedAt);validate(s);
});
test('unreached milestones can change or be removed, newly crossed thresholds award once',()=>{
 const {s,id}=setup();addGoalProgress(s,id,20);const m=goal(s,id).milestones[0];
 saveGoalMilestone(s,id,{percentage:30,points:60},m.id);assert.equal(balance(s),0);
 deleteGoalMilestone(s,id,m.id);assert.equal(goal(s,id).milestones.length,2);
 assert.equal(saveGoalMilestone(s,id,{percentage:10,points:7}).pointsDelta,7);
 const added=goal(s,id).milestones.at(-1);assert.ok(added.firstReachedAt);unchanged(s,()=>deleteGoalMilestone(s,id,added.id));validate(s);
});
test('invalid or duplicate milestone percentages and invalid points are rejected',()=>{
 const {s,id}=setup();for(const percentage of [0,100,-1,101,25,NaN,0.0000001])unchanged(s,()=>saveGoalMilestone(s,id,{percentage,points:1}));
 unchanged(s,()=>saveGoalMilestone(s,id,{percentage:30,points:-1}));unchanged(s,()=>createGoal(s,{...fields(),milestones:[{percentage:100,points:1}]}));
});
test('pause, abandon and resume preserve progress, points, dates and complete lifecycle history',()=>{
 const {s,id}=setup({deadline:'2026-01-01'});addGoalProgress(s,id,30);const original=structuredClone(goal(s,id));
 changeGoalStatus(s,id,'paused');unchanged(s,()=>addGoalProgress(s,id,1));changeGoalStatus(s,id,'abandoned');unchanged(s,()=>addGoalProgress(s,id,1));changeGoalStatus(s,id,'active');
 assert.equal(goalProgress(goal(s,id)),30);assert.equal(goal(s,id).deadline,original.deadline);assert.deepEqual(goal(s,id).progressEvents,original.progressEvents);assert.equal(balance(s),50);
 assert.deepEqual(goal(s,id).history.filter(e=>e.type==='status').map(e=>e.to),['paused','abandoned','active']);validate(s);
});
test('manual completion and unsupported state transitions are rejected',()=>{
 const {s,id}=setup();unchanged(s,()=>changeGoalStatus(s,id,'completed'));changeGoalStatus(s,id,'abandoned');unchanged(s,()=>changeGoalStatus(s,id,'paused'));
 changeGoalStatus(s,id,'active');addGoalProgress(s,id,100);unchanged(s,()=>changeGoalStatus(s,id,'active'));unchanged(s,()=>changeGoalStatus(s,id,'abandoned'));
});
test('history edits work on paused or abandoned goals and may correct a goal to completion',()=>{
 for(const status of ['paused','abandoned']){
  const {s,id}=setup();addGoalProgress(s,id,30);changeGoalStatus(s,id,status);editGoalProgress(s,id,goal(s,id).progressEvents[0].id,20);assert.equal(goal(s,id).status,status);
  editGoalProgress(s,id,goal(s,id).progressEvents[0].id,100);assert.equal(goal(s,id).status,'completed');assert.equal(balance(s),800);validate(s);
 }
});
test('deadline changes preserve original date and all changes, expiry has no side effects',()=>{
 const {s,id}=setup({deadline:'2026-01-01'});assert.equal(goal(s,id).status,'active');changeGoalDeadline(s,id,'2026-10-20');changeGoalDeadline(s,id,'2026-10-31');
 changeGoalStatus(s,id,'paused');assert.equal(goal(s,id).deadline,'2026-10-31');
 assert.equal(goal(s,id).history[0].deadline,'2026-01-01');assert.deepEqual(goal(s,id).history.filter(e=>e.type==='deadline').map(e=>[e.from,e.to]),[['2026-01-01','2026-10-20'],['2026-10-20','2026-10-31']]);
 changeGoalDeadline(s,id,null);assert.equal(goal(s,id).deadline,null);validate(s);
});
test('zero point goals and milestones still complete and lock correctly',()=>{
 const {s,id}=setup({completionPoints:0,milestones:[{percentage:50,points:0}]});addGoalProgress(s,id,100);assert.equal(goal(s,id).status,'completed');assert.ok(goal(s,id).milestones[0].firstReachedAt);assert.equal(balance(s),0);validate(s);
});
test('v2 backups migrate without losing habits, check-ins, redemptions or balance',()=>{
 const s=initialState(),c=startCycle(s,s.templates[0].id,today(),today());checkIn(s,c.id);s.rewards[0].cost=5;redeem(s,s.rewards[0].id);s.schemaVersion=2;delete s.goals;
 const original=structuredClone(s),next=upgrade(s);assert.deepEqual(s,original);assert.equal(next.schemaVersion,3);assert.deepEqual(next.goals,[]);assert.deepEqual(next.checkins,s.checkins);assert.deepEqual(next.redemptions,s.redemptions);assert.equal(balance(next),5);
});
test('goal backup roundtrip preserves progress edits, rollback, rewards and all history',()=>{
 const {s,id}=setup();addGoalProgress(s,id,100);editGoalProgress(s,id,goal(s,id).progressEvents[0].id,60);changeGoalStatus(s,id,'paused');changeGoalDeadline(s,id,'2027-01-01');
 assert.deepEqual(upgrade(JSON.parse(JSON.stringify(s))),s);
});
test('inconsistent imported goal state, unlocked milestones and rewards are rejected',()=>{
 const {s,id}=setup();addGoalProgress(s,id,100);
 const mutations=[g=>g.targetValue=200,g=>g.completionPoints=999,g=>g.status='active',g=>g.completedAt=null,g=>g.deadline='2028-01-01',g=>g.progressEvents[0].value=50,g=>g.progressEvents.push({...g.progressEvents[0]}),g=>g.milestones[0].points=999,g=>g.milestones[0].firstReachedAt=null,g=>g.milestones.shift(),g=>g.history.pop(),g=>g.history.at(-1).delta=10000];
 for(const mutate of mutations){const copy=structuredClone(s);mutate(copy.goals[0]);assert.throws(()=>validate(copy))}
 const copy=structuredClone(s);copy.goals[0].progressEvents[0].edits.push({from:99,to:100,at:new Date().toISOString()});assert.throws(()=>validate(copy));
});


test('goal icons survive backups, accept legacy goals, and never alter completed progress or rewards',()=>{
 const {s,id}=setup({icon:'code'});addGoalProgress(s,id,100);
 assert.equal(upgrade(JSON.parse(JSON.stringify(s))).goals[0].icon,'code');
 const before=structuredClone(s);changeGoalIcon(s,id,'book');
 const expected=structuredClone(before);expected.goals[0].icon='book';assert.deepEqual(s,expected);
 assert.equal(balance(s),balance(before));validate(s);
 const legacy=structuredClone(s);delete legacy.goals[0].icon;
 assert.doesNotThrow(()=>upgrade(legacy));assert.equal(createGoal(s,fields()).icon,'target');
 for(const icon of ['unknown','__proto__',null,42,['book']]){
  unchanged(s,()=>changeGoalIcon(s,id,icon));unchanged(s,()=>createGoal(s,{...fields(),icon}));
  const corrupt=structuredClone(s);corrupt.goals[0].icon=icon;assert.throws(()=>upgrade(corrupt));
 }
});
