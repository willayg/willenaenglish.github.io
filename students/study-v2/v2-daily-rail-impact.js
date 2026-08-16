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

var SPARK_SVG='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3l2.1 6.1L24 12l-5.9 2.9L16 21l-2.1-6.1L8 12l5.9-2.9L16 3z"></path><path d="M25 21l1.1 3 2.9 1.4-2.9 1.4-1.1 3-1.1-3-2.9-1.4 2.9-1.4L25 21z"></path></svg>';
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
  var label=ko()?(n+'일 연속 학습'):(n+' day'+(n===1?'':'s')+' streak');
  streak.innerHTML=SPARK_SVG+'<span>'+label+'</span>';
}

function clearTitleInline(){
  if(!title)return;
  ['font-size','white-space','overflow','text-overflow','width','max-width'].forEach(function(p){title.style.removeProperty(p);});
}
function horizontalPadding(el){
  try{
    var cs=getComputedStyle(el);
    return (parseFloat(cs.paddingLeft)||0)+(parseFloat(cs.paddingRight)||0);
  }catch(_){return 0;}
}
function measuredTextWidth(size){
  if(!title)return 0;
  try{
    var cs=getComputedStyle(title);
    var canvas=measuredTextWidth._canvas||(measuredTextWidth._canvas=document.createElement('canvas'));
    var ctx=canvas.getContext('2d');
    if(!ctx)return 0;
    ctx.font=(cs.fontStyle||'normal')+' '+(cs.fontWeight||'800')+' '+size+'px '+(cs.fontFamily||'Poppins,sans-serif');
    var txt=String(title.textContent||'');
    var width=ctx.measureText(txt).width;
    var ls=parseFloat(cs.letterSpacing);
    if(Number.isFinite(ls)&&txt.length>1)width+=ls*(txt.length-1);
    return width;
  }catch(_){return 0;}
}
function fitBookTitle(){
  if(!title||!titleWrap)return;
  if(!wide.matches){clearTitleInline();return;}
  var available=Math.max(0,titleWrap.clientWidth-horizontalPadding(titleWrap)-28);
  if(!available)return;
  title.style.setProperty('white-space','nowrap','important');
  title.style.setProperty('overflow','visible','important');
  title.style.setProperty('text-overflow','clip','important');
  title.style.setProperty('width','100%','important');
  title.style.setProperty('max-width','100%','important');
  var max=window.innerWidth<=1024?44:56;
  var min=20;
  var size=max;
  while(size>min&&measuredTextWidth(size)>available)size-=1;
  title.style.setProperty('font-size',size+'px','important');
}
function refresh(){paintStreak();fitBookTitle();}

refresh();
setTimeout(refresh,120);setTimeout(refresh,500);setTimeout(refresh,1200);setTimeout(refresh,2400);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){setTimeout(fitBookTitle,0);});
if(window.MutationObserver){
  new MutationObserver(function(){setTimeout(paintStreak,0);}).observe(card,{childList:true,characterData:true,subtree:true,attributes:true});
  if(title)new MutationObserver(function(){setTimeout(fitBookTitle,0);}).observe(title,{childList:true,characterData:true,subtree:true});
}
if(window.ResizeObserver&&titleWrap)new ResizeObserver(function(){fitBookTitle();}).observe(titleWrap);
window.addEventListener('resize',fitBookTitle,{passive:true});
if(wide.addEventListener)wide.addEventListener('change',refresh);else if(wide.addListener)wide.addListener(refresh);
var lang=document.getElementById('languageBtn');if(lang)lang.addEventListener('click',function(){setTimeout(refresh,0);});
})();
