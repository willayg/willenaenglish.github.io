(function(){
'use strict';
function state(){return history.state?.tp?history.state:{tp:'home'}}
function matches(type,args){
 const s=state();
 if(type==='home')return s.tp==='home';
 if(type==='lesson')return s.tp==='lesson'&&String(s.planId||'')===String(args[0]||'')&&String(s.lesson||'')===String(args[1]||'');
 if(type==='wrong')return s.tp==='wrong';
 return true
}
function enforceVisibility(){
 const s=state(),home=document.getElementById('assignmentHome'),quiz=document.getElementById('assignedQuizPane');
 if(s.tp==='practice'){if(home)home.style.display='none';if(quiz)quiz.style.display='block';return}
 if(s.tp==='wrong'){if(quiz)quiz.style.display='none';if(home)home.style.display='block';return}
}
function install(){
 const ux=window.WillenaTestPrepUX;if(!ux||ux.__navViewGuard48e)return false;
 const wrap=(name,type)=>{const fn=ux[name];if(typeof fn!=='function')return;ux[name]=function(...args){if(!matches(type,args)){enforceVisibility();return}return fn.apply(this,args)}};
 wrap('renderHome','home');wrap('renderLesson','lesson');wrap('showWrongCenter','wrong');
 ux.__navViewGuard48e=true;return true
}
function sync(){install();enforceVisibility()}
function boot(){
 let tries=0;const timer=setInterval(()=>{if(install()||++tries>200)clearInterval(timer)},25);
 window.addEventListener('testprep:student-state-refresh',()=>queueMicrotask(sync));
 window.addEventListener('testprep:tracking',()=>queueMicrotask(sync));
 window.addEventListener('popstate',()=>setTimeout(sync,0));
 sync()
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
console.log('[REV48e] navigation view guard uses home/lesson/wrong only');
})();