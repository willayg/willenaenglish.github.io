(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
let resultLock=false,patchedUx=false;

function styles(){
 if($('#tpFinishRev4Styles'))return;
 const s=document.createElement('style');
 s.id='tpFinishRev4Styles';
 s.textContent=`
 #card.tp-skip-transition .choices,
 #card.tp-skip-transition .feedback,
 #card.tp-skip-transition .explanation,
 #card.tp-skip-transition .actions{visibility:hidden!important}
 #card.tp-skip-transition .tp-skip-wrap{visibility:visible!important}
 #card.tp-skip-transition .tp-skip{opacity:.45!important;pointer-events:none!important}
 `;
 document.head.appendChild(s);
}

function resultVisible(){
 const c=$('#card');
 return !!c?.querySelector('.result,.tp-review-result,.tp-review-result,.score');
}
function release(){resultLock=false;$('#card')?.classList.remove('tp-skip-transition')}
function forcePractice(){
 if(!resultLock)return;
 // Result lock may preserve the result surface, but it may not override navigation.
 // If Back has moved history away from practice, release immediately.
 if(history.state?.tp!=='practice'){release();return;}
 const home=$('#assignmentHome'),quiz=$('#assignedQuizPane');
 if(home)home.style.display='none';
 if(quiz)quiz.style.display='block';
}

function patchUx(){
 const ux=window.WillenaTestPrepUX;
 if(patchedUx||!ux)return false;
 for(const name of ['renderHome','renderLesson','showWrongCenter']){
  if(typeof ux[name]!=='function')continue;
  const original=ux[name].bind(ux);
  ux[name]=function(...args){
   if(resultLock&&resultVisible()&&history.state?.tp==='practice'){forcePractice();return false;}
   if(history.state?.tp!=='practice')release();
   return original(...args);
  };
 }
 patchedUx=true;
 return true;
}

// Mask the old synthetic wrong-answer flash. We keep its bookkeeping for now,
// but the student never sees the fake selected answer / red-green feedback.
document.addEventListener('click',e=>{
 const t=e.target instanceof Element?e.target:null;if(!t)return;
 const skip=t.closest('#tpSkipQuestion');
 if(skip){
  const card=$('#card');
  card?.classList.add('tp-skip-transition');
  setTimeout(()=>card?.classList.remove('tp-skip-transition'),180);
  return;
 }
 if(t.closest('.back-assign,.tp-back,#retry,#again,#authoredAgain,#seosulAgain,.tp-result-retry-wrong,.tp-review-next'))release();
},true);

// Session completion may trigger a stats refresh that redraws the lesson menu.
// Hold the result surface until the student explicitly chooses what happens next.
window.addEventListener('testprep:tracking',e=>{
 if(e.detail?.type!=='session_completed')return;
 if(history.state?.tp!=='practice')return;
 resultLock=true;
 setTimeout(forcePractice,0);
 setTimeout(forcePractice,220);
},true);

window.addEventListener('testprep:student-state-refresh',e=>{
 if(!resultLock)return;
 if(history.state?.tp!=='practice'){release();return;}
 // Do not allow completion-time refresh listeners to redraw home/lesson UI.
 e.stopImmediatePropagation();
 forcePractice();
},true);

window.addEventListener('popstate',()=>{
 if(history.state?.tp!=='practice')release();
});

function boot(){
 styles();
 let n=0;
 const t=setInterval(()=>{patchUx();if(patchedUx||++n>160)clearInterval(t)},25);
 const card=$('#card');
 if(card)new MutationObserver(()=>{
  if(resultLock&&resultVisible())queueMicrotask(forcePractice);
 }).observe(card,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
