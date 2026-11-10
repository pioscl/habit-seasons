import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {initialState,saveReward,redeem} from '../../src/model.js';
import {saveActivity,recordActivity} from '../../src/activity-model.js';
import {LOCAL_DATA_KEY} from '../../src/local-data.js';

// DOM integration only: this does not claim to test real browser layout or focus trapping.
test('activity UI integrates with Today, wallet, history, persistence and backups',async t=>{
 const dom=new JSDOM('<div id="app"></div><dialog id="dialog"></dialog><div id="toast" role="status" aria-live="polite"></div>',{url:'https://example.test/'});
 const {window}=dom,document=window.document;
 for(const key of ['window','document','localStorage','FormData','navigator']){const descriptor=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,value:window[key]});t.after(()=>{if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]})}
 window.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 window.HTMLDialogElement.prototype.close=function(){this.open=false};
 window.scrollTo=()=>{};
 // The app owns a midnight timer; keep it from extending this test process.
 const originalInterval=globalThis.setInterval,originalTimeout=globalThis.setTimeout;
 t.mock.method(globalThis,'setInterval',(...args)=>{const timer=originalInterval(...args);timer.unref();return timer});
 t.mock.method(globalThis,'setTimeout',(...args)=>{const timer=originalTimeout(...args);timer.unref();return timer});
 let clock=0;t.mock.method(performance,'now',()=>clock);
 const get=selector=>{const element=document.querySelector(selector);assert.ok(element,`Missing ${selector}`);return element};
 const click=selector=>get(selector).click();
 const action=name=>`[data-action="${name}"]`;
 const state=()=>JSON.parse(window.localStorage.getItem(LOCAL_DATA_KEY));
 const set=(selector,value)=>{get(selector).value=String(value)};
 const submit=()=>get('[data-activity-form]').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 const reset=(s=initialState())=>{clock+=1000;window.localStorage.setItem(LOCAL_DATA_KEY,JSON.stringify(s));window.dispatchEvent(new window.StorageEvent('storage',{key:LOCAL_DATA_KEY,newValue:JSON.stringify(s)}));click('[data-page="home"]')};
 const create=()=>{click(action('activity-edit'));set('#activity-name','散步');set('#activity-points',5);set('#activity-description','走一会儿');submit()};
 const record=()=>{clock+=1000;click(action('activity-record'))};
 const history=()=>{click('[data-page="history"]');click(action('history-activities'))};
 await import('../../src/app.js');
 await t.test('creation, rapid duplicate clicks, repeat records, snapshots and immediate undo',()=>{
  create();assert.equal(state().activities.length,1);assert.equal(get('.wallet-pill b').textContent,'0');
  record();click(action('activity-record'));assert.equal(state().activityEvents.length,1);
  assert.match(get('.activity-list').textContent,/今天已记录 1 次/);assert.equal(document.activeElement.dataset.action,'activity-record');
  record();assert.equal(state().activityEvents.length,2);assert.equal(get('.wallet-pill b').textContent,'10');
  click('#toast button');assert.equal(state().activityEvents.length,1);assert.equal(get('.wallet-pill b').textContent,'5');
  click(action('activity-detail'));click(action('activity-edit'));set('#activity-name','长距离散步');set('#activity-points',15);submit();record();
  assert.deepEqual(state().activityEvents.map(e=>[e.name,e.points]),[['散步',5],['长距离散步',15]]);
  history();assert.equal(document.querySelectorAll('.activity-history .activity-row').length,2);
  click(action('activity-undo-confirm'));click('#dialog [data-action="activity-undo"]');
  assert.equal(state().activityEvents.length,1);assert.equal(get('.wallet-pill b').textContent,'5');
 });
 await t.test('archiving preserves records and restoration makes the activity available',()=>{
  reset();create();record();click(action('activity-detail'));click(action('activity-edit'));click(action('activity-archive'));
  assert.equal(state().activities[0].archived,true);assert.equal(state().activityEvents.length,1);
  click('#dialog [data-action="close"]');assert.equal(document.querySelector(action('activity-record')),null);
  click(action('activity-manage'));click(action('activity-list-archived'));click(action('activity-restore'));click('#dialog [data-action="close"]');
  record();assert.equal(state().activityEvents.length,2);
 });
 await t.test('insufficient balance leaves the saved record and explains the error',()=>{
  const s=initialState(),a=saveActivity(s,{name:'游泳',icon:'swim',points:15,description:''});recordActivity(s,a.id);redeem(s,saveReward(s,{name:'奖励',cost:10}).id);reset(s);
  const before=state();history();click(action('activity-undo-confirm'));click('#dialog [data-action="activity-undo"]');
  assert.match(get('#form-error').textContent,/余额不足/);assert.deepEqual(state(),before);
 });
 await t.test('unsafe text renders literally and long histories can be expanded',()=>{
  const s=initialState(),name='<img src=x onerror=alert(1)>',a=saveActivity(s,{name,icon:'bike',points:10,description:'<script>alert(1)</script>'});
  for(let i=0;i<31;i++)recordActivity(s,a.id);reset(s);
  assert.equal(get('.activity-copy strong').textContent,name);assert.equal(document.querySelector('.activities-section img'),null);assert.equal(document.querySelector('.activities-section script'),null);
  history();assert.equal(document.querySelectorAll('.activity-history .activity-row').length,30);click(action('activity-more'));assert.equal(document.querySelectorAll('.activity-history .activity-row').length,31);
 });
 await t.test('storage failures do not mint points or consume the duplicate-click guard',()=>{
  reset();create();const before=state();
  const failure=t.mock.method(window.Storage.prototype,'setItem',()=>{throw new Error('quota')});
  record();assert.match(get('#toast').textContent,/保存失败/);assert.deepEqual(state(),before);failure.mock.restore();
  click(action('activity-record'));assert.equal(state().activityEvents.length,1);
 });
 await t.test('another tab refreshes the UI; stale writes are rejected before retry',()=>{
  reset();create();const changed=state();changed.activities[0].name='另一页改名';changed.revision++;
  window.localStorage.setItem(LOCAL_DATA_KEY,JSON.stringify(changed));record();
  assert.equal(state().activityEvents.length,0);assert.match(get('#toast').textContent,/另一个页面更新/);
  click(action('activity-record'));assert.equal(state().activityEvents[0].name,'另一页改名');
  window.dispatchEvent(new window.StorageEvent('storage',{key:LOCAL_DATA_KEY,newValue:JSON.stringify(state())}));
  assert.match(get('.activity-list').textContent,/今天已记录 1 次/);
 });
 await t.test('backup export, clear and restore retain all activity snapshots',async()=>{
  reset();create();record();const saved=state();let exported;
  t.mock.method(URL,'createObjectURL',blob=>{exported=blob;return 'blob:test'});t.mock.method(URL,'revokeObjectURL',()=>{});
  t.mock.method(window.HTMLAnchorElement.prototype,'click',()=>{});
  click('[data-page="settings"]');click(action('export'));const backup=JSON.parse(await exported.text());
  assert.deepEqual(backup.activityEvents,saved.activityEvents);assert.equal(backup.schemaVersion,5);
  click(action('clear-data'));click(action('confirm-clear-data'));assert.equal(window.localStorage.getItem(LOCAL_DATA_KEY),null);
  click('[data-page="settings"]');const input=get('#import-file');Object.defineProperty(input,'files',{value:[{size:1000,text:async()=>JSON.stringify(backup)}]});
  input.dispatchEvent(new window.Event('change',{bubbles:true}));await new Promise(resolve=>setImmediate(resolve));
  assert.match(get('#dialog').textContent,/1 个活动、1 次活动记录/);click(action('confirm-import'));
  assert.deepEqual(state().activityEvents,saved.activityEvents);assert.equal(get('.wallet-pill b').textContent,'5');
 });
 dom.window.close();
});
