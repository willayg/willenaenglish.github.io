(function(){
'use strict';
const clampLevel=value=>Math.max(1,Math.min(12,Number(value)||1));
const publicNumber=internal=>internal<=2?internal:internal-2;
let correctionQueued=false;
let lastResultSignature='';
let canonicalInternalLevel=0;

function context(){return window.WillenaLevelTestContext||{}}
function expectsCanonicalPlacement(){
 const ctx=context(),setup=ctx.setup&&typeof ctx.setup==='object'?ctx.setup:{};
 return ctx.mode==='visitor'&&Number(setup.length)===50;
}
function canonicalPlacement(){
 const recorder=window.WillenaLevelTestRecorder;
 if(!recorder||typeof recorder.calculatePlacement!=='function')return null;
 try{
  const placement=recorder.calculatePlacement();
  return placement&&placement.ready?placement:null;
 }catch(error){
  console.warn('[level-result-consistency] canonical placement unavailable',error);
  return null;
 }
}
function storeInternalLevel(level,placement){
 level=clampLevel(level);
 if(placement)canonicalInternalLevel=level;
 window.WillenaInternalResultLevel=level;
 window.WillenaStoredInternalLevel=level;
 if(placement)window.WillenaCanonicalPlacement=placement;
 try{sessionStorage.setItem('willena_internal_result_level',String(level))}catch(_){}
 return level;
}
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
 const placement=canonicalPlacement();
 if(placement&&Number(placement.final_level)>0){
  storeInternalLevel(placement.final_level,placement);
  return true;
 }
 // The full visitor test has one placement authority: the canonical calculator.
 // Do not replace it with a second estimate while the recorder is still finishing.
 if(expectsCanonicalPlacement())return false;
 const rendered=extractInternalLevel();
 if(!rendered)return false;
 storeInternalLevel(rendered,null);
 return true;
}
function authoritativeLevel(){
 if(expectsCanonicalPlacement())return canonicalInternalLevel;
 const value=window.WillenaStoredInternalLevel||window.WillenaInternalResultLevel||sessionStorage.getItem('willena_internal_result_level');
 return value?clampLevel(value):0;
}
function setTextIfChanged(element,value){if(element&&element.textContent!==value)element.textContent=value}
function correctRenderedReport(){
 correctionQueued=false;
 rememberInternalLevel();
 const internal=authoritativeLevel();if(!internal)return;
 const levelBox=document.querySelector('.report-level');if(!levelBox)return;
 const language=document.documentElement.lang==='ko'?'ko':'en',signature=[internal,language].join(':');
 if(signature===lastResultSignature)return;
 lastResultSignature=signature;
 setTextIfChanged(levelBox.querySelector('span'),language==='ko'?(internal<=2?'스타터':'레벨'):(internal<=2?'Starter':'Level'));
 setTextIfChanged(levelBox.querySelector('strong'),String(publicNumber(internal)));
}
function queueCorrection(){if(correctionQueued)return;correctionQueued=true;requestAnimationFrame(correctRenderedReport)}
const app=document.querySelector('#app');
if(app)new MutationObserver(queueCorrection).observe(app,{subtree:true,childList:true});
new MutationObserver(()=>{lastResultSignature='';queueCorrection()}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
window.addEventListener('willena:recording-finished',()=>{lastResultSignature='';queueCorrection()});
rememberInternalLevel();
queueCorrection();
})();
