(function(){
'use strict';
function fullscreenElement(){return document.fullscreenElement||document.webkitFullscreenElement||null;}
function requestFullscreen(){
  if(fullscreenElement())return;
  var el=document.documentElement;
  var fn=el.requestFullscreen||el.webkitRequestFullscreen;
  if(!fn)return;
  try{var p=fn.call(el);if(p&&typeof p.catch==='function')p.catch(function(){});}catch(_){ }
}
function exitFullscreen(){
  if(!fullscreenElement())return;
  var fn=document.exitFullscreen||document.webkitExitFullscreen;
  if(!fn)return;
  try{var p=fn.call(document);if(p&&typeof p.catch==='function')p.catch(function(){});}catch(_){ }
}
function isRoundStart(target){
  if(!target||!target.closest)return false;
  var el=target.closest('#dailyWorkoutCard,#masteryGrid [data-skill],.practice-this');
  if(!el)return false;
  if(el.disabled||el.classList.contains('is-disabled'))return false;
  return true;
}
document.addEventListener('pointerdown',function(e){
  if(isRoundStart(e.target))requestFullscreen();
  var back=e.target&&e.target.closest&&e.target.closest('#v2PracticeClose,#v2DailyHome');
  if(back)exitFullscreen();
},true);
document.addEventListener('click',function(e){
  var audio=e.target&&e.target.closest&&e.target.closest('.activity-audio');
  if(audio)audio.classList.add('has-played');
},true);
document.addEventListener('fullscreenchange',function(){document.body.classList.toggle('study-v2-is-fullscreen',!!fullscreenElement());});
document.addEventListener('webkitfullscreenchange',function(){document.body.classList.toggle('study-v2-is-fullscreen',!!fullscreenElement());});
})();
