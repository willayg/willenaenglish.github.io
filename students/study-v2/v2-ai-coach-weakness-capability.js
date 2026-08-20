(function(global){
'use strict';
var coach=global.WillenaAICoach;
if(!coach||typeof coach.registerCapability!=='function')return;

var evidenceCache={};
var evidencePromise={};

function text(v){return String(v==null?'':v).trim();}
function ko(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function skillNameFor(lang,s){
  var K={vocabulary:'어휘',spelling:'철자',grammar:'문법',sentence_building:'문장 만들기',conversation:'회화',listening:'듣기',reading:'읽기'};
  var E={vocabulary:'vocabulary',spelling:'spelling',grammar:'grammar',sentence_building:'sentence building',conversation:'conversation',listening:'listening',reading:'reading'};
  return (lang==='ko'?K:E)[s]||s;
}
function skillName(s){return skillNameFor(ko()?'ko':'en',s);}
function key(ctx){return String(ctx&&ctx.bookId||'')+'|'+String(ctx&&ctx.unitId||'');}
function rowsFromProgress(progress){
  var rows=Array.isArray(progress&&progress.skill_summary)?progress.skill_summary:(Array.isArray(progress&&progress.unit_skills)?progress.unit_skills:[]);
  return rows.map(function(r){
    return{skill:text(r&&r.skill),pct:Math.max(0,Math.min(100,Number(r&&r.mastery_score)||0))};
  }).filter(function(x){return x.skill;});
}
function fallbackRows(ctx){return rowsFromProgress(ctx&&ctx.book&&ctx.book.progress||{});}
async function loadEvidence(ctx){
  var k=key(ctx);
  if(!ctx||!ctx.bookId||!ctx.unitId)return fallbackRows(ctx);
  if(evidenceCache[k])return evidenceCache[k];
  if(evidencePromise[k])return evidencePromise[k];
  evidencePromise[k]=(async function(){
    try{
      var fn=global.WillenaAPI&&typeof global.WillenaAPI.fetch==='function'?global.WillenaAPI.fetch.bind(global.WillenaAPI):fetch;
      var url='/.netlify/functions/progress_summary?section=study_progress&_='+Date.now()+'&book_id='+encodeURIComponent(ctx.bookId)+'&unit_id='+encodeURIComponent(ctx.unitId);
      var r=await fn(url,{credentials:'include',cache:'no-store'});
      var d=await r.json().catch(function(){return{};});
      if(!r.ok||(d&&d.success===false))throw new Error(d&&d.error||('Progress '+r.status));
      var rows=rowsFromProgress(d);
      evidenceCache[k]=rows;
      return rows;
    }catch(e){
      console.warn('[AI Coach weakness evidence]',e);
      var rows=fallbackRows(ctx);
      evidenceCache[k]=rows;
      return rows;
    }finally{
      delete evidencePromise[k];
    }
  })();
  return evidencePromise[k];
}
function currentRows(ctx){return evidenceCache[key(ctx)]||fallbackRows(ctx);}
function weakestFrom(rows){
  return (Array.isArray(rows)?rows:[]).filter(function(x){return x.pct>0;}).sort(function(a,b){return (a.pct-b.pct)||a.skill.localeCompare(b.skill);})[0]||null;
}
function weakest(ctx){return weakestFrom(currentRows(ctx));}

coach.registerCapability({
  id:'weakness',
  available:async function(ctx){return !!weakestFrom(await loadEvidence(ctx));},
  score:async function(ctx){var x=weakestFrom(await loadEvidence(ctx));return x?Math.max(70,120-x.pct)+0.01:0;},
  label:function(ctx){var x=weakest(ctx);return x?{ko:skillNameFor('ko',x.skill)+'을 더 연습할래요',en:'More '+skillNameFor('en',x.skill)+' practice'}:{ko:'약한 부분 연습',en:'Practice a weak area'};},
  response:function(ctx){var x=weakest(ctx);return x?(ko()?skillName(x.skill)+'이 지금 가장 먼저 챙기기 좋은 영역이에요.':'Your '+skillName(x.skill)+' looks like the best place to focus right now.'):'';},
  actions:function(ctx){var x=weakest(ctx);return x?[{label:{ko:skillNameFor('ko',x.skill)+' 집중 연습',en:'Focus on '+skillNameFor('en',x.skill)},provider:'unit',args:{skill:x.skill,count:10}}]:[];}
});

global.addEventListener('willena:study-progress-updated',function(){evidenceCache={};evidencePromise={};});
})(window);
