(function(){
'use strict';
// Legacy 내신 V1 loader intentionally disabled.
// 내신 V2 is the only 내신 experience shown in Teacher Dashboard V2.
console.info('[naesin-v1] legacy loader disabled');

// Teacher Dashboard extension loader. Keep feature pages out of the large
// inline dashboard script so they can evolve independently.
if(!document.getElementById('grammarFoundationsTeacherScript')){
  const s=document.createElement('script');
  s.id='grammarFoundationsTeacherScript';
  s.src='./grammar-foundations-teacher.js?v=1.1.0';
  s.defer=true;
  document.head.appendChild(s);
}

// Grammar drawer opens with every lesson collapsed. This only reacts when
// drawer content is freshly rendered; normal teacher clicks on <details>
// remain untouched afterward.
if(!window.__gfTeacherDefaultCollapseInstalled){
  window.__gfTeacherDefaultCollapseInstalled=true;
  const collapseFreshDetails=()=>{
    document.querySelectorAll('#gfTeacherDrawerBody .gf-detail-module[open]').forEach(detail=>detail.removeAttribute('open'));
    const rev=document.getElementById('teacherDashboardRev');
    if(rev)rev.textContent='REV r13.05';
  };
  const observer=new MutationObserver(mutations=>{
    if(mutations.some(m=>m.type==='childList'&&m.addedNodes.length))collapseFreshDetails();
  });
  const start=()=>{observer.observe(document.body,{childList:true,subtree:true});collapseFreshDetails()};
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
}
})();