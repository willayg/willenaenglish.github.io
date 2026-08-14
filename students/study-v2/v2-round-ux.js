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
function roundStarter(target){
  if(!target||!target.closest)return null;
  var el=target.closest('#dailyWorkoutCard,#masteryGrid [data-skill],#continueBtn,#practiceHeroBtn,.practice-this,.study-coach button,.study-coach [data-skill]');
  if(!el||el.disabled||el.classList.contains('is-disabled'))return null;
  return el;
}

/* Important: use CLICK, not pointerdown. pointerdown was entering fullscreen before
   the selected Study mode had a chance to open, which could strand the dashboard/menu
   in fullscreen and swallow/derail the intended round start. At document bubble time,
   the button/card's own click handler has already run, while user activation is still
   available for the fullscreen request. */
document.addEventListener('click',function(e){
  var back=e.target&&e.target.closest&&e.target.closest('#v2PracticeClose,#v2DailyHome');
  if(back){exitFullscreen();return;}
  if(roundStarter(e.target))requestFullscreen();

  var audio=e.target&&e.target.closest&&e.target.closest('.activity-audio');
  if(audio)audio.classList.add('has-played');
},false);

document.addEventListener('fullscreenchange',function(){document.body.classList.toggle('study-v2-is-fullscreen',!!fullscreenElement());});
document.addEventListener('webkitfullscreenchange',function(){document.body.classList.toggle('study-v2-is-fullscreen',!!fullscreenElement());});
})();
