(function(){
'use strict';
const STYLE_ID='tpPracticeLayoutCleanupStyle';
function addStyle(){
 if(document.getElementById(STYLE_ID))return;
 const s=document.createElement('style');
 s.id=STYLE_ID;
 s.textContent=`
 body.tp-practice-active:not(.tp-exam46-mode) #assignedBackRow{display:none!important}
 body.tp-practice-active .app{padding-top:0!important}
 body.tp-practice-active .tp-header-curve{height:52px!important;bottom:-26px!important}
 body.tp-practice-active #assignedQuizPane{margin-top:0!important;padding-top:0!important}
 @media (max-width:699px){
  body.tp-practice-active .tp-header-curve{height:42px!important;bottom:-20px!important}
 }
 `;
 document.head.appendChild(s);
}
function sync(){
 const quiz=document.getElementById('assignedQuizPane');
 const active=!!quiz&&quiz.style.display!=='none';
 const exam=!!document.querySelector('.app.tp-exam46-active');
 document.body.classList.toggle('tp-practice-active',active);
 document.body.classList.toggle('tp-exam46-mode',active&&exam);
}
function boot(){
 addStyle();
 sync();
 const quiz=document.getElementById('assignedQuizPane');
 if(quiz)new MutationObserver(sync).observe(quiz,{attributes:true,attributeFilter:['style']});
 const app=document.querySelector('.app');
 if(app)new MutationObserver(sync).observe(app,{attributes:true,attributeFilter:['class']});
 for(const e of ['exam46:start','exam46:answer','exam46:complete','exam46:correction-start','exam46:correction-round','exam46:correction-complete'])window.addEventListener(e,()=>setTimeout(sync,0));
 window.addEventListener('popstate',()=>setTimeout(sync,0));
 document.addEventListener('click',()=>setTimeout(sync,0),true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
