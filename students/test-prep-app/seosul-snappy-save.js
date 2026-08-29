(function(){
'use strict';
let patched=false;
function patch(){
 if(patched)return true;
 const auth=window.WillenaTestPrepAuth;
 if(!auth||typeof auth.recordAttempt!=='function')return false;
 const original=auth.recordAttempt.bind(auth);
 auth.recordAttempt=function(payload){
  if(String(payload?.practice_type||'').toLowerCase()==='constructed_response'){
   // Generated written-response grading is local. Persist tracking in the background
   // so network latency never delays correct/wrong feedback or the next action.
   Promise.resolve().then(()=>original(payload)).catch(()=>null);
   return Promise.resolve({queued:true});
  }
  return original(payload);
 };
 patched=true;
 return true;
}
function boot(){let n=0;const t=setInterval(()=>{if(patch()||++n>160)clearInterval(t)},50)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();