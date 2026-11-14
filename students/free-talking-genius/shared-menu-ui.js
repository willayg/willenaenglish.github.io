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
  return menu;
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
 global.WillenaFTSharedMenu=Object.freeze({makeMenu,replace,mount,paths,conversationRoute,returnRoute});
})(window);
