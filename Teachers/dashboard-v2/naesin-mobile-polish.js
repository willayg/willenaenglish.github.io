(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
function inject(){if($('#naMobilePolishStyles'))return;const s=document.createElement('style');s.id='naMobilePolishStyles';s.textContent=`
/* Edit / create test modal */
#naFreshEditBg .na-modal{border:2px solid #58c3d2!important}
#naFreshEditBg .na-modal-head{border-bottom:2px solid #58c3d2!important;padding:20px 24px!important}
#naFreshEditBg .na-modal-head h2{font-size:1.42rem!important}
#naFreshEditBg .na-modal-head p{font-size:.82rem!important;line-height:1.5!important}
#naFreshEditBg .na-modal-body{padding:22px 24px!important}
#naFreshEditBg .na-field{padding:14px 0!important;margin:0!important;border-bottom:1.5px solid #e4e9ec!important}
#naFreshEditBg .na-form-grid{gap:18px!important}
#naFreshEditBg .na-field label{font-size:.82rem!important;margin-bottom:10px!important}
#naFreshEditBg .na-input{font-size:1rem!important;min-height:48px!important;padding:12px 14px!important;border:1.5px solid #d8e0e4!important}
#naFreshEditBg .na-choice{font-size:1rem!important;min-height:52px!important;border:1.5px solid #d8e0e4!important}
#naFreshEditBg .na-choice.on{border:2px solid #58c3d2!important}
#naFreshEditBg .na-student-pick{border:1.5px solid #d8e0e4!important;margin-top:8px!important}
#naFreshEditBg .na-pick-row{padding:12px 10px!important;border-bottom:1px solid #edf0f2!important}
#naFreshEditBg .na-pick-row:last-child{border-bottom:0!important}
#naFreshEditBg .na-pick-row b{font-size:.95rem!important}
#naFreshEditBg .na-pick-row small{font-size:.75rem!important}
#naFreshEditBg .na-modal-foot{border-top:2px solid #58c3d2!important;padding:15px 22px!important}
#naFreshEditBg .na-modal-foot .na-btn{font-size:.9rem!important;min-height:44px!important}

/* Diagnostic screens */
#naFreshDiagBg .na-modal-head h2{font-size:1.45rem!important}
#naFreshDiagBg .na-modal-head p{font-size:.8rem!important}
#naFreshDiagBg .na-subhead h3{font-size:1.18rem!important}
#naFreshDiagBg .na-back{font-size:.82rem!important;padding:9px 12px!important}
#naFreshDiagBg .na-stat b{font-size:1.28rem!important}
#naFreshDiagBg .na-stat span{font-size:.72rem!important;line-height:1.35!important}
#naFreshDiagBg .na-panel h3{font-size:1rem!important}
#naFreshDiagBg .na-bar-row{font-size:.82rem!important;grid-template-columns:145px 1fr 58px!important;padding:12px 0!important;gap:10px!important}
#naFreshDiagBg .na-bar-row b{font-size:.82rem!important;line-height:1.3!important}
#naFreshDiagBg .na-bar-row strong{font-size:.82rem!important}
#naFreshDiagBg .na-track{height:10px!important}
#naFreshDiagBg .na-insight{font-size:.78rem!important;line-height:1.5!important;padding:13px!important}

/* Exact wrong-answer cards */
#naExactWrongList .na-panel-title{font-size:1.08rem!important}
#naExactWrongList .na-panel-note{font-size:.76rem!important;line-height:1.45!important}
#naExactWrongList .na-wrong-card{padding:16px!important;border-width:1.5px!important;border-radius:16px!important}
#naExactWrongList .na-tag{font-size:.68rem!important;padding:5px 8px!important}
#naExactWrongList .na-question{font-size:.92rem!important;line-height:1.55!important;margin-top:11px!important}
#naExactWrongList .na-wrong-context{font-size:.82rem!important;line-height:1.6!important;padding:11px 12px!important}
#naExactWrongList .na-choice-list{font-size:.76rem!important;line-height:1.7!important;padding:10px 12px!important}
#naExactWrongList .na-answer{font-size:.82rem!important;line-height:1.55!important;padding:11px!important}
#naExactWrongList .na-answer small{font-size:.64rem!important;margin-bottom:5px!important}
#naExactWrongList .na-wrong-time{font-size:.68rem!important;margin-top:9px!important}

@media(max-width:700px){
 #naFreshEditBg{padding:8px!important;align-items:flex-start!important}
 #naFreshEditBg .na-modal{width:100%!important;max-height:96vh!important;border-radius:22px!important}
 #naFreshEditBg .na-modal-head{padding:18px 20px!important}
 #naFreshEditBg .na-modal-body{padding:18px 20px!important}
 #naFreshEditBg .na-form-grid{grid-template-columns:1fr!important;gap:0!important}
 #naFreshEditBg .na-field{padding:13px 0!important}
 #naFreshEditBg .na-modal-head h2{font-size:1.5rem!important}
 #naFreshEditBg .na-modal-head p{font-size:.85rem!important}
 #naFreshEditBg .na-field label{font-size:.88rem!important}
 #naFreshEditBg .na-input,#naFreshEditBg .na-choice{font-size:1.05rem!important}
 #naFreshEditBg .na-pick-row b{font-size:1rem!important}
 #naFreshEditBg .na-pick-row small{font-size:.78rem!important}
 #naFreshDiagBg .na-modal-body{padding:18px!important}
 #naFreshDiagBg .na-summary{gap:10px!important}
 #naFreshDiagBg .na-stat{padding:14px!important}
 #naFreshDiagBg .na-stat b{font-size:1.38rem!important}
 #naFreshDiagBg .na-stat span{font-size:.76rem!important}
 #naFreshDiagBg .na-panel{padding:16px!important}
 #naFreshDiagBg .na-panel h3{font-size:1.08rem!important}
 #naFreshDiagBg .na-bar-row{grid-template-columns:150px 1fr 52px!important;font-size:.86rem!important;padding:13px 0!important}
 #naFreshDiagBg .na-bar-row b,#naFreshDiagBg .na-bar-row strong{font-size:.86rem!important}
 #naExactWrongList .na-panel-title{font-size:1.15rem!important}
 #naExactWrongList .na-panel-note{font-size:.82rem!important}
 #naExactWrongList .na-question{font-size:1rem!important}
 #naExactWrongList .na-wrong-context{font-size:.9rem!important}
 #naExactWrongList .na-answer{font-size:.9rem!important}
 #naExactWrongList .na-answer small{font-size:.68rem!important}
 #naExactWrongList .na-wrong-time{font-size:.72rem!important}
}
`;document.head.appendChild(s)}
function relabel(root=document){const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const n of nodes){const p=n.parentElement;if(!p||['SCRIPT','STYLE','TEXTAREA','INPUT'].includes(p.tagName))continue;const t=n.nodeValue;if(!t||!t.includes('Sentences'))continue;n.nodeValue=t.replace(/\bSentences\b/g,'본문 Unscramble')}}
let raf=0;function scan(){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{inject();relabel(document.body)})}
function boot(){scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true,characterData:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();