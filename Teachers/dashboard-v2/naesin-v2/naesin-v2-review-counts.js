(function(){
'use strict';
const REV='R14.00';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const n=v=>Number.isFinite(Number(v))?Number(v):0;
function bumpVisibleRev(){
  const fixed=document.getElementById('teacherDashboardRev');if(fixed)fixed.textContent=`REV ${REV}`;
  const badge=document.querySelector('#view-naesin-v2 .na2-rev-badge');if(badge)badge.textContent=REV;
}
function hydrate(groupId){
  const matrix=window.NaesinV2Data?.getCachedGroupMatrix?.(groupId),members=Array.isArray(matrix?.members)?matrix.members:[];
  const byPlan=new Map(members.map(m=>[String(m.plan_id||''),m]));
  const root=q(`.na2-test[data-group-id="${CSS.escape(String(groupId||''))}"]`);if(!root)return;
  qa('tbody tr[data-plan-id]',root).forEach(tr=>{
    const m=byPlan.get(String(tr.dataset.planId||'')),r=m?.review||{};
    const active=n(r.active),waiting=n(r.waiting),total=r.total==null?active+waiting:n(r.total);
    const totalEl=q('[data-review-total]',tr),activeEl=q('[data-review-active]',tr),waitingEl=q('[data-review-waiting]',tr);
    if(totalEl)totalEl.textContent=String(total);
    if(activeEl)activeEl.textContent=String(active);
    if(waitingEl)waitingEl.textContent=String(waiting);
  });
}
function mount(){
  bumpVisibleRev();
  window.addEventListener('naesin-v2:matrix-rendered',e=>hydrate(e.detail?.groupId));
  qa('.na2-test[data-group-id]').forEach(t=>hydrate(t.dataset.groupId));
  console.info(`[Naesin V2 Review Counts] ${REV} snapshot-backed`);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
