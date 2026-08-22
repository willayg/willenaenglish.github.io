(function(){
'use strict';
function text(v){return String(v==null?'':v).trim();}
function isKo(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function label(){return isKo()?'뒤로':'Back';}
function studentId(){
  try{
    var tok=localStorage.getItem('sb_access_token')||'';
    var p=tok.split('.')[1];if(!p)return'local';
    p=p.replace(/-/g,'+').replace(/_/g,'/');while(p.length%4)p+='=';
    var d=JSON.parse(atob(p));return d&&d.sub?String(d.sub):'local';
  }catch(_){return'local';}
}
function helpKey(kind){return'willena:v3:action-help:'+studentId()+':'+kind;}
function hasSeen(kind){try{return localStorage.getItem(helpKey(kind))==='1';}catch(_){return false;}}
function markSeen(kind){try{localStorage.setItem(helpKey(kind),'1');}catch(_){} }
function addBack(actions,handler){
  if(!actions)return;
  var card=actions.closest('.activity-card');
  var spelling=!!(card&&card.querySelector('.activity-letter-order'));
  if(spelling){
    if(card.querySelector(':scope > .v3-spelling-back'))return;
    var sb=document.createElement('button');
    sb.type='button';
    sb.className='v3-activity-back v3-spelling-back';
    sb.textContent=label();
    sb.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();handler();});
    card.appendChild(sb);
    return;
  }
  if(actions.querySelector('.v3-activity-back'))return;
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
function decorateAudio(root){
  if(!root)return;
  root.querySelectorAll('.activity-card').forEach(function(card){
    var audio=card.querySelector('.activity-spelling-listen,.activity-audio');
    if(!audio)return;
    var kind=card.querySelector('.activity-letter-order')?'spelling':'listening';
    audio.classList.add('v3-action-pulse');
    audio.dataset.v3ActionKind=kind;
    if(!hasSeen(kind)){
      audio.classList.add('v3-action-first');
      if(!audio.querySelector('.v3-action-hint')){
        var hint=document.createElement('span');
        hint.className='v3-action-hint';
        hint.textContent=isKo()?'여기를 눌러요':'Tap here';
        audio.appendChild(hint);
      }
    }
    if(audio.dataset.v3PulseBound!=='1'){
      audio.dataset.v3PulseBound='1';
      audio.addEventListener('click',function(){
        markSeen(kind);
        audio.classList.remove('v3-action-first');
        var h=audio.querySelector('.v3-action-hint');if(h)h.remove();
      });
    }
  });
}
function scanPractice(){
  document.querySelectorAll('#v2ActivityRoot .activity-actions').forEach(function(actions){
    if(actions.closest('.v3-speaking-shell'))return;
    addBack(actions,function(){var old=document.getElementById('v2PracticeClose');if(old)old.click();});
  });
  document.querySelectorAll('#v2ActivityRoot .v3-speaking-actions').forEach(addSpeakingBack);
  decorateAudio(document.getElementById('v2ActivityRoot'));
}
function scanCoach(){
  document.querySelectorAll('#aiCoachActivityRoot .activity-actions').forEach(function(actions){
    addBack(actions,function(){var old=document.getElementById('aiCoachPracticeBack');if(old)old.click();});
  });
  decorateAudio(document.getElementById('aiCoachActivityRoot'));
}
function syncLabels(){
  var wanted=label();
  document.querySelectorAll('.v3-activity-back,.v3-speaking-back').forEach(function(b){if(text(b.textContent)!==wanted)b.textContent=wanted;});
  var hintWanted=isKo()?'여기를 눌러요':'Tap here';
  document.querySelectorAll('.v3-action-first .v3-action-hint').forEach(function(h){if(text(h.textContent)!==hintWanted)h.textContent=hintWanted;});
}
function scan(){scanPractice();scanCoach();syncLabels();}
function start(){
  scan();
  new MutationObserver(scan).observe(document.body,{subtree:true,childList:true});
  var l=document.getElementById('languageBtn');if(l)l.addEventListener('click',function(){setTimeout(syncLabels,0);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
