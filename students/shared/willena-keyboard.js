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
let unblockFrame=0;
let blockedInteractionTargets=[];

const ROWS=[
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['z','x','c','v','b','n','m']
];
const SYMBOLS=['1','2','3','4','5','6','7','8','9','0','.',',','?','!',"'",'-','~'];
const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];

function language(el){return String(el?.dataset?.inputLanguage||'mixed').toLowerCase()}
function isRendererField(el){return !!el?.matches?.('[data-willena-text-entry]')}
function isAppField(el){return isRendererField(el)&&language(el)!=='ko'&&language(el)!=='native'}
function isVisible(el){return !!el&&!el.disabled&&el.isConnected&&el.offsetParent!==null}
function answerScope(){return active?.closest?.('[data-answer]')||null}
function currentFields(){const scope=answerScope();return scope?qa('[data-willena-text-entry]',scope).filter(isVisible):[]}

function rememberBlocked(el){
  if(!el?.style||blockedInteractionTargets.some(x=>x.el===el))return;
  blockedInteractionTargets.push({el,pointerEvents:el.style.pointerEvents});
  el.style.pointerEvents='none';
}
function restoreInteractionTargets(){
  cancelAnimationFrame(unblockFrame);unblockFrame=0;
  for(const item of blockedInteractionTargets){
    if(item.el?.isConnected)item.el.style.pointerEvents=item.pointerEvents;
  }
  blockedInteractionTargets=[];
}
function blockInteractionTargets(){
  restoreInteractionTargets();
  const scope=answerScope();
  if(scope){
    qa('button,a[href],[role="button"],select,[data-build],[data-choice],[data-chip]',scope).forEach(rememberBlocked);
  }
  if(submitSelector){
    for(const el of qa(submitSelector)){
      const footer=el.closest('nav,.bottom,[data-footer],[data-answer-footer]');
      rememberBlocked(footer||el);
    }
  }
}
function releaseInteractionTargetsAfterTap(){
  cancelAnimationFrame(unblockFrame);
  unblockFrame=requestAnimationFrame(()=>{
    unblockFrame=requestAnimationFrame(()=>restoreInteractionTargets());
  });
}

function ensureStyles(){
  if(q('#willenaSharedKeyboardStyles'))return;
  const s=document.createElement('style');
  s.id='willenaSharedKeyboardStyles';
  s.textContent=`
[data-willena-keyboard="app"]{caret-color:#19777e!important;cursor:text!important}
#willenaSharedKeyboard{box-sizing:border-box;background:#eef3f5;border-top:1px solid #d7e0e3;padding:28px 10px 10px;z-index:11900}
#willenaSharedKeyboard[hidden]{display:none!important}
#willenaSharedKeyboard .wkb-hide{position:absolute;top:7px;right:10px;border:1px solid #c9d8dc;border-radius:999px;background:#fff;color:#4e656d;font-weight:800;padding:5px 10px;font-size:12px;line-height:1.2}
#willenaSharedKeyboard .wkb-row{display:flex;justify-content:center;gap:5px;margin:5px 0}
#willenaSharedKeyboard .wkb-key{min-width:0;flex:1;max-width:72px;height:42px;border:1px solid #cbd6da;border-radius:9px;background:#fff;color:#24383f;font-size:18px;font-weight:800;box-shadow:0 1px 2px rgba(0,0,0,.06);transition:transform .035s ease,background-color .035s ease,box-shadow .035s ease,border-color .035s ease}
#willenaSharedKeyboard .wkb-key:active,#willenaSharedKeyboard .wkb-key.is-pressed{transform:translateY(1px) scale(.975);background:#d7e6e9;border-color:#a9c1c7;box-shadow:inset 0 1px 3px rgba(0,0,0,.12)}
#willenaSharedKeyboard .wkb-key.wide{max-width:none;font-size:14px}
#willenaSharedKeyboard .wkb-key.shift{max-width:72px;background:#f7fbfc;color:#526970}
#willenaSharedKeyboard .wkb-key.shift.on{border-color:#67d4da;background:#e9fbfc;color:#07888d}
#willenaSharedKeyboard .wkb-row.third{align-items:stretch}
#willenaSharedKeyboard .wkb-row.third .backspace{max-width:88px;flex:1.15}
#willenaSharedKeyboard .wkb-row.bottom{display:grid;grid-template-columns:minmax(0,1fr) 64px 88px;gap:5px;margin-top:5px;position:relative}
#willenaSharedKeyboard .wkb-row.bottom .space,#willenaSharedKeyboard .wkb-row.bottom .symbols,#willenaSharedKeyboard .wkb-row.bottom .enter{width:100%;max-width:none;min-width:0}
#willenaSharedKeyboard .wkb-row.bottom .symbols{font-size:15px}
#willenaSharedKeyboard .wkb-row.bottom .enter{border:2px solid #67d4da;background:#fff;color:#ee5f91;font-size:15px;font-weight:900;box-shadow:0 2px 5px rgba(25,119,126,.10)}
#willenaSharedKeyboard .wkb-row.bottom .enter[aria-disabled="true"]{opacity:.42}
#willenaSharedKeyboard .wkb-symbol-panel{position:absolute;right:91px;bottom:49px;width:min(420px,calc(100vw - 26px));display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px;padding:7px;border:1px solid #cbd6da;border-radius:12px;background:#fff;box-shadow:0 8px 24px rgba(31,59,66,.18);z-index:3}
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
 #willenaSharedKeyboard .wkb-row.bottom{grid-template-columns:minmax(0,1fr) 78px 116px;gap:9px}
 #willenaSharedKeyboard .wkb-row.bottom .enter{font-size:18px}
 #willenaSharedKeyboard .wkb-symbol-panel{right:125px;bottom:70px;gap:7px;padding:9px}
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
  setTimeout(()=>{try{navigator.vibrate?.((key==='enter'||key==='backspace')?7:3)}catch(_){ }},0);
}
function renderCaps(){
  if(!keyboard)return;
  qa('[data-key].letter',keyboard).forEach(b=>b.textContent=caps?b.dataset.key.toUpperCase():b.dataset.key.toLowerCase());
  const shift=q('[data-key="shift"]',keyboard);
  if(shift){shift.classList.toggle('on',caps);shift.setAttribute('aria-pressed',String(caps))}
}
function setSymbolPanel(open){
  const panel=keyboard&&q('.wkb-symbol-panel',keyboard);
  if(panel)panel.hidden=!open;
}

function currentSubmitButton(){
  if(!submitSelector)return null;
  const candidates=qa(submitSelector).filter(isVisible);
  return candidates.find(b=>!b.disabled)||null;
}
function updateEnter(){
  if(!keyboard)return;
  const enter=q('[data-key="enter"]',keyboard);
  if(!enter)return;
  const fields=currentFields(),submit=currentSubmitButton();
  const hasEmpty=fields.some(x=>!String(x.value||'').trim());
  enter.textContent=submit?'확인':(fields.length>1&&hasEmpty?'다음':'확인');
  enter.setAttribute('aria-disabled',String(!submit&&!(fields.length>1&&hasEmpty)));
}
function focusField(el){
  if(!isVisible(el)||!isAppField(el))return false;
  active=el;
  prepareField(el);
  try{el.focus({preventScroll:true})}catch(_){el.focus()}
  updateEnter();
  setSymbolPanel(el.dataset.willenaTextEntry==='correction-label');
  keepVisible();
  return true;
}
function focusNextEmpty(){
  const fields=currentFields().filter(isAppField);
  if(!fields.length)return false;
  const start=Math.max(0,fields.indexOf(active));
  for(let step=1;step<=fields.length;step++){
    const el=fields[(start+step)%fields.length];
    if(!String(el.value||'').trim())return focusField(el);
  }
  return false;
}
function submitOrNext(){
  const submit=currentSubmitButton();
  if(submit){
    hideWillenaKeyboard();
    if(typeof submitHandler==='function'){
      try{submitHandler(submit,active);return true}catch(_){return false}
    }
    submit.click();
    return true;
  }
  return focusNextEmpty();
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
  cancelAnimationFrame(detachWatch);
  const tick=()=>{
    if(!keyboard||keyboard.hidden){detachWatch=0;return}
    if(!active?.isConnected||active.disabled){hideWillenaKeyboard();detachWatch=0;return}
    detachWatch=requestAnimationFrame(tick);
  };
  detachWatch=requestAnimationFrame(tick);
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
  keyboard.innerHTML=`<button type="button" class="wkb-hide">키보드 숨기기</button>${rowHtml}<div class="wkb-row bottom"><button type="button" class="wkb-key wide space" data-key="space">space</button><button type="button" class="wkb-key wide symbols" data-key="symbols">.,?</button><button type="button" class="wkb-key wide enter" data-key="enter">확인</button><div class="wkb-symbol-panel" hidden>${symbolHtml}</div></div>`;
  document.body.appendChild(keyboard);
  renderCaps();

  keyboard.addEventListener('pointerdown',e=>{
    const keyBtn=e.target.closest('[data-key]');
    const symbolBtn=e.target.closest('[data-symbol]');
    if(!keyBtn&&!symbolBtn)return;
    e.preventDefault();
    e.stopPropagation();
    if(symbolBtn){
      haptic('symbol');
      const symbol=symbolBtn.dataset.symbol||'';
      replaceSelection(symbol);
      if(active?.dataset?.willenaTextEntry==='correction-label'&&/^\d$/.test(symbol))focusNextEmpty();
      else setSymbolPanel(false);
      return;
    }
    const key=keyBtn.dataset.key;
    keyBtn.classList.add('is-pressed');
    haptic(key);
    if(key==='backspace'){startRepeat();keyBtn.dataset.downHandled='1'}
    else if(key==='space'){replaceSelection(' ');keyBtn.dataset.downHandled='1'}
    else if(key==='shift'){caps=!caps;renderCaps();keyBtn.dataset.downHandled='1'}
    else if(key==='symbols'){setSymbolPanel(q('.wkb-symbol-panel',keyboard)?.hidden!==false);keyBtn.dataset.downHandled='1'}
    else if(key==='enter'){submitOrNext();keyBtn.dataset.downHandled='1'}
    else if(keyBtn.classList.contains('letter')){replaceSelection(caps?key.toUpperCase():key);keyBtn.dataset.downHandled='1'}
  });
  const end=e=>{
    stopRepeat();
    const b=e.target.closest?.('[data-key]');
    if(b)b.classList.remove('is-pressed');
    e.stopPropagation();
  };
  keyboard.addEventListener('pointerup',end);
  keyboard.addEventListener('pointercancel',end);
  keyboard.addEventListener('pointerleave',end,true);
  keyboard.addEventListener('click',e=>{
    const b=e.target.closest('[data-key]');
    if(b?.dataset.downHandled==='1'){
      delete b.dataset.downHandled;
      e.preventDefault();
      e.stopImmediatePropagation();
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
  ensureKeyboard();
  active=el;
  prepareField(el);
  keyboard.hidden=false;
  document.body.classList.add('willena-kb-open');
  blockInteractionTargets();
  updateEnter();
  setSymbolPanel(el.dataset.willenaTextEntry==='correction-label');
  keepVisible();
  watchDetach();
}
function onPointerDown(e){
  if(keyboard?.contains(e.target))return;
  const el=e.target.closest?.('[data-willena-text-entry]');
  if(el){
    prepareField(el);
    if(isAppField(el))setTimeout(()=>showFor(el),0);
    else hideWillenaKeyboard();
    return;
  }
  if(keyboard&&!keyboard.hidden)hideWillenaKeyboard();
}
function onFocusIn(e){
  const el=e.target;
  if(!isRendererField(el))return;
  active=el;
  prepareField(el);
  if(isAppField(el))showFor(el);else hideWillenaKeyboard();
}
function onInput(e){
  if(!isRendererField(e.target))return;
  active=e.target;
  updateEnter();
}
function onKeyDown(e){
  const el=e.target;
  if(!isAppField(el))return;
  active=el;
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key==='Enter'&&!e.shiftKey){
    e.preventDefault();
    e.stopImmediatePropagation();
    submitOrNext();
    return;
  }
  if(e.key.length===1||e.key==='Backspace'||e.key==='Delete'||e.key.startsWith('Arrow'))hideWillenaKeyboard();
}

export function hideWillenaKeyboard(){
  stopRepeat();
  cancelAnimationFrame(detachWatch);
  detachWatch=0;
  if(keyboard){
    keyboard.hidden=true;
    setSymbolPanel(false);
  }
  document.body.classList.remove('willena-kb-open');
  releaseInteractionTargetsAfterTap();
}

export function installWillenaKeyboard({root=document,submitSelector:selector='',onSubmit=null}={}){
  uninstallWillenaKeyboard();
  installedRoot=root||document;
  submitSelector=String(selector||'');
  submitHandler=typeof onSubmit==='function'?onSubmit:null;
  ensureKeyboard();
  installedRoot.addEventListener('pointerdown',onPointerDown,true);
  installedRoot.addEventListener('focusin',onFocusIn,true);
  installedRoot.addEventListener('input',onInput,true);
  installedRoot.addEventListener('keydown',onKeyDown,true);
  return{hide:hideWillenaKeyboard,uninstall:uninstallWillenaKeyboard};
}

export function uninstallWillenaKeyboard(){
  if(installedRoot){
    installedRoot.removeEventListener('pointerdown',onPointerDown,true);
    installedRoot.removeEventListener('focusin',onFocusIn,true);
    installedRoot.removeEventListener('input',onInput,true);
    installedRoot.removeEventListener('keydown',onKeyDown,true);
  }
  hideWillenaKeyboard();
  restoreInteractionTargets();
  installedRoot=null;
  submitSelector='';
  submitHandler=null;
  active=null;
}