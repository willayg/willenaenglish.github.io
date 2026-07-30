(function(){
'use strict';

var ua=navigator.userAgent||'';
var isEmbedded=/KAKAOTALK|NAVER|DaumApps|KAKAOSTORY/i.test(ua);
var lacksSpeech=!("speechSynthesis" in window)&&!("SpeechSynthesisUtterance" in window);
if(!isEmbedded&&!lacksSpeech)return;

var AUDIO_ENDPOINT='https://gxwfsqxyuufqtitspfqg.supabase.co/functions/v1/public-listening-audio';
var bank=[];
var activeAudio=null;
var playCounts={};

function clean(value){return String(value==null?'':value).replace(/\s+/g,' ').trim()}
function sameSet(a,b){
  if(a.length!==b.length)return false;
  for(var i=0;i<a.length;i++)if(b.indexOf(a[i])===-1)return false;
  return true;
}
function findQuestion(){
  var card=document.querySelector('.question-card');
  if(!card)return null;
  var buttons=card.querySelectorAll('.choice');
  var choices=[];
  for(var i=0;i<buttons.length;i++)choices.push(clean(buttons[i].getAttribute('data-value')||buttons[i].textContent));
  var prompt=card.querySelector('.listening-question');
  var promptText=clean(prompt&&prompt.textContent);
  var candidates=[];
  for(var j=0;j<bank.length;j++){
    var q=bank[j];
    if(q.type!=='listening')continue;
    var qChoices=[];
    for(var k=0;k<q.choices.length;k++)qChoices.push(clean(q.choices[k]));
    if(sameSet(qChoices,choices))candidates.push(q);
  }
  for(var n=0;n<candidates.length;n++)if(clean(candidates[n].q)===promptText)return candidates[n];
  return candidates[0]||null;
}
function setPlaying(button,playing){
  var span=button.querySelector('span');
  if(span)span.textContent=playing?(document.documentElement.lang==='ko'?'재생 중…':'Playing…'):(document.documentElement.lang==='ko'?'음성 듣기':'Play audio');
  button.disabled=playing;
}
function updateRemaining(question,remaining){
  playCounts[question.id]=remaining;
  var el=document.querySelector('#playsRemaining');
  if(el)el.textContent=remaining+' '+(document.documentElement.lang==='ko'?'회 남음':'plays left');
}
function playRealAudio(button,question){
  var transcript=clean(question.metadata&&question.metadata.transcript);
  if(!transcript)return;
  var remaining=playCounts[question.id];
  if(typeof remaining!=='number')remaining=Number(question.metadata&&question.metadata.max_plays)||2;
  if(remaining<=0)return;
  if(activeAudio){try{activeAudio.pause()}catch(error){} activeAudio=null;}
  remaining--;
  updateRemaining(question,remaining);
  setPlaying(button,true);
  var src=AUDIO_ENDPOINT+'?text='+encodeURIComponent(transcript);
  var audio=new Audio(src);
  activeAudio=audio;
  audio.preload='auto';
  audio.onended=function(){if(activeAudio===audio)activeAudio=null;setPlaying(button,false);button.disabled=remaining<=0};
  audio.onerror=function(){if(activeAudio===audio)activeAudio=null;setPlaying(button,false);button.disabled=false;updateRemaining(question,remaining+1)};
  var promise=audio.play();
  if(promise&&typeof promise.catch==='function')promise.catch(function(){audio.onerror()});
}

document.addEventListener('click',function(event){
  var node=event.target;
  while(node&&node!==document){
    if(node.id==='playAudio')break;
    node=node.parentNode;
  }
  if(!node||node===document)return;
  var question=findQuestion();
  if(!question)return;
  event.preventDefault();
  event.stopPropagation();
  if(typeof event.stopImmediatePropagation==='function')event.stopImmediatePropagation();
  playRealAudio(node,question);
},true);

if(typeof window.loadQuestionBank==='function'){
  window.loadQuestionBank().then(function(items){bank=items||[]}).catch(function(){});
}
})();