(function(){
'use strict';

function cleanDialogueCard(){
  const card=document.getElementById('card');
  if(!card)return;
  const kind=card.querySelector('.seosul-kind');
  if(!kind||!String(kind.textContent||'').includes('대화 완성'))return;

  const instruction=card.querySelector('.seosul-instruction');
  const bank=card.querySelector('.seosul-bank');

  // Generated dialogue questions previously displayed the exact missing English
  // word as both a condition and a word-bank chip. That turns the task into copying.
  if(bank){
    const words=[...bank.querySelectorAll('.seosul-word')]
      .map(x=>String(x.textContent||'').trim())
      .filter(Boolean);
    if(words.length<=2)bank.remove();
  }

  if(instruction){
    const before=String(instruction.textContent||'').trim();
    let text=before
      .replace(/\s*\([^)]*\b사용\b[^)]*\)\s*$/u,'')
      .replace(/\s*\([^)]*use[^)]*\)\s*$/i,'')
      .trim();
    if(!text)text='대화의 빈칸에 들어갈 말을 쓰세요.';
    // Critical: only mutate the DOM when something actually changed.
    // The old unconditional textContent write recursively re-triggered this observer.
    if(before!==text)instruction.textContent=text;
  }
}

function boot(){
  cleanDialogueCard();
  const card=document.getElementById('card');
  if(!card)return;
  // Question changes replace child nodes, so childList is enough. Avoid watching
  // characterData here: this helper itself edits instruction text when needed.
  const observer=new MutationObserver(()=>queueMicrotask(cleanDialogueCard));
  observer.observe(card,{subtree:true,childList:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
console.log('[REV49k] dialogue cleanup is idempotent; no self-triggering observer loop');
})();
