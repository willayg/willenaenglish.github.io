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
function esc(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot',"'":'&#39;'}[c]))}
function sectionLabel(q){return({vocab_test:'어휘',communication:'Communication',grammar:'Grammar',reading:'Reading',constructed_response:'서술형'})[String(q?.section||'').toLowerCase()]||String(q?.section||'')}
function setText(el,value){if(el&&el.textContent!==value)el.textContent=value}
function practiceFor(q){const rt=runtime();if(typeof rt.trackingPractice==='function')return rt.trackingPractice(q,null);const s=String(q?.section||'reading').toLowerCase();return s==='vocabulary'?'vocab_test':s}
function trackingKey(item){return`${String(item?.lesson||'')}|${practiceFor(item?.question)}`}
function loadingStyles(){if($('#exam46LoadingStyles'))return;const s=document.createElement('style');s.id='exam46LoadingStyles';s.textContent=`.exam46-loading{min-height:230px;display:grid;place-items:center;text-align:center;padding:28px}.exam46-loading-inner{display:grid;justify-items:center;gap:12px;color:#52666e;font:700 13px/1.45 Poppins,'Noto Sans KR',sans-serif}.exam46-spinner{width:36px;height:36px;border:4px solid #e3ecee;border-top-color:#19777e;border-radius:50%;animation:exam46spin .7s linear infinite}.exam46-dots{display:flex;gap:5px}.exam46-dots i{display:block;width:6px;height:6px;border-radius:50%;background:#78949c;animation:exam46pulse .9s ease-in-out infinite}.exam46-dots i:nth-child(2){animation-delay:.12s}.exam46-dots i:nth-child(3){animation-delay:.24s}@keyframes exam46spin{to{transform:rotate(360deg)}}@keyframes exam46pulse{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}@media(prefers-reduced-motion:reduce){.exam46-spinner,.exam46-dots i{animation:none}}`;document.head.appendChild(s)}
function loadingMarkup(text){loadingStyles();return`<div class="exam46-loading"><div class="exam46-loading-inner"><div class="exam46-spinner" aria-hidden="true"></div><div>${esc(text)}</div><div class="exam46-dots" aria-hidden="true"><i></i><i></i><i></i></div></div></div>`}

function ensureView(){const h=home(),q=quiz();if(h)h.style.display='none';if(q)q.style.display='block';document.querySelector('.app')?.classList.add('tp-exam46-active')}
function ensureBack(){const q=quiz();if(!q)return null;let row=$('#assignedBackRow');if(!row){row=document.createElement('div');row.id='assignedBackRow';row.className='quiz-top-back';q.insertBefore(row,q.firstChild)}return row}
function ensureBackParts(row){let back=row.querySelector('.back-assign'),context=row.querySelector('.quiz-context');if(!back){back=document.createElement('button');back.type='button';back.className='back-assign';row.insertBefore(back,row.firstChild)}if(!context){context=document.createElement('span');context.className='quiz-context';back.insertAdjacentElement('afterend',context)}return{back,context}}
function decorate(){if(!active)return;const item=active.queue[active.index],total=active.queue.length,pos=Math.min(total,active.index+1),row=ensureBack();if(row){const {back,context}=ensureBackParts(row),phase=active.correction?'오답 복습':'모의고사';setText(back,`← ${phase} 종료`);setText(context,`${active.plan.book_label||''} · ${active.scope==='all'?'전체 범위':active.lesson||''} · ${item?item.lesson:''} ${item?`· ${sectionLabel(item.question)}`:''}`);back.onclick=e=>{e.preventDefault();exit(true)}}const qnum=$('#card .qnum');if(qnum)setText(qnum,`${pos} / ${total}`);const pct=Math.max(0,Math.min(100,(active.index/Math.max(1,total))*100));const b=bar();if(b&&b.style.width!==`${pct}%`)b.style.width=`${pct}%`;window.WillenaExamControls?.decorate?.()}
function startDecorator(){stopDecorator();const root=quiz()||document.body;let queued=false;decorator=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;decorate()})});decorator.observe(root,{childList:true,subtree:true});decorate()}
function stopDecorator(){decorator?.disconnect?.();decorator=null}
function showLoading(text='모의고사를 준비하는 중...'){ensureView();const c=card();if(c)c.innerHTML=loadingMarkup(text);if(bar())bar().style.width='0';ensureBack()}
function pushState(scope,planId,lesson){history.pushState({tp:'practice',skill:'exam46',scope,planId:String(planId),lesson:lesson||null,returnTo:scope==='all'?'home':'lesson'},'',location.href)}

async function startLesson(planId,lesson){const plan=planById(planId);if(!plan)throw new Error('시험 계획을 찾지 못했습니다.');pushState('lesson',planId,lesson);showLoading(`${lesson} 모의고사 25문제를 준비하는 중...`);const manifest=await builder().buildLesson(plan,lesson);return begin(plan,manifest,'lesson',lesson)}
async function startAll(planId){const plan=planById(planId);if(!plan)throw new Error('시험 계획을 찾지 못했습니다.');pushState('all',planId,null);showLoading('전체 범위 모의고사 25문제를 준비하는 중...');const manifest=await builder().buildAll(plan);return begin(plan,manifest,'all',null)}

async function begin(plan,manifest,scope,lesson){if(!manifest?.items?.length)throw new Error('모의고사에 사용할 문제가 없습니다.');serial++;active={serial,plan,manifest,scope,lesson,queue:manifest.items,index:0,results:[],firstPassResults:null,correction:false,startedAt:Date.now(),phaseStartedAt:Date.now(),finishedAt:null,trackingKey:null,trackingPractice:null,trackingLesson:null,trackingGroupResults:[],replacementsLeft:2,replacementsUsed:[]};ensureView();startDecorator();window.dispatchEvent(new CustomEvent('exam46:start',{detail:{manifest,scope,lesson,replacementsLeft:2}}));await runCurrent(active.serial);return active}

async function closeTrackingGroup(state){if(!state)return;const rows=Array.isArray(state.trackingGroupResults)?state.trackingGroupResults.slice():[];if(!state.trackingKey||!rows.length){state.trackingKey=null;state.trackingPractice=null;state.trackingLesson=null;state.trackingGroupResults=[];return}const correct=rows.filter(r=>r.correct).length,wrongIds=rows.filter(r=>!r.correct).map(r=>String(r.questionId||r.question?.id||'')).filter(Boolean);await auth()?.completeSession?.(correct,rows.length,wrongIds);state.trackingKey=null;state.trackingPractice=null;state.trackingLesson=null;state.trackingGroupResults=[]}
async function prepareTracking(state,item){const key=trackingKey(item),practice=practiceFor(item.question),lesson=String(item.lesson||state.lesson||'');if(state.trackingKey===key&&auth()?.state?.session)return;if(state.trackingKey)await closeTrackingGroup(state);const a=auth();a?.setActivePlan?.(state.plan,lesson||null);await a?.ensureSession?.(practice);a?.beginStudyActivity?.();state.trackingKey=key;state.trackingPractice=practice;state.trackingLesson=lesson;state.trackingGroupResults=[]}

async function runCurrent(runId){
 if(!active||active.serial!==runId)return;
 if(active.index>=active.queue.length){await finishPhase();return}
 const state=active,item=state.queue[state.index],c=card();if(c)c.innerHTML=loadingMarkup(state.correction?'오답 문제를 불러오는 중...':'다음 문제를 불러오는 중...');decorate();
 try{
  await prepareTracking(state,item);if(!active||active!==state||state.serial!==runId)return;
  const result=await runtime().run(item.question,{mode:'exam',examSessionId:state.manifest.id,scope:state.scope,planId:state.plan.id,lesson:item.lesson,position:state.index+1,total:state.queue.length,correction:state.correction});
  if(!active||active!==state||state.serial!==runId||result?.cancelled)return;
  const full={...result,manifestPosition:item.position,lesson:item.lesson,question:item.question};state.results.push(full);state.trackingGroupResults.push(full);state.index++;window.dispatchEvent(new CustomEvent('exam46:answer',{detail:{result,index:state.index,total:state.queue.length,correction:state.correction}}));runCurrent(runId);
 }catch(e){if(String(e?.message||e)==='QUESTION_RUNTIME_CANCELLED')return;console.error('[REV46j] exam question failed',e);showRuntimeError(item,e)}
}
function showRuntimeError(item,e){const c=card();if(!c)return;c.innerHTML=`<div class="empty"><b>이 문제를 실행하지 못했습니다.</b><br><small>${esc(item?.question?.question_type||'unknown')} · ${esc(e?.message||e)}</small><div class="actions" style="margin-top:16px"><button class="secondary" id="exam46Retry">다시 시도</button><button class="secondary" id="exam46Exit">모의고사 종료</button></div></div>`;$('#exam46Retry')?.addEventListener('click',()=>runCurrent(active?.serial));$('#exam46Exit')?.addEventListener('click',()=>exit(true));decorate()}

async function prepareReplacement(){
 const state=active,item=state?.queue?.[state.index];
 if(!state||state.correction||state.finishedAt||!item)throw new Error('지금은 문제를 교체할 수 없습니다.');
 if(state.replacementsLeft<=0)throw new Error('문제 교체 기회를 모두 사용했습니다.');
 if(!runtime()?.current)throw new Error('답을 확인하기 전에만 문제를 교체할 수 있습니다.');
 return builder().replacementFor(state.plan,state.manifest,item)
}
async function applyReplacement(replacement){
 const state=active,original=state?.queue?.[state.index];
 if(!state||!original||state.correction||state.replacementsLeft<=0)throw new Error('문제를 교체할 수 없습니다.');
 if(!replacement?.question)throw new Error('교체 문제를 찾지 못했습니다.');
 const originalId=String(original.question?.id||''),replacementId=String(replacement.question?.id||'');
 if(!replacementId||originalId===replacementId)throw new Error('다른 교체 문제를 찾지 못했습니다.');
 serial++;state.serial=serial;
 runtime().cancel();
 state.manifest.replacedQuestionIds=Array.isArray(state.manifest.replacedQuestionIds)?state.manifest.replacedQuestionIds:[];
 state.manifest.replacedQuestionIds.push(originalId);
 const fixed={...replacement,position:original.position};
 state.queue[state.index]=fixed;
 const mi=state.manifest.items.findIndex(x=>Number(x.position)===Number(original.position));
 if(mi>=0)state.manifest.items[mi]=fixed;
 state.replacementsLeft--;
 state.replacementsUsed.push({position:state.index+1,originalQuestionId:originalId,replacementQuestionId:replacementId,at:new Date().toISOString()});
 const c=card();if(c)c.innerHTML=loadingMarkup('교체 문제를 불러오는 중...');
 window.dispatchEvent(new CustomEvent('exam46:replacement',{detail:{position:state.index+1,originalQuestionId:originalId,replacementQuestionId:replacementId,replacementsLeft:state.replacementsLeft}}));
 decorate();await runCurrent(state.serial);return fixed
}

function itemForResult(r){return active?.manifest?.items?.find(i=>String(i.question?.id)===String(r.question?.id||r.questionId)&&String(i.lesson)===String(r.lesson))||{position:r.manifestPosition||0,lesson:r.lesson||'',unitId:r.question?.__unitId||'',engine:runtime().engineFor(r.question),question:r.question}}
function correctionItems(results){return(results||[]).filter(r=>!r.correct).map(itemForResult).filter(x=>x?.question)}
function originalRows(state=active){return state?.firstPassResults||state?.results||[]}
function originalStats(state=active){const rows=originalRows(state),total=rows.length,correct=rows.filter(r=>r.correct).length;return{total,correct,wrong:Math.max(0,total-correct),pct:total?Math.round(correct/total*100):0}}

async function finishPhase(){const state=active;if(!state)return;stopDecorator();runtime().cancel();state.finishedAt=Date.now();try{await closeTrackingGroup(state)}catch(e){console.warn('[REV46j] final tracking block close failed',e)}if(!active||active!==state)return;if(!state.correction){state.firstPassResults=state.results.slice();renderFirstPassResult();return}const remaining=correctionItems(state.results);if(remaining.length){renderCorrectionRetry(remaining.length);return}renderCorrectionComplete()}
function renderFirstPassResult(){if(!active)return;const stats=originalStats(),wrongItems=correctionItems(active.firstPassResults),c=card(),b=bar();if(b)b.style.width='100%';if(c)c.innerHTML=`<div class="result exam46-result"><div class="score">${stats.correct}/${stats.total}</div><h2>모의고사 완료</h2><p>정답률 ${stats.pct}% · 오답 ${stats.wrong}개</p><div class="actions">${wrongItems.length?'<button class="primary" id="exam46Corrections">오답 복습 시작</button>':'<button class="primary" id="exam46Done">완료</button>'}</div></div>`;$('#exam46Corrections')?.addEventListener('click',()=>startCorrections(wrongItems));$('#exam46Done')?.addEventListener('click',()=>exit(false));window.dispatchEvent(new CustomEvent('exam46:complete',{detail:{manifest:active.manifest,results:active.firstPassResults,correct:stats.correct,total:stats.total,wrong:stats.wrong,replacementsUsed:active.replacementsUsed}}));window.WillenaExamControls?.decorate?.()}
function renderCorrectionRetry(count){if(!active)return;const stats=originalStats(),c=card(),b=bar();if(b)b.style.width='100%';if(c)c.innerHTML=`<div class="result exam46-result"><div class="score">${count}</div><h2>아직 ${count}문제가 남았어요.</h2><p>틀린 문제를 다시 풀어 모두 맞혀 보세요.</p><div class="actions"><button class="primary" id="exam46RetryWrong">틀린 문제 다시 풀기</button></div></div>`;$('#exam46RetryWrong')?.addEventListener('click',()=>startCorrections(correctionItems(active.results)));window.dispatchEvent(new CustomEvent('exam46:correction-round',{detail:{remaining:count,original:stats}}));window.WillenaExamControls?.decorate?.()}
function renderCorrectionComplete(){if(!active)return;const stats=originalStats(),c=card(),b=bar();if(b)b.style.width='100%';if(c)c.innerHTML=`<div class="result exam46-result"><div class="score">✓</div><h2>오답 복습 완료</h2><p>처음 점수 ${stats.correct}/${stats.total} · 모든 오답을 다시 맞혔어요.</p><div class="actions"><button class="primary" id="exam46Done">완료</button></div></div>`;$('#exam46Done')?.addEventListener('click',()=>exit(false));window.dispatchEvent(new CustomEvent('exam46:correction-complete',{detail:{manifest:active.manifest,firstPassResults:active.firstPassResults,original:stats}}));window.WillenaExamControls?.decorate?.()}
function startCorrections(items){if(!active||!items?.length)return;serial++;active.serial=serial;active.queue=items;active.index=0;active.results=[];active.correction=true;active.phaseStartedAt=Date.now();active.finishedAt=null;active.trackingKey=null;active.trackingPractice=null;active.trackingLesson=null;active.trackingGroupResults=[];ensureView();startDecorator();window.dispatchEvent(new CustomEvent('exam46:correction-start',{detail:{count:items.length,manifest:active.manifest}}));runCurrent(active.serial)}

function cleanupState(old){runtime().cancel();stopDecorator();document.querySelector('.app')?.classList.remove('tp-exam46-active');window.WillenaVocabTestPractice?.restore?.();window.WillenaExamControls?.stop?.();Promise.resolve(closeTrackingGroup(old)).catch(e=>console.warn('[REV46j] exit tracking close failed',e))}
function exit(confirmExit=false){if(!active&&history.state?.skill!=='exam46')return;if(confirmExit&&active&&active.index<active.queue.length&&!confirm(active.correction?'오답 복습을 종료할까요?':'모의고사를 종료할까요?'))return;const old=active;active=null;cleanupState(old);if(history.state?.skill==='exam46')history.back();setTimeout(()=>{if(old?.scope==='lesson'&&old.plan?.id&&old.lesson)window.WillenaTestPrepUX?.renderLesson?.(old.plan.id,old.lesson);else window.WillenaTestPrepUX?.renderHome?.()},0)}
window.addEventListener('popstate',()=>{if(active&&history.state?.skill!=='exam46'){const old=active;active=null;cleanupState(old)}});
window.WillenaExamSession={startLesson,startAll,startCorrections,prepareReplacement,applyReplacement,exit,decorate,get active(){return active},get currentItem(){return active?.queue?.[active.index]||null},get firstPassResults(){return active?.firstPassResults||null},get replacementsLeft(){return active?.replacementsLeft??0}};
console.log('[REV46j] ExamSession two-question replacement flow ready');
})();