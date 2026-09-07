(function(){
'use strict';
/* REV53: compatibility filename, single-purpose refresh recovery only.
   No fetch interception, no history rewriting, no popstate ownership, no
   event suppression. student-ux-v5 remains the sole navigation owner. */
let recoveryStarted=false;

function bumpRev(){
  try{
    const badge=document.querySelector('[id^="tp-rev"][id$="-badge"]');
    if(badge){badge.id='tp-rev53-badge';badge.textContent='REV 53';}
  }catch(_){}
}
function practiceState(){
  const s=history.state||{};
  return s.tp==='practice'&&s.planId&&s.lesson&&s.skill?s:null;
}
function waitForAssigned(){
  return new Promise((resolve,reject)=>{
    let tries=0;
    (function check(){
      const assigned=window.WillenaAssignedTestPrep;
      if(assigned?.startSelection){resolve(assigned);return;}
      if(++tries>=120){reject(new Error('practice shell unavailable'));return;}
      setTimeout(check,50);
    })();
  });
}
async function recoverPractice(){
  const target=practiceState();
  if(!target||recoveryStarted)return;
  recoveryStarted=true;
  try{
    const auth=window.WillenaTestPrepAuth;
    if(auth?.ready)await auth.ready;
    const assigned=await waitForAssigned();
    /* The route already exists because this is a reload. startSelection only
       reconstructs the activity surface; it does not create another history entry. */
    await assigned.startSelection(target.planId,target.lesson,target.skill);
    console.log('[Test Prep] REV53: restored activity after refresh',target.skill);
  }catch(e){
    console.error('[Test Prep] REV53: activity refresh recovery failed',e);
    const fallback=target.returnTo==='home'?{tp:'home'}:{tp:'lesson',planId:String(target.planId),lesson:String(target.lesson),skill:String(target.skill),safeFix4:true};
    try{history.replaceState(fallback,'',location.href)}catch(_){}
    try{window.WillenaTestPrepUX?.renderRoute?.(fallback)}catch(_){}
  }
}
function boot(){bumpRev();recoverPractice();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
bumpRev();
console.log('[Test Prep] REV53: refresh recovery has single-purpose ownership');
})();
