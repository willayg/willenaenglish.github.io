(function(){
'use strict';
var wide=window.matchMedia('(min-width:760px), (orientation:landscape) and (min-width:600px) and (max-height:700px)');
var card=document.getElementById('dailyWorkoutCard');
var main=document.querySelector('.daily-rail-main');
var title=document.getElementById('bookTitle');
var titleWrap=document.getElementById('bookSwipe');
if(!card)return;

var streak=main&&main.querySelector('.daily-rail-streak');
if(main&&!streak){
  streak=document.createElement('span');
  streak.className='daily-rail-streak';
  var sub=main.querySelector('.daily-rail-sub');
  if(sub&&sub.nextSibling)main.insertBefore(streak,sub.nextSibling);else main.appendChild(streak);
}

function ko(){var b=document.getElementById('languageBtn');return !b||String(b.textContent||'').trim()==='English';}
function streakNumber(){
  var source=card.querySelector('.daily-streak-status');
  var raw=String(source&&source.textContent||'').trim();
  var m=raw.match(/(\d+)/);
  return m?Math.max(0,Number(m[1])||0):0;
}
function paintStreak(){
  if(!streak)return;
  var n=streakNumber();
  streak.textContent=ko()?('🔥 '+n+'일 연속 학습'):('🔥 '+n+' day'+(n===1?'':'s')+' streak');
}

function clearTitleInline(){
  if(!title)return;
  title.style.removeProperty('font-size');
  title.style.removeProperty('white-space');
  title.style.removeProperty('overflow');
  title.style.removeProperty('text-overflow');
  title.style.removeProperty('width');
  title.style.removeProperty('max-width');
}
function fitBookTitle(){
  if(!title||!titleWrap)return;
  if(!wide.matches){clearTitleInline();return;}
  var available=Math.max(0,titleWrap.clientWidth-8);
  if(!available)return;
  title.style.setProperty('white-space','nowrap','important');
  title.style.setProperty('overflow','visible','important');
  title.style.setProperty('text-overflow','clip','important');
  title.style.setProperty('width','100%','important');
  title.style.setProperty('max-width','100%','important');
  var max=window.innerWidth<=1024?46:58;
  var min=27;
  var size=max;
  title.style.setProperty('font-size',size+'px','important');
  while(size>min&&title.scrollWidth>available){size-=1;title.style.setProperty('font-size',size+'px','important');}
}
function refresh(){paintStreak();fitBookTitle();}

refresh();
setTimeout(refresh,180);setTimeout(refresh,700);setTimeout(refresh,1600);
if(window.MutationObserver){
  new MutationObserver(function(){setTimeout(paintStreak,0);}).observe(card,{childList:true,characterData:true,subtree:true,attributes:true});
  if(title)new MutationObserver(function(){setTimeout(fitBookTitle,0);}).observe(title,{childList:true,characterData:true,subtree:true});
}
if(window.ResizeObserver&&titleWrap)new ResizeObserver(function(){fitBookTitle();}).observe(titleWrap);
window.addEventListener('resize',fitBookTitle,{passive:true});
if(wide.addEventListener)wide.addEventListener('change',refresh);else if(wide.addListener)wide.addListener(refresh);
var lang=document.getElementById('languageBtn');if(lang)lang.addEventListener('click',function(){setTimeout(refresh,0);});
})();
