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
    let text=String(instruction.textContent||'').trim();
    text=text
      .replace(/\s*\([^)]*\b사용\b[^)]*\)\s*$/u,'')
      .replace(/\s*\([^)]*use[^)]*\)\s*$/i,'')
      .trim();
    if(!text)text='대화의 빈칸에 들어갈 말을 쓰세요.';
    instruction.textContent=text;
  }
}

function boot(){
  cleanDialogueCard();
  const card=document.getElementById('card');
  if(!card)return;
  const observer=new MutationObserver(cleanDialogueCard);
  observer.observe(card,{subtree:true,childList:true,characterData:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
