(function(global){
'use strict';
function isTablet(){return global.matchMedia&&global.matchMedia('(min-width:600px) and (max-width:1100px)').matches;}
function ko(){var b=document.getElementById('languageBtn');return !b||String(b.textContent||'').trim()==='English';}
function ensureAudioPosition(card,spelling,promptRow,slots){
  var audio=(promptRow&&promptRow.querySelector('.activity-spelling-listen,.activity-audio'))||card.querySelector('.activity-spelling-listen,.activity-audio');
  if(!audio)return;
  audio.classList.add('v2-tablet-spelling-listen');
  var listenWrap=audio.closest('.v2-tablet-spelling-listen-wrap');
  if(!listenWrap){listenWrap=document.createElement('div');listenWrap.className='v2-tablet-spelling-listen-wrap';listenWrap.appendChild(audio);}
  listenWrap.classList.add('v2-tablet-spelling-listen-above-slots');
  if(slots){
    if(listenWrap.parentElement!==spelling||listenWrap.nextSibling!==slots)spelling.insertBefore(listenWrap,slots);
  }else if(listenWrap.parentElement!==spelling){
    spelling.insertBefore(listenWrap,spelling.firstChild);
  }
  var oldWorkRow=spelling.querySelector('.v2-tablet-spelling-work-row');
  if(oldWorkRow&&!oldWorkRow.children.length)oldWorkRow.remove();
}
function decorateRoot(root){
  if(!root)return;
  var spelling=root.querySelector('.activity-letter-order');
  if(!spelling)return;
  var card=spelling.closest('.activity-card');
  if(!card)return;
  var promptRow=card.querySelector('.activity-spelling-prompt-row');
  var slots=spelling.querySelector('.activity-letter-slots');

  /* Audio placement is shared by mobile and tablet. */
  ensureAudioPosition(card,spelling,promptRow,slots);

  /* Everything below here is tablet-only decoration. */
  if(!isTablet())return;
  var alreadyDecorated=card.dataset.v2TabletSpellingHelp==='12';
  card.dataset.v2TabletSpellingHelp='12';
  card.classList.add('v2-tablet-spelling');
  var instruction=card.querySelector('.activity-context,.activity-instruction');
  if(!alreadyDecorated&&instruction&&!instruction.classList.contains('v2-tablet-spelling-instruction')){
    instruction.classList.add('v2-tablet-spelling-instruction');instruction.hidden=true;
    var help=document.createElement('button');help.type='button';help.className='v2-tablet-spelling-help';help.textContent='?';
    help.setAttribute('aria-label',ko()?'철자 도움말 보기':'Show spelling instructions');help.setAttribute('aria-expanded','false');
    help.addEventListener('click',function(){var open=instruction.hidden;instruction.hidden=!open;help.setAttribute('aria-expanded',open?'true':'false');});
    card.insertBefore(help,card.firstChild);
  }
  var prompt=promptRow&&promptRow.querySelector('.activity-prompt');
  if(prompt&&!prompt.classList.contains('v2-tablet-spelling-cue')){prompt.classList.add('v2-tablet-spelling-cue');card.insertBefore(prompt,spelling);}
  var actions=card.querySelector('.activity-actions');
  if(actions){actions.classList.add('v2-tablet-spelling-actions');if(actions.parentElement!==card)card.appendChild(actions);}
  if(promptRow&&!promptRow.children.length)promptRow.hidden=true;
}
function scan(){['v2ActivityRoot','aiCoachActivityRoot'].forEach(function(id){decorateRoot(document.getElementById(id));});}
function bind(){scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})(window);
