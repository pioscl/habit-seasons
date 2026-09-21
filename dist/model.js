export const VERSION=1;
export const uid=()=>crypto.randomUUID();
export function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export function parseDate(s){return new Date(`${s}T12:00:00`)}
export function dateValid(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=parseDate(s);return Number.isFinite(+d)&&`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`===s}
export function shiftDate(s,n){const d=parseDate(s);d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export function monthEnd(s,n){const d=parseDate(s),day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+n);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));const end=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;return shiftDate(end,-1)}
export function daysBetween(a,b){return Math.round((Date.UTC(...a.split('-').map((v,i)=>i===1?+v-1:+v))-Date.UTC(...b.split('-').map((v,i)=>i===1?+v-1:+v)))/86400000)}
export function scheduled(c,date){return date>=c.startDate&&date<=c.endDate&&c.snapshot.days.includes(parseDate(date).getDay())}
export function expected(c,until=c.endDate){let n=0;for(let d=c.startDate;d<=c.endDate&&d<=until;d=shiftDate(d,1))if(scheduled(c,d))n++;return n}
export function balance(s){return s.checkins.reduce((a,c)=>a+c.points,0)-s.redemptions.reduce((a,r)=>a+r.cost,0)}
export function initialState(){return{schemaVersion:VERSION,revision:0,templates:[{id:uid(),name:'轻断食',icon:'leaf',difficulty:'medium',points:10,days:[0,1,2,3,4,5,6],archived:false},{id:uid(),name:'运动',icon:'run',difficulty:'hard',points:20,days:[1,3,5],archived:false},{id:uid(),name:'阅读',icon:'book',difficulty:'easy',points:5,days:[0,1,2,3,4,5,6],archived:false}],cycles:[],checkins:[],rewards:[{id:uid(),name:'买一本书',cost:300,archived:false},{id:uid(),name:'买一个游戏',cost:800,archived:false},{id:uid(),name:'看演唱会',cost:2000,archived:false}],redemptions:[],lastExportAt:null}}
const ensure=(ok,msg)=>{if(!ok)throw new Error(msg)};
const nameValid=s=>typeof s==='string'&&s.trim().length>0&&s.length<=60;
const int=(v,min=0,max=1000000)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
function snapshotValid(t){return t&&nameValid(t.name)&&['leaf','run','book','home'].includes(t.icon)&&['easy','medium','hard'].includes(t.difficulty)&&int(t.points,1,1000)&&Array.isArray(t.days)&&t.days.length>0&&t.days.length<=7&&new Set(t.days).size===t.days.length&&t.days.every(d=>int(d,0,6))}
export function validate(s){
 ensure(s&&s.schemaVersion===VERSION,'备份版本不支持，请选择一期导出的 JSON 文件。');
 ensure(int(s.revision),'数据版本无效。');
 for(const k of ['templates','cycles','checkins','rewards','redemptions']){ensure(Array.isArray(s[k])&&s[k].length<=100000,`备份中的 ${k} 无效。`);const ids=new Set();for(const v of s[k]){ensure(v&&typeof v.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v.id)&&!ids.has(v.id),'备份中存在无效或重复的记录。');ids.add(v.id)}}
 for(const t of s.templates)ensure(snapshotValid(t)&&typeof t.archived==='boolean','习惯模板设置无效。');
 const ts=new Set(s.templates.map(t=>t.id)),cs=new Map(),active=new Set();
 for(const c of s.cycles){ensure(ts.has(c.templateId)&&snapshotValid(c.snapshot)&&dateValid(c.startDate)&&dateValid(c.endDate)&&c.startDate<=c.endDate&&daysBetween(c.endDate,c.startDate)<=3660,'周期日期或模板关联无效。');ensure(['active','completed','ended'].includes(c.status),'周期状态无效。');if(c.status==='active'){ensure(c.endedAt===null&&!active.has(c.templateId),'同一模板存在多个进行中的周期。');active.add(c.templateId)}else{ensure(dateValid(c.endedAt)&&c.endedAt>=c.startDate,'周期结束日期无效。');if(c.status==='completed')ensure(c.endedAt>=c.endDate,'尚未到期的周期不能标记为完成。')}cs.set(c.id,c)}
 const checkKeys=new Set();for(const c of s.checkins){const cycle=cs.get(c.cycleId),key=`${c.cycleId}/${c.date}`;ensure(cycle&&dateValid(c.date)&&scheduled(cycle,c.date)&&c.date<=today()&&(cycle.status==='active'||c.date<=cycle.endedAt)&&c.points===cycle.snapshot.points&&!checkKeys.has(key),'打卡记录日期、积分或关联无效。');checkKeys.add(key)}
 const rs=new Set();for(const r of s.rewards){ensure(nameValid(r.name)&&int(r.cost,1)&&typeof r.archived==='boolean','奖励设置无效。');rs.add(r.id)}
 for(const r of s.redemptions)ensure(rs.has(r.rewardId)&&nameValid(r.name)&&int(r.cost,1)&&typeof r.redeemedAt==='string'&&Number.isFinite(Date.parse(r.redeemedAt)),'兑换记录无效。');
 ensure(Number.isSafeInteger(balance(s))&&balance(s)>=0,'备份中的积分余额不能为负数。');
 ensure(s.lastExportAt===null||(typeof s.lastExportAt==='string'&&Number.isFinite(Date.parse(s.lastExportAt))),'备份时间无效。');return s;
}
export function startCycle(s,templateId,startDate,endDate){const t=s.templates.find(x=>x.id===templateId);ensure(t&&!t.archived,'模板不存在或已停用。');ensure(!s.cycles.some(c=>c.templateId===templateId&&c.status==='active'),'这个习惯已有进行中的一期。');ensure(dateValid(startDate)&&dateValid(endDate)&&startDate>=today()&&endDate>=startDate&&daysBetween(endDate,startDate)<=3660,'请选择有效的开始和结束日期（最长 10 年）。');const c={id:uid(),templateId,snapshot:{name:t.name,icon:t.icon,difficulty:t.difficulty,points:t.points,days:[...t.days]},startDate,endDate,status:'active',endedAt:null};ensure(expected(c)>0,'这段时间没有安排执行日，请延长周期。');s.cycles.push(c);return c}
export function checkIn(s,cycleId,date=today()){const c=s.cycles.find(c=>c.id===cycleId);ensure(c&&c.status==='active'&&date===today()&&scheduled(c,date),'今天不是这一期的执行日。');ensure(!s.checkins.some(x=>x.cycleId===cycleId&&x.date===date),'今天已经完成过了。');s.checkins.push({id:uid(),cycleId,date,points:c.snapshot.points});return c.snapshot.points}
export function undoCheckIn(s,cycleId){const c=s.cycles.find(c=>c.id===cycleId),i=s.checkins.findIndex(x=>x.cycleId===cycleId&&x.date===today());ensure(c?.status==='active'&&i>=0,'只能撤销进行中周期的今日打卡。');ensure(balance(s)>=s.checkins[i].points,'这次积分已用于兑换，当前余额不足以撤销。');s.checkins.splice(i,1)}
export function finishCycle(s,id,status){const c=s.cycles.find(c=>c.id===id);ensure(c?.status==='active','这一期已经结束。');ensure(c.startDate<=today(),'这一期尚未开始。');ensure(['completed','ended'].includes(status),'结束状态无效。');ensure(status!=='completed'||today()>=c.endDate,'到达结束日期后才可完成归档；现在可以提前结束。');c.status=status;c.endedAt=today()}
export function redeem(s,id){const r=s.rewards.find(r=>r.id===id);ensure(r&&!r.archived,'奖励不存在或已停用。');ensure(balance(s)>=r.cost,'积分还不够，再积累一点。');const record={id:uid(),rewardId:id,name:r.name,cost:r.cost,redeemedAt:new Date().toISOString()};s.redemptions.push(record);return record}
