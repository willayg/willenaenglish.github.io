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
let state={module:null,stage:null,index:0,score:0,renderer:null,checked:false,results:[]};

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function setBottom(html=''){bottom.innerHTML=html;bottom.hidden=!html}
function currentQuestion(){return state.stage?.questions?.[state.index]||null}
function showHome(){
  state={module:null,stage:null,index:0,score:0,renderer:null,checked:false,results:[]};
  setBottom('');
  root.innerHTML=`<div class="gf-kicker">Middle School Grammar Foundations</div><h1 class="gf-title">중학교 문법 기초</h1><p class="gf-subtitle">짧게 배우고 · 10문제 풀고 · 8개 이상 맞으면 통과</p>${FOUNDATION_MODULES.map(mod=>`<section class="gf-module"><div class="gf-module-head"><div><h2>${esc(mod.title)}</h2><p>${esc(mod.koreanTitle)} · ${esc(mod.lesson)}</p></div><span class="gf-badge">${mod.stages.length} stages</span></div><div class="gf-stage-grid">${mod.stages.map(s=>`<button class="gf-stage" data-stage="${esc(s.id)}"><span class="gf-num">STAGE ${s.number}</span><strong>${esc(s.title)}</strong><span>${esc(s.subtitle)}</span></button>`).join('')}</div></section>`).join('')}`;
  root.querySelectorAll('[data-stage]').forEach(btn=>btn.onclick=()=>openGuide(BE_PRESENT.stages.find(s=>s.id===btn.dataset.stage)));
}
function openGuide(stage){
  state.module=BE_PRESENT;state.stage=stage;state.index=0;state.score=0;state.results=[];state.renderer=null;state.checked=false;
  setBottom('');
  root.innerHTML=`<button class="back" id="guideBack">← Grammar Foundations</button><div class="gf-guide"><div class="gf-kicker">${esc(BE_PRESENT.title)} · Stage ${stage.number}</div><h2>${esc(stage.title)}</h2><p>${esc(stage.subtitle)}</p><div class="gf-rule">${esc(stage.guide.rule)}</div><div class="gf-example-list">${stage.guide.examples.map(x=>`<div class="gf-example">${esc(x)}</div>`).join('')}</div><div class="gf-actions"><button class="gf-btn secondary" id="backHome">목록</button><button class="gf-btn primary" id="startStage">10문제 시작 →</button></div></div>`;
  document.getElementById('guideBack').onclick=showHome;
  document.getElementById('backHome').onclick=showHome;
  document.getElementById('startStage').onclick=startStage;
}
function startStage(){state.index=0;state.score=0;state.results=[];renderQuestion()}
function renderQuestion(){
  const q=currentQuestion();if(!q)return showResult();
  state.checked=false;
  root.innerHTML=`<button class="back" id="questionBack">← Stage ${state.stage.number}</button><div class="gf-question-head"><b>${esc(state.stage.title)}</b><span class="gf-progress">${state.index+1} / ${state.stage.questions.length}</span></div><div class="gf-question-card" id="questionHost"></div>`;
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
function showResult(){
  const passed=state.score>=PASS_SCORE;
  setBottom('');
  root.innerHTML=`<div class="gf-result"><div class="gf-kicker">${esc(state.module.title)} · Stage ${state.stage.number}</div><div class="gf-score">${state.score}/10</div><div class="gf-pass">${passed?'Passed ✓':'Redo this stage'}</div><p>${passed?'좋아요. 다음 단계로 넘어갈 준비가 됐어요.':`통과하려면 ${PASS_SCORE}/10 이상이 필요해요.`}</p><div class="gf-result-actions"><button class="gf-btn secondary" id="resultHome">목록</button>${passed&&nextStage()?'<button class="gf-btn secondary" id="nextGuide">다음 단계 보기</button>':''}<button class="gf-btn primary" id="redoStage">${passed?'다시 풀기':'Redo →'}</button></div></div>`;
  document.getElementById('resultHome').onclick=showHome;
  document.getElementById('redoStage').onclick=()=>openGuide(state.stage);
  if(passed&&nextStage())document.getElementById('nextGuide').onclick=()=>openGuide(nextStage());
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
showHome();
