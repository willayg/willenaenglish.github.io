(function(){
'use strict';

const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const HEAD={apikey:KEY,Authorization:`Bearer ${KEY}`};
const REGULAR=['communication','grammar','reading'];
const BLUEPRINT={vocab_test:5,communication:5,grammar:7,reading:8};
const FIELDS='id,source_id,source_question_number,source_page,section,question_type,prompt_text,context,choices,correct_answer,targets,answer_mode,difficulty,student_source_label,content_status,metadata,replacement_needed';
const $=(s,r=document)=>r.querySelector(s);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const shuffle=a=>{const b=[...(a||[])];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b};
const norm=v=>String(v||'').trim().toLowerCase();

let patched=false;
let originalQuestionLoad=null;
let active=null;
let currentCapture=null;
let paintQueued=false;
let runSerial=0;

async function get(path){const r=await fetch(CONTENT+path,{headers:HEAD,cache:'no-store'});if(!r.ok)throw new Error(await r.text());return r.json()}
function scopeLessons(plan){const ls=plan?.group?.scope?.lessons;if(Array.isArray(ls)&&ls.length)return ls.filter(x=>x?.lesson);return(plan?.units||[]).map(lesson=>({lesson,sections:plan.practice_types||[]}))}
function scopeRow(plan,lesson){return scopeLessons(plan).find(x=>String(x.lesson)===String(lesson))||{lesson,sections:plan?.practice_types||[]}}
function sectionsFor(plan,row){const raw=Array.isArray(row?.sections)?row.sections:(plan?.practice_types||[]);const allowed=raw.map(norm).filter(x=>REGULAR.includes(x));return allowed.length?[...new Set(allowed)]:REGULAR}
function vocabAllowed(plan,row){const raw=(Array.isArray(row?.sections)?row.sections:(plan?.practice_types||[])).map(norm);return raw.includes('vocabulary')||raw.includes('vocab_test')||!plan?.group?.scope?.scope_controls_v2}
function allocate(total,n){if(!n)return[];const base=Math.floor(total/n),rem=total%n;return Array.from({length:n},(_,i)=>base+(i<rem?1:0))}

async function resolveBookAndUnits(plan){
 const books=await get(`/rest/v1/content_books?select=id,title&title=eq.${encodeURIComponent(plan.book_label||'')}&limit=1`);
 if(!books[0])throw new Error('교재를 찾지 못했습니다.');
 const units=await get(`/rest/v1/content_units?select=id,title&book_id=eq.${encodeURIComponent(books[0].id)}`);
 return{bookId:books[0].id,unitMap:new Map((units||[]).map(x=>[String(x.title),String(x.id)]))};
}
async function fetchPool(bookId,unitId,section,lesson){
 const q=new URLSearchParams({select:FIELDS,student_usable:'eq.true',book_id:`eq.${bookId}`,unit_id:`eq.${unitId}`,section:`eq.${section}`});
 const r=await fetch(`${CONTENT}/rest/v1/test_prep_questions?${q}`,{headers:HEAD,cache:'no-store'});
 if(!r.ok)throw new Error(await r.text());
 const rows=await r.json();
 return(rows||[]).filter(x=>x?.replacement_needed!==true).map(x=>({...x,__lesson:String(lesson),__unitId:String(unitId)}));
}
async function vocabPool(unitId,lesson){
 for(let i=0;i<100;i++){
  const api=window.WillenaVocabTestPractice;
  if(api?.buildMockPool)return(await api.buildMockPool(unitId,lesson)).map(x=>({...x,__lesson:String(lesson),__unitId:String(unitId)}));
  await delay(40);
 }
 return[];
}
function takeTypes(rows,count,used){
 const groups=new Map();
 for(const q of shuffle((rows||[]).filter(x=>!used.has(String(x.id))))){const t=String(q.question_type||'other');if(!groups.has(t))groups.set(t,[]);groups.get(t).push(q)}
 const keys=shuffle([...groups.keys()]),out=[];let moved=true;
 while(out.length<count&&moved){moved=false;for(const k of keys){const g=groups.get(k);if(g?.length&&out.length<count){const q=g.shift();used.add(String(q.id));out.push(q);moved=true}}}
 return out;
}
function takeAcrossLessons(rows,count,used){
 const map=new Map();for(const q of rows||[]){const k=String(q.__lesson||'');if(!map.has(k))map.set(k,[]);map.get(k).push(q)}
 const groups=[...map.values()].filter(x=>x.length),quotas=allocate(count,groups.length),out=[];
 groups.forEach((g,i)=>out.push(...takeTypes(g,quotas[i],used)));
 if(out.length<count)out.push(...takeTypes(rows,count-out.length,used));
 return out;
}
function orderManifest(picked){const final=picked.slice(0,25),vocab=final.filter(q=>q.section==='vocab_test'),rest=final.filter(q=>q.section!=='vocab_test');return[...shuffle(vocab),...shuffle(rest)]}

async function buildLesson(sel){
 const plan=sel.plan,row=scopeRow(plan,sel.lesson),sections=sectionsFor(plan,row),sectionRows={vocab_test:[],communication:[],grammar:[],reading:[]};
 if(vocabAllowed(plan,row))sectionRows.vocab_test=await vocabPool(sel.unitId,sel.lesson);
 for(const section of sections)sectionRows[section]=await fetchPool(sel.bookId,sel.unitId,section,sel.lesson);
 const used=new Set(),picked=[];
 for(const section of ['vocab_test','communication','grammar','reading']){
  if(!sectionRows[section].length)continue;
  picked.push(...takeTypes(sectionRows[section],BLUEPRINT[section],used));
 }
 if(picked.length<25)picked.push(...takeTypes(Object.values(sectionRows).flat(),25-picked.length,used));
 if(!picked.length)throw new Error('모의고사 문제를 찾지 못했습니다.');
 return orderManifest(picked);
}
async function buildAll(plan){
 const {bookId,unitMap}=await resolveBookAndUnits(plan),lessons=scopeLessons(plan);
 if(!lessons.length)throw new Error('시험 범위 Lesson이 없습니다.');
 const sectionRows={vocab_test:[],communication:[],grammar:[],reading:[]};
 for(const row of lessons){
  const lesson=String(row.lesson),unitId=unitMap.get(lesson);if(!unitId)continue;
  if(vocabAllowed(plan,row))sectionRows.vocab_test.push(...await vocabPool(unitId,lesson));
  for(const section of sectionsFor(plan,row))sectionRows[section].push(...await fetchPool(bookId,unitId,section,lesson));
 }
 const used=new Set(),picked=[];
 for(const section of ['vocab_test','communication','grammar','reading'])if(sectionRows[section].length)picked.push(...takeAcrossLessons(sectionRows[section],BLUEPRINT[section],used));
 if(picked.length<25)picked.push(...takeAcrossLessons(Object.values(sectionRows).flat(),25-picked.length,used));
 if(!picked.length)throw new Error('모의고사 문제를 찾지 못했습니다.');
 return orderManifest(picked);
}

function authoredFlag(q){const m=q?.metadata||{};return m.constructed_response_authored===true||m.constructed_response_authored==='true'||m.authored_constructed_response===true||m.authored_constructed_response==='true'||m.constructed_response===true||m.constructed_response==='true'}
function routeFor(q){
 if(String(q?.section||'').toLowerCase()==='vocab_test'||/^vocab_/i.test(String(q?.question_type||'')))return'vocab';
 if(String(q?.answer_mode||'').toLowerCase()==='text'||authoredFlag(q)||!Array.isArray(q?.choices)||!q.choices.length)return'authored';
 return'choice';
}
function normalizeChoice(q){const mode=String(q.answer_mode||'').toLowerCase();return{...q,answer_mode:mode==='single'?'single_select':mode||'single_select'}}
function normalizeAuthored(q){
 const normalizeContext=window.WillenaNormalizeAuthoredContext;
 const metadata={...(q.metadata||{}),constructed_response:true,constructed_response_authored:true,authored_constructed_response:true};
 return{...q,metadata,context:typeof normalizeContext==='function'?normalizeContext(q.context||{}):(q.context||{})};
}

function isMockHistory(){const s=history.state||{};return s.tp==='practice'&&(s.skill==='mock'||s.skill==='mock_all')}
function currentMode(){return history.state?.skill==='mock_all'?'all':'lesson'}
function sectionLabel(q){return({vocab_test:'어휘',communication:'Communication',grammar:'Grammar',reading:'Reading'})[String(q?.section||'').toLowerCase()]||String(q?.section||'')}
function setQuizContext(item){
 const el=$('#assignedBackRow .quiz-context');if(el&&active){const scope=active.mode==='all'?'전체 범위':'Lesson 모의고사';el.textContent=`${active.plan?.book_label||''} · ${scope} · ${item?.__lesson||active.baseLesson||''} · ${sectionLabel(item)}`}
 if(active?.mode==='all'){
  const back=$('#assignedBackRow .back-assign');
  if(back){back.textContent='← 시험 대비';back.onclick=async e=>{e.preventDefault();stopActive();try{await window.WillenaTestPrepAuth?.completeSession?.(0,0,[])}catch(_){}if(history.state?.tp==='practice')history.back();setTimeout(()=>{window.WillenaAssignedTestPrep?.showHomeSurface?.();window.WillenaTestPrepUX?.renderHome?.()},0)}}
 }
}
function paintProgress(){
 if(!active||active.stopped)return;
 const pos=active.index+1,total=active.queue.length,item=active.queue[active.index];
 const qnum=$('#card .qnum');if(qnum)qnum.textContent=`${pos} / ${total}`;
 const bar=$('#bar');if(bar)bar.style.width=`${Math.min(100,pos/Math.max(1,total)*100)}%`;
 const count=$('#testPrepVocabTestPractice .vtu-count');if(count)count.textContent=`${pos} / ${total}`;
 const vbar=$('#testPrepVocabTestPractice .vtu-progress i');if(vbar)vbar.style.width=`${Math.min(100,pos/Math.max(1,total)*100)}%`;
 setQuizContext(item);
}
function queuePaint(){if(paintQueued)return;paintQueued=true;requestAnimationFrame(()=>{paintQueued=false;paintProgress()})}

function withSyntheticRows(match,rows,start){
 const previous=window.fetch;let hits=0;
 window.fetch=async function(input,init){
  const raw=typeof input==='string'?input:String(input?.url||'');
  let yes=false;try{yes=match(new URL(raw,location.href))}catch(_){}
  if(yes){hits++;return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}})}
  return previous.call(this,input,init);
 };
 return Promise.resolve().then(start).finally(()=>{if(window.fetch!==previous)window.fetch=previous}).then(v=>{if(!hits)console.warn('[REV44 mock] engine row injection was not consumed');return v});
}

function beginCapture(item){
 const auth=window.WillenaTestPrepAuth;if(!auth?.completeSession||!auth?.recordAttempt)throw new Error('Tracking engine is not ready.');
 const previousComplete=auth.completeSession,previousRecord=auth.recordAttempt;let done=false,resolve;
 const promise=new Promise(r=>resolve=r);
 const completeWrapper=async function(correctCount,questionCount,wrongIds){
  if(done)return{mock_capture:true};
  done=true;resolve({correctCount:Number(correctCount)||0,questionCount:Number(questionCount)||0,wrongIds:Array.isArray(wrongIds)?wrongIds.map(String):[],cancelled:false});
  return{mock_capture:true};
 };
 const recordWrapper=function(payload){
  const meta={...(payload?.metadata||{}),mock_test:!active?.correction,mock_correction:!!active?.correction,mock_scope:active?.mode==='all'?'all_lessons':'lesson',mock_size:active?.originalTotal||25,underlying_section:item.section,lesson:item.__lesson};
  return previousRecord.call(auth,{...(payload||{}),metadata:meta});
 };
 auth.completeSession=completeWrapper;auth.recordAttempt=recordWrapper;
 const cap={promise,cancel(){if(done)return;done=true;resolve({cancelled:true,correctCount:0,questionCount:0,wrongIds:[]})},restore(){if(auth.completeSession===completeWrapper)auth.completeSession=previousComplete;if(auth.recordAttempt===recordWrapper)auth.recordAttempt=previousRecord;if(currentCapture===cap)currentCapture=null}};
 currentCapture=cap;return cap;
}
function stopActive(){if(!active)return;active.stopped=true;currentCapture?.cancel?.();window.WillenaVocabTestPractice?.restore?.()}

async function prepareTracking(item){
 const auth=window.WillenaTestPrepAuth;if(!auth||!active?.plan)return;
 const samePlan=String(auth.state?.plan?.id||'')===String(active.plan.id),sameLesson=String(auth.state?.lesson||'')===String(item.__lesson||'');
 if(!samePlan||!sameLesson)auth.setActivePlan?.(active.plan,item.__lesson);
}
async function runChoice(item){
 if(!originalQuestionLoad)throw new Error('Question engine bridge is not ready.');
 const q=normalizeChoice(item);
 return withSyntheticRows(u=>u.origin===CONTENT&&u.pathname.endsWith('/rest/v1/test_prep_questions')&&u.searchParams.get('section')===`eq.${q.section}`,[q],()=>originalQuestionLoad(q.section));
}
async function runAuthored(item){
 let engine=null;
 for(let i=0;i<100;i++){const e=window.WillenaSeosulEngine;if(e?.__authoredWrapped&&typeof e.start==='function'){engine=e;break}await delay(30)}
 if(!engine)throw new Error('서술형 엔진을 찾지 못했습니다.');
 const q=normalizeAuthored(item);
 return withSyntheticRows(u=>u.origin===CONTENT&&u.pathname.endsWith('/rest/v1/test_prep_questions')&&String(u.searchParams.get('select')||'').includes('source_id')&&u.searchParams.get('unit_id')===`eq.${item.__unitId}`,[q],()=>engine.start({unitId:item.__unitId,reviewMode:true,reviewIds:[String(q.id)]}));
}
async function runVocab(item){
 const api=window.WillenaVocabTestPractice;if(!api?.start)throw new Error('어휘 시험 엔진을 찾지 못했습니다.');
 api.restore?.();
 const key=api.targetKey?.(item);
 await api.start({quiz:$('#assignedQuizPane'),unitId:item.__unitId,lesson:item.__lesson,reviewMode:true,onlyIds:[String(item.id),String(key||'')].filter(Boolean)});
}
async function runItem(item){
 await prepareTracking(item);
 window.WillenaVocabTestPractice?.restore?.();
 const cap=beginCapture(item);
 try{
  const route=routeFor(item);
  if(route==='vocab')await runVocab(item);
  else if(route==='authored')await runAuthored(item);
  else await runChoice(item);
  queuePaint();
  return await cap.promise;
 }finally{cap.restore()}
}

function resultIds(){return active?.mode==='all'?{wrong:'mockAllWrong',done:'mockAllDone',actions:'mock-all-actions'}:{wrong:'mockWrong',done:'mockDone',actions:'mock-result-actions'}}
async function renderResult(){
 if(!active||active.stopped)return;
 window.WillenaVocabTestPractice?.restore?.();
 try{await window.WillenaTestPrepAuth?.completeSession?.(0,0,[])}catch(_){}
 const c=$('#card'),b=$('#bar');if(!c)return;if(b)b.style.width='100%';
 const total=active.queue.length,wrong=active.wrong.slice(),score=Math.max(0,total-wrong.length),pct=total?Math.round(score/total*100):0,ids=resultIds(),all=active.mode==='all';
 c.innerHTML=`<div class="result"><div class="score">${score}/${total}</div><div class="${all?'mock-all-percent':'mock-percent'}">${pct}%</div><h2>${all?'전체 범위 모의고사 완료':'모의고사 완료'}</h2><p>오답 ${wrong.length}개</p><div class="${ids.actions}">${wrong.length?`<button class="${all?'mock-all-btn':'mock-btn'}" id="${ids.wrong}">오답하기</button>`:''}<button class="${all?'mock-all-btn':'mock-btn'}" id="${ids.done}">완료</button></div></div>`;
 const retry=$('#'+ids.wrong);if(retry)retry.onclick=()=>{if(!active||active.stopped)return;active.correction=true;active.queue=wrong;active.index=0;active.wrong=[];runQueue(active.serial)};
 const done=$('#'+ids.done);if(done)done.onclick=()=>{$('#assignedBackRow .back-assign')?.click()};
}
async function runQueue(serial){
 while(active&&!active.stopped&&active.serial===serial&&active.index<active.queue.length){
  const item=active.queue[active.index];
  try{
   const outcome=await runItem(item);
   if(outcome?.cancelled||!active||active.stopped||active.serial!==serial)return;
   if(!(outcome.questionCount>0&&outcome.correctCount>0))active.wrong.push(item);
   active.index++;
  }catch(e){
   console.error('[REV44 mock] routed question failed',item,e);
   const c=$('#card');if(c)c.innerHTML=`<div class="empty"><b>이 문제를 기존 엔진으로 열지 못했습니다.</b><br><small>${String(e?.message||e)}</small><div class="actions"><button class="primary" id="mockRouteRetry">다시 시도</button><button class="secondary" id="mockRouteLeave">나가기</button></div></div>`;
   $('#mockRouteRetry')?.addEventListener('click',()=>runQueue(serial),{once:true});
   $('#mockRouteLeave')?.addEventListener('click',()=>$('#assignedBackRow .back-assign')?.click(),{once:true});
   return;
  }
 }
 if(active&&!active.stopped&&active.serial===serial)await renderResult();
}

async function startFromSelection(){
 const sel=window.WillenaAssignedTestPrep?.selection;if(!sel?.plan)return;
 const serial=++runSerial,mode=currentMode(),c=$('#card'),b=$('#bar');
 active={serial,mode,plan:sel.plan,baseLesson:sel.lesson,queue:[],index:0,wrong:[],correction:false,stopped:false,originalTotal:25};
 if(c)c.innerHTML='<div class="loading">모의고사 25문제를 준비하는 중...</div>';if(b)b.style.width='0';
 try{
  const manifest=mode==='all'?await buildAll(sel.plan):await buildLesson(sel);
  if(!active||active.serial!==serial||active.stopped)return;
  active.queue=manifest;active.originalTotal=manifest.length;active.index=0;active.wrong=[];
  setQuizContext(manifest[0]);
  await runQueue(serial);
 }catch(e){console.error('[REV44 mock] start failed',e);if(c)c.innerHTML=`<div class="empty">모의고사를 만들지 못했습니다.<br><small>${String(e?.message||e)}</small></div>`}
}

function patchEngine(){
 if(patched)return true;
 const engine=window.WillenaTestPrepQuestionEngine;if(!engine?.loadSection)return false;
 originalQuestionLoad=engine.loadSection.bind(engine);
 engine.loadSection=function(name){if(String(name||'').toLowerCase()==='mock')return startFromSelection();return originalQuestionLoad(name)};
 patched=true;return true;
}
function injectLessonCard(){
 const subway=$('#assignmentHome .tp-subway');if(!subway||$('#assignmentHome .tp-mock-card'))return;
 const hs=history.state||{},planId=hs.planId,lesson=hs.lesson;if(!planId||!lesson)return;
 const b=document.createElement('button');b.type='button';b.className='tp-mock-card';
 b.innerHTML='<span class="tp-mock-icon">25</span><span class="tp-mock-copy"><b>모의고사</b><small>25문제 · 이 Lesson 시험 범위</small></span><span class="tp-mock-go">START →</span>';
 b.onclick=async()=>{history.pushState({tp:'practice',planId:String(planId),lesson:String(lesson),skill:'mock',returnTo:'lesson'},'',location.href);await window.WillenaAssignedTestPrep?.startSelection?.(planId,lesson,'mock')};
 subway.insertAdjacentElement('afterend',b);
}
function injectAllCards(){
 document.querySelectorAll('#assignmentHome .tp-exam-section').forEach(section=>{
  if(section.querySelector('.tp-mock-all-card'))return;
  const first=section.querySelector('.tp-lesson-card[data-lesson-plan]'),lessons=section.querySelector('.tp-lessons');if(!first||!lessons)return;
  const planId=first.dataset.lessonPlan,lesson=first.dataset.lesson;if(!planId||!lesson)return;
  const b=document.createElement('button');b.type='button';b.className='tp-mock-all-card';b.dataset.mockAllPlan=planId;
  b.innerHTML='<span class="tp-mock-all-icon">25</span><span class="tp-mock-all-copy"><b>모의고사</b><small>25문제 · 어휘부터 시작 · 모든 Lesson 전체 범위</small></span><span class="tp-mock-all-go">START →</span>';
  b.onclick=async()=>{history.pushState({tp:'practice',planId:String(planId),lesson:String(lesson),skill:'mock_all',returnTo:'home'},'',location.href);await window.WillenaAssignedTestPrep?.startSelection?.(planId,lesson,'mock')};
  lessons.insertAdjacentElement('afterend',b);
 });
}
function injectCards(){injectLessonCard();injectAllCards()}

async function autoFinish(){
 let misses=0;
 while(active&&!active.stopped&&!$('#card .result')&&misses<40){
  const skip=$('#tpSkipQuestion');
  if(skip&&!skip.disabled){skip.click();misses=0;await delay(430);continue}
  const vh=$('#testPrepVocabTestPractice');
  if(vh){
   const input=vh.querySelector('#vtuInput'),next=vh.querySelector('#vtuNext');
   if(input&&next){input.value='__REV44__';input.dispatchEvent(new Event('input',{bubbles:true}));next.click();await delay(60);vh.querySelector('#vtuNext')?.click();misses=0;await delay(180);continue}
   const choice=vh.querySelector('.vtu-choice');if(choice&&next){choice.click();await delay(20);vh.querySelector('#vtuNext')?.click();await delay(60);vh.querySelector('#vtuNext')?.click();misses=0;await delay(180);continue}
  }
  const check=$('#card #check'),choice=$('#card .choice');
  if(check&&choice){if(!$('#card .choice.selected'))choice.click();await delay(20);if(!check.disabled)check.click();await delay(70);const n=$('#card #check');if(n&&!n.disabled&&/다음 문제|결과 보기/.test(n.textContent||''))n.click();misses=0;await delay(180);continue}
  misses++;await delay(160);
 }
 return !!$('#card .result');
}

function boot(){
 let tries=0;const t=setInterval(()=>{if(patchEngine()||++tries>200)clearInterval(t)},25);
 injectCards();
 new MutationObserver(()=>{injectCards();queuePaint()}).observe(document.body,{childList:true,subtree:true});
 document.addEventListener('click',e=>{if(active&&e.target instanceof Element&&e.target.closest('#assignedBackRow .back-assign'))stopActive()},true);
 window.addEventListener('popstate',()=>{if(active&&!isMockHistory())stopActive()});
}
window.WillenaMockController={startFromSelection,buildLesson,buildAll,autoFinish,get active(){return active}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
