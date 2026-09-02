(function(){
'use strict';
let absorbing=false;
function absorbUnlockModal(){
  if(absorbing)return;
  const result=document.querySelector('#testPrepVocabPractice .vp-result');
  const bg=document.querySelector('.tp-vocab-unlock-bg');
  if(!result||!bg)return;
  const modalBtn=bg.querySelector('.tp-vocab-unlock button');
  const resultBtn=result.querySelector('#vpAgain');
  if(!modalBtn||!resultBtn)return;
  absorbing=true;
  const action=modalBtn.onclick;
  const label=(modalBtn.textContent||'계속').trim();
  resultBtn.disabled=false;
  resultBtn.textContent=label;
  resultBtn.onclick=e=>{
    e.preventDefault();
    if(typeof action==='function')action.call(modalBtn,e);
    else modalBtn.click();
  };
  bg.remove();
  absorbing=false;
}
function keepResultVisible(){
  const questionResult=document.querySelector('#card .result,#card .tp-review-result');
  if(questionResult){
    const quiz=document.getElementById('assignedQuizPane');
    const home=document.getElementById('assignmentHome');
    const shell=document.getElementById('engineShell');
    if(quiz)quiz.style.display='block';
    if(home)home.style.display='none';
    if(shell)shell.style.display='block';
  }
  absorbUnlockModal();
}
function boot(){
  new MutationObserver(()=>queueMicrotask(keepResultVisible)).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
  window.addEventListener('testprep:vocab-stage-finished',()=>{
    requestAnimationFrame(keepResultVisible);
    setTimeout(keepResultVisible,50);
    setTimeout(keepResultVisible,250);
    setTimeout(keepResultVisible,800);
  },true);
  keepResultVisible();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
