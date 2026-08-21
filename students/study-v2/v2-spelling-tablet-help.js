(function(global){
'use strict';
function isTablet(){return global.matchMedia&&global.matchMedia('(min-width:600px) and (max-width:1100px)').matches;}
function ko(){var b=document.getElementById('languageBtn');return !b||String(b.textContent||'').trim()==='English';}
function decorateRoot(root){
  if(!isTablet()||!root)return;
  var spelling=root.querySelector('.activity-letter-order');
  if(!spelling)return;
  var card=spelling.closest('.activity-card');
  if(!card||card.dataset.v2TabletSpellingHelp==='3')return;
  card.dataset.v2TabletSpellingHelp='3';
  card.classList.add('v2-tablet-spelling');

  var instruction=card.querySelector('.activity-context,.activity-instruction');
  if(instruction){
    instruction.classList.add('v2-tablet-spelling-instruction');
    instruction.hidden=true;
    var help=document.createElement('button');
    help.type='button';
    help.className='v2-tablet-spelling-help';
    help.textContent='?';
    help.setAttribute('aria-label',ko()?'철자 도움말 보기':'Show spelling instructions');
    help.setAttribute('aria-expanded','false');
    help.addEventListener('click',function(){
      var open=instruction.hidden;
      instruction.hidden=!open;
      help.setAttribute('aria-expanded',open?'true':'false');
    });
    card.insertBefore(help,card.firstChild);
  }

  var promptRow=card.querySelector('.activity-spelling-prompt-row');
  var prompt=promptRow&&promptRow.querySelector('.activity-prompt');
  if(prompt){
    prompt.classList.add('v2-tablet-spelling-cue');
    prompt.style.setProperty('width','100%','important');
    prompt.style.setProperty('text-align','center','important');
    prompt.style.setProperty('margin','0 0 6px','important');
    card.insertBefore(prompt,spelling);
  }

  spelling.style.setProperty('width','100%','important');
  spelling.style.setProperty('max-width','none','important');

  var slots=spelling.querySelector('.activity-letter-slots');
  var bank=spelling.querySelector('.activity-letter-bank');
  [slots,bank].filter(Boolean).forEach(function(el){
    el.style.setProperty('width','100%','important');
    el.style.setProperty('max-width','none','important');
    el.style.setProperty('box-sizing','border-box','important');
    el.style.setProperty('justify-content','space-evenly','important');
  });
  if(slots){
    Array.prototype.forEach.call(slots.querySelectorAll('.activity-letter-word'),function(word){
      word.style.setProperty('width','100%','important');
      word.style.setProperty('max-width','none','important');
      word.style.setProperty('justify-content','space-evenly','important');
    });
  }

  var audio=(promptRow&&promptRow.querySelector('.activity-spelling-listen,.activity-audio'))||card.querySelector('.activity-spelling-listen,.activity-audio');
  var actions=card.querySelector('.activity-actions');
  var workRow=document.createElement('div');
  workRow.className='v2-tablet-spelling-work-row';
  workRow.style.setProperty('order','2','important');
  workRow.style.setProperty('display','grid','important');
  workRow.style.setProperty('grid-template-columns','1fr auto 1fr','important');
  workRow.style.setProperty('align-items','center','important');
  workRow.style.setProperty('width','100%','important');
  workRow.style.setProperty('margin','4px 0 5px','important');
  if(slots&&slots.nextSibling)spelling.insertBefore(workRow,slots.nextSibling);else spelling.appendChild(workRow);

  if(audio){
    audio.classList.add('v2-tablet-spelling-listen');
    audio.style.setProperty('animation','none','important');
    audio.style.setProperty('transform','none','important');
    audio.style.setProperty('margin','0 auto','important');
    var listenWrap=document.createElement('div');
    listenWrap.className='v2-tablet-spelling-listen-wrap';
    listenWrap.style.cssText='grid-column:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;';
    listenWrap.appendChild(audio);
    var hint=document.createElement('small');
    hint.className='v2-tablet-spelling-listen-hint';
    hint.textContent=ko()?'눌러서 들어보세요':'Tap to listen';
    hint.style.cssText='display:block;color:#6f8190;font:800 .72rem/1.2 Poppins,sans-serif;white-space:nowrap;text-align:center;';
    listenWrap.appendChild(hint);
    workRow.appendChild(listenWrap);
  }

  if(actions){
    actions.classList.add('v2-tablet-spelling-actions');
    actions.style.setProperty('grid-column','3','important');
    actions.style.setProperty('justify-self','end','important');
    actions.style.setProperty('align-self','center','important');
    workRow.appendChild(actions);
  }

  if(bank)bank.style.setProperty('order','3','important');
  if(promptRow&&!promptRow.children.length)promptRow.hidden=true;
}
function scan(){['v2ActivityRoot','aiCoachActivityRoot'].forEach(function(id){decorateRoot(document.getElementById(id));});}
function bind(){
  scan();
  ['v2ActivityRoot','aiCoachActivityRoot'].map(function(id){return document.getElementById(id);}).filter(Boolean).forEach(function(root){
    new MutationObserver(scan).observe(root,{childList:true,subtree:true});
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})(window);
