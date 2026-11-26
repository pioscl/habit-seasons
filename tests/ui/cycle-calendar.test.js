import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {populatedState} from '../fixtures.js';
import {parseDate,startCycle,checkIn,finishCycle,validate} from '../../src/model.js';
import {LOCAL_DATA_KEY} from '../../src/local-data.js';

test('cycle details show four aligned weeks, earned history highlighting and the full record list',async t=>{
 t.mock.timers.enable({apis:['Date'],now:parseDate('2026-11-01')});
 const s=populatedState(),c=startCycle(s,s.templates[0].id,'2026-11-01','2026-12-31',{type:'weekly',times:3});
 for(const date of ['2026-11-01','2026-11-16','2026-11-18','2026-11-22','2026-11-23','2026-11-24','2026-11-25']){
  t.mock.timers.setTime(+parseDate(date));checkIn(s,c.id);
 }
 validate(s);
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
 localStorage.setItem(LOCAL_DATA_KEY,JSON.stringify(s));
 const before=localStorage.getItem(LOCAL_DATA_KEY);
 await import('../../src/app.js');
 document.querySelector('[data-action="habit-view"][data-id="detail"]').click();
 document.querySelector(`[data-action="detail"][data-id="${c.id}"]`).click();
 const weeks=[...document.querySelectorAll('.cycle-calendar-week')];
 assert.equal(document.querySelector('#cycle-calendar-title').textContent,'最近 4 周');
 assert.equal(weeks.length,4);assert.equal(document.querySelectorAll('.cycle-calendar-day').length,28);
 assert.deepEqual([...document.querySelectorAll('.cycle-calendar-weekdays span')].map(x=>x.textContent),['一','二','三','四','五','六','日']);
 assert.match(weeks[0].getAttribute('aria-label'),/^2026-11-02 至 2026-11-08/);
 assert.equal(document.querySelectorAll('.cycle-calendar-week.is-complete').length,1);
 assert.match(weeks[2].textContent,/已达标 · 3 \/ 3/);assert.match(weeks[3].textContent,/本周 · 3 \/ 3/);
 assert.equal(weeks[3].classList.contains('is-complete'),false);
 assert.equal(document.querySelectorAll('.cycle-calendar-day.hit').length,6);
 assert.equal(document.querySelectorAll('.cycle-calendar-day.is-future').length,4);
 assert.equal(document.querySelector('[aria-current="date"]').getAttribute('title'),'2026-11-25 · 已打卡');
 assert.equal(document.querySelector('.cycle-calendar-section .meta').textContent,'6 次记录');
 assert.match(document.querySelector('.record-logs').closest('details').textContent,/全部 7 次记录/);
 assert.equal(document.querySelectorAll('.record-logs>.row').length,7);
 assert.equal(localStorage.getItem(LOCAL_DATA_KEY),before);

 const button=name=>document.querySelector(`[data-action="cycle-calendar-${name}"]`);
 const range=()=>document.querySelector('.cycle-calendar-range').textContent;
 assert.equal(button('next').disabled,true);assert.equal(button('current').disabled,true);assert.equal(button('previous').disabled,false);
 document.querySelector('#dialog').scrollTop=37;button('previous').click();
 assert.equal(document.querySelector('#cycle-calendar-title').textContent,'4 周记录');
 assert.equal(range(),'2026.10.26 — 2026.11.22');assert.equal(document.querySelector('.cycle-calendar-section .meta').textContent,'4 次记录');
 assert.equal(document.querySelectorAll('.cycle-calendar-day.hit').length,4);assert.equal(document.querySelectorAll('.cycle-calendar-week.is-complete').length,2);
 assert.equal(button('previous').disabled,true);assert.equal(button('next').disabled,false);assert.equal(button('current').disabled,false);
 assert.equal(document.querySelector('#dialog').scrollTop,37);assert.equal(document.activeElement.className,'cycle-calendar-range');
 button('previous').click();assert.equal(range(),'2026.10.26 — 2026.11.22');
 button('next').click();assert.equal(range(),'2026.11.02 — 2026.11.29');assert.equal(button('next').disabled,true);
 button('previous').click();button('current').click();assert.equal(range(),'2026.11.02 — 2026.11.29');
 button('previous').click();document.querySelector('#dialog [data-action="close"]').click();
 document.querySelector(`[data-action="detail"][data-id="${c.id}"]`).click();
 assert.equal(range(),'2026.11.02 — 2026.11.29');assert.equal(localStorage.getItem(LOCAL_DATA_KEY),before);

 // Recording today while browsing history retains the viewed range.
 const withoutToday=structuredClone(s);withoutToday.checkins=withoutToday.checkins.filter(event=>event.date!=='2026-11-25');withoutToday.revision++;
 let changed=JSON.stringify(withoutToday);localStorage.setItem(LOCAL_DATA_KEY,changed);
 window.dispatchEvent(new window.StorageEvent('storage',{key:LOCAL_DATA_KEY,newValue:changed}));
 document.querySelector(`[data-action="detail"][data-id="${c.id}"]`).click();button('previous').click();
 document.querySelector('[data-action="record-check"]').click();
 assert.equal(range(),'2026.10.26 — 2026.11.22');assert.equal(JSON.parse(localStorage.getItem(LOCAL_DATA_KEY)).checkins.length,7);

 // The extra confirmation for backfill must retain the same historical page too.
 const withoutYesterday=structuredClone(s);withoutYesterday.checkins=withoutYesterday.checkins.filter(event=>event.date!=='2026-11-24');withoutYesterday.revision+=2;
 changed=JSON.stringify(withoutYesterday);localStorage.setItem(LOCAL_DATA_KEY,changed);
 window.dispatchEvent(new window.StorageEvent('storage',{key:LOCAL_DATA_KEY,newValue:changed}));
 document.querySelector(`[data-action="detail"][data-id="${c.id}"]`).click();button('previous').click();
 document.querySelector(`[data-action="backfill"][data-id="${c.id}/2026-11-24"]`).click();
 document.querySelector('[data-action="confirm-backfill"]').click();
 assert.equal(range(),'2026.10.26 — 2026.11.22');assert.equal(JSON.parse(localStorage.getItem(LOCAL_DATA_KEY)).checkins.length,7);

 // Viewing the same period from history uses the same range and does not add editable day controls.
 finishCycle(s,c.id,'ended');s.revision++;
 const raw=JSON.stringify(s);localStorage.setItem(LOCAL_DATA_KEY,raw);
 window.dispatchEvent(new window.StorageEvent('storage',{key:LOCAL_DATA_KEY,newValue:raw}));
 document.querySelector('[data-page="history"]').click();
 document.querySelector(`[data-action="detail"][data-id="${c.id}"]`).click();
 assert.equal(document.querySelectorAll('.cycle-calendar-week').length,4);
 assert.equal(document.querySelectorAll('.cycle-calendar-week.is-complete').length,1);
 assert.equal(document.querySelectorAll('.cycle-calendar button').length,0);
 button('previous').click();assert.equal(range(),'2026.10.26 — 2026.11.22');
 button('current').click();assert.equal(range(),'2026.11.02 — 2026.11.29');
 assert.equal(localStorage.getItem(LOCAL_DATA_KEY),raw);

 await t.test('a completed weekly habit stays actionable in quick view and in details',()=>{
  t.mock.timers.setTime(+parseDate('2026-11-23'));
  const extraState=populatedState();
  const habit=startCycle(extraState,extraState.templates[0].id,'2026-11-23','2026-12-06',{type:'weekly',times:3},{weeklyBonusPoints:20});
  for(const date of ['2026-11-23','2026-11-24','2026-11-25']){
   t.mock.timers.setTime(+parseDate(date));checkIn(extraState,habit.id);
  }
  t.mock.timers.setTime(+parseDate('2026-11-27'));
  const saved=JSON.stringify(extraState);
  localStorage.setItem(LOCAL_DATA_KEY,saved);
  window.dispatchEvent(new window.StorageEvent('storage',{key:LOCAL_DATA_KEY,newValue:saved}));
  document.querySelector('[data-page="home"]').click();
  document.querySelector('[data-action="habit-view"][data-id="quick"]').click();

  const group=()=>document.querySelector('.quick-completed-group');
  const wallet=()=>document.querySelector('.wallet-pill b').textContent;
  const openDetails=()=>group().querySelector('[data-action="detail"]').click();
  assert.equal(group().open,false);
  assert.match(document.querySelector('.habit-section-title').textContent,/今日暂无必打项/);
  group().querySelector('summary').click();
  assert.equal(group().open,true);
  group().querySelector('[data-action="check"]').click();
  assert.equal(group().open,true);assert.equal(wallet(),'60');
  assert.match(group().textContent,/额外 1 次/);

  openDetails();
  assert.equal(document.querySelector('[aria-label="计划完成率"]').getAttribute('aria-valuenow'),'50');
  assert.match(document.querySelector('.record-context').textContent,/实际打卡 4 次（含额外 1 次）/);
  assert.equal(document.querySelector('.cycle-calendar-day[title="2026-11-27 · 已打卡"]').classList.contains('hit'),true);
  document.querySelector('[data-action="record-undo"]').click();
  document.querySelector('[data-action="confirm-undo"]').click();
  assert.equal(wallet(),'50');

  openDetails();
  const recordButton=document.querySelector('[data-action="record-check"]');
  assert.match(recordButton.textContent,/继续打卡/);
  recordButton.click();
  const backfill=document.querySelector(`[data-action="backfill"][data-id="${habit.id}/2026-11-26"]`);
  assert.match(backfill.getAttribute('aria-label'),/可补记额外打卡/);
  backfill.click();document.querySelector('[data-action="confirm-backfill"]').click();
  assert.equal(wallet(),'70');
  assert.match(document.querySelector('.cycle-calendar-week.is-current .cycle-calendar-week-label').textContent,/3 \/ 3 · 额外 2 次/);
  assert.equal(document.querySelector('[aria-label="计划完成率"]').getAttribute('aria-valuenow'),'50');
  const after=validate(JSON.parse(localStorage.getItem(LOCAL_DATA_KEY)));
  assert.equal(after.checkins.length,5);
 });
});
