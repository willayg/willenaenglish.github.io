(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
function clean(){
  const view=$('#naDiagBody [data-view="wrong"]');
  if(!view)return;
  const exact=$('#naExactWrongList',view);
  if(!exact||exact.dataset.ready!=='1')return;
  // The core diagnostic renders an older fallback list first. Once the exact list is ready,
  // hide those legacy cards so teachers only see the canonical wrong-question rendering.
  $$('.na-wrong-card',view).forEach(card=>{if(!card.closest('#naExactWrongList'))card.style.display='none'});
  // Also hide the old explanatory block that belongs to the legacy cards.
  $$('.na-insight',view).forEach(el=>{if(!el.closest('#naExactWrongList'))el.style.display='none'});
  // Put the exact list directly under the summary/analysis area instead of leaving it at the bottom.
  const grids=$$('.na-analysis-grid',view);
  const anchor=grids[grids.length-1]||$('.na-summary',view)||$('.na-subhead',view);
  if(anchor&&exact.previousElementSibling!==anchor)anchor.insertAdjacentElement('afterend',exact);
  // Safety: if an exact card somehow still carries a generic placeholder, make it visibly obvious
  // rather than showing a misleading fake question.
  $$('.na-question',exact).forEach(q=>{
    if(/^(recorded question|vocab record|vocab review|vocabulary record|question)$/i.test((q.textContent||'').trim())){
      q.textContent='어휘 문제를 불러오는 중…';
      q.dataset.needsVocabRepair='1';
    }
  });
}
function boot(){clean();new MutationObserver(clean).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-ready']});console.info('[naesin-wrong-display-fix] loaded')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();