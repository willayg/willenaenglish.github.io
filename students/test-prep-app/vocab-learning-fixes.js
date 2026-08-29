(function(){
'use strict';

function installHiddenFix(){
  if(document.getElementById('tpHiddenEngineFix'))return;
  const style=document.createElement('style');
  style.id='tpHiddenEngineFix';
  style.textContent='.engine-shell[hidden]{display:none!important}';
  document.head.appendChild(style);
}

function displayedVocabTotal(root){
  const counts=[...root.querySelectorAll('.vp-head .vp-count')];
  for(const el of counts){
    const m=String(el.textContent||'').match(/(\d+)\s+lexical\s+items/i);
    if(m)return Number(m[1])||0;
  }
  return 0;
}

function unlockCompletedVocabModes(){
  const root=document.querySelector('#testPrepVocabPractice .vp-wrap');
  if(!root)return;
  const controls=window.WillenaVocabCardControls;
  if(!controls)return;

  // The card controller used to count lexical entries that had no Korean
  // translation, while the visible card deck correctly omits them.  That
  // made a 55/55 deck look incomplete internally and left the later modes
  // locked forever.  Use the actual deck total shown by vocab-practice.
  const total=displayedVocabTotal(root);
  if(!total||Number(controls.seen||0)<total)return;

  root.querySelectorAll('.vp-mode').forEach(button=>{
    if(button.dataset.mode==='cards')return;
    button.disabled=false;
    button.classList.remove('vp-card-locked');
    button.removeAttribute('title');
    const lock=button.querySelector('.vp-lock-icon');
    if(lock)lock.hidden=true;
  });
}

function refresh(){
  installHiddenFix();
  unlockCompletedVocabModes();
}

function boot(){
  refresh();
  new MutationObserver(refresh).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','disabled','class']});
  setInterval(refresh,500);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
