(function(){
'use strict';

// Crash Fix Rev1
// Phase 1 compatibility patch for low-memory tablets/older phones.
//
// The previous implementation calculated lesson totals in the browser by
// downloading up to 10,000 source-content rows and 10,000 question rows,
// including question metadata, as soon as the Test Prep home screen loaded.
// That work is intentionally disabled here. Existing home/lesson rendering and
// practice navigation remain untouched; the proper compact server-side totals
// endpoint will replace this in Phase 2.

function addCrashFixBadge(){
  if(document.getElementById('tp-crash-fix-rev1')) return;

  const badge=document.createElement('div');
  badge.id='tp-crash-fix-rev1';
  badge.textContent='Crash Fix Rev1';
  badge.setAttribute('aria-label','Crash Fix Rev1 active');
  Object.assign(badge.style,{
    position:'fixed',
    right:'8px',
    bottom:'8px',
    zIndex:'2147483647',
    padding:'4px 8px',
    borderRadius:'999px',
    background:'rgba(20,20,24,.82)',
    color:'#fff',
    font:'600 11px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    letterSpacing:'.01em',
    boxShadow:'0 2px 8px rgba(0,0,0,.18)',
    pointerEvents:'none',
    opacity:'.88'
  });
  document.body.appendChild(badge);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',addCrashFixBadge,{once:true});
}else{
  addCrashFixBadge();
}

// Keep the old tracking hook lightweight: refresh the already-aggregated
// student stats after saved attempts/completed sessions, but do not fetch or
// process curriculum/question totals in the browser.
let refreshTimer=0;
window.addEventListener('testprep:tracking',e=>{
  if(!['attempt_saved','session_completed'].includes(e.detail?.type)) return;
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(()=>{
    try{ window.WillenaTestPrepAuth?.refreshStats?.(); }
    catch(err){ console.warn('[Crash Fix Rev1] stats refresh skipped',err); }
  },180);
});

console.info('[Test Prep] Crash Fix Rev1 active: heavy client-side progress totals disabled');
})();