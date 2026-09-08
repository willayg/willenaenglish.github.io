const EDGE='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-review-v1';
const API_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const cache=new Map();
const latest=new Map();
const diag={requests:0,cacheHits:0,cacheMisses:0,lastMs:null,lastSyncedAt:null,source:'shared-canonical-review-v1'};

const token=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
const routedFetch=(url,opts={})=>window.WillenaAPI?.fetch?window.WillenaAPI.fetch(url,{credentials:'include',cache:'no-store',...opts}):fetch(url,{credentials:'include',cache:'no-store',...opts});
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const planKey=planOrId=>String(typeof planOrId==='object'?(planOrId?.id||''):(planOrId||''));

async function refreshToken(){
  try{
    const r=await routedFetch(`/.netlify/functions/supabase_auth?action=refresh&_=${Date.now()}`),d=await r.json().catch(()=>({}));
    if(r.ok&&d?.success&&d.access_token){
      window.WillenaAPI?.setLocalTokens?.(d.access_token,d.refresh_token||'');
      return d.access_token;
    }
  }catch(_){ }
  return'';
}
async function accessToken(){return token()||await refreshToken()}

async function requestQueue(planId,limit){
  let access=await accessToken();
  if(!access)throw new Error('AUTH_REQUIRED');
  const run=t=>fetch(EDGE,{method:'POST',headers:{apikey:API_KEY,Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({plan_id:String(planId),limit}),cache:'no-store',credentials:'omit'});
  const started=performance.now();diag.requests++;
  let r=await run(access);
  if(r.status===401){access=await refreshToken();if(access)r=await run(access)}
  const text=await r.text();let payload={};
  try{payload=JSON.parse(text)}catch(_){throw new Error(`Invalid canonical review response (${r.status})`)}
  diag.lastMs=performance.now()-started;
  if(r.status===401)throw new Error('AUTH_REQUIRED');
  if(!r.ok||payload?.success===false)throw new Error(payload?.error||payload?.detail||`Canonical review failed (${r.status})`);
  diag.lastSyncedAt=payload?.synced_at||null;
  return payload;
}

function normalizeItem(row={}){
  return{
    unitId:row.unit_id||null,
    lesson:String(row.lesson||''),
    practiceType:String(row.practice_type||''),
    canonicalId:String(row.canonical_id||''),
    wrongCount:num(row.wrong_count),
    reviewStage:num(row.review_stage),
    nextReviewAt:row.next_review_at||null,
    firstWrongAt:row.first_wrong_at||null,
    lastWrongAt:row.last_wrong_at||null,
    lastAttemptAt:row.last_attempt_at||null,
    contentKind:row.content_kind||null,
    content:row.content||null
  };
}
function normalize(payload={}){
  const raw=payload?.queue||{};
  const s=raw?.summary||{};
  return{
    planId:raw.plan_id||payload?.plan_id||null,
    status:raw.status||'unavailable',
    summary:{
      now:num(s.wrong_now),
      later:num(s.wrong_later),
      total:num(s.total_unresolved),
      cleared:num(s.cleared),
      nextReviewAt:s.next_review_at||null
    },
    items:(Array.isArray(raw.items)?raw.items:[]).map(normalizeItem),
    meta:{
      source:'shared-canonical-review-v1',
      runLimit:num(payload?.run_limit)||20,
      snapshotSynced:num(payload?.snapshot_synced),
      aliasesRefreshed:num(payload?.aliases_refreshed),
      missingContent:num(payload?.missing_content),
      syncedAt:payload?.synced_at||null
    },
    raw:payload
  };
}

export async function loadReviewQueue(planOrId,{force=false,limit=20}={}){
  const key=planKey(planOrId);
  if(!key)return normalize({});
  const cacheKey=`${key}:${Math.max(1,Math.min(Number(limit)||20,100))}`;
  if(force){cache.delete(cacheKey);latest.delete(key)}
  if(cache.has(cacheKey)){diag.cacheHits++;return cache.get(cacheKey)}
  diag.cacheMisses++;
  const promise=requestQueue(key,Math.max(1,Math.min(Number(limit)||20,100))).then(payload=>{
    const data=normalize(payload);latest.set(key,data);return data;
  }).catch(error=>{cache.delete(cacheKey);throw error});
  cache.set(cacheKey,promise);
  return promise;
}
export async function refreshReviewQueue(planOrId,opts={}){return loadReviewQueue(planOrId,{...opts,force:true})}
export function getCachedReviewQueue(planOrId){return latest.get(planKey(planOrId))||null}
export function invalidateReviewQueue(planOrId){
  const key=planKey(planOrId);
  if(!key){cache.clear();latest.clear();return}
  for(const k of [...cache.keys()])if(k.startsWith(`${key}:`))cache.delete(k);
  latest.delete(key);
}
export function getReviewDiagnostics(){return{...diag,cacheEntries:cache.size}}
