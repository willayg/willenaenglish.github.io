(function(){
'use strict';
const ENDPOINT_PART='/functions/v1/prospective-level-test';
const seenAnswers=new Set();
const clampLevel=value=>Math.max(1,Math.min(12,Number(value)||1));
const publicNumber=internal=>internal<=2?internal:internal-2;
const originalFetch=window.fetch.bind(window);
let correctionQueued=false;
let lastResultSignature='';

function extractInternalLevel(){
  const screen=document.querySelector('#app .screen');
  if(!screen||!screen.querySelector('.result-title'))return null;
  const candidates=[
    screen.querySelector('[data-internal-level]')?.getAttribute('data-internal-level'),
    screen.querySelector('.result-level')?.textContent,
    screen.querySelector('.result-title')?.textContent,
    screen.textContent
  ].filter(Boolean);
  for(const value of candidates){
    const match=String(value).match(/(?:internal\s*)?(?:level|레벨|단계)\s*(\d{1,2})/i);
    if(match)return clampLevel(match[1]);
  }
  return null;
}

function rememberInternalLevel(){
  const level=extractInternalLevel();
  if(!level)return false;
  window.WillenaInternalResultLevel=level;
  sessionStorage.setItem('willena_internal_result_level',String(level));
  return true;
}

function authoritativeLevel(){
  return clampLevel(window.WillenaInternalResultLevel||sessionStorage.getItem('willena_internal_result_level')||1);
}

function setTextIfChanged(element,value){
  if(element&&element.textContent!==value)element.textContent=value;
}

function setClassIfChanged(element,name,on){
  if(element&&element.classList.contains(name)!==on)element.classList.toggle(name,on);
}

function correctRenderedReport(){
  correctionQueued=false;
  const internal=authoritativeLevel();
  const levelBox=document.querySelector('.report-level');
  const orbit=document.querySelector('.a4-level-orbit strong');
  if(!levelBox&&!orbit)return;

  const language=document.documentElement.lang==='ko'?'ko':'en';
  const signature=[internal,language,Boolean(levelBox),Boolean(orbit)].join(':');
  if(signature===lastResultSignature)return;
  lastResultSignature=signature;

  if(levelBox){
    const label=levelBox.querySelector('span');
    const number=levelBox.querySelector('strong');
    setTextIfChanged(label,language==='ko'?(internal<=2?'스타터':'레벨'):(internal<=2?'Starter':'Level'));
    setTextIfChanged(number,String(publicNumber(internal)));
  }
  document.querySelectorAll('.level-node').forEach((node,index)=>{
    setClassIfChanged(node,'is-complete',index+1<internal);
    setClassIfChanged(node,'is-current',index+1===internal);
  });
  document.querySelectorAll('.a4-level-orbit strong').forEach(el=>setTextIfChanged(el,String(publicNumber(internal))));
}

function queueCorrection(){
  if(correctionQueued)return;
  correctionQueued=true;
  requestAnimationFrame(correctRenderedReport);
}

window.fetch=async function(input,init){
  let nextInit=init;
  const url=typeof input==='string'?input:input?.url||'';
  if(url.includes(ENDPOINT_PART)&&init?.method?.toUpperCase()==='POST'&&typeof init.body==='string'){
    try{
      const body=JSON.parse(init.body);
      if(body.action==='answer'){
        const key=[body.attempt_id,body.assessment_item_id].join(':');
        if(seenAnswers.has(key))return new Response(JSON.stringify({success:true,duplicate_ignored:true}),{status:200,headers:{'content-type':'application/json'}});
        seenAnswers.add(key);
      }
      if(body.action==='finish'){
        const internal=authoritativeLevel();
        const unique=[];
        const ids=new Set();
        for(const row of Array.isArray(body.answers)?body.answers:[]){
          const key=String(row.assessment_item_id||row.assessment_source_key||row.answer_index);
          if(ids.has(key))continue;
          ids.add(key);
          unique.push({...row,answer_index:unique.length+1});
        }
        body.answers=unique;
        body.recommended_level=internal;
        body.display_level=internal;
        nextInit={...init,body:JSON.stringify(body)};
      }
    }catch(_){ }
  }
  return originalFetch(input,nextInit);
};

const app=document.querySelector('#app');
if(app){
  new MutationObserver(()=>{
    const hasResult=rememberInternalLevel();
    if(hasResult||document.querySelector('.report-level,.a4-level-orbit'))queueCorrection();
  }).observe(app,{subtree:true,childList:true});
}
new MutationObserver(()=>{
  lastResultSignature='';
  queueCorrection();
}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});

rememberInternalLevel();
queueCorrection();
})();