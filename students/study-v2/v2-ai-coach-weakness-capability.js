(function(global){
'use strict';
var coach=global.WillenaAICoach;
if(!coach||typeof coach.registerCapability!=='function')return;

function text(v){return String(v==null?'':v).trim();}
function ko(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function skillName(s){
  var K={vocabulary:'어휘',spelling:'철자',grammar:'문법',sentence_building:'문장 만들기',conversation:'회화',listening:'듣기',reading:'읽기'};
  var E={vocabulary:'vocabulary',spelling:'spelling',grammar:'grammar',sentence_building:'sentence building',conversation:'conversation',listening:'listening',reading:'reading'};
  return (ko()?K:E)[s]||s;
}
function mastery(){
  return Array.prototype.slice.call(document.querySelectorAll('#masteryGrid [data-skill]')).map(function(card){
    var raw=text(card.querySelector('.header-skill-master-pct')&&card.querySelector('.header-skill-master-pct').textContent);
    return{skill:text(card.dataset.skill),pct:Number(raw.replace(/[^0-9.]/g,''))||0};
  }).filter(function(x){return x.skill;});
}
function weakest(){
  return mastery().filter(function(x){return x.pct>0;}).sort(function(a,b){return a.pct-b.pct;})[0]||null;
}
function register(){
  var w=weakest();
  coach.registerCapability({
    id:'weakness',
    score:function(){var x=weakest();return x?Math.max(70,120-x.pct):0;},
    available:function(){return !!weakest();},
    label:w?{ko:(skillNameFor('ko',w.skill)+'을 더 연습할래요'),en:('More '+skillNameFor('en',w.skill)+' practice')}:{ko:'약한 부분 연습',en:'Practice a weak area'},
    response:function(){var x=weakest();return x?(ko()?skillName(x.skill)+'이 지금 가장 먼저 챙기기 좋은 영역이에요.':'Your '+skillName(x.skill)+' looks like the best place to focus right now.'):'';},
    actions:function(){var x=weakest();return x?[{label:{ko:skillNameFor('ko',x.skill)+' 집중 연습',en:'Focus on '+skillNameFor('en',x.skill)},provider:'unit',args:{skill:x.skill,count:10}}]:[];}
  });
}
function skillNameFor(lang,s){
  var K={vocabulary:'어휘',spelling:'철자',grammar:'문법',sentence_building:'문장 만들기',conversation:'회화',listening:'듣기',reading:'읽기'};
  var E={vocabulary:'vocabulary',spelling:'spelling',grammar:'grammar',sentence_building:'sentence building',conversation:'conversation',listening:'listening',reading:'reading'};
  return (lang==='ko'?K:E)[s]||s;
}

var style=document.createElement('style');
style.textContent='#aiCoachChoices .study-v2-ai-prompt:empty{display:none!important;}';
document.head.appendChild(style);
register();
coach.refresh();
global.addEventListener('willena:study-recording',function(){setTimeout(function(){register();coach.refresh();},220);});
})(window);
