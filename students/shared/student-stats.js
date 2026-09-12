const EDGE='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-stats-v1';
const API_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const cache=new Map();
const latest=new Map();
const diag={requests:0,cacheHits:0,cacheMisses:0,lastMs:null,lastSyncedAt:null,source:'shared-canonical-stats-v1'};

const token=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
const routedFetch=(url,opts={})=>window.WillenaAPI?.fetch?window.WillenaAPI.fetch(url,{credentials:'include',cache:'no-store',...opts}):fetch(url,{credentials:'include',cache:'no-store',...opts});
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const maybeNum=v=>v==null?null:(Number.isFinite(Number(v))?Number(v):null);
const pct=(done,total)=>total?Math.max(0,Math.min(100,Math.round(num(done)/Math.max(1,num(total))*100))):0;
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

async function requestPlan(planId){
  let access=await accessToken();
  if(!access)throw new Error('AUTH_REQUIRED');
  const run=t=>fetch(EDGE,{method:'POST',headers:{apikey:API_KEY,Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({plan_id:String(planId)}),cache:'no-store',credentials:'omit'});
  const started=performance.now();diag.requests++;
  let r=await run(access);
  if(r.status===401){access=await refreshToken();if(access)r=await run(access)}
  const text=await r.text();let payload={};
  try{payload=JSON.parse(text)}catch(_){throw new Error(`Invalid canonical stats response (${r.status})`)}
  diag.lastMs=performance.now()-started;
  if(r.status===401)throw new Error('AUTH_REQUIRED');
  if(!r.ok||payload?.ok===false)throw new Error(payload?.error||payload?.detail||`Canonical stats failed (${r.status})`);
  diag.lastSyncedAt=payload?.synced_at||null;
  return payload;
}

function stat(row={}){
  const total=Math.max(0,num(row.total));
  const completed=Math.max(0,Math.min(total,num(row.completed)));
  const sample=Math.max(0,num(row.recent_count));
  return{
    total,
    completed,
    remaining:Math.max(0,total-completed),
    coverage:pct(completed,total),
    accuracy:sample&&row.recent_accuracy!=null?Math.round(num(row.recent_accuracy)):0,
    accuracySample:sample,
    recentCount:sample,
    recentAccuracy:maybeNum(row.recent_accuracy),
    uniqueCount:Math.max(0,num(row.unique_count??row.completed)),
    uniqueCorrect:Math.max(0,num(row.unique_correct)),
    uniqueAccuracy:maybeNum(row.unique_accuracy),
    lastActivity:row.last_activity||null
  };
}

function normalize(payload){
  const raw=payload?.stats||{};
  const lessons={};
  for(const lesson of Array.isArray(raw.lessons)?raw.lessons:[]){
    const practices={};
    for(const p of Array.isArray(lesson?.practices)?lesson.practices:[]){
      practices[String(p.practice_type||'')]=stat(p);
    }
    lessons[String(lesson.lesson||'')]={
      summary:stat(lesson),
      practices,
      unitId:lesson.unit_id||null,
      lesson:String(lesson.lesson||'')
    };
  }
  const reviewRaw=raw.review&&typeof raw.review==='object'?raw.review:{};
  const review={
    status:reviewRaw.status||'unavailable',
    wrongNow:num(reviewRaw.wrong_now),
    wrongLater:num(reviewRaw.wrong_later),
    cleared:num(reviewRaw.cleared),
    nextReviewAt:reviewRaw.next_review_at||null,
    lessons:Array.isArray(reviewRaw.lessons)?reviewRaw.lessons:[]
  };
  const skills={};
  for(const row of Array.isArray(raw.skills)?raw.skills:[]){
    const key=String(row.practice_type||'');
    if(key)skills[key]=stat(row);
  }
  const plan=stat(raw.summary||{});
  plan.recent150Count=Math.max(0,num(raw.summary?.recent150_count));
  plan.recent150Accuracy=maybeNum(raw.summary?.recent150_accuracy);
  plan.uniqueCount=Math.max(0,num(raw.summary?.unique_count));
  plan.uniqueCorrect=Math.max(0,num(raw.summary?.unique_correct));
  plan.uniqueAccuracy=maybeNum(raw.summary?.unique_accuracy);
  plan.lastActivity=raw.summary?.last_activity||null;
  return{
    plan,
    skills,
    lessons,
    review,
    meta:{
      source:'shared-canonical-stats-v1',
      version:raw.version||'v1',
      planId:raw.plan_id||null,
      studentId:raw.student_id||null,
      bookKey:raw.book_key||null,
      bookLabel:raw.book_label||null,
      snapshotSynced:num(payload?.snapshot_synced),
      aliasesRefreshed:num(payload?.aliases_refreshed),
      syncedAt:payload?.synced_at||raw?.content?.synced_at||null,
      contentRevision:raw?.content?.revision||null,
      missingUnits:num(raw?.content?.missing_units)
    },
    raw:payload
  };
}

export async function loadPlanStats(planOrId,{force=false}={}){
  const key=planKey(planOrId);
  if(!key)return normalize({stats:{}});
  if(force){cache.delete(key);latest.delete(key)}
  if(cache.has(key)){diag.cacheHits++;return cache.get(key)}
  diag.cacheMisses++;
  const promise=requestPlan(key).then(payload=>{
    const data=normalize(payload);
    latest.set(key,data);
    return data;
  }).catch(error=>{
    cache.delete(key);latest.delete(key);throw error;
  });
  cache.set(key,promise);
  return promise;
}

export async function refreshPlanStats(planOrId){return loadPlanStats(planOrId,{force:true})}
export function getCachedPlanStats(planOrId){return latest.get(planKey(planOrId))||null}
export function getLessonStats(planOrId,lesson){return getCachedPlanStats(planOrId)?.lessons?.[String(lesson)]||null}
export function getSkillStats(planOrId,practice){return getCachedPlanStats(planOrId)?.skills?.[String(practice)]||null}
export function getReviewCounts(planOrId){
  const r=getCachedPlanStats(planOrId)?.review||{};
  return{now:num(r.wrongNow),later:num(r.wrongLater),cleared:num(r.cleared),nextReviewAt:r.nextReviewAt||null,status:r.status||'unavailable'};
}
export function invalidatePlanStats(planOrId){
  const key=planKey(planOrId);
  if(key){cache.delete(key);latest.delete(key)}else{cache.clear();latest.clear()}
}
export function clearStatsCache(){invalidatePlanStats('')}
export function getStatsDiagnostics(){return{...diag,cacheEntries:cache.size};}
export function formatCardMetric(s){return`${num(s?.completed)} / ${num(s?.total)} questions`;}
export function formatAccuracy(s){return s?.accuracySample?`${num(s.accuracy)}% accuracy`:'— accuracy';}

// Compatibility aliases for existing student apps while they migrate.
export async function loadCardStats(plan,_studentId,{force=false}={}){return loadPlanStats(plan,{force})}
export function invalidateCardStats(planOrId){return invalidatePlanStats(planOrId)}
export function reviewCounts(planOrId){return getReviewCounts(planOrId)}

// Canonical rule: this module never derives totals from content in the browser.
// All identities, scope, completion, recent accuracy and review counts come from the shared backend.
