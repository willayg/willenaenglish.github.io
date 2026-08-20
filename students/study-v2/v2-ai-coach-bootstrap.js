(function(global){
'use strict';
var coach=global.WillenaAICoach;
if(!coach||typeof coach.home!=='function'||typeof coach.context!=='function')return;

var root=document.documentElement;
root.classList.add('willena-coach-booting');
var style=document.createElement('style');
style.textContent='.willena-coach-booting #aiChat{visibility:hidden!important;}';
document.head.appendChild(style);

var started=false;
var observer=null;
var failTimer=null;

function text(v){return String(v==null?'':v).trim();}
function masteryReady(){
  var cards=Array.prototype.slice.call(document.querySelectorAll('#masteryGrid [data-skill]'));
  if(!cards.length)return false;
  return cards.some(function(card){
    var pct=card.querySelector('.header-skill-master-pct');
    return !!text(pct&&pct.textContent);
  });
}

async function startCoach(){
  if(started)return false;
  var ctx=coach.context();
  if(!ctx)return false;
  started=true;
  if(observer){observer.disconnect();observer=null;}
  if(failTimer){clearTimeout(failTimer);failTimer=null;}
  global.dispatchEvent(new CustomEvent('willena:coach-bootstrap-ready',{detail:{context:ctx,publicLevel:Number(ctx.publicLevel)||0,masteryReady:masteryReady()}}));
  await coach.home(true);
  root.classList.remove('willena-coach-booting');
  return true;
}

function watchStudy(){
  if(startCoach())return;
  var grid=document.getElementById('masteryGrid');
  if(grid){
    observer=new MutationObserver(function(){startCoach();});
    observer.observe(grid,{childList:true,subtree:true,characterData:true});
  }
  global.addEventListener('willena:study-progress-updated',startCoach);
  failTimer=setTimeout(function(){
    if(started)return;
    console.warn('[AI Coach bootstrap] Study context did not become ready.');
    root.classList.remove('willena-coach-booting');
  },10000);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watchStudy,{once:true});else watchStudy();
})(window);
