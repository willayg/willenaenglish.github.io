(function(){
'use strict';
const IS_STAGING=/^staging\./i.test(location.hostname)||['localhost','127.0.0.1'].includes(location.hostname);
if(!IS_STAGING)return;
let pending=false;
let pendingAt=0;
function currentTestButton(){return document.querySelector('#tp48Test')}
function restoreButton(){const b=currentTestButton();if(b){b.textContent='TEST · 이 문제 정답 처리 ✓';b.disabled=false}}
function fallbackAdvance(){
 let tries=0;
 const tick=()=>{
  if(!pending)return;
  const check=document.querySelector('#tp48Check');
  if(check&&/다음 문제|복습 끝내기/.test(String(check.textContent||''))&&!check.disabled){
   pending=false;
   check.click();
   return;
  }
  // If REV48 already rendered the next question, the fallback is no longer needed.
  if(check&&/정답 확인/.test(String(check.textContent||''))){pending=false;return}
  if(++tries<16)setTimeout(tick,60);else{pending=false;restoreButton()}
 };
 setTimeout(tick,320);
}
document.addEventListener('click',e=>{
 const target=e.target instanceof Element?e.target.closest('#tp48Test'):null;
 if(!target)return;
 pending=true;pendingAt=Date.now();
 target.textContent='TEST · 정답 처리 중...';
},true);
window.addEventListener('testprep:tracking',e=>{
 if(!pending)return;
 const d=e.detail||{},m=d.metadata||{};
 if(d.type==='attempt_error'){
  pending=false;restoreButton();return;
 }
 if(d.type!=='attempt_saved'||m.review_runner!=='v48'||m.staging_auto_correct!==true)return;
 fallbackAdvance();
});
console.log('[REV48d] staging mark-correct transition guard active');
})();