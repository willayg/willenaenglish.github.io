import {QuestionRenderer} from './question-renderer.js';
import {gradeQuestion} from './question-grader.js';
import {resolveContentIds,loadStoredSkill,loadStoredWritten,shuffle} from './content-source.js';
import {initTracking,refreshTrackingState,setTrackingContext,startSession,recordAttempt,completeSession,trackingState} from './tracking-client.js?v=2.12.0';
import {startVocabularyLearning} from './vocab-learning.js?v=2.13.0';
import {loadCardStats,invalidateCardStats,formatCardMetric,formatAccuracy,reviewCounts} from './stats-client.js?v=2.13a';

const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const root=$('#screen'),bottom=$('#bottom'),userEl=$('#user');
let state={plan:null,lesson:null,ids:null,practice:null,queue:[],index:0,score:0,wrongIds:[],checked:false,startedAt:0,renderer:null,cardStats:new Map()};
const PRACTICES={vocabulary:{label:'단어 학습',desc:'카드 · 뜻 · 철자',kind:'vocab-learning'},communication:{label:'Communication',desc:'핵심 대화 표현',kind:'stored'},grammar:{label:'Grammar',desc:'핵심 문법',kind:'stored'},reading:{label:'Reading',desc:'본문 이해',kind:'stored'},constructed_response:{label:'서술형',desc:'저장된 영작 · 교정 · 다답형',kind:'written'}};

function scopeFor(plan){const lessons=plan?.group?.scope?.lessons;if(Array.isArray(lessons)&&lessons.length)return lessons.filter(x=>x?.lesson);return(plan?.units||[]).map(lesson=>({lesson,sections:plan?.practice_types||[]}))}
function sectionsFor(plan,lesson){const row=scopeFor(plan).find(x=>String(x.lesson)===String(lesson));return new Set((row?.sections||[]).map(x=>String(x).toLowerCase()))}
function setBottom(html=''){bottom.innerHTML=html;bottom.hidden=!html}
function error(message){root.innerHTML=`<div class="error">${esc(message)}</div>`;setBottom('')}
function updateUser(){const u=trackingState().user;userEl.textContent=u?.name||u?.username||'Student'}
function ring(p){const n=Math.max(0,Math.min(100,Math.round(Number(p)||0)));return `<span class="ring" style="--p:${n}%"><b>${n}%</b></span>`}
function emptyStat(){return{completed:0,total:0,coverage:0,accuracy:0,accuracySample:0}}
function cardData(plan){return state.cardStats.get(String(plan?.id||''))||{plan:emptyStat(),lessons:{}}}
async function loadPlanCardStats(plan,{force=false}={}){
  try{const data=await loadCardStats(plan,trackingState().user?.id,{force});state.cardStats.set(String(plan.id),data);return data}catch(e){console.warn('[test-prep-v2] card stats failed',e);const fallback={plan:emptyStat(),lessons:{}};state.cardStats.set(String(plan.id),fallback);return fallback}
}
async function refreshPlanCardStats(plan){invalidateCardStats(plan?.id);return loadPlanCardStats(plan,{force:true})}
async function preloadCardStats(){const plans=trackingState().plans||[];await Promise.all(plans.map(p=>loadPlanCardStats(p)))}

function renderHome(){
  state={...state,plan:null,lesson:null,practice:null,queue:[],index:0};const plans=trackingState().plans||[];setBottom('');
  root.innerHTML=`<div class="heading"><div><h2>내 시험 대비</h2><p>학교 시험 범위를 선택하세요.</p></div></div>${plans.length?plans.map(p=>{const s=cardData(p).plan,r=reviewCounts(p),school=p.group?.school||'학교 시험';return `<button class="exam-card" data-plan="${esc(p.id)}"><div class="exam-head"><div><span class="exam-school">${esc(school)}</span><h3 class="exam-title">${esc(p.exam_name||'시험 대비')}</h3><div class="exam-book">${esc(p.book_label||'')}</div></div>${ring(s.coverage)}</div><div class="exam-meta"><span class="pill">${esc(formatCardMetric(s))}</span><span class="pill">${esc(formatAccuracy(s))}</span>${p.exam_date?`<span class="pill">${esc(p.exam_date)}</span>`:''}${r.now?`<span class="pill">오답 지금 ${r.now}</span>`:''}${r.later?`<span class="pill">나중 ${r.later}</span>`:''}</div></button>`}).join(''):'<div class="empty">지정된 시험 대비가 없습니다.</div>'}`;
  root.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>{const p=plans.find(x=>String(x.id)===String(b.dataset.plan));if(p)renderLessons(p)});
}

function renderLessons(plan){
  state.plan=plan;const lessons=scopeFor(plan),data=cardData(plan);setBottom('');
  root.innerHTML=`<button class="back" id="homeBack">← 시험 대비</button><div class="heading"><div><h2>${esc(plan.book_label||'')}</h2><p>${esc(plan.exam_name||'Lesson 선택')}</p></div></div>${lessons.length?`<div class="grid">${lessons.map(l=>{const s=data.lessons?.[String(l.lesson)]?.summary||emptyStat();return `<button class="tile" data-lesson="${esc(l.lesson)}"><div class="exam-head"><div><h3>${esc(l.lesson)}</h3><p>${esc((l.sections||[]).join(' · '))}</p><span class="metric">${esc(formatCardMetric(s))} · ${esc(formatAccuracy(s))}</span></div>${ring(s.coverage)}</div></button>`}).join('')}</div>`:'<div class="empty">Lesson 범위가 없습니다.</div>'}`;
  $('#homeBack').onclick=renderHome;root.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>renderLesson(plan,b.dataset.lesson));
}

function renderLesson(plan,lesson){
  state.plan=plan;state.lesson=lesson;const sections=sectionsFor(plan,lesson),data=cardData(plan).lessons?.[String(lesson)]||{summary:emptyStat(),practices:{}},available=Object.entries(PRACTICES).filter(([k])=>sections.has(k));setBottom('');
  root.innerHTML=`<button class="back" id="lessonBack">← ${esc(plan.book_label||'시험 대비')}</button><div class="lesson-head"><div class="heading"><div><h2>${esc(lesson)}</h2><p>${esc(plan.book_label||'')}</p></div></div></div>${available.length?`<div class="journey">${available.map(([k,p],i)=>{const s=data.practices?.[k]||emptyStat();return `<div class="journey-stop" data-practice="${k}"><div class="station">${i+1}</div><div class="stop-copy"><b>${esc(p.label)}</b><small>${esc(p.desc)}</small><div class="mini"><i style="width:${s.coverage}%"></i></div></div><div class="stop-stat">${s.completed} / ${s.total}<small>${s.accuracySample?`${s.accuracy}% accuracy`:'— accuracy'}</small></div></div>`}).join('')}</div>`:'<div class="empty">이 Lesson에 활성화된 영역이 없습니다.</div>'}`;
  $('#lessonBack').onclick=()=>renderLessons(plan);root.querySelectorAll('[data-practice]').forEach(b=>b.onclick=()=>startPractice(b.dataset.practice));
}

async function returnFromVocabulary(){
  try{await refreshTrackingState();const fresh=trackingState().plans.find(x=>String(x.id)===String(state.plan.id));if(fresh)state.plan=fresh;await refreshPlanCardStats(state.plan)}catch(e){console.warn('[test-prep-v2] vocab stats refresh failed',e)}
  renderLesson(state.plan,state.lesson);
}
async function startPractice(practice){
  const config=PRACTICES[practice];if(!config)return;root.innerHTML='<div class="loading">문제를 불러오는 중...</div>';setBottom('');
  try{
    const ids=await resolveContentIds(state.plan,state.lesson);state.ids=ids;state.practice=practice;setTrackingContext(state.plan,state.lesson);
    if(config.kind==='vocab-learning'){await startVocabularyLearning({host:root,plan:state.plan,lesson:state.lesson,unitId:ids.unitId,onExit:returnFromVocabulary});return}
    let pool=config.kind==='written'?await loadStoredWritten(ids.unitId):await loadStoredSkill(ids.unitId,practice);pool=shuffle(pool);if(pool.length>20)pool=pool.slice(0,20);if(!pool.length){root.innerHTML=`<button class="back" id="emptyBack">← ${esc(state.lesson)}</button><div class="empty">이 영역에 사용할 v2.13a 문제가 없습니다.</div>`;$('#emptyBack').onclick=()=>renderLesson(state.plan,state.lesson);return}state.queue=pool;state.index=0;state.score=0;state.wrongIds=[];state.checked=false;await startSession(practice);renderQuestion();
  }catch(e){console.error('[test-prep-v2] start failed',e);error(e.message||'문제를 불러오지 못했습니다.')}
}
function current(){return state.queue[state.index]||null}
function headerFor(q){const code=q.source?.code||'',source=code?`<span class="badge ${code.toLowerCase()}" title="${code==='Z'?'Zocbo':code==='W'?'Willena authored':'Book reference'}">${code}</span>`:'';return `<div class="practice-head"><div><button class="back" id="practiceBack">← ${esc(state.lesson)}</button><div class="practice-meta">${source}<span>${esc(state.plan.book_label||'')}</span><span>·</span><span>${esc(PRACTICES[state.practice]?.label||state.practice)}</span></div></div><strong>${state.index+1} / ${state.queue.length}</strong></div><div class="progress"><i style="width:${Math.round(state.index/Math.max(1,state.queue.length)*100)}%"></i></div>`}
function renderQuestion(){
  if(state.index>=state.queue.length)return finishPractice();const q=current();state.checked=false;state.startedAt=Date.now();root.innerHTML=`${headerFor(q)}<div class="question-card" id="questionHost"></div>`;state.renderer=new QuestionRenderer($('#questionHost')).render(q,{onChange:(_,has)=>{const check=$('#checkAnswer');if(check&&!state.checked)check.disabled=!has}});$('#practiceBack').onclick=async()=>{await completeSession({correct:state.score,total:state.index,wrongIds:state.wrongIds});await refreshPlanCardStats(state.plan);renderLesson(state.plan,state.lesson)};setBottom(`<button id="skipQuestion">Skip</button><button class="primary" id="checkAnswer" disabled>Check Answer</button>`);$('#skipQuestion').onclick=skipQuestion;$('#checkAnswer').onclick=checkAnswer;
}
async function checkAnswer(){
  if(state.checked){state.index++;renderQuestion();return}const q=current(),response=state.renderer.getResponse(),btn=$('#checkAnswer');btn.disabled=true;btn.textContent=q.grading?.aiAllowed&&q.grading?.mode==='ai_semantic_strict'?'Checking…':'Check Answer';state.renderer.setDisabled(true);const result=await gradeQuestion(q,response);result.responseTimeMs=Date.now()-state.startedAt;state.checked=true;if(result.correct)state.score++;else state.wrongIds.push(q.id);state.renderer.showFeedback(result);try{await recordAttempt({question:q,response,result,practiceType:state.practice})}catch(e){console.warn('[test-prep-v2] tracking failed',e)}btn.disabled=false;btn.textContent=state.index===state.queue.length-1?'Finish':'Next Question →';const skip=$('#skipQuestion');if(skip)skip.disabled=true;
}
async function skipQuestion(){if(state.checked)return;const q=current(),response=state.renderer?.getResponse()??null,result={correct:false,method:'skipped',responseTimeMs:Date.now()-state.startedAt};state.wrongIds.push(q.id);try{await recordAttempt({question:q,response,result,practiceType:state.practice,skipped:true})}catch(e){console.warn('[test-prep-v2] skip tracking failed',e)}state.index++;renderQuestion()}
async function finishPractice(){
  setBottom('');try{await completeSession({correct:state.score,total:state.queue.length,wrongIds:state.wrongIds});await refreshTrackingState();const fresh=trackingState().plans.find(x=>String(x.id)===String(state.plan.id));if(fresh)state.plan=fresh;await refreshPlanCardStats(state.plan)}catch(e){console.warn('[test-prep-v2] finish/refresh failed',e)}const pct=state.queue.length?Math.round(state.score/state.queue.length*100):0;root.innerHTML=`<div class="card result"><div class="score">${state.score}/${state.queue.length}</div><h2>${pct>=80?'좋아요!':'한 번 더 확인해 보세요.'}</h2><div class="statline">정답률 ${pct}% · 틀린/건너뛴 문제 ${state.wrongIds.length}개</div><div style="margin-top:22px"><button class="tile" id="resultBack" style="text-align:center;min-height:auto">${esc(state.lesson)}로 돌아가기</button></div></div>`;$('#resultBack').onclick=()=>renderLesson(state.plan,state.lesson);
}

async function boot(){try{root.innerHTML='<div class="loading">Test Prep v2.13a를 준비하는 중...</div>';await initTracking();updateUser();await preloadCardStats();renderHome()}catch(e){console.error('[test-prep-v2] boot failed',e);error(e.message||'앱을 시작하지 못했습니다.')}}
boot();
