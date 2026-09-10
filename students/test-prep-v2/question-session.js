import {aiWilliMessage,showAiWilliStatus,clearAiWilliStatus,decorateAiWilliFeedback,mountAiWilliHelper} from '../shared/ai-willi.js?v=1.1.0';
import {restoreActivityProgress,saveActivityPosition,saveActivityOutcome,clearActivitySnapshotFor,currentActivityRoute} from './activity-session-store.js?v=3.0.0';

// Shared interactive question-session engine for Test Prep v2.
// Owns the common render -> grade/skip -> record -> advance mechanics.
// Route/workflow-specific behavior stays in app.js through callbacks.
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
  const routeKey=route=>route?`${route.planId}|${route.lesson}|${route.practice}`:'';

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
      return onFinished();
    }
    const entry=getEntry(),q=getQuestion(entry);
    if(!q){clearActivitySnapshotFor(currentActivityRoute());return onFinished()}
    saveActivityPosition(indexState.get());
    grading=false;nextPointerArmed=false;
    checkedState.set(false);startedAtState.set(Date.now());onBeforeRender(entry,q);
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
    grading=true;
    const usesAiWilli=q.grading?.aiAllowed&&q.grading?.mode==='ai_semantic_strict';
    btn.disabled=true;btn.textContent=usesAiWilli?aiWilliMessage('grader','waiting'):'Check Answer';renderer.setDisabled(true);
    if(usesAiWilli)showAiWilliStatus(root,{role:'grader'});
    let result;
    try{result=await gradeQuestion(q,response)}
    catch(e){grading=false;clearAiWilliStatus(root);renderer.setDisabled(false);btn.disabled=false;throw e}
    clearAiWilliStatus(root);if(!isActive()){grading=false;return}
    result.responseTimeMs=Date.now()-startedAtState.get();checkedState.set(true);grading=false;nextPointerArmed=false;
    const answeredIndex=indexState.get();
    if(result.correct)onCorrect(entry,q,result);else onWrong(entry,q,result);
    renderer.showFeedback(result);decorateAiWilliFeedback(root,result);
    if(!result.correct)mountAiWilliHelper({container:root,question:q,response,result,section:q.skill,practiceType:getPracticeType(entry,q)});
    try{await recordAttempt({question:q,response,result,practiceType:getPracticeType(entry,q),...getAttemptExtras(entry,q,false)})}
    catch(e){console.warn(`[test-prep-v2] ${logLabel} tracking failed`,e)}
    if(!isActive())return;
    saveActivityOutcome(answeredIndex,!!result.correct);
    btn.disabled=false;btn.textContent=indexState.get()===queueLength()-1?'Finish':'Next Question →';
    const skipButton=document.getElementById(buttonIds.skip);if(skipButton)skipButton.disabled=true;
  }

  async function skip(){
    if(checkedState.get()||grading||!isActive())return;
    const entry=getEntry(),q=getQuestion(entry),renderer=rendererState.get();if(!q)return;
    const response=renderer?.getResponse()??null,result={correct:false,method:'skipped',responseTimeMs:Date.now()-startedAtState.get()};
    const answeredIndex=indexState.get();onWrong(entry,q,result);
    try{await recordAttempt({question:q,response,result,practiceType:getPracticeType(entry,q),skipped:true,...getAttemptExtras(entry,q,true)})}
    catch(e){console.warn(`[test-prep-v2] ${logLabel} skip tracking failed`,e)}
    if(!isActive())return;
    saveActivityOutcome(answeredIndex,false);
    indexState.set(answeredIndex+1);render();
  }

  return{render,check,skip};
}