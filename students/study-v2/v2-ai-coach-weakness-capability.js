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
function history(){var h=global.WillenaCoachHistory;return h&&typeof h.getSnapshot==='function'?h.getSnapshot():null;}
function rows(){
  var h=history(),current=h&&h.currentUnit&&h.currentUnit.skillMastery;
  if(Array.isArray(current)&&current.length)return current.map(function(x){return{skill:text(x.skill),pct:Math.max(0,Math.min(100,Number(x.mastery)||0))};});
  var overall=h&&h.skillMastery;
  return (Array.isArray(overall)?overall:[]).map(function(x){return{skill:text(x.skill),pct:Math.max(0,Math.min(100,Number(x.mastery)||0))};});
}
function weakest(){return rows().filter(function(x){return x.skill&&x.pct>0;}).sort(function(a,b){return(a.pct-b.pct)||a.skill.localeCompare(b.skill);})[0]||null;}

coach.registerCapability({
  id:'weakness',
  available:function(){return !!weakest();},
  score:function(){var x=weakest();return x?Math.max(70,120-x.pct)+0.01:0;},
  label:function(){var x=weakest();return x?{ko:skillNameFor('ko',x.skill)+'을 더 연습할래요',en:'More '+skillNameFor('en',x.skill)+' practice'}:{ko:'약한 부분 연습',en:'Practice a weak area'};},
  response:function(){var x=weakest();return x?(ko()?skillName(x.skill)+'이 지금 가장 먼저 챙기기 좋은 영역이에요.':'Your '+skillName(x.skill)+' looks like the best place to focus right now.'):'';},
  actions:function(){var x=weakest();return x?[{label:{ko:skillNameFor('ko',x.skill)+' 집중 연습',en:'Focus on '+skillNameFor('en',x.skill)},provider:'unit',args:{skill:x.skill,count:10}}]:[];}
});
})(window);
