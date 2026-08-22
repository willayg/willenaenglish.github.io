(function(global){
'use strict';
function text(v){return String(v==null?'':v).trim();}
document.addEventListener('click',function(e){
  var button=e.target&&e.target.closest&&e.target.closest('.v3-speaking-listen');
  if(!button)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  var value=text(button.dataset&&button.dataset.target);
  if(!value){
    var card=button.closest('.v3-speaking-card');
    var revealed=card&&card.querySelector('.v3-speaking-answer');
    value=text(revealed&&revealed.textContent);
  }
  if(!value)return;
  var player=global.WillenaAudioPlayback;
  if(player&&typeof player.playText==='function'){
    player.playText(button,value,{lang:'en-US',rate:.9});
  }
},true);
})(window);
