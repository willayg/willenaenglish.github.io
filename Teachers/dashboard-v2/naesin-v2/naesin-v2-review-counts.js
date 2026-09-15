import { loadReviewQueue, invalidateReviewQueue } from '/students/shared/student-review.js';

const CACHE_MS=15000;
const cache=new Map();

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function installStyles(){
  if(document.getElementById('na2-review-count-styles'))return;
  const style=document.createElement('style');
  style.id='na2-review-count-styles';
  style.textContent=`
    .na2-matrix th.na2-review-head{min-width:118px}
    .na2-review-cell{min-width:118px;text-align:center}
    .na2-review-cell strong{display:block;font-size:20px;line-height:1.15;color:#203039}
    .na2-review-cell small{display:block;margin-top:5px;white-space:nowrap;color:#7b8c94;font-size:11px;font-weight:700}
    .na2-review-cell .na2-review-active{color:#e94d78}
    .na2-review-cell.na2-review-empty strong{color:#9aaab1}
  `;
  document.head.appendChild(style);
}

async function getStats(planId){
  const hit=cache.get(planId),now=Date.now();
  if(hit&&now-hit.at<CACHE_MS)return hit.value;
  const value=await loadReviewQueue(planId,{limit:1});
  cache.set(planId,{at:now,value});
  return value;
}

function renderCell(td,stats){
  const summary=stats?.summary||{};
  const active=Math.max(0,Number(summary.now)||0);
  const waiting=Math.max(0,Number(summary.later)||0);
  const total=Math.max(0,Number(summary.total)||0);
  td.classList.toggle('na2-review-empty',total===0);
  td.innerHTML=`<strong>${esc(total)}</strong><small><span class="na2-review-active">활성 ${esc(active)}</span> · 대기 ${esc(waiting)}</small>`;
}

async function hydrateRow(tr){
  const planId=tr?.dataset?.planId;
  if(!planId||tr.dataset.reviewLoading==='1')return;
  let td=tr.querySelector('.na2-review-cell');
  if(!td){
    td=document.createElement('td');
    td.className='na2-stat na2-review-cell';
    td.innerHTML='<strong>—</strong><small>불러오는 중…</small>';
    tr.appendChild(td);
  }
  tr.dataset.reviewLoading='1';
  try{renderCell(td,await getStats(planId))}
  catch(error){
    console.warn('[Naesin V2 Review Counts] failed',planId,error);
    td.innerHTML='<strong>—</strong><small>오답 불러오기 실패</small>';
  }finally{delete tr.dataset.reviewLoading}
}

function patchTable(table){
  const headRow=table.querySelector('thead tr');
  if(headRow&&!headRow.querySelector('.na2-review-head')){
    const th=document.createElement('th');
    th.className='na2-review-head';
    th.textContent='오답';
    headRow.appendChild(th);
  }
  table.querySelectorAll('tbody tr[data-plan-id]').forEach(hydrateRow);
  table.querySelectorAll('tbody td[colspan="10"]').forEach(td=>td.colSpan=11);
}

function patchAll(){document.querySelectorAll('.na2-matrix').forEach(patchTable)}

function mount(){
  installStyles();
  patchAll();
  const root=document.getElementById('view-naesin-v2');
  if(root){
    const observer=new MutationObserver(patchAll);
    observer.observe(root,{childList:true,subtree:true});
  }
  window.addEventListener('naesin-v2:auto-refreshed',()=>{
    cache.clear();
    document.querySelectorAll('.na2-matrix tbody tr[data-plan-id]').forEach(tr=>{
      if(tr.dataset.planId)invalidateReviewQueue(tr.dataset.planId);
    });
    patchAll();
  });
  console.info('[Naesin V2 Review Counts] canonical student-review source mounted');
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
