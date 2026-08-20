(function(global){
'use strict';
var coach=global.WillenaAICoach;
if(!coach||typeof coach.refresh!=='function')return;

var root=document.documentElement;
root.classList.add('willena-coach-booting');
var style=document.createElement('style');
style.textContent='.willena-coach-booting #aiCoachChoices{visibility:hidden!important;}';
document.head.appendChild(style);

function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
function masteryReady(){return document.querySelectorAll('#masteryGrid [data-skill]').length>0;}
async function morphologyLevel(){
  var side=global.WillenaMorphologySidecar;
  if(!side||typeof side.resolveLevel!=='function')return 0;
  try{return Number(await side.resolveLevel())||0;}catch(_){return 0;}
}

async function boot(){
  var started=Date.now(),level=0;
  while(Date.now()-started<1800){
    level=await morphologyLevel();
    if(level>0&&masteryReady())break;
    if(level>0&&Date.now()-started>900)break;
    await sleep(100);
  }
  global.dispatchEvent(new CustomEvent('willena:coach-bootstrap-ready',{detail:{publicLevel:level,masteryReady:masteryReady()}}));
  await sleep(40);
  await coach.refresh();
  root.classList.remove('willena-coach-booting');
}

boot().catch(function(){root.classList.remove('willena-coach-booting');coach.refresh();});
})(window);
