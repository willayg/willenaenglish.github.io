(function(){
'use strict';
const api=()=>window.WillenaReviewQueue47a,$=(s,r=document)=>r.querySelector(s);
function fmt(ms){if(ms<=0)return'지금';const m=Math.ceil(ms/60000);return m>=60?`${Math.floor(m/60)}시간 ${m%60}분 후`:`${m}분 후`}
function render(){const a=api();if(!a)return;const s=a.summary(),c=$('#card');if(!c)return;const done=s.total?Math.round(s.cleared/s.total*100):0;c.innerHTML=`<div class="result review47a-home"><div class="score">${s.ready}</div><h2>지금 복습할 문제</h2><p><b>${s.ready}개 지금</b> · ${s.later}개 나중 · ${s.cleared}개 완료</p><div style="height:10px;background:#e8eff0;border-radius:99px;overflow:hidden;margin:18px 0"><i style="display:block;height:100%;width:${done}%;background:#19777e"></i></div><p>${s.cleared} / ${s.total} 완료${s.nextAt?` · 다음 복습 ${fmt(s.nextAt-Date.now())}`:''}</p><div class="actions">${s.ready?'<button class="primary" id="review47aStart">복습 시작</button>':'<button class="secondary" id="review47aDone">확인</button>'}</div></div>`;$('#review47aStart')?.addEventListener('click',run);$('#review47aDone')?.addEventListener('click',()=>history.back())}
async function run(){const a=api();if(!a)return;while(a.summary().ready>0){const before=a.ready()[0];const r=await a.runNext({scope:'global-review',position:1,total:a.summary().ready,lesson:before?.meta?.lesson||null});if(!r||r.cancelled)break}render()}
function open(){document.querySelector('#assignmentHome')?.style.setProperty('display','none');document.querySelector('#assignedQuizPane')?.style.setProperty('display','block');render()}
window.WillenaReview47a={open,render,run};
window.addEventListener('review47a:open',open);
})();
