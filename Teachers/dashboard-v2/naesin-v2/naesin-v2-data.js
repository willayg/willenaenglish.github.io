(function(){
'use strict';

const MATRIX_EDGE='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-teacher-matrix-v2';
const OVERVIEW_EDGE='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-teacher-student-overview-v2';
const GROUP_EDGE='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-groups';
const API_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const matrixCache=new Map();
const latestMatrix=new Map();
const overviewCache=new Map();
const latestOverview=new Map();
let groupsPromise=null;
let latestGroups=[];
const diag={requests:0,cacheHits:0,cacheMisses:0,lastMs:null,source:'shared-naesin-v2-data'};

const token=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
const routedFetch=(url,opts={})=>window.WillenaAPI?.fetch
  ? window.WillenaAPI.fetch(url,{credentials:'include',cache:'no-store',...opts})
  : fetch(url,{credentials:'include',cache:'no-store',...opts});

async function refreshToken(){
  try{
    const r=await routedFetch(`/.netlify/functions/supabase_auth?action=refresh&_=${Date.now()}`);
    const d=await r.json().catch(()=>({}));
    if(r.ok&&d?.success&&d.access_token){
      window.WillenaAPI?.setLocalTokens?.(d.access_token,d.refresh_token||'');
      return d.access_token;
    }
  }catch(_){ }
  return '';
}

async function accessToken(){return token()||await refreshToken()}

async function authedJson(url,opts={}){
  let access=await accessToken();
  if(!access)throw new Error('AUTH_REQUIRED');
  const run=t=>fetch(url,{
    ...opts,
    headers:{apikey:API_KEY,Authorization:`Bearer ${t}`,...(opts.headers||{})},
    cache:'no-store',
    credentials:'omit'
  });
  const started=performance.now();
  diag.requests++;
  let r=await run(access);
  if(r.status===401){access=await refreshToken();if(access)r=await run(access)}
  const payload=await r.json().catch(()=>({}));
  diag.lastMs=performance.now()-started;
  if(r.status===401)throw new Error('AUTH_REQUIRED');
  if(!r.ok||payload?.success===false)throw new Error(payload?.error||`Naesin data request failed (${r.status})`);
  return payload;
}

async function requestMatrix(groupId){
  const payload=await authedJson(`${MATRIX_EDGE}?group_id=${encodeURIComponent(groupId)}`);
  return payload.matrix||null;
}

async function requestOverview(planId){
  const payload=await authedJson(`${OVERVIEW_EDGE}?plan_id=${encodeURIComponent(planId)}`);
  return payload.overview||null;
}

async function loadGroups({force=false}={}){
  if(force){groupsPromise=null;latestGroups=[]}
  if(groupsPromise){diag.cacheHits++;return groupsPromise}
  diag.cacheMisses++;
  groupsPromise=authedJson(`${GROUP_EDGE}?action=teacher_groups`).then(payload=>{
    const rows=Array.isArray(payload.groups)?payload.groups:[];
    latestGroups=rows.filter(item=>(item?.group||item)?.active!==false);
    return latestGroups;
  }).catch(error=>{groupsPromise=null;latestGroups=[];throw error});
  return groupsPromise;
}

async function loadGroupMatrix(groupId,{force=false}={}){
  const key=String(groupId||'');
  if(!key)throw new Error('group_id required');
  if(force){matrixCache.delete(key);latestMatrix.delete(key)}
  if(matrixCache.has(key)){diag.cacheHits++;return matrixCache.get(key)}
  diag.cacheMisses++;
  const promise=requestMatrix(key).then(matrix=>{
    latestMatrix.set(key,matrix);
    return matrix;
  }).catch(error=>{
    matrixCache.delete(key);
    latestMatrix.delete(key);
    throw error;
  });
  matrixCache.set(key,promise);
  return promise;
}

async function loadStudentOverview(planId,{force=false}={}){
  const key=String(planId||'');
  if(!key)throw new Error('plan_id required');
  if(force){overviewCache.delete(key);latestOverview.delete(key)}
  if(overviewCache.has(key)){diag.cacheHits++;return overviewCache.get(key)}
  diag.cacheMisses++;
  const promise=requestOverview(key).then(overview=>{
    latestOverview.set(key,overview);
    return overview;
  }).catch(error=>{
    overviewCache.delete(key);
    latestOverview.delete(key);
    throw error;
  });
  overviewCache.set(key,promise);
  return promise;
}

function getCachedGroups(){return latestGroups}
function getCachedGroupMatrix(groupId){return latestMatrix.get(String(groupId||''))||null}
function getCachedStudentOverview(planId){return latestOverview.get(String(planId||''))||null}
function invalidateGroupMatrix(groupId){
  const key=String(groupId||'');
  if(key){matrixCache.delete(key);latestMatrix.delete(key)}
  else{matrixCache.clear();latestMatrix.clear()}
}
function invalidateStudentOverview(planId){
  const key=String(planId||'');
  if(key){overviewCache.delete(key);latestOverview.delete(key)}
  else{overviewCache.clear();latestOverview.clear()}
}
function invalidateGroups(){groupsPromise=null;latestGroups=[]}
function invalidateAll(){invalidateGroups();invalidateGroupMatrix();invalidateStudentOverview()}
function getDiagnostics(){return{...diag,matrixCacheEntries:matrixCache.size,overviewCacheEntries:overviewCache.size,groupsCached:latestGroups.length}}

window.NaesinV2Data={
  version:'p5-data-1',
  loadGroups,
  refreshGroups:()=>loadGroups({force:true}),
  getCachedGroups,
  loadGroupMatrix,
  refreshGroupMatrix:(groupId)=>loadGroupMatrix(groupId,{force:true}),
  getCachedGroupMatrix,
  invalidateGroupMatrix,
  loadStudentOverview,
  refreshStudentOverview:(planId)=>loadStudentOverview(planId,{force:true}),
  getCachedStudentOverview,
  invalidateStudentOverview,
  invalidateGroups,
  invalidateAll,
  getDiagnostics
};
})();
