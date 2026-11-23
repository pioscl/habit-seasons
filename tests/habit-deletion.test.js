import test from 'node:test';
import assert from 'node:assert/strict';
import {populatedState} from './fixtures.js';
import {parseDate,today,shiftDate,startCycle,checkIn,finishCycle,habitDeletionImpact,deleteCycle,deleteTemplate,balance,weeklyAwards,saveReward,redeem,validate,upgrade} from '../src/model.js';
import {createGoal,addGoalProgress} from '../src/goal-model.js';

function setup(t){t.mock.timers.enable({apis:['Date'],now:parseDate('2026-09-21')});return populatedState()}
const begin=(s,id=s.templates[0].id,end=today(),rules={})=>startCycle(s,id,today(),end,{type:'daily'},rules);
function unchanged(s,fn,pattern){const before=structuredClone(s);assert.throws(fn,pattern);assert.deepEqual(s,before)}

test('deleting an empty active, future or expired cycle leaves the template reusable',t=>{
 const s=setup(t),templateId=s.templates[0].id,templates=structuredClone(s.templates);
 for(const start of [today(),shiftDate(today(),3)]){
  const c=startCycle(s,templateId,start,shiftDate(start,6));
  assert.deepEqual(deleteCycle(s,c.id),{cycleCount:1,checkinCount:0,points:0,balanceAfter:0});
  assert.deepEqual(s.templates,templates);assert.equal(s.cycles.length,0);validate(s);
 }
 const c=begin(s);t.mock.timers.setTime(+parseDate('2026-09-22'));
 deleteCycle(s,c.id);assert.equal(s.cycles.length,0);begin(s);validate(s);
});

test('deleting a partial week rolls back only earned points and preserves other periods',t=>{
 const s=setup(t),old=begin(s);checkIn(s,old.id);finishCycle(s,old.id,'completed');
 const c=begin(s,old.templateId,shiftDate(today(),6),{weeklyBonusPoints:40});checkIn(s,c.id);
 const other=begin(s,s.templates[1].id);checkIn(s,other.id);
 const before=structuredClone(s),impact=habitDeletionImpact(s,'cycle',c.id);
 assert.deepEqual(s,before);assert.deepEqual(impact,{cycleCount:1,checkinCount:1,points:10,balanceAfter:30});
 assert.deepEqual(deleteCycle(s,c.id),impact);
 assert.deepEqual(s.cycles,before.cycles.filter(x=>x.id!==c.id));
 assert.deepEqual(s.checkins,before.checkins.filter(x=>x.cycleId!==c.id));
 assert.deepEqual(s.templates,before.templates);assert.equal(balance(s),30);
 assert.deepEqual(upgrade(JSON.parse(JSON.stringify(s))),s);
 begin(s,c.templateId);validate(s);
});

test('deleting a cycle revokes every awarded week, including partial boundary weeks',t=>{
 const s=setup(t),c=startCycle(s,s.templates[0].id,today(),'2026-09-28',{type:'weekly',times:1},{points:13,weeklyBonusPoints:17});
 checkIn(s,c.id);t.mock.timers.setTime(+parseDate('2026-09-28'));checkIn(s,c.id);
 assert.equal(balance(s),60);assert.equal(weeklyAwards(s).length,2);
 assert.equal(deleteCycle(s,c.id).points,60);assert.equal(balance(s),0);
 assert.equal(s.checkins.length,0);assert.deepEqual(weeklyAwards(s),[]);validate(s);
});

test('unused templates can be permanently deleted whether available or disabled',t=>{
 const s=setup(t);for(const archived of [false,true]){
  const target=s.templates[0];target.archived=archived;
  assert.deepEqual(deleteTemplate(s,target.id),{cycleCount:0,checkinCount:0,points:0,balanceAfter:0});
  assert.equal(s.templates.some(x=>x.id===target.id),false);validate(s);
 }
});

test('template deletion removes its active and all archived cycles without touching unrelated data',t=>{
 const s=setup(t),id=s.templates[0].id,rules={points:13,weeklyBonusPoints:7};
 for(const status of ['completed','failed','ended','active']){
  const c=begin(s,id,today(),rules);
  if(status!=='failed')checkIn(s,c.id);
  if(status!=='active')finishCycle(s,c.id,status==='ended'?'ended':'completed');
 }
 const other=begin(s,s.templates[1].id);checkIn(s,other.id);finishCycle(s,other.id,'completed');
 s.templates[0].archived=true;
 const before=structuredClone(s);
 assert.deepEqual(deleteTemplate(s,id),{cycleCount:4,checkinCount:3,points:60,balanceAfter:20});
 assert.deepEqual(s.cycles,[other]);assert.deepEqual(s.templates,before.templates.slice(1));
 assert.deepEqual(s.checkins,before.checkins.filter(x=>x.cycleId===other.id));
 for(const key of ['rewards','redemptions','goals','lastExportAt','schemaVersion'])assert.deepEqual(s[key],before[key]);
 assert.deepEqual(upgrade(JSON.parse(JSON.stringify(s))),s);
});

test('spent weekly bonuses block both deletions atomically even when base points are affordable',t=>{
 const s=setup(t),c=begin(s,s.templates[0].id,today(),{weeklyBonusPoints:20});checkIn(s,c.id);
 redeem(s,saveReward(s,{name:'已兑换',cost:15}).id);assert.equal(balance(s),15);
 assert.equal(habitDeletionImpact(s,'cycle',c.id).balanceAfter,-15);
 unchanged(s,()=>deleteCycle(s,c.id),/余额不足/);
 unchanged(s,()=>deleteTemplate(s,c.templateId),/余额不足/);validate(s);
});

test('unrelated goal income can fund deletion and existing redemption records remain intact',t=>{
 const s=setup(t),c=begin(s);checkIn(s,c.id);
 redeem(s,saveReward(s,{name:'已兑换',cost:10}).id);
 const goal=createGoal(s,{title:'目标',targetValue:1,unit:'次',completionPoints:10,deadline:null,milestones:[]});
 addGoalProgress(s,goal.id,1);const before=structuredClone(s);
 deleteTemplate(s,c.templateId);assert.equal(balance(s),0);
 for(const key of ['goals','rewards','redemptions'])assert.deepEqual(s[key],before[key]);validate(s);
});

test('invalid IDs, deletion kinds and archived single-cycle deletion fail without mutation',t=>{
 const s=setup(t),c=begin(s);checkIn(s,c.id);finishCycle(s,c.id,'completed');
 unchanged(s,()=>deleteCycle(s,'missing'),/不存在/);
 unchanged(s,()=>deleteTemplate(s,'missing'),/不存在/);
 unchanged(s,()=>habitDeletionImpact(s,'invalid',c.id),/类型无效/);
 unchanged(s,()=>deleteCycle(s,c.id),/只能删除进行中/);
 deleteTemplate(s,c.templateId);unchanged(s,()=>deleteTemplate(s,c.templateId),/不存在/);validate(s);
});
