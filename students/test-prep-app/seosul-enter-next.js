(function(){
'use strict';
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
function fields(){return $$('#card .seosul-split-input').filter(x=>!x.disabled&&x.offsetParent!==null)}
function focusField(el){if(!el)return;try{el.focus({preventScroll:true})}catch(_){el.focus()}try{const n=(el.value||'').length;el.setSelectionRange(n,n)}catch(_){}el.scrollIntoView?.({block:'nearest',behavior:'smooth'})}
function advanceOrConfirm(){
  const inputs=fields();
  if(inputs.length<2)return false;
  const current=document.activeElement;
  let i=inputs.indexOf(current);
  if(i<0)i=0;
  if(i<inputs.length-1){focusField(inputs[i+1]);return true}
  const check=document.getElementById('seosulCheck');
  if(check&&!check.disabled)check.click();
  return true;
}
function onKeydown(e){
  if(e.key!=='Enter'||e.shiftKey||e.ctrlKey||e.metaKey||e.altKey)return;
  const inputs=fields();
  if(inputs.length<2)return;
  const target=e.target;
  if(!inputs.includes(target)&&!inputs.includes(document.activeElement))return;
  e.preventDefault();
  e.stopImmediatePropagation();
  advanceOrConfirm();
}
function onClick(e){
  const key=e.target?.closest?.('#tpSeosulAppKeyboard [data-key="enter"]');
  if(!key)return;
  const inputs=fields();
  if(inputs.length<2)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  advanceOrConfirm();
}
document.addEventListener('keydown',onKeydown,true);
document.addEventListener('click',onClick,true);
})();
