(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
let booted=false;
const navState=()=>history.state?.tp?history.state:{tp:'home'};
function sameState(a,b){return a?.tp===b?.tp&&String(a?.planId||'')===String(b?.planId||'')&&String(a?.lesson||'')===String(b?.lesson||'')&&String(a?.skill||'')===String(b?.skill||'')&&String(a?.returnTo||'')===String(b?.returnTo||'')&&!!a?.review===!!b?.review}
function push(state){if(sameState(navState(),state))return false;history.pushState(state,'',location.href);return true}
function replace(state){history.replaceState(state,'',location.href)}
function ensureInitial(){if(!history.state?.tp)replace({tp:'home'})}
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
function closePractice(){const quiz=$('#assignedQuizPane');if(!quiz||quiz.style.display==='none')return;try{window.WillenaTestPrepAuth?.completeSession?.(0,0,[])}catch(_){}try{window.WillenaVocabPractice?.restore?.()}catch(_){}try{window.WillenaVocabTestPractice?.restore?.()}catch(_){}try{window.WillenaSentencePractice?.restore?.()}catch(_){}try{window.WillenaAssignedTestPrep?.showHomeSurface?.()}catch(_){} }
function renderState(state){const ux=window.WillenaTestPrepUX;if(!ux)return false;const s=state?.tp?state:{tp:'home'};if(s.tp!=='practice')closePractice();if(s.tp==='lesson'&&s.planId&&s.lesson){ux.renderLesson?.(s.planId,s.lesson,s.skill||null);return true}if(s.tp==='wrong'){ux.showWrongCenter?.();return true}if(s.tp==='home'){ux.renderHome?.();return true}return true}
function clickCapture(e){const target=e.target instanceof Element?e.target:null;if(!target)return;
 const back=target.closest('.tp-back,.back-assign');
 if(back){stopEvent(e);if(navState().tp!=='home')history.back();return}
 const lesson=target.closest('.tp-lesson-card');
 if(lesson){push({tp:'lesson',planId:lesson.dataset.lessonPlan,lesson:lesson.dataset.lesson});return}
 const wrong=target.closest('.tp-wrong-card:not(.no-wrong)');
 if(wrong){push({tp:'wrong'});return}
 const task=target.closest('[data-task-plan]');
 if(task){push({tp:'practice',planId:task.dataset.taskPlan,lesson:task.dataset.taskLesson,skill:task.dataset.taskSkill,returnTo:'home'});return}
 const stop=target.closest('.tp-stop:not(.disabled)');
 if(stop){const cur=navState();push({tp:'practice',planId:cur.planId||null,lesson:cur.lesson||null,skill:stop.dataset.skill||null,returnTo:'lesson'});return}
 const review=target.closest('.tp-review-start,.tp-review-btn');
 if(review){push({tp:'practice',review:true,returnTo:'wrong'});return}
}
function onPop(e){let tries=0;const state=e.state?.tp?e.state:{tp:'home'};const go=()=>{if(renderState(state))return;if(++tries<80)setTimeout(go,25)};go()}
function restoreCurrent(){const s=navState();if(s.tp==='home'||s.tp==='practice')return;let tries=0;const go=()=>{if(renderState(s))return;if(++tries<80)setTimeout(go,25)};go()}
function back(){if(navState().tp!=='home')history.back()}
function toWrong({replaceEntry=false}={}){const state={tp:'wrong'};if(replaceEntry)replace(state);else push(state);renderState(state)}
function toHome({replaceEntry=false}={}){const state={tp:'home'};if(replaceEntry)replace(state);else push(state);renderState(state)}
function boot(){if(booted)return;booted=true;ensureInitial();normalizeColdPractice();document.addEventListener('click',clickCapture,true);window.addEventListener('popstate',onPop);restoreCurrent()}
window.WillenaTestPrepNavigation={push,replace,back,toWrong,toHome,renderState,get state(){return navState()}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
