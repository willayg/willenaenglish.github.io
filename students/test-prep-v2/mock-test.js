import {QuestionRenderer} from './question-renderer.js';
import {gradeQuestion} from './question-grader.js';
import {setTrackingContext,startSession,recordAttempt,completeSession,refreshTrackingState} from './tracking-client.js';
import {invalidateCardStats,loadCardStats} from './stats-client.js';
import {setNavigationGuard} from './navigation.js?v=2.18.0';
import {buildMockTestPaper,MOCK_TEST_BLUEPRINT,MOCK_TEST_MINUTES,MOCK_TEST_TOTAL} from './mock-test-source.js?v=1.1.0';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LABELS={vocabulary:'어휘',communication:'대화',grammar:'문법',reading:'독해',constructed_response:'서술형'};
const INTERNAL_CONTEXT_KEYS=new Set(['transcription_status','transcript_status','source_page']);
let activeToken=0;
let previewPaper=null;
let activeExam=null;
let lastSubmission=null;
let clearNavigationGuard=null;
let currentPlanId=null;

function ensureStyles(){
  if(document.querySelector('link[data-mock-test-style]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';link.href='./mock-test.css?v=1.2.0';link.dataset.mockTestStyle='1';document.head.appendChild(link);
}
ensureStyles();

function seedKey(planId){return`willenaMockPaperSeed:v2:${planId}`}
function makeSeed(planId){
  const raw=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;
  return`${planId}|${raw}`;
}
function getSeed(planId){
  try{
    let seed=sessionStorage.getItem(seedKey(planId));
    if(!seed){seed=makeSeed(planId);sessionStorage.setItem(seedKey(planId),seed)}
    return seed;
  }catch(_){return makeSeed(planId)}
}
function clearSeed(planId){
  try{if(planId)sessionStorage.removeItem(seedKey(planId))}catch(_){}
}
function cloneValue(value){
  if(value==null)return value;
  try{return structuredClone(value)}catch(_){try{return JSON.parse(JSON.stringify(value))}catch(__){return value}}
}
function questionForRender(question){
  const q=cloneValue(question)||{},context=q.context&&typeof q.context==='object'&&!Array.isArray(q.context)?{...q.context}:{};
  for(const key of INTERNAL_CONTEXT_KEYS)delete context[key];
  q.context=context;return q;
}
function countsHtml(paper){
  return `<div class="mock-section-counts">${Object.keys(MOCK_TEST_BLUEPRINT).map(key=>{
    const actual=Number(paper?.selectedCounts?.[key]||0);
    return `<div class="mock-section-count"><span>${esc(LABELS[key])}</span><strong>${actual}문항</strong></div>`;
  }).join('')}</div>`;
}
function diagnosticsHtml(paper){
  const messages=[];
  if(paper.writtenFallback?.used)messages.push(`서술형 ${paper.writtenFallback.used}문항은 객관식으로 대체됩니다.`);
  if(Object.keys(paper.shortages||{}).length)messages.push(`필요한 문제 수가 부족합니다: ${Object.entries(paper.shortages).map(([k,v])=>`${LABELS[k]||k} ${v}문항`).join(' · ')}`);
  if(paper.loadErrors?.length)messages.push(`일부 범위를 불러오지 못했습니다: ${paper.loadErrors.map(x=>x.lesson||'범위').join(', ')}`);
  return messages.length?`<div class="mock-summary-note">${messages.map(esc).join('<br>')}</div>`:'';
}
function beforeUnload(event){
  if(!activeExam||activeExam.finished)return;
  event.preventDefault();event.returnValue='';
}
function clearExamGuards(){
  try{clearNavigationGuard?.()}catch(_){}
  clearNavigationGuard=null;
  window.removeEventListener('beforeunload',beforeUnload);
}
function installExamGuards(){
  clearExamGuards();
  clearNavigationGuard=setNavigationGuard((previous,next)=>{
    if(!activeExam||activeExam.finished)return true;
    if(previous?.view!=='mock'||next?.view==='mock')return true;
    return window.confirm('시험을 종료하시겠습니까?\n작성한 답안은 제출되지 않습니다.');
  });
  window.addEventListener('beforeunload',beforeUnload);
}
function formatTime(ms){
  const total=Math.max(0,Math.ceil(ms/1000)),minutes=Math.floor(total/60),seconds=total%60;
  return`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}
function answeredCount(exam){return exam?.answered?.size||0}
function updateExamChrome(){
  const exam=activeExam;if(!exam||exam.finished)return;
  const entry=exam.paper.questions[exam.index],host=exam.host;
  const section=host.querySelector('[data-mock-section]'),number=host.querySelector('[data-mock-number]'),progress=host.querySelector('[data-mock-progress]'),answered=host.querySelector('[data-mock-answered]'),prev=host.querySelector('[data-mock-prev]'),next=host.querySelector('[data-mock-next]');
  if(section)section.textContent=LABELS[entry?.bucket]||entry?.bucket||'';
  if(number)number.textContent=`${exam.index+1} / ${exam.paper.total}`;
  if(progress)progress.style.width=`${Math.round((exam.index+1)/Math.max(1,exam.paper.total)*100)}%`;
  if(answered)answered.textContent=`답변 ${answeredCount(exam)} / ${exam.paper.total}`;
  if(prev)prev.disabled=exam.index<=0;
  if(next)next.textContent=exam.index>=exam.paper.total-1?'시험 제출':'다음';
}
function tickTimer(){
  const exam=activeExam;if(!exam||exam.finished)return;
  const remaining=exam.endAt-Date.now(),el=exam.host.querySelector('[data-mock-timer]');
  if(el){el.textContent=formatTime(remaining);el.classList.toggle('is-low',remaining<=300000)}
  if(remaining<=0){finishExam('timeout');return}
  exam.timer=setTimeout(tickTimer,250);
}
function ensureQuestionPanel(index){
  const exam=activeExam;if(!exam)return null;
  if(exam.panels.has(index))return exam.panels.get(index);
  const entry=exam.paper.questions[index],panel=document.createElement('section');
  panel.className='mock-question-panel';panel.hidden=true;panel.dataset.mockQuestion=String(index);
  exam.deck.appendChild(panel);
  const renderer=new QuestionRenderer(panel);
  renderer.render(questionForRender(entry.question),{onChange:(response,hasResponse)=>{
    if(!activeExam||activeExam!==exam||exam.finished)return;
    if(hasResponse){exam.responses.set(index,cloneValue(response));exam.answered.add(index)}
    else{exam.responses.delete(index);exam.answered.delete(index)}
    updateExamChrome();
  }});
  exam.panels.set(index,panel);exam.renderers.set(index,renderer);return panel;
}
function showQuestion(index){
  const exam=activeExam;if(!exam||exam.finished)return;
  exam.index=Math.max(0,Math.min(exam.paper.total-1,Number(index)||0));
  const current=ensureQuestionPanel(exam.index);
  for(const panel of exam.panels.values())panel.hidden=panel!==current;
  updateExamChrome();
  exam.host.scrollTo?.({top:0,behavior:'auto'});
}
function submissionSnapshot(reason){
  const exam=activeExam;if(!exam)return null;
  return{
    version:'1.1.0',reason,
    planId:String(exam.plan.id),seed:exam.paper.seed,
    startedAt:new Date(exam.startedAt).toISOString(),submittedAt:new Date().toISOString(),
    total:exam.paper.total,answered:answeredCount(exam),
    items:exam.paper.questions.map((entry,index)=>({
      number:index+1,bucket:entry.bucket,slot:entry.slot,lesson:entry.lesson,unitId:entry.unitId,
      question:entry.question,response:exam.responses.has(index)?cloneValue(exam.responses.get(index)):null,
      answered:exam.answered.has(index)
    }))
  };
}
function practiceTypeFor(item){return item.bucket==='vocabulary'?'vocab_test':item.bucket}
function canonicalId(question){return String(question?.tracking?.questionId||question?.masteryKey||question?.id||'')}
async function gradeSnapshot(snapshot){
  const items=await Promise.all(snapshot.items.map(async item=>{
    if(!item.answered)return{...item,result:{correct:false,message:'',correctAnswer:item.question?.answer||[],method:'unanswered',responseTimeMs:0}};
    const result=await gradeQuestion(item.question,item.response);
    return{...item,result:{...result,responseTimeMs:0}};
  }));
  const correct=items.filter(x=>x.result.correct).length;
  return{...snapshot,items,correct,wrong:items.length-correct,pct:items.length?Math.round(correct/items.length*100):0};
}
function resultBreakdown(snapshot){
  const out={};
  for(const key of Object.keys(LABELS))out[key]={correct:0,total:0};
  for(const item of snapshot.items){
    if(!out[item.bucket])out[item.bucket]={correct:0,total:0};
    out[item.bucket].total++;
    if(item.result?.correct)out[item.bucket].correct++;
  }
  return out;
}
function breakdownHtml(snapshot){
  const breakdown=resultBreakdown(snapshot);
  return `<div class="mock-result-breakdown">${Object.entries(breakdown).filter(([,s])=>s.total).map(([key,s])=>{
    const pct=s.total?Math.round(s.correct/s.total*100):0;
    return `<div class="mock-result-row"><span>${esc(LABELS[key]||key)}</span><strong>${s.correct} / ${s.total}</strong><small>${pct}%</small></div>`;
  }).join('')}</div>`;
}
function renderResults(snapshot){
  const exam=activeExam;if(!exam)return;
  const timedOut=snapshot.reason==='timeout';
  exam.host.innerHTML=`<div class="mock-results"><div class="mock-results-hero"><span class="mock-summary-eyebrow">${timedOut?'시간 종료 · 자동 제출':'실전모의고사 결과'}</span><div class="mock-results-score"><strong>${snapshot.correct}</strong><span>/ ${snapshot.total}</span></div><h2>${snapshot.pct}%</h2><p>틀린 문제 ${snapshot.wrong}개 · 미응답 ${snapshot.total-snapshot.answered}개</p></div><section class="mock-summary-card"><div class="mock-summary-head"><div><span class="mock-summary-eyebrow">영역별 결과</span><h3 class="mock-summary-title">${esc(exam.plan.exam_name||'시험 결과')}</h3></div></div>${breakdownHtml(snapshot)}<div class="mock-result-sync" data-mock-sync>오답과 통계를 저장하는 중...</div></section><div class="mock-actions"><button class="review-primary" type="button" data-mock-finished-back>시험 범위로 돌아가기</button></div></div>`;
  exam.host.querySelector('[data-mock-finished-back]').onclick=exam.onBack;
}
async function persistResults(snapshot,exam){
  const groups=new Map();
  for(const item of snapshot.items){
    const practiceType=practiceTypeFor(item),key=`${item.lesson}\u0000${practiceType}`;
    if(!groups.has(key))groups.set(key,{lesson:item.lesson,practiceType,items:[]});
    groups.get(key).items.push(item);
  }
  for(const group of groups.values()){
    setTrackingContext(exam.plan,group.lesson);
    await startSession(group.practiceType);
    let correct=0;const wrongIds=[];
    for(const item of group.items){
      if(item.result.correct)correct++;else{const id=canonicalId(item.question);if(id)wrongIds.push(id)}
      await recordAttempt({
        question:item.question,response:item.response,result:item.result,practiceType:group.practiceType,skipped:!item.answered,source:'mock-test',
        metadata:{mock_test:true,mock_seed:snapshot.seed,mock_question_number:item.number,mock_bucket:item.bucket,mock_slot:item.slot,lesson:item.lesson,unit_id:item.unitId}
      });
    }
    await completeSession({correct,total:group.items.length,wrongIds:[...new Set(wrongIds)]});
  }
  setTrackingContext(exam.plan,'실전모의고사');
  await startSession('mock_test');
  await completeSession({correct:snapshot.correct,total:snapshot.total,wrongIds:[]});
  await refreshTrackingState();
  invalidateCardStats(exam.plan.id);
  await loadCardStats(exam.plan,exam.studentId,{force:true});
}
async function finishExam(reason='manual'){
  const exam=activeExam;if(!exam||exam.finished)return;
  if(reason==='manual'&&!window.confirm(`답안을 제출하시겠습니까?\n현재 ${answeredCount(exam)} / ${exam.paper.total}문항에 답했습니다.`))return;
  exam.finished=true;if(exam.timer)clearTimeout(exam.timer);exam.timer=null;clearExamGuards();clearSeed(exam.plan.id);
  const raw=submissionSnapshot(reason);
  exam.host.innerHTML='<div class="loading">답안을 채점하는 중...</div>';
  try{
    lastSubmission=await gradeSnapshot(raw);
    renderResults(lastSubmission);
    persistResults(lastSubmission,exam).then(()=>{
      const el=exam.host.querySelector('[data-mock-sync]');if(el)el.textContent=`오답 ${lastSubmission.wrong}문항과 통계에 반영했습니다.`;
    }).catch(e=>{
      console.warn('[mock-test] result sync failed',e);
      const el=exam.host.querySelector('[data-mock-sync]');if(el)el.textContent='결과는 채점됐습니다. 저장 동기화가 지연되고 있습니다.';
    });
  }catch(e){
    console.error('[mock-test] grading failed',e);
    exam.host.innerHTML=`<div class="mock-summary-card"><h2>채점을 완료하지 못했습니다.</h2><p>${esc(e.message||'잠시 후 다시 시도해 주세요.')}</p><button class="review-primary" type="button" data-mock-finished-back>시험 범위로 돌아가기</button></div>`;
    exam.host.querySelector('[data-mock-finished-back]').onclick=exam.onBack;
  }
}
function startExam({host,plan,paper,studentId,onBack}){
  if(!paper?.ready||!paper.questions?.length)return;
  if(activeExam&&!activeExam.finished)stopMockTest();
  activeExam={host,plan,paper,studentId,onBack,index:0,startedAt:Date.now(),endAt:Date.now()+MOCK_TEST_MINUTES*60000,panels:new Map(),renderers:new Map(),responses:new Map(),answered:new Set(),deck:null,timer:null,finished:false};
  lastSubmission=null;installExamGuards();
  host.innerHTML=`<div class="mock-exam"><div class="mock-exam-top"><button class="back" type="button" data-mock-exit>← 시험 종료</button><div class="mock-timer"><span>남은 시간</span><strong data-mock-timer>${MOCK_TEST_MINUTES}:00</strong></div></div><div class="mock-exam-status"><span class="mock-section-pill" data-mock-section></span><strong data-mock-number></strong></div><div class="progress mock-progress"><i data-mock-progress></i></div><div class="mock-question-card"><div class="mock-question-deck" data-mock-deck></div></div><div class="mock-exam-nav"><button class="review-secondary" type="button" data-mock-prev>이전</button><span data-mock-answered>답변 0 / ${paper.total}</span><button class="review-primary" type="button" data-mock-next>다음</button></div></div>`;
  activeExam.deck=host.querySelector('[data-mock-deck]');
  host.querySelector('[data-mock-exit]').onclick=onBack;
  host.querySelector('[data-mock-prev]').onclick=()=>showQuestion(activeExam.index-1);
  host.querySelector('[data-mock-next]').onclick=()=>{
    if(!activeExam||activeExam.finished)return;
    if(activeExam.index>=activeExam.paper.total-1){finishExam('manual');return}
    showQuestion(activeExam.index+1);
  };
  showQuestion(0);tickTimer();
}

export async function renderMockTestPreflight({host,plan,studentId=null,onBack=()=>{}}={}){
  if(!host||!plan?.id)return null;
  if(activeExam)stopMockTest();
  currentPlanId=String(plan.id);
  const token=++activeToken;
  host.innerHTML='<div class="loading">실전모의고사 시험지를 구성하는 중...</div>';
  try{
    const paper=await buildMockTestPaper({plan,studentId,seed:getSeed(plan.id)});
    if(token!==activeToken)return null;
    previewPaper=paper;
    host.innerHTML=`<div class="mock-preflight"><button class="back" type="button" data-mock-back>← ${esc(plan.book_label||'시험 범위')}</button><div class="heading"><div><h2>실전모의고사</h2><p>${MOCK_TEST_TOTAL}문항 · ${MOCK_TEST_MINUTES}분</p></div></div><section class="mock-summary-card"><div class="mock-summary-head"><div><span class="mock-summary-eyebrow">시험 구성</span><h3 class="mock-summary-title">${esc(plan.exam_name||'현재 시험 범위')}</h3><p class="mock-summary-copy">답안은 마지막에 한 번에 제출하고 채점합니다.</p></div><span class="mock-ready ${paper.ready?'':'is-warning'}">${paper.ready?'준비 완료':'확인 필요'}</span></div>${countsHtml(paper)}${diagnosticsHtml(paper)}</section><div class="mock-actions"><button class="review-primary" type="button" data-mock-start ${paper.ready?'':'disabled'}>시험 시작</button></div></div>`;
    host.querySelector('[data-mock-back]').onclick=onBack;
    host.querySelector('[data-mock-start]').onclick=()=>startExam({host,plan,paper,studentId,onBack});
    return paper;
  }catch(e){
    if(token!==activeToken)return null;
    console.error('[mock-test] preflight failed',e);
    host.innerHTML=`<button class="back" type="button" data-mock-back>← ${esc(plan.book_label||'시험 범위')}</button><div class="error">${esc(e.message||'시험지를 구성하지 못했습니다.')}</div>`;
    host.querySelector('[data-mock-back]').onclick=onBack;return null;
  }
}

export function stopMockTest(){
  const planId=activeExam?.plan?.id||currentPlanId;
  activeToken++;
  if(activeExam?.timer)clearTimeout(activeExam.timer);
  clearExamGuards();clearSeed(planId);activeExam=null;previewPaper=null;currentPlanId=null;
}
export function getMockPreviewPaper(){return previewPaper}
export function getMockSubmission(){return lastSubmission?cloneValue(lastSubmission):null}
export function isMockTestActive(){return !!activeExam&&!activeExam.finished}
