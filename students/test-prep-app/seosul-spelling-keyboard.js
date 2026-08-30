(function(){
'use strict';
let active=null,hardware=false,caps=false;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const rows=()=>[['q','w','e','r','t','y','u','i','o','p'],['a','s','d','f','g','h','j','k','l'],['z','x','c','v','b','n','m']];
function isEnglishQuestion(){const m=$('#seosulModel');if(!m)return false;const t=String(m.textContent||'').replace('모범 답안','').trim();return !!t && /[A-Za-z]/.test(t) && !/[가-힣]/.test(t)}
function candidates(){if(!isEnglishQuestion())return[];const split=$$('#card .seosul-split-input').filter(x=>!x.disabled);if(split.length)return split;const ta=$('#card #seosulAnswer');return ta&&!ta.disabled&&ta.offsetParent!==null?[ta]:[]}
function kb(){return $('#tpSeosulAppKeyboard')}
function lock(el){if(!el)return;el.readOnly=true;el.setAttribute('readonly','');el.setAttribute('inputmode','none');el.setAttribute('autocomplete','off');el.setAttribute('autocorrect','off');el.setAttribute('autocapitalize','off');el.setAttribute('spellcheck','false')}
function setValue(v){if(!active||active.disabled)return;active.value=v;active.dispatchEvent(new Event('input',{bubbles:true}))}
function append(ch){setValue((active?.value||'')+(caps?ch.toUpperCase():ch.toLowerCase()))}
function backspace(){setValue((active?.value||'').slice(0,-1))}
function submit(){const b=$('#seosulCheck');if(b&&!b.disabled)b.click()}
function renderCaps(){const k=kb();if(!k)return;k.querySelectorAll('[data-key].letter').forEach(b=>b.textContent=caps?b.dataset.key.toUpperCase():b.dataset.key.toLowerCase());const shift=k.querySelector('[data-key="shift"]');if(shift){shift.classList.toggle('on',caps);shift.setAttribute('aria-pressed',String(caps));shift.textContent=caps?'⇧ ON':'⇧'}}
function toggleCaps(){caps=!caps;renderCaps()}
function addStyle(){if($('#tpSeosulCompactKbStyle'))return;const s=document.createElement('style');s.id='tpSeosulCompactKbStyle';s.textContent=`
#tpSeosulAppKeyboard{box-sizing:border-box;background:#eef3f5;border-top:1px solid #d7e0e3;padding:28px 10px 10px;z-index:11900}
#tpSeosulAppKeyboard .vp-kb-hide{position:absolute;top:7px;right:10px;border:1px solid #c9d8dc;border-radius:999px;background:#fff;color:#4e656d;font-weight:800;padding:5px 10px;font-size:12px;line-height:1.2}
#tpSeosulAppKeyboard .vp-kb-row{display:flex;justify-content:center;gap:5px;margin:5px 0}
#tpSeosulAppKeyboard .vp-kb-key{min-width:0;flex:1;max-width:72px;height:42px;border:1px solid #cbd6da;border-radius:9px;background:#fff;color:#24383f;font-size:18px;font-weight:800;box-shadow:0 1px 2px rgba(0,0,0,.06)}
#tpSeosulAppKeyboard .vp-kb-key.wide{max-width:none;font-size:14px}
#tpSeosulAppKeyboard .vp-kb-key.shift{max-width:72px;background:#f7fbfc;color:#526970}
#tpSeosulAppKeyboard .vp-kb-key.shift.on{border-color:#67d4da;background:#e9fbfc;color:#07888d}
#tpSeosulAppKeyboard[hidden]{display:none!important}
body.tp-seosul-kb-open .app{padding-bottom:330px!important}
body.tp-seosul-kb-open{scroll-padding-bottom:340px}
@media (min-width:700px) and (pointer:coarse){
 #tpSeosulAppKeyboard{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);width:min(760px,calc(100vw - 28px));border:1px solid #bdeff1;border-radius:18px;box-shadow:0 14px 40px rgba(31,59,66,.18);padding:30px 12px 12px}
 #tpSeosulAppKeyboard .vp-kb-key{height:38px;max-width:64px;font-size:17px}
 #tpSeosulAppKeyboard .vp-kb-key.shift{max-width:64px}
 #tpSeosulAppKeyboard .vp-kb-row{gap:6px;margin:4px 0}
 body.tp-seosul-kb-open .app{padding-bottom:285px!important}
 body.tp-seosul-kb-open{scroll-padding-bottom:295px}
}
@media (max-width:699px){
 #tpSeosulAppKeyboard{position:fixed;left:0;right:0;bottom:0;width:100%;box-shadow:0 -8px 24px rgba(31,59,66,.12)}
}
`;document.head.appendChild(s)}
function hide(){if(kb())kb().hidden=true;document.body.classList.remove('tp-seosul-kb-open')}
function show(){hardware=false;ensure();if(kb())kb().hidden=false;document.body.classList.add('tp-seosul-kb-open');keepVisible()}
function keepVisible(){const k=kb(),target=active;if(!k||k.hidden||!target)return;requestAnimationFrame(()=>{const kr=k.getBoundingClientRect(),tr=target.getBoundingClientRect(),safe=kr.top-18;if(tr.bottom>safe)window.scrollBy({top:tr.bottom-safe,behavior:'smooth'})})}
function ensure(){addStyle();const inputs=candidates();if(!inputs.length){cleanup();return}inputs.forEach(lock);if(!active||!inputs.includes(active))active=inputs[0];if(kb())return;
 const k=document.createElement('div');k.id='tpSeosulAppKeyboard';k.className='vp-app-keyboard';k.setAttribute('aria-label','서술형 영어 키보드');k.hidden=true;
 const letterRows=rows().map((row,i)=>`<div class="vp-kb-row">${i===2?'<button type="button" class="vp-kb-key shift" data-key="shift" aria-pressed="false">⇧</button>':''}${row.map(x=>`<button type="button" class="vp-kb-key letter" data-key="${x}">${x}</button>`).join('')}</div>`).join('');
 k.innerHTML=`<button type="button" class="vp-kb-hide">키보드 숨기기</button>`+letterRows+`<div class="vp-kb-row"><button type="button" class="vp-kb-key wide" data-key="space">space</button><button type="button" class="vp-kb-key wide" data-key="backspace">⌫</button><button type="button" class="vp-kb-key wide enter" data-key="enter">enter</button></div>`;
 document.body.appendChild(k);renderCaps();
 k.addEventListener('pointerdown',e=>e.preventDefault());
 k.addEventListener('click',e=>{const b=e.target.closest('[data-key]');if(!b)return;const key=b.dataset.key;if(key==='backspace')backspace();else if(key==='space')append(' ');else if(key==='enter')hide();else if(key==='shift')toggleCaps();else append(key)});
 k.querySelector('.vp-kb-hide').onclick=hide;
 hide();
}
function chooseTarget(e){const el=e.target?.closest?.('#card .seosul-split-input,#card #seosulAnswer');if(!el||!candidates().includes(el))return;active=el;lock(el);e.preventDefault();ensure();show()}
function hardwareKey(e){const inputs=candidates();if(!inputs.length)return;if(e.ctrlKey||e.metaKey||e.altKey)return;const t=e.target;if(t&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)&&!inputs.includes(t))return;if(inputs.includes(t))active=t;if(!active)active=inputs[0];let handled=true;if(/^[a-zA-Z]$/.test(e.key))setValue((active?.value||'')+e.key);else if(e.key==='Backspace')backspace();else if(e.key===' ')append(' ');else if(e.key==='Enter')submit();else handled=false;if(!handled)return;e.preventDefault();hardware=true;hide()}
function cleanup(){if(candidates().length)return;$('#tpSeosulAppKeyboard')?.remove();document.body.classList.remove('tp-seosul-kb-open');active=null;caps=false}
function inspect(){ensure();cleanup()}
function boot(){addStyle();document.addEventListener('pointerdown',chooseTarget,true);document.addEventListener('touchstart',chooseTarget,{capture:true,passive:false});document.addEventListener('keydown',hardwareKey,true);const root=$('#card')||document.body;new MutationObserver(()=>queueMicrotask(inspect)).observe(root,{childList:true,subtree:true});inspect()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();