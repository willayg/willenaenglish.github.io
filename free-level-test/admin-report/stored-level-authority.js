(function(){
'use strict';
const ENDPOINT='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/prospective-level-test';
const params=new URLSearchParams(location.search);
const attemptId=params.get('attempt_id')||'';
const token=params.get('report_token')||params.get('session_token')||'';
let internalLevel=0;
const clamp=value=>Math.max(1,Math.min(12,Number(value)||1));
const publicNumber=internal=>internal<=2?internal:internal-2;

function correctMainReport(){
  if(!internalLevel)return;
  const levelBox=document.querySelector('.report-level');
  if(levelBox){
    const label=levelBox.querySelector('span');
    const number=levelBox.querySelector('strong');
    if(label)label.textContent=document.documentElement.lang==='ko'?(internalLevel<=2?'스타터':'레벨'):(internalLevel<=2?'Starter':'Level');
    if(number)number.textContent=String(publicNumber(internalLevel));
  }
  document.querySelectorAll('.level-node').forEach((node,index)=>{
    node.classList.toggle('is-complete',index+1<internalLevel);
    node.classList.toggle('is-current',index+1===internalLevel);
  });
}

function correctA4Report(){
  if(!internalLevel)return;
  document.querySelectorAll('.a4-level-orbit strong').forEach(el=>el.textContent=String(publicNumber(internalLevel)));
  document.querySelectorAll('.a4-level-orbit span').forEach(el=>{
    el.textContent=document.documentElement.lang==='ko'?(internalLevel<=2?'스타터':'레벨'):(internalLevel<=2?'STARTER':'LEVEL');
  });
}

function correct(){correctMainReport();correctA4Report()}

async function load(){
  if(!attemptId||!token)return;
  const response=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'report',attempt_id:attemptId,session_token:token}),cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.success)return;
  const attempt=data.attempt||{};
  internalLevel=clamp(attempt.recommended_level||attempt.display_level);
  window.WillenaStoredInternalLevel=internalLevel;
  correct();
}

new MutationObserver(()=>queueMicrotask(correct)).observe(document.documentElement,{subtree:true,childList:true});
document.addEventListener('click',event=>{if(event.target.closest('[data-language-choice]'))setTimeout(correct,0)},true);
load().catch(console.warn);
})();