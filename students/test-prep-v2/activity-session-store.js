const KEY='willena_testprep_v2_activity_snapshot';
const VERSION=3;
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
function writeSnapshot(snapshot){snapshot.savedAt=new Date().toISOString();return writeRaw(snapshot)}

export function loadActivitySnapshot(route=activeRoute()){
  const snapshot=readUsable();return snapshot&&sameRoute(snapshot.route,route)?clone(snapshot):null;
}

export function saveActivityQueue(route,queue){
  if(!route?.planId||!route?.lesson||!route?.practice||!Array.isArray(queue)||!queue.length)return false;
  const existing=readUsable();
  if(existing&&sameRoute(existing.route,route))return true;
  return writeSnapshot({version:VERSION,route:clone(route),queue:clone(queue),currentIndex:0,outcomes:[]});
}

export function saveActivityPosition(index){
  const route=activeRoute(),snapshot=loadActivitySnapshot(route);if(!snapshot)return false;
  snapshot.currentIndex=Math.max(0,Math.min(snapshot.queue.length-1,Number(index)||0));
  return writeSnapshot(snapshot);
}

export function saveActivityOutcome(index,correct){
  const route=activeRoute(),snapshot=loadActivitySnapshot(route);if(!snapshot)return false;
  const n=Math.max(0,Number(index)||0);
  snapshot.outcomes=(snapshot.outcomes||[]).filter(x=>Number(x.index)!==n);
  snapshot.outcomes.push({index:n,correct:!!correct});
  snapshot.outcomes.sort((a,b)=>a.index-b.index);
  return writeSnapshot(snapshot);
}

export function restoreActivityProgress(route=activeRoute()){
  const snapshot=loadActivitySnapshot(route);
  return snapshot?{queue:clone(snapshot.queue),currentIndex:Number(snapshot.currentIndex)||0,outcomes:clone(snapshot.outcomes||[])}:null;
}
export function clearActivitySnapshot(){removeRaw()}
export function clearActivitySnapshotFor(route=activeRoute()){const snapshot=readUsable();if(snapshot&&sameRoute(snapshot.route,route))removeRaw()}
export function currentActivityRoute(){return activeRoute()}
