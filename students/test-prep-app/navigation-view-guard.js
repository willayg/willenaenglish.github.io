(function(){
'use strict';
function matches(type,args){
 const s=history.state||{tp:'home'};
 if(type==='home')return s.tp==='home';
 if(type==='lesson')return s.tp==='lesson'&&String(s.planId||'')===String(args[0]||'')&&String(s.lesson||'')===String(args[1]||'');
 if(type==='wrong')return s.tp==='wrong';
 return true;
}
function hideHomeDuringPractice(){
 const s=history.state||{};
 if(s.tp!=='practice')return;
 const home=document.getElementById('assignmentHome'),quiz=document.getElementById('assignedQuizPane');
 if(home)home.style.display='none';
 if(quiz)quiz.style.display='block';
}
function install(){
 const ux=window.WillenaTestPrepUX;
 if(!ux||ux.__navViewGuardInstalled)return false;
 const wrap=(name,type)=>{
   const fn=ux[name];
   if(typeof fn!=='function')return;
   ux[name]=function(...args){if(!matches(type,args)){hideHomeDuringPractice();return}return fn.apply(this,args)};
 };
 wrap('renderHome','home');
 wrap('renderLesson','lesson');
 wrap('showWrongCenter','wrong');
 ux.__navViewGuardInstalled=true;
 return true;
}
function sync(){
 install();
 hideHomeDuringPractice();
}
function boot(){
 let tries=0;
 const timer=setInterval(()=>{if(install()||++tries>200)clearInterval(timer)},25);
 window.addEventListener('testprep:student-state-refresh',()=>queueMicrotask(sync));
 window.addEventListener('testprep:tracking',()=>queueMicrotask(sync));
 window.addEventListener('popstate',()=>setTimeout(sync,0));
 new MutationObserver(muts=>{if(muts.some(m=>m.type==='attributes'||[...m.addedNodes].some(n=>n.nodeType===1)))queueMicrotask(sync)}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});
 sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();