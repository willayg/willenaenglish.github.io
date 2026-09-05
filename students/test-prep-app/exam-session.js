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
 if(row){row.innerHTML=`<button class="back-assign">← 모의고사 종료</button><span class="quiz-context">${esc(active.plan.book_label||'')} · ${active.scope==='all'?'전체 범위':esc(active.lesson||'')} · ${item?esc(item.lesson):''} ${item?`· ${esc(sectionLabel(item.question))}`:''}</span>`;row.querySelector('button').onclick=e=>{e.preventDefault();exit(true)}}
 const qnum=$('#card .qnum');if(qnum)qnum.textContent=`${pos} / ${total}`;
 const vcount=$('#testPrepVocabTestPractice .vtu-count');if(vcount)vcount.textContent=`${pos} / ${total}`;
 const b=bar();if(b)b.style.width=`${Math.max(0,Math.min(100,(active.index/Math.max(1,total))*100))}%`;
 const vb=$('#testPrepVocabTestPractice .vtu-progress i');if(vb)vb.style.width=`${Math.max(0,Math.min(100,(active.index/Math.max(1,total))*100))}%`;
}
function startDecorator(){stopDecorator();const root=quiz()||document.body;decorator=new MutationObserver(()=>queueMicrotask(decorate));decorator.observe(root,{childList:true,subtree:true});decorate()}
function stopDecorator(){decorator?.disconnect?.();decorator=null}
function showLoading(text='모의고사를 준비하는 중...'){ensureView();const c=card();if(c)c.innerHTML=`<div class="loading">${esc(text)}</div>`;if(bar())bar().style.width='0';ensureBack()}
function pushState(scope,planId,lesson){history.pushState({tp:'practice',skill:'exam45',scope,planId:String(planId),lesson:lesson||null,returnTo:scope==='all'?'home':'lesson'},'',location.href)}

async function startLesson(planId,lesson){const plan=planById(planId);if(!plan)throw new Error('시험 계획을 찾지 못했습니다.');pushState('lesson',planId,lesson);showLoading(`${lesson} 모의고사 25문제를 준비하는 중...`);const manifest=await builder().buildLesson(plan,lesson);return begin(plan,manifest,'lesson',lesson)}
async function startAll(planId){const plan=planById(planId);if(!plan)throw new Error('시험 계획을 찾지 못했습니다.');pushState('all',planId,null);showLoading('전체 범위 모의고사 25문제를 준비하는 중...');const manifest=await builder().buildAll(plan);return begin(plan,manifest,'all',null)}

async function begin(plan,manifest,scope,lesson){
 if(!manifest?.items?.length)throw new Error('모의고사에 사용할 문제가 없습니다.');
 serial++;active={serial,plan,manifest,scope,lesson,queue:manifest.items,index:0,results:[],correction:false,startedAt:Date.now()};
 ensureView();startDecorator();window.dispatchEvent(new CustomEvent('exam45:start',{detail:{manifest,scope,lesson}}));
 await runCurrent(active.serial);return active;
}

async function runCurrent(runId){
 if(!active||active.serial!==runId)return;if(active.index>=active.queue.length){finish();return}
 const item=active.queue[active.index],c=card();if(c)c.innerHTML='<div class="loading">문제를 불러오는 중...</div>';decorate();
 try{
  const result=await runtime().run(item.question,{mode:'exam',examSessionId:active.manifest.id,scope:active.scope,planId:active.plan.id,lesson:item.lesson,position:active.index+1,total:active.queue.length,correction:active.correction});
  if(!active||active.serial!==runId)return;active.results.push({...result,manifestPosition:item.position,lesson:item.lesson,question:item.question});active.index++;window.dispatchEvent(new CustomEvent('exam45:answer',{detail:{result,index:active.index,total:active.queue.length}}));await runCurrent(runId);
 }catch(e){console.error('[REV45d] exam question failed',e);showRuntimeError(item,e)}
}

function showRuntimeError(item,e){const c=card();if(!c)return;c.innerHTML=`<div class="empty"><b>이 문제를 실행하지 못했습니다.</b><br><small>${esc(item?.question?.question_type||'unknown')} · ${esc(e?.message||e)}</small><div class="actions" style="margin-top:16px"><button class="secondary" id="exam45Retry">다시 시도</button><button class="secondary" id="exam45Exit">모의고사 종료</button></div></div>`;$('#exam45Retry')?.addEventListener('click',()=>runCurrent(active?.serial));$('#exam45Exit')?.addEventListener('click',()=>exit(true))}

function finish(){
 if(!active)return;stopDecorator();runtime().cancel();const total=active.results.length,correct=active.results.filter(r=>r.correct).length,wrong=active.results.filter(r=>!r.correct),pct=total?Math.round(correct/total*100):0,c=card(),b=bar();if(b)b.style.width='100%';
 if(c)c.innerHTML=`<div class="result exam45-result"><div class="score">${correct}/${total}</div><h2>모의고사 완료</h2><p>정답률 ${pct}% · 오답 ${wrong.length}개</p><div class="actions"><button class="primary" id="exam45Done">완료</button></div></div>`;
 $('#exam45Done')?.addEventListener('click',()=>exit(false));window.dispatchEvent(new CustomEvent('exam45:complete',{detail:{manifest:active.manifest,results:active.results,correct,total,wrong:wrong.length}}));
}

function exit(confirmExit=false){
 if(!active&&history.state?.skill!=='exam45')return;if(confirmExit&&active&&active.index<active.queue.length&&!confirm('모의고사를 종료할까요?'))return;
 const old=active;runtime().cancel();stopDecorator();active=null;document.querySelector('.app')?.classList.remove('tp-exam45-active');window.WillenaVocabTestPractice?.restore?.();
 if(history.state?.skill==='exam45')history.back();
 setTimeout(()=>{if(old?.scope==='lesson'&&old.plan?.id&&old.lesson)window.WillenaTestPrepUX?.renderLesson?.(old.plan.id,old.lesson);else window.WillenaTestPrepUX?.renderHome?.()},0)
}

window.addEventListener('popstate',()=>{if(active&&history.state?.skill!=='exam45'){runtime().cancel();stopDecorator();active=null;document.querySelector('.app')?.classList.remove('tp-exam45-active')}});
window.WillenaExamSession={startLesson,startAll,exit,get active(){return active},get currentItem(){return active?.queue?.[active.index]||null}};
console.log('[REV45d] ExamSession ready');
})();
