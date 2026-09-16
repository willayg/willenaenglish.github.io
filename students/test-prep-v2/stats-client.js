import * as SharedStats from '../shared/student-stats.js?v=1.2.0';

export function loadCardStats(plan,studentId,{force=false}={}){
  return SharedStats.loadCardStats(plan,studentId,{force});
}
export function invalidateCardStats(planId){return SharedStats.invalidateCardStats(planId)}
export function getStatsDiagnostics(){
  const d=SharedStats.getStatsDiagnostics();
  return{...d,unitCacheHits:d.cacheHits||0,unitCacheMisses:d.cacheMisses||0,planCacheEntries:d.cacheEntries||0};
}
export function formatCardMetric(stat){return SharedStats.formatCardMetric(stat)}
export function formatAccuracy(stat){return SharedStats.formatAccuracy(stat)}
export function reviewCounts(plan){return SharedStats.reviewCounts(plan)}

// Temporary compatibility shim for Test Prep V2.
// All statistical truth and fetching live in /students/shared/student-stats.js.
