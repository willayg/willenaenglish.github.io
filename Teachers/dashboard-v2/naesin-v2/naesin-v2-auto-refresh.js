(function(){
'use strict';

const REV='AR1.34';
const ACTIVE_VIEW_ID='view-naesin-v2';
let running=false;

function view(){return document.getElementById(ACTIVE_VIEW_ID)}
function isActive(){return !!(window.NaesinV2?.isActive?.()||view()?.classList.contains('active'))}

async function refresh(reason='manual'){
  if(running||!isActive())return false;
  const jobs=[];
  if(typeof window.NaesinV2?.refreshVisibleMatrices==='function')jobs.push(window.NaesinV2.refreshVisibleMatrices());
  if(typeof window.NaesinV2StudentDetail?.refreshCurrent==='function')jobs.push(window.NaesinV2StudentDetail.refreshCurrent());
  if(!jobs.length)return false;
  running=true;
  try{
    await Promise.allSettled(jobs);
    window.dispatchEvent(new CustomEvent('naesin-v2:manual-refreshed',{detail:{reason,at:Date.now()}}));
    return true;
  }catch(error){
    console.warn('[Naesin V2 Manual Refresh] refresh failed',error);
    return false;
  }finally{
    running=false;
  }
}

function hideReviewColumn(){
  if(document.getElementById('na2-p1-hide-review'))return;
  const style=document.createElement('style');
  style.id='na2-p1-hide-review';
  style.textContent='.na2-matrix .na2-review-head,.na2-matrix .na2-review-cell{display:none!important}';
  document.head.appendChild(style);
}

function mountRefreshButton(){
  const root=view();
  const head=root?.querySelector('.na2-head');
  if(!head||head.querySelector('[data-na2-refresh]'))return;
  const add=head.querySelector('#na2Add');
  const btn=document.createElement('button');
  btn.type='button';
  btn.className='na2-add na2-refresh';
  btn.dataset.na2Refresh='1';
  btn.textContent='↻ 새로고침';
  btn.addEventListener('click',async()=>{
    if(running)return;
    const old=btn.textContent;
    btn.disabled=true;
    btn.textContent='새로고침 중…';
    try{await refresh('button')}finally{btn.disabled=false;btn.textContent=old}
  });
  head.insertBefore(btn,add||null);
}

function mount(){
  hideReviewColumn();
  mountRefreshButton();
  window.NaesinV2AutoRefresh={version:REV,intervalMs:null,refreshNow:()=>refresh('manual'),start:()=>false,stop:()=>true};
  console.info(`[Naesin V2 Manual Refresh] ${REV} mounted (auto refresh disabled, review matrix disabled)`);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();