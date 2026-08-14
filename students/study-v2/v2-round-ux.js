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
  /* Daily Study is intentionally excluded. Its start is asynchronous because the
     server-owned daily session must load/create before the first question opens.
     Fullscreening here would fullscreen the dashboard before Daily is ready. */
  var el=target.closest('#masteryGrid [data-skill],#continueBtn,#practiceHeroBtn,.practice-this,.study-coach button,.study-coach [data-skill]');
  if(!el||el.disabled||el.classList.contains('is-disabled'))return null;
  return el;
}

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