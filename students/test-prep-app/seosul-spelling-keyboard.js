(function(){
'use strict';
let active=null,hardware=false,caps=false,repeatDelay=null,repeatTimer=null,repeatFastTimer=null;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const rows=()=>[['q','w','e','r','t','y','u','i','o','p'],['a','s','d','f','g','h','j','k','l'],['z','x','c','v','b','n','m']];
function isEnglishQuestion(){const m=$('#seosulModel');if(!m)return false;const t=String(m.textContent||'').replace('모범 답안','').trim();return !!t&&/[A-Za-z]/.test(t)&&!/[가-힣]/.test(t)}
function candidates(){const vocab=$('#testPrepVocabPractice #vpSpell');if(vocab&&!vocab.disabled&&vocab.offsetParent!==null)return[vocab];if(!isEnglishQuestion())return[];const split=$$('#card .seosul-split-input').filter(x=>!x.disabled);if(split.length)return split;const ta=$('#card #seosulAnswer');return ta&&!ta.disabled&&ta.offsetParent!==null?[ta]:[]}
function kb(){return $('#tpSeosulAppKeyboard')}
function lock(el){if(!el)return;el.readOnly=false;el.removeAttribute('readonly');el.setAttribute('inputmode','none');el.setAttribute('autocomplete','off');el.setAttribute('autocorrect','off');el.setAttribute('autocapitalize','off');el.setAttribute('spellcheck','false');el.classList.add('tp-seosul-caret')}
function range(){if(!active)return{start:0,end:0};const len=(active.value||'').length;let start=typeof active.selectionStart==='number'?active.selectionStart:len,end=typeof active.selectionEnd==='number'?active.selectionEnd:start;start=Math.max(0,Math.min(len,start));end=Math.max(start,Math.min(len,end));return{start,end}}
function restoreCaret(pos){if(!active)return;try{if(document.activeElement!==active)active.focus({preventScroll:true});active.setSelectionRange(pos,pos)}catch(_){try{active.setSelectionRange(pos,pos)}catch(__){}}}
function replaceSelection(text){if(!active||active.disabled)return;const v=active.value||'',{start,end}=range(),next=v.slice(0,start)+text+v.slice(end),pos=start+text.length;active.value=next;active.dispatchEvent(new Event('input',{bubbles:true}));restoreCaret(pos)}
function append(ch){replaceSelection(caps?ch.toUpperCase():ch.toLowerCase())}
function backspace(){if(!active||active.disabled)return;const v=active.value||'',{start,end}=range();if(start!==end){active.value=v.slice(0,start)+v.slice(end);active.dispatchEvent(new Event('input',{bubbles:true}));restoreCaret(start);return}if(start<=0)return;active.value=v.slice(0,start-1)+v.slice(end);active.dispatchEvent(new Event('input',{bubbles:true}));restoreCaret(start-1)}
function stopRepeat(){if(repeatDelay){clearTimeout(repeatDelay);repeatDelay=null}if(repeatTimer){clearInterval(repeatTimer);repeatTimer=null}if(repeatFastTimer){clearTimeout(repeatFastTimer);repeatFastTimer=null}}
function startRepeat(){stopRepeat();backspace();repeatDelay=setTimeout(()=>{repeatTimer=setInterval(backspace,50);repeatFastTimer=setTimeout(()=>{if(repeatTimer){clearInterval(repeatTimer);repeatTimer=setInterval(backspace,30)}},600)},240)}
function submit(){const b=active?.id==='vpSpell'?$('#testPrepVocabPractice #vpNext'):$('#seosulCheck');if(b&&!b.disabled)b.click()}
function renderCaps(){const k=kb();if(!k)return;k.querySelectorAll('[data-key].letter').forEach(b=>b.textContent=caps?b.dataset.key.toUpperCase():b.dataset.key.toLowerCase());const shift=k.querySelector('[data-key="shift"]');if(shift){shift.classList.toggle('on',caps);shift.setAttribute('aria-pressed',String(caps));shift.textContent='⇧'}}
function toggleCaps(){caps=!caps;renderCaps()}
function haptic(key){setTimeout(()=>{try{if(!navigator.vibrate)return;navigator.vibrate((key==='enter'||key==='backspace')?7:3)}catch(_){}},0)}
function addStyle(){if($('#tpSeosulCompactKbStyle'))return;const s=document.createElement('style');s.id='tpSeosulCompactKbStyle';s.textContent=`
#card .tp-seosul-caret,#testPrepVocabPractice .tp-seosul-caret{caret-color:#19777e!important;cursor:text!important}
#card .tp-seosul-caret:focus,#testPrepVocabPractice .tp-seosul-caret:focus{caret-color:#19777e!important}
#tpSeosulAppKeyboard{box-sizing:border-box;background:#eef3f5;border-top:1px solid #d7e0e3;padding:28px 10px 10px;z-index:11900}
#tpSeosulAppKeyboard .vp-kb-hide{position:absolute;top:7px;right:10px;border:1px solid #c9d8dc;border-radius:999px;background:#fff;color:#4e656d;font-weight:800;padding:5px 10px;font-size:12px;line-height:1.2}
#tpSeosulAppKeyboard .vp-kb-row{display:flex;justify-content:center;gap:5px;margin:5px 0}
#tpSeosulAppKeyboard .vp-kb-key{min-width:0;flex:1;max-width:72px;height:42px;border:1px solid #cbd6da;border-radius:9px;background:#fff;color:#24383f;font-size:18px;font-weight:800;box-shadow:0 1px 2px rgba(0,0,0,.06);transition:transform .035s ease,background-color .035s ease,box-shadow .035s ease,border-color .035s ease}
#tpSeosulAppKeyboard .vp-kb-key:active,#tpSeosulAppKeyboard .vp-kb-key.is-pressed{transform:translateY(1px) scale(.975);background:#d7e6e9;border-color:#a9c1c7;box-shadow:inset 0 1px 3px rgba(0,0,0,.12)}
#tpSeosulAppKeyboard .vp-kb-key.wide{max-width:none;font-size:14px}
#tpSeosulAppKeyboard .vp-kb-key.shift{max-width:72px;background:#f7fbfc;color:#526970}
#tpSeosulAppKeyboard .vp-kb-key.shift.on{border-color:#67d4da;background:#e9fbfc;color:#07888d}
#tpSeosulAppKeyboard .vp-kb-row.third{align-items:stretch}
#tpSeosulAppKeyboard .vp-kb-row.third .vp-kb-key.backspace{max-width:88px;flex:1.15}
#tpSeosulAppKeyboard .vp-kb-row.bottom{display:grid;grid-template-columns:1fr 88px;gap:5px;margin-top:5px}
#tpSeosulAppKeyboard .vp-kb-row.bottom .space{width:100%;max-width:none;min-width:0}
#tpSeosulAppKeyboard .vp-kb-row.bottom .enter{width:100%;max-width:none;min-width:0}
#tpSeosulAppKeyboard[hidden]{display:none!important}
body.tp-seosul-kb-open .app{padding-bottom:330px!important}
body.tp-seosul-kb-open{scroll-padding-bottom:340px}
@media (min-width:700px) and (pointer:coarse){
 #tpSeosulAppKeyboard{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);width:min(960px,calc(100vw - 28px));border:1px solid #bdeff1;border-radius:18px;box-shadow:0 14px 40px rgba(31,59,66,.18);padding:30px 12px 12px}
 #tpSeosulAppKeyboard .vp-kb-key{height:60px;max-width:90px;font-size:24px}
 #tpSeosulAppKeyboard .vp-kb-key.shift{max-width:90px}
 #tpSeosulAppKeyboard .vp-kb-row{gap:9px;margin:8px 0}
 #tpSeosulAppKeyboard .vp-kb-row.third .vp-kb-key.backspace{max-width:116px}
 #tpSeosulAppKeyboard .vp-kb-row.bottom{grid-template-columns:1fr 116px;gap:9px}
 body.tp-seosul-kb-open .app{padding-bottom:390px!important}
 body.tp-seosul-kb-open{scroll-padding-bottom:400px}
}
@media (max-width:699px){#tpSeosulAppKeyboard{position:fixed;left:0;right:0;bottom:0;width:100%;box-shadow:0 -8px 24px rgba(31,59,66,.12)}}
`;document.head.appendChild(s)}
function hide(){stopRepeat();if(kb())kb().hidden=true;document.body.classList.remove('tp-seosul-kb-open')}
function show(){hardware=false;ensure();if(kb())kb().hidden=false;document.body.classList.add('tp-seosul-kb-open');keepVisible()}
function keepVisible(){const k=kb(),target=active;if(!k||k.hidden||!target)return;requestAnimationFrame(()=>{const kr=k.getBoundingClientRect(),tr=target.getBoundingClientRect(),safe=kr.top-18;if(tr.bottom>safe)window.scrollBy({top:tr.bottom-safe,behavior:'smooth'})})}
function ensure(){addStyle();const inputs=candidates();if(!inputs.length){cleanup();return}inputs.forEach(lock);if(!active||!inputs.includes(active))active=inputs[0];if(kb())return;
 const k=document.createElement('div');k.id='tpSeosulAppKeyboard';k.className='vp-app-keyboard';k.setAttribute('aria-label','서술형 영어 키보드');k.hidden=true;
 const r=rows();
 const letterRows=`<div class="vp-kb-row">${r[0].map(x=>`<button type="button" class="vp-kb-key letter" data-key="${x}">${x}</button>`).join('')}</div><div class="vp-kb-row">${r[1].map(x=>`<button type="button" class="vp-kb-key letter" data-key="${x}">${x}</button>`).join('')}</div><div class="vp-kb-row third"><button type="button" class="vp-kb-key shift" data-key="shift" aria-pressed="false">⇧</button>${r[2].map(x=>`<button type="button" class="vp-kb-key letter" data-key="${x}">${x}</button>`).join('')}<button type="button" class="vp-kb-key backspace" data-key="backspace">⌫</button></div>`;
 k.innerHTML=`<button type="button" class="vp-kb-hide">키보드 숨기기</button>`+letterRows+`<div class="vp-kb-row bottom"><button type="button" class="vp-kb-key wide space" data-key="space">space</button><button type="button" class="vp-kb-key wide enter" data-key="enter">return</button></div>`;
 document.body.appendChild(k);renderCaps();
 k.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-key]');if(!b)return;const key=b.dataset.key;e.preventDefault();b.classList.add('is-pressed');haptic(key);if(key==='backspace'){startRepeat();b.dataset.downHandled='1'}else if(key==='space'){replaceSelection(' ');b.dataset.downHandled='1'}else if(key==='shift'){toggleCaps();b.dataset.downHandled='1'}else if(b.classList.contains('letter')){append(key);b.dataset.downHandled='1'}});
 const endPress=e=>{stopRepeat();const b=e.target.closest?.('[data-key]');if(b)b.classList.remove('is-pressed')};
 k.addEventListener('pointerup',endPress);k.addEventListener('pointercancel',endPress);k.addEventListener('pointerleave',endPress,true);
 k.addEventListener('click',e=>{const b=e.target.closest('[data-key]');if(!b)return;if(b.dataset.downHandled==='1'){delete b.dataset.downHandled;e.preventDefault();e.stopImmediatePropagation();return}const key=b.dataset.key;if(key==='enter'){if(active?.id==='vpSpell')submit();hide()}});
 k.querySelector('.vp-kb-hide').onclick=hide;
 hide();
}
function chooseTarget(e){const el=e.target?.closest?.('#card .seosul-split-input,#card #seosulAnswer,#testPrepVocabPractice #vpSpell');if(!el||!candidates().includes(el))return;active=el;lock(el);ensure();setTimeout(()=>{try{el.focus({preventScroll:true})}catch(_){el.focus()}show()},0)}
function syncFocusedTarget(e){const el=e.target;if(!el||!candidates().includes(el))return;active=el;lock(el);if(el.id==='vpSpell')show()}
function hardwareKey(e){const inputs=candidates();if(!inputs.length)return;if(e.ctrlKey||e.metaKey||e.altKey)return;const t=e.target;if(t&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)&&!inputs.includes(t))return;if(inputs.includes(t))active=t;if(!active)active=inputs[0];let handled=true;if(/^[a-zA-Z]$/.test(e.key))replaceSelection(e.key);else if(e.key==='Backspace')backspace();else if(e.key===' ')replaceSelection(' ');else if(e.key==='Enter')submit();else handled=false;if(!handled)return;e.preventDefault();hardware=true;hide()}
function cleanup(){if(candidates().length)return;stopRepeat();$('#tpSeosulAppKeyboard')?.remove();document.body.classList.remove('tp-seosul-kb-open');active=null;caps=false}
function inspect(){ensure();cleanup()}
function boot(){addStyle();document.addEventListener('pointerdown',chooseTarget,true);document.addEventListener('touchstart',chooseTarget,{capture:true,passive:true});document.addEventListener('focusin',syncFocusedTarget,true);document.addEventListener('keydown',hardwareKey,true);new MutationObserver(()=>queueMicrotask(inspect)).observe(document.body,{childList:true,subtree:true});inspect()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();