const KEY='willena_testprep_v2_activity_snapshot';
const VERSION=2;
const MAX_AGE_MS=12*60*60*1000;

function readRaw(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch(_){return null}}
function writeRaw(value){try{localStorage.setItem(KEY,JSON.stringify(value));return true}catch(e){console.warn('[test-prep-v2] activity snapshot save failed',e);return false}}
function removeRaw(){try{localStorage.removeItem(KEY)}catch(_){}}
function clone(value){try{return structuredClone(value)}catch(_){try{return JSON.parse(JSON.stringify(value))}catch(__){return value}}}
function sameRoute(a,b){return !!(a&&b&&String(a.planId)===String(b.planId)&&String(a.lesson)===String(b.lesson)&&String(a.practice)===String(b.practice))}
function usable(snapshot){
  if(!snapshot||snapshot.version!==VERSION||!snapshot.savedAt||!snapshot.route||!Array.isArray(snapshot.queue)||!snapshot.queue.length)return false;
  const age=Date.now()-new Date(snapshot.savedAt).getTime();
  return Number.isFinite(age)&&age>=0&&age<=MAX_AGE_MS;
}
function activeRoute(){
  const state=history.state;
  return state?.app==='willena-test-prep-v2'&&state?.route?.view==='practice'?clone(state.route):null;
}
function readUsable(){const snapshot=readRaw();if(!usable(snapshot)){if(snapshot)removeRaw();return null}return snapshot}

export function loadActivitySnapshot(route=activeRoute()){
  const snapshot=readUsable();return snapshot&&sameRoute(snapshot.route,route)?clone(snapshot):null;
}

export function saveActivityQueue(route,queue){
  if(!route?.planId||!route?.lesson||!route?.practice||!Array.isArray(queue)||!queue.length)return false;
  const existing=readUsable();
  if(existing&&sameRoute(existing.route,route))return true;
  return writeRaw({version:VERSION,savedAt:new Date().toISOString(),route:clone(route),queue:clone(queue),resumeIndex:0,outcomes:[]});
}

export function saveActivityProgress({resumeIndex,outcome}={}){
  const route=activeRoute(),snapshot=loadActivitySnapshot(route);if(!snapshot)return false;
  if(outcome){
    const index=Math.max(0,Number(outcome.index)||0);
    snapshot.outcomes=(snapshot.outcomes||[]).filter(x=>Number(x.index)!==index);
    snapshot.outcomes.push({index,correct:!!outcome.correct});
    snapshot.outcomes.sort((a,b)=>a.index-b.index);
  }
  if(resumeIndex!=null)snapshot.resumeIndex=Math.max(0,Math.min(snapshot.queue.length,Number(resumeIndex)||0));
  snapshot.savedAt=new Date().toISOString();return writeRaw(snapshot);
}

export function restoreActivityProgress(route=activeRoute()){const snapshot=loadActivitySnapshot(route);return snapshot?{queue:clone(snapshot.queue),resumeIndex:Number(snapshot.resumeIndex)||0,outcomes:clone(snapshot.outcomes||[])}:null}
export function hasActivitySnapshot(route=activeRoute()){return !!loadActivitySnapshot(route)}
export function clearActivitySnapshot(){removeRaw()}
export function clearActivitySnapshotFor(route=activeRoute()){const snapshot=readUsable();if(snapshot&&sameRoute(snapshot.route,route))removeRaw()}
export function currentActivityRoute(){return activeRoute()}
