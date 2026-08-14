(function(global){
'use strict';
var scheduled=false;
function repaint(){
  scheduled=false;
  try{
    if(global.WillenaStudyV2Daily&&typeof global.WillenaStudyV2Daily.paint==='function'){
      global.WillenaStudyV2Daily.paint();
    }
  }catch(_){}
}
function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(repaint);
}
function bind(){
  var book=document.getElementById('bookTitle');
  var unit=document.getElementById('unitTitle');
  var lang=document.getElementById('languageBtn');

  // Do NOT observe #dailyWorkoutCard itself. Daily paint mutates that card, so
  // observing it creates a self-triggering MutationObserver loop on some browsers.
  [book,unit].forEach(function(node){
    if(node)new MutationObserver(schedule).observe(node,{childList:true,subtree:true,characterData:true});
  });
  if(lang)lang.addEventListener('click',schedule,true);
  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('[data-book-index], [data-unit-id]'))schedule();
  },true);

  schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})(window);
