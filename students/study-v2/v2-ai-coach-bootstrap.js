(function(global){
'use strict';
var coach=global.WillenaAICoach;
if(!coach||typeof coach.home!=='function'||typeof coach.context!=='function')return;

var root=document.documentElement;
root.classList.add('willena-coach-booting');
var style=document.createElement('style');
style.textContent='.willena-coach-booting #aiChat{visibility:hidden!important;}';
document.head.appendChild(style);

function text(v){return String(v==null?'':v).trim();}
function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
function masteryReady(){
  var cards=Array.prototype.slice.call(document.querySelectorAll('#masteryGrid [data-skill]'));
  if(!cards.length)return false;
  return cards.some(function(card){var pct=card.querySelector('.header-skill-master-pct');return !!text(pct&&pct.textContent);});
}
async function boot(){
  var started=Date.now(),ctx=null;
  while(Date.now()-started<3500){
    ctx=coach.context();
    if(ctx&&masteryReady())break;
    if(ctx&&Date.now()-started>1800)break;
    await sleep(100);
  }
  global.dispatchEvent(new CustomEvent('willena:coach-bootstrap-ready',{detail:{context:ctx,publicLevel:Number(ctx&&ctx.publicLevel)||0,masteryReady:masteryReady()}}));
  await coach.home(true);
  root.classList.remove('willena-coach-booting');
}
boot().catch(function(e){console.warn('[AI Coach bootstrap]',e);root.classList.remove('willena-coach-booting');});
})(window);
