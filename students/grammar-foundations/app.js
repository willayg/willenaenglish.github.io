import {QuestionRenderer} from '../shared/student-question-renderer.js?v=1.0.1';
import {gradeQuestion} from '../shared/question-grader.js?v=2.1.2';
import {mountAiWilliHelper,decorateAiWilliFeedback} from '../shared/ai-willi.js?v=1.1.0';
import {installWillenaKeyboard} from '../shared/willena-keyboard.js?v=1.5.1';
import {startStudentHeaderData,subscribeStudentHeaderData} from '../shared/student-header-data.js?v=1.0.0';

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
let state={module:null,stage:null,index:0,score:0,renderer:null,checked:false,results:[]};

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

function lessonCard(mod){
  const pct=modulePct(mod),done=passedCount(mod),next=currentStage(mod),required=passScore(mod);
  return `<button class="gf-lesson-card exam-card" data-open-module="${esc(mod.id)}">
    <div class="gf-target-head exam-head">
      <div class="gf-target-copy">
        <div class="exam-school">${esc(mod.lesson||'Grammar Foundations')}</div>
        <h2 class="exam-title">${esc(koTitle(mod))}</h2>
        <div class="exam-book">${esc(enTitle(mod))} · ${done}/${mod.stages.length} levels complete</div>
        <div class="exam-meta"><span class="pill">${done===mod.stages.length?'Complete':next?`Next: Level ${next.number}`:'No levels'}</span><span class="pill">${required}/10 to pass</span></div>
      </div>
      <div class="ring gf-ring" style="--p:${pct}%"><b>${pct}%</b></div>
    </div>
    <span class="gf-open-hint">Open lesson →</span>
  </button>`;
}
function stageCard(mod,s,index){
  const row=stageProgress(mod.id,s.id),unlocked=stageUnlocked(mod,index),passed=Boolean(row?.passed),pct=stagePct(row);
  const status=passed?`Passed · ${row.best_score}/${row.total}`:row?`Best ${row.best_score}/${row.total}`:unlocked?'Ready':'Locked';
  const cls=passed?' passed':unlocked?' active':' locked';
  return `<button class="gf-stage-card tile${cls}" data-module="${esc(mod.id)}" data-stage="${esc(s.id)}" ${unlocked?'':'disabled'}>
    <div class="gf-stage-card-copy">
      <div class="gf-stage-label">LEVEL ${s.number}</div>
      <h3>${esc(koTitle(s))}</h3>
      <small>${esc(enTitle(s))}</small>
      <span class="metric">${esc(status)}</span>
      ${row?`<small>${row.attempt_count} attempt${row.attempt_count===1?'':'s'}</small>`:''}
    </div>
    <div class="ring gf-stage-ring" style="--p:${pct}%"><b>${pct}%</b></div>
  </button>`;
}
function showHome(){
  state={module:null,stage:null,index:0,score:0,renderer:null,checked:false,results:[]};
  setBottom('');
  root.innerHTML=`<div class="gf-kicker">Middle School Grammar Foundations</div><h1 class="gf-title">중학교 문법 기초</h1><p class="gf-subtitle">문법 항목을 골라 단계별로 완성하세요.</p><div class="gf-targets">${modules.map(lessonCard).join('')}</div>`;
  root.querySelectorAll('[data-open-module]').forEach(btn=>btn.onclick=()=>showModule(findModule(btn.dataset.openModule)));
}
function showModule(mod){
  if(!mod)return showHome();
  state={module:mod,stage:null,index:0,score:0,renderer:null,checked:false,results:[]};
  setBottom('');
  const pct=modulePct(mod),done=passedCount(mod),required=passScore(mod),next=currentStage(mod);
  root.innerHTML=`<button class="back" id="moduleBack">← Grammar Foundations</button>
    <section class="gf-module-overview exam-card">
      <div class="gf-target-head exam-head">
        <div class="gf-target-copy">
          <div class="exam-school">${esc(mod.lesson||'Grammar Foundations')}</div>
          <h2 class="exam-title">${esc(koTitle(mod))}</h2>
          <div class="exam-book">${esc(enTitle(mod))} · ${done}/${mod.stages.length} levels complete</div>
          <div class="exam-meta"><span class="pill">${done===mod.stages.length?'Complete':next?`Next: Level ${next.number}`:'No levels'}</span><span class="pill">${required}/10 to pass</span></div>
        </div>
        <div class="ring gf-ring" style="--p:${pct}%"><b>${pct}%</b></div>
      </div>
    </section>
    <div class="gf-level-heading"><div><div class="gf-kicker">Lesson levels</div><h2>Choose a level</h2></div><span>${done}/${mod.stages.length} complete</span></div>
    <div class="gf-stage-grid">${mod.stages.map((s,i)=>stageCard(mod,s,i)).join('')}</div>`;
  document.getElementById('moduleBack').onclick=showHome;
  root.querySelectorAll('[data-stage]:not([disabled])').forEach(btn=>btn.onclick=()=>{const selected=findModule(btn.dataset.module);openGuide(selected,findStage(selected,btn.dataset.stage))});
}
function openGuide(mod,stage){
  const idx=mod?.stages?.findIndex(s=>s.id===stage?.id)??-1;
  if(!mod||!stage||idx<0||!stageUnlocked(mod,idx))return showModule(mod);
  state.module=mod;state.stage=stage;state.index=0;state.score=0;state.results=[];state.renderer=null;state.checked=false;
  setBottom('');
  const row=stageProgress(mod.id,stage.id);
  root.innerHTML=`<button class="back" id="guideBack">← ${esc(koTitle(mod))}</button><div class="gf-guide"><div class="gf-kicker">${esc(koTitle(mod))} · ${esc(enTitle(mod))} · Level ${stage.number}</div><h2>${esc(koTitle(stage))}</h2><p>${esc(enTitle(stage))}</p>${stage.subtitle?`<p>${esc(stage.subtitle)}</p>`:''}${row?`<div class="gf-guide-score">Best ${row.best_score}/${row.total} · ${row.attempt_count} attempt${row.attempt_count===1?'':'s'}</div>`:''}<div class="gf-rule">${esc(stage.guide?.rule||'')}</div><div class="gf-example-list">${(stage.guide?.examples||[]).map(x=>`<div class="gf-example">${esc(x)}</div>`).join('')}</div><div class="gf-actions"><button class="gf-btn secondary" id="backModule">목록</button><button class="gf-btn primary" id="startStage">${stage.questions.length}문제 시작 →</button></div></div>`;
  document.getElementById('guideBack').onclick=()=>showModule(mod);
  document.getElementById('backModule').onclick=()=>showModule(mod);
  document.getElementById('startStage').onclick=startStage;
}
function startStage(){state.index=0;state.score=0;state.results=[];renderQuestion()}
function renderQuestion(){
  const q=currentQuestion();if(!q)return showResult();
  state.checked=false;
  const pct=Math.round((state.index/state.stage.questions.length)*100);
  root.innerHTML=`<button class="back" id="questionBack">← Level ${state.stage.number}</button><div class="gf-question-head"><div><div class="gf-kicker">${esc(koTitle(state.module))} · Level ${state.stage.number}</div><b>${esc(koTitle(state.stage))}</b><small>${esc(enTitle(state.stage))}</small></div><span class="gf-progress">${state.index+1} / ${state.stage.questions.length}</span></div><div class="progress gf-round-progress"><i style="width:${pct}%"></i></div><div class="gf-question-card" id="questionHost"></div>`;
  document.getElementById('questionBack').onclick=()=>openGuide(state.module,state.stage);
  const host=document.getElementById('questionHost');
  const renderer=new QuestionRenderer(host).render(q,{onChange:(_,has)=>{const btn=document.getElementById('checkAnswer');if(btn&&!state.checked)btn.disabled=!has}});
  state.renderer=renderer;
  setBottom('<button id="checkAnswer" disabled>Check Answer</button>');
  document.getElementById('checkAnswer').onclick=checkAnswer;
}
async function checkAnswer(){
  const q=currentQuestion(),renderer=state.renderer,btn=document.getElementById('checkAnswer');
  if(!q||!renderer||!btn)return;
  if(state.checked){state.index+=1;renderQuestion();return}
  btn.disabled=true;renderer.setDisabled(true);
  const response=renderer.getResponse();
  let result;
  try{result=await gradeQuestion(q,response)}catch(e){console.error('[grammar-foundations] grading failed',e);btn.disabled=false;renderer.setDisabled(false);return}
  state.checked=true;
  if(result.correct)state.score+=1;
  state.results.push({questionId:q.id,sourceKey:q.metadata?.sourceKey||null,correct:!!result.correct,response});
  renderer.showFeedback(result);decorateAiWilliFeedback(root,result);
  if(!result.correct)mountAiWilliHelper({container:root,question:q,response,result,section:'grammar',practiceType:'grammar_foundations'});
  btn.disabled=false;btn.textContent=state.index===state.stage.questions.length-1?'Finish':'Next Question →';
}
async function showResult(){
  const required=passScore(state.module),passed=state.score>=required,total=state.stage.questions.length;
  setBottom('');
  root.innerHTML=`<div class="gf-result"><div class="gf-kicker">${esc(koTitle(state.module))} · ${esc(koTitle(state.stage))}</div><div class="gf-score">${state.score}/${total}</div><div class="gf-pass">${passed?'Passed ✓':'Redo this level'}</div><p id="saveStatus">Saving progress…</p></div>`;
  const saved=await saveStageResult();
  const row=stageProgress(state.module.id,state.stage.id),next=nextStage();
  root.innerHTML=`<div class="gf-result"><div class="gf-kicker">${esc(koTitle(state.module))} · ${esc(enTitle(state.module))} · Level ${state.stage.number}</div><h2>${esc(koTitle(state.stage))}</h2><p>${esc(enTitle(state.stage))}</p><div class="gf-score">${state.score}/${total}</div><div class="gf-pass">${passed?'Passed ✓':'Redo this level'}</div><p>${passed?'좋아요. 다음 단계로 넘어갈 준비가 됐어요.':`통과하려면 ${required}/${total} 이상이 필요해요.`}</p>${row?`<div class="gf-result-best">Best ${row.best_score}/${row.total} · ${row.attempt_count} attempts</div>`:''}${saved?'':'<div class="gf-save-warning">Progress could not be saved. You can retry this round.</div>'}<div class="gf-result-actions"><button class="gf-btn secondary" id="resultModule">레벨 목록</button>${passed&&next?'<button class="gf-btn secondary" id="nextGuide">다음 레벨 보기</button>':''}<button class="gf-btn primary" id="redoStage">${passed?'다시 풀기':'Redo →'}</button></div></div>`;
  document.getElementById('resultModule').onclick=()=>showModule(state.module);
  document.getElementById('redoStage').onclick=()=>openGuide(state.module,state.stage);
  if(passed&&next)document.getElementById('nextGuide').onclick=()=>openGuide(state.module,next);
}
function nextStage(){const i=state.module?.stages?.findIndex(s=>s.id===state.stage?.id)??-1;return i>=0?state.module.stages[i+1]||null:null}

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
    showHome();
  }catch(e){
    console.error('[grammar-foundations] boot failed',e);
    setBottom('');
    root.innerHTML=`<div class="gf-result"><div class="gf-pass">Could not load lessons</div><p>${esc(e.message||e)}</p><div class="gf-result-actions"><button class="gf-btn primary" id="retryBoot">Try again</button></div></div>`;
    document.getElementById('retryBoot').onclick=boot;
  }
}
boot();