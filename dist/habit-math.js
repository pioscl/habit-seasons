import {today,parseDate,dateValid} from './core.js';
export function shiftDate(s,n){const d=parseDate(s);d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export function monthEnd(s,n){const d=parseDate(s),day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+n);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));const end=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;return shiftDate(end,-1)}
export function daysBetween(a,b){return Math.round((Date.UTC(...a.split('-').map((v,i)=>i===1?+v-1:+v))-Date.UTC(...b.split('-').map((v,i)=>i===1?+v-1:+v)))/86400000)}
export function weekStart(date){return shiftDate(date,-((parseDate(date).getDay()+6)%7))}
export function scheduled(c,date){
 if(date<c.startDate||date>c.endDate)return false;
 return c.frequency.type!=='weekdays'||c.frequency.days.includes(parseDate(date).getDay());
}
export function weeklyTarget(c,date){
 const start=weekStart(date),end=shiftDate(start,6);
 const first=start>c.startDate?start:c.startDate,last=end<c.endDate?end:c.endDate;
 if(first>last)return 0;
 if(c.frequency.type==='weekly')return Math.min(c.frequency.times,daysBetween(last,first)+1);
 let target=0;for(let d=first;d<=last;d=shiftDate(d,1))if(scheduled(c,d))target++;
 return target;
}
export function weekProgress(s,c,date=today()){
 const start=weekStart(date),end=shiftDate(start,6);
 return {done:s.checkins.filter(x=>x.cycleId===c.id&&x.date>=start&&x.date<=end).length,target:weeklyTarget(c,date)};
}
export function canCheckIn(s,c,date=today()){
 return c.status==='active'&&scheduled(c,date)&&(c.frequency.type!=='weekly'||weekProgress(s,c,date).done<weeklyTarget(c,date));
}
// Classify today's plan from records before today, so checking in today cannot
// remove a required item from the day's progress denominator.
export function todayPlan(s,c,date=today()){
 const start=weekStart(date),last=shiftDate(start,6)<c.endDate?shiftDate(start,6):c.endDate;
 const done=s.checkins.some(x=>x.cycleId===c.id&&x.date===date);
 const before=s.checkins.filter(x=>x.cycleId===c.id&&x.date>=start&&x.date<date).length;
 const week={done:before+(done?1:0),target:weeklyTarget(c,date)};
 const result={kind:'inactive',done,actionable:false,week,remaining:Math.max(0,week.target-week.done),daysLeft:0,shortfall:0};
 if(c.status!=='active')return result;
 if(date<c.startDate)return {...result,kind:'future'};
 if(date>c.endDate)return {...result,kind:'expired'};
 if(!scheduled(c,date))return {...result,kind:'rest'};
 let daysLeft=0;for(let d=date;d<=last;d=shiftDate(d,1))if(scheduled(c,d))daysLeft++;
 const neededBeforeToday=Math.max(0,week.target-before);
 const kind=c.frequency.type!=='weekly'?'required':neededBeforeToday===0?'met':neededBeforeToday<daysLeft?'optional':neededBeforeToday===daysLeft?'required':'behind';
 return {...result,kind,daysLeft,shortfall:c.frequency.type==='weekly'?Math.max(0,neededBeforeToday-daysLeft):0,actionable:done||c.frequency.type!=='weekly'||week.done<week.target};
}
export function dayPlanSummary(s,cycles=s.cycles,date=today()){
 const summary={required:0,completedRequired:0,optional:0,behind:0,completed:0};
 for(const c of cycles){
  const plan=todayPlan(s,c,date);
  if(c.status!=='active'||date<c.startDate||date>c.endDate)continue;
  if(plan.done)summary.completed++;
  if(plan.kind==='required'){summary.required++;if(plan.done)summary.completedRequired++}
  if(plan.kind==='optional'&&!plan.done)summary.optional++;
  if(plan.kind==='behind'&&!plan.done)summary.behind++;
 }
 return summary;
}
export function canBackfill(s,c,date){
 const now=today();
 return !!c&&dateValid(date)&&date>=weekStart(now)&&date<now&&canCheckIn(s,c,date)&&!s.checkins.some(x=>x.cycleId===c.id&&x.date===date);
}
export function expected(c,until=c.endDate){
 const end=until<c.endDate?until:c.endDate;if(end<c.startDate)return 0;
 let n=0;
 if(c.frequency.type==='weekly'){
  for(let d=weekStart(c.startDate);d<=end;d=shiftDate(d,7))n+=weeklyTarget(c,d);
 }else for(let d=c.startDate;d<=end;d=shiftDate(d,1))if(scheduled(c,d))n++;
 return n;
}

export function requiredCheckins(c){return c.completionThreshold===null?null:Math.ceil(expected(c)*c.completionThreshold/100)}
export function cycleOutcome(s,c){const required=requiredCheckins(c);return required===null||s.checkins.filter(x=>x.cycleId===c.id).length>=required?'completed':'failed'}
export function checkInReward(s,c,date=today()){
 const week=weekProgress(s,c,date),bonus=week.target>0&&week.done+1===week.target?c.weeklyBonusPoints:0;
 return {base:c.snapshot.points,bonus,total:c.snapshot.points+bonus};
}
export function undoCheckInCost(s,c){
 const week=weekProgress(s,c);
 return c.snapshot.points+(week.target>0&&week.done===week.target?c.weeklyBonusPoints:0);
}
// One derived award per cycle/week: reloads and re-checking cannot duplicate points.
export function weeklyAwards(s,cycleId=null){
 const cycles=new Map(s.cycles.filter(c=>c.weeklyBonusPoints>0&&(!cycleId||c.id===cycleId)).map(c=>[c.id,c])),counts=new Map();
 for(const event of s.checkins){if(!cycles.has(event.cycleId))continue;const week=weekStart(event.date),key=event.cycleId+'/'+week,entry=counts.get(key)||{cycleId:event.cycleId,weekStart:week,done:0};entry.done++;counts.set(key,entry)}
 const awards=[];
 for(const entry of counts.values()){const c=cycles.get(entry.cycleId),target=weeklyTarget(c,entry.weekStart);if(target>0&&entry.done>=target)awards.push({cycleId:c.id,weekStart:entry.weekStart,points:c.weeklyBonusPoints})}
 return awards.sort((a,b)=>a.weekStart.localeCompare(b.weekStart));
}
export function cyclePoints(s,c){return s.checkins.filter(x=>x.cycleId===c.id).reduce((sum,x)=>sum+x.points,0)+weeklyAwards(s,c.id).reduce((sum,x)=>sum+x.points,0)}
