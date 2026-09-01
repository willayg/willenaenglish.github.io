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
    const nextLabel=document.documentElement.lang==='ko'?(internalLevel<=2?'스타터':'레벨'):(internalLevel<=2?'Starter':'Level');
    const nextNumber=String(publicNumber(internalLevel));
    if(label&&label.textContent!==nextLabel)label.textContent=nextLabel;
    if(number&&number.textContent!==nextNumber)number.textContent=nextNumber;
  }
}

function correctA4Report(){
  if(!internalLevel)return;
  document.querySelectorAll('.a4-level-orbit strong').forEach(el=>{
    const value=String(publicNumber(internalLevel));
    if(el.textContent!==value)el.textContent=value;
  });
  document.querySelectorAll('.a4-level-orbit span').forEach(el=>{
    const value=document.documentElement.lang==='ko'?(internalLevel<=2?'스타터':'레벨'):(internalLevel<=2?'STARTER':'LEVEL');
    if(el.textContent!==value)el.textContent=value;
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
  window.dispatchEvent(new CustomEvent('willena:stored-level-ready',{detail:{internalLevel}}));
}

document.addEventListener('click',event=>{if(event.target.closest('[data-language-choice]'))setTimeout(correct,0)},true);
load().catch(console.warn);
})();