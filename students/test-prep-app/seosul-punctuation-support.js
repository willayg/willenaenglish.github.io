(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const FIELD='#card .seosul-split-input,#card #seosulAnswer,#testPrepVocabPractice #vpSpell';
const PUNCT=['.',',','?','!','\'','-'];
let lastActive=null;
function addStyle(){if($('#tpSeosulPunctStyle'))return;const s=document.createElement('style');s.id='tpSeosulPunctStyle';s.textContent=`
#tpSeosulAppKeyboard .vp-kb-row.bottom{grid-template-columns:1fr 64px 88px!important;position:relative}
#tpSeosulAppKeyboard .vp-kb-key.punct{width:100%;max-width:none;min-width:0;font-size:16px}
#tpSeosulPunctPanel{position:absolute;right:91px;bottom:49px;display:flex;gap:5px;padding:7px;border:1px solid #cbd6da;border-radius:12px;background:#fff;box-shadow:0 8px 24px rgba(31,59,66,.18);z-index:3}
#tpSeosulPunctPanel[hidden]{display:none!important}
#tpSeosulPunctPanel button{width:40px;height:38px;border:1px solid #cbd6da;border-radius:9px;background:#f8fbfc;color:#24383f;font-size:18px;font-weight:800}
@media (min-width:700px) and (pointer:coarse){#tpSeosulAppKeyboard .vp-kb-row.bottom{grid-template-columns:1fr 78px 116px!important;gap:9px}#tpSeosulAppKeyboard .vp-kb-key.punct{font-size:18px}#tpSeosulPunctPanel{right:125px;bottom:70px;gap:7px;padding:9px}#tpSeosulPunctPanel button{width:46px;height:44px;font-size:20px}}
`;document.head.appendChild(s)}
function rememberField(el){if(el?.matches?.(FIELD)&&!el.disabled&&el.offsetParent!==null)lastActive=el}
function activeInput(){const a=document.activeElement;if(a?.matches?.(FIELD)&&!a.disabled){lastActive=a;return a}if(lastActive?.isConnected&&!lastActive.disabled&&lastActive.offsetParent!==null)return lastActive;return null}
function insertText(text){const el=activeInput();if(!el)return;const v=el.value||'',len=v.length,start=typeof el.selectionStart==='number'?el.selectionStart:len,end=typeof el.selectionEnd==='number'?el.selectionEnd:start,pos=start+text.length;el.value=v.slice(0,start)+text+v.slice(end);el.dispatchEvent(new Event('input',{bubbles:true}));try{el.focus({preventScroll:true});el.setSelectionRange(pos,pos)}catch(_){}}
function installKeyboard(){addStyle();const kb=$('#tpSeosulAppKeyboard'),bottom=kb?.querySelector('.vp-kb-row.bottom');if(!kb||!bottom||bottom.dataset.punctReady==='1')return;bottom.dataset.punctReady='1';const enter=bottom.querySelector('[data-key="enter"]');if(!enter)return;const btn=document.createElement('button');btn.type='button';btn.className='vp-kb-key wide punct';btn.dataset.punctToggle='1';btn.textContent='.,?';btn.setAttribute('aria-label','문장 부호');const panel=document.createElement('div');panel.id='tpSeosulPunctPanel';panel.hidden=true;panel.innerHTML=PUNCT.map(ch=>`<button type="button" data-punct="${ch==='\''?'&#39;':ch}">${ch==='\''?'&#39;':ch}</button>`).join('');bottom.insertBefore(btn,enter);bottom.appendChild(panel);btn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation()});btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();panel.hidden=!panel.hidden});panel.addEventListener('pointerdown',e=>e.preventDefault());panel.addEventListener('click',e=>{const p=e.target.closest('[data-punct]');if(!p)return;e.preventDefault();e.stopPropagation();insertText(p.dataset.punct);panel.hidden=true});
}
function modelAnswers(){const m=$('#seosulModel');if(!m)return[];const clone=m.cloneNode(true);clone.querySelector('b')?.remove();return clone.innerHTML.split(/<br\s*\/?\s*>/i).map(x=>{const d=document.createElement('div');d.innerHTML=x;return(d.textContent||'').trim()}).filter(Boolean)}
function relaxed(v){return String(v??'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[“”"]/g,'').replace(/[.!?,;:]+$/g,'').replace(/[-‐‑‒–—]/g,' ').replace(/\s+/g,' ').trim()}
function punctuationEquivalent(student,answers){if(!answers.length)return false;const parts=String(student||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);if(answers.length===1)return relaxed(student)===relaxed(answers[0])&&String(student).trim()!==String(answers[0]).trim();if(parts.length!==answers.length)return false;const a=parts.map(relaxed).sort(),b=answers.map(relaxed).sort();return a.every((x,i)=>x===b[i]);}
function normalizeBeforeCheck(){const ta=$('#seosulAnswer'),answers=modelAnswers();if(!ta||!answers.length||!ta.value.trim())return;if(!punctuationEquivalent(ta.value,answers))return;ta.value=answers.join('\n');ta.dispatchEvent(new Event('input',{bubbles:true}));}
function boot(){addStyle();installKeyboard();new MutationObserver(()=>queueMicrotask(installKeyboard)).observe(document.body,{childList:true,subtree:true});document.addEventListener('focusin',e=>rememberField(e.target),true);document.addEventListener('pointerdown',e=>rememberField(e.target),true);document.addEventListener('click',e=>{if(e.target.closest('#seosulCheck'))normalizeBeforeCheck()},true)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();