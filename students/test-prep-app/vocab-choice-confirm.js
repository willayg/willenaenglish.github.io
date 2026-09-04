(function(){
'use strict';
let selectedButton=null;
let selectedConfig=null;
let confirmed=false;
let advanceLabel='';

function configForChoice(button){
  if(button?.matches('#testPrepVocabPractice .vp-choice')){
    const mode=window.WillenaVocabPractice?.mode;
    if(mode!=='ko-en'&&mode!=='en-ko')return null;
    return{root:'#testPrepVocabPractice',choice:'.vp-choice',choices:'.vp-choices',next:'#vpNext'};
  }
  if(button?.matches('.vtu-wrap .vtu-choice')){
    return{root:'.vtu-wrap',choice:'.vtu-choice',choices:'.vtu-choices',next:'#vtuNext'};
  }
  return null;
}

function resetIfNeeded(){
  if(selectedButton&&!selectedButton.isConnected){
    selectedButton=null;
    selectedConfig=null;
    confirmed=false;
    advanceLabel='';
  }
}

function ensureStyle(){
  if(document.getElementById('tpVocabChoiceConfirmStyle'))return;
  const style=document.createElement('style');
  style.id='tpVocabChoiceConfirmStyle';
  style.textContent=`
#testPrepVocabPractice .vp-choice.choice-selected:not(.correct):not(.wrong),
.vtu-wrap .vtu-choice.choice-selected:not(.correct):not(.wrong){
  border-color:var(--tp-accent,#67d4da)!important;
  background:color-mix(in srgb,var(--tp-accent,#67d4da) 12%,white)!important;
  box-shadow:0 0 0 3px color-mix(in srgb,var(--tp-accent,#67d4da) 16%,transparent)!important;
  transform:translateY(-1px);
}
#testPrepVocabPractice .vp-choice.choice-selected:not(.correct):not(.wrong)::after,
.vtu-wrap .vtu-choice.choice-selected:not(.correct):not(.wrong)::after{
  content:'✓';
  margin-left:8px;
  font-weight:900;
  color:var(--tp-cyan-dark,#19777e);
}
`;
  document.head.appendChild(style);
}

function nextFor(config,button){
  return button?.closest(config.root)?.querySelector(config.next)||document.querySelector(`${config.root} ${config.next}`);
}

function selectChoice(button,e){
  const config=configForChoice(button);
  if(!config||confirmed)return false;
  e.preventDefault();
  e.stopImmediatePropagation();
  selectedButton=button;
  selectedConfig=config;
  button.closest(config.choices)?.querySelectorAll(config.choice).forEach(b=>{
    const on=b===button;
    b.classList.toggle('choice-selected',on);
    b.setAttribute('aria-pressed',on?'true':'false');
  });
  const next=nextFor(config,button);
  if(next){
    if(next.textContent!=='정답 확인')advanceLabel=next.textContent;
    next.disabled=false;
    next.textContent='정답 확인';
  }
  return true;
}

function confirmChoice(next,e){
  if(confirmed||!selectedButton?.isConnected||!selectedConfig)return false;
  e.preventDefault();
  e.stopImmediatePropagation();
  confirmed=true;
  selectedButton.onclick?.();
  selectedButton.closest(selectedConfig.choices)?.querySelectorAll(selectedConfig.choice).forEach(b=>{
    b.classList.remove('choice-selected');
    b.removeAttribute('aria-pressed');
  });
  if(advanceLabel)next.textContent=advanceLabel;
  return true;
}

function boot(){
  ensureStyle();
  document.addEventListener('click',e=>{
    resetIfNeeded();
    const choice=e.target.closest('#testPrepVocabPractice .vp-choice,.vtu-wrap .vtu-choice');
    if(choice){selectChoice(choice,e);return;}
    const next=e.target.closest('#testPrepVocabPractice #vpNext,.vtu-wrap #vtuNext');
    if(next&&selectedButton&&!confirmed){
      confirmChoice(next,e);
      return;
    }
    if(next&&confirmed){
      selectedButton=null;
      selectedConfig=null;
      confirmed=false;
      advanceLabel='';
    }
  },true);

  new MutationObserver(()=>resetIfNeeded()).observe(document.body,{childList:true,subtree:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
