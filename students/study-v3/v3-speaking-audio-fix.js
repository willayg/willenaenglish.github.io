(function(global){
'use strict';
function text(v){return String(v==null?'':v).trim();}
document.addEventListener('click',function(e){
  var button=e.target&&e.target.closest&&e.target.closest('.v3-speaking-listen');
  if(!button)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  var card=button.closest('.v3-speaking-card');
  var prompt=card&&card.querySelector('.v3-speaking-prompt');
  var value=text(prompt&&prompt.textContent);
  if(!value)return;
  var player=global.WillenaAudioPlayback;
  if(player&&typeof player.playText==='function'){
    player.playText(button,value,{lang:'en-US',rate:.9});
    return;
  }
  if(global.speechSynthesis&&global.SpeechSynthesisUtterance){
    try{
      global.speechSynthesis.cancel();
      var u=new SpeechSynthesisUtterance(value);
      u.lang='en-US';u.rate=.9;
      global.speechSynthesis.speak(u);
    }catch(_){}
  }
},true);
})(window);
