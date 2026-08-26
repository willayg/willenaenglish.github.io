(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
let booted=false;
function sameState(a,b){return a?.tp===b?.tp&&String(a?.planId||'')===String(b?.planId||'')&&String(a?.lesson||'')===String(b?.lesson||'')&&String(a?.skill||'')===String(b?.skill||'')}
function push(state){if(sameState(history.state,state))return;history.pushState(state,'',location.href)}
function ensureInitial(){if(!history.state?.tp)history.replaceState({tp:'home'},'',location.href)}
function closePractice(){const quiz=$('#assignedQuizPane');if(!quiz||quiz.style.display==='none')return;try{window.WillenaTestPrepAuth?.completeSession?.(0,0,[])}catch(_){}try{window.WillenaVocabPractice?.restore?.()}catch(_){}try{window.WillenaVocabTestPractice?.restore?.()}catch(_){}try{window.WillenaSentencePractice?.restore?.()}catch(_){}try{window.WillenaAssignedTestPrep?.showHomeSurface?.()}catch(_){} }
function renderState(state){const ux=window.WillenaTestPrepUX;if(!ux)return false;closePractice();const s=state||{tp:'home'};if(s.tp==='lesson'&&s.planId&&s.lesson){ux.renderLesson?.(s.planId,s.lesson,s.skill||null);return true}if(s.tp==='wrong'){ux.showWrongCenter?.();return true}ux.renderHome?.();return true}
function clickCapture(e){const target=e.target instanceof Element?e.target:null;if(!target)return;
 const lesson=target.closest('.tp-lesson-card');
 if(lesson){push({tp:'lesson',planId:lesson.dataset.lessonPlan,lesson:lesson.dataset.lesson});return}
 const wrong=target.closest('.tp-wrong-card:not(.no-wrong)');
 if(wrong){push({tp:'wrong'});return}
 const task=target.closest('[data-task-plan]');
 if(task){push({tp:'practice',planId:task.dataset.taskPlan,lesson:task.dataset.taskLesson,skill:task.dataset.taskSkill,returnTo:'home'});return}
 const stop=target.closest('.tp-stop:not(.disabled)');
 if(stop){const cur=history.state||{};push({tp:'practice',planId:cur.planId||null,lesson:cur.lesson||null,skill:stop.dataset.skill||null,returnTo:'lesson'});return}
 const review=target.closest('.tp-review-start,.tp-review-btn');
 if(review){push({tp:'practice',review:true,returnTo:'wrong'});return}
 const back=target.closest('.tp-back,.back-assign');
 if(back&&history.state?.tp&&history.state.tp!=='home'){
   e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();history.back();
 }
}
function onPop(e){let tries=0;const go=()=>{if(renderState(e.state||{tp:'home'}))return;if(++tries<80)setTimeout(go,25)};go()}
function restoreCurrent(){const s=history.state;if(!s||s.tp==='home'||s.tp==='practice')return;let tries=0;const go=()=>{if(renderState(s))return;if(++tries<80)setTimeout(go,25)};go()}
function boot(){if(booted)return;booted=true;ensureInitial();document.addEventListener('click',clickCapture,true);window.addEventListener('popstate',onPop);restoreCurrent()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
