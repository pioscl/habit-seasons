import {saveActivity,archiveActivity,recordActivity,undoActivity} from './activity-model.js';
import {today} from './core.js';

export function createActivityUI({getState,commit,modal,close,toast,esc,icon,iconPicker,render,confirm}){
 let archived=false,historyLimit=30;
 const recentRecords=new Map();
 const get=id=>{const a=getState().activities.find(a=>a.id===id);if(!a)throw new Error('活动不存在。');return a};
 const events=id=>getState().activityEvents.filter(e=>!id||e.activityId===id);
 const focusRecord=id=>document.querySelector(`[data-action="activity-record"][data-id="${id}"]`)?.focus({preventScroll:true});
 function renderToday(){
  const state=getState(),list=state.activities.filter(a=>!a.archived),counts=new Map();
  for(const e of state.activityEvents)if(e.date===today())counts.set(e.activityId,(counts.get(e.activityId)||0)+1);
  return `<section class="activities-section" aria-labelledby="activities-title"><div class="section-head activities-heading"><div><h2 id="activities-title">活动 <span>· 做了就记</span></h2><p class="sub">没有频率要求，每次都算数。</p></div><button class="text-btn" data-action="activity-manage" aria-haspopup="dialog">管理活动 ${icon('arrow')}</button></div>${list.length?`<ul class="activity-list">${list.map(a=>`<li class="activity-row"><button class="activity-copy" data-action="activity-detail" data-id="${a.id}" aria-label="查看${esc(a.name)}活动记录"><span class="activity-icon">${icon(a.icon)}</span><span><strong>${esc(a.name)}</strong>${a.description?`<small class="activity-description">${esc(a.description)}</small>`:''}<small>+${a.points} 积分 / 次${counts.has(a.id)?` · 今天已记录 ${counts.get(a.id)} 次`:''}</small></span></button><button class="btn outline activity-record" data-action="activity-record" data-id="${a.id}" aria-label="记录一次${esc(a.name)}">${icon('plus')} 记录一次</button></li>`).join('')}</ul>`:`<div class="activity-empty"><p>${state.activities.length?'活动已全部归档，可从管理中恢复。':'散步、游泳、骑行……做了值得记下的事，就添一笔。'}</p><button class="btn outline" data-action="activity-edit" aria-haspopup="dialog">${icon('plus')} 新建活动</button></div>`}</section>`;
 }
 function manage(){
  const list=getState().activities.filter(a=>a.archived===archived);
  modal('管理活动',`<div class="row"><p>设置一次，以后随时记录。</p><button class="text-btn" data-action="activity-edit">${icon('plus')} 新建活动</button></div><div class="section-tabs"><button data-action="activity-list-active" class="${!archived?'selected':''}" aria-pressed="${!archived}">使用中</button><button data-action="activity-list-archived" class="${archived?'selected':''}" aria-pressed="${archived}">已归档</button></div>${list.length?list.map(a=>`<div class="activity-row"><div class="activity-copy"><span class="activity-icon">${icon(a.icon)}</span><span><strong>${esc(a.name)}</strong><small>+${a.points} 积分 / 次</small></span></div><button class="text-btn" data-action="activity-edit" data-id="${a.id}" aria-label="编辑${esc(a.name)}">编辑</button>${archived?`<button class="text-btn" data-action="activity-restore" data-id="${a.id}" aria-label="恢复${esc(a.name)}">恢复</button>`:''}</div>`).join(''):`<p class="form-note">${archived?'没有已归档的活动。':'还没有使用中的活动，先新建一个吧。'}</p>`}`);
 }
 function edit(id){
  const a=id?get(id):{name:'',icon:'walk',description:'',points:5};
  modal(id?'编辑活动':'新建活动',`<form data-activity-form data-id="${id||''}"><label for="activity-name">活动名称</label><input id="activity-name" name="name" required maxlength="60" placeholder="例如：散步" value="${esc(a.name)}">${iconPicker(a.icon,'活动图标')}<label for="activity-points">单次积分</label><input id="activity-points" name="points" type="number" min="1" max="1000" step="1" required value="${a.points}"><label for="activity-description">活动说明 <span class="sub">可选</span></label><textarea id="activity-description" class="cycle-note-input" name="description" rows="2" maxlength="200" placeholder="例如：出门走一会儿，不包括通勤">${esc(a.description)}</textarea><p class="form-note">同一天可以记录多次，不设周期或截止日期。修改名称和积分只影响以后的记录。</p><div class="modal-actions"><button type="button" class="btn secondary" data-action="activity-manage">返回</button><button class="btn" type="submit">保存活动</button></div>${id?`<button type="button" class="text-btn activity-archive" data-action="${a.archived?'activity-restore':'activity-archive'}" data-id="${id}">${a.archived?'恢复活动':'归档活动'}</button>`:''}</form>`);
 }
 function renderHistory(id=null,limit=historyLimit){
  const logs=[...events(id)].reverse();
  return `<div class="activity-history">${logs.length?`<p class="form-note">${logs.length} 次活动记录 · ${logs.reduce((sum,e)=>sum+e.points,0)} 积分</p>${logs.slice(0,limit).map(e=>`<div class="activity-row"><div class="activity-copy"><span class="activity-icon">${icon(e.icon)}</span><span><strong>${esc(e.name)}</strong><small><time datetime="${e.createdAt}">${esc(new Date(e.createdAt).toLocaleString('zh-CN'))}</time> · +${e.points} 积分</small></span></div><button class="text-btn" data-action="activity-undo-confirm" data-id="${e.id}" aria-label="撤销${esc(e.name)}在${esc(new Date(e.createdAt).toLocaleString('zh-CN'))}的记录">撤销</button></div>`).join('')}${logs.length>limit?`<button class="text-btn activity-more" data-action="activity-more" data-id="${id||''}">再显示 30 条</button>`:''}`:'<p class="form-note">还没有活动记录。到今日页记录一次散步、游泳，或其他活动。</p>'}</div>`;
 }
 function detail(id){const a=get(id);modal('活动记录',`<div class="row"><h3>${esc(a.name)}</h3><button class="text-btn" data-action="activity-edit" data-id="${id}">编辑活动</button></div>${a.description?`<p class="activity-description">${esc(a.description)}</p>`:''}${a.archived?'<p class="form-note">活动已归档，历史和积分保留。</p>':''}${renderHistory(id)}`)}
 function undo(id){
  const event=commit(s=>undoActivity(s,id));
  if(document.querySelector('#dialog').open)detail(event.activityId);
  toast(`已撤销${event.name}，扣回 ${event.points} 积分`);
 }
 const actions={
  'activity-manage':manage,'activity-edit':edit,
  'activity-list-active':()=>{archived=false;manage()},'activity-list-archived':()=>{archived=true;manage()},
  'activity-detail':id=>{historyLimit=30;detail(id)},
  'activity-more':id=>{historyLimit+=30;if(id)detail(id);else render()},
  'activity-archive':id=>{commit(s=>archiveActivity(s,id));manage();toast('活动已归档，历史和积分保留')},
  'activity-restore':id=>{commit(s=>archiveActivity(s,id,false));manage();toast('活动已恢复')},
  'activity-record':id=>{
   // Renders replace buttons synchronously; keep the guard outside the DOM.
   const now=performance.now();if(now-(recentRecords.get(id)??-Infinity)<800)return;
   const event=commit(s=>recordActivity(s,id));recentRecords.set(id,now);focusRecord(id);
   toast(`已记录${event.name} · +${event.points} 积分`,{action:'activity-undo',id:event.id,label:'撤销'});
  },
  'activity-undo':undo,
  'activity-undo-confirm':id=>{const e=getState().activityEvents.find(e=>e.id===id);if(!e)throw new Error('这条活动记录已撤销或不存在。');confirm('撤销这次活动记录？',`${esc(e.name)} · ${esc(new Date(e.createdAt).toLocaleString('zh-CN'))}，将扣回 ${e.points} 积分。`,'activity-undo',id,'确认撤销')}
 };
 function submit(form){const data=new FormData(form),a=commit(s=>saveActivity(s,{name:data.get('name'),icon:data.get('icon'),points:Number(data.get('points')),description:data.get('description')||''},form.dataset.id||null));close();focusRecord(a.id);toast('活动已保存')}
 return {renderToday,renderHistory,actions,submit,resetView:()=>{archived=false;historyLimit=30;recentRecords.clear()}};
}
