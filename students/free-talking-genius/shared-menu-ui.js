/* Phase 2 shared UI: visual-only menu and URL formats.
 * Original app keeps its working inline menu as a fallback when this script fails.
 * No auth, data loading, conversation, recording, scoring or event binding here. */
(function(global){
 'use strict';
 const markup="<section id=\"ftCharacter\" class=\"ft-character-screen\" hidden aria-label=\"캐릭터 선택\">\n <div class=\"ft-character-panel\">\n  <h2>친구를 골라요!</h2>\n  <p id=\"ftCharacterRound\" hidden></p>\n  <div class=\"ft-character-options\" role=\"group\" aria-label=\"대화 친구 선택\">\n   <button id=\"ftChooseLili\" class=\"ft-character-option ft-character-lili\" type=\"button\" data-voice=\"bunny-v3\" aria-pressed=\"false\">\n    <span class=\"ft-character-symbol\" aria-hidden=\"true\"></span><strong>Bunny Fox</strong>\n   </button>\n   <button id=\"ftChooseWilly\" class=\"ft-character-option ft-character-willy\" type=\"button\" data-voice=\"willy\" aria-pressed=\"false\">\n    <span class=\"ft-character-symbol\" aria-hidden=\"true\"></span><strong>AI Willi 2</strong>\n   </button>\n   <button id=\"ftChoosePigfish\" class=\"ft-character-option ft-character-pigfish\" type=\"button\" data-voice=\"pigfish\" aria-pressed=\"false\">\n    <span class=\"ft-character-symbol\" aria-hidden=\"true\"></span><strong>Pigfish</strong>\n   </button>\n   <button id=\"ftChooseWilli\" class=\"ft-character-option ft-character-willi\" type=\"button\" data-voice=\"marin\" aria-pressed=\"false\">\n    <span class=\"ft-character-symbol ft-willi-portrait\" aria-hidden=\"true\"><svg viewBox=\"0 0 100 100\"><circle cx=\"50\" cy=\"50\" r=\"40\" fill=\"none\" stroke=\"#69d7df\" stroke-width=\"7\"/><circle cx=\"50\" cy=\"50\" r=\"19\" fill=\"none\" stroke=\"#d6f2f4\" stroke-width=\"8\"/><path d=\"M50 31 A19 19 0 0 1 67 42\" fill=\"none\" stroke=\"#69c1cc\" stroke-width=\"7\" stroke-linecap=\"round\"/><path d=\"M33 57 A19 19 0 0 0 47 69\" fill=\"none\" stroke=\"#efadce\" stroke-width=\"7\" stroke-linecap=\"round\"/></svg></span><strong>Willo</strong>\n   </button>\n  </div>\n  <div class=\"ft-character-start-container\"><button id=\"ftCharacterContinue\" class=\"ft-character-continue\" type=\"button\" disabled>시작하기</button></div>\n  <button id=\"ftCharacterBack\" class=\"ft-character-back\" type=\"button\" aria-label=\"교재로 돌아가기\" hidden>교재로 돌아가기</button>\n </div>\n</section>";
 function makeMenu(){
  const template=document.createElement('template');
  template.innerHTML=markup;
  const menu=template.content.firstElementChild;
  if(!menu||menu.id!=='ftCharacter')throw Error('Shared character menu invalid');
  // Free Talking-only unlockable after Willo. Shared markup remains identical;
  // Speaking keeps this option hidden until its engine supports this character.
  const choices=menu.querySelector('.ft-character-options');
  const dusk=document.createElement('button');
  dusk.id='ftChooseDusk';dusk.type='button';
  dusk.className='ft-character-option ft-character-dusk';
  dusk.dataset.voice='dusk';dusk.setAttribute('aria-pressed','false');
  dusk.setAttribute('aria-disabled','true');
  dusk.hidden=true;
  dusk.innerHTML='<span class="ft-character-symbol" aria-hidden="true"></span><strong>Dusk</strong><small class="ft-dusk-lock">🔒 5,000 points</small>';
  choices?.append(dusk);
  return menu;
 }

 function createDuskUnlockUI(menu,threshold=5000){
  const button=menu?.querySelector('#ftChooseDusk');if(!button)return null;
  const label=button.querySelector('.ft-dusk-lock'),dialog=document.createElement('div');
  dialog.className='ft-dusk-unlock-dialog';dialog.hidden=true;
  dialog.innerHTML='<div class="ft-dusk-unlock-panel" role="dialog" aria-modal="true" aria-labelledby="ftDuskUnlockTitle" aria-describedby="ftDuskUnlockDescription"><span class="ft-dusk-unlock-icon" aria-hidden="true">✦</span><h3 id="ftDuskUnlockTitle">비밀 친구 Dusk</h3><p id="ftDuskUnlockDescription"></p><button type="button" class="ft-dusk-unlock-close">확인</button></div>';
  menu.append(dialog);
  const description=dialog.querySelector('#ftDuskUnlockDescription'),close=dialog.querySelector('.ft-dusk-unlock-close');
  let points=null;
  function dismiss(){dialog.hidden=true;button.focus()}
  function open(){
   const remaining=points==null?null:Math.max(0,threshold-points);
   description.textContent=remaining==null
    ? 'Dusk는 '+threshold.toLocaleString()+'포인트를 모으면 만날 수 있어요! 포인트를 확인한 뒤 다시 시도해 주세요.'
    : 'Dusk를 만나려면 총 '+threshold.toLocaleString()+'포인트가 필요해요. 앞으로 '+remaining.toLocaleString()+'포인트만 더 모으면 돼요!';
   dialog.hidden=false;close?.focus();
  }
  function update(next){
   points=Number.isFinite(next)?next:null;
   const unlocked=points!=null&&points>=threshold;
   button.hidden=false;button.classList.toggle('ft-dusk-is-locked',!unlocked);
   button.classList.toggle('ft-dusk-is-unlocked',unlocked);
   button.setAttribute('aria-disabled',String(!unlocked));
   button.setAttribute('aria-label',unlocked?'Dusk':'Dusk, 비밀 캐릭터, '+threshold.toLocaleString()+'포인트 필요');
   if(label){label.hidden=true;label.textContent='';}
   return unlocked;
  }
  close?.addEventListener('click',dismiss);
  dialog.addEventListener('click',event=>{if(event.target===dialog)dismiss()});
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();dismiss()}});
  update(null);return {update,open,close:dismiss};
 }
 function replace(existing){
  if(!existing||!existing.parentNode)return null;
  const menu=makeMenu();
  existing.replaceWith(menu);
  return menu;
 }
 function mount(host){
  if(!host)throw Error('Shared menu host missing');
  const menu=makeMenu();
  host.replaceChildren(menu);
  return menu;
 }
 const paths=Object.freeze({conversation:'/students/free-talking-hybrid-lab/',units:'/students/free-talking-genius/'});
 function conversationRoute({bookId,unitId,homeworkId}={}){
  const url=new URL(paths.conversation,location.origin);
  url.searchParams.set('release','1');
  if(bookId!=null)url.searchParams.set('book',String(bookId));
  if(unitId!=null)url.searchParams.set('unit',String(unitId));
  if(homeworkId!=null)url.searchParams.set('homework',String(homeworkId));
  return url;
 }
 function returnRoute({bookId,unitId}={}){
  const url=new URL(paths.units,location.origin);
  if(bookId&&unitId){url.searchParams.set('book',String(bookId));url.searchParams.set('unit',String(unitId));url.searchParams.set('return','1')}
  return url;
 }
 global.WillenaFTSharedMenu=Object.freeze({makeMenu,replace,mount,createDuskUnlockUI,paths,conversationRoute,returnRoute});
})(window);
