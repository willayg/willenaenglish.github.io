(function(){
'use strict';
var raf=0;
var last=0;
var distance=0;
var SPEED=120;
function ensureSpark(shell){
  var track=shell&&shell.querySelector('.v3-coach-spark-track');
  if(track)return track;
  if(!shell)return null;
  track=document.createElement('span');
  track.className='v3-coach-spark-track';
  track.setAttribute('aria-hidden','true');
  var spark=document.createElement('span');
  spark.className='v3-coach-spark';
  track.appendChild(spark);
  shell.appendChild(track);
  return track;
}
function placeSpark(shell,spark,d){
  var w=shell.clientWidth,h=shell.clientHeight;
  if(w<20||h<20)return;
  var r=Math.min(24,w/2,h/2);
  var top=Math.max(0,w-2*r),side=Math.max(0,h-2*r),arc=Math.PI*r/2;
  var perimeter=2*top+2*side+4*arc;
  if(perimeter<=0)return;
  d=((d%perimeter)+perimeter)%perimeter;
  var x=r,y=0;
  function quarter(cx,cy,startAngle,t){x=cx+r*Math.cos(startAngle+t*Math.PI/2);y=cy+r*Math.sin(startAngle+t*Math.PI/2);}
  if(d<top){x=r+d;y=0;}
  else if((d-=top)<arc){quarter(w-r,r,-Math.PI/2,d/arc);}
  else if((d-=arc)<side){x=w;y=r+d;}
  else if((d-=side)<arc){quarter(w-r,h-r,0,d/arc);}
  else if((d-=arc)<top){x=w-r-d;y=h;}
  else if((d-=top)<arc){quarter(r,h-r,Math.PI/2,d/arc);}
  else if((d-=arc)<side){x=0;y=h-r-d;}
  else {d-=side;quarter(r,r,Math.PI,d/arc);}
  spark.style.transform='translate('+Math.round(x-4)+'px,'+Math.round(y-4)+'px)';
}
function animate(ts){
  var shell=document.getElementById('aiRecommendations');
  var spark=shell&&shell.querySelector('.v3-coach-spark');
  if(!shell||!spark||!shell.classList.contains('is-daily-complete-spark')){raf=0;last=0;return;}
  if(!last)last=ts;
  var dt=Math.min(50,ts-last)/1000;last=ts;distance+=SPEED*dt;
  placeSpark(shell,spark,distance);
  raf=requestAnimationFrame(animate);
}
function syncCoachSpark(){
  var shell=document.getElementById('aiRecommendations');
  var count=document.getElementById('smartDailyPct');
  if(!shell||!count)return;
  ensureSpark(shell);
  var done=String(count.textContent||'').trim()==='✓';
  shell.classList.toggle('is-daily-complete-spark',done);
  if(done&&!raf){last=0;raf=requestAnimationFrame(animate);}
  if(!done&&raf){cancelAnimationFrame(raf);raf=0;last=0;}
}
function bind(){
  syncCoachSpark();
  var count=document.getElementById('smartDailyPct');
  var observer=new MutationObserver(syncCoachSpark);
  if(count)observer.observe(count,{childList:true,characterData:true,subtree:true});
  window.addEventListener('resize',syncCoachSpark);
  window.addEventListener('focus',syncCoachSpark);
  document.addEventListener('visibilitychange',syncCoachSpark);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
