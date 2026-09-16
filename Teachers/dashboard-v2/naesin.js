(function(){
'use strict';

// Legacy 내신 V1 loader intentionally disabled.
console.info('[naesin-v1] legacy loader disabled');

function setRevision(){
  const rev=document.getElementById('teacherDashboardRev');
  if(rev)rev.textContent='REV r13.06';
}

function collapseFreshGrammarDetails(){
  document.querySelectorAll('#gfTeacherDrawerBody .gf-detail-module[open]')
    .forEach(detail=>detail.removeAttribute('open'));
  setRevision();
}

function installGrammarCollapseWatcher(){
  if(window.__gfTeacherDefaultCollapseInstalled)return;
  window.__gfTeacherDefaultCollapseInstalled=true;

  const start=()=>{
    collapseFreshGrammarDetails();
    const observer=new MutationObserver(mutations=>{
      if(mutations.some(m=>m.type==='childList'&&m.addedNodes.length)){
        collapseFreshGrammarDetails();
      }
    });
    observer.observe(document.body,{childList:true,subtree:true});
  };

  if(document.body)start();
  else document.addEventListener('DOMContentLoaded',start,{once:true});
}

function loadGrammarFoundationsTeacher(){
  if(document.getElementById('grammarFoundationsTeacherScript'))return;
  const script=document.createElement('script');
  script.id='grammarFoundationsTeacherScript';
  script.src='./grammar-foundations-teacher.js?v=1.1.1';
  script.defer=true;
  script.addEventListener('load',collapseFreshGrammarDetails,{once:true});
  document.head.appendChild(script);
}

installGrammarCollapseWatcher();
loadGrammarFoundationsTeacher();
setRevision();
})();
