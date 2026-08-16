(function(){
'use strict';
var TARGET=20,STEPS=5;
var card=document.getElementById('dailyWorkoutCard');
var pct=document.getElementById('smartDailyPct');
if(!card||!pct)return;

var journey=document.createElement('div');
journey.className='daily-journey';
journey.setAttribute('aria-label','Daily Study journey');
journey.innerHTML='<strong class="daily-journey-label">오늘의 여정</strong><div class="daily-journey-milestones" aria-hidden="true">'+
  '<span class="daily-journey-mile" data-step="1">1</span>'+
  '<span class="daily-journey-mile" data-step="2">2</span>'+
  '<span class="daily-journey-mile" data-step="3">3</span>'+
  '<span class="daily-journey-mile" data-step="4">4</span>'+
  '<span class="daily-journey-mile" data-step="5">5</span>'+
  '</div>';
card.appendChild(journey);

function korean(){var b=document.getElementById('languageBtn');return !b||String(b.textContent||'').trim()==='English';}
function doneCount(){
  var raw=String(pct.textContent||'').trim();
  if(raw==='✓')return TARGET;
  var m=raw.match(/(\d+)\s*\/\s*(\d+)/);
  if(m)return Math.max(0,Math.min(TARGET,Number(m[1])||0));
  var n=Number((raw.match(/\d+/)||[])[0]);
  return Number.isFinite(n)?Math.max(0,Math.min(TARGET,n)):0;
}
function paint(){
  var done=doneCount();
  var completedSteps=Math.floor(done/(TARGET/STEPS));
  var currentStep=done>=TARGET?0:Math.min(STEPS,completedSteps+1);
  var label=journey.querySelector('.daily-journey-label');
  if(label)label.textContent=korean()?'오늘의 여정':"Today's journey";
  journey.querySelectorAll('.daily-journey-mile').forEach(function(el){
    var step=Number(el.getAttribute('data-step'))||0;
    el.classList.toggle('is-done',step<=completedSteps||done>=TARGET);
    el.classList.toggle('is-current',step===currentStep&&done<TARGET);
  });
  journey.setAttribute('aria-label',(korean()?'오늘의 여정 ':'Daily Study journey ')+done+'/'+TARGET);
}

paint();
if(window.MutationObserver)new MutationObserver(paint).observe(pct,{childList:true,characterData:true,subtree:true});
var lang=document.getElementById('languageBtn');if(lang)lang.addEventListener('click',function(){setTimeout(paint,0);});
})();
