(function(){
'use strict';

const $=(s,r=document)=>r.querySelector(s);
let active=null,decorator=null,serial=0;

function auth(){return window.WillenaTestPrepAuth}
function builder(){const x=window.WillenaExamBuilder;if(!x)throw new Error('ExamBuilder is not ready.');return x}
function runtime(){const x=window.WillenaQuestionRuntime;if(!x)throw new Error('QuestionRuntime is not ready.');return x}
function planById(id){return auth()?.state?.plans?.find(p=>String(p.id)===String(id))||null}
function card(){return $('#card')}
function bar(){return $('#bar')}
function home(){return $('#assignmentHome')}
function quiz(){return $('#assignedQuizPane')}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function sectionLabel(q){return({vocab_test:'어휘',communication:'Communication',grammar:'Grammar',reading:'Reading',constructed_response:'서술형'})[String(q?.section||'').toLowerCase()]||String(q?.section||'')}

function ensureView(){const h=home(),q=quiz();if(h)h.style.display='none';if(q)q.style.display='block';document.querySelector('.app')?.classList.add('tp-exam45-active')}
function ensureBack(){const q=quiz();if(!q)return null;let row=$('#assignedBackRow');if(!row){row=document.createElement('div');row.id='assignedBackRow';row.className='quiz-top-back';q.insertBefore(row,q.firstChild)}return row}
function decorate(){
 if(!active)return;const item=active.queue[active.index],total=active.queue.length,pos=Math.min(total,active.index+1),row=ensureBack();
 if(row){
  const phase=active.correction?'오답 복습':'모의고사';
  row.innerHTML=`<button class="back-assign">← ${phase} 종료</button><span class="quiz-context">${esc(active.plan.book_label||'')} · ${active.scope==='all'?'전체 범위':esc(active.lesson||'')} · ${item?esc(item.lesson):''} ${item?`· ${esc(sectionLabel(item.question))}`:''}</span>`;
  row.querySelector('button').onclick=e=>{e.preventDefault();exit(true)};
 }
 const qnum=$('#card .qnum');if(qnum)qnum.textContent=`${pos} / ${total}`;
 const vcount=$('#testPrepVocabTestPractice .vtu-count');if(vcount)vcount.textContent=`${pos} / ${total}`;
 const b=bar();if(b)b.style.width=`${Math.max(0,Math.min(100,(active.index/Math.max(1,total))*100))}%`;
 const vb=$('#testPrepVocabTestPractice .vtu-progress i');if(vb)vb.style.width=`${Math.max(0,Math.min(100,(active.index/Math.max(1,total))*100))}%`;
 window.WillenaExamControls?.decorate?.();
}
function startDecorator(){stopDecorator();const root=quiz()||document.body;decorator=new MutationObserver(()=>queueMicrotask(decorate));decorator.observe(root,{childList:true,subtree:true});decorate()}
function stopDecorator(){decorator?.disconnect?.();decorator=null}
function showLoading(text='모의고사를 준비하는 중...'){ensureView();const c=card();if(c)c.innerHTML=`<div class="loading">${esc(text)}</div>`;if(bar())bar().style.width='0';ensureBack()}
function pushState(scope,planId,lesson){history.pushState({tp:'practice',skill:'exam45',scope,planId:String(planId),lesson:lesson||null,returnTo:scope==='all'?'home':'lesson'},'',location.href)}

async function startLesson(planId,lesson){const plan=planById(planId);if(!plan)throw new Error('시험 계획을 찾지 못했습니다.');pushState('lesson',planId,lesson);showLoading(`${lesson} 모의고사 25문제를 준비하는 중...`);const manifest=await builder().buildLesson(plan,lesson);return begin(plan,manifest,'lesson',lesson)}
async function startAll(planId){const plan=planById(planId);if(!plan)throw new Error('시험 계획을 찾지 못했습니다.');pushState('all',planId,null);showLoading('전체 범위 모의고사 25문제를 준비하는 중...');const manifest=await builder().buildAll(plan);return begin(plan,manifest,'all',null)}

async function begin(plan,manifest,scope,lesson){
 if(!manifest?.items?.length)throw new Error('모의고사에 사용할 문제가 없습니다.');
 serial++;active={serial,plan,manifest,scope,lesson,queue:manifest.items,index:0,results:[],firstPassResults:null,correction:false,startedAt:Date.now(),phaseStartedAt:Date.now(),finishedAt:null};
 ensureView();startDecorator();window.dispatchEvent(new CustomEvent('exam45:start',{detail:{manifest,scope,lesson}}));
 await runCurrent(active.serial);return active;
}

async function runCurrent(runId){
 if(!active||active.serial!==runId)return;if(active.index>=active.queue.length){finishPhase();return}
 const item=active.queue[active.index],c=card();if(c)c.innerHTML='<div class="loading">문제를 불러오는 중...</div>';decorate();
 try{
  const result=await runtime().run(item.question,{mode:'exam',examSessionId:active.manifest.id,scope:active.scope,planId:active.plan.id,lesson:item.lesson,position:active.index+1,total:active.queue.length,correction:active.correction});
  if(!active||active.serial!==runId)return;active.results.push({...result,manifestPosition:item.position,lesson:item.lesson,question:item.question});active.index++;window.dispatchEvent(new CustomEvent('exam45:answer',{detail:{result,index:active.index,total:active.queue.length,correction:active.correction}}));await runCurrent(runId);
 }catch(e){console.error('[REV45e] exam question failed',e);showRuntimeError(item,e)}
}

function showRuntimeError(item,e){const c=card();if(!c)return;c.innerHTML=`<div class="empty"><b>이 문제를 실행하지 못했습니다.</b><br><small>${esc(item?.question?.question_type||'unknown')} · ${esc(e?.message||e)}</small><div class="actions" style="margin-top:16px"><button class="secondary" id="exam45Retry">다시 시도</button><button class="secondary" id="exam45Exit">모의고사 종료</button></div></div>`;$('#exam45Retry')?.addEventListener('click',()=>runCurrent(active?.serial));$('#exam45Exit')?.addEventListener('click',()=>exit(true));decorate()}

function itemForResult(r){
 return active?.manifest?.items?.find(i=>String(i.question?.id)===String(r.question?.id||r.questionId)&&String(i.lesson)===String(r.lesson))||{position:r.manifestPosition||0,lesson:r.lesson||'',unitId:r.question?.__unitId||'',engine:runtime().engineFor(r.question),question:r.question};
}
function correctionItems(results){return(results||[]).filter(r=>!r.correct).map(itemForResult).filter(x=>x?.question)}
function originalStats(){const rows=active?.firstPassResults||active?.results||[],total=rows.length,correct=rows.filter(r=>r.correct).length;return{total,correct,wrong:Math.max(0,total-correct),pct:total?Math.round(correct/total*100):0}}

function finishPhase(){
 if(!active)return;stopDecorator();runtime().cancel();active.finishedAt=Date.now();
 if(!active.correction){active.firstPassResults=active.results.slice();renderFirstPassResult();return}
 const remaining=correctionItems(active.results);if(remaining.length){renderCorrectionRetry(remaining.length);return}renderCorrectionComplete();
}

function renderFirstPassResult(){
 if(!active)return;const stats=originalStats(),wrongItems=correctionItems(active.firstPassResults),c=card(),b=bar();if(b)b.style.width='100%';
 if(c)c.innerHTML=`<div class="result exam45-result"><div class="score">${stats.correct}/${stats.total}</div><h2>모의고사 완료</h2><p>정답률 ${stats.pct}% · 오답 ${stats.wrong}개</p><div class="actions">${wrongItems.length?'<button class="primary" id="exam45Corrections">오답 복습 시작</button>':'<button class="primary" id="exam45Done">완료</button>'}</div></div>`;
 $('#exam45Corrections')?.addEventListener('click',()=>startCorrections(wrongItems));$('#exam45Done')?.addEventListener('click',()=>exit(false));
 window.dispatchEvent(new CustomEvent('exam45:complete',{detail:{manifest:active.manifest,results:active.firstPassResults,correct:stats.correct,total:stats.total,wrong:stats.wrong}}));window.WillenaExamControls?.decorate?.();
}
function renderCorrectionRetry(count){
 if(!active)return;const stats=originalStats(),c=card(),b=bar();if(b)b.style.width='100%';if(c)c.innerHTML=`<div class="result exam45-result"><div class="score">${count}</div><h2>아직 ${count}문제가 남았어요.</h2><p>틀린 문제를 다시 풀어 모두 맞혀 보세요.</p><div class="actions"><button class="primary" id="exam45RetryWrong">틀린 문제 다시 풀기</button></div></div>`;$('#exam45RetryWrong')?.addEventListener('click',()=>startCorrections(correctionItems(active.results)));window.dispatchEvent(new CustomEvent('exam45:correction-round',{detail:{remaining:count,original:stats}}));window.WillenaExamControls?.decorate?.();
}
function renderCorrectionComplete(){
 if(!active)return;const stats=originalStats(),c=card(),b=bar();if(b)b.style.width='100%';if(c)c.innerHTML=`<div class="result exam45-result"><div class="score">✓</div><h2>오답 복습 완료</h2><p>처음 점수 ${stats.correct}/${stats.total} · 모든 오답을 다시 맞혔어요.</p><div class="actions"><button class="primary" id="exam45Done">완료</button></div></div>`;$('#exam45Done')?.addEventListener('click',()=>exit(false));window.dispatchEvent(new CustomEvent('exam45:correction-complete',{detail:{manifest:active.manifest,firstPassResults:active.firstPassResults,original:stats}}));window.WillenaExamControls?.decorate?.();
}
function startCorrections(items){
 if(!active||!items?.length)return;serial++;active.serial=serial;active.queue=items;active.index=0;active.results=[];active.correction=true;active.phaseStartedAt=Date.now();active.finishedAt=null;ensureView();startDecorator();window.dispatchEvent(new CustomEvent('exam45:correction-start',{detail:{count:items.length,manifest:active.manifest}}));runCurrent(active.serial);
}

function exit(confirmExit=false){
 if(!active&&history.state?.skill!=='exam45')return;if(confirmExit&&active&&active.index<active.queue.length&&!confirm(active.correction?'오답 복습을 종료할까요?':'모의고사를 종료할까요?'))return;
 const old=active;runtime().cancel();stopDecorator();active=null;document.querySelector('.app')?.classList.remove('tp-exam45-active');window.WillenaVocabTestPractice?.restore?.();window.WillenaExamControls?.stop?.();
 if(history.state?.skill==='exam45')history.back();
 setTimeout(()=>{if(old?.scope==='lesson'&&old.plan?.id&&old.lesson)window.WillenaTestPrepUX?.renderLesson?.(old.plan.id,old.lesson);else window.WillenaTestPrepUX?.renderHome?.()},0)
}

window.addEventListener('popstate',()=>{if(active&&history.state?.skill!=='exam45'){runtime().cancel();stopDecorator();active=null;document.querySelector('.app')?.classList.remove('tp-exam45-active');window.WillenaExamControls?.stop?.()}});
window.WillenaExamSession={startLesson,startAll,startCorrections,exit,decorate,get active(){return active},get currentItem(){return active?.queue?.[active.index]||null},get firstPassResults(){return active?.firstPassResults||null}};
console.log('[REV45e] ExamSession corrections ready');
})();
