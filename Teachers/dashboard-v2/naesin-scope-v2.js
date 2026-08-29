(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let suppress=false;
function addChip(row,section,label,defaultOn=false){if(!row||$(`.na-scope-chip[data-section="${section}"]`,row))return;const body=$('.na-scope-body',row);if(!body)return;const b=document.createElement('button');b.type='button';b.className='na-scope-chip'+(defaultOn?' on':'');b.dataset.section=section;b.textContent=label;b.onclick=e=>{e.stopPropagation();b.classList.toggle('on')};body.appendChild(b)}
function decorate(){if(suppress)return;const bg=$('#naFreshEditBg');if(!bg)return;const fresh=($('#naEditTitle')?.textContent||'').includes('새 시험');$$('#naScope .na-scope').forEach(row=>{
  const hasAny=$$('.na-scope-chip',row).length>0;if(!hasAny)return;
  addChip(row,'vocabulary','Vocabulary',fresh);
  addChip(row,'constructed_response','서술형',false);
  if(fresh){const s=$('.na-scope-chip[data-section="constructed_response"]',row);if(s?.classList.contains('on')){suppress=true;s.classList.remove('on');suppress=false}}
 });
 const practice=$('#naTaskPractice');if(practice&&!practice.querySelector('option[value="constructed_response"]')){const o=document.createElement('option');o.value='constructed_response';o.textContent='서술형';practice.appendChild(o)}
}
function keepSeosulOptional(){const fresh=($('#naEditTitle')?.textContent||'').includes('새 시험');if(!fresh)return;$$('#naScope .na-scope-chip[data-section="constructed_response"].on').forEach(x=>x.classList.remove('on'))}
function boot(){decorate();new MutationObserver(()=>{decorate();setTimeout(keepSeosulOptional,0)}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});document.addEventListener('click',e=>{if(e.target instanceof Element&&e.target.closest('#naWizardNext'))setTimeout(()=>{decorate();keepSeosulOptional()},0)},true)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();