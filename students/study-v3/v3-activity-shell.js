(function(){
'use strict';
function text(v){return String(v==null?'':v).trim();}
function isKo(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function label(){return isKo()?'뒤로':'Back';}
function addBack(actions,handler){
  if(!actions||actions.querySelector('.v3-activity-back'))return;
  var b=document.createElement('button');
  b.type='button';
  b.className='v3-activity-back';
  b.textContent=label();
  b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();handler();});
  var next=actions.querySelector('.activity-check');
  if(next)actions.insertBefore(b,next);else actions.appendChild(b);
}
function addSpeakingBack(actions){
  if(!actions||actions.querySelector('.v3-speaking-back'))return;
  var b=document.createElement('button');
  b.type='button';
  b.className='v3-speaking-back';
  b.textContent=label();
  b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var old=document.getElementById('v2PracticeClose');if(old)old.click();});
  actions.appendChild(b);
}
function scanPractice(){
  document.querySelectorAll('#v2ActivityRoot .activity-actions').forEach(function(actions){
    if(actions.closest('.v3-speaking-shell'))return;
    addBack(actions,function(){var old=document.getElementById('v2PracticeClose');if(old)old.click();});
  });
  document.querySelectorAll('#v2ActivityRoot .v3-speaking-actions').forEach(addSpeakingBack);
}
function scanCoach(){
  document.querySelectorAll('#aiCoachActivityRoot .activity-actions').forEach(function(actions){
    addBack(actions,function(){var old=document.getElementById('aiCoachPracticeBack');if(old)old.click();});
  });
}
function syncLabels(){document.querySelectorAll('.v3-activity-back,.v3-speaking-back').forEach(function(b){b.textContent=label();});}
function scan(){scanPractice();scanCoach();syncLabels();}
function start(){
  scan();
  new MutationObserver(scan).observe(document.body,{subtree:true,childList:true});
  var l=document.getElementById('languageBtn');if(l)l.addEventListener('click',function(){setTimeout(syncLabels,0);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
