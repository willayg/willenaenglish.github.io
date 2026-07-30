(function(){
'use strict';

var loadQuestionBank=window.loadQuestionBank;
var bank=[];

function clean(value){
  return String(value==null?'':value).trim().replace(/\s+/g,' ');
}

function ensureMeter(){
  var meter=document.querySelector('#debugLevelMeter');
  if(meter)return meter;
  meter=document.createElement('aside');
  meter.id='debugLevelMeter';
  meter.className='debug-level-meter';
  meter.setAttribute('aria-live','polite');
  meter.innerHTML=
    '<div class="debug-level-meter__top">'+
      '<span class="debug-level-meter__label">Testing level</span>'+
      '<strong class="debug-level-meter__value">—</strong>'+
    '</div>'+
    '<div class="debug-level-meter__track" aria-label="Question level from 1 to 10">'+
      Array.from({length:10},function(_,i){return '<span data-level="'+(i+1)+'"><b>'+(i+1)+'</b></span>';}).join('')+
    '</div>';
  document.body.appendChild(meter);
  return meter;
}

function currentQuestion(){
  var card=document.querySelector('.question-card');
  if(!card)return null;

  var directLevel=Number(card.getAttribute('data-question-level'));
  if(directLevel>=1&&directLevel<=10)return{level:directLevel};

  var scrambleTokens=Array.prototype.map.call(card.querySelectorAll('.scramble-token'),function(x){return clean(x.textContent);}).sort();
  if(scrambleTokens.length){
    return bank.find(function(q){
      return q.type==='sentence_unscramble'&&q.tokens.slice().map(clean).sort().join('|')===scrambleTokens.join('|');
    })||null;
  }

  var prompt=clean((card.querySelector('.prompt')||{}).textContent);
  var choices=Array.prototype.map.call(card.querySelectorAll('.choice'),function(x){return clean(x.textContent);}).sort();
  return bank.find(function(q){
    return clean(q.q)===prompt&&q.choices.slice().map(clean).sort().join('|')===choices.join('|');
  })||bank.find(function(q){return clean(q.q)===prompt;})||null;
}

function updateMeter(){
  var meter=ensureMeter();
  var question=currentQuestion();
  var visible=Boolean(document.querySelector('.question-card')&&question);
  meter.classList.toggle('is-visible',visible);
  if(!visible)return;
  var level=Math.max(1,Math.min(10,Number(question.level)||1));
  meter.querySelector('.debug-level-meter__value').textContent='Level '+level;
  Array.prototype.forEach.call(meter.querySelectorAll('.debug-level-meter__track span'),function(segment){
    var segmentLevel=Number(segment.getAttribute('data-level'));
    segment.classList.toggle('is-passed',segmentLevel<level);
    segment.classList.toggle('is-current',segmentLevel===level);
  });
}

var observer=new MutationObserver(function(){requestAnimationFrame(updateMeter);});
observer.observe(document.body,{childList:true,subtree:true,characterData:true});

if(typeof loadQuestionBank==='function'){
  loadQuestionBank().then(function(items){bank=items;updateMeter();}).catch(function(error){console.warn('Level meter could not load the assessment bank',error);});
}else{
  console.warn('Level meter could not find the assessment loader');
}
updateMeter();
})();
