(function(global){
'use strict';
var proto=global.WillenaActivityEngine&&global.WillenaActivityEngine.prototype;
if(!proto||proto.__v2CanonicalSpellingAudio)return;
proto.__v2CanonicalSpellingAudio=true;
var originalRender=proto.render;

function text(v){return String(v==null?'':v).trim();}
function currentSpellingText(engine){
  var a=engine&&engine.current||{};
  var value=a.answer;
  if(Array.isArray(value))value=value.join(' ');
  value=text(value);
  if(value)return value;
  var tokens=a.response&&a.response.tokens||a.tokens||[];
  return Array.isArray(tokens)?tokens.join(''):text(tokens);
}
function speakerMarkup(){
  return '<svg class="activity-audio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M11 5 6 9H2v6h4l5 4V5z"></path><path d="M15.5 8.5a5 5 0 0 1 0 7"></path><path d="M18 6a8 8 0 0 1 0 12"></path></svg><span>Play audio</span>';
}
function repair(engine){
  var root=engine&&engine.root;
  if(!root||!root.querySelector)return;
  var old=root.querySelector('.activity-spelling-listen');
  if(!old||old.dataset.v2CanonicalAudio==='1')return;
  var button=old.cloneNode(false);
  button.dataset.v2CanonicalAudio='1';
  button.innerHTML=speakerMarkup();
  old.replaceWith(button);
  button.addEventListener('click',function(e){
    e.preventDefault();
    e.stopPropagation();
    var value=currentSpellingText(engine);
    var player=global.WillenaAudioPlayback;
    if(value&&player&&typeof player.playText==='function')player.playText(button,value,{lang:'en-US',rate:.9});
  });
}
proto.render=function(){
  var result=originalRender.apply(this,arguments);
  repair(this);
  return result;
};
})(window);
