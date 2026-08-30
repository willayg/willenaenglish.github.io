(function(){
'use strict';
let patched=false;
function patch(){
 if(patched)return true;
 const auth=window.WillenaTestPrepAuth;
 if(!auth||typeof auth.recordAttempt!=='function'||typeof auth.completeSession!=='function')return false;
 const originalRecord=auth.recordAttempt.bind(auth);
 const originalComplete=auth.completeSession.bind(auth);
 let pending=[];
 function track(p){
  const wrapped=Promise.resolve(p).catch(e=>{console.warn('[test-prep] seosul save failed',e);return null}).finally(()=>{pending=pending.filter(x=>x!==wrapped)});
  pending.push(wrapped);
  return wrapped;
 }
 auth.recordAttempt=function(payload){
  if(String(payload?.practice_type||'').toLowerCase()==='constructed_response'){
   // Keep the UI responsive, but retain the real save promise so session completion
   // cannot close the session before authored written-response attempts are stored.
   return track(originalRecord(payload));
  }
  return originalRecord(payload);
 };
 auth.completeSession=async function(correctCount,questionCount,wrongIds){
  if(pending.length)await Promise.allSettled([...pending]);
  return originalComplete(correctCount,questionCount,wrongIds);
 };
 patched=true;
 return true;
}
function boot(){let n=0;const t=setInterval(()=>{if(patch()||++n>160)clearInterval(t)},50)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();