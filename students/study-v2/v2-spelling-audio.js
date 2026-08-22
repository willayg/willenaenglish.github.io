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
function headphonesMarkup(){
  return '<svg class="activity-audio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 14v-2a8 8 0 0 1 16 0v2"></path><path d="M18 19h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-1z"></path><path d="M6 19H5a2 2 0 0 1-2-2v-3a2 2 0 0 0-2-2h1z"></path></svg><span>Play audio</span>';
}
function repair(engine){
  var root=engine&&engine.root;
  if(!root||!root.querySelectorAll)return;
  var buttons=Array.prototype.slice.call(root.querySelectorAll('.activity-spelling-listen'));
  if(!buttons.length)return;
  var old=buttons[0];
  for(var i=1;i<buttons.length;i++)buttons[i].remove();
  if(old.dataset.v2CanonicalAudio==='1'){
    old.innerHTML=headphonesMarkup();
    return;
  }
  var button=old.cloneNode(false);
  button.dataset.v2CanonicalAudio='1';
  button.innerHTML=headphonesMarkup();
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
