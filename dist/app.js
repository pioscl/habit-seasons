import {LOCAL_DATA_KEY,HABIT_VIEW_KEY,clearStoredData} from './local-data.js';
import {dateField,initDatePickers,syncDateFields,closeDatePicker,validateDateFields} from './date-picker.js';
import {createGoalUI} from './goal-ui.js';
import {HABIT_ICON_GROUPS} from './habit-icons.js';
import {renderIcon} from './icons.js';
import {HABIT_ICONS,upgrade,canBackfill,backfillCheckIn,weekStart,canCheckIn,weekProgress,todayPlan,dayPlanSummary,today,parseDate,shiftDate,monthEnd,daysBetween,expected,scheduled,balance,earnedPoints,initialState,validate,uid,startCycle,checkIn,undoCheckIn,finishCycle,redeem,rewardAvailable,rewardRedeemed,saveReward,archiveReward,deleteReward,dateValid,frequencyValid,requiredCheckins,cycleOutcome,checkInReward,undoCheckInCost,weeklyAwards,cyclePoints} from './model.js';
export const icon=renderIcon;
const KEY=LOCAL_DATA_KEY;
const VIEW_KEY=HABIT_VIEW_KEY;
function readHabitView(){try{return localStorage.getItem(VIEW_KEY)==='detail'?'detail':'quick'}catch{return 'quick'}}
let habitView=readHabitView();
let state,storageError='',lastRaw=null,page='home',historyTab='cycles',rewardTab='shop',showArchived=false;
const el=document.querySelector('#app'),dialog=document.querySelector('#dialog');
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=d=>d.replaceAll('-','.');
const cycleNote=c=>c.note?.trim()?`<span class="cycle-note">${esc(c.note)}</span>`:'';
const difficulty={easy:'轻松',medium:'适中',hard:'挑战'};
const schedule=c=>c.frequency.type==='daily'?'每天':c.frequency.type==='weekly'?`每周 ${c.frequency.times} 次`:`每周 ${[1,2,3,4,5,6,0].filter(d=>c.frequency.days.includes(d)).map(d=>['日','一','二','三','四','五','六'][d]).join('、')}`;
const count=c=>state.checkins.filter(x=>x.cycleId===c.id).length;
const rate=c=>Math.round(count(c)/Math.max(expected(c),1)*100);
const cycleStatus=c=>({active:'进行中',completed:'已完成',failed:'未达标',ended:'提前结束'}[c.status]);
const thresholdText=c=>c.completionThreshold===null?'沿用原规则：到期后确认完成，不设达标比例。':`达标要求 ${c.completionThreshold}% · 至少完成 ${requiredCheckins(c)} / ${expected(c)} 次`;
const cycleNum=c=>state.cycles.filter(x=>x.templateId===c.templateId).findIndex(x=>x.id===c.id)+1;
const tone=t=>t.icon==='leaf'?'green':t.icon==='book'?'orange':'';
const habitIcon=t=>`<div class="habit-icon ${tone(t)}">${icon(t.icon)}</div>`;
function load({initialize=true}={}){try{lastRaw=localStorage.getItem(KEY);state=lastRaw?upgrade(JSON.parse(lastRaw)):initialState();if(!lastRaw&&initialize){localStorage.setItem(KEY,JSON.stringify(state));lastRaw=localStorage.getItem(KEY)}storageError=''}catch(e){state=initialState();storageError='本地数据无法读取或浏览器禁止存储。已有数据不会被覆盖；请先导出原始数据，或导入有效备份。'}}
function commit(fn,{replace=false}={}){if(storageError&&!replace)throw new Error('本地数据暂不可用，请先到数据与设置恢复备份。');const raw=localStorage.getItem(KEY);if(!replace&&raw!==lastRaw){load();render();throw new Error('另一个页面更新了数据，已刷新，请重试。')}const next=structuredClone(state);const result=fn(next);next.revision=(state.revision||0)+1;validate(next);const serialized=JSON.stringify(next);try{localStorage.setItem(KEY,serialized)}catch{throw new Error('保存失败，设备空间不足或浏览器禁止存储。本次操作未生效。')}state=next;lastRaw=serialized;storageError='';render();return result}
let toastTimer;function toast(msg){const t=document.querySelector('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3500)}
function modal(title,body){closeDatePicker();dialog.classList.remove('habit-record');dialog.innerHTML=`<div class="modal-head"><h2 id="dialog-title">${esc(title)}</h2><button class="close" data-action="close" aria-label="关闭">${icon('close')}</button></div><div class="modal-body">${body}<div class="error" role="alert" id="form-error"></div></div>`;if(!dialog.open)dialog.showModal();dialog.scrollTop=0;syncDateFields(dialog)}
function close(){closeDatePicker();dialog.close()}
function empty(title,text,button=''){return `<div class="card empty"><div class="empty-icon">${icon(page==='gift'?'gift':page==='history'?'history':'leaf')}</div><h3>${title}</h3><p>${text}</p>${button}</div>`}
const pageButton=(id,text)=>`<button class="btn" data-page="${id}">${text} ${icon('arrow')}</button>`;
function head(title,sub,action=''){
 const titles={'今日':'Today','进行中':'Today','习惯模板':'Habits','历程':'History','目标':'Goals','奖励':'Rewards','数据与设置':'Settings'};
 return `<div class="page-head"><div><div class="kicker page-kicker">${titles[title]||'HABIT SEASONS'}</div><h1>${title}</h1>${sub?`<p class="sub">${sub}</p>`:''}</div>${action}</div>`;
}

function home(){
 const active=state.cycles.filter(c=>c.status==='active');
 const summary=dayPlanSummary(state,active),summaryParts=[];
 if(summary.required)summaryParts.push(`必打已完成 ${summary.completedRequired}/${summary.required}`);
 if(summary.optional)summaryParts.push(`可选 ${summary.optional} 项`);
 if(summary.behind)summaryParts.push(`进度落后 ${summary.behind} 项`);
 const summaryText=summaryParts.join(" · ")||(summary.completed?`今日已完成 ${summary.completed} 项`:active.length?"今日暂无必打项":"让日常，有自己的节奏");
 const monday=weekStart(today()),weekDates=Array.from({length:7},(_,i)=>shiftDate(monday,i));
 const weekChecks=state.checkins.filter(x=>weekDates.includes(x.date));
 return `${head('今日',new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(parseDate(today())),`<button class="text-btn page-action" data-page="templates">${icon('plus')} 开始新一期</button>`)}
 <div class="content-grid"><section class="habits-section"><div class="section-head habit-section-head"><div class="habit-section-title"><h2>今天的习惯 <span>${active.length?`· ${active.length}`:''}</span></h2><span>${summaryText}</span></div>${active.length?habitViewSwitch():''}</div>${active.length?(habitView==='quick'?`<ul class="quick-habit-list" aria-label="快速打卡列表">${active.map(quickCycleRow).join('')}</ul>`:active.map(cycleCard).join('')):empty('从一个小习惯开始','创建一个习惯，设定这一期的时间。<br>你的第一笔记录，就从这里开始。',pageButton('templates','创建我的习惯'))}</section>
 <aside class="week-aside"><div class="section-head"><h2>这一周</h2><span>${+monday.slice(5,7)}.${+monday.slice(-2)} — ${+weekDates[6].slice(5,7)}.${+weekDates[6].slice(-2)}</span></div><div class="week-strip">${weekDates.map((d,i)=>`<div class="week-day ${d===today()?'is-today':''}" aria-label="${d}，${weekChecks.filter(x=>x.date===d).length} 次记录"><span>${['一','二','三','四','五','六','日'][i]}</span><b>${+d.slice(-2)}</b><i class="${weekChecks.some(x=>x.date===d)?'has-record':''}"></i></div>`).join('')}</div><div class="week-total"><strong>${weekChecks.length.toString().padStart(2,'0')}</strong><span>次记录<br>留在这一周</span></div><div class="aside-links"><button data-page="history">回看以往的周期 ${icon('arrow')}</button><button data-page="gift">查看我的积分与奖励 ${icon('arrow')}</button></div></aside></div>
 <div class="journal-footer"><p>微小的重复，也会留下痕迹。</p><span>HABIT SEASONS</span></div>`;
}

function habitViewSwitch(){return `<div class="habit-view-switch" role="group" aria-label="习惯显示方式">${[['detail','详细'],['quick','快速']].map(([value,label])=>`<button data-action="habit-view" data-id="${value}" aria-pressed="${habitView===value}">${label}</button>`).join('')}</div>`}
function weekRemaining(week){
 return week.target===0?'本周无计划':week.done>=week.target?'本周已达标':`还差 ${week.target-week.done} 次`;
}
const todayLabels={required:'今日必打',optional:'今日可选',behind:'进度落后',met:'本周已达标',rest:'今日休息',future:'尚未开始',expired:'待归档',inactive:'已归档'};
function cycleToday(c){
 const plan=todayPlan(state,c);
 return {...plan,due:plan.actionable,over:plan.kind==='expired',status:plan.done?'今日已完成':todayLabels[plan.kind]};
}
function todayStatus(activity){
 return `<span class="today-status ${activity.done?'is-done':`is-${activity.kind}`}">${activity.status}</span>`;
}
function todayExplanation(c,activity){
 if(c.frequency.type!=='weekly')return '';
 if(activity.kind==='behind')return `按剩余可执行日期，仍不足 ${activity.shortfall} 次。若已完成但漏记，可在本周补卡。`;
 if(activity.done)return '';
 if(activity.kind==='required')return `本周还差 ${activity.remaining} 次，含今天剩 ${activity.daysLeft} 天，今天需要完成。`;
 if(activity.kind==='optional')return `本周还差 ${activity.remaining} 次，含今天剩 ${activity.daysLeft} 天，可自由安排。`;
 return '';
}
function cycleCheckControl(c,activity){
 return `<button class="check-btn ${activity.done?'done':''}" role="checkbox" aria-checked="${activity.done}" data-action="${activity.done?'undo':'check'}" data-id="${c.id}" ${activity.due?'':'disabled'} aria-label="${activity.due?(activity.done?'撤销':'完成')+'今日'+esc(c.snapshot.name)+'，'+activity.status:esc(c.snapshot.name)+'，'+activity.status}">${activity.done?icon('check'):''}</button>`;
}
function quickCycleRow(c){
 const activity=cycleToday(c),week=activity.week;
 return `<li class="quick-habit-row ${activity.done?'is-done':''}"><button class="quick-check" role="checkbox" aria-checked="${activity.done}" data-action="${activity.done?'undo':'check'}" data-id="${c.id}" ${activity.due?'':'disabled'} aria-label="${activity.due?(activity.done?'撤销':'完成')+'今日'+esc(c.snapshot.name)+'，'+activity.status:esc(c.snapshot.name)+'，'+activity.status}"><span class="quick-check-box">${activity.done?icon('check'):''}</span></button><button class="quick-habit-detail" data-action="detail" data-id="${c.id}" aria-label="查看${esc(c.snapshot.name)}详情"><span class="quick-habit-copy"><span class="quick-habit-name">${esc(c.snapshot.name)}</span>${cycleNote(c)}<span class="quick-habit-today">${schedule(c)} · 本周 ${week.done} / ${week.target}${activity.kind==='behind'?`<span class="quick-habit-warning">剩余日期不足 ${activity.shortfall} 次</span>`:''}</span></span><span class="quick-habit-meta"><span class="habit-reward">+${c.snapshot.points}</span>${todayStatus(activity)}</span><span class="row-chevron">${icon('arrow')}</span></button></li>`;
}

function cycleCard(c){
 const activity=cycleToday(c),week=activity.week,note=todayExplanation(c,activity);
 return `<article class="habit-card"><div class="card-top"><div class="habit-title">${cycleCheckControl(c,activity)}<div><button class="habit-name-link" data-action="detail" data-id="${c.id}">${esc(c.snapshot.name)}</button>${cycleNote(c)}<p class="sub">${schedule(c)} · 本周 ${week.done} / ${week.target}</p></div></div><div class="habit-row-meta"><span class="habit-reward">+${c.snapshot.points}</span>${todayStatus(activity)}</div></div><div class="habit-row-body">${note?`<p class="habit-plan-note ${activity.kind==='behind'?'is-behind':''}">${note}</p>`:''}<div class="progress" role="progressbar" aria-label="${esc(c.snapshot.name)}计划完成率" aria-valuenow="${rate(c)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${rate(c)}%"></i></div><div class="row meta"><span>${count(c)} / ${expected(c)} 次 · ${rate(c)}%</span><span>${weekRemaining(week)}</span></div>${weeklyBonusNote(c)}<div class="card-footer"><span class="meta">${fmt(c.startDate)} — ${fmt(c.endDate)}</span><button class="text-btn" data-action="detail" data-id="${c.id}">本期记录 ${icon('arrow')}</button></div></div></article>`;
}

function templates(){const list=state.templates.filter(t=>t.archived===showArchived);return `${head('习惯模板','保存一个想法，在合适的时候开始。',`<button class="text-btn page-action" data-action="edit-template" aria-haspopup="dialog">${icon('plus')} 新建模板</button>`)}<div class="section-tabs"><button data-action="templates-active" class="${!showArchived?'selected':''}">我的模板</button><button data-action="templates-archived" class="${showArchived?'selected':''}">已停用</button></div><div class="template-grid">${list.map(t=>{const active=state.cycles.find(c=>c.templateId===t.id&&c.status==='active'),total=state.cycles.filter(c=>c.templateId===t.id).length;return `<article class="card"><div class="card-top">${habitIcon(t)}<button class="small-icon" data-action="edit-template" data-id="${t.id}" aria-label="编辑${esc(t.name)}">${icon('more')}</button></div><h3>${esc(t.name)}</h3><p class="sub">${difficulty[t.difficulty]} · 开始时设置频率</p><div class="row" style="margin-top:20px"><span class="coin">${icon('coin')} ${t.points} <span class="meta">Points / 次</span></span><button class="text-btn" data-action="template-history" data-id="${t.id}">${total?`已开启 ${total} 期`:'尚未开始'}</button></div><div class="card-footer">${t.archived?`<button class="btn secondary full" data-action="restore-template" data-id="${t.id}">恢复模板</button>`:active?`<button class="btn outline full" data-action="detail" data-id="${active.id}">第 ${cycleNum(active)} 期进行中 ${icon('arrow')}</button>`:`<button class="btn outline full" data-action="start" data-id="${t.id}">${icon('plus')} 开始一期</button>`}</div></article>`}).join('')}</div>${!list.length?empty('这里还没有模板','创建一个习惯模板，再为它开始新的一期。'):''}<p class="hint">${icon('lock')}修改模板只影响以后开始的周期，过去的记录会保留。</p>`}
function rewards(){return `${head('奖励','把积累的每一步，换成喜欢的事。',`<button class="text-btn page-action" data-action="edit-reward" aria-haspopup="dialog">${icon('plus')} 新建奖励</button>`)}<div class="card balance-card"><div><p class="sub">可用积分</p><strong>${balance(state).toLocaleString()} <span style="font-size:15px;font-weight:400">Points</span></strong><p class="sub">累计获得 ${earnedPoints(state)} · 已兑换 ${state.redemptions.reduce((a,r)=>a+r.cost,0)}</p></div>${icon('coin')}</div><div class="section-tabs"><button data-action="reward-shop" class="${rewardTab==='shop'?'selected':''}">待兑换</button><button data-action="reward-history" class="${rewardTab==='history'?'selected':''}">兑换记录 · ${state.redemptions.length}</button></div>${rewardTab==='history'?(state.redemptions.length?`<div class="card list">${[...state.redemptions].reverse().map(r=>`<div class="history-row"><div class="habit-title"><div class="habit-icon orange">${icon('gift')}</div><div><h3>${esc(r.name)}</h3><p class="sub">${new Date(r.redeemedAt).toLocaleString('zh-CN')}</p></div></div><span class="coin">−${r.cost} pts</span></div>`).join('')}</div>`:empty('还没有兑换记录','完成习惯、积累积分，再给自己一个奖励。')):`<div class="reward-grid">${state.rewards.filter(r=>rewardAvailable(state,r)).map(r=>`<article class="card"><div class="card-top"><div class="habit-icon orange">${icon('gift')}</div><button class="small-icon" data-action="edit-reward" data-id="${r.id}" aria-label="编辑${esc(r.name)}">${icon('more')}</button></div><h3>${esc(r.name)}</h3><div class="card-footer"><span class="reward-price">${r.cost} <small>Points</small></span><button class="btn ${balance(state)<r.cost?'secondary':''}" data-action="redeem" data-id="${r.id}" ${balance(state)<r.cost?'disabled':''}>${balance(state)<r.cost?`还差 ${r.cost-balance(state)}`:'兑换'}</button></div></article>`).join('')}</div>${!state.rewards.some(r=>rewardAvailable(state,r))?empty('留一个期待给自己','新建一个现实中的奖励，设置积分价格。<br>每个奖励只兑换一次，兑换后收入记录。'):''}${state.rewards.some(r=>r.archived&&!rewardRedeemed(state,r.id))?`<button class="text-btn" data-action="archived-rewards">查看已收起的奖励</button>`:''}`}`}
function history(){
 const closed=state.cycles.filter(c=>c.status!=='active'),complete=closed.filter(c=>c.status==='completed'),names=[...new Set(complete.map(c=>c.templateId))];
 const groups=new Map();for(const c of [...closed].sort((a,b)=>(b.endedAt||b.endDate).localeCompare(a.endedAt||a.endDate))){const year=(c.endedAt||c.endDate).slice(0,4);if(!groups.has(year))groups.set(year,[]);groups.get(year).push(c)}
 return `${head('历程','每一段认真度过的时间。')}<div class="history-totals"><div><strong>${complete.length}</strong><span>完成周期</span></div><div><strong>${names.length}</strong><span>坚持过的习惯</span></div><div><strong>${state.checkins.length}</strong><span>累计记录</span></div></div><div class="section-tabs"><button data-action="history-cycles" class="${historyTab==='cycles'?'selected':''}">全部周期</button><button data-action="history-completed" class="${historyTab==='completed'?'selected':''}">完成过的习惯</button></div>${historyTab==='cycles'?(closed.length?`<div class="history-timeline">${[...groups].map(([year,cycles])=>`<section class="year-group"><h2>${year}</h2><div>${cycles.map(historyRow).join('')}</div></section>`).join('')}</div>`:empty('这一页，留给以后的你','完成、未达标或提前结束的周期，<br>都会按年份珍藏在这里。')):(names.length?`<div class="completed-habits">${names.map(id=>{const cycles=complete.filter(c=>c.templateId===id),last=cycles.at(-1);return `<div class="completed-habit"><div><h3>${esc(last.snapshot.name)}</h3><p class="sub">完成 ${cycles.length} 期 · 记录 ${cycles.reduce((a,c)=>a+count(c),0)} 次</p></div><button class="text-btn" data-action="template-history" data-id="${id}">回看每一期 ${icon('arrow')}</button></div>`}).join('')}</div>`:empty('还没有完成过的习惯','按本期规则完成并归档后，<br>你的习惯就会出现在这里。'))}`;
}

function historyRow(c){
 return `<article class="history-row cycle-entry"><span class="cycle-index">${String(cycleNum(c)).padStart(2,'0')}</span><div class="cycle-entry-body"><button class="history-title" data-action="detail" data-id="${c.id}">${esc(c.snapshot.name)} ${icon('arrow')}</button>${cycleNote(c)}<p class="history-dates">${fmt(c.startDate)} — ${fmt(c.endedAt||c.endDate)}</p><p class="sub">${rate(c)}% 完成率 · ${count(c)} 次记录 <span class="history-status">${cycleStatus(c)}</span></p><div class="progress" role="progressbar" aria-label="${esc(c.snapshot.name)}计划完成率" aria-valuenow="${rate(c)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${rate(c)}%"></i></div></div></article>`;
}

function settings(){return `${head('数据与设置','留住这些记录，陪你走得更远。')}<div class="card list"><div class="settings-row"><div><h3>导出数据备份</h3><p>模板、习惯周期、目标、进度与积分历史、打卡和兑换记录，保存在一个 JSON 文件里。</p><p>${state.lastExportAt?`最近导出：${new Date(state.lastExportAt).toLocaleString('zh-CN')}`:'还没有导出过备份，建议每月保存一次。'}</p></div><button class="btn outline" data-action="export">导出备份</button></div><div class="settings-row"><div><h3>从备份恢复</h3><p>导入前会校验记录。恢复将替换当前数据，请先导出备份。</p></div><button class="btn secondary" data-action="import">导入备份</button><input id="import-file" type="file" accept=".json,application/json" hidden></div><div class="settings-row"><div><h3>添加到手机主屏幕</h3><p>iPhone：在 Safari 打开，点分享，再选择「添加到主屏幕」。<br>Android：在浏览器菜单选择「安装应用」或「添加到主屏幕」。<br>首次联网打开后，即可离线使用。</p></div></div><div class="settings-row"><div><h3>只保存在这台设备</h3><p>无需账号，不上传记录，也不会跨设备同步。清理浏览器数据、更换浏览器或设备前，请先导出。请固定使用同一个网址和入口。</p></div></div><div class="settings-row settings-danger"><div><h3>清除本地数据</h3><p>删除当前浏览器中的全部记录与显示偏好，回到首次使用状态。清除前建议先导出备份。</p></div><button class="btn danger" data-action="clear-data">清除数据</button></div></div><p class="hint">Habit Seasons · 版本 1.7 · 数据格式 v4</p>`}
function render(){
 el.innerHTML=`<header class="app-header"><button class="brand" data-page="home" aria-label="Habit Seasons 首页"><img src="./icon.svg" alt=""><span>Habit Seasons<small>个人习惯记录册</small></span></button><nav class="nav" aria-label="主导航">${[['home','今日'],['templates','习惯'],['goals','目标'],['gift','奖励'],['history','历程']].map(([id,n])=>`<button data-page="${id}" class="${page===id?'active':''}" ${page===id?'aria-current="page"':''}>${icon(id==='home'?'today':id)}<span>${n}</span></button>`).join('')}</nav><button class="header-settings" data-page="settings" aria-label="数据与设置">${icon('settings')}</button></header><main class="main"><div class="topbar"><span class="eyebrow">个人记录 · ${today().slice(0,4)}</span><button class="wallet-pill" data-page="gift" aria-label="可用积分 ${balance(state)}，查看奖励"><b>${balance(state).toLocaleString()}</b><span>可用积分</span>${icon('arrow')}</button></div>${storageError?`<div class="storage-alert" role="alert"><p>${esc(storageError)}</p><button class="text-btn" data-action="export">导出原始数据</button></div>`:''}${({home,templates,goals:goalUI.renderPage,gift:rewards,history,settings}[page]||home)()}${page!=='home'?`<footer class="app-footer"><span>HABIT SEASONS</span><button data-page="settings">${icon('lock')} 本地保存 · 数据与备份</button></footer>`:''}</main>`;
}

function choiceField(name,title,options,value,kind=''){
 return `<fieldset class="choice-field ${kind}"><legend>${title}</legend><div class="choice-options">${options.map(([v,label])=>`<label><input type="radio" name="${name}" value="${v}" ${String(value)===String(v)?'checked':''} required><span>${label}</span></label>`).join('')}</div></fieldset>`;
}
function iconPicker(selected,label='习惯图标'){
 const active=HABIT_ICON_GROUPS.findIndex(group=>group.icons.includes(selected));
 return `<fieldset class="icon-field"><legend>${esc(label)} <span id="selected-icon" aria-hidden="true">${icon(selected)}</span></legend>
 <div class="icon-categories" aria-label="图标分类">${HABIT_ICON_GROUPS.map((group,i)=>`<button type="button" data-action="icon-category" data-id="${i}" aria-pressed="${i===active}">${group.name}</button>`).join('')}</div>
 ${HABIT_ICON_GROUPS.map((group,i)=>`<div class="icon-picker" data-icon-group="${i}" ${i===active?'':'hidden'}>${group.icons.map(v=>`<label><input type="radio" name="icon" value="${v}" aria-label="${HABIT_ICONS[v]}" ${selected===v?'checked':''} required><span>${icon(v)}</span></label>`).join('')}</div>`).join('')}</fieldset>`;
}
function templateForm(id){
 const t=state.templates.find(t=>t.id===id)||{name:'',icon:'home',difficulty:'medium',points:10};
 modal(id?'编辑习惯模板':'新建习惯模板',`<form id="template-form" data-id="${id||''}">
 <label for="name">习惯名称</label><input id="name" name="name" required maxlength="60" placeholder="你想开始什么习惯？" value="${esc(t.name)}">
 ${iconPicker(t.icon)}
 ${choiceField('difficulty','难度',Object.entries(difficulty),t.difficulty,'segmented')}
 <label for="points">默认单次积分</label><input id="points" name="points" type="number" min="1" max="1000" required value="${t.points}">
 <p class="form-note">轻松默认 5，适中 10，挑战 20；也可以自行调整。开始一期时，可单独设置执行频率、本期积分和达标比例。</p>
 <div class="modal-actions">${id?`<button class="btn secondary" type="button" data-action="${t.archived?'restore-template':'archive-template'}" data-id="${id}">${t.archived?'恢复模板':'停用模板'}</button>`:''}<button class="btn" type="submit">保存模板</button></div></form>`)
}
function frequencyFields(){return `${choiceField('frequency','本期执行频率',[['daily','每天'],['weekdays','指定星期'],['weekly','每周次数']],'daily','segmented')}
 <div id="weekday-fields" hidden><fieldset class="choice-field"><legend>选择执行日</legend><div class="days">${[1,2,3,4,5,6,0].map(d=>`<label><input type="checkbox" name="day" value="${d}" ${[1,3,5].includes(d)?'checked':''}><span>${['日','一','二','三','四','五','六'][d]}</span></label>`).join('')}</div></fieldset></div>
 <div id="weekly-fields" hidden>${choiceField('times','每周完成几次',[1,2,3,4,5,6,7].map(n=>[n,String(n)]),3,'number-choices')}<p class="form-note">周一到周日自由安排，每天最多一次。首尾不足一周时，目标不超过可执行天数。</p></div>`}
function readFrequency(data){const type=data.get('frequency');return type==='weekly'?{type,times:Number(data.get('times'))}:type==='weekdays'?{type,days:data.getAll('day').map(Number)}:{type}}
function readCycleRules(data){return {points:Number(data.get('cyclePoints')),completionThreshold:Number(data.get('completionThreshold')),weeklyBonusPoints:data.get('weeklyBonusEnabled')?Number(data.get('weeklyBonusPoints')):0}}
function updateStartPreview(){
 const form=dialog.querySelector('#start-form');if(!form)return;
 const data=new FormData(form),frequency=readFrequency(data),startDate=data.get('startDate'),endDate=data.get('endDate'),rules=readCycleRules(data),preview=form.querySelector('#cycle-plan-preview');
 if(!dateValid(startDate)||!dateValid(endDate)||endDate<startDate||daysBetween(endDate,startDate)>3660||!frequencyValid(frequency)||!Number.isInteger(rules.completionThreshold)||rules.completionThreshold<1||rules.completionThreshold>100){preview.textContent='请选择有效日期、频率和达标比例。';return}
 const plan={startDate,endDate,frequency,...rules},total=expected(plan);
 preview.textContent=total?`本期计划 ${total} 次，至少完成 ${requiredCheckins(plan)} 次达标（${rules.completionThreshold}%）。`:'这段时间没有执行日，请调整日期或频率。';
}
function startForm(id){
 const t=state.templates.find(t=>t.id===id);modal('开始新的一期',`<form id="start-form" data-id="${id}"><div class="habit-title">${habitIcon(t)}<div><h3>${esc(t.name)}</h3><p class="sub" style="margin:5px 0 0">${difficulty[t.difficulty]} · 模板默认 +${t.points} pts / 次</p></div></div>
 <label for="cycle-note">本期备注 <span class="sub">可选</span></label><textarea class="cycle-note-input" id="cycle-note" name="note" rows="2" maxlength="200" aria-describedby="cycle-note-help" placeholder="例如：十二点半前睡觉"></textarea><p id="cycle-note-help" class="form-note">只记录这一期的具体约定，最多 200 字。</p>
 ${frequencyFields()}<label for="start-date-trigger">开始日期</label>${dateField({id:"start-date",name:"startDate",min:today(),value:today(),required:true,label:"开始日期"})}
 ${choiceField('duration','这一期持续多久',[['1','1 个月'],['4','4 个月'],['6','6 个月'],['12','1 年'],['custom','自定义']],'4','duration-choices')}
 <label for="end-date-trigger">结束日期（含当天）</label>${dateField({id:"end-date",name:"endDate",min:today(),value:monthEnd(today(),4),required:true,label:"结束日期"})}
 <section class="cycle-rules"><h3>本期规则</h3><div class="field-row"><div><label for="cycle-points">单次积分</label><input id="cycle-points" name="cyclePoints" type="number" min="1" max="1000" step="1" required value="${t.points}"></div><div><label for="completion-threshold">达标比例（%）</label><input id="completion-threshold" name="completionThreshold" type="number" min="1" max="100" step="1" required value="90"></div></div>
 <p id="cycle-plan-preview" class="form-note" aria-live="polite"></p>
 <label class="cycle-bonus-toggle" for="weekly-bonus-enabled"><span>周达标奖励<small>每周达标时，额外获得一次积分</small></span><input id="weekly-bonus-enabled" name="weeklyBonusEnabled" type="checkbox" role="switch"><span class="switch-track" aria-hidden="true"></span></label>
 <div id="weekly-bonus-fields" hidden><label for="weekly-bonus-points">每周额外积分</label><input id="weekly-bonus-points" name="weeklyBonusPoints" type="number" min="1" max="1000000" step="1" required disabled value="${t.points}"><p class="form-note">含首尾不足一周的计划，完成该周全部目标后发放。</p></div></section>
 <p class="form-note">开始后，本期规则固定。到期后由你结束并归档，系统判断是否达标；已得积分保留。</p><div class="modal-actions"><button class="btn" type="submit">开始第 ${state.cycles.filter(c=>c.templateId===id).length+1} 期 ${icon('arrow')}</button></div></form>`);updateStartPreview();
}
function weeklyBonusNote(c){
 if(!c.weeklyBonusPoints)return '';
 const week=weekProgress(state,c),awarded=week.target>0&&week.done>=week.target;
 return `<p class="cycle-bonus-note ${awarded?'week-achieved':''}">${week.target===0?'周达标奖励':awarded?'本周奖励已获得':'本周达标额外'} +${c.weeklyBonusPoints} pts</p>`;
}
function cycleRuleDetails(c){
 const awards=weeklyAwards(state,c.id);
 return `<p class="cycle-rule-note">${thresholdText(c)}${c.weeklyBonusPoints?`<br>每周达标额外 +${c.weeklyBonusPoints} pts，已获得 ${awards.reduce((sum,x)=>sum+x.points,0)} pts。`:''}</p>${awards.length?`<details class="cycle-awards"><summary>周达标奖励 · ${awards.length} 周</summary>${[...awards].reverse().map(a=>`<div class="row sub"><span>${fmt(a.weekStart)} 所在周</span><span>+${a.points} pts</span></div>`).join('')}</details>`:''}`;
}
function finishControls(c){
 if(c.status!=='active')return `<div class="modal-actions"><button class="btn" data-action="start-again" data-id="${c.templateId}">再开始新的一期</button></div>`;
 const due=today()>=c.endDate;
 return `<div class="modal-actions">${!due?`<button class="btn secondary" data-action="finish-ended" data-id="${c.id}" ${today()<c.startDate?'disabled':''}>提前结束</button>`:''}<button class="btn" data-action="finish-completed" data-id="${c.id}" ${due?'':'disabled'}>结束并归档</button></div><div class="form-note">${due?'本周内的漏卡仍可补上。归档后不能再打卡或补卡。':'到达计划结束日期后，可以结束并归档。'}</div>`;
}

function backfillCalendar(c){
 const now=today(),monday=weekStart(now);
 const days=Array.from({length:7},(_,i)=>{
  const date=shiftDate(monday,i),hit=state.checkins.some(x=>x.cycleId===c.id&&x.date===date),available=canBackfill(state,c,date);
  const status=hit?'已完成':date===now?'今天':date>now?'未到':!scheduled(c,date)?'非执行日':available?'可补卡':'本周已达标';
  return `<button class="backfill-day ${hit?'hit':''}" data-action="backfill" data-id="${c.id}/${date}" ${available?'':'disabled'} aria-label="${fmt(date)}，${status}"><span>周${['一','二','三','四','五','六','日'][i]}</span><strong>${+date.slice(5,7)}.${+date.slice(-2)}</strong><small>${hit?'已完成':available?'补卡':date===now?'今天':'—'}</small></button>`;
 }).join('');
 return `<section class="backfill-section" aria-label="本周补打卡"><h3>本周补打卡</h3><p>仅限本周一至昨天；补卡获得相同积分。</p><div class="backfill-week">${days}</div><p class="backfill-note">${c.frequency.type==='weekly'&&weekProgress(state,c).target>0&&weekProgress(state,c).done>=weekProgress(state,c).target?'本周目标已完成，无需补卡。':Array.from({length:7},(_,i)=>shiftDate(monday,i)).some(date=>canBackfill(state,c,date))?'点击可补卡的日期。今天请在首页打卡。':'本周暂无可补卡的日期。今天请在首页打卡。'}</p></section>`;
}
function detail(id){
 const c=state.cycles.find(c=>c.id===id),logs=state.checkins.filter(x=>x.cycleId===id).sort((a,b)=>a.date.localeCompare(b.date)),start=shiftDate(today(),-27),until=c.status==='active'?today():c.endedAt,elapsed=expected(c,until),isActive=c.status==='active',activity=cycleToday(c),planNote=todayExplanation(c,activity);
 modal('习惯记录',`<div class="record-heading"><span class="kicker">HABIT / ${String(cycleNum(c)).padStart(2,'0')}</span><h3>${esc(c.snapshot.name)}</h3>${cycleNote(c)}<p>${schedule(c)} · ${difficulty[c.snapshot.difficulty]}<span class="record-reward">+${c.snapshot.points} pts / 次</span></p></div><section class="record-section"><div class="record-section-head"><h3>当前周期</h3><span class="meta">${cycleStatus(c)}</span></div><p>${fmt(c.startDate)} — ${fmt(c.endDate)}${c.endedAt?`<br>实际结束 ${fmt(c.endedAt)}`:''}</p><div class="detail-stats"><div>完成记录<strong>${logs.length} <small>/ ${expected(c)}</small></strong></div><div>计划完成率<strong>${rate(c)}<small>%</small></strong></div><div>本期积分<strong>${cyclePoints(state,c)}<small>pts</small></strong></div></div><div class="progress" role="progressbar" aria-label="计划完成率" aria-valuenow="${rate(c)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${rate(c)}%"></i></div><p class="record-context">截至${c.frequency.type==='weekly'?(isActive?'本周':'结束所在周'):(isActive?'今天':'结束')}计划 ${elapsed} 次，已完成 ${logs.length} 次。</p>${cycleRuleDetails(c)}</section>${isActive?`<button class="btn full record-check" data-action="${activity.done?'record-undo':'record-check'}" data-id="${c.id}" ${activity.due?'':'disabled'}>${activity.done?icon('check'):icon('plus')}${activity.done?'今日已完成 · 撤销打卡':activity.due?`${activity.status} · 打卡 +${c.snapshot.points} pts`:activity.status}</button>${planNote?`<p class="habit-plan-note ${activity.kind==='behind'?'is-behind':''}">${planNote}</p>`:''}${backfillCalendar(c)}`:''}<section class="record-section"><div class="record-section-head"><h3>最近 28 天</h3><span class="meta">${logs.filter(x=>x.date>=start&&x.date<=today()).length} 次记录</span></div><div class="calendar">${Array.from({length:28},(_,i)=>{const d=shiftDate(start,i),hit=logs.some(x=>x.date===d);return `<span class="${hit?'hit':!scheduled(c,d)?'na':''}" title="${d} · ${hit?'已完成':scheduled(c,d)?'未打卡':'非执行日'}">${+d.slice(-2)}</span>`}).join('')}</div><p class="form-note">苔藓绿表示已完成。</p>${logs.length?`<details><summary>全部 ${logs.length} 次记录</summary><div class="record-logs">${[...logs].reverse().map(x=>`<div class="row sub"><span>${fmt(x.date)}</span><span>+${x.points} pts</span></div>`).join('')}</div></details>`:''}</section>${finishControls(c)}`);dialog.classList.add('habit-record');
}

function rewardForm(id){const r=id?state.rewards.find(x=>x.id===id):{name:'',cost:300};if(!r)throw new Error('奖励不存在。');if(id&&rewardRedeemed(state,id))throw new Error('已兑换的奖励不能修改，请新建一个奖励。');modal(id?'编辑奖励':'新建奖励',`<form id="reward-form" data-id="${id||''}"><label for="name">奖励名称</label><input id="name" name="name" required maxlength="60" placeholder="一件值得期待的事" value="${esc(r.name)}"><label for="cost">兑换所需积分</label><input type="number" id="cost" name="cost" min="1" max="1000000" required value="${r.cost}"><p class="form-note">每个奖励只能兑换一次，扣除积分后移入兑换记录。以后想再兑换，可以新建同名奖励。</p><div class="modal-actions">${id?`<button type="button" class="btn danger" data-action="delete-reward" data-id="${id}">删除奖励</button>`:''}<button class="btn" type="submit">${id?'保存奖励':'创建奖励'}</button></div></form>`)}
function confirm(title,body,action,id,label='确认'){modal(title,`<p>${body}</p><div class="modal-actions"><button class="btn secondary" data-action="close">取消</button><button class="btn" data-action="${action}" data-id="${id}">${label}</button></div>`)}
function clearDataConfirmation(){
 modal('清除本地数据？',`<p>将删除当前浏览器中的全部习惯模板、周期、目标、打卡、积分和奖励记录，并重置显示偏好。</p><p>清除后无法撤销。已导出的备份文件仍可用于恢复。</p><button class="text-btn" data-action="export">先导出备份 ${icon('arrow')}</button><div class="modal-actions"><button class="btn secondary" data-action="close">取消</button><button class="btn danger" data-action="confirm-clear-data">确认清除</button></div>`);
}
function clearLocalData(){
 try{clearStoredData(localStorage,lastRaw)}catch(error){
  if(error.code==='LOCAL_DATA_CHANGED'){load({initialize:false});close();render();toast(error.message);return}
  throw new Error('清除失败，浏览器暂不允许删除本地数据，请重试。');
 }
 state=initialState();lastRaw=null;storageError='';pendingImport=null;
 habitView='quick';historyTab='cycles';rewardTab='shop';showArchived=false;goalUI.resetView();page='home';
 close();render();window.scrollTo(0,0);toast('本地数据已清除');
}
function download(content,filename){const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
let pendingImport=null;
const goalUI=createGoalUI({getState:()=>state,commit,modal,close,toast,esc,icon,iconPicker,head,render,navigate:()=>{page='goals'},confirm});
const actions={
 'clear-data':clearDataConfirmation,'confirm-clear-data':clearLocalData,
 'record-check':id=>{const points=commit(s=>checkIn(s,id));detail(id);toast(`今日已完成，+${points} pts`)},
 'record-undo':id=>actions.undo(id),
 'habit-view':view=>{if(!['detail','quick'].includes(view))return;habitView=view;try{localStorage.setItem(VIEW_KEY,view)}catch{}render();document.querySelector('.habit-view-switch [aria-pressed="true"]')?.focus({preventScroll:true})},
 'icon-category':id=>{dialog.querySelectorAll('[data-icon-group]').forEach(group=>group.hidden=group.dataset.iconGroup!==id);dialog.querySelectorAll('[data-action="icon-category"]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.id===id)))},
 close, 'edit-template':templateForm,start:startForm,detail,'edit-reward':rewardForm,
 'templates-active':()=>{showArchived=false;render()},'templates-archived':()=>{showArchived=true;render()},
 'reward-shop':()=>{rewardTab='shop';render()},'reward-history':()=>{rewardTab='history';render()},
 'history-cycles':()=>{historyTab='cycles';render()},'history-completed':()=>{historyTab='completed';render()},
 check:id=>{const c=state.cycles.find(c=>c.id===id),points=commit(s=>checkIn(s,id));toast(`完成今天的一步，+${points} pts${points>c.snapshot.points?'（含周达标奖励）':''}`)},
 backfill:key=>{const [id,date]=key.split('/'),c=state.cycles.find(c=>c.id===id);if(!canBackfill(state,c,date))throw new Error('该日期当前不可补卡，请重新打开详情。');const reward=checkInReward(state,c,date);confirm('补上这一天？',`${esc(c.snapshot.name)} · ${fmt(date)}，确认后获得 ${reward.total} pts${reward.bonus?`（含周奖励 ${reward.bonus}）`:''}。补卡后无法撤销，请确认这一天确实完成了习惯。`,'confirm-backfill',key,'确认补卡')},
 'confirm-backfill':key=>{const [id,date]=key.split('/'),points=commit(s=>backfillCheckIn(s,id,date));detail(id);toast(`${fmt(date)} 已补卡，+${points} pts`)},
 undo:id=>{const c=state.cycles.find(c=>c.id===id),cost=undoCheckInCost(state,c);confirm('撤销今天的打卡？',`将扣回 ${cost} pts${cost>c.snapshot.points?'，包含因不再达标而撤回的周奖励':''}。`,'confirm-undo',id,'撤销打卡')},
 'confirm-undo':id=>{commit(s=>undoCheckIn(s,id));close();toast('已撤销今日打卡')},
 'archive-template':id=>{commit(s=>{s.templates.find(t=>t.id===id).archived=true});close();toast('模板已停用，周期和历史仍然保留')},
 'restore-template':id=>{commit(s=>{s.templates.find(t=>t.id===id).archived=false});close();toast('模板已恢复')},
 'delete-reward':id=>{const r=state.rewards.find(r=>r.id===id);if(!r)throw new Error('奖励不存在。');if(rewardRedeemed(state,id))throw new Error('已兑换的奖励需保留记录，不能删除。');confirm('删除这个奖励？',`「${esc(r.name)}」将被永久删除，无法恢复。不会扣除积分。`,'confirm-delete-reward',id,'确认删除')},
 'confirm-delete-reward':id=>{commit(s=>deleteReward(s,id));close();toast('奖励已删除')},
 'restore-reward':id=>{commit(s=>archiveReward(s,id,false));close();toast('奖励已恢复到待兑换')},
 'archived-rewards':()=>modal('已收起的奖励',state.rewards.filter(r=>r.archived&&!rewardRedeemed(state,r.id)).map(r=>`<div class="history-row"><span>${esc(r.name)}</span><div class="row"><button class="btn danger" data-action="delete-reward" data-id="${r.id}">删除</button><button class="btn secondary" data-action="restore-reward" data-id="${r.id}">恢复</button></div></div>`).join('')),
 'template-history':id=>{const cycles=state.cycles.filter(c=>c.templateId===id);modal('每一期的记录',cycles.length?[...cycles].reverse().map(historyRow).join(''):'<p>这个习惯还没有开始过。选一个时间，开启第一期。</p>')},
 'start-again':id=>{const t=state.templates.find(t=>t.id===id);if(t.archived)throw new Error('请先在习惯模板中恢复这个模板。');const c=state.cycles.find(c=>c.templateId===id&&c.status==='active');if(c){detail(c.id);return}startForm(id)},
 'finish-ended':id=>{const c=state.cycles.find(c=>c.id===id),empty=count(c)===0;confirm('提前结束这一期？',empty?'这一期还没有打卡，结束后将直接删除，不留下历史记录。习惯模板会保留，可以随时重新开始。':'已经执行过的每一次都会保留，获得的积分不变。这一期会记为「提前结束」，不计入完成的周期。','confirm-ended',id,empty?'结束并删除':'结束并归档')},
 'finish-completed':id=>{const c=state.cycles.find(c=>c.id===id);if(today()<c.endDate)throw new Error('尚未到达结束日期。');const result=cycleOutcome(state,c);confirm('结束并归档这一期？',`本期执行了 ${count(c)} / ${expected(c)} 次，完成率 ${rate(c)}%。${thresholdText(c)} 归档结果：${result==='completed'?'已完成':'未达标'}。已得积分保留。归档后不能继续打卡或补卡。`,'confirm-completed',id,'确认归档')},
 'confirm-ended':id=>{const result=commit(s=>finishCycle(s,id,'ended'));close();toast(result==='deleted'?'未执行的这一期已删除，模板仍保留':'这一期已收入历程')},
 'confirm-completed':id=>{const result=commit(s=>finishCycle(s,id,'completed'));close();toast(result==='completed'?'这一期已完成，已收入历程':'这一期未达标，记录和积分已保留')},
 redeem:id=>{const r=state.rewards.find(r=>r.id===id);if(!rewardAvailable(state,r))throw new Error('这个奖励已兑换或已收起，请新建奖励或恢复未兑换的奖励。');confirm('兑换这个奖励？',`${esc(r.name)} · ${r.cost} pts。兑换后余额为 ${balance(state)-r.cost} pts。兑换后移入记录，这个奖励不能重复兑换。请在现实中享受它。`,'confirm-redeem',id,'确认兑换')},
 'confirm-redeem':id=>{commit(s=>redeem(s,id));close();toast('兑换成功，已移入兑换记录')},
 export:()=>{if(storageError){download(lastRaw||localStorage.getItem(KEY)||'{}',`一期-原始数据-${today()}.json`);return}const copy=structuredClone(state);copy.lastExportAt=new Date().toISOString();download(JSON.stringify(copy,null,2),`一期-备份-${today()}.json`);commit(s=>{s.lastExportAt=copy.lastExportAt});toast('已导出，请妥善保存备份文件')},
 import:()=>document.querySelector('#import-file').click(),
 'confirm-import':()=>{if(!pendingImport)throw new Error('请重新选择备份文件。');validate(pendingImport);commit(s=>{for(const k of Object.keys(s))delete s[k];Object.assign(s,structuredClone(pendingImport))},{replace:true});pendingImport=null;close();toast('备份已恢复')}
};
Object.assign(actions,goalUI.actions);
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.page){page=b.dataset.page;render();window.scrollTo(0,0);return}const action=b.dataset.action;if(actions[action])try{actions[action](b.dataset.id)}catch(err){if(dialog.open)document.querySelector('#form-error').textContent=err.message;else toast(err.message)}});
document.addEventListener('submit',e=>{if(!validateDateFields(e.target)){e.preventDefault();return}if(e.target.matches('[data-goal-form]')){e.preventDefault();try{goalUI.submit(e.target)}catch(err){document.querySelector('#form-error').textContent=err.message}return}if(!e.target.matches('#template-form,#start-form,#reward-form'))return;e.preventDefault();const f=e.target,data=new FormData(f),id=f.dataset.id;try{if(f.id==='template-form'){const fields={name:data.get('name').trim(),icon:data.get('icon'),difficulty:data.get('difficulty'),points:Number(data.get('points'))};commit(s=>{if(id)Object.assign(s.templates.find(t=>t.id===id),fields);else s.templates.push({id:uid(),...fields,archived:false})});toast('模板已保存')}if(f.id==='start-form'){commit(s=>startCycle(s,id,data.get('startDate'),data.get('endDate'),readFrequency(data),{...readCycleRules(data),note:data.get('note')||''}));page='home';render();toast('新的一期，从这里开始')}if(f.id==='reward-form'){const fields={name:data.get('name').trim(),cost:Number(data.get('cost'))};commit(s=>saveReward(s,fields,id||null));rewardTab='shop';render();toast(id?'奖励已保存':'新奖励已创建')}close()}catch(err){document.querySelector('#form-error').textContent=err.message}});
document.addEventListener('change',async e=>{if(e.target.name==='frequency'){document.querySelector('#weekday-fields').hidden=e.target.value!=='weekdays';document.querySelector('#weekly-fields').hidden=e.target.value!=='weekly';}if(e.target.name==='weeklyBonusEnabled'){const enabled=e.target.checked,input=dialog.querySelector('#weekly-bonus-points');dialog.querySelector('#weekly-bonus-fields').hidden=!enabled;input.disabled=!enabled;if(enabled)input.value=dialog.querySelector('#cycle-points').value;}if(e.target.name==='difficulty')document.querySelector('#points').value={easy:5,medium:10,hard:20}[e.target.value];if(e.target.name==='duration'||e.target.id==='start-date'){const start=document.querySelector('#start-date').value,n=dialog.querySelector('input[name="duration"]:checked').value;if(start){document.querySelector('#end-date').min=start;if(n!=='custom')document.querySelector('#end-date').value=monthEnd(start,Number(n))}}if(e.target.id==='end-date')dialog.querySelector('input[name="duration"][value="custom"]').checked=true;if(e.target.closest('#start-form'))updateStartPreview();if(e.target.name==='icon')document.querySelector('#selected-icon').innerHTML=icon(e.target.value);if(e.target.id==='import-file'){const file=e.target.files[0];if(!file)return;try{if(file.size>10*1024*1024)throw new Error('文件超过 10 MB，请检查是否为正确的备份。');pendingImport=upgrade(JSON.parse(await file.text()));confirm('恢复这份备份？',`备份含 ${pendingImport.templates.length} 个模板、${pendingImport.cycles.length} 个习惯周期、${pendingImport.goals.length} 个目标、${pendingImport.checkins.length} 次打卡和 ${pendingImport.redemptions.length} 次兑换，可用积分 ${balance(pendingImport)}。当前数据将被替换；请确认已保存当前备份。`,'confirm-import','','替换并恢复')}catch(err){pendingImport=null;toast(err instanceof SyntaxError?'无法读取 JSON，请选择正确的备份文件。':err.message)}e.target.value=''}});
document.addEventListener('input',e=>{if(e.target.closest('#start-form'))updateStartPreview()});
window.addEventListener('storage',e=>{if(e.key===KEY){load({initialize:false});habitView=readHabitView();pendingImport=null;close();render();toast(e.newValue===null?'本地数据已在另一个页面清除':'记录已与另一个页面同步')}});
let currentDay=today();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&currentDay!==today()){currentDay=today();render()}});setInterval(()=>{if(currentDay!==today()){currentDay=today();render()}},60000);
initDatePickers();load();render();
if('serviceWorker'in navigator){
 let waitingWorker=null;
 const offerUpdate=worker=>{waitingWorker=worker;const button=document.createElement('button');button.className='update-app';button.textContent='新版本已就绪 · 点击更新';button.onclick=()=>{if(dialog.open){toast('请先保存或关闭当前表单，再更新。');return}waitingWorker.postMessage({type:'ACTIVATE_UPDATE'})};document.querySelector('.update-app')?.remove();document.body.append(button)};
 navigator.serviceWorker.register('./sw.js').then(reg=>{if(reg.waiting)offerUpdate(reg.waiting);reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)offerUpdate(worker)})})}).catch(()=>toast('离线缓存暂未启用，请联网重新打开一次。'));
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(waitingWorker)location.reload()});
}
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'get_habit_seasons',title:'查看习惯周期',description:'读取当前习惯周期、完成次数和可用积分，不修改数据。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(input&&Object.keys(input).length)throw new Error('不接受参数');return {balance:balance(state),cycles:state.cycles.map(c=>({id:c.id,name:c.snapshot.name,frequency:c.frequency,status:c.status,startDate:c.startDate,endDate:c.endDate,completed:count(c),planned:expected(c)}))}}})).catch(()=>{})}catch{}}
