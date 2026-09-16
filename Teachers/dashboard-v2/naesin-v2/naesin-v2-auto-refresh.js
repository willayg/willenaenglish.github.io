(function(){
'use strict';

const REV='AR1.42';
const ACTIVE_VIEW_ID='view-naesin-v2';
const INTERVAL_MS=20000;
let running=false;
let timer=null;
let lastRunAt=0;

function view(){return document.getElementById(ACTIVE_VIEW_ID)}
function isActive(){return !!(window.NaesinV2?.isActive?.()||view()?.classList.contains('active'))}
function canPoll(){return document.visibilityState!=='hidden'&&isActive()}

async function refresh(reason='manual'){
  if(running||!canPoll())return false;
  const jobs=[];
  if(typeof window.NaesinV2?.refreshVisibleMatrices==='function')jobs.push(window.NaesinV2.refreshVisibleMatrices());
  if(typeof window.NaesinV2StudentDetail?.refreshCurrent==='function')jobs.push(window.NaesinV2StudentDetail.refreshCurrent());
  if(!jobs.length)return false;
  running=true;
  try{
    await Promise.allSettled(jobs);
    lastRunAt=Date.now();
    window.dispatchEvent(new CustomEvent('naesin-v2:refreshed',{detail:{reason,at:lastRunAt}}));
    return true;
  }catch(error){
    console.warn('[Naesin V2 Auto Refresh] refresh failed',error);
    return false;
  }finally{running=false}
}

function schedule(){
  if(timer)clearTimeout(timer);
  timer=setTimeout(async()=>{
    try{if(canPoll())await refresh('interval')}finally{schedule()}
  },INTERVAL_MS);
}
function stop(){if(timer){clearTimeout(timer);timer=null}return true}
function start(){if(!timer)schedule();return true}

function mountRefreshButton(){
  const root=view(),head=root?.querySelector('.na2-head');
  if(!head||head.querySelector('[data-na2-refresh]'))return;
  const add=head.querySelector('#na2Add'),btn=document.createElement('button');
  btn.type='button';btn.className='na2-add na2-refresh';btn.dataset.na2Refresh='1';btn.textContent='↻ 새로고침';
  btn.addEventListener('click',async()=>{if(running)return;const old=btn.textContent;btn.disabled=true;btn.textContent='새로고침 중…';try{await refresh('button')}finally{btn.disabled=false;btn.textContent=old}});
  head.insertBefore(btn,add||null);
}
function mount(){
  mountRefreshButton();
  start();
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&isActive())void refresh('visible')});
  window.addEventListener('naesin-v2:shown',()=>{void refresh('shown')});
  if(canPoll())void refresh('mount');
  window.NaesinV2AutoRefresh={version:REV,intervalMs:INTERVAL_MS,refreshNow:()=>refresh('manual'),start,stop,getLastRunAt:()=>lastRunAt};
  console.info(`[Naesin V2 Auto Refresh] ${REV} mounted (${INTERVAL_MS/1000}s snapshot polling while visible)`);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();