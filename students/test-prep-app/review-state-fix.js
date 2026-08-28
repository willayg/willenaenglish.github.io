(function(){
'use strict';
let queued=false;
function sync(){
  queued=false;
  const home=document.getElementById('assignmentHome');
  const quiz=document.getElementById('assignedQuizPane');
  if(!home||!quiz)return;
  const wrongCenterVisible=home.style.display!=='none'&&!!home.querySelector('.tp-wrong-page-head');
  if(wrongCenterVisible){
    quiz.style.display='none';
    if(history.state?.tp!=='wrong'){
      history.replaceState({...history.state,tp:'wrong',review:true,returnTo:null},'',location.href);
    }
  }
  const sel=window.WillenaAssignedTestPrep?.selection;
  if(sel?.reviewMode&&quiz.style.display!=='none')home.style.display='none';
}
function schedule(){
  if(queued)return;
  queued=true;
  queueMicrotask(sync);
}
function boot(){
  const app=document.querySelector('.app')||document.body;
  new MutationObserver(schedule).observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});
  window.addEventListener('testprep:review-group-complete',()=>{
    schedule();
    setTimeout(sync,0);
    setTimeout(sync,120);
    setTimeout(sync,400);
  });
  window.addEventListener('popstate',()=>setTimeout(sync,0));
  schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();