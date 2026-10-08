import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,startCycle,checkIn,today,balance,upgrade,validate,saveReward,archiveReward,rewardAvailable,rewardRedeemed,redeem} from '../dist/model.js';
function funded(){const s=initialState();s.templates[0].points=1000;const c=startCycle(s,s.templates[0].id,today(),today());checkIn(s,c.id);return s}
function unchanged(s,fn){const before=structuredClone(s);assert.throws(fn);assert.deepEqual(s,before)}
test('a reward can be redeemed once, then becomes read-only and cannot be restored',()=>{
 const s=funded(),r=saveReward(s,{name:'买一本书',cost:100});
 assert.equal(rewardAvailable(s,r),true);redeem(s,r.id);
 assert.equal(balance(s),900);assert.equal(rewardAvailable(s,r),false);assert.equal(rewardRedeemed(s,r.id),true);
 unchanged(s,()=>redeem(s,r.id));
 unchanged(s,()=>saveReward(s,{name:'另一本书',cost:50},r.id));
 unchanged(s,()=>archiveReward(s,r.id));unchanged(s,()=>archiveReward(s,r.id,false));
 assert.deepEqual(upgrade(JSON.parse(JSON.stringify(s))),s);
});
test('new rewards with the same name are independent instances and spend points separately',()=>{
 const s=funded(),first=saveReward(s,{name:'看电影',cost:100});redeem(s,first.id);
 const second=saveReward(s,{name:'看电影',cost:200});
 assert.notEqual(first.id,second.id);assert.equal(rewardAvailable(s,second),true);
 saveReward(s,{name:'看电影',cost:150},second.id);redeem(s,second.id);
 assert.deepEqual(s.redemptions.map(r=>r.cost),[100,150]);assert.equal(balance(s),750);validate(s);
});
test('unredeemed rewards can be edited, put away and restored without spending points',()=>{
 const s=funded(),r=saveReward(s,{name:'  买游戏  ',cost:600});
 assert.equal(r.name,'买游戏');archiveReward(s,r.id);assert.equal(rewardAvailable(s,r),false);
 unchanged(s,()=>redeem(s,r.id));archiveReward(s,r.id,false);
 saveReward(s,{name:'买游戏 DLC',cost:200},r.id);assert.equal(balance(s),1000);
 redeem(s,r.id);assert.equal(s.redemptions[0].name,'买游戏 DLC');assert.equal(balance(s),800);
});
test('legacy repeated redemptions preserve snapshots and balance but cannot be repeated again',()=>{
 const s=funded(),r=s.rewards[0],at=new Date().toISOString();
 s.redemptions=[{id:'old1',rewardId:r.id,name:'买一本书',cost:100,redeemedAt:at},{id:'old2',rewardId:r.id,name:'买两本书',cost:200,redeemedAt:at}];
 r.name='旧模板的新名称';r.cost=500;r.archived=true;
 const before=structuredClone(s),restored=upgrade(JSON.parse(JSON.stringify(s)));
 assert.deepEqual(restored,before);assert.equal(balance(restored),700);
 assert.equal(rewardAvailable(restored,restored.rewards[0]),false);
 assert.equal(rewardAvailable(restored,restored.rewards[1]),true);
 unchanged(restored,()=>redeem(restored,r.id));unchanged(restored,()=>archiveReward(restored,r.id,false));
 const fresh=saveReward(restored,{name:'买一本书',cost:100});redeem(restored,fresh.id);
 assert.equal(balance(restored),600);assert.deepEqual(restored.redemptions.slice(0,2),before.redemptions);validate(restored);
});
test('failed edits and insufficient funds leave instances and redemptions intact',()=>{
 const s=initialState(),r=s.rewards[0];
 for(const fields of [{name:'',cost:100},{name:'书',cost:0},{name:'书',cost:1.5},{name:'书',cost:1000001}]){
  unchanged(s,()=>saveReward(s,fields));unchanged(s,()=>saveReward(s,fields,r.id));
 }
 unchanged(s,()=>saveReward(s,{name:'书',cost:100},'missing'));
 unchanged(s,()=>redeem(s,r.id));assert.equal(rewardAvailable(s,r),true);
});
