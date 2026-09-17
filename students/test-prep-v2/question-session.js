import {aiWilliMessage,showAiWilliStatus,clearAiWilliStatus,decorateAiWilliFeedback,mountAiWilliHelper} from '../shared/ai-willi.js?v=1.1.0';
import {mountVocabAiWilli} from './ai-willi-vocab.js?v=1.0.2';
import {restoreActivityProgress,saveActivityPosition,saveActivityOutcome,clearActivitySnapshotFor,currentActivityRoute} from './activity-session-store.js?v=3.0.0';

// Shared interactive question-session engine for Test Prep v2.
// Owns the common render -> grade/skip -> record -> advance mechanics.
// Route/workflow-specific behavior stays in app.js through callbacks.
function vocabItemFromQuestion(question){
  const m=question?.metadata||{};
  return{
    id:m.lexical_entry_id||null,
    canonical_text:m.canonical_text||'',
    translation_ko:m.translation_ko||'',
    definition_en:m.definition_en||''
  };
}

export function createQuestionSession({
  root,
  bottom,
  Renderer,
  gradeQuestion,
  recordAttempt,
  isActive,
  getEntry,
  getQuestion,
  renderHeader,
  getPracticeType,
  getAttemptExtras=()=>({}),
  onBeforeRender=()=>{},
  onCorrect=()=>{},
  onWrong=()=>{},
  onFinished=()=>{},
  onBack=()=>{},
  checkedState,
  indexState,
  startedAtState,
  rendererState,
  queueLength,
  buttonIds={skip:'skipQuestion',check:'checkAnswer'},
  logLabel='practice'
}){
  const setBottom=html=>{bottom.innerHTML=html;bottom.hidden=!html};
  let restoredRouteKey='';
  let grading=false;
  let nextPointerArmed=false;
  let questionActiveMs=0;
  let questionActiveTick=0;
  let questionWallStartedAt=0;
  const routeKey=route=>route?`${route.planId}|${route.lesson}|${route.practice}`:'';
  const questionIsForeground=()=>!document.hidden&&document.hasFocus();

  function syncQuestionTimer(){
    const now=performance.now();
    if(questionActiveTick)questionActiveMs+=Math.max(0,now-questionActiveTick);
    questionActiveTick=questionWallStartedAt&&questionIsForeground()?now:0;
  }
  function startQuestionTimer(){
    questionActiveMs=0;
    questionWallStartedAt=Date.now();
    questionActiveTick=questionIsForeground()?performance.now():0;
    startedAtState.set(questionWallStartedAt);
  }
  function snapshotQuestionTimer(){
    syncQuestionTimer();
    return{
      activeMs:Math.max(0,Math.round(questionActiveMs)),
      wallMs:Math.max(0,Date.now()-questionWallStartedAt)
    };
  }
  function handleQuestionActivityChange(){if(questionWallStartedAt&&!checkedState.get())syncQuestionTimer()}
  document.addEventListener('visibilitychange',handleQuestionActivityChange);
  window.addEventListener('focus',handleQuestionActivityChange);
  window.addEventListener('blur',handleQuestionActivityChange);

  function showFinishOverlay(){
    if(logLabel!=='practice'||document.getElementById('practiceFinishOverlay'))return;
    const styleId='practiceFinishOverlayStyle';
    if(!document.getElementById(styleId)){
      const style=document.createElement('style');
      style.id=styleId;
      style.textContent='@keyframes practiceFinishSpin{to{transform:rotate(360deg)}}#practiceFinishOverlay{position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.42);backdrop-filter:blur(3px)}#practiceFinishOverlay .pfo-card{display:flex;flex-direction:column;align-items:center;gap:12px;min-width:280px;padding:28px 24px;border-radius:22px;background:var(--card-bg,#fff);color:var(--text-color,#24383f);box-shadow:0 18px 50px rgba(0,0,0,.22);font-family:Poppins,sans-serif;text-align:center}#practiceFinishOverlay .pfo-spinner{width:46px;height:46px;border:5px solid currentColor;border-right-color:transparent;border-radius:50%;animation:practiceFinishSpin .75s linear infinite;opacity:.75}#practiceFinishOverlay strong{font-size:20px}#practiceFinishOverlay small{font-size:13px;opacity:.65}@media(prefers-reduced-motion:reduce){#practiceFinishOverlay .pfo-spinner{animation:none}}';
      document.head.appendChild(style);
    }
    const overlay=document.createElement('div');
    overlay.id='practiceFinishOverlay';
    overlay.setAttribute('role','status');
    overlay.setAttribute('aria-live','polite');
    overlay.innerHTML='<div class="pfo-card"><span class="pfo-spinner" aria-hidden="true"></span><strong>점수를 계산하는 중...</strong><small>학습 결과를 저장하고 있어요.</small></div>';
    document.body.appendChild(overlay);
  }
  function removeFinishOverlay(){document.getElementById('practiceFinishOverlay')?.remove()}
  function finishSession(){
    const finished=onFinished();
    Promise.resolve(finished).finally(removeFinishOverlay);
    return finished;
  }

  function restoreOnce(){
    const route=currentActivityRoute(),key=routeKey(route);if(!route||!key)return;
    const saved=restoreActivityProgress(route);if(!saved)return;
    if(key===restoredRouteKey&&indexState.get()!==0)return;
    restoredRouteKey=key;
    const target=Math.max(0,Math.min(queueLength()-1,saved.currentIndex||0));
    for(const outcome of saved.outcomes||[]){
      const i=Number(outcome.index);if(!Number.isFinite(i)||i<0||i>=target||i>=queueLength())continue;
      indexState.set(i);const entry=getEntry(),q=getQuestion(entry);if(!q)continue;
      if(outcome.correct)onCorrect(entry,q,{correct:true,resumed:true});else onWrong(entry,q,{correct:false,resumed:true});
    }
    indexState.set(target);checkedState.set(false);rendererState.set(null);
  }

  function render(){
    if(!isActive())return;
    restoreOnce();
    if(indexState.get()>=queueLength()){
      clearActivitySnapshotFor(currentActivityRoute());
      return finishSession();
    }
    const entry=getEntry(),q=getQuestion(entry);
    if(!q){clearActivitySnapshotFor(currentActivityRoute());return finishSession()}
    saveActivityPosition(indexState.get());
    grading=false;nextPointerArmed=false;
    checkedState.set(false);onBeforeRender(entry,q);
    root.innerHTML=`${renderHeader(entry,q)}<div class="question-card" id="questionHost"></div>`;
    const host=root.querySelector('#questionHost');
    const renderer=new Renderer(host).render(q,{onChange:(_,has)=>{
      const check=document.getElementById(buttonIds.check);
      if(check&&!checkedState.get())check.disabled=!has;
    }});
    rendererState.set(renderer);
    const backButton=root.querySelector('[data-session-back]');if(backButton)backButton.onclick=onBack;
    setBottom(`<button id="${buttonIds.skip}">Skip</button><button class="primary" id="${buttonIds.check}" disabled>Check Answer</button>`);
    document.getElementById(buttonIds.skip).onclick=skip;
    const checkButton=document.getElementById(buttonIds.check);
    checkButton.addEventListener('pointerdown',()=>{if(checkedState.get())nextPointerArmed=true});
    checkButton.addEventListener('keydown',e=>{if(checkedState.get()&&(e.key==='Enter'||e.key===' '))nextPointerArmed=true});
    checkButton.onclick=check;
    startQuestionTimer();
  }

  async function check(){
    if(!isActive())return;
    if(checkedState.get()){
      if(!nextPointerArmed)return;
      nextPointerArmed=false;
      indexState.set(indexState.get()+1);render();return;
    }
    if(grading)return;
    const entry=getEntry(),q=getQuestion(entry),renderer=rendererState.get();if(!q||!renderer)return;
    const response=renderer.getResponse(),btn=document.getElementById(buttonIds.check);if(!btn)return;
    const practiceType=getPracticeType(entry,q);
    const timing=snapshotQuestionTimer();
    grading=true;
    const usesAiWilli=q.grading?.aiAllowed&&q.grading?.mode==='ai_semantic_strict';
    btn.disabled=true;btn.textContent=usesAiWilli?aiWilliMessage('grader','waiting'):'Check Answer';renderer.setDisabled(true);
    if(usesAiWilli)showAiWilliStatus(root,{role:'grader'});
    let result;
    try{result=await gradeQuestion(q,response)}
    catch(e){grading=false;clearAiWilliStatus(root);renderer.setDisabled(false);btn.disabled=false;throw e}
    clearAiWilliStatus(root);if(!isActive()){grading=false;return}
    result.responseTimeMs=timing.activeMs;
    result.wallResponseTimeMs=timing.wallMs;
    result.timingVersion='question-active-v1';
    checkedState.set(true);grading=false;nextPointerArmed=false;
    const answeredIndex=indexState.get();
    const isLastQuestion=answeredIndex===queueLength()-1;
    if(result.correct)onCorrect(entry,q,result);else onWrong(entry,q,result);
    renderer.showFeedback(result);decorateAiWilliFeedback(root,result);
    if(!result.correct){
      if(practiceType==='vocab_test')mountVocabAiWilli({container:root,item:vocabItemFromQuestion(q),question:q,response,result,mode:q?.metadata?.mode||q?.tracking?.questionType||'vocab_test'});
      else mountAiWilliHelper({container:root,question:q,response,result,section:q.skill,practiceType});
    }
    if(isLastQuestion)showFinishOverlay();
    try{await recordAttempt({question:q,response,result,practiceType,...getAttemptExtras(entry,q,false)})}
    catch(e){console.warn(`[test-prep-v2] ${logLabel} tracking failed`,e)}
    if(!isActive())return;
    saveActivityOutcome(answeredIndex,!!result.correct);
    if(isLastQuestion){indexState.set(answeredIndex+1);render();return}
    btn.disabled=false;btn.textContent='Next Question →';
    const skipButton=document.getElementById(buttonIds.skip);if(skipButton)skipButton.disabled=true;
  }

  async function skip(){
    if(checkedState.get()||grading||!isActive())return;
    const entry=getEntry(),q=getQuestion(entry),renderer=rendererState.get();if(!q)return;
    const timing=snapshotQuestionTimer();
    const response=renderer?.getResponse()??null,result={correct:false,method:'skipped',responseTimeMs:timing.activeMs,wallResponseTimeMs:timing.wallMs,timingVersion:'question-active-v1'};
    const answeredIndex=indexState.get();onWrong(entry,q,result);
    const isLastQuestion=answeredIndex===queueLength()-1;
    if(isLastQuestion)showFinishOverlay();
    try{await recordAttempt({question:q,response,result,practiceType:getPracticeType(entry,q),skipped:true,...getAttemptExtras(entry,q,true)})}
    catch(e){console.warn(`[test-prep-v2] ${logLabel} skip tracking failed`,e)}
    if(!isActive())return;
    saveActivityOutcome(answeredIndex,false);
    indexState.set(answeredIndex+1);render();
  }

  return{render,check,skip};
}