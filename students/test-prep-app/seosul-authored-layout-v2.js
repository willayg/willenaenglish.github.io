(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
function addStyles(){if($('#seosulAuthoredLayoutV2Styles'))return;const s=document.createElement('style');s.id='seosulAuthoredLayoutV2Styles';s.textContent=`
#card .seosul-instruction{font-size:18px!important;line-height:1.6!important;font-weight:600!important;color:#56636d!important;margin-bottom:16px!important}
.seosul-multi-answer,.seosul-correction-answer{display:grid;gap:10px;margin:0 0 14px}
.seosul-answer-row{display:grid;grid-template-columns:44px 1fr;align-items:center;gap:10px}
.seosul-answer-row label,.seosul-correction-label{font-weight:800;color:#19777e;font-size:14px}
.seosul-split-input{width:100%;box-sizing:border-box;border:2px solid #d9e2e5;border-radius:14px;padding:13px 14px;font:600 16px/1.45 inherit;outline:none;background:#fff;color:#303941}
.seosul-split-input:focus{border-color:#58c3d2;box-shadow:0 0 0 3px rgba(88,195,210,.12)}
.seosul-correction-answer{grid-template-columns:1fr 34px 1fr;align-items:end}
.seosul-correction-cell{display:grid;gap:6px}.seosul-correction-arrow{font-size:24px;font-weight:800;text-align:center;color:#7b8790;padding-bottom:10px}
@media(max-width:600px){#card .seosul-instruction{font-size:17px!important}.seosul-correction-answer{grid-template-columns:1fr 26px 1fr}.seosul-answer-row{grid-template-columns:36px 1fr}}
`;document.head.appendChild(s)}
function isAuthored(){const k=$('#card .seosul-kind');return !!k&&/B Reference/i.test(k.textContent||'')}
function forceBadge(){if(!isAuthored())return;const pill=$('#card .source,#card .tp-source-pill');if(!pill)return;pill.textContent='B';pill.className='tp-source-pill b';pill.title='Book reference';pill.dataset.referenceResolved='1'}
function cleanKind(){const k=$('#card .seosul-kind');if(!k||!isAuthored())return;k.textContent=String(k.textContent||'').split('·')[0].trim()}
function modelAnswers(){const m=$('#seosulModel');if(!m)return[];const clone=m.cloneNode(true);clone.querySelector('b')?.remove();return clone.innerHTML.split(/<br\s*\/?\s*>/i).map(x=>{const d=document.createElement('div');d.innerHTML=x;return(d.textContent||'').trim()}).filter(Boolean)}
function trigger(textarea,value){textarea.value=value;textarea.dispatchEvent(new Event('input',{bubbles:true}))}
function buildMulti(textarea,answers){if(textarea.dataset.splitLayout==='1')return;textarea.dataset.splitLayout='1';textarea.style.display='none';const box=document.createElement('div');box.className='seosul-multi-answer';const marks=['ⓐ','ⓑ','ⓒ','ⓓ'];answers.forEach((_,i)=>{const row=document.createElement('div');row.className='seosul-answer-row';row.innerHTML=`<label>${marks[i]||i+1}</label><input class="seosul-split-input" autocomplete="off" spellcheck="false" placeholder="답 ${i+1}">`;box.appendChild(row)});textarea.parentNode.insertBefore(box,textarea);const sync=()=>trigger(textarea,$$('.seosul-split-input',box).map(x=>x.value.trim()).join('\n'));$$('.seosul-split-input',box).forEach(x=>x.addEventListener('input',sync));$('.seosul-split-input',box)?.focus()}
function buildCorrection(textarea,answer){if(textarea.dataset.splitLayout==='1')return;textarea.dataset.splitLayout='1';textarea.style.display='none';const box=document.createElement('div');box.className='seosul-correction-answer';box.innerHTML=`<div class="seosul-correction-cell"><div class="seosul-correction-label">틀린 부분</div><input class="seosul-split-input" id="seosulWrongPart" autocomplete="off" spellcheck="false" placeholder="찾아 쓰기"></div><div class="seosul-correction-arrow">→</div><div class="seosul-correction-cell"><div class="seosul-correction-label">고친 부분</div><input class="seosul-split-input" id="seosulCorrectPart" autocomplete="off" spellcheck="false" placeholder="바르게 고치기"></div>`;textarea.parentNode.insertBefore(box,textarea);const a=$('#seosulWrongPart',box),b=$('#seosulCorrectPart',box),sync=()=>trigger(textarea,`${a.value.trim()} → ${b.value.trim()}`);a.addEventListener('input',sync);b.addEventListener('input',sync);a.focus()}
function applyLayout(){if(!isAuthored())return;cleanKind();forceBadge();const textarea=$('#seosulAnswer');if(!textarea||textarea.dataset.splitLayout==='1')return;const answers=modelAnswers();if(answers.length>1){buildMulti(textarea,answers);return}const one=answers[0]||'';if(/^\s*.+?\s*→\s*.+?\s*$/.test(one)){buildCorrection(textarea,one)}}
function inspect(){addStyles();applyLayout();forceBadge()}
function boot(){addStyles();inspect();const root=$('#card')||document.body;new MutationObserver(()=>queueMicrotask(inspect)).observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
