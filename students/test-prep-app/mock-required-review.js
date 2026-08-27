(function(){
'use strict';
let correction=false,wrapped=false;
function wrapTracking(){
 if(wrapped)return;
 const auth=window.WillenaTestPrepAuth;
 if(!auth?.recordAttempt)return;
 const original=auth.recordAttempt.bind(auth);
 auth.recordAttempt=function(payload){
   if(correction&&payload?.metadata){
     payload={...payload,metadata:{...payload.metadata,mock_test:false,mock_correction:true}};
   }
   return original(payload);
 };
 wrapped=true;
}
function wrongCount(result){
 const p=[...result.querySelectorAll('p')].find(x=>/오답\s*\d+개/.test(x.textContent||''));
 const m=p?.textContent?.match(/오답\s*(\d+)개/);
 return m?Number(m[1]):0;
}
function enforce(){
 wrapTracking();
 document.querySelectorAll('.result').forEach(result=>{
   const lessonRetry=result.querySelector('#mockWrong');
   const allRetry=result.querySelector('#mockAllWrong');
   const retry=lessonRetry||allRetry;
   const done=result.querySelector('#mockDone,#mockAllDone');
   const wrong=wrongCount(result);
   if(wrong>0&&retry){
     if(done)done.style.display='none';
     retry.textContent=correction?'틀린 문제 다시 풀기':'오답 복습 시작';
     if(!result.querySelector('.mock-review-required-note')){
       const note=document.createElement('p');
       note.className='mock-review-required-note';
       note.textContent='틀린 문제를 모두 맞힐 때까지 다시 풀어야 해요.';
       note.style.cssText='margin:8px 0 2px;color:#6f7f86;font-size:11px;font-weight:700';
       const actions=retry.closest('.mock-result-actions,.mock-all-actions');
       actions?.parentNode?.insertBefore(note,actions);
     }
     if(!retry.dataset.requiredReview){
       retry.dataset.requiredReview='1';
       retry.addEventListener('click',()=>{correction=true;},true);
     }
   }else if(wrong===0&&done){
     correction=false;
     if(result.querySelector('.mock-percent')){
       const h=result.querySelector('h2');
       if(h&&/모의고사 완료/.test(h.textContent||''))h.textContent='오답 복습 완료';
       const p=result.querySelector('p');
       if(p&&/오답\s*0개/.test(p.textContent||''))p.textContent='틀렸던 문제를 모두 맞혔어요.';
     }
   }
 });
}
function boot(){
 wrapTracking();
 enforce();
 new MutationObserver(enforce).observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
