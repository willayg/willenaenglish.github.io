(function(){
'use strict';
const clampLevel=value=>Math.max(1,Math.min(12,Number(value)||1));
const publicNumber=internal=>internal<=2?internal:internal-2;
const SKILLS=['vocabulary','grammar','listening','reading','sentence_building'];
let correctionQueued=false;
let lastResultSignature='';
let bankMap=new Map();
let captured=[];
let capturedIds=new Set();

function skillFor(q){
 const type=String(q?.type||'').toLowerCase();
 if(type.includes('vocab')||type.includes('word'))return'vocabulary';
 if(type.includes('listen'))return'listening';
 if(type.includes('read'))return'reading';
 if(type.includes('unscramble')||type.includes('sentence_build'))return'sentence_building';
 return'grammar';
}
function setupStartAbility(){
 const setup=window.WillenaLevelTestContext?.setup||{};
 const matrix={1:{0:1,1:1.5,2:2,4:2.5,6:3},2:{0:1,1:2,2:3,4:4,6:5},4:{0:1.5,1:2.5,2:4,4:5.5,6:6.5},6:{0:2,1:3,2:4.5,4:6,6:7.5},8:{0:2.5,1:3.5,2:5,4:7,6:8.5},9:{0:3,1:4,2:5.5,4:7.5,6:9}};
 const stage=matrix[Number(setup.grade)]||matrix[1];
 return clampLevel(stage[Number(setup.years)]??2);
}
function estimateAbility(rows,fallback){
 if(!rows.length)return clampLevel(fallback||2);
 const prior=clampLevel(fallback||2);
 let best=prior,bestLL=-Infinity;
 for(let t=1;t<=12.001;t+=.05){
  let ll=-.085*Math.pow(t-prior,2);
  rows.forEach(r=>{
   const lvl=clampLevel(r.level),p=Math.max(.025,Math.min(.975,1/(1+Math.exp((lvl-t)*1.25))));
   ll+=r.correct?Math.log(p):Math.log(1-p);
  });
  if(ll>bestLL){bestLL=ll;best=t}
 }
 return Math.max(1,Math.min(12,best));
}
function conservativeOverall(){
 const usable=SKILLS.map(skill=>{
  const rows=captured.filter(r=>r.skill===skill);
  if(rows.length<5)return null;
  const accuracy=rows.filter(r=>r.correct).length/rows.length;
  return{skill,rows,accuracy,score:estimateAbility(rows,setupStartAbility())};
 }).filter(Boolean);
 if(usable.length<5)return 0;
 let scores=usable.map(x=>x.score).sort((a,b)=>a-b);
 const centre=scores[2];
 usable.forEach(x=>{
  if(x.score<=centre+1)return;
  const strongUpper=x.rows.filter(r=>r.level>=Math.ceil(centre+1)&&r.correct).length;
  if(!(x.accuracy>=.70&&strongUpper>=3))x.score=Math.min(x.score,centre+1);
 });
 scores=usable.map(x=>x.score).sort((a,b)=>a-b);
 const middle=scores.slice(1,-1);
 if(!middle.length)return clampLevel(Math.round(scores.reduce((a,b)=>a+b,0)/scores.length));
 return clampLevel(Math.round(middle.reduce((a,b)=>a+b,0)/middle.length));
}
function selectedValue(card,q){
 if(q?.type==='sentence_unscramble')return[...card.querySelectorAll('.scramble-token.chosen')].map(x=>x.textContent.trim());
 const selected=card.querySelector('.choice.selected');
 return selected?selected.getAttribute('data-value'):null;
}
function same(q,a){
 const b=q?.type==='sentence_unscramble'?q.tokens:q?.a;
 const scoring=window.WillenaLevelTestScoring;
 return scoring?scoring.isCorrect(q.type,a,b):JSON.stringify(a)===JSON.stringify(b);
}
function captureCurrent(){
 const card=document.querySelector('#app .question-card');
 if(!card)return;
 const id=String(card.getAttribute('data-question-id')||'');
 if(!id||capturedIds.has(id))return;
 const q=bankMap.get(id);if(!q)return;
 const selected=selectedValue(card,q);if(selected==null)return;
 capturedIds.add(id);
 captured.push({id,level:clampLevel(q.level),skill:skillFor(q),correct:same(q,selected)});
}
function loadBank(){
 const loader=window.loadCompleteQuestionBank||window.loadQuestionBank;
 if(typeof loader!=='function')return;
 Promise.resolve(loader()).then(rows=>{(rows||[]).forEach(q=>bankMap.set(String(q.id),q))}).catch(()=>{});
}

document.addEventListener('click',e=>{
 if(e.target.closest('#next,#finish,#submit,[data-finish-test]'))captureCurrent();
 if(e.target.closest('#retry,#home')){captured=[];capturedIds.clear()}
},true);

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
 let level=extractInternalLevel();
 if(!level)return false;
 const conservative=captured.length>=35?conservativeOverall():0;
 if(conservative)level=Math.min(level,conservative);
 window.WillenaInternalResultLevel=level;
 window.WillenaStoredInternalLevel=level;
 sessionStorage.setItem('willena_internal_result_level',String(level));
 return true;
}
function authoritativeLevel(){
 const value=window.WillenaStoredInternalLevel||window.WillenaInternalResultLevel||sessionStorage.getItem('willena_internal_result_level');
 return value?clampLevel(value):0;
}
function setTextIfChanged(element,value){if(element&&element.textContent!==value)element.textContent=value}
function correctRenderedReport(){
 correctionQueued=false;
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
if(app){new MutationObserver(()=>{if(rememberInternalLevel()||document.querySelector('.report-level'))queueCorrection()}).observe(app,{subtree:true,childList:true})}
new MutationObserver(()=>{lastResultSignature='';queueCorrection()}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
loadBank();rememberInternalLevel();queueCorrection();
})();