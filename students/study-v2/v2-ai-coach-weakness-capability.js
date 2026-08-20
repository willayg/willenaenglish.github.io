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
function weakSkills(){
  var ranked=rows().filter(function(x){return x.skill&&x.pct>0&&x.pct<80;}).sort(function(a,b){return(a.pct-b.pct)||a.skill.localeCompare(b.skill);});
  if(ranked.length)return ranked.slice(0,3);
  var fallback=rows().filter(function(x){return x.skill&&x.pct>0;}).sort(function(a,b){return(a.pct-b.pct)||a.skill.localeCompare(b.skill);});
  return fallback.length&&fallback[0].pct<90?[fallback[0]]:[];
}
function names(xs,lang){return xs.map(function(x){return skillNameFor(lang,x.skill);});}
function joinNames(xs,lang){
  var ns=names(xs,lang);
  if(ns.length<=1)return ns[0]||'';
  if(lang==='ko')return ns.join(' · ');
  if(ns.length===2)return ns[0]+' and '+ns[1];
  return ns[0]+', '+ns[1]+' and '+ns[2];
}

coach.registerCapability({
  id:'weakness',
  available:function(){return weakSkills().length>0;},
  score:function(){var xs=weakSkills(),x=xs[0];return x?Math.max(70,120-x.pct)+Math.min(2,xs.length)*0.01:0;},
  label:function(){
    var xs=weakSkills();
    if(!xs.length)return{ko:'약한 부분 연습',en:'Practice weak areas'};
    if(xs.length===1)return{ko:skillNameFor('ko',xs[0].skill)+'을 더 연습할래요',en:'More '+skillNameFor('en',xs[0].skill)+' practice'};
    return{ko:'약한 영역 '+xs.length+'개 연습하기',en:'Practice '+xs.length+' weak areas'};
  },
  response:function(){
    var xs=weakSkills();
    if(!xs.length)return'';
    if(xs.length===1)return ko()?skillName(xs[0].skill)+'이 지금 가장 먼저 챙기기 좋은 영역이에요.':'Your '+skillName(xs[0].skill)+' looks like the best place to focus right now.';
    return ko()?joinNames(xs,'ko')+'에서 도움이 될 만한 부분을 찾았어요. 하나를 골라 연습해 볼까요?':'I found useful practice in '+joinNames(xs,'en')+'. Pick the one you want to work on.';
  },
  actions:function(){
    return weakSkills().map(function(x){return{label:{ko:skillNameFor('ko',x.skill)+' 집중 연습',en:'Focus on '+skillNameFor('en',x.skill)},provider:'unit',args:{skill:x.skill,count:10}};});
  }
});
})(window);
