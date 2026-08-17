(function(global){
'use strict';
var TARGET=20;
function dailyMode(){return document.body.classList.contains('study-v2-daily-mode');}
function daily(){return global.WillenaStudyV2Daily||null;}
function resolved(){
  try{var d=daily(),s=d&&typeof d.getSession==='function'?d.getSession():null;return Math.min(TARGET,Array.isArray(s&&s.resolved_keys)?s.resolved_keys.length:0);}catch(_){return 0;}
}
function applyHeader(){
  if(!dailyMode())return;
  var back=document.getElementById('v2PracticeClose');
  var skill=document.getElementById('v2PracticeSkill');
  var title=document.getElementById('v2PracticeTitle');
  var progress=document.getElementById('practicePerf');
  if(back){back.textContent='←';back.setAttribute('aria-label','Back');}
  if(skill)skill.hidden=true;
  if(title)title.textContent='Daily Study';
  if(progress){
    var done=resolved(),pct=Math.max(0,Math.min(100,done/TARGET*100));
    progress.classList.add('daily-session-progress');
    progress.setAttribute('aria-label',done+' of '+TARGET+' complete');
    progress.innerHTML='<span class="daily-session-progress-track"><i style="width:'+pct+'%"></i></span>';
  }
}
function restoreHeader(){
  if(dailyMode())return;
  var back=document.getElementById('v2PracticeClose');
  var skill=document.getElementById('v2PracticeSkill');
  var progress=document.getElementById('practicePerf');
  if(back&&back.textContent.trim()==='←')back.textContent='← 뒤로';
  if(skill)skill.hidden=false;
  if(progress){progress.classList.remove('daily-session-progress');progress.removeAttribute('aria-label');}
}
function scrollActionIntoView(){
  if(!dailyMode())return;
  requestAnimationFrame(function(){requestAnimationFrame(function(){
    var action=document.querySelector('#v2ActivityRoot .activity-check');
    if(!action)return;
    try{action.scrollIntoView({behavior:'smooth',block:'end'});}catch(_){}
  });});
}
function starSvg(){
  return '<svg class="daily-reward-star-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.4l2.82 5.72 6.31.92-4.57 4.45 1.08 6.28L12 16.8l-5.64 2.97 1.08-6.28-4.57-4.45 6.31-.92L12 2.4z"/></svg>';
}
function replaceStars(el){
  if(!el||el.dataset.svgStars==='1')return;
  var value=String(el.textContent||'');if(value.indexOf('⭐')<0)return;
  var parts=value.split(/(⭐+)/g),html='';
  parts.forEach(function(part){
    if(!part)return;
    if(/^⭐+$/.test(part)){
      html+='<span class="daily-reward-star-group">';for(var i=0;i<part.length;i++)html+=starSvg();html+='</span>';
    }else{
      html+=part.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
  });
  el.innerHTML=html;el.dataset.svgStars='1';
}
function polishRewardStars(){
  document.querySelectorAll('.daily-reward-stars,.daily-reward-bonus').forEach(replaceStars);
}
function afterAnswer(){
  if(!dailyMode())return;
  requestAnimationFrame(function(){applyHeader();scrollActionIntoView();polishRewardStars();});
}
function bind(){
  applyHeader();polishRewardStars();
  global.addEventListener('willena:activity-answer',afterAnswer);
  document.addEventListener('click',function(e){
    var target=e.target&&e.target.closest?e.target.closest('#v2PracticeClose,#v2ActivityRoot .activity-check,#languageBtn'):null;
    if(!target)return;
    setTimeout(function(){if(dailyMode())applyHeader();else restoreHeader();},0);
  });
  if(global.MutationObserver){
    new MutationObserver(function(){if(dailyMode())applyHeader();else restoreHeader();polishRewardStars();}).observe(document.body,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})(window);
