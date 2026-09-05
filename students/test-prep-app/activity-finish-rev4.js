(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
let resultLock=false,patchedUx=false,userReleased=false;

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
 return !!c?.querySelector('.result,.tp-review-result,.score');
}
function release(){resultLock=false;$('#card')?.classList.remove('tp-skip-transition')}
function forcePractice(){
 if(!resultLock)return;
 if(userReleased){release();return;}
 const home=$('#assignmentHome'),quiz=$('#assignedQuizPane');
 if(home)home.style.display='none';
 if(quiz)quiz.style.display='block';
 const sel=window.WillenaAssignedTestPrep?.selection;
 if(sel&&history.state?.tp!=='practice'){
  const cur=history.state||{};
  history.replaceState({...cur,tp:'practice',planId:sel.plan?.id||cur.planId||null,lesson:sel.lesson||cur.lesson||null,skill:sel.section||cur.skill||null,returnTo:cur.returnTo||'lesson',review:!!sel.reviewMode},'',location.href);
 }
}

function patchUx(){
 const ux=window.WillenaTestPrepUX;
 if(patchedUx||!ux)return false;
 for(const name of ['renderHome','renderLesson','showWrongCenter']){
  if(typeof ux[name]!=='function')continue;
  const original=ux[name].bind(ux);
  ux[name]=function(...args){
   if(resultLock&&resultVisible()&&!userReleased){forcePractice();return false;}
   return original(...args);
  };
 }
 patchedUx=true;
 return true;
}

document.addEventListener('click',e=>{
 const t=e.target instanceof Element?e.target:null;if(!t)return;
 const skip=t.closest('#tpSkipQuestion');
 if(skip){
  const card=$('#card');
  card?.classList.add('tp-skip-transition');
  setTimeout(()=>card?.classList.remove('tp-skip-transition'),180);
  return;
 }
 if(t.closest('.back-assign,.tp-back,#retry,#again,#authoredAgain,#seosulAgain,.tp-result-retry-wrong,.tp-review-next')){userReleased=true;release();}
},true);

window.addEventListener('testprep:tracking',e=>{
 const type=e.detail?.type;
 if(type==='session_started'){userReleased=false;return;}
 if(type!=='session_completed'||userReleased)return;
 resultLock=true;
 setTimeout(forcePractice,0);
 setTimeout(forcePractice,220);
},true);

window.addEventListener('testprep:student-state-refresh',e=>{
 if(!resultLock||userReleased)return;
 e.stopImmediatePropagation();
 forcePractice();
},true);

window.addEventListener('popstate',()=>{
 if(resultLock&&resultVisible()){userReleased=true;release();}
});

function boot(){
 styles();
 let n=0;
 const t=setInterval(()=>{patchUx();if(patchedUx||++n>160)clearInterval(t)},25);
 const card=$('#card');
 if(card)new MutationObserver(()=>{
  if(resultLock&&resultVisible()&&!userReleased)queueMicrotask(forcePractice);
 }).observe(card,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
