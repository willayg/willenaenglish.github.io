(function(){
'use strict';
let active=null,hardware=false;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const rows=()=>[['q','w','e','r','t','y','u','i','o','p'],['a','s','d','f','g','h','j','k','l'],['z','x','c','v','b','n','m']];
function isEnglishQuestion(){const m=$('#seosulModel');if(!m)return false;const t=String(m.textContent||'').replace('모범 답안','').trim();return !!t && /[A-Za-z]/.test(t) && !/[가-힣]/.test(t)}
function candidates(){if(!isEnglishQuestion())return[];const split=$$('#card .seosul-split-input').filter(x=>!x.disabled);if(split.length)return split;const ta=$('#card #seosulAnswer');return ta&&!ta.disabled&&ta.offsetParent!==null?[ta]:[]}
function kb(){return $('#tpSeosulAppKeyboard')}
function display(){return kb()?.querySelector('.vp-kb-answer')||null}
function sync(){const d=display();if(d)d.textContent=active?.value||''}
function lock(el){if(!el)return;el.readOnly=true;el.setAttribute('readonly','');el.setAttribute('inputmode','none');el.setAttribute('autocomplete','off');el.setAttribute('autocorrect','off');el.setAttribute('autocapitalize','off');el.setAttribute('spellcheck','false')}
function setValue(v){if(!active||active.disabled)return;active.value=v;sync();active.dispatchEvent(new Event('input',{bubbles:true}))}
function append(ch){setValue((active?.value||'')+ch.toLowerCase())}
function backspace(){setValue((active?.value||'').slice(0,-1))}
function submit(){const b=$('#seosulCheck');if(b&&!b.disabled)b.click()}
function hide(){if(kb())kb().hidden=true;const show=$('#seosulKbShow');if(show)show.hidden=false}
function show(){hardware=false;ensure();if(kb())kb().hidden=false;const show=$('#seosulKbShow');if(show)show.hidden=true;sync();keepVisible()}
function keepVisible(){const k=kb(),target=active;if(!k||k.hidden||!target)return;requestAnimationFrame(()=>{const kr=k.getBoundingClientRect(),tr=target.getBoundingClientRect(),safe=kr.top-14;if(tr.bottom>safe)window.scrollBy({top:tr.bottom-safe,behavior:'smooth'})})}
function ensure(){const inputs=candidates();if(!inputs.length){cleanup();return}inputs.forEach(lock);if(!active||!inputs.includes(active))active=inputs[0];if(kb()){sync();return}
 const tools=document.createElement('div');tools.id='seosulKbTools';tools.className='vp-spell-tools';tools.innerHTML='<button type="button" class="vp-spell-showkb" id="seosulKbShow" hidden>키보드 보기</button>';
 const anchor=inputs[inputs.length-1];anchor.insertAdjacentElement('afterend',tools);
 const k=document.createElement('div');k.id='tpSeosulAppKeyboard';k.className='vp-app-keyboard';k.setAttribute('aria-label','서술형 영어 키보드');
 k.innerHTML=`<div class="vp-kb-top"><div class="vp-kb-answer" aria-live="polite"></div><button type="button" class="vp-kb-hide">키보드 숨기기</button></div>`+rows().map(row=>`<div class="vp-kb-row">${row.map(x=>`<button type="button" class="vp-kb-key" data-key="${x}">${x}</button>`).join('')}</div>`).join('')+`<div class="vp-kb-row"><button type="button" class="vp-kb-key wide" data-key="space">space</button><button type="button" class="vp-kb-key wide" data-key="backspace">⌫</button><button type="button" class="vp-kb-key wide enter" data-key="enter">enter</button></div><div class="vp-kb-hint">실제 키보드를 사용하면 자동으로 숨겨집니다.</div>`;
 document.body.appendChild(k);sync();
 k.addEventListener('pointerdown',e=>e.preventDefault());
 k.addEventListener('click',e=>{const b=e.target.closest('[data-key]');if(!b)return;const key=b.dataset.key;if(key==='backspace')backspace();else if(key==='space')append(' ');else if(key==='enter')submit();else append(key)});
 $('#seosulKbShow').onclick=show;k.querySelector('.vp-kb-hide').onclick=hide;
 const fine=window.matchMedia?.('(pointer:fine)')?.matches&&!window.matchMedia?.('(pointer:coarse)')?.matches;if(fine)hide();else show();
}
function chooseTarget(e){const el=e.target?.closest?.('#card .seosul-split-input,#card #seosulAnswer');if(!el||!candidates().includes(el))return;active=el;lock(el);e.preventDefault();ensure();show()}
function hardwareKey(e){const inputs=candidates();if(!inputs.length)return;if(e.ctrlKey||e.metaKey||e.altKey)return;const t=e.target;if(t&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)&&!inputs.includes(t))return;if(inputs.includes(t))active=t;if(!active)active=inputs[0];let handled=true;if(/^[a-zA-Z]$/.test(e.key))append(e.key);else if(e.key==='Backspace')backspace();else if(e.key===' ')append(' ');else if(e.key==='Enter')submit();else handled=false;if(!handled)return;e.preventDefault();hardware=true;hide()}
function cleanup(){if(candidates().length)return;$('#tpSeosulAppKeyboard')?.remove();$('#seosulKbTools')?.remove();active=null}
function inspect(){ensure();cleanup()}
function boot(){document.addEventListener('pointerdown',chooseTarget,true);document.addEventListener('touchstart',chooseTarget,{capture:true,passive:false});document.addEventListener('keydown',hardwareKey,true);const root=$('#card')||document.body;new MutationObserver(()=>queueMicrotask(inspect)).observe(root,{childList:true,subtree:true});inspect()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();