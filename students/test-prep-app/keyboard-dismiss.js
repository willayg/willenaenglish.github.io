(function(){
'use strict';
if(window.__WillenaKeyboardDismiss)return;
window.__WillenaKeyboardDismiss=true;

const TARGET_SELECTOR='#card .tqt-input,#card #tqtAnswer,#card .seosul-split-input,#card #seosulAnswer,#card .wcri-input,#card .wcri-textarea,#testPrepVocabPractice #vpSpell,#vtuInput,#assignmentHome .tp49-input,#assignmentHome .wcri-input,#assignmentHome .wcri-textarea';

function dismiss(e){
  const target=e.target;
  if(!target||!target.closest)return;
  if(target.closest('#tpSeosulAppKeyboard'))return;
  if(target.closest(TARGET_SELECTOR))return;

  const kb=document.getElementById('tpSeosulAppKeyboard');
  if(kb&&!kb.hidden)kb.hidden=true;
  document.body.classList.remove('tp-seosul-kb-open');

  const active=document.activeElement;
  if(active&&active.matches&&active.matches(TARGET_SELECTOR)){
    try{active.blur()}catch(_){}
  }
}

document.addEventListener('pointerdown',dismiss,true);
console.log('[Test Prep] keyboard dismiss on outside tap active');
})();
