(function(global){
'use strict';
var busy=false,observer=null,timer=0;
function text(v){return String(v==null?'':v).trim();}
function ko(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function label(type){
  if(type==='past_participle')return ko()?'과거분사 퀴즈 해볼래요?':'How about a participles quiz?';
  if(type==='past')return ko()?'과거형 퀴즈 해볼래요?':'How about a past-tense quiz?';
  return ko()?'3인칭 단수 퀴즈 해볼래요?':'How about a third-person verb quiz?';
}
function typesFor(level){
  if(level<=1)return[];
  if(level===2)return['third_person'];
  if(level===3)return['third_person'];
  if(level===4)return['third_person','past'];
  if(level===5)return['past','past_participle'];
  return['past_participle','past','third_person'];
}
function schedule(){clearTimeout(timer);timer=setTimeout(sync,80);}
function sameTypes(buttons,types){
  if(buttons.length!==types.length)return false;
  for(var i=0;i<types.length;i++)if(buttons[i].dataset.morphType!==types[i])return false;
  return true;
}
async function sync(){
  if(busy)return;busy=true;
  try{
    var side=global.WillenaMorphologySidecar,p=document.getElementById('aiChatPrompts');
    if(!side||typeof side.resolveLevel!=='function'||typeof side.launchQuiz!=='function'||!p)return;
    var level=Number(await side.resolveLevel())||0,types=typesFor(level),existing=Array.prototype.slice.call(p.querySelectorAll('[data-morph-coach="maintenance"]'));

    // If the correct morphology buttons are already present, only refresh labels.
    if(sameTypes(existing,types)){
      existing.forEach(function(b,i){var next=label(types[i]);if(b.textContent!==next)b.textContent=next;});
      return;
    }

    // Remove legacy sidecar prompt(s) and rebuild one stable morphology set.
    p.querySelectorAll('[data-morph-coach]').forEach(function(b){b.remove();});

    var maxPrompts=4,morphCount=Math.min(types.length,maxPrompts),normalLimit=Math.max(0,maxPrompts-morphCount);
    var normal=Array.prototype.slice.call(p.children);
    while(normal.length>normalLimit){var el=normal.pop();if(el&&el.parentNode===p)p.removeChild(el);}

    types.slice(0,morphCount).forEach(function(type){
      var b=document.createElement('button');
      b.type='button';b.className='study-v2-ai-prompt';
      b.dataset.morphCoach='maintenance';b.dataset.morphType=type;
      b.textContent=label(type);p.appendChild(b);
    });
  }catch(e){console.debug('[Morphology Coach Menu] sync skipped',e);}
  finally{busy=false;}
}
function bind(){
  var p=document.getElementById('aiChatPrompts');
  if(p&&global.MutationObserver){observer=new MutationObserver(function(mutations){
    var meaningful=mutations.some(function(m){
      return Array.prototype.some.call(m.addedNodes,function(n){return n.nodeType===1&&!n.matches('[data-morph-coach="maintenance"]');}) ||
             Array.prototype.some.call(m.removedNodes,function(n){return n.nodeType===1&&!n.matches('[data-morph-coach="maintenance"]');});
    });
    if(meaningful)schedule();
  });observer.observe(p,{childList:true});}
  document.addEventListener('click',function(e){
    var b=e.target&&e.target.closest&&e.target.closest('#aiChatPrompts [data-morph-coach="maintenance"][data-morph-type]');
    if(!b)return;
    e.preventDefault();e.stopPropagation();
    var side=global.WillenaMorphologySidecar;
    if(side&&typeof side.launchQuiz==='function')side.launchQuiz(b.dataset.morphType,10);
  },true);
  global.addEventListener('willena:morphology-updated',schedule);
  global.addEventListener('focus',schedule);
  document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('#languageBtn'))setTimeout(schedule,100);},true);
  var tries=0,boot=setInterval(function(){tries++;if(global.WillenaMorphologySidecar){clearInterval(boot);schedule();}else if(tries>80)clearInterval(boot);},100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})(window);
