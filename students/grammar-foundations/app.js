import {QuestionRenderer} from '../shared/student-question-renderer.js?v=1.0.1';
import {gradeQuestion} from '../shared/question-grader.js?v=2.1.2';
import {mountAiWilliHelper,decorateAiWilliFeedback} from '../shared/ai-willi.js?v=1.1.0';
import {installWillenaKeyboard,hideWillenaKeyboard} from '../shared/willena-keyboard.js?v=1.5.1';
import {startStudentHeaderData,subscribeStudentHeaderData} from '../shared/student-header-data.js?v=1.0.0';
import {createStudentHistoryNavigation} from '../shared/student-history-navigation.js?v=1.0.0';
import {createStudentSessionResume} from '../shared/student-session-resume.js?v=1.0.0';

const root=document.getElementById('screen');
const bottom=document.getElementById('bottom');
const nameEl=document.getElementById('user');
const pointsEl=document.getElementById('headerPoints');
const starsEl=document.getElementById('headerStars');
const avatarEl=document.getElementById('studentAvatar');
const PROGRESS_EDGE='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/grammar-foundations-student-v1';
const PROGRESS_API_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const CATALOG_URL='https://gxwfsqxyuufqtitspfqg.supabase.co/functions/v1/grammar-foundations-catalog';
let modules=[];
let progressMap=new Map();
let state={group:null,module:null,stage:null,index:0,score:0,renderer:null,checked:false,results:[],resultSaved:false};
let nav=null;
const sessionStore=createStudentSessionResume({appId:'grammar-foundations'});
sessionStore.installBeforeUnload();

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const koTitle=x=>x?.koreanTitle||x?.title||'';
const enTitle=x=>x?.englishTitle||'';
const token=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
function setBottom(html=''){bottom.innerHTML=html;bottom.hidden=!html}
function currentQuestion(){return state.stage?.questions?.[state.index]||null}
function progressKey(moduleId,stageId){return `${moduleId}:${stageId}`}
function stageProgress(moduleId,stageId){return progressMap.get(progressKey(moduleId,stageId))||null}
function stageUnlocked(mod,index){return index===0||Boolean(stageProgress(mod.id,mod.stages[index-1]?.id)?.passed)}
function stagePct(row){return row?.total?Math.round((Number(row.best_score||0)/Number(row.total))*100):0}
function modulePct(mod){if(!mod.stages.length)return 0;const passed=mod.stages.filter(s=>stageProgress(mod.id,s.id)?.passed).length;return Math.round((passed/mod.stages.length)*100)}
function passedCount(mod){return mod.stages.filter(s=>stageProgress(mod.id,s.id)?.passed).length}
function currentStage(mod){for(let i=0;i<mod.stages.length;i++){if(!stageProgress(mod.id,mod.stages[i].id)?.passed&&stageUnlocked(mod,i))return mod.stages[i]}return mod.stages[mod.stages.length-1]||null}
function findModule(id){return modules.find(m=>m.id===id)||null}
function findStage(mod,id){return mod?.stages?.find(s=>s.id===id)||null}
function passScore(mod){return Number(mod?.passScore)||8}
function groupNumber(mod){return Number(mod?.groupNumber)||1}
function groups(){
  const map=new Map();
  modules.forEach(mod=>{const n=groupNumber(mod);if(!map.has(n))map.set(n,[]);map.get(n).push(mod)});
  return [...map.entries()].sort((a,b)=>a[0]-b[0]).map(([number,items])=>({number,items:items.sort((a,b)=>(Number(a.groupOrder)||0)-(Number(b.groupOrder)||0))}));
}
function groupStats(group){
  const allStages=group.items.flatMap(m=>m.stages.map(s=>({module:m,stage:s})));
  const passed=allStages.filter(x=>stageProgress(x.module.id,x.stage.id)?.passed).length;
  const total=allStages.length;
  const pct=total?Math.round(passed/total*100):0;
  return {passed,total,pct,sets:group.items.length};
}
function resetRound(mod=null,stage=null){
  state={group:mod?groupNumber(mod):state.group,module:mod,stage,index:0,score:0,renderer:null,checked:false,results:[],resultSaved:false};
}
function saveRoundSnapshot(resumeIndex=state.index){
  if(!state.module||!state.stage)return null;
  return sessionStore.save({
    kind:'foundation',moduleId:state.module.id,stageId:state.stage.id,
    index:Math.max(0,Number(resumeIndex)||0),score:Number(state.score)||0,
    results:Array.isArray(state.results)?state.results:[],total:state.stage.questions.length
  });
}
function restoreRound(mod,stage){
  const row=sessionStore.load();
  if(!row||String(row.moduleId)!==String(mod?.id)||String(row.stageId)!==String(stage?.id))return false;
  const index=Math.max(0,Math.min(Number(row.index)||0,stage.questions.length));
  if(index>=stage.questions.length){sessionStore.clear();return false}
  state={group:groupNumber(mod),module:mod,stage,index,score:Number(row.score)||0,renderer:null,checked:false,results:Array.isArray(row.results)?row.results:[],resultSaved:false};
  sessionStore.setActive(true);
  return true;
}
function resumeRoute(){
  const row=sessionStore.load();if(!row)return null;
  const mod=findModule(row.moduleId),stage=findStage(mod,row.stageId),idx=mod?.stages?.findIndex(s=>s.id===stage?.id)??-1;
  if(!mod||!stage||idx<0||!stageUnlocked(mod,idx)){sessionStore.clear();return null}
  return restoreRound(mod,stage)?{view:'practice',moduleId:mod.id,stageId:stage.id}:null;
}

async function refreshToken(){
  try{
    const routed=window.WillenaAPI?.fetch?window.WillenaAPI.fetch.bind(window.WillenaAPI):fetch;
    const res=await routed(`/.netlify/functions/supabase_auth?action=refresh&_=${Date.now()}`,{credentials:'include',cache:'no-store'});
    const data=await res.json().catch(()=>({}));
    if(res.ok&&data?.success&&data.access_token){window.WillenaAPI?.setLocalTokens?.(data.access_token,data.refresh_token||'');return data.access_token}
  }catch(e){console.warn('[grammar-foundations] token refresh failed',e)}
  return '';
}
async function requestProgressEdge(action,options,access){
  const headers={...(options.headers||{}),Authorization:`Bearer ${access}`,apikey:PROGRESS_API_KEY};
  return fetch(`${PROGRESS_EDGE}?action=${encodeURIComponent(action)}`,{...options,headers,cache:'no-store',credentials:'omit'});
}
async function progressEdge(action,options={}){
  let access=token()||await refreshToken();
  if(!access)throw new Error('AUTH_REQUIRED');
  let res=await requestProgressEdge(action,options,access);
  if(res.status===401){access=await refreshToken();if(!access)throw new Error('AUTH_REQUIRED');res=await requestProgressEdge(action,options,access)}
  const text=await res.text();let data={};
  try{data=JSON.parse(text)}catch{throw new Error(`Invalid progress response (${res.status})`)}
  if(!res.ok||data.success===false)throw new Error(data.error||`Progress request failed (${res.status})`);
  return data;
}
async function loadCatalog(){
  const res=await fetch(`${CATALOG_URL}?_=${Date.now()}`,{cache:'no-store'});
  if(!res.ok)throw new Error(`catalog ${res.status}`);
  const data=await res.json();
  modules=Array.isArray(data.sets)?data.sets:[];
  if(!modules.length)throw new Error('No published Grammar Foundations sets');
}
async function loadProgress(){
  try{
    const data=await progressEdge('progress');
    progressMap=new Map((data.progress||[]).map(row=>[progressKey(row.module_id,row.stage_id),row]));
  }catch(e){console.warn('[grammar-foundations] progress load failed',e);progressMap=new Map()}
}
async function saveStageResult(){
  const required=passScore(state.module);
  const payload={module_id:state.module.id,stage_id:state.stage.id,score:state.score,total:state.stage.questions.length,required_score:required,results:state.results};
  try{
    const data=await progressEdge('save_stage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(data.progress)progressMap.set(progressKey(data.progress.module_id,data.progress.stage_id),data.progress);
    return true;
  }catch(e){console.error('[grammar-foundations] progress save failed',e);return false}
}

function stepCard(group){
  const stats=groupStats(group),names=group.items.map(koTitle).filter(Boolean).join(' · ');
  return `<button class="gf-step-card exam-card" data-open-group="${group.number}"><div class="gf-target-head exam-head"><div class="gf-target-copy"><div class="exam-school">GRAMMAR FOUNDATIONS</div><h2 class="exam-title">Step ${group.number}</h2><div class="exam-book">${esc(names)}</div><div class="exam-meta"><span class="pill">${stats.sets} grammar sets</span><span class="pill">${stats.passed}/${stats.total} levels complete</span></div></div><div class="ring gf-ring" style="--p:${stats.pct}%"><b>${stats.pct}%</b></div></div><span class="gf-open-hint">Open Step ${group.number} →</span></button>`;
}
function lessonCard(mod){
  const pct=modulePct(mod),done=passedCount(mod),next=currentStage(mod),required=passScore(mod);
  return `<button class="gf-lesson-card exam-card" data-open-module="${esc(mod.id)}"><div class="gf-target-head exam-head"><div class="gf-target-copy"><div class="exam-school">${esc(mod.lesson||`Step ${groupNumber(mod)}`)}</div><h2 class="exam-title">${esc(koTitle(mod))}</h2><div class="exam-book">${esc(enTitle(mod))} · ${done}/${mod.stages.length} levels complete</div><div class="exam-meta"><span class="pill">${done===mod.stages.length?'Complete':next?`Next: Level ${next.number}`:'No levels'}</span><span class="pill">${required}/10 to pass</span></div></div><div class="ring gf-ring" style="--p:${pct}%"><b>${pct}%</b></div></div><span class="gf-open-hint">Open lesson →</span></button>`;
}
function stageCard(mod,s,index){
  const row=stageProgress(mod.id,s.id),unlocked=stageUnlocked(mod,index),passed=Boolean(row?.passed),pct=stagePct(row);
  const saved=sessionStore.load(),inProgress=Boolean(saved&&String(saved.moduleId)===String(mod.id)&&String(saved.stageId)===String(s.id));
  const status=inProgress?`In progress · ${Math.min(Number(saved.index)||0,s.questions.length)}/${s.questions.length}`:passed?`Passed · ${row.best_score}/${row.total}`:row?`Best ${row.best_score}/${row.total}`:unlocked?'Ready':'Locked';
  const cls=passed?' passed':unlocked?' active':' locked';
  return `<button class="gf-stage-card tile${cls}" data-module="${esc(mod.id)}" data-stage="${esc(s.id)}" ${unlocked?'':'disabled'}><div class="gf-stage-card-copy"><div class="gf-stage-label">LEVEL ${s.number}</div><h3>${esc(koTitle(s))}</h3><small>${esc(enTitle(s))}</small><span class="metric">${esc(status)}</span>${row?`<small>${row.attempt_count} attempt${row.attempt_count===1?'':'s'}</small>`:''}</div><div class="ring gf-stage-ring" style="--p:${pct}%"><b>${pct}%</b></div></button>`;
}

function renderHome(){
  state={group:null,module:null,stage:null,index:0,score:0,renderer:null,checked:false,results:[],resultSaved:false};setBottom('');
  root.innerHTML=`<h1 class="gf-title">중학교 문법 기초</h1><div class="gf-kicker gf-title-en">Middle School Grammar Foundations</div><p class="gf-subtitle">Step을 골라 문법을 차근차근 완성하세요.</p><div class="gf-targets gf-step-grid">${groups().map(stepCard).join('')}</div>`;
  root.querySelectorAll('[data-open-group]').forEach(btn=>btn.onclick=()=>nav.navigate({view:'group',group:Number(btn.dataset.openGroup)}));
}
function renderGroup(number){
  const group=groups().find(g=>g.number===Number(number));if(!group)return nav.replace({view:'home'});
  state={group:group.number,module:null,stage:null,index:0,score:0,renderer:null,checked:false,results:[],resultSaved:false};setBottom('');
  const stats=groupStats(group);
  root.innerHTML=`<button class="back" id="groupBack">← Grammar Foundations</button><div class="gf-step-heading"><div><div class="gf-kicker">GRAMMAR FOUNDATIONS</div><h1 class="gf-title">Step ${group.number}</h1><p class="gf-subtitle">${stats.sets}개 문법 항목 · ${stats.passed}/${stats.total} levels complete</p></div><div class="ring gf-ring" style="--p:${stats.pct}%"><b>${stats.pct}%</b></div></div><div class="gf-targets">${group.items.map(lessonCard).join('')}</div>`;
  document.getElementById('groupBack').onclick=()=>nav.back();
  root.querySelectorAll('[data-open-module]').forEach(btn=>btn.onclick=()=>nav.navigate({view:'module',moduleId:btn.dataset.openModule}));
}
function renderModule(mod){
  if(!mod)return nav.replace({view:'home'});const group=groupNumber(mod);
  state={group,module:mod,stage:null,index:0,score:0,renderer:null,checked:false,results:[],resultSaved:false};setBottom('');
  const pct=modulePct(mod),done=passedCount(mod),required=passScore(mod),next=currentStage(mod);
  root.innerHTML=`<button class="back" id="moduleBack">← Step ${group}</button><section class="gf-module-overview exam-card"><div class="gf-target-head exam-head"><div class="gf-target-copy"><div class="exam-school">Step ${group}</div><h2 class="exam-title">${esc(koTitle(mod))}</h2><div class="exam-book">${esc(enTitle(mod))} · ${done}/${mod.stages.length} levels complete</div><div class="exam-meta"><span class="pill">${done===mod.stages.length?'Complete':next?`Next: Level ${next.number}`:'No levels'}</span><span class="pill">${required}/10 to pass</span></div></div><div class="ring gf-ring" style="--p:${pct}%"><b>${pct}%</b></div></div></section><div class="gf-level-heading"><div><div class="gf-kicker">Lesson levels</div><h2>Choose a level</h2></div><span>${done}/${mod.stages.length} complete</span></div><div class="gf-stage-grid">${mod.stages.map((s,i)=>stageCard(mod,s,i)).join('')}</div>`;
  document.getElementById('moduleBack').onclick=()=>nav.back();
  root.querySelectorAll('[data-stage]:not([disabled])').forEach(btn=>btn.onclick=()=>nav.navigate({view:'guide',moduleId:btn.dataset.module,stageId:btn.dataset.stage}));
}
function renderGuide(mod,stage){
  const idx=mod?.stages?.findIndex(s=>s.id===stage?.id)??-1;if(!mod||!stage||idx<0||!stageUnlocked(mod,idx))return nav.replace({view:'module',moduleId:mod?.id});
  resetRound(mod,stage);setBottom('');const row=stageProgress(mod.id,stage.id),hasResume=sessionStore.matches(mod.id,stage.id),saved=sessionStore.load();
  const startLabel=hasResume?`이어하기 · ${Math.min(Number(saved?.index)||0,stage.questions.length)}/${stage.questions.length}`:`${stage.questions.length}문제 시작 →`;
  root.innerHTML=`<button class="back" id="guideBack">← ${esc(koTitle(mod))}</button><div class="gf-guide"><div class="gf-kicker">Step ${state.group} · Level ${stage.number}</div><h2>${esc(koTitle(stage))}</h2><p>${esc(enTitle(stage))}</p>${stage.subtitle?`<p>${esc(stage.subtitle)}</p>`:''}${row?`<div class="gf-guide-score">Best ${row.best_score}/${row.total} · ${row.attempt_count} attempt${row.attempt_count===1?'':'s'}</div>`:''}${hasResume?'<div class="gf-guide-score">진행 중인 학습이 저장되어 있어요.</div>':''}<div class="gf-rule">${esc(stage.guide?.rule||'')}</div><div class="gf-example-list">${(stage.guide?.examples||[]).map(x=>`<div class="gf-example">${esc(x)}</div>`).join('')}</div><div class="gf-actions"><button class="gf-btn secondary" id="backModule">목록</button><button class="gf-btn primary" id="startStage">${startLabel}</button></div></div>`;
  document.getElementById('guideBack').onclick=()=>nav.back();
  document.getElementById('backModule').onclick=()=>nav.navigate({view:'module',moduleId:mod.id});
  document.getElementById('startStage').onclick=()=>nav.navigate({view:'practice',moduleId:mod.id,stageId:stage.id});
}
function renderPractice(mod,stage,{source}={}){
  if(!mod||!stage)return nav.replace({view:'home'});
  const same=state.module?.id===mod.id&&state.stage?.id===stage.id;
  if(!same||source==='push'||source==='init'){
    if(!restoreRound(mod,stage)){resetRound(mod,stage);saveRoundSnapshot(0)}
  }
  state.group=groupNumber(mod);state.module=mod;state.stage=stage;
  if(state.index>=stage.questions.length)state.index=Math.max(0,stage.questions.length-1);
  saveRoundSnapshot(state.index);
  renderQuestion();
}
function renderQuestion(){
  const q=currentQuestion();if(!q){nav.navigate({view:'result',moduleId:state.module.id,stageId:state.stage.id});return}
  state.checked=false;const pct=Math.round((state.index/state.stage.questions.length)*100);
  root.innerHTML=`<button class="back" id="questionBack">← Level ${state.stage.number}</button><div class="gf-question-head"><div><div class="gf-kicker">Step ${state.group} · ${esc(koTitle(state.module))} · Level ${state.stage.number}</div><b>${esc(koTitle(state.stage))}</b><small>${esc(enTitle(state.stage))}</small></div><span class="gf-progress">${state.index+1} / ${state.stage.questions.length}</span></div><div class="progress gf-round-progress"><i style="width:${pct}%"></i></div><div class="gf-question-card" id="questionHost"></div>`;
  document.getElementById('questionBack').onclick=()=>nav.back();
  const host=document.getElementById('questionHost');
  state.renderer=new QuestionRenderer(host).render(q,{onChange:(_,has)=>{const btn=document.getElementById('checkAnswer');if(btn&&!state.checked)btn.disabled=!has}});
  setBottom('<button id="checkAnswer" disabled>Check Answer</button>');document.getElementById('checkAnswer').onclick=checkAnswer;
}
async function checkAnswer(){
  const q=currentQuestion(),renderer=state.renderer,btn=document.getElementById('checkAnswer');if(!q||!renderer||!btn)return;
  if(state.checked){
    state.index+=1;saveRoundSnapshot(state.index);
    if(state.index>=state.stage.questions.length){await nav.navigate({view:'result',moduleId:state.module.id,stageId:state.stage.id});return}
    renderQuestion();return;
  }
  btn.disabled=true;renderer.setDisabled(true);const response=renderer.getResponse();let result;
  try{result=await gradeQuestion(q,response)}catch(e){console.error('[grammar-foundations] grading failed',e);btn.disabled=false;renderer.setDisabled(false);return}
  state.checked=true;if(result.correct)state.score+=1;
  state.results.push({questionId:q.id,sourceKey:q.metadata?.sourceKey||null,correct:!!result.correct,response});
  saveRoundSnapshot(state.index+1);
  renderer.showFeedback(result);decorateAiWilliFeedback(root,result);
  if(!result.correct)mountAiWilliHelper({container:root,question:q,response,result,section:'grammar',practiceType:'grammar_foundations'});
  btn.disabled=false;btn.textContent=state.index===state.stage.questions.length-1?'Finish':'Next Question →';
}
async function renderResult(mod,stage){
  if(!mod||!stage)return nav.replace({view:'home'});
  state.group=groupNumber(mod);state.module=mod;state.stage=stage;setBottom('');sessionStore.clear();
  const required=passScore(mod),passed=state.score>=required,total=stage.questions.length;
  root.innerHTML=`<div class="gf-result"><div class="gf-kicker">Step ${state.group} · ${esc(koTitle(mod))} · ${esc(koTitle(stage))}</div><div class="gf-score">${state.score}/${total}</div><div class="gf-pass">${passed?'Passed ✓':'Redo this level'}</div><p id="saveStatus">${state.resultSaved?'Progress saved':'Saving progress…'}</p></div>`;
  let saved=state.resultSaved;
  if(!saved){saved=await saveStageResult();state.resultSaved=saved}
  const row=stageProgress(mod.id,stage.id),next=nextStage();
  root.innerHTML=`<div class="gf-result"><div class="gf-kicker">Step ${state.group} · ${esc(koTitle(mod))} · Level ${stage.number}</div><h2>${esc(koTitle(stage))}</h2><p>${esc(enTitle(stage))}</p><div class="gf-score">${state.score}/${total}</div><div class="gf-pass">${passed?'Passed ✓':'Redo this level'}</div><p>${passed?'좋아요. 다음 단계로 넘어갈 준비가 됐어요.':`통과하려면 ${required}/${total} 이상이 필요해요.`}</p>${row?`<div class="gf-result-best">Best ${row.best_score}/${row.total} · ${row.attempt_count} attempts</div>`:''}${saved?'':'<div class="gf-save-warning">Progress could not be saved. You can retry this round.</div>'}<div class="gf-result-actions"><button class="gf-btn secondary" id="resultModule">레벨 목록</button>${passed&&next?'<button class="gf-btn secondary" id="nextGuide">다음 레벨 보기</button>':''}<button class="gf-btn primary" id="redoStage">${passed?'다시 풀기':'Redo →'}</button></div></div>`;
  document.getElementById('resultModule').onclick=()=>nav.navigate({view:'module',moduleId:mod.id});
  document.getElementById('redoStage').onclick=()=>nav.navigate({view:'guide',moduleId:mod.id,stageId:stage.id});
  if(passed&&next)document.getElementById('nextGuide').onclick=()=>nav.navigate({view:'guide',moduleId:mod.id,stageId:next.id});
}
function nextStage(){const i=state.module?.stages?.findIndex(s=>s.id===state.stage?.id)??-1;return i>=0?state.module.stages[i+1]||null:null}

function normalizeRoute(route={}){
  const view=['home','group','module','guide','practice','result'].includes(String(route.view))?String(route.view):'home';
  const out={view};
  if(view==='group')out.group=Number(route.group)||1;
  if(['module','guide','practice','result'].includes(view))out.moduleId=String(route.moduleId||'');
  if(['guide','practice','result'].includes(view))out.stageId=String(route.stageId||'');
  return out;
}
function validateRoute(route){
  if(route.view==='home')return true;
  if(route.view==='group')return Number.isFinite(route.group)&&route.group>0;
  if(!route.moduleId)return false;
  if(['guide','practice','result'].includes(route.view)&&!route.stageId)return false;
  return true;
}
async function navigationGuard(prev,next){
  if(prev?.view!=='practice'||next?.view==='result'||!sessionStore.isActive())return true;
  return sessionStore.confirmExit('진행 중인 학습은 저장되어 있습니다. 지금 나가도 다음에 이어서 할 수 있어요. 나가시겠어요?');
}
function renderRoute(route,meta={}){
  hideWillenaKeyboard();window.scrollTo({top:0,behavior:'auto'});
  if(route.view==='home')return renderHome();
  if(route.view==='group')return renderGroup(route.group);
  const mod=findModule(route.moduleId);
  if(route.view==='module')return renderModule(mod);
  const stage=findStage(mod,route.stageId);
  if(route.view==='guide')return renderGuide(mod,stage);
  if(route.view==='practice')return renderPractice(mod,stage,meta);
  if(route.view==='result')return renderResult(mod,stage);
}

installWillenaKeyboard({submitSelector:'#bottom button'});
startStudentHeaderData();
subscribeStudentHeaderData(data=>{
  const name=data.name||'Student';if(nameEl)nameEl.textContent=name;
  if(pointsEl)pointsEl.textContent=typeof data.points==='number'?data.points.toLocaleString():'—';
  if(starsEl)starsEl.textContent=typeof data.stars==='number'?data.stars.toLocaleString():'—';
  if(avatarEl)avatarEl.textContent=data.avatar||name.charAt(0).toUpperCase()||'S';
});

async function boot(){
  root.innerHTML='<div class="loading">Loading Grammar Foundations…</div>';
  try{
    await Promise.all([loadCatalog(),loadProgress()]);
    const resume=resumeRoute();
    nav=createStudentHistoryNavigation({appId:'willena-grammar-foundations',views:['home','group','module','guide','practice','result'],normalize:normalizeRoute,validate:validateRoute,render:renderRoute,guard:navigationGuard,onBeforeChange:()=>hideWillenaKeyboard()});
    const initial=nav.init(resume||{view:'home'});renderRoute(initial,{source:'init'});
  }catch(e){
    console.error('[grammar-foundations] boot failed',e);setBottom('');
    root.innerHTML=`<div class="gf-result"><div class="gf-pass">Could not load lessons</div><p>${esc(e.message||e)}</p><div class="gf-result-actions"><button class="gf-btn primary" id="retryBoot">Try again</button></div></div>`;
    document.getElementById('retryBoot').onclick=boot;
  }
}
boot();