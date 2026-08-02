(function(){
'use strict';
const clampLevel=value=>Math.max(1,Math.min(12,Number(value)||1));
const publicNumber=internal=>internal<=2?internal:internal-2;
let correctionQueued=false;
let lastResultSignature='';

function extractInternalLevel(){
  const screen=document.querySelector('#app .screen');
  if(!screen||!screen.querySelector('.result-title'))return null;
  const candidates=[
    screen.querySelector('[data-internal-level]')?.getAttribute('data-internal-level'),
    screen.querySelector('.result-level')?.textContent,
    screen.querySelector('.result-title')?.textContent
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
  const value=window.WillenaInternalResultLevel||sessionStorage.getItem('willena_internal_result_level');
  return value?clampLevel(value):0;
}

function setTextIfChanged(element,value){
  if(element&&element.textContent!==value)element.textContent=value;
}

function correctRenderedReport(){
  correctionQueued=false;
  const internal=authoritativeLevel();
  if(!internal)return;
  const levelBox=document.querySelector('.report-level');
  if(!levelBox)return;
  const language=document.documentElement.lang==='ko'?'ko':'en';
  const signature=[internal,language].join(':');
  if(signature===lastResultSignature)return;
  lastResultSignature=signature;
  setTextIfChanged(levelBox.querySelector('span'),language==='ko'?(internal<=2?'스타터':'레벨'):(internal<=2?'Starter':'Level'));
  setTextIfChanged(levelBox.querySelector('strong'),String(publicNumber(internal)));
}

function queueCorrection(){
  if(correctionQueued)return;
  correctionQueued=true;
  requestAnimationFrame(correctRenderedReport);
}

const app=document.querySelector('#app');
if(app){
  new MutationObserver(()=>{
    if(rememberInternalLevel()||document.querySelector('.report-level'))queueCorrection();
  }).observe(app,{subtree:true,childList:true});
}
new MutationObserver(()=>{
  lastResultSignature='';
  queueCorrection();
}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});

rememberInternalLevel();
queueCorrection();
})();