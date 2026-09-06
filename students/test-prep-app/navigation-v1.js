(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
let booted=false,currentState=null;
const navState=()=>history.state?.tp?history.state:{tp:'home'};
function sameState(a,b){return a?.tp===b?.tp&&String(a?.planId||'')===String(b?.planId||'')&&String(a?.lesson||'')===String(b?.lesson||'')&&String(a?.skill||'')===String(b?.skill||'')&&String(a?.returnTo||'')===String(b?.returnTo||'')}
function remember(state){currentState=state?.tp?{...state}:{tp:'home'}}
function push(state){const cur=navState();if(sameState(cur,state))return false;if(cur.tp==='lesson'&&state?.tp==='lesson')history.replaceState(state,'',location.href);else history.pushState(state,'',location.href);remember(state);return true}
function replace(state){history.replaceState(state,'',location.href);remember(state)}
function ensureInitial(){if(!history.state?.tp)replace({tp:'home'});else remember(navState())}
function normalizeColdState(){
 const s=navState();
 if(s.tp==='wrong'){replace({tp:'home'});return}
 if(s.tp!=='practice')return;
 const live=window.WillenaAssignedTestPrep?.selection;
 if(live)return;
 // Pre-REV48 review history is dead state. Never restore it.
 if(s.review||s.returnTo==='wrong'){replace({tp:'home'});return}
 if(s.returnTo==='lesson'&&s.planId&&s.lesson){replace({tp:'lesson',planId:s.planId,lesson:s.lesson});return}
 replace({tp:'home'})
}
function stopEvent(e){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()}
function closePractice(){
 const quiz=$('#assignedQuizPane');if(!quiz||quiz.style.display==='none')return false;
 try{window.WillenaTestPrepAuth?.completeSession?.(0,0,[])}catch(_){}
 try{window.WillenaVocabPractice?.restore?.()}catch(_){}
 try{window.WillenaVocabTestPractice?.restore?.()}catch(_){}
 try{window.WillenaSentencePractice?.restore?.()}catch(_){}
 try{window.WillenaAssignedTestPrep?.showHomeSurface?.()}catch(_){}
 return true
}
function notifyPracticeLeft(){try{window.dispatchEvent(new CustomEvent('testprep:practice-left'))}catch(_){}}
function renderState(state){
 const ux=window.WillenaTestPrepUX;if(!ux)return false;const s=state?.tp?state:{tp:'home'};const leftPractice=s.tp!=='practice'&&closePractice();
 if(s.tp==='lesson'&&s.planId&&s.lesson)ux.renderLesson?.(s.planId,s.lesson,s.skill||null);
 else if(s.tp==='wrong')ux.showWrongCenter?.();
 else if(s.tp==='home')ux.renderHome?.();
 if(leftPractice)notifyPracticeLeft();return true
}
function renderCanonicalLesson(){const s=navState();if(s.tp==='lesson'&&s.planId&&s.lesson)window.WillenaTestPrepUX?.renderLesson?.(s.planId,s.lesson,s.skill||null)}
function smartBack(){
 const cur=navState();
 if(cur.tp==='lesson'){const h={tp:'home'};replace(h);renderState(h);return}
 if(cur.tp==='practice'){let target={tp:'home'};if(cur.returnTo==='lesson'&&cur.planId&&cur.lesson)target={tp:'lesson',planId:cur.planId,lesson:cur.lesson};replace(target);renderState(target);return}
 if(cur.tp==='wrong'){const h={tp:'home'};replace(h);renderState(h)}
}
function clickCapture(e){
 const target=e.target instanceof Element?e.target:null;if(!target)return;
 // REV48 owns its own cleanup. Only fix the history state here, then allow its click handler to run.
 const reviewBack=target.closest('.tp48-back,#tp48Home');if(reviewBack){replace({tp:'home'});return}
 const back=target.closest('.tp-back,.back-assign');if(back){stopEvent(e);smartBack();return}
 const lesson=target.closest('.tp-lesson-card');if(lesson){push({tp:'lesson',planId:lesson.dataset.lessonPlan,lesson:lesson.dataset.lesson});return}
 const wrong=target.closest('.tp-wrong-card:not(.no-wrong)');if(wrong){push({tp:'wrong'});return}
 const task=target.closest('[data-task-plan]');if(task){push({tp:'practice',planId:task.dataset.taskPlan,lesson:task.dataset.taskLesson,skill:task.dataset.taskSkill,returnTo:'home'});return}
 const stop=target.closest('.tp-stop:not(.disabled),.tp-r7-stop');if(stop){const cur=navState();push({tp:'practice',planId:cur.planId||null,lesson:cur.lesson||null,skill:stop.dataset.skill||stop.dataset.r7Skill||null,returnTo:'lesson'});return}
 // No review-start practice state. REV48 stays tp:'wrong' for the entire run.
}
function onPop(e){
 const from=currentState||{tp:'home'};let state=e.state?.tp?e.state:{tp:'home'};
 if(from.tp==='wrong'||(from.tp==='practice'&&(from.review||from.returnTo==='wrong'))){state={tp:'home'};history.replaceState(state,'',location.href)}
 else if(from.tp==='lesson'&&state.tp==='lesson'){state={tp:'home'};history.replaceState(state,'',location.href)}
 remember(state);let tries=0;const go=()=>{if(renderState(state))return;if(++tries<80)setTimeout(go,25)};go()
}
function restoreCurrent(){const s=navState();remember(s);if(s.tp==='home'||s.tp==='practice')return;let tries=0;const go=()=>{if(renderState(s))return;if(++tries<80)setTimeout(go,25)};go()}
function back(){smartBack()}
function toWrong({replaceEntry=false}={}){const s={tp:'wrong'};if(replaceEntry)replace(s);else push(s);renderState(s)}
function toHome({replaceEntry=false}={}){const s={tp:'home'};if(replaceEntry)replace(s);else push(s);renderState(s)}
function boot(){if(booted)return;booted=true;ensureInitial();normalizeColdState();remember(navState());document.addEventListener('click',clickCapture,true);window.addEventListener('popstate',onPop);window.addEventListener('testprep:student-state-refresh',()=>queueMicrotask(renderCanonicalLesson));restoreCurrent()}
window.WillenaTestPrepNavigation={push,replace,back,toWrong,toHome,renderState,get state(){return navState()}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
console.log('[REV50d] navigation uses canonical student UX lesson renderer');
})();