import {aiWilliMessage,showAiWilliStatus,clearAiWilliStatus,decorateAiWilliFeedback,mountAiWilliHelper} from '../shared/ai-willi.js?v=1.1.0';
import {restoreActivityProgress,saveActivityProgress,clearActivitySnapshotFor,currentActivityRoute} from './activity-session-store.js?v=2.0.0';

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
  const routeKey=route=>route?`${route.planId}|${route.lesson}|${route.practice}`:'';

  function restoreOnce(){
    const route=currentActivityRoute(),key=routeKey(route);
    if(!route||!key||key===restoredRouteKey)return;
    restoredRouteKey=key;
    const saved=restoreActivityProgress(route);if(!saved)return;
    const target=Math.max(0,Math.min(queueLength(),saved.resumeIndex||0));
    const original=indexState.get();
    for(const outcome of saved.outcomes||[]){
      const i=Number(outcome.index);if(!Number.isFinite(i)||i<0||i>=target||i>=queueLength())continue;
      indexState.set(i);const entry=getEntry(),q=getQuestion(entry);if(!q)continue;
      if(outcome.correct)onCorrect(entry,q,{correct:true,resumed:true});else onWrong(entry,q,{correct:false,resumed:true});
    }
    indexState.set(target||original&&target===0?target:target);checkedState.set(false);rendererState.set(null);
  }
  function saveOutcome(index,correct,resumeIndex){
    try{saveActivityProgress({resumeIndex,outcome:{index,correct}})}catch(e){console.warn(`[test-prep-v2] ${logLabel} local session save failed`,e)}
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
    document.getElementById(buttonIds.check).onclick=check;
  }

  async function check(){
    if(!isActive())return;
    if(checkedState.get()){indexState.set(indexState.get()+1);render();return}
    const entry=getEntry(),q=getQuestion(entry),renderer=rendererState.get();if(!q||!renderer)return;
    const response=renderer.getResponse(),btn=document.getElementById(buttonIds.check);if(!btn)return;
    const usesAiWilli=q.grading?.aiAllowed&&q.grading?.mode==='ai_semantic_strict';
    btn.disabled=true;btn.textContent=usesAiWilli?aiWilliMessage('grader','waiting'):'Check Answer';renderer.setDisabled(true);
    if(usesAiWilli)showAiWilliStatus(root,{role:'grader'});
    const result=await gradeQuestion(q,response);clearAiWilliStatus(root);if(!isActive())return;
    result.responseTimeMs=Date.now()-startedAtState.get();checkedState.set(true);
    const answeredIndex=indexState.get();
    if(result.correct)onCorrect(entry,q,result);else onWrong(entry,q,result);
    renderer.showFeedback(result);decorateAiWilliFeedback(root,result);
    if(!result.correct)mountAiWilliHelper({container:root,question:q,response,result,section:q.skill,practiceType:getPracticeType(entry,q)});
    try{await recordAttempt({question:q,response,result,practiceType:getPracticeType(entry,q),...getAttemptExtras(entry,q,false)})}
    catch(e){console.warn(`[test-prep-v2] ${logLabel} tracking failed`,e)}
    if(!isActive())return;
    saveOutcome(answeredIndex,!!result.correct,answeredIndex+1);
    btn.disabled=false;btn.textContent=indexState.get()===queueLength()-1?'Finish':'Next Question →';
    const skipButton=document.getElementById(buttonIds.skip);if(skipButton)skipButton.disabled=true;
  }

  async function skip(){
    if(checkedState.get()||!isActive())return;
    const entry=getEntry(),q=getQuestion(entry),renderer=rendererState.get();if(!q)return;
    const response=renderer?.getResponse()??null,result={correct:false,method:'skipped',responseTimeMs:Date.now()-startedAtState.get()};
    const answeredIndex=indexState.get();onWrong(entry,q,result);
    try{await recordAttempt({question:q,response,result,practiceType:getPracticeType(entry,q),skipped:true,...getAttemptExtras(entry,q,true)})}
    catch(e){console.warn(`[test-prep-v2] ${logLabel} skip tracking failed`,e)}
    if(!isActive())return;indexState.set(answeredIndex+1);saveOutcome(answeredIndex,false,answeredIndex+1);render();
  }

  return{render,check,skip};
}