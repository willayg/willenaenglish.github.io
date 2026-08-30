(function(){
'use strict';
let repeatDelay=null,repeatTimer=null,repeatFastTimer=null;
const FIELD='#card .seosul-split-input,#card #seosulAnswer';
function activeField(){
  const a=document.activeElement;
  if(a?.matches?.(FIELD)&&!a.disabled)return a;
  return [...document.querySelectorAll(FIELD)].find(x=>x.offsetParent!==null&&!x.disabled&&x.classList.contains('tp-seosul-caret'))||null;
}
function range(el){
  const len=(el.value||'').length;
  let start=typeof el.selectionStart==='number'?el.selectionStart:len;
  let end=typeof el.selectionEnd==='number'?el.selectionEnd:start;
  start=Math.max(0,Math.min(len,start));
  end=Math.max(start,Math.min(len,end));
  return{start,end};
}
function setCaret(el,pos){
  try{el.focus({preventScroll:true});el.setSelectionRange(pos,pos)}catch(_){try{el.setSelectionRange(pos,pos)}catch(__){}}
}
function insert(text){
  const el=activeField();if(!el)return;
  const v=el.value||'',{start,end}=range(el),pos=start+text.length;
  el.value=v.slice(0,start)+text+v.slice(end);
  el.dispatchEvent(new Event('input',{bubbles:true}));
  setCaret(el,pos);
}
function erase(){
  const el=activeField();if(!el)return;
  const v=el.value||'',{start,end}=range(el);
  if(start!==end){
    el.value=v.slice(0,start)+v.slice(end);
    el.dispatchEvent(new Event('input',{bubbles:true}));
    setCaret(el,start);return;
  }
  if(start<=0)return;
  el.value=v.slice(0,start-1)+v.slice(end);
  el.dispatchEvent(new Event('input',{bubbles:true}));
  setCaret(el,start-1);
}
function stopRepeat(){
  if(repeatDelay){clearTimeout(repeatDelay);repeatDelay=null}
  if(repeatTimer){clearInterval(repeatTimer);repeatTimer=null}
  if(repeatFastTimer){clearTimeout(repeatFastTimer);repeatFastTimer=null}
}
function startRepeat(){
  stopRepeat();
  erase();
  repeatDelay=setTimeout(()=>{
    repeatTimer=setInterval(erase,55);
    repeatFastTimer=setTimeout(()=>{
      if(repeatTimer){clearInterval(repeatTimer);repeatTimer=setInterval(erase,34)}
    },650);
  },280);
}
function keyFromEvent(e){return e.target?.closest?.('#tpSeosulAppKeyboard [data-key]')||null}
function onPointerDown(e){
  const b=keyFromEvent(e);if(!b)return;
  const key=b.dataset.key;
  if(key==='backspace'){
    e.preventDefault();
    startRepeat();
    b.dataset.fastHandled='1';
    return;
  }
  if(key==='space'){
    e.preventDefault();insert(' ');b.dataset.fastHandled='1';return;
  }
  if(b.classList.contains('letter')&&/^[a-z]$/i.test(key||'')){
    e.preventDefault();
    const shift=document.querySelector('#tpSeosulAppKeyboard [data-key="shift"]')?.classList.contains('on');
    insert(shift?key.toUpperCase():key.toLowerCase());
    b.dataset.fastHandled='1';
  }
}
function onClick(e){
  const b=keyFromEvent(e);if(!b||b.dataset.fastHandled!=='1')return;
  delete b.dataset.fastHandled;
  e.preventDefault();
  e.stopImmediatePropagation();
}
function onPointerEnd(){stopRepeat()}
document.addEventListener('pointerdown',onPointerDown,true);
document.addEventListener('click',onClick,true);
document.addEventListener('pointerup',onPointerEnd,true);
document.addEventListener('pointercancel',onPointerEnd,true);
window.addEventListener('blur',onPointerEnd);
})();
