(function(){
'use strict';
let selectedButton=null;
let confirmed=false;

function isChoiceMode(){
  const mode=window.WillenaVocabPractice?.mode;
  return mode==='ko-en'||mode==='en-ko';
}

function resetIfNeeded(){
  if(selectedButton && !selectedButton.isConnected){
    selectedButton=null;
    confirmed=false;
  }
}

function ensureStyle(){
  if(document.getElementById('tpVocabChoiceConfirmStyle'))return;
  const style=document.createElement('style');
  style.id='tpVocabChoiceConfirmStyle';
  style.textContent=`
#testPrepVocabPractice .vp-choice.choice-selected:not(.correct):not(.wrong){
  border-color:var(--tp-accent)!important;
  background:color-mix(in srgb,var(--tp-accent) 12%,white)!important;
  box-shadow:0 0 0 3px color-mix(in srgb,var(--tp-accent) 16%,transparent)!important;
  transform:translateY(-1px);
}
#testPrepVocabPractice .vp-choice.choice-selected:not(.correct):not(.wrong)::after{
  content:'✓';
  margin-left:8px;
  font-weight:900;
  color:var(--tp-cyan-dark);
}
`;
  document.head.appendChild(style);
}

function selectChoice(button,e){
  if(!isChoiceMode()||confirmed)return false;
  e.preventDefault();
  e.stopImmediatePropagation();
  selectedButton=button;
  button.closest('.vp-choices')?.querySelectorAll('.vp-choice').forEach(b=>{
    const on=b===button;
    b.classList.toggle('choice-selected',on);
    b.setAttribute('aria-pressed',on?'true':'false');
  });
  const next=document.querySelector('#testPrepVocabPractice #vpNext');
  if(next){
    next.disabled=false;
    next.textContent='정답 확인';
  }
  return true;
}

function confirmChoice(next,e){
  if(!isChoiceMode()||confirmed||!selectedButton?.isConnected)return false;
  e.preventDefault();
  e.stopImmediatePropagation();
  confirmed=true;
  selectedButton.onclick?.();
  selectedButton.closest('.vp-choices')?.querySelectorAll('.vp-choice').forEach(b=>{
    b.classList.remove('choice-selected');
    b.removeAttribute('aria-pressed');
  });
  next.textContent=next.closest('#testPrepVocabPractice')?.querySelectorAll('.vp-choice').length
    ? (document.querySelector('#testPrepVocabPractice .vp-count') ? next.textContent : next.textContent)
    : next.textContent;
  return true;
}

function boot(){
  ensureStyle();
  document.addEventListener('click',e=>{
    resetIfNeeded();
    const choice=e.target.closest('#testPrepVocabPractice .vp-choice');
    if(choice){selectChoice(choice,e);return;}
    const next=e.target.closest('#testPrepVocabPractice #vpNext');
    if(next&&selectedButton&&!confirmed){
      if(confirmChoice(next,e)){
        next.textContent='다음';
      }
      return;
    }
    if(next&&confirmed){
      selectedButton=null;
      confirmed=false;
    }
  },true);

  new MutationObserver(()=>resetIfNeeded()).observe(document.body,{childList:true,subtree:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
