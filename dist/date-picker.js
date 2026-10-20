import {dateValid,parseDate,today} from './core.js';
import {renderIcon} from './icons.js';

const weekdays=['一','二','三','四','五','六','日'];
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const calendarIcon=renderIcon('calendar');
const chevron=direction=>renderIcon(direction<0?'chevron-left':'chevron-right');
const iso=date=>`${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const monthDate=(year,month,day=1)=>{const d=new Date(0);d.setFullYear(year,month,day);d.setHours(12,0,0,0);return d};
const monthEnd=(year,month)=>iso(monthDate(year,month+1,0));
const displayDate=value=>dateValid(value)?`${+value.slice(0,4)} 年 ${+value.slice(5,7)} 月 ${+value.slice(8)} 日`:'';

export function dateField({id,name,value='',min='',max='',required=false,label='日期',placeholder='选择日期'}){
 return `<div class="date-field"><input type="hidden" data-date-value id="${escape(id)}" name="${escape(name)}" value="${escape(value)}" min="${escape(min)}" max="${escape(max)}" data-required="${required}" data-label="${escape(label)}" data-placeholder="${escape(placeholder)}"><button type="button" class="date-trigger ${value?'':'is-empty'}" id="${escape(id)}-trigger" aria-label="${escape(label)}：${escape(displayDate(value)||placeholder)}" aria-expanded="false" aria-controls="${escape(id)}-calendar"><span>${escape(displayDate(value)||placeholder)}</span>${calendarIcon}</button><div class="date-panel" id="${escape(id)}-calendar" role="group" aria-label="选择${escape(label)}" hidden></div></div>`;
}

// Values stay in the original form fields; only presentation and selection change.
let active=null,installed=false;
const fieldInput=field=>field.querySelector('[data-date-value]');
const allowed=(input,value)=>dateValid(value)&&value>='0001-01-01'&&value<='9999-12-31'&&(!input.min||value>=input.min)&&(!input.max||value<=input.max);
const intersects=(input,first,last)=>last>='0001-01-01'&&first<='9999-12-31'&&(!input.min||last>=input.min)&&(!input.max||first<=input.max);
function clamp(input,value){
 if(input.min&&value<input.min)return input.min;
 if(input.max&&value>input.max)return input.max;
 return value;
}

export function closeDatePicker({restoreFocus=false}={}){
 if(!active)return;
 const field=active.field;active=null;
 field.querySelector('.date-panel').hidden=true;
 const trigger=field.querySelector('.date-trigger');trigger.setAttribute('aria-expanded','false');
 if(restoreFocus&&field.isConnected)trigger.focus({preventScroll:true});
}

export function syncDateFields(root=document){
 if(active&&!active.field.isConnected)active=null;
 for(const field of root.querySelectorAll('.date-field')){
  const input=fieldInput(field),trigger=field.querySelector('.date-trigger');
  const text=displayDate(input.value)||input.dataset.placeholder;
  trigger.querySelector('span').textContent=text;
  trigger.setAttribute('aria-label',`${input.dataset.label}：${text}`);
  trigger.classList.toggle('is-empty',!input.value);
 }
}

function open(field){
 if(active?.field===field){closeDatePicker({restoreFocus:true});return}
 closeDatePicker();
 const input=fieldInput(field),value=clamp(input,dateValid(input.value)?input.value:today()),date=parseDate(value);
 active={field,year:date.getFullYear(),month:date.getMonth(),mode:'days',focusDate:value};
 field.querySelector('.date-panel').hidden=false;
 field.querySelector('.date-trigger').setAttribute('aria-expanded','true');
 render(true);
}

function dayGrid(input){
 const first=monthDate(active.year,active.month),offset=(first.getDay()+6)%7;
 let focus=active.focusDate;
 if(!allowed(input,focus)||+focus.slice(0,4)!==active.year||+focus.slice(5,7)!==active.month+1){
  focus=clamp(input,iso(first));active.focusDate=focus;
 }
 const days=Array.from({length:42},(_,i)=>{
  const date=monthDate(active.year,active.month,i-offset+1),value=iso(date),valid=allowed(input,value);
  return `<button type="button" role="gridcell" class="date-day ${date.getMonth()!==active.month?'outside-month':''} ${value===input.value?'is-selected':''} ${value===today()?'is-today':''}" data-date-select="${value}" aria-label="${displayDate(value)}${value===today()?'，今天':''}" aria-selected="${value===input.value}" ${value===today()?'aria-current="date"':''} tabindex="${valid&&value===focus?'0':'-1'}" ${valid?'':'disabled'}>${date.getDate()}</button>`;
 });
 return `<div class="date-weekdays" aria-hidden="true">${weekdays.map(day=>`<span>${day}</span>`).join('')}</div><div class="date-grid" role="grid" aria-label="${active.year} 年 ${active.month+1} 月">${Array.from({length:6},(_,i)=>`<div role="row">${days.slice(i*7,i*7+7).join('')}</div>`).join('')}</div>`;
}

function monthGrid(input){
 return `<div class="date-month-grid" aria-label="选择月份">${Array.from({length:12},(_,month)=>{
  const enabled=intersects(input,iso(monthDate(active.year,month)),monthEnd(active.year,month));
  return `<button type="button" data-date-month="${month}" class="${month===active.month?'is-selected':''}" aria-pressed="${month===active.month}" ${enabled?'':'disabled'}>${month+1}<small>月</small></button>`;
 }).join('')}</div>`;
}

function yearStart(){return Math.max(1,Math.min(9988,active.year-5))}
function yearGrid(input){
 const start=yearStart();
 return `<div class="date-year-grid" aria-label="选择年份">${Array.from({length:12},(_,i)=>{
  const year=start+i,enabled=intersects(input,`${String(year).padStart(4,'0')}-01-01`,`${String(year).padStart(4,'0')}-12-31`);
  return `<button type="button" data-date-year="${year}" class="${year===active.year?'is-selected':''}" aria-pressed="${year===active.year}" ${enabled?'':'disabled'}>${year}</button>`;
 }).join('')}</div>`;
}

function canNavigate(input,direction){
 if(active.mode==='days'){
  const date=monthDate(active.year,active.month+direction),year=date.getFullYear(),month=date.getMonth();
  return year>=1&&year<=9999&&intersects(input,iso(date),monthEnd(year,month));
 }
 if(active.mode==='months'){
  const year=active.year+direction;
  return year>=1&&year<=9999&&intersects(input,`${String(year).padStart(4,'0')}-01-01`,`${String(year).padStart(4,'0')}-12-31`);
 }
 const start=yearStart();
 return direction<0?start>1&&intersects(input,`${String(Math.max(1,start-12)).padStart(4,'0')}-01-01`,`${String(start-1).padStart(4,'0')}-12-31`):start+11<9999&&intersects(input,`${String(start+12).padStart(4,'0')}-01-01`,`${String(Math.min(9999,start+23)).padStart(4,'0')}-12-31`);
}

function render(focus=false){
 if(!active)return;
 const input=fieldInput(active.field),panel=active.field.querySelector('.date-panel');
 const unit=active.mode==='days'?'个月':active.mode==='months'?'年':'组年份';
 const heading=active.mode==='years'?`<span class="date-year-range">${yearStart()} — ${yearStart()+11}</span>`:`<button type="button" data-date-view="years" aria-label="选择年份，当前 ${active.year} 年">${active.year}<small>年</small></button><button type="button" data-date-view="months" aria-label="选择月份，当前 ${active.month+1} 月">${active.month+1}<small>月</small></button>`;
 panel.innerHTML=`<div class="date-panel-head"><button type="button" data-date-nav="-1" aria-label="上${unit}" ${canNavigate(input,-1)?'':'disabled'}>${chevron(-1)}</button><div class="date-panel-title" aria-live="polite">${heading}</div><button type="button" data-date-nav="1" aria-label="下${unit}" ${canNavigate(input,1)?'':'disabled'}>${chevron(1)}</button></div>${active.mode==='years'?yearGrid(input):active.mode==='months'?monthGrid(input):dayGrid(input)}<div class="date-panel-footer"><button type="button" data-date-select="${today()}" ${allowed(input,today())?'':'disabled'}>今天</button>${input.dataset.required==='true'?'':'<button type="button" data-date-clear>清除日期</button>'}<button type="button" data-date-close>收起</button></div>`;
 if(focus){
  const target=panel.querySelector(active.mode==='days'?'.date-day[tabindex="0"]':'.is-selected:not(:disabled)')||panel.querySelector('[data-date-nav]:not(:disabled)');
  target?.focus({preventScroll:true});
  panel.scrollIntoView?.({block:'nearest',behavior:'auto'});
 }
}

function select(value){
 if(!active)return;
 const input=fieldInput(active.field);
 if(value?!allowed(input,value):input.dataset.required==='true')return;
 input.value=value;
 closeDatePicker({restoreFocus:true});
 // The existing change handler updates linked dates, duration and plan preview.
 input.dispatchEvent(new Event('input',{bubbles:true}));
 input.dispatchEvent(new Event('change',{bubbles:true}));
 syncDateFields(input.closest('form')||document);
 const error=document.querySelector('#form-error');if(error?.dataset.dateError){error.textContent='';delete error.dataset.dateError}
}

export function validateDateFields(form){
 for(const input of form.querySelectorAll('[data-date-value]')){
  const value=input.value;
  if(!value&&input.dataset.required!=='true')continue;
  if(allowed(input,value))continue;
  const error=document.querySelector('#form-error');
  if(error){error.textContent=!value?`请选择${input.dataset.label}。`:input.min&&value<input.min?`${input.dataset.label}不能早于 ${displayDate(input.min)}。`:input.max&&value>input.max?`${input.dataset.label}不能晚于 ${displayDate(input.max)}。`:'请选择有效日期。';error.dataset.dateError='true'}
  const field=input.closest('.date-field');if(active?.field!==field)open(field);
  return false;
 }
 return true;
}

export function initDatePickers(){
 if(installed)return;installed=true;
 document.addEventListener('click',event=>{
  const trigger=event.target.closest('.date-trigger');
  if(trigger){open(trigger.closest('.date-field'));return}
  if(!active)return;
  if(!active.field.contains(event.target)){closeDatePicker();return}
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.hasAttribute('data-date-close')){closeDatePicker({restoreFocus:true});return}
  if(button.hasAttribute('data-date-clear')){select('');return}
  if(button.dataset.dateSelect){select(button.dataset.dateSelect);return}
  if(button.dataset.dateView){active.mode=button.dataset.dateView;render(true);return}
  if(button.hasAttribute('data-date-year')){active.year=+button.dataset.dateYear;active.mode='months';render(true);return}
  if(button.hasAttribute('data-date-month')){active.month=+button.dataset.dateMonth;active.mode='days';active.focusDate=clamp(fieldInput(active.field),iso(monthDate(active.year,active.month)));render(true);return}
  if(button.dataset.dateNav){
   const direction=+button.dataset.dateNav,input=fieldInput(active.field);if(!canNavigate(input,direction))return;
   if(active.mode==='days'){const date=monthDate(active.year,active.month+direction);active.year=date.getFullYear();active.month=date.getMonth();active.focusDate=clamp(input,iso(date))}
   else active.year=Math.max(1,Math.min(9999,active.year+direction*(active.mode==='years'?12:1)));
   render();active.field.querySelector(`[data-date-nav="${direction}"]`)?.focus({preventScroll:true});
  }
 });
 document.addEventListener('keydown',event=>{
  if(!active||!active.field.contains(event.target))return;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeDatePicker({restoreFocus:true});return}
  const day=event.target.closest('.date-day');if(!day)return;
  const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'];if(!keys.includes(event.key))return;
  event.preventDefault();const date=parseDate(day.dataset.dateSelect),weekday=(date.getDay()+6)%7;
  const deltas={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-weekday,End:6-weekday};
  let next;
  if(event.key==='PageUp'||event.key==='PageDown'){
   const direction=event.key==='PageUp'?-1:1,month=monthDate(date.getFullYear()+(event.shiftKey?direction:0),date.getMonth()+(event.shiftKey?0:direction));
   next=monthDate(month.getFullYear(),month.getMonth(),Math.min(date.getDate(),monthDate(month.getFullYear(),month.getMonth()+1,0).getDate()));
  }else{next=new Date(date);next.setDate(date.getDate()+deltas[event.key])}
  if(next.getFullYear()<1||next.getFullYear()>9999)return;
  const value=clamp(fieldInput(active.field),iso(next)),focused=parseDate(value);
  active.year=focused.getFullYear();active.month=focused.getMonth();active.focusDate=value;render(true);
 });
 document.addEventListener('change',event=>{if(event.target.closest('form'))queueMicrotask(()=>syncDateFields())});
 document.querySelector('#dialog')?.addEventListener('close',()=>closeDatePicker());
}
