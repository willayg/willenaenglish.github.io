(function(global){
'use strict';
if(!global.WillenaActivityEngine||!global.WillenaActivityEngine.prototype)return;
var proto=global.WillenaActivityEngine.prototype;
if(proto.__willenaAudioPlayback)return;
var originalRender=proto.render;
var currentUtterance=null;

function text(v){return String(v==null?'':v).replace(/\\n/g,'\n').trim();}
function playSpeech(button,stimulus){
  var synth=global.speechSynthesis;
  var Utterance=global.SpeechSynthesisUtterance;
  var spoken=text(stimulus&&stimulus.text||stimulus&&stimulus.prompt);
  if(!spoken||!synth||!Utterance)return;

  button.classList.remove('has-played');
  button.classList.add('is-playing');
  try{synth.resume();}catch(_){}
  try{synth.getVoices();}catch(_){}

  /* Keep the first speak() inside the actual tap/click gesture. Delaying it can make
     Android Chrome silently block speech for the whole Study app. */
  if(synth.speaking||synth.pending){
    try{synth.cancel();}catch(_){}
  }

  var u=new Utterance(spoken);
  currentUtterance=u;
  u.lang=text(stimulus&&stimulus.lang)||'en-US';
  var rate=Number(stimulus&&stimulus.rate);
  u.rate=Number.isFinite(rate)&&rate>0?rate:.9;
  u.onstart=function(){
    if(currentUtterance!==u)return;
    button.classList.add('has-played');
    button.classList.add('is-playing');
  };
  u.onend=function(){
    if(currentUtterance!==u)return;
    button.classList.remove('is-playing');
    button.classList.add('has-played');
  };
  u.onerror=function(){
    if(currentUtterance!==u)return;
    button.classList.remove('is-playing');
  };
  try{synth.speak(u);}catch(_){button.classList.remove('is-playing');}
}

proto.render=function(){
  var result=originalRender.apply(this,arguments);
  var engine=this;
  var a=engine.current;
  var old=engine.root&&engine.root.querySelector&&engine.root.querySelector('.activity-audio');
  if(!old||!a||!a.stimulus||a.stimulus.type!=='audio')return result;

  /* Replace engine.js's older handler so Daily, Book Practice and AI Coach all use
     one audio path while preserving the shared activity renderer. */
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
