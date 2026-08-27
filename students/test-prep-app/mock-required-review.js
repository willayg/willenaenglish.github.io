(function(){
'use strict';
let correction=false,wrapped=false;
function addStyles(){
 if(document.getElementById('mockReviewFinishStyles'))return;
 const s=document.createElement('style');
 s.id='mockReviewFinishStyles';
 s.textContent=`
 .mock-finish-animation{position:relative;width:112px;height:112px;margin:2px auto 14px;display:grid;place-items:center;overflow:visible}
 .mock-finish-ring{position:absolute;inset:16px;border:3px solid #67d4da;border-radius:50%;animation:mockRing .7s cubic-bezier(.2,.8,.2,1) both}
 .mock-finish-ring.r2{inset:5px;border-width:2px;opacity:.35;animation-delay:.08s}
 .mock-finish-check{position:relative;width:58px;height:58px;border-radius:50%;background:#07888d;transform:scale(0);animation:mockPop .45s cubic-bezier(.2,1.25,.3,1) .14s forwards}
 .mock-finish-check:after{content:'';position:absolute;left:16px;top:14px;width:20px;height:11px;border-left:5px solid #fff;border-bottom:5px solid #fff;transform:rotate(-45deg) scale(0);transform-origin:center;animation:mockCheck .3s ease .42s forwards}
 .mock-finish-spark{position:absolute;width:5px;height:17px;border-radius:99px;background:#67d4da;left:53px;top:2px;transform-origin:3px 54px;opacity:0;animation:mockSpark .65s ease .24s forwards}
 .mock-finish-spark:nth-child(5){transform:rotate(45deg);background:#ee5f91}.mock-finish-spark:nth-child(6){transform:rotate(90deg)}.mock-finish-spark:nth-child(7){transform:rotate(135deg);background:#ee5f91}.mock-finish-spark:nth-child(8){transform:rotate(180deg)}.mock-finish-spark:nth-child(9){transform:rotate(225deg);background:#ee5f91}.mock-finish-spark:nth-child(10){transform:rotate(270deg)}.mock-finish-spark:nth-child(11){transform:rotate(315deg);background:#ee5f91}
 @keyframes mockPop{to{transform:scale(1)}}@keyframes mockCheck{to{transform:rotate(-45deg) scale(1)}}@keyframes mockRing{0%{transform:scale(.45);opacity:0}55%{opacity:1}100%{transform:scale(1);opacity:.8}}@keyframes mockSpark{0%{opacity:0;translate:0 0}35%{opacity:1}100%{opacity:0;translate:0 -18px}}
 @media (prefers-reduced-motion:reduce){.mock-finish-ring,.mock-finish-check,.mock-finish-check:after,.mock-finish-spark{animation:none!important}.mock-finish-check{transform:scale(1)}.mock-finish-check:after{transform:rotate(-45deg) scale(1)}}`;
 document.head.appendChild(s);
}
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
function enforce(){
 addStyles();wrapTracking();
 document.querySelectorAll('.result').forEach(result=>{
   const lessonRetry=result.querySelector('#mockWrong');
   const allRetry=result.querySelector('#mockAllWrong');
   const retry=lessonRetry||allRetry;
   const done=result.querySelector('#mockDone,#mockAllDone');
   if(done)done.remove();
   const wrong=wrongCount(result);
   if(wrong>0&&retry){
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
   }else if(wrong===0){
     finishAnimation(result);
     correction=false;
     const h=result.querySelector('h2');
     if(h)h.textContent='모의고사 완료';
     const p=result.querySelector('p');
     if(p&&/오답\s*0개/.test(p.textContent||''))p.textContent='모든 문제를 정확하게 마쳤어요.';
     autoLeave(result);
   }
 });
}
function boot(){addStyles();wrapTracking();enforce();new MutationObserver(enforce).observe(document.body,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
