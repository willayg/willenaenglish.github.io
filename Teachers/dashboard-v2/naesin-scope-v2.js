(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let wasOpen=false;
function addChip(row,section,label,defaultOn=false){if(!row||$(`.na-scope-chip[data-section="${section}"]`,row))return;const body=$('.na-scope-body',row);if(!body)return;const b=document.createElement('button');b.type='button';b.className='na-scope-chip'+(defaultOn?' on':'');b.dataset.section=section;b.textContent=label;b.onclick=e=>{e.stopPropagation();b.classList.toggle('on')};body.appendChild(b)}
function decorate(){const bg=$('#naFreshEditBg');if(!bg)return;$$('#naScope .na-scope').forEach(row=>{
  if(!$$('.na-scope-chip',row).length)return;
  addChip(row,'vocabulary','Vocabulary',true);
  addChip(row,'constructed_response','서술형',false);
 });
 const practice=$('#naTaskPractice');if(practice&&!practice.querySelector('option[value="constructed_response"]')){const o=document.createElement('option');o.value='constructed_response';o.textContent='서술형';practice.appendChild(o)}
 const open=bg.classList.contains('open');if(open&&!wasOpen){bg.dataset.seosulDefaulted='0'}wasOpen=open;
}
function defaultSeosulOffOnce(){const bg=$('#naFreshEditBg');if(!bg||bg.dataset.seosulDefaulted==='1')return;if(!(($('#naEditTitle')?.textContent||'').includes('새 시험')))return;if(!$('.na-wizard-step[data-step="3"].active',bg))return;$$('#naScope .na-scope-chip[data-section="constructed_response"].on').forEach(x=>x.classList.remove('on'));bg.dataset.seosulDefaulted='1'}
function boot(){decorate();new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});document.addEventListener('click',e=>{if(e.target instanceof Element&&e.target.closest('#naWizardNext'))setTimeout(()=>{decorate();defaultSeosulOffOnce()},0)},true)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();