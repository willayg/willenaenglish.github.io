(function(global){
'use strict';
if(!global.WillenaActivityEngine||!global.WillenaActivityEngine.prototype)return;
var proto=global.WillenaActivityEngine.prototype;
if(proto.__willenaAudioPlayback)return;
var originalRender=proto.render;

function text(v){return String(v==null?'':v).replace(/\\n/g,'\n').trim();}
function playSpeech(button,stimulus){
  var synth=global.speechSynthesis;
  var Utterance=global.SpeechSynthesisUtterance;
  var spoken=text(stimulus&&stimulus.text||stimulus&&stimulus.prompt);
  if(!spoken||!synth||!Utterance)return;

  var started=false;
  var retryUsed=false;
  var runId=String(Date.now())+'-'+Math.random();
  button.dataset.audioRun=runId;
  button.classList.remove('has-played');
  button.classList.add('is-playing');

  try{synth.getVoices();}catch(_){}
  try{synth.cancel();}catch(_){}
  try{synth.resume();}catch(_){}

  function speak(){
    if(button.dataset.audioRun!==runId)return;
    var u=new Utterance(spoken);
    u.lang=text(stimulus&&stimulus.lang)||'en-US';
    var rate=Number(stimulus&&stimulus.rate);
    u.rate=Number.isFinite(rate)&&rate>0?rate:.9;
    u.onstart=function(){
      if(button.dataset.audioRun!==runId)return;
      started=true;
      button.classList.add('has-played');
      button.classList.add('is-playing');
    };
    u.onend=function(){
      if(button.dataset.audioRun!==runId)return;
      button.classList.remove('is-playing');
      button.classList.add('has-played');
    };
    u.onerror=function(e){
      if(button.dataset.audioRun!==runId)return;
      var kind=String(e&&e.error||'');
      if(!retryUsed&&kind!=='interrupted'&&kind!=='canceled'){
        retryUsed=true;
        try{synth.cancel();synth.resume();}catch(_){}
        setTimeout(speak,140);
        return;
      }
      button.classList.remove('is-playing');
    };
    try{synth.speak(u);}catch(_){button.classList.remove('is-playing');}
  }

  /* Chrome/Android can swallow an utterance when speak() immediately follows cancel(). */
  setTimeout(speak,70);
  setTimeout(function(){
    if(button.dataset.audioRun!==runId||started||retryUsed)return;
    var active=false;
    try{active=!!(synth.speaking||synth.pending);}catch(_){}
    if(active)return;
    retryUsed=true;
    try{synth.cancel();synth.resume();}catch(_){}
    setTimeout(speak,120);
  },700);
}

proto.render=function(){
  var result=originalRender.apply(this,arguments);
  var engine=this;
  var a=engine.current;
  var old=engine.root&&engine.root.querySelector&&engine.root.querySelector('.activity-audio');
  if(!old||!a||!a.stimulus||a.stimulus.type!=='audio')return result;

  /* Clone removes the older one-shot speech handler from engine.js so every Study mode
     uses this same mobile-safe audio path instead. */
  var button=old.cloneNode(true);
  old.replaceWith(button);
  button.addEventListener('click',function(e){
    e.preventDefault();
    playSpeech(button,a.stimulus);
  });
  return result;
};
proto.__willenaAudioPlayback=true;
})(window);
