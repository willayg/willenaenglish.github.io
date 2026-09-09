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

  function render(){
    if(!isActive())return;
    if(indexState.get()>=queueLength())return onFinished();
    const entry=getEntry(),q=getQuestion(entry);
    if(!q)return onFinished();
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
    btn.disabled=true;btn.textContent=q.grading?.aiAllowed&&q.grading?.mode==='ai_semantic_strict'?'Checking…':'Check Answer';renderer.setDisabled(true);
    const result=await gradeQuestion(q,response);if(!isActive())return;
    result.responseTimeMs=Date.now()-startedAtState.get();checkedState.set(true);
    if(result.correct)onCorrect(entry,q,result);else onWrong(entry,q,result);
    renderer.showFeedback(result);
    try{await recordAttempt({question:q,response,result,practiceType:getPracticeType(entry,q),...getAttemptExtras(entry,q,false)})}
    catch(e){console.warn(`[test-prep-v2] ${logLabel} tracking failed`,e)}
    if(!isActive())return;
    btn.disabled=false;btn.textContent=indexState.get()===queueLength()-1?'Finish':'Next Question →';
    const skipButton=document.getElementById(buttonIds.skip);if(skipButton)skipButton.disabled=true;
  }

  async function skip(){
    if(checkedState.get()||!isActive())return;
    const entry=getEntry(),q=getQuestion(entry),renderer=rendererState.get();if(!q)return;
    const response=renderer?.getResponse()??null,result={correct:false,method:'skipped',responseTimeMs:Date.now()-startedAtState.get()};
    onWrong(entry,q,result);
    try{await recordAttempt({question:q,response,result,practiceType:getPracticeType(entry,q),skipped:true,...getAttemptExtras(entry,q,true)})}
    catch(e){console.warn(`[test-prep-v2] ${logLabel} skip tracking failed`,e)}
    if(!isActive())return;indexState.set(indexState.get()+1);render();
  }

  return{render,check,skip};
}
