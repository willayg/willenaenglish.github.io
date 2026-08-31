(function(){
'use strict';
let hardwareMode=false;
let focusGuardInstalled=false;
function installStyle(){
 if(document.getElementById('tpSpellingKeyboardStyle'))return;
 const s=document.createElement('style');s.id='tpSpellingKeyboardStyle';s.textContent=`
 .vp-spell-tools{display:flex;justify-content:flex-end;margin:7px 0 0}.vp-spell-showkb{border:0;background:transparent;color:#55737b;font-size:12px;font-weight:700;text-decoration:underline;text-underline-offset:3px;padding:6px 8px;cursor:pointer}
 .vp-app-keyboard{position:fixed;left:0;right:0;bottom:0;z-index:10050;width:100%;box-sizing:border-box;margin:0;padding:8px 8px calc(10px + env(safe-area-inset-bottom));background:#eef2f3;border-top:1px solid #c9d4d7;box-shadow:0 -8px 28px rgba(20,35,42,.16);display:flex;flex-direction:column;gap:7px;user-select:none;-webkit-user-select:none}.vp-app-keyboard[hidden]{display:none!important}.vp-kb-top{width:min(760px,100%);margin:0 auto;display:flex;align-items:center;gap:8px}.vp-kb-answer{min-width:0;flex:1;height:46px;box-sizing:border-box;border:1px solid #bcc9cd;border-radius:10px;background:#fff;padding:0 14px;display:flex;align-items:center;font:800 21px/1.1 system-ui,sans-serif;color:#26383f;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.vp-kb-answer:empty:before{content:'영어로 입력하세요';color:#8a999e;font-weight:700;font-size:15px}.vp-kb-hide{flex:0 0 auto;border:0;background:transparent;color:#526970;font-size:12px;font-weight:800;padding:8px 5px;cursor:pointer}.vp-kb-row{width:min(760px,100%);margin:0 auto;display:flex;justify-content:center;gap:6px;padding:0 2px;box-sizing:border-box}.vp-kb-key{min-width:0;flex:1 1 0;height:58px;border:1px solid #c3cfd2;border-radius:10px;background:#fff;color:#26383f;font:800 20px/1 system-ui,sans-serif;box-shadow:0 1px 2px rgba(0,0,0,.10);touch-action:manipulation}.vp-kb-key:active{transform:translateY(1px);background:#e2eaec}.vp-kb-key.wide{flex:1.75}.vp-kb-key.enter{font-size:17px}.vp-kb-hint{text-align:center;color:#71858c;font-size:11px;font-weight:700;margin:1px 0 0}
 @media (max-width:430px){.vp-app-keyboard{gap:6px;padding-left:5px;padding-right:5px}.vp-kb-top{gap:4px}.vp-kb-answer{height:43px;font-size:20px;padding:0 11px}.vp-kb-hide{font-size:11px;padding-left:3px;padding-right:3px}.vp-kb-row{gap:4px;padding:0}.vp-kb-key{height:55px;border-radius:8px;font-size:19px}.vp-kb-key.wide{height:58px}.vp-kb-key.enter{font-size:16px}}
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
function rows(){return[['q','w','e','r','t','y','u','i','o','p'],['a','s','d','f','g','h','j','k','l'],['z','x','c','v','b','n','m']];}
function activeInput(){const i=document.querySelector('#testPrepVocabPractice #vpSpell');return i&&!i.disabled?i:null}
function keyboardFor(){return document.getElementById('tpSpellingAppKeyboard')}
function answerDisplay(){return keyboardFor()?.querySelector('.vp-kb-answer')||null}
function syncAnswer(input){const d=answerDisplay();if(d)d.textContent=input?.value||''}
function setValue(input,value){input.value=value;syncAnswer(input);input.dispatchEvent(new Event('input',{bubbles:true}));}
function append(input,ch){if(!input||input.disabled)return;setValue(input,input.value+ch.toLowerCase());}
function backspace(input){if(!input||input.disabled)return;setValue(input,input.value.slice(0,-1));}
function submit(){const b=document.querySelector('#testPrepVocabPractice #vpNext');if(b&&!b.disabled)b.click();}
function showButton(input){return input?.closest('.vp-wrap')?.querySelector('.vp-spell-showkb')||null}
function hideKeyboard(input){const kb=keyboardFor();if(kb)kb.hidden=true;const show=showButton(input);if(show)show.hidden=false}
function keepTargetVisible(){
 const kb=keyboardFor(),target=document.querySelector('#testPrepVocabPractice .vp-prompt');if(!kb||kb.hidden||!target)return;
 requestAnimationFrame(()=>{const kr=kb.getBoundingClientRect(),tr=target.getBoundingClientRect(),safeBottom=kr.top-18;if(tr.bottom>safeBottom){window.scrollBy({top:tr.bottom-safeBottom,behavior:'smooth'})}});
}
function showKeyboard(input){hardwareMode=false;const kb=keyboardFor();if(kb)kb.hidden=false;const show=showButton(input);if(show)show.hidden=true;syncAnswer(input);keepTargetVisible()}
function lockInput(input){if(!input)return;input.readOnly=true;input.setAttribute('readonly','');input.setAttribute('inputmode','none');input.setAttribute('autocomplete','off');input.setAttribute('autocorrect','off');input.setAttribute('autocapitalize','off');input.setAttribute('spellcheck','false');input.setAttribute('aria-label','Spelling answer')}
function enhance(){
 installStyle();const input=activeInput();if(!input)return;lockInput(input);if(input.dataset.hybridKb==='1'){syncAnswer(input);return}
 input.dataset.hybridKb='1';
 document.getElementById('tpSpellingAppKeyboard')?.remove();
 const tools=document.createElement('div');tools.className='vp-spell-tools';tools.innerHTML='<button type="button" class="vp-spell-showkb" hidden>키보드 보기</button>';
 const kb=document.createElement('div');kb.id='tpSpellingAppKeyboard';kb.className='vp-app-keyboard';kb.setAttribute('aria-label','영어 철자 키보드');
 kb.innerHTML=`<div class="vp-kb-top"><div class="vp-kb-answer" aria-live="polite"></div><button type="button" class="vp-kb-hide">키보드 숨기기</button></div>`+rows().map(row=>`<div class="vp-kb-row">${row.map(k=>`<button type="button" class="vp-kb-key" data-key="${k}">${k}</button>`).join('')}</div>`).join('')+`<div class="vp-kb-row"><button type="button" class="vp-kb-key wide" data-key="space">space</button><button type="button" class="vp-kb-key wide" data-key="backspace">⌫</button><button type="button" class="vp-kb-key wide enter" data-key="enter">enter</button></div><div class="vp-kb-hint">실제 키보드를 사용하면 자동으로 숨겨집니다.</div>`;
 input.insertAdjacentElement('afterend',tools);document.body.appendChild(kb);syncAnswer(input);
 kb.addEventListener('pointerdown',e=>e.preventDefault());
 kb.addEventListener('click',e=>{const b=e.target.closest('[data-key]');if(!b)return;const key=b.dataset.key;if(key==='backspace')backspace(input);else if(key==='space')append(input,' ');else if(key==='enter')submit();else append(input,key)});
 tools.querySelector('.vp-spell-showkb').onclick=()=>showKeyboard(input);
 kb.querySelector('.vp-kb-hide').onclick=()=>hideKeyboard(input);
 const fine=window.matchMedia?.('(pointer:fine)')?.matches&&!window.matchMedia?.('(pointer:coarse)')?.matches;if(fine)hideKeyboard(input);else showKeyboard(input);
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
 lockInput(input);e.preventDefault();enhance();showKeyboard(input);
}
function cleanup(){if(!activeInput())document.getElementById('tpSpellingAppKeyboard')?.remove()}
function boot(){installStyle();installFocusGuard();new MutationObserver(()=>queueMicrotask(()=>{enhance();cleanup()})).observe(document.getElementById('assignedQuizPane')||document.body,{childList:true,subtree:true});document.addEventListener('pointerdown',blockSoftKeyboard,true);document.addEventListener('touchstart',blockSoftKeyboard,{capture:true,passive:false});document.addEventListener('keydown',hardwareKey,true);enhance()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();