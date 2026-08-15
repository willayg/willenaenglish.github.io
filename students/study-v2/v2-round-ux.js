(function(){
'use strict';

/* Fullscreen is intentionally disabled for Study V2 for now.
   Keep this helper file in place because it still owns the small
   audio-button played-state decoration used by the round UI. */
document.addEventListener('click',function(e){
  var audio=e.target&&e.target.closest&&e.target.closest('.activity-audio');
  if(audio)audio.classList.add('has-played');
},false);
})();
