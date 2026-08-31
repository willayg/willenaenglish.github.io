(function(){
'use strict';
const CUSTOM_SECTIONS=new Set(['vocabulary','vocab_test','sentences']);
function syncEngineVisibility(){
  const engine=document.getElementById('engineShell');
  if(!engine)return;
  const selection=window.WillenaAssignedTestPrep?.selection;
  const quiz=document.getElementById('assignedQuizPane');
  const inCustomPractice=!!selection&&CUSTOM_SECTIONS.has(String(selection.section||'').toLowerCase())&&quiz&&quiz.style.display!=='none';
  engine.style.display=inCustomPractice?'none':'';
}
function boot(){
  syncEngineVisibility();
  const quiz=document.getElementById('assignedQuizPane');
  if(quiz)new MutationObserver(syncEngineVisibility).observe(quiz,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
  document.addEventListener('click',()=>setTimeout(syncEngineVisibility,0),true);
  window.addEventListener('popstate',()=>setTimeout(syncEngineVisibility,0));
  setInterval(syncEngineVisibility,400);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
