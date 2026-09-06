(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
function addStyles(){if($('#seosulAuthoredLayoutV3Styles'))return;const s=document.createElement('style');s.id='seosulAuthoredLayoutV3Styles';s.textContent=`#card .seosul-instruction{font-size:18px!important;line-height:1.6!important;font-weight:600!important;color:#56636d!important;margin-bottom:16px!important}@media(max-width:600px){#card .seosul-instruction{font-size:17px!important}}`;document.head.appendChild(s)}
function isAuthored(){const k=$('#card .seosul-kind');return !!k&&/B Reference/i.test(k.textContent||'')}
function forceBadge(){if(!isAuthored())return;const pill=$('#card .source,#card .tp-source-pill');if(!pill)return;if(pill.textContent!=='B')pill.textContent='B';if(pill.className!=='tp-source-pill b')pill.className='tp-source-pill b';if(pill.title!=='Book reference')pill.title='Book reference';pill.dataset.referenceResolved='1'}
function cleanKind(){const k=$('#card .seosul-kind');if(!k||!isAuthored())return;const next=String(k.textContent||'').split('·')[0].trim();if(k.textContent!==next)k.textContent=next}
function modelAnswers(){const m=$('#seosulModel');if(!m)return[];const clone=m.cloneNode(true);clone.querySelector('b')?.remove();return clone.innerHTML.split(/<br\s*\/?\s*>/i).map(x=>{const d=document.createElement('div');d.innerHTML=x;return(d.textContent||'').trim()}).filter(Boolean)}
function applyLayout(){if(!isAuthored())return;cleanKind();forceBadge();const textarea=$('#seosulAnswer');if(!textarea||textarea.dataset.wcriMounted==='1')return;const api=window.WillenaConstructedResponseInput;if(!api?.mountTextarea)return;api.mountTextarea(textarea,modelAnswers())}
function inspect(){addStyles();applyLayout();forceBadge()}
function boot(){addStyles();inspect();const root=$('#card')||document.body;new MutationObserver(()=>queueMicrotask(inspect)).observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
console.log('[REV49c] authored seosul layout delegates input shape to shared component');
})();