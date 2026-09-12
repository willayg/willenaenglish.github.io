(function(){
'use strict';

const EDGE='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-teacher-matrix-v2';
const API_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const matrixCache=new Map();
const latestMatrix=new Map();
const diag={requests:0,cacheHits:0,cacheMisses:0,lastMs:null,source:'test-prep-teacher-matrix-v2'};

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

async function requestMatrix(groupId){
  let access=await accessToken();
  if(!access)throw new Error('AUTH_REQUIRED');
  const run=t=>fetch(`${EDGE}?group_id=${encodeURIComponent(groupId)}`,{
    method:'GET',
    headers:{apikey:API_KEY,Authorization:`Bearer ${t}`},
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
  if(!r.ok||payload?.success===false)throw new Error(payload?.error||`Teacher matrix failed (${r.status})`);
  return payload.matrix||null;
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

function getCachedGroupMatrix(groupId){return latestMatrix.get(String(groupId||''))||null}
function invalidateGroupMatrix(groupId){
  const key=String(groupId||'');
  if(key){matrixCache.delete(key);latestMatrix.delete(key)}
  else{matrixCache.clear();latestMatrix.clear()}
}
function getDiagnostics(){return{...diag,cacheEntries:matrixCache.size}}

window.NaesinV2Data={
  version:'matrix-v1',
  loadGroupMatrix,
  refreshGroupMatrix:(groupId)=>loadGroupMatrix(groupId,{force:true}),
  getCachedGroupMatrix,
  invalidateGroupMatrix,
  getDiagnostics
};
})();
