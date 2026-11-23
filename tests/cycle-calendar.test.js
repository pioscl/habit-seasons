import test from 'node:test';
import assert from 'node:assert/strict';
import {cycleCalendarWeeks} from '../src/cycle-calendar.js';

const cycle=(overrides={})=>({id:'focus',startDate:'2026-10-01',endDate:'2027-02-28',frequency:{type:'weekly',times:3},...overrides});
const state=(dates=[],otherDates=[])=>({checkins:[...dates.map(date=>({cycleId:'focus',date})),...otherDates.map(date=>({cycleId:'other',date}))]});

test('four complete Monday–Sunday rows include this week and its future days',()=>{
 const weeks=cycleCalendarWeeks(state(),cycle(),'2026-11-25');
 assert.equal(weeks.length,4);assert.equal(weeks.flatMap(w=>w.days).length,28);
 assert.deepEqual(weeks.map(w=>[w.startDate,w.endDate]),[['2026-11-02','2026-11-08'],['2026-11-09','2026-11-15'],['2026-11-16','2026-11-22'],['2026-11-23','2026-11-29']]);
 assert.deepEqual(weeks[3].days.filter(day=>day.future).map(day=>day.date),['2026-11-26','2026-11-27','2026-11-28','2026-11-29']);
 assert.equal(weeks[3].days[2].today,true);assert.equal(weeks.filter(w=>w.current).length,1);
});
test('Sunday stays in the same four weeks and Monday advances the range by a week',()=>{
 assert.equal(cycleCalendarWeeks(state(),cycle(),'2026-11-29')[0].startDate,'2026-11-02');
 const weeks=cycleCalendarWeeks(state(),cycle(),'2026-11-30');
 assert.equal(weeks[0].startDate,'2026-11-09');assert.equal(weeks[3].endDate,'2026-12-06');
});
test('calendar boundaries cross years and leap days without losing or duplicating dates',()=>{
 const year=cycleCalendarWeeks(state(),cycle(),'2027-01-01');
 assert.equal(year[0].startDate,'2026-12-07');assert.equal(year[3].endDate,'2027-01-03');
 const leap=cycleCalendarWeeks(state(),cycle(),'2028-03-01').flatMap(w=>w.days.map(day=>day.date));
 assert.equal(leap[0],'2028-02-07');assert.equal(leap.at(-1),'2028-03-05');assert.ok(leap.includes('2028-02-29'));assert.equal(new Set(leap).size,28);
});
test('weekly quota highlights only finished historical weeks, even without weekly bonus points',()=>{
 const s=state(['2026-11-16','2026-11-18','2026-11-22','2026-11-23','2026-11-24','2026-11-25']);
 const weeks=cycleCalendarWeeks(s,cycle({weeklyBonusPoints:0}),'2026-11-25');
 assert.equal(weeks[2].done,3);assert.equal(weeks[2].completed,true);
 assert.equal(weeks[3].done,3);assert.equal(weeks[3].completed,false);
 assert.equal(cycleCalendarWeeks(s,cycle({frequency:{type:'weekly',times:4}}),'2026-11-25')[2].completed,false);
});
test('daily and selected-weekday plans require every scheduled check-in',()=>{
 const dates=['2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20','2026-11-21','2026-11-22'];
 const daily=cycle({frequency:{type:'daily'}});
 assert.equal(cycleCalendarWeeks(state(dates),daily,'2026-11-25')[2].completed,true);
 assert.equal(cycleCalendarWeeks(state(dates.slice(1)),daily,'2026-11-25')[2].completed,false);
 const weekdays=cycle({frequency:{type:'weekdays',days:[1,3,5]}});
 const week=cycleCalendarWeeks(state(['2026-11-16','2026-11-18','2026-11-20']),weekdays,'2026-11-25')[2];
 assert.equal(week.target,3);assert.equal(week.completed,true);assert.equal(week.days[1].scheduled,false);
});
test('partial first and last weeks use the existing capped target within the cycle dates',()=>{
 const c=cycle({startDate:'2026-11-20',endDate:'2026-11-25',frequency:{type:'weekly',times:5}});
 const weeks=cycleCalendarWeeks(state(['2026-11-20','2026-11-21','2026-11-22']),c,'2026-11-25');
 assert.deepEqual([weeks[2].done,weeks[2].target,weeks[2].completed],[3,3,true]);
 assert.equal(weeks[3].target,3);assert.equal(weeks[2].days[0].scheduled,false);assert.equal(weeks[3].days[3].scheduled,false);
});
test('weeks with no scheduled days never count as completed',()=>{
 const weeks=cycleCalendarWeeks(state(),cycle({startDate:'2026-11-23'}),'2026-11-25');
 assert.ok(weeks.slice(0,3).every(week=>week.target===0&&!week.completed));
 const ended=cycleCalendarWeeks(state(),cycle({endDate:'2026-10-31',status:'ended',endedAt:'2026-10-31'}),'2026-11-25');
 assert.equal(ended[3].startDate,'2026-11-23');assert.ok(ended.every(week=>!week.completed));
});
test('only this cycle and visible dates affect counts; reading the calendar never mutates state',()=>{
 const s=state(['2026-11-01','2026-11-18'],['2026-11-16','2026-11-17','2026-11-19']);
 const before=structuredClone(s),weeks=cycleCalendarWeeks(s,cycle(),'2026-11-25');
 assert.equal(weeks.reduce((sum,week)=>sum+week.done,0),1);assert.equal(weeks[2].completed,false);assert.deepEqual(s,before);
});
