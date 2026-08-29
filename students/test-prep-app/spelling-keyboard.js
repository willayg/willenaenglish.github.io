(function(){
'use strict';
let hardwareMode=false;
let focusGuardInstalled=false;
function installStyle(){
 if(document.getElementById('tpSpellingKeyboardStyle'))return;
 const s=document.createElement('style');s.id='tpSpellingKeyboardStyle';s.textContent=`
 .vp-spell-tools{display:flex;justify-content:flex-end;margin:7px 0 0}.vp-spell-showkb{border:0;background:transparent;color:#55737b;font-size:12px;font-weight:700;text-decoration:underline;text-underline-offset:3px;padding:6px 8px;cursor:pointer}
 .vp-app-keyboard{margin:14px auto 0;max-width:620px;display:flex;flex-direction:column;gap:7px;user-select:none;-webkit-user-select:none}.vp-app-keyboard[hidden]{display:none!important}.vp-kb-row{display:flex;justify-content:center;gap:5px}.vp-kb-key{min-width:0;flex:1 1 0;max-width:54px;height:44px;border:1px solid #cfdde0;border-radius:9px;background:#fff;color:#26383f;font:800 15px/1 system-ui,sans-serif;box-shadow:0 1px 2px rgba(0,0,0,.05);touch-action:manipulation}.vp-kb-key:active{transform:translateY(1px);background:#eef7f7}.vp-kb-key.wide{max-width:104px;flex:1.8}.vp-kb-hint{text-align:center;color:#819399;font-size:11px;font-weight:600;margin-top:2px}
 @media (max-width:430px){.vp-app-keyboard{gap:5px}.vp-kb-row{gap:3px}.vp-kb-key{height:42px;border-radius:7px;font-size:14px}}
 `;document.head.appendChild(s);
}
function installFocusGuard(){
 if(focusGuardInstalled)return;focusGuardInstalled=true;
 const nativeFocus=HTMLInputElement.prototype.focus;
 HTMLInputElement.prototype.focus=function(...args){
  if(this?.id==='vpSpell'&&this.closest?.('#testPrepVocabPractice'))return;
  return nativeFocus.apply(this,args);
 };
}
function rows(){return[['Q','W','E','R','T','Y','U','I','O','P'],['A','S','D','F','G','H','J','K','L'],['Z','X','C','V','B','N','M']];}
function activeInput(){const i=document.querySelector('#testPrepVocabPractice #vpSpell');return i&&!i.disabled?i:null}
function setValue(input,value){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}
function append(input,ch){if(!input||input.disabled)return;setValue(input,input.value+ch.toLowerCase());}
function backspace(input){if(!input||input.disabled)return;setValue(input,input.value.slice(0,-1));}
function submit(){const b=document.querySelector('#testPrepVocabPractice #vpNext');if(b&&!b.disabled)b.click();}
function keyboardFor(input){return input?.closest('.vp-wrap')?.querySelector('.vp-app-keyboard')||null}
function hideKeyboard(input){const kb=keyboardFor(input);if(kb)kb.hidden=true;const show=input?.closest('.vp-wrap')?.querySelector('.vp-spell-showkb');if(show)show.hidden=false}
function showKeyboard(input){hardwareMode=false;const kb=keyboardFor(input);if(kb)kb.hidden=false;const show=input?.closest('.vp-wrap')?.querySelector('.vp-spell-showkb');if(show)show.hidden=true}
function lockInput(input){if(!input)return;input.readOnly=true;input.setAttribute('readonly','');input.setAttribute('inputmode','none');input.setAttribute('autocomplete','off');input.setAttribute('autocorrect','off');input.setAttribute('autocapitalize','off');input.setAttribute('spellcheck','false');input.setAttribute('aria-label','Spelling answer')}
function enhance(){
 installStyle();const input=activeInput();if(!input)return;lockInput(input);if(input.dataset.hybridKb==='1')return;
 input.dataset.hybridKb='1';
 const tools=document.createElement('div');tools.className='vp-spell-tools';tools.innerHTML='<button type="button" class="vp-spell-showkb" hidden>키보드 보기</button>';
 const kb=document.createElement('div');kb.className='vp-app-keyboard';kb.setAttribute('aria-label','영어 철자 키보드');
 kb.innerHTML=rows().map(row=>`<div class="vp-kb-row">${row.map(k=>`<button type="button" class="vp-kb-key" data-key="${k}">${k}</button>`).join('')}</div>`).join('')+`<div class="vp-kb-row"><button type="button" class="vp-kb-key wide" data-key="space">Space</button><button type="button" class="vp-kb-key wide" data-key="backspace">⌫</button><button type="button" class="vp-kb-key wide" data-key="enter">Enter</button></div><div class="vp-kb-hint">실제 키보드를 사용하면 이 키보드는 자동으로 숨겨집니다.</div>`;
 input.insertAdjacentElement('afterend',tools);tools.insertAdjacentElement('afterend',kb);
 kb.addEventListener('pointerdown',e=>e.preventDefault());
 kb.addEventListener('click',e=>{const b=e.target.closest('[data-key]');if(!b)return;const key=b.dataset.key;if(key==='backspace')backspace(input);else if(key==='space')append(input,' ');else if(key==='enter')submit();else append(input,key)});
 tools.querySelector('.vp-spell-showkb').onclick=()=>showKeyboard(input);
 const fine=window.matchMedia?.('(pointer:fine)')?.matches&&!window.matchMedia?.('(pointer:coarse)')?.matches;if(fine)hideKeyboard(input);
}
function hardwareKey(e){
 const input=activeInput();if(!input)return;
 if(e.ctrlKey||e.metaKey||e.altKey)return;
 const t=e.target;if(t&&t!==input&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))return;
 let handled=true;if(/^[a-zA-Z]$/.test(e.key))append(input,e.key);else if(e.key==='Backspace')backspace(input);else if(e.key===' ')append(input,' ');else if(e.key==='Enter')submit();else handled=false;
 if(!handled)return;e.preventDefault();hardwareMode=true;hideKeyboard(input);
}
function blockSoftKeyboard(e){
 const input=e.target instanceof Element?e.target.closest('#testPrepVocabPractice #vpSpell'):null;if(!input)return;
 lockInput(input);e.preventDefault();enhance();
}
function boot(){installStyle();installFocusGuard();new MutationObserver(()=>queueMicrotask(enhance)).observe(document.getElementById('assignedQuizPane')||document.body,{childList:true,subtree:true});document.addEventListener('pointerdown',blockSoftKeyboard,true);document.addEventListener('touchstart',blockSoftKeyboard,{capture:true,passive:false});document.addEventListener('keydown',hardwareKey,true);enhance()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();