(function(){
'use strict';
function ensureSpark(shell){
  if(!shell||shell.querySelector('.v3-coach-spark-track'))return;
  var track=document.createElement('span');
  track.className='v3-coach-spark-track';
  track.setAttribute('aria-hidden','true');
  var spark=document.createElement('span');
  spark.className='v3-coach-spark';
  track.appendChild(spark);
  shell.appendChild(track);
}
function syncCoachSpark(){
  var shell=document.getElementById('aiRecommendations');
  var count=document.getElementById('smartDailyPct');
  var title=document.getElementById('smartProgressTitle');
  if(!shell||!count)return;
  ensureSpark(shell);
  var done=String(count.textContent||'').trim()==='✓';
  var testMode=title&&/^TEST\s*·/i.test(String(title.textContent||'').trim());
  shell.classList.toggle('is-daily-complete-spark',done&&!testMode);
}
function bind(){
  syncCoachSpark();
  var count=document.getElementById('smartDailyPct');
  var title=document.getElementById('smartProgressTitle');
  var observer=new MutationObserver(syncCoachSpark);
  if(count)observer.observe(count,{childList:true,characterData:true,subtree:true});
  if(title)observer.observe(title,{childList:true,characterData:true,subtree:true});
  window.addEventListener('focus',syncCoachSpark);
  document.addEventListener('visibilitychange',syncCoachSpark);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
