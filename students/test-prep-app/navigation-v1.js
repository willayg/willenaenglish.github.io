(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
let booted=false;
let currentState=null;
const navState=()=>history.state?.tp?history.state:{tp:'home'};
function sameState(a,b){return a?.tp===b?.tp&&String(a?.planId||'')===String(b?.planId||'')&&String(a?.lesson||'')===String(b?.lesson||'')&&String(a?.skill||'')===String(b?.skill||'')&&String(a?.returnTo||'')===String(b?.returnTo||'')&&!!a?.review===!!b?.review}
function remember(state){currentState=state?.tp?{...state}:{tp:'home'}}
function push(state){
 const cur=navState();
 if(sameState(cur,state))return false;
 if(cur.tp==='lesson'&&state?.tp==='lesson')history.replaceState(state,'',location.href);
 else history.pushState(state,'',location.href);
 remember(state);
 return true;
}
function replace(state){history.replaceState(state,'',location.href);remember(state)}
function ensureInitial(){if(!history.state?.tp)replace({tp:'home'});else remember(navState())}
function normalizeColdPractice(){
 const s=navState();
 if(s.tp!=='practice')return;
 const live=window.WillenaAssignedTestPrep?.selection;
 if(live)return;
 if(s.review||s.returnTo==='wrong'){replace({tp:'wrong'});return;}
 if(s.returnTo==='lesson'&&s.planId&&s.lesson){replace({tp:'lesson',planId:s.planId,lesson:s.lesson});return;}
 replace({tp:'home'});
}
function stopEvent(e){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()}
function closePractice(){
 const quiz=$('#assignedQuizPane');
 if(!quiz||quiz.style.display==='none')return false;
 try{window.WillenaTestPrepAuth?.completeSession?.(0,0,[])}catch(_){}
 try{window.WillenaVocabPractice?.restore?.()}catch(_){}
 try{window.WillenaVocabTestPractice?.restore?.()}catch(_){}
 try{window.WillenaSentencePractice?.restore?.()}catch(_){}
 try{window.WillenaAssignedTestPrep?.showHomeSurface?.()}catch(_){}
 return true;
}
function notifyPracticeLeft(){try{window.dispatchEvent(new CustomEvent('testprep:practice-left'))}catch(_){}}
function renderState(state){
 const ux=window.WillenaTestPrepUX;if(!ux)return false;
 const s=state?.tp?state:{tp:'home'};
 const leftPractice=s.tp!=='practice'&&closePractice();
 if(s.tp==='lesson'&&s.planId&&s.lesson){if(window.WillenaStudentsRev2?.renderJourney)window.WillenaStudentsRev2.renderJourney(s.planId,s.lesson);else ux.renderLesson?.(s.planId,s.lesson,s.skill||null)}
 else if(s.tp==='wrong')ux.showWrongCenter?.();
 else if(s.tp==='home')ux.renderHome?.();
 if(leftPractice)notifyPracticeLeft();
 return true;
}
function smartBack(){
 const cur=navState();
 if(cur.tp==='lesson'){const home={tp:'home'};replace(home);renderState(home);return;}
 if(cur.tp==='practice'){
  let target={tp:'home'};
  if(cur.review||cur.returnTo==='wrong')target={tp:'wrong'};
  else if(cur.returnTo==='lesson'&&cur.planId&&cur.lesson)target={tp:'lesson',planId:cur.planId,lesson:cur.lesson};
  replace(target);renderState(target);return;
 }
 if(cur.tp==='wrong'){const home={tp:'home'};replace(home);renderState(home);}
}
function clickCapture(e){const target=e.target instanceof Element?e.target:null;if(!target)return;
 const back=target.closest('.tp-back,.back-assign');if(back){stopEvent(e);smartBack();return}
 const lesson=target.closest('.tp-lesson-card');if(lesson){push({tp:'lesson',planId:lesson.dataset.lessonPlan,lesson:lesson.dataset.lesson});return}
 const wrong=target.closest('.tp-wrong-card:not(.no-wrong)');if(wrong){push({tp:'wrong'});return}
 const task=target.closest('[data-task-plan]');if(task){push({tp:'practice',planId:task.dataset.taskPlan,lesson:task.dataset.taskLesson,skill:task.dataset.taskSkill,returnTo:'home'});return}
 const stop=target.closest('.tp-stop:not(.disabled),.tp-r7-stop');if(stop){const cur=navState();push({tp:'practice',planId:cur.planId||null,lesson:cur.lesson||null,skill:stop.dataset.skill||stop.dataset.r7Skill||null,returnTo:'lesson'});return}
 const review=target.closest('.tp-review-start,.tp-review-btn');if(review){push({tp:'practice',review:true,returnTo:'wrong'});return}
}
function onPop(e){
 const from=currentState||{tp:'home'};let state=e.state?.tp?e.state:{tp:'home'};
 if(from.tp==='lesson'&&state.tp==='lesson'){state={tp:'home'};history.replaceState(state,'',location.href)}
 remember(state);let tries=0;const go=()=>{if(renderState(state))return;if(++tries<80)setTimeout(go,25)};go();
}
function restoreCurrent(){const s=navState();remember(s);if(s.tp==='home'||s.tp==='practice')return;let tries=0;const go=()=>{if(renderState(s))return;if(++tries<80)setTimeout(go,25)};go()}
function back(){smartBack()}
function toWrong({replaceEntry=false}={}){const state={tp:'wrong'};if(replaceEntry)replace(state);else push(state);renderState(state)}
function toHome({replaceEntry=false}={}){const state={tp:'home'};if(replaceEntry)replace(state);else push(state);renderState(state)}
function boot(){if(booted)return;booted=true;ensureInitial();normalizeColdPractice();remember(navState());document.addEventListener('click',clickCapture,true);window.addEventListener('popstate',onPop);restoreCurrent()}
window.WillenaTestPrepNavigation={push,replace,back,toWrong,toHome,renderState,get state(){return navState()}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();