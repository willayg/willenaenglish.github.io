(function(){
'use strict';

const REV='AR1.31';
const INTERVAL_MS=20000;
const MIN_REFRESH_GAP_MS=2500;
const ACTIVE_VIEW_ID='view-naesin-v2';
const REVIEW_COUNTS_SRC='./naesin-v2-review-counts.js?v=20260915-r13-01-silent';

let timer=null;
let running=false;
let lastRefreshAt=0;
let activationTimer=null;

function view(){return document.getElementById(ACTIVE_VIEW_ID)}
function isActive(){return !!(window.NaesinV2?.isActive?.()||view()?.classList.contains('active'))}

async function refresh(reason='interval'){
  if(running||document.hidden||!isActive())return false;
  const now=Date.now();
  if(now-lastRefreshAt<MIN_REFRESH_GAP_MS)return false;
  const jobs=[];
  if(typeof window.NaesinV2?.refreshVisibleMatrices==='function')jobs.push(window.NaesinV2.refreshVisibleMatrices());
  if(typeof window.NaesinV2StudentDetail?.refreshCurrent==='function')jobs.push(window.NaesinV2StudentDetail.refreshCurrent());
  if(!jobs.length)return false;
  running=true;
  try{
    await Promise.allSettled(jobs);
    lastRefreshAt=Date.now();
    window.dispatchEvent(new CustomEvent('naesin-v2:auto-refreshed',{detail:{reason,at:lastRefreshAt}}));
    return true;
  }catch(error){
    console.warn('[Naesin V2 Auto Refresh] refresh failed',error);
    return false;
  }finally{
    running=false;
  }
}

function refreshSoon(reason,delay=500){
  clearTimeout(activationTimer);
  activationTimer=setTimeout(()=>refresh(reason),delay);
}

function start(){
  if(timer)return;
  timer=setInterval(()=>refresh('interval'),INTERVAL_MS);
}

function stop(){
  if(timer){clearInterval(timer);timer=null}
  clearTimeout(activationTimer);
  activationTimer=null;
}

function watchActivation(){
  const el=view();
  if(!el)return;
  const observer=new MutationObserver(()=>{
    if(el.classList.contains('active'))refreshSoon('view-opened',900);
  });
  observer.observe(el,{attributes:true,attributeFilter:['class']});
}

document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&isActive())refreshSoon('tab-visible',250);
});
window.addEventListener('focus',()=>{
  if(isActive())refreshSoon('window-focus',250);
});

function mountReviewCounts(){
  import(REVIEW_COUNTS_SRC).catch(error=>console.warn('[Naesin V2 Auto Refresh] review counts module failed',error));
}

function mount(){
  watchActivation();
  start();
  mountReviewCounts();
  window.NaesinV2AutoRefresh={
    version:REV,
    intervalMs:INTERVAL_MS,
    refreshNow:()=>refresh('manual'),
    start,
    stop
  };
  console.info(`[Naesin V2 Auto Refresh] ${REV} mounted (${INTERVAL_MS/1000}s)`);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();