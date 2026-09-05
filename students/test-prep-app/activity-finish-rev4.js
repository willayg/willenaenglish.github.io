(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
function styles(){if($('#tpFinishRev4Styles'))return;const s=document.createElement('style');s.id='tpFinishRev4Styles';s.textContent=`
 #card.tp-skip-transition .choices,
 #card.tp-skip-transition .feedback,
 #card.tp-skip-transition .explanation,
 #card.tp-skip-transition .actions{visibility:hidden!important}
 #card.tp-skip-transition .tp-skip-wrap{visibility:visible!important}
 #card.tp-skip-transition .tp-skip{opacity:.45!important;pointer-events:none!important}
 `;document.head.appendChild(s)}
document.addEventListener('click',e=>{const t=e.target instanceof Element?e.target:null;if(!t)return;const skip=t.closest('#tpSkipQuestion');if(!skip)return;const card=$('#card');card?.classList.add('tp-skip-transition');setTimeout(()=>card?.classList.remove('tp-skip-transition'),180)},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',styles,{once:true});else styles();
})();