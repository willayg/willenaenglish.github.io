(function(global){
'use strict';
var painting=false;
function repaint(){
  if(painting)return;
  if(global.WillenaStudyV2Daily&&typeof global.WillenaStudyV2Daily.paint==='function'){
    painting=true;
    try{
      document.body.classList.add('study-v2-daily-painting');
      global.WillenaStudyV2Daily.paint();
    }finally{
      document.body.classList.remove('study-v2-daily-painting');
      painting=false;
    }
  }
}
function bind(){
  var daily=document.getElementById('dailyWorkoutCard');
  var book=document.getElementById('bookTitle');
  var unit=document.getElementById('unitTitle');
  var lang=document.getElementById('languageBtn');

  // Daily Study owns this card. Repaint in the mutation microtask instead of
  // waiting two animation frames; otherwise v2.js can visibly flash its old
  // unit-mastery-derived "Daily" percentage before the real Daily state wins.
  [book,unit].forEach(function(node){
    if(node)new MutationObserver(repaint).observe(node,{childList:true,subtree:true,characterData:true});
  });
  if(daily)new MutationObserver(function(){
    if(painting||document.body.classList.contains('study-v2-daily-painting'))return;
    repaint();
  }).observe(daily,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['style']});
  if(lang)lang.addEventListener('click',function(){queueMicrotask(repaint);},true);
  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('[data-book-index], [data-unit-id]'))queueMicrotask(repaint);
  },true);

  repaint();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})(window);
