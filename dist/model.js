export const VERSION=3;
import {HABIT_ICONS} from './habit-icons.js';
export {HABIT_ICONS};
import {uid,today,parseDate,dateValid} from './core.js';
export {uid,today,parseDate,dateValid};
import {balance} from './wallet.js';
export {balance,earnedPoints} from './wallet.js';
import {validateGoals} from './goal-model.js';
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
 return first>last?0:Math.min(c.frequency.times,daysBetween(last,first)+1);
}
export function weekProgress(s,c,date=today()){
 const start=weekStart(date),end=shiftDate(start,6);
 return {done:s.checkins.filter(x=>x.cycleId===c.id&&x.date>=start&&x.date<=end).length,target:weeklyTarget(c,date)};
}
export function canCheckIn(s,c,date=today()){
 return c.status==='active'&&scheduled(c,date)&&(c.frequency.type!=='weekly'||weekProgress(s,c,date).done<weeklyTarget(c,date));
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
export function initialState(){return{schemaVersion:VERSION,revision:0,templates:[{id:uid(),name:'轻断食',icon:'leaf',difficulty:'medium',points:10,archived:false},{id:uid(),name:'运动',icon:'run',difficulty:'hard',points:20,archived:false},{id:uid(),name:'阅读',icon:'book',difficulty:'easy',points:5,archived:false}],cycles:[],checkins:[],rewards:[{id:uid(),name:'买一本书',cost:300,archived:false},{id:uid(),name:'买一个游戏',cost:800,archived:false},{id:uid(),name:'看演唱会',cost:2000,archived:false}],redemptions:[],goals:[],lastExportAt:null}}
const ensure=(ok,msg)=>{if(!ok)throw new Error(msg)};
const nameValid=s=>typeof s==='string'&&s.trim().length>0&&s.length<=60;
const int=(v,min=0,max=1000000)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const daysValid=days=>Array.isArray(days)&&days.length>0&&days.length<=7&&new Set(days).size===days.length&&days.every(d=>int(d,0,6));
function snapshotValid(t){return t&&nameValid(t.name)&&Object.hasOwn(HABIT_ICONS,t.icon)&&['easy','medium','hard'].includes(t.difficulty)&&int(t.points,1,1000)&&!Object.hasOwn(t,'days')}
export function frequencyValid(f){return !!f&&(f.type==='daily'||(f.type==='weekdays'&&daysValid(f.days))||(f.type==='weekly'&&int(f.times,1,7)))}
export function upgrade(input){
 const s=structuredClone(input);
 if(s?.schemaVersion===1){
  ensure(Array.isArray(s.templates)&&Array.isArray(s.cycles),'旧版备份无效。');
  for(const t of s.templates){ensure(t&&daysValid(t.days),'旧版模板频率无效。');delete t.days;}
  for(const c of s.cycles){ensure(c?.snapshot&&daysValid(c.snapshot.days),'旧版周期频率无效。');c.frequency=c.snapshot.days.length===7?{type:'daily'}:{type:'weekdays',days:[...c.snapshot.days]};delete c.snapshot.days;}
  s.schemaVersion=2;
 }
 if(s?.schemaVersion===2){s.goals=[];s.schemaVersion=VERSION;}
 return validate(s);
}
export function validate(s){
 ensure(s&&s.schemaVersion===VERSION,'备份版本不支持，请选择一期导出的 JSON 文件。');
 ensure(int(s.revision),'数据版本无效。');
 for(const k of ['templates','cycles','checkins','rewards','redemptions']){ensure(Array.isArray(s[k])&&s[k].length<=100000,`备份中的 ${k} 无效。`);const ids=new Set();for(const v of s[k]){ensure(v&&typeof v.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v.id)&&!ids.has(v.id),'备份中存在无效或重复的记录。');ids.add(v.id)}}
 for(const t of s.templates)ensure(snapshotValid(t)&&!Object.hasOwn(t,'frequency')&&typeof t.archived==='boolean','习惯模板设置无效。');
 const ts=new Set(s.templates.map(t=>t.id)),cs=new Map(),active=new Set();
 for(const c of s.cycles){ensure(ts.has(c.templateId)&&snapshotValid(c.snapshot)&&frequencyValid(c.frequency)&&dateValid(c.startDate)&&dateValid(c.endDate)&&c.startDate<=c.endDate&&daysBetween(c.endDate,c.startDate)<=3660,'周期日期或模板关联无效。');ensure(['active','completed','ended'].includes(c.status),'周期状态无效。');if(c.status==='active'){ensure(c.endedAt===null&&!active.has(c.templateId),'同一模板存在多个进行中的周期。');active.add(c.templateId)}else{ensure(dateValid(c.endedAt)&&c.endedAt>=c.startDate,'周期结束日期无效。');if(c.status==='completed')ensure(c.endedAt>=c.endDate,'尚未到期的周期不能标记为完成。')}cs.set(c.id,c)}
 const weeklyCounts=new Map();const checkKeys=new Set();for(const c of s.checkins){const cycle=cs.get(c.cycleId),key=`${c.cycleId}/${c.date}`;ensure(cycle&&dateValid(c.date)&&scheduled(cycle,c.date)&&c.date<=today()&&(cycle.status==='active'||c.date<=cycle.endedAt)&&c.points===cycle.snapshot.points&&!checkKeys.has(key),'打卡记录日期、积分或关联无效。');checkKeys.add(key);if(cycle.frequency.type==='weekly'){const wk=`${cycle.id}/${weekStart(c.date)}`;weeklyCounts.set(wk,(weeklyCounts.get(wk)||0)+1);ensure(weeklyCounts.get(wk)<=weeklyTarget(cycle,c.date),'打卡次数超过当周目标。')}}
 const rs=new Set();for(const r of s.rewards){ensure(nameValid(r.name)&&int(r.cost,1)&&typeof r.archived==='boolean','奖励设置无效。');rs.add(r.id)}
 for(const r of s.redemptions)ensure(rs.has(r.rewardId)&&nameValid(r.name)&&int(r.cost,1)&&typeof r.redeemedAt==='string'&&Number.isFinite(Date.parse(r.redeemedAt)),'兑换记录无效。');
 validateGoals(s);
 ensure(Number.isSafeInteger(balance(s))&&balance(s)>=0,'备份中的积分余额不能为负数。');
 ensure(s.lastExportAt===null||(typeof s.lastExportAt==='string'&&Number.isFinite(Date.parse(s.lastExportAt))),'备份时间无效。');return s;
}
export function startCycle(s,templateId,startDate,endDate,frequency={type:'daily'}){const t=s.templates.find(x=>x.id===templateId);ensure(t&&!t.archived,'模板不存在或已停用。');ensure(!s.cycles.some(c=>c.templateId===templateId&&c.status==='active'),'这个习惯已有进行中的一期。');ensure(dateValid(startDate)&&dateValid(endDate)&&startDate>=today()&&endDate>=startDate&&daysBetween(endDate,startDate)<=3660,'请选择有效的开始和结束日期（最长 10 年）。');ensure(frequencyValid(frequency),'请选择有效的执行频率。');const c={id:uid(),templateId,frequency:structuredClone(frequency),snapshot:{name:t.name,icon:t.icon,difficulty:t.difficulty,points:t.points},startDate,endDate,status:'active',endedAt:null};ensure(expected(c)>0,'这段时间没有安排执行日，请延长周期。');s.cycles.push(c);return c}
function recordCheckIn(s,cycleId,date){
 const c=s.cycles.find(c=>c.id===cycleId);
 ensure(c?.status==='active'&&dateValid(date)&&scheduled(c,date),'这一天不是进行中周期的执行日。');
 ensure(!s.checkins.some(x=>x.cycleId===cycleId&&x.date===date),'这一天已经完成过了。');
 ensure(canCheckIn(s,c,date),'本周目标已完成，下周再继续。');
 s.checkins.push({id:uid(),cycleId,date,points:c.snapshot.points});return c.snapshot.points;
}
export function checkIn(s,cycleId,date=today()){
 ensure(date===today(),'过去的日期请使用本周补打卡。');return recordCheckIn(s,cycleId,date);
}
export function backfillCheckIn(s,cycleId,date){
 const now=today();
 ensure(dateValid(date)&&date>=weekStart(now)&&date<now,'只能补本周一至昨天的打卡。');
 return recordCheckIn(s,cycleId,date);
}
export function undoCheckIn(s,cycleId){const c=s.cycles.find(c=>c.id===cycleId),i=s.checkins.findIndex(x=>x.cycleId===cycleId&&x.date===today());ensure(c?.status==='active'&&i>=0,'只能撤销进行中周期的今日打卡。');ensure(balance(s)>=s.checkins[i].points,'这次积分已用于兑换，当前余额不足以撤销。');s.checkins.splice(i,1)}
export function finishCycle(s,id,status){const c=s.cycles.find(c=>c.id===id);ensure(c?.status==='active','这一期已经结束。');ensure(c.startDate<=today(),'这一期尚未开始。');ensure(['completed','ended'].includes(status),'结束状态无效。');ensure(status!=='completed'||today()>=c.endDate,'到达结束日期后才可完成归档；现在可以提前结束。');if(status==='ended'&&!s.checkins.some(x=>x.cycleId===id)){s.cycles=s.cycles.filter(x=>x.id!==id);return 'deleted'}c.status=status;c.endedAt=today();return status}
export function redeem(s,id){const r=s.rewards.find(r=>r.id===id);ensure(r&&!r.archived,'奖励不存在或已停用。');ensure(balance(s)>=r.cost,'积分还不够，再积累一点。');const record={id:uid(),rewardId:id,name:r.name,cost:r.cost,redeemedAt:new Date().toISOString()};s.redemptions.push(record);return record}
