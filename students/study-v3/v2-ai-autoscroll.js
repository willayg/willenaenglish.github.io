(function(){
'use strict';
var transcript=document.getElementById('aiChatTranscript');
if(!transcript)return;

function pin(){
  transcript.scrollTop=Math.max(0,transcript.scrollHeight-transcript.clientHeight);
}
function pinSoon(){requestAnimationFrame(function(){requestAnimationFrame(pin);});}
function pinBurst(){
  pinSoon();
  [60,140,280,520,900,1400,2200].forEach(function(ms){setTimeout(pin,ms);});
}

var observer=new MutationObserver(pinSoon);
observer.observe(transcript,{childList:true,subtree:true,characterData:true});

if('ResizeObserver' in window){
  var resizeObserver=new ResizeObserver(pinSoon);
  resizeObserver.observe(transcript);
}

document.addEventListener('click',function(e){
  var prompt=e.target&&e.target.closest&&e.target.closest('#aiChatPrompts .study-v2-ai-prompt');
  if(prompt)pinBurst();
},true);

requestAnimationFrame(pin);
})();
