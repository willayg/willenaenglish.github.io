(function(){
'use strict';
var transcript=document.getElementById('aiChatTranscript');
if(!transcript)return;
function pin(){transcript.scrollTop=transcript.scrollHeight;}
var observer=new MutationObserver(function(){requestAnimationFrame(pin);});
observer.observe(transcript,{childList:true,subtree:true,characterData:true});
requestAnimationFrame(pin);
})();
