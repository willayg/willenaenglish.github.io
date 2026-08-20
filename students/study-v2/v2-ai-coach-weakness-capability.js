(function(global){
'use strict';
var coach=global.WillenaAICoach;
if(!coach||typeof coach.registerCapability!=='function')return;

function text(v){return String(v==null?'':v).trim();}
function ko(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function skillNameFor(lang,s){
  var K={vocabulary:'어휘',spelling:'철자',grammar:'문법',sentence_building:'문장 만들기',conversation:'회화',listening:'듣기',reading:'읽기'};
  var E={vocabulary:'vocabulary',spelling:'spelling',grammar:'grammar',sentence_building:'sentence building',conversation:'conversation',listening:'listening',reading:'reading'};
  return (lang==='ko'?K:E)[s]||s;
}
function skillName(s){return skillNameFor(ko()?'ko':'en',s);}
function mastery(ctx){
  var progress=ctx&&ctx.book&&ctx.book.progress||{};
  var rows=Array.isArray(progress.skill_summary)?progress.skill_summary:(Array.isArray(progress.unit_skills)?progress.unit_skills:[]);
  return rows.map(function(r){
    return{skill:text(r&&r.skill),pct:Math.max(0,Math.min(100,Number(r&&r.mastery_score)||0))};
  }).filter(function(x){return x.skill;});
}
function weakest(ctx){
  return mastery(ctx).filter(function(x){return x.pct>0;}).sort(function(a,b){return (a.pct-b.pct)||a.skill.localeCompare(b.skill);})[0]||null;
}

coach.registerCapability({
  id:'weakness',
  score:function(ctx){var x=weakest(ctx);return x?Math.max(70,120-x.pct)+0.01:0;},
  available:function(ctx){return !!weakest(ctx);},
  label:function(ctx){var x=weakest(ctx);return x?{ko:skillNameFor('ko',x.skill)+'을 더 연습할래요',en:'More '+skillNameFor('en',x.skill)+' practice'}:{ko:'약한 부분 연습',en:'Practice a weak area'};},
  response:function(ctx){var x=weakest(ctx);return x?(ko()?skillName(x.skill)+'이 지금 가장 먼저 챙기기 좋은 영역이에요.':'Your '+skillName(x.skill)+' looks like the best place to focus right now.'):'';},
  actions:function(ctx){var x=weakest(ctx);return x?[{label:{ko:skillNameFor('ko',x.skill)+' 집중 연습',en:'Focus on '+skillNameFor('en',x.skill)},provider:'unit',args:{skill:x.skill,count:10}}]:[];}
});
})(window);
