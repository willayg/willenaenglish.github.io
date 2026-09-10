import {QuestionRenderer} from './question-renderer.js?v=2.20.6';
import {gradeQuestion} from '../shared/question-grader.js?v=2.1.2';
import {createQuestionSession} from './question-session.js?v=1.6.2';
import {loadPracticeContent} from './practice-loader.js?v=1.0.0';
import {createPerfDebug} from './perf-debug.js?v=1.0.0';
import {resolveContentIds,reviewQuestionFromItem} from './content-source.js?v=2.24.3';
import {initTracking,refreshTrackingState,setTrackingContext,startSession,recordAttempt,completeSession,trackingState} from './tracking-client.js?v=2.17a';
import {startVocabularyLearning} from './vocab-learning.js?v=2.14.1';
import {passageAvailable} from './passage-source.js?v=2.18.0';
import {startPassageLearning,stopPassageLearning} from './passage-learning.js?v=2.18.1';
import {loadCardStats,invalidateCardStats,getStatsDiagnostics,formatCardMetric,formatAccuracy,reviewCounts} from './stats-client.js?v=2.16a';
import {loadReviewQueue,refreshReviewQueue} from '../shared/student-review.js?v=1.0.0';
import {renderMockTestPreflight,stopMockTest} from './mock-test-proxy.js?v=1.0.0';
import {initNavigation,navigate,replaceRoute,back,currentRoute} from './navigation.js?v=2.19.0';

const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const root=$('#screen'),bottom=$('#bottom'),userEl=$('#user');
let state={plan:null,lesson:null,ids:null,practice:null,queue:[],index:0,score:0,wrongIds:[],checked:false,startedAt:0,renderer:null,cardStats:new Map(),lastResult:null,reviewData:null};
const perf=createPerfDebug({getStatsDiagnostics});
const PRACTICES={
  vocabulary:{label:'단어 학습',desc:'카드 · 뜻 · 철자',kind:'vocab-learning'},
  vocab_test:{label:'어휘 시험',desc:'정의 · 문맥 · 철자',kind:'vocab-test'},
  communication:{label:'Communication',desc:'핵심 대화 표현',kind:'stored'},
  grammar:{label:'Grammar',desc:'핵심 문법',kind:'stored'},
  passage:{label:'본문',desc:'교과서 순서 · 문장 완성',kind:'passage-learning'},
  reading:{label:'Reading',desc:'본문 이해',kind:'stored'},
  constructed_response:{label:'서술형',desc:'저장된 영작 · 교정 · 다답형',kind:'written'}
};

function scopeFor(plan){const lessons=plan?.group?.scope?.lessons;if(Array.isArray(lessons)&&lessons.length)return lessons.filter(x=>x?.lesson);return(plan?.units||[]).map(lesson=>({lesson,sections:plan?.practice_types||[]}))}
function sectionsFor(plan,lesson){const row=scopeFor(plan).find(x=>String(x.lesson)===String(lesson)),sections=new Set((row?.sections||[]).map(x=>String(x).toLowerCase()));if(sections.has('vocabulary'))sections.add('vocab_test');return sections}
function planById(id){return(trackingState().plans||[]).find(p=>String(p.id)===String(id))||null}
function trackingId(q){return String(q?.tracking?.questionId||q?.id||'')}
function fieldState(key){return{get:()=>state[key],set:value=>{state[key]=value}}}
function setBottom(html=''){bottom.innerHTML=html;bottom.hidden=!html}
function error(message){root.innerHTML=`<div class="error">${esc(message)}</div>`;setBottom('')}
function updateUser(){const u=trackingState().user;userEl.textContent=u?.name||u?.username||'Student'}
function ring(p,label=null){const n=Math.max(0,Math.min(100,Math.round(Number(p)||0)));return `<span class="ring" style="--p:${n}%"><b>${label==null?`${n}%`:esc(label)}</b></span>`}
function emptyStat(){return{completed:0,total:0,coverage:0,accuracy:0,accuracySample:0}}
function hasCardData(plan){return state.cardStats.has(String(plan?.id||''))}
function cardData(plan){return state.cardStats.get(String(plan?.id||''))||{plan:emptyStat(),lessons:{}}}
function lessonRouteMatches(planId=state.plan?.id,lesson=state.lesson){const r=currentRoute();return r.view==='lesson'&&String(r.planId)===String(planId)&&String(r.lesson)===String(lesson)}
function practiceRouteMatches(practice,planId=state.plan?.id,lesson=state.lesson){const r=currentRoute();return r.view==='practice'&&String(r.planId)===String(planId)&&String(r.lesson)===String(lesson)&&String(r.practice)===String(practice)}
function reviewRouteMatches(planId=state.plan?.id){const r=currentRoute();return r.view==='review'&&String(r.planId)===String(planId)}
function mockRouteMatches(planId=state.plan?.id){const r=currentRoute();return r.view==='mock'&&String(r.planId)===String(planId)}
async function loadPlanCardStats(plan,{force=false}={}){try{const data=await loadCardStats(plan,trackingState().user?.id,{force});state.cardStats.set(String(plan.id),data);return data}catch(e){console.warn('[test-prep-v2] card stats failed',e);const fallback={plan:emptyStat(),lessons:{}};state.cardStats.set(String(plan.id),fallback);return fallback}}
async function refreshPlanCardStats(plan){invalidateCardStats(plan?.id);return loadPlanCardStats(plan,{force:true})}
async function preloadCardStats(){const plans=trackingState().plans||[];await Promise.all(plans.map(p=>loadPlanCardStats(p)))}
function mockCard(){
  return `<button class="wrong-card mock-entry-card" type="button" data-mock><span class="wrong-copy"><b>실전모의고사</b><small>25문항 · 45분 · 제출 후 채점</small></span><span class="wrong-cta">시험지 구성 →</span></button>`;
}
function reviewCard(plan,loaded){
  const r=reviewCounts(plan),total=(Number(r.now)||0)+(Number(r.later)||0),disabled=!loaded||!total;
  return `<button class="wrong-card" type="button" data-review ${disabled?'disabled':''}><span class="wrong-copy"><b>전체 범위 오답</b></span><span class="wrong-stats"><span class="wrong-stat"><strong>${loaded?r.now:'—'}</strong><small>지금 할 문제</small></span><span class="wrong-stat"><strong>${loaded?r.later:'—'}</strong><small>1시간 후 재복습</small></span><span class="wrong-stat"><strong>${loaded?total:'—'}</strong><small>총 남은 문제</small></span></span><span class="wrong-cta">${loaded?(total?'복습 시작 →':'오답 없음'):'불러오는 중…'}</span></button>`;
}

function renderHome(){
  state={...state,plan:null,lesson:null,practice:null,queue:[],index:0,renderer:null,reviewData:null};const plans=trackingState().plans||[];setBottom('');
  root.innerHTML=`<div class="heading"><div><h2>내 시험 대비</h2><p>학교 시험 범위를 선택하세요.</p></div></div>${plans.length?plans.map(p=>{const loaded=hasCardData(p),s=cardData(p).plan,r=reviewCounts(p),school=p.group?.school||'학교 시험';return `<button class="exam-card" data-plan="${esc(p.id)}"><div class="exam-head"><div><span class="exam-school">${esc(school)}</span><h3 class="exam-title">${esc(p.exam_name||'시험 대비')}</h3><div class="exam-book">${esc(p.book_label||'')}</div></div>${loaded?ring(s.coverage):ring(0,'…')}</div><div class="exam-meta">${loaded?`<span class="pill">${esc(formatCardMetric(s))}</span><span class="pill">${esc(formatAccuracy(s))}</span>`:'<span class="pill">통계 불러오는 중…</span>'}${p.exam_date?`<span class="pill">${esc(p.exam_date)}</span>`:''}${r.now?`<span class="pill">오답 지금 ${r.now}</span>`:''}${r.later?`<span class="pill">나중 ${r.later}</span>`:''}</div></button>`}).join(''):'<div class="empty">지정된 시험 대비가 없습니다.</div>'}`;
  root.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>navigate({view:'plan',planId:b.dataset.plan}));
}
function renderLessons(plan){
  state.plan=plan;state.lesson=null;state.practice=null;const lessons=scopeFor(plan),data=cardData(plan),loaded=hasCardData(plan);setBottom('');
  root.innerHTML=`<button class="back" id="homeBack">← 시험 대비</button><div class="heading"><div><h2>${esc(plan.book_label||'')}</h2><p>${esc(plan.exam_name||'Lesson 선택')}</p></div></div>${reviewCard(plan,loaded)}${lessons.length?`<div class="grid">${lessons.map(l=>{const s=data.lessons?.[String(l.lesson)]?.summary||emptyStat();return `<button class="tile" data-lesson="${esc(l.lesson)}"><div class="exam-head"><div><h3>${esc(l.lesson)}</h3><p>${esc((l.sections||[]).join(' · '))}</p><span class="metric">${loaded?`${esc(formatCardMetric(s))} · ${esc(formatAccuracy(s))}`:'통계 불러오는 중…'}</span></div>${loaded?ring(s.coverage):ring(0,'…')}</div></button>`}).join('')}</div>`:'<div class="empty">Lesson 범위가 없습니다.</div>'}${mockCard()}`;
  $('#homeBack').onclick=back;root.querySelector('[data-mock]')?.addEventListener('click',()=>navigate({view:'mock',planId:plan.id}));root.querySelector('[data-review]')?.addEventListener('click',()=>navigate({view:'review',planId:plan.id}));root.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>navigate({view:'lesson',planId:plan.id,lesson:b.dataset.lesson}));
}
async function renderLesson(plan,lesson){
  state.plan=plan;state.lesson=lesson;state.practice=null;state.renderer=null;
  const sections=sectionsFor(plan,lesson),data=cardData(plan).lessons?.[String(lesson)]||{summary:emptyStat(),practices:{}},loaded=hasCardData(plan);setBottom('');
  if(sections.has('reading')){
    try{
      let unitId=data.unitId||null;
      if(!unitId){const ids=await resolveContentIds(plan,lesson);unitId=ids.unitId}
      if(!lessonRouteMatches(plan.id,lesson))return;
      if(unitId&&await passageAvailable(unitId))sections.add('passage');
    }catch(e){console.warn('[test-prep-v2] passage availability failed',e)}
  }
  if(!lessonRouteMatches(plan.id,lesson))return;
  const available=Object.entries(PRACTICES).filter(([k])=>sections.has(k));
  root.innerHTML=`<button class="back" id="lessonBack">← ${esc(plan.book_label||'시험 대비')}</button><div class="lesson-head"><div class="heading"><div><h2>${esc(lesson)}</h2><p>${esc(plan.book_label||'')}</p></div></div></div>${available.length?`<div class="journey">${available.map(([k,p],i)=>{const workflow=k==='passage',s=data.practices?.[k]||emptyStat();return `<div class="journey-stop" data-practice="${k}"><div class="station">${i+1}</div><div class="stop-copy"><b>${esc(p.label)}</b><small>${esc(p.desc)}</small>${workflow?'':`<div class="mini"><i style="width:${loaded?s.coverage:0}%"></i></div>`}</div><div class="stop-stat">${workflow?'순서 학습':(loaded?`${s.completed} / ${s.total}`:'…')}<small>${workflow?'서버 저장':(loaded?(s.accuracySample?`${s.accuracy}% accuracy`:'— accuracy'):'loading')}</small></div></div>`}).join('')}</div>`:'<div class="empty">이 Lesson에 활성화된 영역이 없습니다.</div>'}`;
  $('#lessonBack').onclick=back;root.querySelectorAll('[data-practice]').forEach(b=>b.onclick=()=>navigate({view:'practice',planId:plan.id,lesson,practice:b.dataset.practice}));
}

async function startPracticeRoute(plan,lesson,practice){
  const config=PRACTICES[practice];if(!config){return replaceRoute({view:'lesson',planId:plan.id,lesson})}
  state.plan=plan;state.lesson=lesson;state.practice=practice;state.queue=[];state.index=0;state.score=0;state.wrongIds=[];state.checked=false;state.renderer=null;root.innerHTML='<div class="loading">문제를 불러오는 중...</div>';setBottom('');
  try{
    const ids=await resolveContentIds(plan,lesson);if(!practiceRouteMatches(practice,plan.id,lesson))return;state.ids=ids;setTrackingContext(plan,lesson);
    const loaded=await loadPracticeContent({kind:config.kind,practice,unitId:ids.unitId,studentId:trackingState().user?.id||null,planId:plan.id,lesson,count:20});
    if(!practiceRouteMatches(practice,plan.id,lesson))return;
    if(loaded.mode==='workflow'&&loaded.kind==='vocab-learning'){
      root.innerHTML='<div id="vocabActivityHost"></div>';const host=$('#vocabActivityHost');
      await startVocabularyLearning({host,plan,lesson,unitId:ids.unitId,onExit:back});return;
    }
    if(loaded.mode==='workflow'&&loaded.kind==='passage-learning'){
      root.innerHTML='<div id="passageActivityHost"></div>';const host=$('#passageActivityHost');
      await startPassageLearning({host,plan,lesson,unitId:ids.unitId,onExit:back});return;
    }
    if(!loaded.rawCount){root.innerHTML=`<button class="back" id="emptyBack">← ${esc(lesson)}</button><div class="empty">이 영역에 사용할 문제가 없습니다.</div>`;$('#emptyBack').onclick=back;return}
    if(!loaded.pool.length){root.innerHTML=`<button class="back" id="emptyBack">← ${esc(lesson)}</button><div class="empty">선택할 수 있는 문제가 없습니다.</div>`;$('#emptyBack').onclick=back;return}
    state.queue=loaded.pool;await startSession(practice);if(!practiceRouteMatches(practice,plan.id,lesson))return;renderQuestion();
  }catch(e){if(!practiceRouteMatches(state.practice))return;console.error('[test-prep-v2] start failed',e);error(e.message||'문제를 불러오지 못했습니다.')}
}
function current(){return state.queue[state.index]||null}
function headerFor(q){const code=q.source?.code||'',source=code?`<span class="badge ${code.toLowerCase()}" title="${code==='Z'?'Zocbo':code==='W'?'Willena authored':'Book reference'}">${code}</span>`:'';return `<div class="practice-head"><div><button class="back" id="practiceBack" data-session-back>← ${esc(state.lesson)}</button><div class="practice-meta">${source}<span>${esc(state.plan.book_label||'')}</span><span>·</span><span>${esc(PRACTICES[state.practice]?.label||state.practice)}</span></div></div><strong>${state.index+1} / ${state.queue.length}</strong></div><div class="progress"><i style="width:${Math.round(state.index/Math.max(1,state.queue.length)*100)}%"></i></div>`}
let practiceQuestionSession=null;
function getPracticeQuestionSession(){
  if(practiceQuestionSession)return practiceQuestionSession;
  practiceQuestionSession=createQuestionSession({
    root,bottom,Renderer:QuestionRenderer,gradeQuestion,recordAttempt,
    isActive:()=>practiceRouteMatches(state.practice),getEntry:current,getQuestion:q=>q,renderHeader:(_,q)=>headerFor(q),getPracticeType:()=>state.practice,
    onCorrect:()=>{state.score++},onWrong:(_,q)=>{state.wrongIds.push(trackingId(q))},onFinished:finishPractice,onBack:back,
    checkedState:fieldState('checked'),indexState:fieldState('index'),startedAtState:fieldState('startedAt'),rendererState:fieldState('renderer'),queueLength:()=>state.queue.length,
    buttonIds:{skip:'skipQuestion',check:'checkAnswer'},logLabel:'practice'
  });
  return practiceQuestionSession;
}
function renderQuestion(){return getPracticeQuestionSession().render()}
async function checkAnswer(){return getPracticeQuestionSession().check()}
async function skipQuestion(){return getPracticeQuestionSession().skip()}
async function finishPractice(){
  const route=currentRoute();if(route.view!=='practice')return;setBottom('');try{await completeSession({correct:state.score,total:state.queue.length,wrongIds:state.wrongIds});await refreshTrackingState();const fresh=planById(state.plan.id);if(fresh)state.plan=fresh;await refreshPlanCardStats(state.plan)}catch(e){console.warn('[test-prep-v2] finish/refresh failed',e)}
  if(!practiceRouteMatches(state.practice,route.planId,route.lesson))return;const pct=state.queue.length?Math.round(state.score/state.queue.length*100):0;state.lastResult={planId:route.planId,lesson:route.lesson,practice:route.practice,score:state.score,total:state.queue.length,wrong:state.wrongIds.length,pct};await replaceRoute({view:'result',planId:route.planId,lesson:route.lesson,practice:route.practice});
}
function renderResult(plan,route){
  const r=state.lastResult;if(!r||String(r.planId)!==String(route.planId)||String(r.lesson)!==String(route.lesson)||String(r.practice)!==String(route.practice)){replaceRoute({view:'lesson',planId:route.planId,lesson:route.lesson});return}
  state.plan=plan;state.lesson=route.lesson;state.practice=null;setBottom('');root.innerHTML=`<div class="card result"><div class="score">${r.score}/${r.total}</div><h2>${r.pct>=80?'좋아요!':'한 번 더 확인해 보세요.'}</h2><div class="statline">정답률 ${r.pct}% · 틀린/건너뛴 문제 ${r.wrong}개</div><div style="margin-top:22px"><button class="tile" id="resultBack" style="text-align:center;min-height:auto">${esc(route.lesson)}로 돌아가기</button></div></div>`;$('#resultBack').onclick=back;
}

function reviewWaitText(iso){if(!iso)return'';const ms=new Date(iso).getTime()-Date.now();if(!Number.isFinite(ms)||ms<=0)return'곧 다시 복습할 수 있어요.';const mins=Math.max(1,Math.ceil(ms/60000));return mins>=60?`약 ${Math.ceil(mins/60)}시간 후 다시 복습할 수 있어요.`:`약 ${mins}분 후 다시 복습할 수 있어요.`}
function reviewOverview(data){const s=data?.summary||{};return `<div class="review-overview"><div><b>${s.now||0}</b><span>지금</span></div><div><b>${s.later||0}</b><span>나중</span></div><div><b>${s.cleared||0}</b><span>완료</span></div></div>`}
async function startReviewRoute(plan){
  state.plan=plan;state.lesson=null;state.practice=null;state.queue=[];state.index=0;state.score=0;state.wrongIds=[];state.checked=false;state.renderer=null;state.reviewData=null;root.innerHTML='<div class="loading">오답을 준비하는 중...</div>';setBottom('');
  try{
    const data=await loadReviewQueue(plan,{force:true,limit:20});if(!reviewRouteMatches(plan.id))return;
    const queue=(data.items||[]).map(item=>({item,question:reviewQuestionFromItem(item)})).filter(x=>x.question);
    state.reviewData=data;state.queue=queue;
    if(!queue.length){renderReviewWaiting(plan,data);return}
    renderReviewQuestion();
  }catch(e){if(!reviewRouteMatches(plan.id))return;console.error('[test-prep-v2] review load failed',e);root.innerHTML=`<button class="back" id="reviewLoadBack">← 시험 범위</button><div class="error">${esc(e.message||'오답을 불러오지 못했습니다.')}</div>`;$('#reviewLoadBack').onclick=back}
}
function renderReviewWaiting(plan,data){
  if(!reviewRouteMatches(plan.id))return;const s=data?.summary||{},missing=Number(data?.meta?.missingContent)||0;setBottom('');
  let title='오답을 모두 정리했어요!',copy='지금 복습할 문제가 없습니다.';
  if((s.now||0)>0&&!state.queue.length){title='오답 내용을 불러오지 못했어요.';copy=missing?`현재 콘텐츠와 연결되지 않은 오답이 ${missing}개 있습니다.`:'잠시 후 다시 시도해 주세요.'}
  else if((s.later||0)>0){title='지금 할 오답은 끝났어요.';copy=`${s.later}개는 잠시 뒤 다시 확인합니다. ${reviewWaitText(s.nextReviewAt)}`}
  root.innerHTML=`<button class="back" id="reviewWaitBack">← ${esc(plan.book_label||'시험 범위')}</button><div class="heading"><div><h2>오답 복습</h2><p>${esc(plan.exam_name||'전체 시험 범위')}</p></div></div><div class="review-panel">${reviewOverview(data)}<div class="review-message"><h3>${esc(title)}</h3><p>${esc(copy)}</p></div></div>`;$('#reviewWaitBack').onclick=back;
}
function currentReview(){return state.queue[state.index]||null}
function reviewHeader(item,q){const code=q.source?.code||'',source=code?`<span class="badge ${code.toLowerCase()}">${code}</span>`:'';const label=PRACTICES[item.practiceType]?.label||item.practiceType;return `<div class="practice-head"><div><button class="back" id="reviewBack" data-session-back>← 오답</button><div class="practice-meta">${source}<span>${esc(item.lesson)}</span><span>·</span><span>${esc(label)}</span></div></div><strong>${state.index+1} / ${state.queue.length}</strong></div><div class="progress"><i style="width:${Math.round(state.index/Math.max(1,state.queue.length)*100)}%"></i></div>`}
let reviewQuestionSession=null;
function getReviewQuestionSession(){
  if(reviewQuestionSession)return reviewQuestionSession;
  reviewQuestionSession=createQuestionSession({
    root,bottom,Renderer:QuestionRenderer,gradeQuestion,recordAttempt,
    isActive:()=>reviewRouteMatches(),getEntry:currentReview,getQuestion:row=>row?.question,renderHeader:(row,q)=>reviewHeader(row.item,q),getPracticeType:row=>row.item.practiceType,
    getAttemptExtras:row=>({source:'wrong-review',metadata:{review_stage_before:row.item.reviewStage,canonical_id:row.item.canonicalId}}),
    onBeforeRender:row=>{state.lesson=row.item.lesson;state.practice=row.item.practiceType;setTrackingContext(state.plan,row.item.lesson)},onCorrect:()=>{state.score++},onWrong:row=>{state.wrongIds.push(row.item.canonicalId)},onFinished:finishReview,onBack:back,
    checkedState:fieldState('checked'),indexState:fieldState('index'),startedAtState:fieldState('startedAt'),rendererState:fieldState('renderer'),queueLength:()=>state.queue.length,
    buttonIds:{skip:'skipReview',check:'checkReview'},logLabel:'review'
  });
  return reviewQuestionSession;
}
function renderReviewQuestion(){return getReviewQuestionSession().render()}
async function checkReviewAnswer(){return getReviewQuestionSession().check()}
async function skipReviewQuestion(){return getReviewQuestionSession().skip()}
async function finishReview(){
  const route=currentRoute();if(route.view!=='review')return;const answered=state.queue.length,correct=state.score;setBottom('');root.innerHTML='<div class="loading">오답 결과를 정리하는 중...</div>';
  let data=state.reviewData;
  try{
    await completeSession({correct,total:answered,wrongIds:state.wrongIds});
    await refreshTrackingState();const fresh=planById(state.plan.id);if(fresh)state.plan=fresh;
    await refreshPlanCardStats(state.plan);data=await refreshReviewQueue(state.plan,{limit:20});state.reviewData=data;
  }catch(e){console.warn('[test-prep-v2] review finish refresh failed',e)}
  if(!reviewRouteMatches(route.planId))return;renderReviewDone(state.plan,data,answered,correct);
}
function renderReviewDone(plan,data,answered,correct){
  const s=data?.summary||{},canContinue=(s.now||0)>0;setBottom('');root.innerHTML=`<button class="back" id="reviewDoneBack">← ${esc(plan.book_label||'시험 범위')}</button><div class="card result review-result"><div class="score">${correct}/${answered}</div><h2>${canContinue?'이번 묶음 복습 완료':'지금 할 오답 완료'}</h2><div class="statline">${canContinue?`지금 ${s.now}개 · 나중 ${s.later||0}개`:(s.later?`${s.later}개는 1시간 후 다시 복습해요.`:'모든 오답을 정리했어요.')}</div>${reviewOverview(data)}<div class="review-actions">${canContinue?'<button class="review-primary" id="reviewContinue">다음 오답 계속하기 →</button>':''}<button class="review-secondary" id="reviewReturn">시험 범위로 돌아가기</button></div></div>`;$('#reviewDoneBack').onclick=back;$('#reviewReturn').onclick=back;$('#reviewContinue')?.addEventListener('click',()=>replaceRoute({view:'review',planId:plan.id}));
}

function beforeRouteChange(previous,next){
  if(previous?.view==='practice'&&next?.view!=='practice'){
    try{window.speechSynthesis?.cancel?.()}catch(_){ }
    if(previous.practice==='passage')stopPassageLearning().catch(e=>console.warn('[test-prep-v2] passage leave close failed',e));
    else if(previous.practice==='vocabulary')completeSession({correct:0,total:0,wrongIds:[]}).catch(e=>console.warn('[test-prep-v2] vocab leave close failed',e));
    else completeSession({correct:state.score,total:state.index+(state.checked?1:0),wrongIds:state.wrongIds}).catch(e=>console.warn('[test-prep-v2] practice leave close failed',e));
    state.renderer=null;setBottom('');return;
  }
  if(previous?.view==='review'&&next?.view!=='review'){
    completeSession({correct:state.score,total:state.index+(state.checked?1:0),wrongIds:state.wrongIds}).catch(e=>console.warn('[test-prep-v2] review leave close failed',e));
    state.renderer=null;setBottom('');return;
  }
  if(previous?.view==='mock'&&next?.view!=='mock'){
    stopMockTest();state.renderer=null;setBottom('');
  }
}
async function renderRoute(route){
  if(route.view==='home'){renderHome();return}
  const plan=planById(route.planId);if(!plan){await replaceRoute({view:'home'});return}
  if(route.view==='plan'){renderLessons(plan);return}
  if(route.view==='mock'){
    state.plan=plan;state.lesson=null;state.practice=null;state.renderer=null;setBottom('');
    await renderMockTestPreflight({host:root,plan,studentId:trackingState().user?.id||null,onBack:back});return;
  }
  if(route.view==='lesson'){await renderLesson(plan,route.lesson);return}
  if(route.view==='practice'){await startPracticeRoute(plan,route.lesson,route.practice);return}
  if(route.view==='review'){await startReviewRoute(plan);return}
  if(route.view==='result'){renderResult(plan,route)}
}
async function refreshVisibleStats(){
  const route=currentRoute();
  if(route&&['home','plan','lesson'].includes(route.view))await renderRoute(route);
}

async function boot(){
  try{
    perf.update();
    root.innerHTML='<div class="loading">Test Prep v2.25을 준비하는 중...</div>';
    await initTracking();perf.mark('auth');updateUser();
    let route=initNavigation({render:renderRoute,beforeRouteChange,initialRoute:{view:'home'}});
    if(route.view==='practice'||route.view==='result'){route={view:'lesson',planId:route.planId,lesson:route.lesson};await replaceRoute(route,{render:false})}
    if(route.view==='review'){route={view:'plan',planId:route.planId};await replaceRoute(route,{render:false})}
    await renderRoute(route);perf.mark('ui');
    preloadCardStats().then(async()=>{perf.mark('stats');await refreshVisibleStats()}).catch(e=>{console.warn('[test-prep-v2] background stats failed',e);perf.mark('stats')});
  }catch(e){console.error('[test-prep-v2] boot failed',e);error(e.message||'앱을 시작하지 못했습니다.');perf.update()}
}
boot();