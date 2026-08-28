(function(){
'use strict';
let correction=false,wrapped=false;
function finishAnimation(result){
 if(result.querySelector('.mock-finish-animation'))return;
 const a=document.createElement('div');
 a.className='mock-finish-animation';
 a.setAttribute('aria-hidden','true');
 a.innerHTML='<span class="mock-finish-ring"></span><span class="mock-finish-ring r2"></span><span class="mock-finish-check"></span><span class="mock-finish-spark"></span><span class="mock-finish-spark"></span><span class="mock-finish-spark"></span><span class="mock-finish-spark"></span><span class="mock-finish-spark"></span><span class="mock-finish-spark"></span><span class="mock-finish-spark"></span><span class="mock-finish-spark"></span>';
 const score=result.querySelector('.score');
 result.insertBefore(a,score||result.firstChild);
}
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
function autoLeave(result){
 if(result.dataset.autoLeaveScheduled)return;
 result.dataset.autoLeaveScheduled='1';
 setTimeout(()=>{
   const back=document.querySelector('#assignedBackRow .back-assign');
   if(back)back.click();
   else if(history.state?.tp==='practice')history.back();
 },1800);
}
function setTextOnce(el,value){if(el&&el.textContent!==value)el.textContent=value}
function enforce(){
 wrapTracking();
 document.querySelectorAll('.result').forEach(result=>{
   const lessonRetry=result.querySelector('#mockWrong');
   const allRetry=result.querySelector('#mockAllWrong');
   const retry=lessonRetry||allRetry;
   const done=result.querySelector('#mockDone,#mockAllDone');
   if(done&&!done.dataset.removing){done.dataset.removing='1';done.remove()}
   const wrong=wrongCount(result);
   if(wrong>0&&retry){
     const label=correction?'틀린 문제 다시 풀기':'오답 복습 시작';
     setTextOnce(retry,label);
     if(!result.querySelector('.mock-review-required-note')){
       const note=document.createElement('p');
       note.className='mock-review-required-note';
       note.textContent='틀린 문제를 모두 맞힐 때까지 다시 풀어야 해요.';
       const actions=retry.closest('.mock-result-actions,.mock-all-actions');
       actions?.parentNode?.insertBefore(note,actions);
     }
     if(!retry.dataset.requiredReview){
       retry.dataset.requiredReview='1';
       retry.addEventListener('click',()=>{correction=true;},true);
     }
   }else if(wrong===0&&!result.dataset.finishHandled){
     result.dataset.finishHandled='1';
     finishAnimation(result);
     correction=false;
     setTextOnce(result.querySelector('h2'),'모의고사 완료');
     const p=result.querySelector('p');
     if(p&&/오답\s*0개/.test(p.textContent||''))setTextOnce(p,'모든 문제를 정확하게 마쳤어요.');
     autoLeave(result);
   }
 });
}
function boot(){
 wrapTracking();enforce();
 let queued=false;
 const observer=new MutationObserver(()=>{
   if(queued)return;
   queued=true;
   requestAnimationFrame(()=>{queued=false;enforce()});
 });
 observer.observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();