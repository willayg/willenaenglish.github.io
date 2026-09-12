import * as SharedStats from '../shared/student-stats.js?v=1.1.0';

const LEGACY_FLAG='willena_tp_stats_source';
const useLegacy=()=>{try{return localStorage.getItem(LEGACY_FLAG)==='legacy'}catch(_){return false}};
const legacyModule=()=>import('./stats-client-legacy-v2.15a.js?v=2.15a');

export async function loadCardStats(plan,studentId,{force=false}={}){
  if(useLegacy()){
    const legacy=await legacyModule();
    return legacy.loadCardStats(plan,studentId,{force});
  }
  return SharedStats.loadCardStats(plan,studentId,{force});
}

export function invalidateCardStats(planId){
  if(useLegacy())return;
  SharedStats.invalidateCardStats(planId);
}

export function getStatsDiagnostics(){
  if(useLegacy())return{source:'legacy-v2.15a',unitCacheHits:0,unitCacheMisses:0,planCacheEntries:0};
  const d=SharedStats.getStatsDiagnostics();
  return{...d,unitCacheHits:d.cacheHits||0,unitCacheMisses:d.cacheMisses||0,planCacheEntries:d.cacheEntries||0};
}

export function formatCardMetric(stat){
  return SharedStats.formatCardMetric(stat);
}

export function formatAccuracy(stat){
  return SharedStats.formatAccuracy(stat);
}

export function reviewCounts(plan){
  if(useLegacy()){
    const s=plan?.summary||{},n=v=>Number.isFinite(Number(v))?Number(v):0;
    const now=n(s.due_review_count??s.wrong_now??s.review_now),unresolved=n(s.unresolved_wrong);
    return{now,later:unresolved?Math.max(0,unresolved-now):n(s.wrong_later??s.review_later),cleared:n(s.corrected??s.cleared_wrong??s.review_cleared)};
  }
  return SharedStats.reviewCounts(plan);
}

// Thin compatibility shim only.
// Canonical stats logic lives in /students/shared/student-stats.js.
// Emergency rollback: localStorage.willena_tp_stats_source='legacy'.
