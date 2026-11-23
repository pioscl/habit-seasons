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

 // Viewing the same period from history uses the same range and does not add editable day controls.
 finishCycle(s,c.id,'ended');s.revision++;
 const raw=JSON.stringify(s);localStorage.setItem(LOCAL_DATA_KEY,raw);
 window.dispatchEvent(new window.StorageEvent('storage',{key:LOCAL_DATA_KEY,newValue:raw}));
 document.querySelector('[data-page="history"]').click();
 document.querySelector(`[data-action="detail"][data-id="${c.id}"]`).click();
 assert.equal(document.querySelectorAll('.cycle-calendar-week').length,4);
 assert.equal(document.querySelectorAll('.cycle-calendar-week.is-complete').length,1);
 assert.equal(document.querySelectorAll('.cycle-calendar button').length,0);
 assert.equal(localStorage.getItem(LOCAL_DATA_KEY),raw);
});
