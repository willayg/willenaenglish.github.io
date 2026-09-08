const EDGE='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-stats-v1';
const API_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const LEGACY_FLAG='willena_tp_stats_source';
const cache=new Map();
const reviewCache=new Map();
const diag={dbRequests:0,cacheHits:0,cacheMisses:0,lastMs:null,lastSyncedAt:null,source:'canonical-db-v1'};

const token=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
const routedFetch=(url,opts={})=>window.WillenaAPI?.fetch?window.WillenaAPI.fetch(url,{credentials:'include',cache:'no-store',...opts}):fetch(url,{credentials:'include',cache:'no-store',...opts});
const number=v=>Number.isFinite(Number(v))?Number(v):0;
const pct=(n,d)=>d?Math.max(0,Math.min(100,Math.round(number(n)/Math.max(1,number(d))*100))):0;

async function refreshToken(){
  try{
    const r=await routedFetch(`/.netlify/functions/supabase_auth?action=refresh&_=${Date.now()}`),d=await r.json().catch(()=>({}));
    if(r.ok&&d?.success&&d.access_token){window.WillenaAPI?.setLocalTokens?.(d.access_token,d.refresh_token||'');return d.access_token}
  }catch(_){ }
  return'';
}
async function access(){return token()||await refreshToken()}
async function requestCanonical(planId){
  let accessToken=await access();
  if(!accessToken)throw new Error('AUTH_REQUIRED');
  const run=t=>fetch(EDGE,{method:'POST',headers:{apikey:API_KEY,Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({plan_id:String(planId)}),cache:'no-store',credentials:'omit'});
  const started=performance.now();diag.dbRequests++;
  let r=await run(accessToken);
  if(r.status===401){accessToken=await refreshToken();if(accessToken)r=await run(accessToken)}
  const text=await r.text();let data={};
  try{data=JSON.parse(text)}catch(_){throw new Error(`Invalid canonical stats response (${r.status})`)}
  diag.lastMs=performance.now()-started;
  if(r.status===401)throw new Error('AUTH_REQUIRED');
  if(!r.ok||data?.ok===false)throw new Error(data?.error||data?.detail||`Canonical stats failed (${r.status})`);
  diag.lastSyncedAt=data?.synced_at||null;
  return data;
}
function stat(s={}){
  const total=Math.max(0,number(s.total)),completed=Math.max(0,Math.min(total,number(s.completed))),sample=Math.max(0,number(s.recent_count));
  return{completed,total,coverage:pct(completed,total),accuracy:sample&&s.recent_accuracy!=null?Math.round(number(s.recent_accuracy)):0,accuracySample:sample,remaining:Math.max(0,total-completed)};
}
function adapt(payload){
  const s=payload?.stats||{},lessons={};
  for(const l of Array.isArray(s.lessons)?s.lessons:[]){
    const practices={};
    for(const p of Array.isArray(l?.practices)?l.practices:[])practices[String(p.practice_type||'')]=stat(p);
    lessons[String(l.lesson||'')]={summary:stat(l),practices,unitId:l.unit_id||null};
  }
  const review=s.review&&typeof s.review==='object'?s.review:{status:'unavailable',wrong_now:0,wrong_later:0,cleared:0};
  return{plan:stat(s.summary||{}),lessons,review,meta:{source:'canonical-db-v1',version:s.version||'v1',snapshotSynced:number(payload?.snapshot_synced),aliasesRefreshed:number(payload?.aliases_refreshed),syncedAt:payload?.synced_at||s?.content?.synced_at||null,contentRevision:s?.content?.revision||null,missingUnits:number(s?.content?.missing_units)}};
}
async function legacyModule(){return import('./stats-client-legacy-v2.15a.js?v=2.15a')}
function useLegacy(){try{return localStorage.getItem(LEGACY_FLAG)==='legacy'}catch(_){return false}}

export async function loadCardStats(plan,studentId,{force=false}={}){
  if(useLegacy()){
    const legacy=await legacyModule();
    return legacy.loadCardStats(plan,studentId,{force});
  }
  const key=String(plan?.id||'');
  if(!key)return{plan:stat(),lessons:{},review:{status:'unavailable',wrong_now:0,wrong_later:0,cleared:0}};
  if(force){cache.delete(key);reviewCache.delete(key)}
  if(cache.has(key)){diag.cacheHits++;return cache.get(key)}
  diag.cacheMisses++;
  const promise=requestCanonical(key).then(payload=>{
    const data=adapt(payload);reviewCache.set(key,data.review);return data;
  }).catch(e=>{cache.delete(key);reviewCache.delete(key);throw e});
  cache.set(key,promise);return promise;
}
export function invalidateCardStats(planId){
  if(planId){const key=String(planId);cache.delete(key);reviewCache.delete(key)}else{cache.clear();reviewCache.clear()}
}
export function getStatsDiagnostics(){return{...diag,unitCacheHits:diag.cacheHits,unitCacheMisses:diag.cacheMisses,planCacheEntries:cache.size};}
export function formatCardMetric(s){return`${number(s?.completed)} / ${number(s?.total)} questions`;}
export function formatAccuracy(s){return s?.accuracySample?`${number(s.accuracy)}% accuracy`:'— accuracy';}
export function reviewCounts(plan){
  if(useLegacy()){
    const s=plan?.summary||{},now=number(s.due_review_count??s.wrong_now??s.review_now),unresolved=number(s.unresolved_wrong);
    return{now,later:unresolved?Math.max(0,unresolved-now):number(s.wrong_later??s.review_later),cleared:number(s.corrected??s.cleared_wrong??s.review_cleared)};
  }
  const r=reviewCache.get(String(plan?.id||''))||{};
  return{now:number(r.wrong_now),later:number(r.wrong_later),cleared:number(r.cleared),nextReviewAt:r.next_review_at||null,status:r.status||'unavailable'};
}

// v2.16 canonical stats client.
// DB owns current content identity, totals, completion, recent accuracy and review counts.
// Set localStorage.willena_tp_stats_source='legacy' for an emergency rollback to the preserved v2.15a client.
