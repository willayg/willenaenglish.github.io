// P1 performance rollback: teacher matrix review hydration intentionally disabled.
// The student wrong-answer system itself is unchanged; only per-row dashboard loading is paused.
(function(){
'use strict';
const REV='R13.03-P1-OFF';
function hideReviewColumn(){
  if(document.getElementById('na2-p1-hide-review'))return;
  const style=document.createElement('style');
  style.id='na2-p1-hide-review';
  style.textContent='.na2-matrix .na2-review-head,.na2-matrix .na2-review-cell{display:none!important}';
  document.head.appendChild(style);
}
function mount(){
  hideReviewColumn();
  console.info(`[Naesin V2 Review Counts] ${REV} hydration disabled for P1`);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
