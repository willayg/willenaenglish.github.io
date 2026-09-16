const SNAPSHOT_RPC='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/test_prep_student_snapshot_fast_v1';
const API_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const cache=new Map();
const latest=new Map();
let snapshotPromise=null,snapshotLatest=null;
const diag={requests:0,cacheHits:0,cacheMisses:0,lastMs:null,lastSyncedAt:null,source:'shared-snapshot-stats-v1'};

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

async function requestSnapshotPlans(){
  let access=await accessToken();
  if(!access)throw new Error('AUTH_REQUIRED');
  const run=t=>fetch(SNAPSHOT_RPC,{method:'POST',headers:{apikey:API_KEY,Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:'{}',cache:'no-store',credentials:'omit'});
  const started=performance.now();diag.requests++;
  let r=await run(access);
  if(r.status===401){access=await refreshToken();if(access)r=await run(access)}
  const payload=await r.json().catch(()=>({}));
  diag.lastMs=performance.now()-started;
  if(r.status===401)throw new Error('AUTH_REQUIRED');
  if(!r.ok)throw new Error(payload?.message||payload?.error||`Student snapshot failed (${r.status})`);
  diag.lastSyncedAt=payload?.generated_at||null;
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

function normalizeSnapshotPlan(raw={}){
  const lessons={};
  for(const lesson of Array.isArray(raw.lessons)?raw.lessons:[]){
    const practices={};
    for(const p of Array.isArray(lesson?.practices)?lesson.practices:[]){
      const key=String(p.practice_type||'');
      if(key)practices[key]=stat(p);
    }
    lessons[String(lesson.lesson||'')]={summary:stat(lesson),practices,unitId:lesson.unit_id||null,lesson:String(lesson.lesson||'')};
  }
  const skills={};
  for(const row of Array.isArray(raw.skills)?raw.skills:[]){
    const key=String(row.practice_type||'');
    if(key)skills[key]=stat(row);
  }
  const reviewRaw=raw.review&&typeof raw.review==='object'?raw.review:{};
  const review={
    status:'snapshot',
    wrongNow:num(reviewRaw.active),
    wrongLater:num(reviewRaw.waiting),
    total:num(reviewRaw.total),
    cleared:num(reviewRaw.cleared),
    nextReviewAt:reviewRaw.next_review_at||null,
    items:Array.isArray(reviewRaw.items)?reviewRaw.items:[]
  };
  const plan=stat(raw.summary||{});
  plan.recent150Count=Math.max(0,num(raw.summary?.recent150_count));
  plan.recent150Accuracy=maybeNum(raw.summary?.recent150_accuracy);
  plan.uniqueCount=Math.max(0,num(raw.summary?.unique_count));
  plan.uniqueCorrect=Math.max(0,num(raw.summary?.unique_correct));
  plan.uniqueAccuracy=maybeNum(raw.summary?.unique_accuracy);
  plan.lastActivity=raw.summary?.last_activity||null;
  return{
    plan,skills,lessons,review,
    activity:raw.activity||{},
    responseTimes:Array.isArray(raw.response_times)?raw.response_times:[],
    grammarPatterns:Array.isArray(raw.grammar_patterns)?raw.grammar_patterns:[],
    today:raw.today||{},
    meta:{
      source:'shared-snapshot-stats-v1',
      version:raw.snapshot_version||'snapshot',
      planId:raw.plan_id||null,
      studentId:raw.student_id||null,
      bookKey:raw.group?.book_key||null,
      bookLabel:raw.group?.book_label||null,
      syncedAt:raw.snapshot_updated_at||null,
      stale:raw.stale===true
    },
    raw
  };
}
function emptyNormalized(planId=''){return normalizeSnapshotPlan({plan_id:planId,summary:{},skills:[],lessons:[],review:{}})}

export async function loadSnapshotPlans({force=false}={}){
  if(force){snapshotPromise=null;snapshotLatest=null;cache.clear();latest.clear()}
  if(snapshotPromise){diag.cacheHits++;return snapshotPromise}
  diag.cacheMisses++;
  snapshotPromise=requestSnapshotPlans().then(payload=>{snapshotLatest=payload;return payload}).catch(error=>{snapshotPromise=null;snapshotLatest=null;throw error});
  return snapshotPromise;
}
export async function refreshSnapshotPlans(){return loadSnapshotPlans({force:true})}
export function getCachedSnapshotPlans(){return snapshotLatest}
export function invalidateSnapshotPlans(){snapshotPromise=null;snapshotLatest=null;cache.clear();latest.clear()}

export async function loadPlanStats(planOrId,{force=false}={}){
  const key=planKey(planOrId);
  if(!key)return emptyNormalized();
  if(force){cache.delete(key);latest.delete(key);invalidateSnapshotPlans()}
  if(cache.has(key)){diag.cacheHits++;return cache.get(key)}
  diag.cacheMisses++;
  const promise=loadSnapshotPlans().then(payload=>{
    const raw=(Array.isArray(payload?.plans)?payload.plans:[]).find(p=>String(p.plan_id)===key);
    const data=raw?normalizeSnapshotPlan(raw):emptyNormalized(key);
    latest.set(key,data);
    return data;
  }).catch(error=>{cache.delete(key);latest.delete(key);throw error});
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
export function clearStatsCache(){invalidatePlanStats('');invalidateSnapshotPlans()}
export function getStatsDiagnostics(){return{...diag,cacheEntries:cache.size,snapshotCached:!!snapshotLatest};}
export function formatCardMetric(s){return`${num(s?.completed)} / ${num(s?.total)} questions`;}
export function formatAccuracy(s){return s?.accuracySample?`${num(s.accuracy)}% accuracy`:'— accuracy';}

// Compatibility exports for existing student apps during migration.
export async function loadCardStats(plan,_studentId,{force=false}={}){return loadPlanStats(plan,{force})}
export function invalidateCardStats(planOrId){return invalidatePlanStats(planOrId)}
export function reviewCounts(planOrId){return getReviewCounts(planOrId)}
