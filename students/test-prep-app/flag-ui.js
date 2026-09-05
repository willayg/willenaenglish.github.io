(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const FLAG_SVG='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.5 3.5v17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7.5 4.5h9.3c.9 0 1.4 1 .9 1.7l-1.3 1.9 1.3 1.9c.5.7 0 1.7-.9 1.7H7.5z" fill="currentColor"/></svg>';
function styles(){if($('#tpUnifiedFlagStyles'))return;const s=document.createElement('style');s.id='tpUnifiedFlagStyles';s.textContent=`
.tp-unified-flag{width:38px!important;height:38px!important;min-width:38px!important;flex:0 0 38px!important;border:2px solid #f2bbce!important;background:#fff!important;color:#ee5f91!important;border-radius:50%!important;display:inline-grid!important;place-items:center!important;padding:0!important;margin:0!important;line-height:1!important;cursor:pointer!important;box-shadow:none!important}
.tp-unified-flag svg{display:block;width:18px;height:18px;pointer-events:none}
.tp-unified-flag:disabled{opacity:.38!important;cursor:default!important}
.tp-practice-head-right{display:flex!important;align-items:center!important;gap:9px!important;margin-left:auto!important}
.tp-exam46-active #card .card-head{align-items:center}
.tp-exam46-active #card .card-head>div:last-child{display:flex!important;align-items:center!important;gap:7px!important;margin-left:auto!important}
`;document.head.appendChild(s)}
function decorateButton(b){if(!b)return null;b.classList.add('tp-unified-flag');b.innerHTML=FLAG_SVG;b.setAttribute('aria-label',b.getAttribute('aria-label')||'문제 신고');b.title=b.title||'문제 신고';return b}
function decorateExisting(){for(const b of $$('.flag,.tqt-flag,.seosul-flag,.tp-practice-flag,#exam46Flag'))decorateButton(b)}
function cardFlagSlot(){const head=$('#card .card-head');if(!head)return null;let slot=head.querySelector(':scope > div:last-child');if(!slot||slot===head.firstElementChild){slot=document.createElement('div');slot.className='tp-unified-flag-slot';head.appendChild(slot)}return slot}
function placeExamFlag(){if(!document.querySelector('.app.tp-exam46-active'))return;const b=$('#exam46Flag');if(!b)return;const slot=cardFlagSlot();if(slot&&b.parentElement!==slot)slot.appendChild(b);decorateButton(b)}
function placePracticeFlags(){for(const root of $$('.vp-wrap,.vt-wrap,.sp-wrap')){const b=root.querySelector('.tp-practice-flag');if(b)decorateButton(b)}
 const vtu=$('.vtu-wrap');if(vtu&&!vtu.querySelector('.tp-practice-flag')){const head=vtu.querySelector('.vtu-head');const flagger=window.WillenaPracticeFlagger;if(head&&flagger?.open){const b=document.createElement('button');b.type='button';b.className='tp-practice-flag';decorateButton(b);b.onclick=e=>{e.preventDefault();e.stopPropagation();flagger.open({source_type:'vocab_test',source_id:`vocab_test:${Date.now()}`,snapshot:{page:location.pathname,lesson:window.WillenaAssignedTestPrep?.selection?.lesson||window.WillenaTestPrepAuth?.state?.lesson||null,practice_type:'vocab_test',title:vtu.querySelector('.vtu-title')?.textContent?.trim()||null,count:vtu.querySelector('.vtu-count')?.textContent?.trim()||null,prompt:vtu.querySelector('.vtu-prompt')?.textContent?.trim()||null,definition:vtu.querySelector('.vtu-def')?.textContent?.trim()||null,choices:[...vtu.querySelectorAll('.vtu-choice')].map(x=>x.textContent.trim()).filter(Boolean)}})};let right=head.querySelector('.tp-practice-head-right');if(!right){right=document.createElement('div');right.className='tp-practice-head-right';const existing=head.lastElementChild;if(existing)right.appendChild(existing);head.appendChild(right)}right.appendChild(b)}}
}
function sync(){styles();decorateExisting();placePracticeFlags();placeExamFlag()}
function boot(){sync();let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;sync()})}).observe(document.body,{childList:true,subtree:true});for(const e of ['exam46:start','exam46:answer','exam46:replacement','exam46:complete'])window.addEventListener(e,()=>setTimeout(sync,0))}
window.WillenaFlagUI={svg:FLAG_SVG,decorate:decorateButton,sync};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
console.log('[REV46m] unified flag SVG + position ready');
})();