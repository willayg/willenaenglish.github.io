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
function repair(engine){
  var root=engine&&engine.root;
  if(!root||!root.querySelectorAll)return;
  var buttons=Array.prototype.slice.call(root.querySelectorAll('.activity-spelling-listen'));
  if(!buttons.length)return;
  var old=buttons[0];
  for(var i=1;i<buttons.length;i++)buttons[i].remove();
  if(old.dataset.v2CanonicalAudio==='1')return;
  var button=old.cloneNode(false);
  button.dataset.v2CanonicalAudio='1';
  button.innerHTML='';
  button.setAttribute('aria-label','Play audio');
  button.setAttribute('title','Play audio');
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
