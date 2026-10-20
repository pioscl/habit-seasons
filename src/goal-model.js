import {HABIT_ICONS} from './habit-icons.js';
import {uid,dateValid} from './core.js';
import {balance} from './wallet.js';
import {SCALE,quantityUnits,goalProgress,goalEarned,milestoneReached} from './goal-math.js';
export {goalProgress,goalEarned,goalPercent,milestoneReached} from './goal-math.js';
const ensure=(ok,message)=>{if(!ok)throw new Error(message)};
const idValid=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
const textValid=(text,max)=>typeof text==='string'&&text.trim().length>0&&text.length<=max;
const timeValid=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&Number.isFinite(Date.parse(value));
const rewardValid=value=>Number.isSafeInteger(value)&&value>=0&&value<=1000000;
const positive=value=>quantityUnits(value)!==null&&quantityUnits(value)>0;
const iconValid=value=>typeof value==='string'&&Object.hasOwn(HABIT_ICONS,value);
const deadlineValid=value=>value===null||dateValid(value);
const transitions={active:['paused','abandoned'],paused:['active','abandoned'],abandoned:['active'],completed:[]};
function now(){return new Date().toISOString()}
function event(type,at,fields={}){return {id:uid(),type,at,...fields}}
function validList(list,max,message){
 ensure(Array.isArray(list)&&list.length<=max,message);
 const ids=new Set();for(const item of list){ensure(item&&idValid(item.id)&&!ids.has(item.id),message);ids.add(item.id)}
}
function makeMilestone(input){
 ensure(input&&positive(input.percentage)&&input.percentage<100,'里程碑必须大于 0% 且小于 100%，最多 6 位小数。');
 ensure(rewardValid(input.points),'里程碑积分须为 0–1,000,000 的整数。');
 return {id:uid(),percentage:input.percentage,points:input.points,firstReachedAt:null};
}
export function createGoal(state,fields){
 ensure(fields&&textValid(fields.title,60),'请填写不超过 60 字的目标标题。');
 ensure(positive(fields.targetValue),'总进度须为正数，最多 6 位小数，上限 10 亿。');
 ensure(textValid(fields.unit,12),'请填写不超过 12 字的单位，如题、页、km。');
 ensure(rewardValid(fields.completionPoints),'完成奖励须为 0–1,000,000 的整数。');
 const deadline=fields.deadline||null;ensure(deadlineValid(deadline),'截止日期无效。');
 ensure(Array.isArray(fields.milestones||[])&&(fields.milestones||[]).length<=50,'最多设置 50 个里程碑。');
 const at=now(),goal={id:uid(),title:fields.title.trim(),icon:fields.icon===undefined?'target':fields.icon,targetValue:fields.targetValue,unit:fields.unit.trim(),completionPoints:fields.completionPoints,deadline,status:'active',createdAt:at,completedAt:null,progressEvents:[],milestones:(fields.milestones||[]).map(makeMilestone),history:[]};
 goal.history.push(event('created',at,{targetValue:goal.targetValue,completionPoints:goal.completionPoints,deadline}));
 validateGoals({goals:[goal]});ensure(state.goals.length<10000,'目标数量已达上限，请先导出备份。');state.goals.push(goal);return goal;
}
function setStatus(goal,status,reason,at){
 if(goal.status===status)return;
 goal.history.push(event('status',at,{from:goal.status,to:status,reason}));
 goal.status=status;goal.completedAt=status==='completed'?at:null;
}
function settle(previous,goal,at){
 const current=goalProgress(goal),target=goal.targetValue;
 ensure(Number.isFinite(current)&&current<=target,'进度不能超过目标总量，请减小本次进度。');
 const changes=[];
 for(const milestone of goal.milestones){
  const old=previous.milestones.find(m=>m.id===milestone.id);
  const wasReached=!!old&&milestoneReached(previous,old),reached=milestoneReached(goal,milestone);
  if(reached&&!milestone.firstReachedAt)milestone.firstReachedAt=at;
  if(wasReached!==reached)changes.push({milestoneId:milestone.id,percentage:milestone.percentage,points:milestone.points,action:reached?'grant':'revoke'});
 }
 const wasComplete=goalProgress(previous)===previous.targetValue,complete=current===target;
 const completion=wasComplete===complete?null:complete?'grant':'revoke';
 if(complete)setStatus(goal,'completed','progress',at);
 else if(goal.status==='completed')setStatus(goal,'active','progress',at);
 const delta=goalEarned(goal)-goalEarned(previous);
 if(changes.length||completion)goal.history.push(event('rewards',at,{changes,completion,delta}));
 return delta;
}
function updateGoal(state,id,change){
 const index=state.goals.findIndex(g=>g.id===id);ensure(index>=0,'目标不存在。');
 const previous=state.goals[index],goal=structuredClone(previous),at=now();
 change(goal,at);const pointsDelta=settle(previous,goal,at);
 ensure(balance(state)+pointsDelta>=0,`此次修改需扣回 ${-pointsDelta} 积分，当前余额不足。已兑换的积分不能撤回，修改未保存。`);
 validateGoals({goals:[goal]});state.goals[index]=goal;
 return {goalId:id,pointsDelta,status:goal.status};
}
export function addGoalProgress(state,id,value){
 ensure(positive(value),'进度必须为正数，最多 6 位小数。');
 return updateGoal(state,id,(goal,at)=>{
  ensure(goal.status==='active','请先恢复目标，再添加进度。');
  ensure(goal.progressEvents.length<100000,'进度记录数量已达上限。');
  goal.progressEvents.push({id:uid(),value,originalValue:value,createdAt:at,edits:[]});
 });
}
export function editGoalProgress(state,id,eventId,value){
 ensure(positive(value),'进度必须为正数，最多 6 位小数。');
 return updateGoal(state,id,(goal,at)=>{
  const progress=goal.progressEvents.find(p=>p.id===eventId);ensure(progress,'进度记录不存在。');
  if(progress.value===value)return;
  ensure(progress.edits.length<10000,'该记录的修改次数已达上限。');
  progress.edits.push({from:progress.value,to:value,at});progress.value=value;
 });
}
export function changeGoalStatus(state,id,status){
 return updateGoal(state,id,(goal,at)=>{
  ensure(transitions[goal.status]?.includes(status),'不支持这一状态变更。');setStatus(goal,status,'manual',at);
 });
}
export function changeGoalIcon(state,id,icon){
 ensure(iconValid(icon),'请选择有效的目标图标。');
 return updateGoal(state,id,goal=>{goal.icon=icon});
}
export function changeGoalDeadline(state,id,deadline){
 ensure(deadlineValid(deadline),'截止日期无效。');
 return updateGoal(state,id,(goal,at)=>{
  if(goal.deadline===deadline)return;
  goal.history.push(event('deadline',at,{from:goal.deadline,to:deadline}));goal.deadline=deadline;
 });
}
export function saveGoalMilestone(state,id,fields,milestoneId=null){
 const candidate=makeMilestone(fields);
 return updateGoal(state,id,goal=>{
  if(milestoneId){
   const milestone=goal.milestones.find(m=>m.id===milestoneId);ensure(milestone,'里程碑不存在。');
   ensure(!milestone.firstReachedAt,'已达成过的里程碑已锁定，不能修改。');
   milestone.percentage=candidate.percentage;milestone.points=candidate.points;
  }else{ensure(goal.milestones.length<50,'最多设置 50 个里程碑。');goal.milestones.push(candidate)}
 });
}
export function deleteGoalMilestone(state,id,milestoneId){
 return updateGoal(state,id,goal=>{
  const milestone=goal.milestones.find(m=>m.id===milestoneId);ensure(milestone,'里程碑不存在。');
  ensure(!milestone.firstReachedAt,'已达成过的里程碑已锁定，不能删除。');
  goal.milestones=goal.milestones.filter(m=>m.id!==milestoneId);
 });
}
export function validateGoals(state){
 validList(state.goals,10000,'目标数据无效。');
 for(const goal of state.goals){
  ensure(!Object.hasOwn(goal,'icon')||iconValid(goal.icon),'目标图标无效。');
  ensure(textValid(goal.title,60)&&textValid(goal.unit,12)&&positive(goal.targetValue)&&rewardValid(goal.completionPoints),'目标标题、总量、单位或积分无效。');
  ensure(Object.hasOwn(transitions,goal.status)&&timeValid(goal.createdAt)&&deadlineValid(goal.deadline),'目标状态或日期无效。');
  validList(goal.progressEvents,100000,'目标进度记录无效。');
  let total=0;
  for(const progress of goal.progressEvents){
   ensure(positive(progress.value)&&positive(progress.originalValue)&&timeValid(progress.createdAt),'进度须为正数，日期须有效。');
   ensure(Array.isArray(progress.edits)&&progress.edits.length<=10000,'进度修改历史无效。');
   let value=progress.originalValue;
   for(const edit of progress.edits){ensure(edit&&edit.from===value&&positive(edit.to)&&timeValid(edit.at),'进度修改历史不连续。');value=edit.to}
   ensure(value===progress.value,'进度与修改历史不一致。');
   total+=quantityUnits(progress.value);ensure(Number.isSafeInteger(total)&&total<=quantityUnits(goal.targetValue),'进度超过目标总量。');
  }
  validList(goal.milestones,50,'目标里程碑无效。');
  const percentages=new Set();
  for(const milestone of goal.milestones){
   ensure(positive(milestone.percentage)&&milestone.percentage<100&&!percentages.has(milestone.percentage)&&rewardValid(milestone.points),'里程碑百分比须唯一、大于 0 且小于 100，积分须为非负整数。');percentages.add(milestone.percentage);
   ensure(milestone.firstReachedAt===null||timeValid(milestone.firstReachedAt),'里程碑达成日期无效。');
  }
  validList(goal.history,100000,'目标历史无效。');
  const first=goal.history[0];
  ensure(first?.type==='created'&&first.at===goal.createdAt&&first.targetValue===goal.targetValue&&first.completionPoints===goal.completionPoints&&deadlineValid(first.deadline),'目标创建记录无效，总进度和完成奖励不可改写。');
  let status='active',deadline=first.deadline,completedAt=null,completionPaid=false,rewardTotal=0;
  const awards=new Set(),firstReached=new Map();
  for(const history of goal.history){
   ensure(timeValid(history.at),'目标历史时间无效。');
   if(history===first)continue;
   if(history.type==='status'){
    ensure(history.from===status&&Object.hasOwn(transitions,history.to),'目标状态历史不连续。');
    ensure(history.reason==='manual'?transitions[status].includes(history.to):history.reason==='progress'&&((history.to==='completed'&&status!=='completed')||(status==='completed'&&history.to==='active')),'目标状态变更无效。');
    status=history.to;completedAt=status==='completed'?history.at:null;
   }else if(history.type==='deadline'){
    ensure(history.from===deadline&&deadlineValid(history.to)&&history.to!==deadline,'截止日期历史不连续。');deadline=history.to;
   }else if(history.type==='rewards'){
    ensure(Array.isArray(history.changes)&&history.changes.length<=50&&[null,'grant','revoke'].includes(history.completion),'目标奖励历史无效。');
    let delta=0;const changed=new Set();
    for(const change of history.changes){
     const milestone=goal.milestones.find(m=>m.id===change?.milestoneId);
     ensure(milestone&&!changed.has(milestone.id)&&change.percentage===milestone.percentage&&change.points===milestone.points&&['grant','revoke'].includes(change.action),'已达成里程碑不能改写或删除。');changed.add(milestone.id);
     const grant=change.action==='grant';ensure(awards.has(milestone.id)!==grant,'里程碑奖励重复或回滚无效。');
     if(grant){awards.add(milestone.id);if(!firstReached.has(milestone.id))firstReached.set(milestone.id,history.at)}else awards.delete(milestone.id);
     delta+=grant?milestone.points:-milestone.points;
    }
    if(history.completion){const grant=history.completion==='grant';ensure(completionPaid!==grant,'完成奖励重复或回滚无效。');completionPaid=grant;delta+=grant?goal.completionPoints:-goal.completionPoints}
    ensure(delta===history.delta&&(history.changes.length>0||history.completion),'目标积分流水不一致。');rewardTotal+=delta;
   }else ensure(false,'目标历史类型无效。');
  }
  ensure(status===goal.status&&deadline===goal.deadline&&completedAt===goal.completedAt,'目标信息与历史不一致。');
  const completed=total===quantityUnits(goal.targetValue);
  ensure((goal.status==='completed')===completed&&completionPaid===completed,'目标完成状态或奖励不一致。');
  for(const milestone of goal.milestones){
   ensure(awards.has(milestone.id)===milestoneReached(goal,milestone),'里程碑奖励与进度不一致。');
   ensure(milestone.firstReachedAt===(firstReached.get(milestone.id)||null),'里程碑锁定记录无效。');
  }
  ensure(rewardTotal===goalEarned(goal),'目标积分与历史不一致。');
 }
 return state;
}
