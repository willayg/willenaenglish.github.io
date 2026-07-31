(function(){
'use strict';

var names={1:'Starter 1',2:'Starter 2',3:'Level 1',4:'Level 2',5:'Level 3',6:'Level 4',7:'Level 5',8:'Level 6',9:'Level 7',10:'Level 8'};
var shortNames={1:'S1',2:'S2',3:'1',4:'2',5:'3',6:'4',7:'5',8:'6',9:'7',10:'8'};
var lastLevel=0;
var lastVisible=false;
var queued=false;

function levelName(level){return names[level]||'Starter 1';}

function ensureMeter(){
  var meter=document.querySelector('#debugLevelMeter');
  if(meter)return meter;
  meter=document.createElement('aside');
  meter.id='debugLevelMeter';
  meter.className='debug-level-meter';
  meter.setAttribute('aria-live','polite');
  meter.innerHTML='<div class="debug-level-meter__top"><span class="debug-level-meter__label">Testing level</span><strong class="debug-level-meter__value">—</strong></div><div class="debug-level-meter__track" aria-label="Question level from Starter 1 to Level 8">'+Array.from({length:10},function(_,i){var n=i+1;return '<span data-level="'+n+'" aria-label="'+levelName(n)+'"><b>'+shortNames[n]+'</b></span>';}).join('')+'</div>';
  document.body.appendChild(meter);
  return meter;
}

function updateMeter(){
  queued=false;
  var meter=ensureMeter();
  var card=document.querySelector('.question-card');
  var level=card?Number(card.getAttribute('data-question-level')):0;
  var visible=level>=1&&level<=10;

  if(visible!==lastVisible){meter.classList.toggle('is-visible',visible);lastVisible=visible;}
  if(!visible||level===lastLevel)return;

  lastLevel=level;
  var value=meter.querySelector('.debug-level-meter__value');
  if(value)value.textContent=levelName(level);
  Array.prototype.forEach.call(meter.querySelectorAll('.debug-level-meter__track span'),function(segment){
    var segmentLevel=Number(segment.getAttribute('data-level'));
    segment.classList.toggle('is-passed',segmentLevel<level);
    segment.classList.toggle('is-current',segmentLevel===level);
  });
}

function scheduleUpdate(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(updateMeter);
}

var app=document.querySelector('#app');
if(app)new MutationObserver(scheduleUpdate).observe(app,{childList:true,subtree:true});
updateMeter();
})();
