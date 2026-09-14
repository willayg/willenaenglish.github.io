import {QuestionRenderer} from '../shared/student-question-renderer.js?v=1.0.1';
import {gradeQuestion} from '../shared/question-grader.js?v=2.1.2';
import {mountAiWilliHelper,decorateAiWilliFeedback} from '../shared/ai-willi.js?v=1.1.0';
import {installWillenaKeyboard} from '../shared/willena-keyboard.js?v=1.5.1';
import {startStudentHeaderData,subscribeStudentHeaderData} from '../shared/student-header-data.js?v=1.0.0';
import {FOUNDATION_MODULES,BE_PRESENT} from './curriculum.js?v=1.0.0';

const root=document.getElementById('screen');
const bottom=document.getElementById('bottom');
const nameEl=document.getElementById('user');
const pointsEl=document.getElementById('headerPoints');
const starsEl=document.getElementById('headerStars');
const avatarEl=document.getElementById('studentAvatar');
const PASS_SCORE=8;
const PROGRESS_URL='/.netlify/functions/grammar_foundations_progress';
let progressMap=new Map();
let state={module:null,stage:null,index:0,score:0,renderer:null,checked:false,results:[]};

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function setBottom(html=''){bottom.innerHTML=html;bottom.hidden=!html}
function currentQuestion(){return state.stage?.questions?.[state.index]||null}
function progressKey(moduleId,stageId){return `${moduleId}:${stageId}`}
function stageProgress(moduleId,stageId){return progressMap.get(progressKey(moduleId,stageId))||null}
function stageUnlocked(mod,index){return index===0||Boolean(stageProgress(mod.id,mod.stages[index-1]?.id)?.passed)}
function stagePct(row){return row?.total?Math.round((Number(row.best_score||0)/Number(row.total))*100):0}
function modulePct(mod){const passed=mod.stages.filter(s=>stageProgress(mod.id,s.id)?.passed).length;return Math.round((passed/mod.stages.length)*100)}
function passedCount(mod){return mod.stages.filter(s=>stageProgress(mod.id,s.id)?.passed).length}
function currentStage(mod){for(let i=0;i<mod.stages.length;i++){if(!stageProgress(mod.id,mod.stages[i].id)?.passed&&stageUnlocked(mod,i))return mod.stages[i]}return mod.stages[mod.stages.length-1]}

async function apiFetch(url,options){
  if(window.WillenaAPI?.fetch)return window.WillenaAPI.fetch(url,options);
  return fetch(url,{credentials:'include',...options});
}
async function loadProgress(){
  try{
    const res=await apiFetch(`${PROGRESS_URL}?_=${Date.now()}`);
    if(!res.ok)throw new Error(`progress ${res.status}`);
    const data=await res.json();
    progressMap=new Map((data.progress||[]).map(row=>[progressKey(row.module_id,row.stage_id),row]));
  }catch(e){console.warn('[grammar-foundations] progress load failed',e);progressMap=new Map()}
}
async function saveStageResult(){
  const payload={module_id:state.module.id,stage_id:state.stage.id,score:state.score,total:state.stage.questions.length,passed:state.score>=PASS_SCORE,results:state.results};
  try{
    const res=await apiFetch(PROGRESS_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!res.ok)throw new Error(`save ${res.status}`);
    const data=await res.json();
    if(data.progress)progressMap.set(progressKey(data.progress.module_id,data.progress.stage_id),data.progress);
    return true;
  }catch(e){console.error('[grammar-foundations] progress save failed',e);return false}
}

function stageCard(mod,s,index){
  const row=stageProgress(mod.id,s.id),unlocked=stageUnlocked(mod,index),passed=Boolean(row?.passed),pct=stagePct(row);
  const status=passed?`Passed · best ${row.best_score}/${row.total}`:row?`Latest ${row.latest_score}/${row.total}`:unlocked?'Ready':'Locked';
  const cls=passed?' passed':unlocked?' active':' locked';
  return `<button class="gf-stage-row${cls}" data-stage="${esc(s.id)}" ${unlocked?'':'disabled'}>
    <div class="gf-stage-dot">${passed?'✓':s.number}</div>
    <div class="gf-stage-copy"><strong>${esc(s.title)}</strong><span>${esc(s.subtitle)}</span><div class="mini"><i style="width:${pct}%"></i></div></div>
    <div class="gf-stage-status"><b>${esc(status)}</b>${row?`<small>${row.attempt_count} attempt${row.attempt_count===1?'':'s'}</small>`:''}</div>
  </button>`;
}
function moduleCard(mod){
  const pct=modulePct(mod),done=passedCount(mod),next=currentStage(mod);
  return `<section class="gf-target-card">
    <div class="gf-target-head">
      <div class="gf-target-copy"><div class="gf-kicker">${esc(mod.lesson)}</div><h2>${esc(mod.title)}</h2><p>${esc(mod.koreanTitle)}</p></div>
      <div class="ring gf-ring" style="--p:${pct}%"><b>${pct}%</b></div>
    </div>
    <div class="gf-target-summary"><strong>${done} / ${mod.stages.length} stages passed</strong><span>${done===mod.stages.length?'Target complete':`Next: Stage ${next.number} · ${esc(next.title)}`}</span></div>
    <div class="gf-stage-list">${mod.stages.map((s,i)=>stageCard(mod,s,i)).join('')}</div>
    <button class="gf-continue" data-continue="${esc(next.id)}">${done===mod.stages.length?'Practice again':'Continue'} →</button>
  </section>`;
}
function showHome(){
  state={module:null,stage:null,index:0,score:0,renderer:null,checked:false,results:[]};
  setBottom('');
  root.innerHTML=`<div class="gf-kicker">Middle School Grammar Foundations</div><h1 class="gf-title">중학교 문법 기초</h1><p class="gf-subtitle">짧게 배우고 · 10문제 풀고 · 8개 이상 맞으면 통과</p><div class="gf-targets">${FOUNDATION_MODULES.map(moduleCard).join('')}</div>`;
  root.querySelectorAll('[data-stage]:not([disabled])').forEach(btn=>btn.onclick=()=>openGuide(BE_PRESENT.stages.find(s=>s.id===btn.dataset.stage)));
  root.querySelectorAll('[data-continue]').forEach(btn=>btn.onclick=()=>openGuide(BE_PRESENT.stages.find(s=>s.id===btn.dataset.continue)));
}
function openGuide(stage){
  const idx=BE_PRESENT.stages.findIndex(s=>s.id===stage?.id);
  if(!stage||!stageUnlocked(BE_PRESENT,idx))return showHome();
  state.module=BE_PRESENT;state.stage=stage;state.index=0;state.score=0;state.results=[];state.renderer=null;state.checked=false;
  setBottom('');
  const row=stageProgress(BE_PRESENT.id,stage.id);
  root.innerHTML=`<button class="back" id="guideBack">← Grammar Foundations</button><div class="gf-guide"><div class="gf-kicker">${esc(BE_PRESENT.title)} · Stage ${stage.number}</div><h2>${esc(stage.title)}</h2><p>${esc(stage.subtitle)}</p>${row?`<div class="gf-guide-score">Best ${row.best_score}/${row.total} · ${row.attempt_count} attempt${row.attempt_count===1?'':'s'}</div>`:''}<div class="gf-rule">${esc(stage.guide.rule)}</div><div class="gf-example-list">${stage.guide.examples.map(x=>`<div class="gf-example">${esc(x)}</div>`).join('')}</div><div class="gf-actions"><button class="gf-btn secondary" id="backHome">목록</button><button class="gf-btn primary" id="startStage">10문제 시작 →</button></div></div>`;
  document.getElementById('guideBack').onclick=showHome;
  document.getElementById('backHome').onclick=showHome;
  document.getElementById('startStage').onclick=startStage;
}
function startStage(){state.index=0;state.score=0;state.results=[];renderQuestion()}
function renderQuestion(){
  const q=currentQuestion();if(!q)return showResult();
  state.checked=false;
  const pct=Math.round((state.index/state.stage.questions.length)*100);
  root.innerHTML=`<button class="back" id="questionBack">← Stage ${state.stage.number}</button><div class="gf-question-head"><div><div class="gf-kicker">${esc(state.module.title)} · Stage ${state.stage.number}</div><b>${esc(state.stage.title)}</b></div><span class="gf-progress">${state.index+1} / ${state.stage.questions.length}</span></div><div class="progress gf-round-progress"><i style="width:${pct}%"></i></div><div class="gf-question-card" id="questionHost"></div>`;
  document.getElementById('questionBack').onclick=()=>openGuide(state.stage);
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
  state.results.push({questionId:q.id,correct:!!result.correct,response});
  renderer.showFeedback(result);decorateAiWilliFeedback(root,result);
  if(!result.correct)mountAiWilliHelper({container:root,question:q,response,result,section:'grammar',practiceType:'grammar_foundations'});
  btn.disabled=false;btn.textContent=state.index===state.stage.questions.length-1?'Finish':'Next Question →';
}
async function showResult(){
  const passed=state.score>=PASS_SCORE;
  setBottom('');
  root.innerHTML=`<div class="gf-result"><div class="gf-kicker">${esc(state.module.title)} · Stage ${state.stage.number}</div><div class="gf-score">${state.score}/10</div><div class="gf-pass">${passed?'Passed ✓':'Redo this stage'}</div><p id="saveStatus">Saving progress…</p></div>`;
  const saved=await saveStageResult();
  const row=stageProgress(state.module.id,state.stage.id),next=nextStage();
  root.innerHTML=`<div class="gf-result"><div class="gf-kicker">${esc(state.module.title)} · Stage ${state.stage.number}</div><div class="gf-score">${state.score}/10</div><div class="gf-pass">${passed?'Passed ✓':'Redo this stage'}</div><p>${passed?'좋아요. 다음 단계로 넘어갈 준비가 됐어요.':`통과하려면 ${PASS_SCORE}/10 이상이 필요해요.`}</p>${row?`<div class="gf-result-best">Best ${row.best_score}/${row.total} · ${row.attempt_count} attempts</div>`:''}${saved?'':'<div class="gf-save-warning">Progress could not be saved. You can retry this round.</div>'}<div class="gf-result-actions"><button class="gf-btn secondary" id="resultHome">목록</button>${passed&&next?'<button class="gf-btn secondary" id="nextGuide">다음 단계 보기</button>':''}<button class="gf-btn primary" id="redoStage">${passed?'다시 풀기':'Redo →'}</button></div></div>`;
  document.getElementById('resultHome').onclick=showHome;
  document.getElementById('redoStage').onclick=()=>openGuide(state.stage);
  if(passed&&next)document.getElementById('nextGuide').onclick=()=>openGuide(next);
}
function nextStage(){const i=BE_PRESENT.stages.findIndex(s=>s.id===state.stage?.id);return i>=0?BE_PRESENT.stages[i+1]||null:null}

installWillenaKeyboard({submitSelector:'#bottom button'});
startStudentHeaderData();
subscribeStudentHeaderData(data=>{
  const name=data.name||'Student';if(nameEl)nameEl.textContent=name;
  if(pointsEl)pointsEl.textContent=typeof data.points==='number'?data.points.toLocaleString():'—';
  if(starsEl)starsEl.textContent=typeof data.stars==='number'?data.stars.toLocaleString():'—';
  if(avatarEl)avatarEl.textContent=data.avatar||name.charAt(0).toUpperCase()||'S';
});
root.innerHTML='<div class="loading">Loading progress…</div>';
loadProgress().finally(showHome);
