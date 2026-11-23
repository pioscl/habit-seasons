import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {populatedState} from '../fixtures.js';
import {parseDate,today,shiftDate,startCycle,checkIn,finishCycle,saveReward,redeem,validate} from '../../src/model.js';
import {LOCAL_DATA_KEY} from '../../src/local-data.js';

// DOM integration covers persistence and event wiring; browser QA covers layout and native dialogs.
test('habit deletion requires explicit, current confirmation and persists consistent records',async t=>{
 t.mock.timers.enable({apis:['Date'],now:parseDate('2026-09-21')});
 const dom=new JSDOM('<div id="app"></div><dialog id="dialog"></dialog><div id="toast" role="status"></div>',{url:'https://example.test/'});
 const {window}=dom,document=window.document;
 for(const key of ['window','document','localStorage','FormData','navigator']){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,key);
  Object.defineProperty(globalThis,key,{configurable:true,value:window[key]});
  t.after(()=>{if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]});
 }
 t.after(()=>dom.window.close());
 window.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 window.HTMLDialogElement.prototype.close=function(){this.open=false};window.scrollTo=()=>{};
 const interval=globalThis.setInterval,timeout=globalThis.setTimeout;
 t.mock.method(globalThis,'setInterval',(...args)=>{const timer=interval(...args);timer.unref();return timer});
 t.mock.method(globalThis,'setTimeout',(...args)=>{const timer=timeout(...args);timer.unref();return timer});
 const get=selector=>{const element=document.querySelector(selector);assert.ok(element,`Missing ${selector}`);return element};
 const click=selector=>get(selector).click();
 const action=(name,id)=>`[data-action="${name}"]${id?`[data-id="${id}"]`:''}`;
 const state=()=>JSON.parse(localStorage.getItem(LOCAL_DATA_KEY));
 const reset=s=>{localStorage.setItem(LOCAL_DATA_KEY,JSON.stringify(s));window.dispatchEvent(new window.StorageEvent('storage',{key:LOCAL_DATA_KEY,newValue:JSON.stringify(s)}));click('[data-page="home"]')};
 const fixture=({future=false,bonus=20}={})=>{
  const s=populatedState(),start=shiftDate(today(),future?3:0),c=startCycle(s,s.templates[0].id,start,start,{type:'daily'},{weeklyBonusPoints:bonus});
  if(!future)checkIn(s,c.id);return{s,c};
 };
 const openCycle=id=>{click('[data-page="home"]');click(action('habit-view','detail'));click(action('detail',id));click(action('delete-cycle',id))};
 const openTemplate=(id,archived=false)=>{click('[data-page="templates"]');click(action(archived?'templates-archived':'templates-active'));click(action('edit-template',id));click(action('delete-template',id))};
 await import('../../src/app.js');

 await t.test('new templates have no delete button; cancelling leaves a template and its data intact',()=>{
  const {s}=fixture();reset(s);click('[data-page="templates"]');click(action('edit-template'));
  assert.equal(document.querySelector(action('delete-template')),null);click('#dialog [data-action="close"]');
  const before=state();openTemplate(s.templates[0].id);
  assert.match(get('#dialog').textContent,/全部 1 期记录/);assert.match(get('#dialog').textContent,/1 次打卡，扣回 30 pts/);
  assert.equal(document.activeElement.textContent,'取消');click('.modal-actions [data-action="close"]');assert.deepEqual(state(),before);
 });
 await t.test('deleting a checked-in cycle removes only that cycle and its bonus, then allows restart',()=>{
  const {s,c}=fixture(),id=c.templateId;finishCycle(s,c.id,'completed');
  const active=startCycle(s,id,today(),today(),{type:'daily'},{weeklyBonusPoints:7});checkIn(s,active.id);reset(s);
  openCycle(active.id);assert.match(get('#dialog').textContent,/扣回 17 pts/);assert.match(get('#dialog').textContent,/删除后可用积分 30 pts/);
  click(action('confirm-delete-habit'));const saved=state();assert.deepEqual(saved.cycles,[c]);assert.equal(saved.checkins.length,1);
  assert.deepEqual(saved.templates,s.templates);assert.equal(get('.wallet-pill b').textContent,'30');validate(saved);assert.equal(get('#dialog').open,false);
  click('[data-page="templates"]');click(action('templates-active'));click(action('start',id));
  get('#start-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(state().cycles.length,2);assert.equal(state().cycles[1].status,'active');validate(state());
 });
 await t.test('not-yet-started and expired unarchived cycles expose deletion',()=>{
  const {s,c}=fixture({future:true});reset(s);openCycle(c.id);click(action('confirm-delete-habit'));assert.equal(state().cycles.length,0);
  const expired=fixture({bonus:0});expired.c.startDate=shiftDate(today(),-1);expired.c.endDate=expired.c.startDate;expired.s.checkins[0].date=expired.c.startDate;
  reset(expired.s);openCycle(expired.c.id);click(action('confirm-delete-habit'));assert.equal(state().cycles.length,0);validate(state());
 });
 await t.test('deleting an archived template removes all its periods and escapes its name',()=>{
  const {s,c}=fixture();finishCycle(s,c.id,'completed');
  const active=startCycle(s,c.templateId,today(),shiftDate(today(),6));checkIn(s,active.id);
  s.templates[0].name='<img src=x onerror=alert(1)>';s.templates[0].archived=true;reset(s);
  openTemplate(c.templateId,true);assert.match(get('#dialog').textContent,/全部 2 期记录/);
  assert.match(get('#dialog').textContent,/2 次打卡，扣回 40 pts/);assert.equal(document.querySelector('#dialog img'),null);
  click(action('confirm-delete-habit'));assert.equal(state().templates.length,2);assert.equal(state().cycles.length,0);assert.equal(state().checkins.length,0);
  assert.equal(get('.wallet-pill b').textContent,'0');validate(state());
 });
 await t.test('insufficient balance explains the cost and disables confirmation',()=>{
  const {s,c}=fixture();redeem(s,saveReward(s,{name:'奖励',cost:15}).id);reset(s);const before=state();
  for(const open of [()=>openCycle(c.id),()=>openTemplate(c.templateId)]){
   open();assert.match(get('#dialog').textContent,/当前余额 15 pts，不足/);assert.equal(get(action('confirm-delete-habit')).disabled,true);
   click(action('confirm-delete-habit'));assert.deepEqual(state(),before);click('#dialog [data-action="close"]');
  }
 });
 await t.test('storage failure preserves all data and permits a successful retry',()=>{
  const {s,c}=fixture();reset(s);openCycle(c.id);const before=state();
  const failure=t.mock.method(window.Storage.prototype,'setItem',()=>{throw new Error('quota')});
  click(action('confirm-delete-habit'));assert.match(get('#form-error').textContent,/保存失败/);assert.deepEqual(state(),before);assert.equal(get('#dialog').open,true);
  failure.mock.restore();click(action('confirm-delete-habit'));assert.equal(state().cycles.length,0);validate(state());
 });
 await t.test('unobserved changes in another tab require a fresh confirmation with updated scope',()=>{
  const {s,c}=fixture();reset(s);openTemplate(c.templateId);
  const changed=state();finishCycle(changed,c.id,'completed');startCycle(changed,c.templateId,today(),today());changed.revision++;
  localStorage.setItem(LOCAL_DATA_KEY,JSON.stringify(changed));click(action('confirm-delete-habit'));
  assert.deepEqual(state(),changed);assert.equal(get('#dialog').open,false);assert.match(get('#toast').textContent,/记录已更新/);
  openTemplate(c.templateId);assert.match(get('#dialog').textContent,/全部 2 期记录/);
  click(action('confirm-delete-habit'));assert.equal(state().cycles.length,0);validate(state());
 });
 await t.test('a storage event closes an open confirmation and refreshes the displayed balance',()=>{
  const {s,c}=fixture();reset(s);openCycle(c.id);const changed=state();changed.templates[0].name='另一页修改';changed.revision++;
  reset(changed);assert.equal(get('#dialog').open,false);assert.deepEqual(state(),changed);
 });
 await t.test('export after deletion contains neither the deleted template nor dangling records',async()=>{
  const {s,c}=fixture();reset(s);openTemplate(c.templateId);click(action('confirm-delete-habit'));let exported;
  t.mock.method(URL,'createObjectURL',blob=>{exported=blob;return 'blob:test'});t.mock.method(URL,'revokeObjectURL',()=>{});
  t.mock.method(window.HTMLAnchorElement.prototype,'click',()=>{});click('[data-page="settings"]');click(action('export'));
  const backup=JSON.parse(await exported.text());assert.equal(backup.templates.some(x=>x.id===c.templateId),false);
  assert.equal(backup.cycles.length,0);assert.equal(backup.checkins.length,0);validate(backup);
 });
});
