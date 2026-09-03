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
function addCrashFixBadge(){
 const old=document.getElementById('tp-crash-fix-rev2');if(old)old.remove();
 if(document.getElementById('tp-crash-fix-rev3'))return;
 const badge=document.createElement('div');
 badge.id='tp-crash-fix-rev3';
 badge.textContent='Rev3';
 badge.setAttribute('aria-label','Rev3 active');
 Object.assign(badge.style,{
   position:'fixed',right:'8px',bottom:'8px',zIndex:'2147483647',padding:'4px 8px',
   borderRadius:'999px',background:'rgba(20,20,24,.82)',color:'#fff',
   font:'600 11px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
   letterSpacing:'.01em',boxShadow:'0 2px 8px rgba(0,0,0,.18)',pointerEvents:'none',opacity:'.88'
 });
 document.body.appendChild(badge);
}
function boot(){
 addCrashFixBadge();
 let tries=0;
 const timer=setInterval(()=>{if(install()||++tries>200)clearInterval(timer)},25);
 window.addEventListener('testprep:student-state-refresh',()=>queueMicrotask(sync));
 window.addEventListener('testprep:tracking',()=>queueMicrotask(sync));
 window.addEventListener('popstate',()=>setTimeout(sync,0));
 // Rev3 baseline: global body MutationObserver remains disabled.
 sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();