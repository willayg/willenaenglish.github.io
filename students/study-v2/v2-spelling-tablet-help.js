(function(global){
'use strict';
function isTablet(){return global.matchMedia&&global.matchMedia('(min-width:600px) and (max-width:1100px)').matches;}
function ko(){var b=document.getElementById('languageBtn');return !b||String(b.textContent||'').trim()==='English';}
function decorateRoot(root){
  if(!isTablet()||!root)return;
  var spelling=root.querySelector('.activity-letter-order');
  if(!spelling)return;
  var card=spelling.closest('.activity-card');
  if(!card||card.dataset.v2TabletSpellingHelp==='4')return;
  card.dataset.v2TabletSpellingHelp='4';
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
    card.insertBefore(prompt,spelling);
  }

  var slots=spelling.querySelector('.activity-letter-slots');
  var bank=spelling.querySelector('.activity-letter-bank');

  var audio=(promptRow&&promptRow.querySelector('.activity-spelling-listen,.activity-audio'))||card.querySelector('.activity-spelling-listen,.activity-audio');
  var actions=card.querySelector('.activity-actions');
  var workRow=document.createElement('div');
  workRow.className='v2-tablet-spelling-work-row';
  if(slots&&slots.nextSibling)spelling.insertBefore(workRow,slots.nextSibling);else spelling.appendChild(workRow);

  if(audio){
    audio.classList.add('v2-tablet-spelling-listen');
    var listenWrap=document.createElement('div');
    listenWrap.className='v2-tablet-spelling-listen-wrap';
    listenWrap.appendChild(audio);
    audio.addEventListener('click',function(){listenWrap.classList.add('is-used');},{once:true});
    workRow.appendChild(listenWrap);
  }

  if(actions){
    actions.classList.add('v2-tablet-spelling-actions');
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
