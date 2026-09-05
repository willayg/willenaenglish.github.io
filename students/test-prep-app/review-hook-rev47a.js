(function(){
'use strict';
function questionFromEvent(d){return d?.question||d?.result?.question||null}
window.addEventListener('questionruntime:complete',e=>{const d=e.detail||{},q=questionFromEvent(d),r=d.result||{};if(!q||r.cancelled)return;const mode=d.context?.mode;if(mode==='review47a')return;if(r.correct===false)window.WillenaReviewQueue47a?.addWrong(q,{lesson:d.context?.lesson||null,section:r.section||q.section||null})});
})();
