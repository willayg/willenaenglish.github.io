const KEY='willena_testprep_v2_activity_snapshot';
const VERSION=1;
const MAX_AGE_MS=12*60*60*1000;

function readRaw(){
  try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch(_){return null}
}
function writeRaw(value){
  try{localStorage.setItem(KEY,JSON.stringify(value));return true}catch(e){console.warn('[test-prep-v2] activity snapshot save failed',e);return false}
}
function removeRaw(){try{localStorage.removeItem(KEY)}catch(_){}}
function usable(snapshot){
  if(!snapshot||snapshot.version!==VERSION||!snapshot.savedAt||!snapshot.route)return false;
  const age=Date.now()-new Date(snapshot.savedAt).getTime();
  return Number.isFinite(age)&&age>=0&&age<=MAX_AGE_MS;
}
function clone(value){try{return structuredClone(value)}catch(_){try{return JSON.parse(JSON.stringify(value))}catch(__){return value}}}

export function saveActivitySnapshot({route,queue,index=0,score=0,wrongIds=[],checked=false,response=null,startedAt=0}={}){
  if(!route?.planId||!route?.lesson||!route?.practice||!Array.isArray(queue)||!queue.length)return false;
  return writeRaw({version:VERSION,savedAt:new Date().toISOString(),route:clone(route),queue:clone(queue),index:Math.max(0,Number(index)||0),score:Number(score)||0,wrongIds:Array.isArray(wrongIds)?[...wrongIds]:[],checked:!!checked,response:clone(response),startedAt:Number(startedAt)||0});
}

export function loadActivitySnapshot(route){
  const snapshot=readRaw();
  if(!usable(snapshot)){if(snapshot)removeRaw();return null}
  if(route){
    const a=snapshot.route,b=route;
    if(String(a.planId)!==String(b.planId)||String(a.lesson)!==String(b.lesson)||String(a.practice)!==String(b.practice))return null;
  }
  return clone(snapshot);
}

export function hasActivitySnapshot(route){return !!loadActivitySnapshot(route)}
export function clearActivitySnapshot(){removeRaw()}

export function clearActivitySnapshotFor(route){
  const snapshot=readRaw();if(!snapshot)return;
  if(!route){removeRaw();return}
  const a=snapshot.route;
  if(String(a?.planId)===String(route.planId)&&String(a?.lesson)===String(route.lesson)&&String(a?.practice)===String(route.practice))removeRaw();
}

export function activitySnapshotInfo(){
  const snapshot=readRaw();return usable(snapshot)?{route:clone(snapshot.route),index:snapshot.index,savedAt:snapshot.savedAt}:null;
}
