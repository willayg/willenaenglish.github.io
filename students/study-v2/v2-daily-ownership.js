(function(global){
'use strict';
var scheduled=false;
function repaint(){
  scheduled=false;
  if(global.WillenaStudyV2Daily&&typeof global.WillenaStudyV2Daily.paint==='function'){
    global.WillenaStudyV2Daily.paint();
  }
}
function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(function(){requestAnimationFrame(repaint);});
}
function bind(){
  var daily=document.getElementById('dailyWorkoutCard');
  var book=document.getElementById('bookTitle');
  var unit=document.getElementById('unitTitle');
  var lang=document.getElementById('languageBtn');
  [book,unit].forEach(function(node){
    if(node)new MutationObserver(schedule).observe(node,{childList:true,subtree:true,characterData:true});
  });
  if(daily)new MutationObserver(function(){
    if(document.body.classList.contains('study-v2-daily-painting'))return;
    schedule();
  }).observe(daily,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['style']});
  if(lang)lang.addEventListener('click',function(){setTimeout(schedule,0);},true);
  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('[data-book-index], [data-unit-id]'))setTimeout(schedule,0);
  },true);
  schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})(window);
