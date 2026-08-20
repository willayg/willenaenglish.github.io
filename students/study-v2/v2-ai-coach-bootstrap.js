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
var failTimer=null;

function text(v){return String(v==null?'':v).trim();}
function masteryReady(){
  var cards=Array.prototype.slice.call(document.querySelectorAll('#masteryGrid [data-skill]'));
  if(!cards.length)return false;
  return cards.some(function(card){var pct=card.querySelector('.header-skill-master-pct');return !!text(pct&&pct.textContent);});
}

async function startFromLive(){
  if(started)return false;
  var ctx=coach.context();
  if(!ctx)return false;
  started=true;
  if(failTimer){clearTimeout(failTimer);failTimer=null;}
  global.dispatchEvent(new CustomEvent('willena:coach-bootstrap-ready',{detail:{context:ctx,publicLevel:Number(ctx.publicLevel)||0,masteryReady:masteryReady(),source:'live'}}));
  await coach.home(true);
  root.classList.remove('willena-coach-booting');
  return true;
}

async function onStudyReady(e){
  var source=e&&e.detail&&e.detail.source||'';
  if(source!=='live')return;
  if(!started){await startFromLive();return;}
  var state=typeof coach.getState==='function'?coach.getState():null;
  if(state&&state.view&&state.view!=='home')return;
  await coach.refresh();
}

function boot(){
  global.addEventListener('willena:study-v2-ready',onStudyReady);
  failTimer=setTimeout(function(){
    if(started)return;
    console.warn('[AI Coach bootstrap] Live Study V2 context did not become ready.');
    root.classList.remove('willena-coach-booting');
  },12000);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
