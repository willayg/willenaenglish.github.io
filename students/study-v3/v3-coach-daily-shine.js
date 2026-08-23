(function(){
'use strict';
function syncCoachShine(){
  var shell=document.getElementById('aiRecommendations');
  var count=document.getElementById('smartDailyPct');
  var title=document.getElementById('smartProgressTitle');
  if(!shell||!count)return;
  var done=String(count.textContent||'').trim()==='✓';
  var testMode=title&&/^TEST\s*·/i.test(String(title.textContent||'').trim());
  shell.classList.toggle('is-daily-complete-shine',done&&!testMode);
}
function bind(){
  syncCoachShine();
  var count=document.getElementById('smartDailyPct');
  var title=document.getElementById('smartProgressTitle');
  var observer=new MutationObserver(syncCoachShine);
  if(count)observer.observe(count,{childList:true,characterData:true,subtree:true});
  if(title)observer.observe(title,{childList:true,characterData:true,subtree:true});
  window.addEventListener('focus',syncCoachShine);
  document.addEventListener('visibilitychange',syncCoachShine);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
