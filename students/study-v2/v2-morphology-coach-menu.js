(function(global){
'use strict';
var busy=false,observer=null,timer=0;
function text(v){return String(v==null?'':v).trim();}
function ko(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function label(type){
  if(type==='past_participle')return ko()?'과거분사 퀴즈 해볼래요?':'How about a participles quiz?';
  if(type==='past')return ko()?'과거형 퀴즈 해볼래요?':'How about a past-tense quiz?';
  return ko()?'He/She 동사 퀴즈 해볼래요?':'How about a he/she verb quiz?';
}
function typesFor(level){
  if(level<=1)return[];
  if(level===2)return['third_person'];
  if(level===3)return['third_person','past'];
  if(level===4)return['third_person','past'];
  if(level===5)return['past','past_participle'];
  return['past_participle','past','third_person'];
}
function schedule(){clearTimeout(timer);timer=setTimeout(sync,60);}
async function sync(){
  if(busy)return;busy=true;
  try{
    var side=global.WillenaMorphologySidecar,p=document.getElementById('aiChatPrompts');
    if(!side||typeof side.resolveLevel!=='function'||typeof side.launchQuiz!=='function'||!p)return;
    var level=await side.resolveLevel(),types=typesFor(Number(level)||0);
    p.querySelectorAll('[data-morph-coach]').forEach(function(b){b.remove();});
    var room=Math.max(0,4-p.children.length);
    types.slice(0,room).forEach(function(type){
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
  if(p&&global.MutationObserver){observer=new MutationObserver(schedule);observer.observe(p,{childList:true});}
  document.addEventListener('click',function(e){
    var b=e.target&&e.target.closest&&e.target.closest('#aiChatPrompts [data-morph-coach][data-morph-type]');
    if(!b)return;
    e.preventDefault();e.stopPropagation();
    var side=global.WillenaMorphologySidecar;
    if(side&&typeof side.launchQuiz==='function')side.launchQuiz(b.dataset.morphType,10);
  },true);
  global.addEventListener('willena:morphology-updated',schedule);
  global.addEventListener('focus',schedule);
  document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('#languageBtn'))setTimeout(schedule,100);},true);
  var tries=0,boot=setInterval(function(){tries++;if(global.WillenaMorphologySidecar){clearInterval(boot);schedule();}else if(tries>40)clearInterval(boot);},100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})(window);
