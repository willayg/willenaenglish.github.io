(function(){
'use strict';
var observer=null;
function text(v){return String(v==null?'':v).trim();}
function headingText(){
  var button=document.getElementById('languageBtn');
  return button&&text(button.textContent)==='한국어'?'AI Coach':'AI 코치';
}
function sync(){
  var heading=document.getElementById('aiHeading');
  if(!heading)return;
  var wanted=headingText();
  if(text(heading.textContent)!==wanted)heading.textContent=wanted;
}
function mount(){
  var heading=document.getElementById('aiHeading');
  if(!heading)return;
  sync();
  observer=new MutationObserver(function(){sync();});
  observer.observe(heading,{childList:true,characterData:true,subtree:true});
  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('#languageBtn'))setTimeout(sync,0);
  },true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
