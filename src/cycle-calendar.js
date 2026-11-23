import {today} from './core.js';
import {shiftDate,weekStart,weeklyTarget,scheduled} from './habit-math.js';

// Four Monday–Sunday weeks ending with the current week, including future days.
export function cycleCalendarWeeks(state,cycle,date=today()){
 const currentWeek=weekStart(date),first=shiftDate(currentWeek,-21);
 const recorded=new Set(state.checkins.filter(event=>event.cycleId===cycle.id).map(event=>event.date));
 return Array.from({length:4},(_,index)=>{
  const startDate=shiftDate(first,index*7),endDate=shiftDate(startDate,6);
  const days=Array.from({length:7},(_,day)=>{
   const value=shiftDate(startDate,day);
   return {date:value,done:recorded.has(value),scheduled:scheduled(cycle,value),future:value>date,today:value===date};
  });
  const target=weeklyTarget(cycle,startDate),done=days.filter(day=>day.done).length;
  return {startDate,endDate,days,done,target,current:startDate===currentWeek,completed:startDate<currentWeek&&target>0&&done>=target};
 });
}

export function renderCycleCalendar(state,cycle,date=today()){
 const weeks=cycleCalendarWeeks(state,cycle,date),count=weeks.reduce((sum,week)=>sum+week.done,0);
 const shortDate=value=>`${+value.slice(5,7)}.${+value.slice(-2)}`;
 const dayStatus=day=>day.done?'已打卡':!day.scheduled?'非执行日':day.future?'未到':day.today?'今天 · 未打卡':'未打卡';
 return `<section class="record-section cycle-calendar-section" aria-labelledby="cycle-calendar-title">
 <div class="record-section-head"><h3 id="cycle-calendar-title">最近 4 周</h3><span class="meta">${count} 次记录</span></div>
 <p class="cycle-calendar-note">本周及前三周 · 周一至周日</p>
 <div class="cycle-calendar" role="group" aria-label="最近4周打卡记录">
 <div class="cycle-calendar-weekdays" aria-hidden="true">${['一','二','三','四','五','六','日'].map(day=>`<span>${day}</span>`).join('')}</div>
 ${weeks.map(week=>`<div class="cycle-calendar-week ${week.completed?'is-complete':''} ${week.current?'is-current':''}" role="group" aria-label="${week.startDate} 至 ${week.endDate}${week.completed?'，已达标':''}${week.current?'，本周':''}">
 <div class="cycle-calendar-week-label"><span>${shortDate(week.startDate)} — ${shortDate(week.endDate)}</span><span>${week.current?'本周 · ':week.completed?'已达标 · ':''}${week.target?`${week.done} / ${week.target}`:'无安排'}</span></div>
 <div class="cycle-calendar-dates">${week.days.map(day=>`<span class="cycle-calendar-day ${day.done?'hit':''} ${!day.scheduled?'na':''} ${day.future?'is-future':''} ${day.today?'is-today':''}" title="${day.date} · ${dayStatus(day)}" aria-label="${day.date}，${dayStatus(day)}" ${day.today?'aria-current="date"':''}>${+day.date.slice(-2)}</span>`).join('')}</div>
 </div>`).join('')}
 </div>
 <p class="cycle-calendar-legend"><span><i class="legend-checkin" aria-hidden="true"></i>已打卡</span><span><i class="legend-week" aria-hidden="true"></i>历史周已达标</span></p>
 </section>`;
}
