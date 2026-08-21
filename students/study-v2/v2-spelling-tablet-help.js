(function(global){
'use strict';
function isTablet(){return global.matchMedia&&global.matchMedia('(min-width:600px) and (max-width:1100px)').matches;}
function decorateRoot(root){
  if(!isTablet()||!root)return;
  var spelling=root.querySelector('.activity-letter-order');
  if(!spelling)return;
  var card=spelling.closest('.activity-card');
  if(!card||card.dataset.v2TabletSpellingHelp==='1')return;
  card.dataset.v2TabletSpellingHelp='1';
  card.classList.add('v2-tablet-spelling');

  var instruction=card.querySelector('.activity-context,.activity-instruction');
  if(instruction){
    instruction.classList.add('v2-tablet-spelling-instruction');
    instruction.hidden=true;
    var help=document.createElement('button');
    help.type='button';
    help.className='v2-tablet-spelling-help';
    help.textContent='?';
    help.setAttribute('aria-label','Show spelling instructions');
    help.setAttribute('aria-expanded','false');
    help.addEventListener('click',function(){
      var open=instruction.hidden;
      instruction.hidden=!open;
      help.setAttribute('aria-expanded',open?'true':'false');
    });
    card.insertBefore(help,card.firstChild);
  }

  var actions=card.querySelector('.activity-actions');
  if(actions&&actions.parentNode!==spelling){
    actions.classList.add('v2-tablet-spelling-actions');
    var bank=spelling.querySelector('.activity-letter-bank');
    if(bank)spelling.insertBefore(actions,bank);else spelling.appendChild(actions);
  }
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
