import {uid,today,dateValid} from './core.js';
import {HABIT_ICONS} from './habit-icons.js';
import {balance} from './wallet.js';

const ensure=(ok,message)=>{if(!ok)throw new Error(message)};
const idValid=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
const nameValid=name=>typeof name==='string'&&name.trim().length>0&&name.length<=60;
const pointsValid=points=>Number.isSafeInteger(points)&&points>=1&&points<=1000;
const fieldsValid=a=>a&&nameValid(a.name)&&Object.hasOwn(HABIT_ICONS,a.icon)&&pointsValid(a.points);

export function saveActivity(state,fields,id=null){
 ensure(fieldsValid(fields),'请填写活动名称、图标和 1–1,000 的整数积分。');
 ensure(typeof fields.description==='string'&&fields.description.length<=200,'活动说明最多 200 字。');
 const values={name:fields.name.trim(),icon:fields.icon,points:fields.points,description:fields.description.trim()};
 if(id){
  const activity=state.activities.find(a=>a.id===id);ensure(activity,'活动不存在。');
  Object.assign(activity,values);return activity;
 }
 ensure(state.activities.length<100000,'活动数量已达上限。');
 const activity={id:uid(),...values,archived:false};state.activities.push(activity);return activity;
}
export function archiveActivity(state,id,archived=true){
 const activity=state.activities.find(a=>a.id===id);
 ensure(activity&&typeof archived==='boolean','活动不存在或状态无效。');
 activity.archived=archived;return activity;
}
export function recordActivity(state,id){
 const activity=state.activities.find(a=>a.id===id);
 ensure(activity&&!activity.archived,'活动不存在或已归档，请先恢复活动。');
 ensure(state.activityEvents.length<100000,'活动记录数量已达上限。');
 const event={id:uid(),activityId:id,name:activity.name,icon:activity.icon,points:activity.points,date:today(),createdAt:new Date().toISOString()};
 state.activityEvents.push(event);return event;
}
export function undoActivity(state,id){
 const index=state.activityEvents.findIndex(e=>e.id===id);
 ensure(index>=0,'这条活动记录已撤销或不存在。');
 const event=state.activityEvents[index];
 ensure(balance(state)>=event.points,`撤销需扣回 ${event.points} 积分，当前余额不足。`);
 state.activityEvents.splice(index,1);return event;
}
export function validateActivities(state){
 for(const key of ['activities','activityEvents']){
  ensure(Array.isArray(state[key])&&state[key].length<=100000,`备份中的 ${key} 无效。`);
  const ids=new Set();
  for(const item of state[key]){ensure(item&&idValid(item.id)&&!ids.has(item.id),'活动数据中存在无效或重复的记录。');ids.add(item.id)}
 }
 const ids=new Set(state.activities.map(a=>a.id));
 for(const a of state.activities)ensure(fieldsValid(a)&&typeof a.description==='string'&&a.description.length<=200&&typeof a.archived==='boolean','活动设置无效。');
 // Snapshots intentionally need not match the activity's current name or points.
 for(const e of state.activityEvents)ensure(ids.has(e.activityId)&&fieldsValid(e)&&dateValid(e.date)&&e.date<=today()&&typeof e.createdAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(e.createdAt)&&dateValid(e.createdAt.slice(0,10))&&Number.isFinite(Date.parse(e.createdAt))&&new Date(e.createdAt).toISOString()===e.createdAt,'活动记录日期、积分或关联无效。');
 return state;
}
