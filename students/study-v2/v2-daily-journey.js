(function(){
'use strict';
var TARGET=20,SEGMENTS=5,PER_SEGMENT=TARGET/SEGMENTS;
var card=document.getElementById('dailyWorkoutCard');
var pct=document.getElementById('smartDailyPct');
var top=card&&card.closest('.study-v2-top-actions');
if(!card||!pct||!top)return;

var today=document.createElement('span');
today.className='daily-rail-today';
today.textContent='TODAY';
card.appendChild(today);

var main=document.createElement('div');
main.className='daily-rail-main';
main.setAttribute('aria-live','polite');
main.innerHTML='<strong class="daily-rail-headline"></strong><p class="daily-rail-sub"></p><div class="daily-rail-progress" aria-hidden="true">'+
  '<span class="daily-rail-segment"><i></i></span>'.repeat(SEGMENTS)+
  '</div>';
var firstAction=document.getElementById('practiceHeroBtn');
if(firstAction)top.insertBefore(main,firstAction);else top.appendChild(main);

var headline=main.querySelector('.daily-rail-headline');
var sub=main.querySelector('.daily-rail-sub');
var segmentEls=main.querySelectorAll('.daily-rail-segment');

var KO_SKILL={vocabulary:'어휘',spelling:'철자',grammar:'문법',sentence_building:'문장 만들기',conversation:'회화',listening:'듣기',reading:'읽기'};
var EN_SKILL={vocabulary:'vocabulary',spelling:'spelling',grammar:'grammar',sentence_building:'sentence building',conversation:'conversation',listening:'listening',reading:'reading'};

function korean(){var b=document.getElementById('languageBtn');return !b||String(b.textContent||'').trim()==='English';}
function doneCount(){
  var raw=String(pct.textContent||'').trim();
  if(raw==='✓')return TARGET;
  var m=raw.match(/(\d+)\s*\/\s*(\d+)/);
  if(m)return Math.max(0,Math.min(TARGET,Number(m[1])||0));
  var n=Number((raw.match(/\d+/)||[])[0]);
  return Number.isFinite(n)?Math.max(0,Math.min(TARGET,n)):0;
}
function currentSkill(){
  try{
    var api=window.WillenaStudyV2Daily;
    var s=api&&typeof api.getSession==='function'?api.getSession():null;
    if(!s||s.status==='completed')return'';
    var cursor=Math.max(0,Number(s.cursor)||0),plan=Array.isArray(s.plan)?s.plan:[];
    var item=plan[cursor]||null;
    return String(item&&item.skill||'').trim();
  }catch(_){return'';}
}
function paint(){
  var done=doneCount(),remaining=Math.max(0,TARGET-done),ko=korean(),skill=currentSkill();
  today.textContent=ko?'TODAY':'TODAY';
  if(headline){
    if(done>=TARGET)headline.textContent=ko?'오늘 학습 완료!':'Daily Study complete!';
    else if(done===0)headline.textContent=ko?'오늘은 20문제만 하면 끝!':'20 questions and you are done for today!';
    else headline.textContent=ko?'오늘은 '+remaining+'문제만 더 하면 끝!':remaining+' more question'+(remaining===1?'':'s')+' and you are done!';
  }
  if(sub){
    if(done>=TARGET)sub.textContent=ko?'오늘의 목표를 모두 완료했어요.':'You completed today\'s goal.';
    else if(skill){
      var label=ko?(KO_SKILL[skill]||skill):(EN_SKILL[skill]||skill);
      sub.textContent=ko?'현재 '+label+' 파트를 진행 중이에요.':'You are currently working on '+label+'.';
    }else sub.textContent=ko?'오늘의 Daily Study를 시작해 볼까요?':'Ready to start today\'s Daily Study?';
  }
  segmentEls.forEach(function(el,index){
    var start=index*PER_SEGMENT;
    var fill=Math.max(0,Math.min(1,(done-start)/PER_SEGMENT));
    var bar=el.querySelector('i');if(bar)bar.style.setProperty('--fill',Math.round(fill*100)+'%');
  });
  main.setAttribute('aria-label',(ko?'오늘의 학습 진행 ':'Daily Study progress ')+done+'/'+TARGET);
}

paint();
if(window.MutationObserver)new MutationObserver(paint).observe(pct,{childList:true,characterData:true,subtree:true});
var lang=document.getElementById('languageBtn');if(lang)lang.addEventListener('click',function(){setTimeout(paint,0);});
document.addEventListener('visibilitychange',function(){if(!document.hidden)setTimeout(paint,50);});
setTimeout(paint,250);setTimeout(paint,900);setTimeout(paint,2200);
})();
