(function(){
'use strict';
let selectedButton=null;
let confirmed=false;
let activeRoot=null;

function rootConfig(el){
  const root=el?.closest?.('#testPrepVocabPractice, #testPrepVocabTestPractice');
  if(!root)return null;
  if(root.id==='testPrepVocabPractice'){
    const mode=window.WillenaVocabPractice?.mode;
    if(mode!=='ko-en'&&mode!=='en-ko')return null;
    return{root,next:root.querySelector('#vpNext'),choiceSelector:'.vp-choice'};
  }
  if(root.id==='testPrepVocabTestPractice')return{root,next:root.querySelector('#vtNext'),choiceSelector:'.vt-choice'};
  return null;
}

function resetIfNeeded(){
  if(selectedButton && !selectedButton.isConnected){
    selectedButton=null;
    confirmed=false;
    activeRoot=null;
  }
}

function ensureStyle(){
  if(document.getElementById('tpVocabChoiceConfirmStyle'))return;
  const style=document.createElement('style');
  style.id='tpVocabChoiceConfirmStyle';
  style.textContent=`
#testPrepVocabPractice .vp-choice.choice-selected:not(.correct):not(.wrong),
#testPrepVocabTestPractice .vt-choice.choice-selected:not(.correct):not(.wrong){
  border-color:var(--tp-accent)!important;
  background:color-mix(in srgb,var(--tp-accent) 12%,white)!important;
  box-shadow:0 0 0 3px color-mix(in srgb,var(--tp-accent) 16%,transparent)!important;
  transform:translateY(-1px);
}
#testPrepVocabPractice .vp-choice.choice-selected:not(.correct):not(.wrong)::after,
#testPrepVocabTestPractice .vt-choice.choice-selected:not(.correct):not(.wrong)::after{
  content:'✓';
  margin-left:8px;
  font-weight:900;
  color:var(--tp-cyan-dark);
}
`;
  document.head.appendChild(style);
}

function selectChoice(button,e){
  const cfg=rootConfig(button);
  if(!cfg||confirmed)return false;
  e.preventDefault();
  e.stopImmediatePropagation();
  selectedButton=button;
  activeRoot=cfg.root;
  cfg.root.querySelectorAll(cfg.choiceSelector).forEach(b=>{
    const on=b===button;
    b.classList.toggle('choice-selected',on);
    b.setAttribute('aria-pressed',on?'true':'false');
  });
  if(cfg.next){
    cfg.next.disabled=false;
    cfg.next.textContent='정답 확인';
  }
  return true;
}

function confirmChoice(next,e){
  const cfg=rootConfig(selectedButton);
  if(!cfg||confirmed||!selectedButton?.isConnected||cfg.next!==next)return false;
  e.preventDefault();
  e.stopImmediatePropagation();
  confirmed=true;
  selectedButton.onclick?.();
  cfg.root.querySelectorAll(cfg.choiceSelector).forEach(b=>{
    b.classList.remove('choice-selected');
    b.removeAttribute('aria-pressed');
  });
  next.textContent='다음';
  return true;
}

function boot(){
  ensureStyle();
  document.addEventListener('click',e=>{
    resetIfNeeded();
    const choice=e.target.closest('#testPrepVocabPractice .vp-choice, #testPrepVocabTestPractice .vt-choice');
    if(choice){selectChoice(choice,e);return;}
    const next=e.target.closest('#testPrepVocabPractice #vpNext, #testPrepVocabTestPractice #vtNext');
    if(next&&selectedButton&&!confirmed){confirmChoice(next,e);return;}
    if(next&&confirmed&&activeRoot&&next.closest('#testPrepVocabPractice, #testPrepVocabTestPractice')===activeRoot){
      selectedButton=null;
      confirmed=false;
      activeRoot=null;
    }
  },true);

  new MutationObserver(()=>resetIfNeeded()).observe(document.body,{childList:true,subtree:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
