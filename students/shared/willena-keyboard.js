let installedRoot=null;
let submitSelector='';
let submitHandler=null;
let keyboard=null;
let active=null;
let caps=false;
let repeatDelay=null;
let repeatTimer=null;
let repeatFastTimer=null;
let detachWatch=0;
let commaHoldTimer=0;
let commaHoldOpen=false;
let enterUpdateFrame=0;
let activeKeyPointer=null;

const ROWS=[
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['z','x','c','v','b','n','m']
];
const SYMBOLS=['!','\'','"',':',';','-','(',')','/','+','1','2','3','4','5','6','7','8','9','0','~'];
const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];

function language(el){return String(el?.dataset?.inputLanguage||'mixed').toLowerCase()}
function isRendererField(el){return !!el?.matches?.('[data-willena-text-entry]')}
function isAppField(el){return isRendererField(el)&&language(el)!=='ko'&&language(el)!=='native'}
function isVisible(el){return !!el&&!el.disabled&&el.isConnected&&el.offsetParent!==null}
function answerScope(){return active?.closest?.('[data-answer]')||null}
function currentFields(){const scope=answerScope();return scope?qa('[data-willena-text-entry]',scope).filter(isVisible):[]}

function ensureStyles(){
  if(q('#willenaSharedKeyboardStyles'))return;
  const s=document.createElement('style');
  s.id='willenaSharedKeyboardStyles';
  s.textContent=`
[data-willena-keyboard="app"]{caret-color:#19777e!important;cursor:text!important}
#willenaSharedKeyboard{box-sizing:border-box;background:#eef3f5;border-top:1px solid #d7e0e3;padding:28px 10px 10px;z-index:11900;pointer-events:auto;touch-action:manipulation}
#willenaSharedKeyboard[hidden]{display:none!important}
#willenaSharedKeyboard,#willenaSharedKeyboard *,#willenaSharedKeyboard *::before,#willenaSharedKeyboard *::after{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}
#willenaSharedKeyboard button{touch-action:none;-webkit-tap-highlight-color:transparent;cursor:pointer}
#willenaSharedKeyboard .wkb-hide{position:absolute;top:7px;right:10px;border:1px solid #c9d8dc;border-radius:999px;background:#fff;color:#4e656d;font-weight:800;padding:5px 10px;font-size:12px;line-height:1.2}
#willenaSharedKeyboard .wkb-row{display:flex;justify-content:center;gap:5px;margin:5px 0}
#willenaSharedKeyboard .wkb-key{min-width:0;flex:1;max-width:72px;height:42px;border:1px solid #cbd6da;border-radius:9px;background:#fff;color:#24383f;font-size:18px;font-weight:800;box-shadow:0 1px 2px rgba(0,0,0,.06);transition:background-color .035s ease,box-shadow .035s ease,border-color .035s ease;touch-action:none}
#willenaSharedKeyboard .wkb-key:active,#willenaSharedKeyboard .wkb-key.is-pressed{transform:translateY(1px);background:#bce6e8;border-color:#54afb7;box-shadow:inset 0 2px 5px rgba(0,0,0,.18)}
#willenaSharedKeyboard .wkb-key.backspace.is-pressed{background:#a4d5dc;border-color:#368b99;box-shadow:inset 0 2px 6px rgba(0,0,0,.2)}
#willenaSharedKeyboard .wkb-key.wide{max-width:none;font-size:14px}
#willenaSharedKeyboard .wkb-key.shift{max-width:72px;background:#f7fbfc;color:#526970}
#willenaSharedKeyboard .wkb-key.shift.on{border-color:#67d4da;background:#e9fbfc;color:#07888d}
#willenaSharedKeyboard .wkb-row.third{align-items:stretch}
#willenaSharedKeyboard .wkb-row.third .backspace{max-width:88px;flex:1.15}
#willenaSharedKeyboard .wkb-row.bottom{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.68fr) minmax(0,2.75fr) minmax(0,.68fr) minmax(0,.82fr) minmax(0,1.25fr);gap:5px;margin-top:5px;position:relative}
#willenaSharedKeyboard .wkb-row.bottom .space,#willenaSharedKeyboard .wkb-row.bottom .quick-punctuation,#willenaSharedKeyboard .wkb-row.bottom .enter,#willenaSharedKeyboard .wkb-row.bottom .confirm{width:100%;max-width:none;min-width:0}
#willenaSharedKeyboard .wkb-row.bottom .space{font-size:14px}
#willenaSharedKeyboard .wkb-row.bottom .confirm{background:#0799a6;color:#fff;border-color:#0799a6;font-size:14px;font-weight:900}
#willenaSharedKeyboard .wkb-row.bottom .comma{position:relative;border:2px solid #66bac0;background:#f2ffff;touch-action:none}
#willenaSharedKeyboard .wkb-row.bottom .comma .wkb-more{position:absolute;top:1px;right:4px;color:#077f89;font-size:10px;letter-spacing:-1px;line-height:1}
#willenaSharedKeyboard .wkb-row.bottom .comma .wkb-chevron{position:absolute;top:1px;left:4px;color:#077f89;font-size:11px;line-height:1}
#willenaSharedKeyboard .wkb-row.bottom .quick-punctuation{font-size:21px;font-weight:900}
#willenaSharedKeyboard .wkb-row.bottom .enter{border:1px solid #bad7e9;background:#dceef9;color:#255879;font-size:13px;font-weight:900}
#willenaSharedKeyboard .wkb-row.bottom .confirm[aria-disabled="true"]{opacity:.42}
#willenaSharedKeyboard .wkb-symbol-panel{position:absolute;right:0;bottom:calc(100% + 9px);width:min(360px,calc(100vw - 24px));display:flex;flex-wrap:wrap;justify-content:center;gap:5px;padding:7px;border:2px solid #66bac0;border-radius:12px;background:#fff;box-shadow:0 8px 24px rgba(31,59,66,.18);z-index:3}
#willenaSharedKeyboard .wkb-symbol-panel[hidden]{display:none!important}
#willenaSharedKeyboard .wkb-symbol-panel button{flex:0 0 40px;width:40px;height:38px;border:1px solid #cbd6da;border-radius:9px;background:#f8fbfc;color:#24383f;font-size:18px;font-weight:800}
body.willena-kb-open .app,body.willena-kb-open .shell{padding-bottom:350px!important}
body.willena-kb-open{scroll-padding-bottom:360px}
@media (min-width:700px) and (pointer:coarse){
 #willenaSharedKeyboard{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);width:min(960px,calc(100vw - 28px));border:1px solid #bdeff1;border-radius:18px;box-shadow:0 14px 40px rgba(31,59,66,.18);padding:30px 12px 12px}
 #willenaSharedKeyboard .wkb-key{height:60px;max-width:90px;font-size:24px}
 #willenaSharedKeyboard .wkb-key.shift{max-width:90px}
 #willenaSharedKeyboard .wkb-row{gap:9px;margin:8px 0}
 #willenaSharedKeyboard .wkb-row.third .backspace{max-width:116px}
 #willenaSharedKeyboard .wkb-row.bottom{grid-template-columns:minmax(0,1.15fr) minmax(0,.68fr) minmax(0,2.75fr) minmax(0,.68fr) minmax(0,.82fr) minmax(0,1.25fr);gap:9px}
 #willenaSharedKeyboard .wkb-row.bottom .enter{font-size:17px}
 #willenaSharedKeyboard .wkb-row.bottom .confirm{font-size:18px}
 #willenaSharedKeyboard .wkb-symbol-panel{right:0;bottom:calc(100% + 9px);gap:7px;padding:9px}
 #willenaSharedKeyboard .wkb-symbol-panel button{flex-basis:46px;width:46px;height:44px;font-size:20px}
 body.willena-kb-open .app,body.willena-kb-open .shell{padding-bottom:410px!important}
 body.willena-kb-open{scroll-padding-bottom:420px}
}
@media (max-width:699px){
 #willenaSharedKeyboard{position:fixed;left:0;right:0;bottom:0;width:100%;box-shadow:0 -8px 24px rgba(31,59,66,.12)}
}`;
  document.head.appendChild(s);
}

function selectionRange(){
  if(!active)return{start:0,end:0};
  const len=String(active.value||'').length;
  let start=typeof active.selectionStart==='number'?active.selectionStart:len;
  let end=typeof active.selectionEnd==='number'?active.selectionEnd:start;
  start=Math.max(0,Math.min(len,start));
  end=Math.max(start,Math.min(len,end));
  return{start,end};
}
function restoreCaret(pos){
  if(!active)return;
  try{
    if(document.activeElement!==active)active.focus({preventScroll:true});
    active.setSelectionRange(pos,pos);
  }catch(_){}
}
function replaceSelection(text){
  if(!active||active.disabled)return;
  const v=String(active.value||''),{start,end}=selectionRange(),next=v.slice(0,start)+text+v.slice(end),pos=start+text.length;
  active.value=next;
  active.dispatchEvent(new Event('input',{bubbles:true}));
  restoreCaret(pos);
}
function backspace(){
  if(!active||active.disabled)return;
  const v=String(active.value||''),{start,end}=selectionRange();
  if(start!==end){
    active.value=v.slice(0,start)+v.slice(end);
    active.dispatchEvent(new Event('input',{bubbles:true}));
    restoreCaret(start);
    return;
  }
  if(start<=0)return;
  active.value=v.slice(0,start-1)+v.slice(end);
  active.dispatchEvent(new Event('input',{bubbles:true}));
  restoreCaret(start-1);
}
function stopRepeat(){
  if(repeatDelay){clearTimeout(repeatDelay);repeatDelay=null}
  if(repeatTimer){clearInterval(repeatTimer);repeatTimer=null}
  if(repeatFastTimer){clearTimeout(repeatFastTimer);repeatFastTimer=null}
}
function startRepeat(){
  stopRepeat();
  backspace();
  repeatDelay=setTimeout(()=>{
    repeatTimer=setInterval(backspace,50);
    repeatFastTimer=setTimeout(()=>{
      if(repeatTimer){clearInterval(repeatTimer);repeatTimer=setInterval(backspace,30)}
    },600);
  },240);
}
function haptic(key){
  // Vibrate in the pointer's user-activation task. Delaying to a timer can
  // lose transient activation, particularly in Android browsers/PWAs.
  try{navigator.vibrate?.((key==='backspace'||key==='confirm')?12:8)}catch(_){}
}
function renderCaps(){
  if(!keyboard)return;
  qa('[data-key].letter',keyboard).forEach(b=>b.textContent=caps?b.dataset.key.toUpperCase():b.dataset.key.toLowerCase());
  const shift=q('[data-key="shift"]',keyboard);
  if(shift){shift.classList.toggle('on',caps);shift.setAttribute('aria-pressed',String(caps))}
}
function setSymbolPanel(open){const panel=keyboard&&q('.wkb-symbol-panel',keyboard);if(panel)panel.hidden=!open}
function cancelCommaHold(){if(commaHoldTimer){clearTimeout(commaHoldTimer);commaHoldTimer=0}}
function scheduleEnterUpdate(){if(enterUpdateFrame)return;enterUpdateFrame=requestAnimationFrame(()=>{enterUpdateFrame=0;if(keyboard&&!keyboard.hidden)updateEnter()})}

function currentSubmitButton(){
  if(!submitSelector)return null;
  return qa(submitSelector).filter(isVisible).find(b=>!b.disabled)||null;
}
function updateEnter(){
  if(!keyboard)return;
  const confirm=q('[data-key="confirm"]',keyboard);if(!confirm)return;
  const fields=currentFields(),submit=currentSubmitButton(),hasEmpty=fields.some(x=>!String(x.value||'').trim());
  confirm.textContent=submit?'확인':(fields.length>1&&hasEmpty?'다음':'확인');
  confirm.setAttribute('aria-disabled',String(!submit&&!(fields.length>1&&hasEmpty)));
}
function focusField(el){
  if(!isVisible(el)||!isAppField(el))return false;
  active=el;prepareField(el);
  try{el.focus({preventScroll:true})}catch(_){el.focus()}
  updateEnter();setSymbolPanel(el.dataset.willenaTextEntry==='correction-label');keepVisible();return true;
}
function focusNextEmpty(){
  const fields=currentFields().filter(isAppField);if(!fields.length)return false;
  const start=Math.max(0,fields.indexOf(active));
  for(let step=1;step<=fields.length;step++){
    const el=fields[(start+step)%fields.length];
    if(!String(el.value||'').trim())return focusField(el);
  }
  return false;
}
function submitOrNext({hide=true}={}){
  const submit=currentSubmitButton();
  if(!submit)return focusNextEmpty();
  const field=active;
  let ok=true;
  if(typeof submitHandler==='function'){
    try{if(submitHandler(submit,field)===false)ok=false}catch(_){ok=false}
  }else submit.click();
  if(ok&&hide)hideWillenaKeyboard();
  return ok;
}

function keepVisible(){
  if(!keyboard||keyboard.hidden||!active)return;
  requestAnimationFrame(()=>{
    if(!keyboard||keyboard.hidden||!active?.isConnected)return;
    const kr=keyboard.getBoundingClientRect(),tr=active.getBoundingClientRect(),safe=kr.top-18;
    if(tr.bottom>safe)window.scrollBy({top:tr.bottom-safe,behavior:'smooth'});
  });
}
function watchDetach(){
  // A 60fps DOM connectivity polling loop costs unnecessary work while typing.
  if(detachWatch)clearInterval(detachWatch);
  detachWatch=setInterval(()=>{
    if(!keyboard||keyboard.hidden){clearInterval(detachWatch);detachWatch=0;return}
    if(!active?.isConnected||active.disabled)hideWillenaKeyboard();
  },300);
}

function ensureKeyboard(){
  ensureStyles();
  if(keyboard?.isConnected)return keyboard;
  keyboard=document.createElement('div');
  keyboard.id='willenaSharedKeyboard';
  keyboard.setAttribute('aria-label','Willena 영어 키보드');
  keyboard.hidden=true;
  const rowHtml=ROWS.map((row,i)=>`<div class="wkb-row ${i===2?'third':''}">${i===2?'<button type="button" class="wkb-key shift" data-key="shift" aria-pressed="false">⇧</button>':''}${row.map(x=>`<button type="button" class="wkb-key letter" data-key="${x}">${x}</button>`).join('')}${i===2?'<button type="button" class="wkb-key backspace" data-key="backspace">⌫</button>':''}</div>`).join('');
  const symbolHtml=SYMBOLS.map(x=>`<button type="button" data-symbol="${x==="'"?'&#39;':x}">${x==="'"?'&#39;':x}</button>`).join('');
  keyboard.innerHTML=`<button type="button" class="wkb-hide">키보드 숨기기</button>${rowHtml}<div class="wkb-row bottom"><button type="button" class="wkb-key wide enter" data-key="enter" aria-label="새 줄">↵ Enter</button><button type="button" class="wkb-key quick-punctuation" data-key="question" aria-label="물음표">?</button><button type="button" class="wkb-key wide space" data-key="space">space</button><button type="button" class="wkb-key quick-punctuation" data-key="period" aria-label="마침표">.</button><button type="button" class="wkb-key quick-punctuation comma" data-key="comma" aria-label="쉼표. 길게 누르면 추가 문장 부호" title="길게 누르면 추가 문장 부호"><span class="wkb-chevron" aria-hidden="true">⌃</span>,<span class="wkb-more" aria-hidden="true">•••</span></button><button type="button" class="wkb-key wide confirm" data-key="confirm">확인</button><div class="wkb-symbol-panel" aria-label="추가 문장 부호" hidden>${symbolHtml}</div></div>`;
  document.body.appendChild(keyboard);renderCaps();

  keyboard.addEventListener('pointerdown',e=>{
    const keyBtn=e.target.closest('[data-key]'),symbolBtn=e.target.closest('[data-symbol]');
    if(!keyBtn&&!symbolBtn)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(symbolBtn){
      haptic('symbol');const symbol=symbolBtn.dataset.symbol||'';replaceSelection(symbol);
      if(active?.dataset?.willenaTextEntry==='correction-label'&&/^\d$/.test(symbol))focusNextEmpty();else setSymbolPanel(false);
      return;
    }
    const key=keyBtn.dataset.key;
    // Capture the touch so held Backspace keeps deleting even when the finger
    // drifts slightly outside the key, without the browser selecting its glyph.
    activeKeyPointer=e.pointerId;
    try{keyBtn.setPointerCapture(e.pointerId)}catch(_){}
    keyBtn.classList.add('is-pressed');haptic(key);keyBtn.dataset.downHandled='1';
    if(key==='comma'){
      cancelCommaHold();commaHoldOpen=false;
      commaHoldTimer=setTimeout(()=>{commaHoldTimer=0;commaHoldOpen=true;setSymbolPanel(true)},380);
      return;
    }
    if(key==='backspace')startRepeat();
    else if(key==='space')replaceSelection(' ');
    else if(key==='period')replaceSelection('.');
    else if(key==='enter'){if(active?.tagName==='TEXTAREA')replaceSelection('\n');else focusNextEmpty()}
    else if(key==='question')replaceSelection('?');
    else if(key==='shift'){caps=!caps;renderCaps()}
    else if(key==='confirm')keyBtn.dataset.submitOnUp='1';
    else if(keyBtn.classList.contains('letter'))replaceSelection(caps?key.toUpperCase():key);
  });

  keyboard.addEventListener('pointerup',e=>{
    const b=e.target.closest?.('[data-key]');
    if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();stopRepeat();activeKeyPointer=null;b.classList.remove('is-pressed');
    try{if(b.hasPointerCapture(e.pointerId))b.releasePointerCapture(e.pointerId)}catch(_){} 
    if(b.dataset.key==='comma'){cancelCommaHold();if(!commaHoldOpen)replaceSelection(',');return}
    if(b.dataset.submitOnUp==='1'){
      delete b.dataset.submitOnUp;
      if(submitOrNext({hide:false}))b.dataset.hideOnClick='1';
    }
  });
  const cancel=e=>{
    stopRepeat();cancelCommaHold();activeKeyPointer=null;
    const b=e.target.closest?.('[data-key]');
    if(b){b.classList.remove('is-pressed');delete b.dataset.submitOnUp;delete b.dataset.hideOnClick}
    e.stopPropagation();
  };
  keyboard.addEventListener('pointercancel',cancel);
  // Do not cancel on pointerleave: pointer capture preserves an intentional
  // held Backspace until pointerup/pointercancel.
  keyboard.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation()});
  keyboard.addEventListener('selectstart',e=>{e.preventDefault();e.stopPropagation()});
  keyboard.addEventListener('dragstart',e=>{e.preventDefault();e.stopPropagation()});
  keyboard.addEventListener('click',e=>{
    const b=e.target.closest('[data-key]');
    if(!b)return;
    const handled=b.dataset.downHandled==='1';
    const hideAfter=b.dataset.hideOnClick==='1';
    if(handled||hideAfter){
      delete b.dataset.downHandled;
      delete b.dataset.hideOnClick;
      e.preventDefault();e.stopImmediatePropagation();
      if(hideAfter)hideWillenaKeyboard();
    }
  });
  q('.wkb-hide',keyboard).onclick=hideWillenaKeyboard;
  return keyboard;
}

function prepareField(el){
  if(!isRendererField(el))return;
  if(isAppField(el)){
    el.dataset.willenaKeyboard='app';
    el.setAttribute('inputmode','none');
    el.setAttribute('autocomplete','off');
    el.setAttribute('autocorrect','off');
    el.setAttribute('autocapitalize','off');
    el.setAttribute('spellcheck','false');
  }else{
    el.dataset.willenaKeyboard='native';
    el.setAttribute('inputmode','text');
    if(language(el)==='ko')el.setAttribute('lang','ko');
  }
}
function showFor(el){
  if(!isAppField(el)||!isVisible(el))return;
  ensureKeyboard();active=el;prepareField(el);keyboard.hidden=false;document.body.classList.add('willena-kb-open');
  updateEnter();setSymbolPanel(el.dataset.willenaTextEntry==='correction-label');keepVisible();watchDetach();
}
function onPointerDown(e){
  if(keyboard?.contains(e.target))return;
  const el=e.target.closest?.('[data-willena-text-entry]');
  if(el){
    prepareField(el);
    if(isAppField(el))setTimeout(()=>showFor(el),0);else hideWillenaKeyboard();
    return;
  }
  if(keyboard&&!keyboard.hidden)hideWillenaKeyboard();
}
function onFocusIn(e){
  const el=e.target;if(!isRendererField(el))return;
  active=el;prepareField(el);if(isAppField(el))showFor(el);else hideWillenaKeyboard();
}
function onInput(e){if(!isRendererField(e.target))return;active=e.target;scheduleEnterUpdate()}
function onKeyDown(e){
  const el=e.target;if(!isAppField(el))return;active=el;
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key==='Enter'&&!e.shiftKey){if(el.tagName==='TEXTAREA')return;e.preventDefault();e.stopImmediatePropagation();focusNextEmpty();return}
  if(e.key.length===1||e.key==='Backspace'||e.key==='Delete'||e.key.startsWith('Arrow'))hideWillenaKeyboard();
}

export function hideWillenaKeyboard(){
  stopRepeat();cancelCommaHold();commaHoldOpen=false;activeKeyPointer=null;
  if(detachWatch)clearInterval(detachWatch);detachWatch=0;
  if(enterUpdateFrame)cancelAnimationFrame(enterUpdateFrame);enterUpdateFrame=0;
  if(keyboard){keyboard.hidden=true;setSymbolPanel(false)}
  document.body.classList.remove('willena-kb-open');
}

export function installWillenaKeyboard({root=document,submitSelector:selector='',onSubmit=null}={}){
  uninstallWillenaKeyboard();installedRoot=root||document;submitSelector=String(selector||'');submitHandler=typeof onSubmit==='function'?onSubmit:null;
  ensureKeyboard();installedRoot.addEventListener('pointerdown',onPointerDown,true);installedRoot.addEventListener('focusin',onFocusIn,true);installedRoot.addEventListener('input',onInput,true);installedRoot.addEventListener('keydown',onKeyDown,true);
  return{hide:hideWillenaKeyboard,uninstall:uninstallWillenaKeyboard};
}

export function uninstallWillenaKeyboard(){
  if(installedRoot){
    installedRoot.removeEventListener('pointerdown',onPointerDown,true);installedRoot.removeEventListener('focusin',onFocusIn,true);installedRoot.removeEventListener('input',onInput,true);installedRoot.removeEventListener('keydown',onKeyDown,true);
  }
  hideWillenaKeyboard();installedRoot=null;submitSelector='';submitHandler=null;active=null;
}