(function(){
'use strict';

const DASHBOARD_RPC='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/test_prep_teacher_dashboard_fast_v1';
const WRONG_EDGE='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-teacher-wrong-detail';
const API_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';

let dashboardPromise=null,dashboardRefreshPromise=null,latestDashboard=null;
const wrongCache=new Map(),latestWrong=new Map(),grammarCache=new Map(),latestGrammar=new Map();
const diag={requests:0,cacheHits:0,cacheMisses:0,lastMs:null,source:'naesin-snapshot-fast-v1'};

const token=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
const routedFetch=(url,opts={})=>window.WillenaAPI?.fetch?window.WillenaAPI.fetch(url,{credentials:'include',cache:'no-store',...opts}):fetch(url,{credentials:'include',cache:'no-store',...opts});
const num=v=>Number.isFinite(Number(v))?Number(v):0;

async function refreshToken(){
  try{
    const r=await routedFetch(`/.netlify/functions/supabase_auth?action=refresh&_=${Date.now()}`),d=await r.json().catch(()=>({}));
    if(r.ok&&d?.success&&d.access_token){window.WillenaAPI?.setLocalTokens?.(d.access_token,d.refresh_token||'');return d.access_token}
  }catch(_){ }
  return'';
}
async function accessToken(){return token()||await refreshToken()}
async function authedJson(url,opts={}){
  let access=await accessToken();if(!access)throw new Error('AUTH_REQUIRED');
  const run=t=>fetch(url,{...opts,headers:{apikey:API_KEY,Authorization:`Bearer ${t}`,...(opts.headers||{})},cache:'no-store',credentials:'omit'}),started=performance.now();
  diag.requests++;
  let r=await run(access);
  let payload=await r.json().catch(()=>({}));
  const staleRole=r.status===403&&String(payload?.error||payload?.message||'').toLowerCase().includes('teacher_access_required');
  if(r.status===401||staleRole){
    access=await refreshToken();
    if(access){r=await run(access);payload=await r.json().catch(()=>({}))}
  }
  diag.lastMs=performance.now()-started;
  if(r.status===401)throw new Error('AUTH_REQUIRED');
  if(!r.ok||payload?.success===false)throw new Error(payload?.error||payload?.message||`Naesin data request failed (${r.status})`);
  return payload;
}

async function requestDashboard(){return authedJson(DASHBOARD_RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})}
async function loadDashboard({force=false}={}){
  if(force){
    if(dashboardRefreshPromise){diag.cacheHits++;return dashboardRefreshPromise}
    diag.cacheMisses++;
    dashboardRefreshPromise=requestDashboard().then(payload=>{latestDashboard=payload;dashboardPromise=Promise.resolve(payload);return payload}).finally(()=>{dashboardRefreshPromise=null});
    return dashboardRefreshPromise;
  }
  if(dashboardPromise){diag.cacheHits++;return dashboardPromise}
  diag.cacheMisses++;
  dashboardPromise=requestDashboard().then(payload=>{latestDashboard=payload;return payload}).catch(error=>{dashboardPromise=null;latestDashboard=null;throw error});
  return dashboardPromise;
}

function groupsOf(payload){return Array.isArray(payload?.groups)?payload.groups:[]}
function groupItem(groupId,payload=latestDashboard){return groupsOf(payload).find(x=>String(x?.group?.id||'')===String(groupId||''))||null}
function memberByPlan(planId,payload=latestDashboard){for(const item of groupsOf(payload))for(const m of Array.isArray(item?.members)?item.members:[])if(String(m?.plan_id||'')===String(planId||''))return{item,member:m};return null}
function memberByGroupStudent(groupId,studentId,payload=latestDashboard){const item=groupItem(groupId,payload);if(!item)return null;const member=(item.members||[]).find(m=>String(m?.student_id||m?.student?.id||'')===String(studentId||''));return member?{item,member}:null}
function reviewLessons(items){
  const by=new Map();
  for(const row of Array.isArray(items)?items:[]){
    const key=String(row?.unit_id||row?.unit_key||row?.lesson||'');if(!key)continue;
    const cur=by.get(key)||{unit_id:row?.unit_id||null,lesson:row?.unit_key||row?.lesson||key,wrong_now:0,wrong_later:0,total:0};
    cur.total++;if(row?.is_waiting)cur.wrong_later++;else cur.wrong_now++;by.set(key,cur);
  }
  return [...by.values()];
}
function reviewForOverview(review={}){
  return{wrong_now:num(review.active),wrong_later:num(review.waiting),total:num(review.total),cleared:num(review.cleared),next_review_at:review.next_review_at||null,status:'snapshot',lessons:reviewLessons(review.items)};
}
function overviewFrom(item,member){
  if(!item||!member)return null;
  return{
    student:member.student||{},
    group:item.group||{},
    stats:{summary:member.summary||{},skills:Array.isArray(member.skills)?member.skills:[],lessons:Array.isArray(member.lessons)?member.lessons:[],review:reviewForOverview(member.review||{}),response_times:Array.isArray(member.response_times)?member.response_times:[],grammar_patterns:Array.isArray(member.grammar_patterns)?member.grammar_patterns:[]},
    activity:member.activity||{},
    response_times:Array.isArray(member.response_times)?member.response_times:[],
    grammar_patterns:Array.isArray(member.grammar_patterns)?member.grammar_patterns:[],
    today:member.today||{},
    snapshot:{updated_at:member.snapshot_updated_at||null,version:member.snapshot_version||null,age_seconds:member.snapshot_age_seconds??null,stale:member.stale===true,dirty_since:member.dirty_since||null}
  };
}

async function loadGroups({force=false}={}){const d=await loadDashboard({force});return groupsOf(d)}
async function loadGroupMatrix(groupId,{force=false}={}){const d=await loadDashboard({force});const item=groupItem(groupId,d);if(!item)throw new Error('group not found');return{group:item.group||{},member_count:item.member_count??(item.members||[]).length,members:Array.isArray(item.members)?item.members:[]}}
async function loadStudentOverview(planId,{force=false}={}){const d=await loadDashboard({force});const hit=memberByPlan(planId,d);if(!hit)throw new Error('plan not found');return overviewFrom(hit.item,hit.member)}

async function requestWrong(studentId,planId){const qs=new URLSearchParams({student_id:String(studentId||''),_t:String(Date.now())});if(planId)qs.set('plan_id',String(planId));const payload=await authedJson(`${WRONG_EDGE}?${qs}`);return{items:Array.isArray(payload.items)?payload.items:[],meta:payload.meta||{},raw:payload}}
async function loadWrongDetail(studentId,planId,{force=false}={}){
  const key=`${String(studentId||'')}|${String(planId||'')}`;if(!studentId)throw new Error('student_id required');
  if(force){wrongCache.delete(key);latestWrong.delete(key)}
  if(wrongCache.has(key)){diag.cacheHits++;return wrongCache.get(key)}
  diag.cacheMisses++;
  const promise=requestWrong(studentId,planId).then(data=>{latestWrong.set(key,data);return data}).catch(error=>{wrongCache.delete(key);latestWrong.delete(key);throw error});wrongCache.set(key,promise);return promise;
}

async function loadGrammarTracking(groupId,studentId,{force=false}={}){
  const key=`${String(groupId||'')}|${String(studentId||'')}`;if(!groupId)throw new Error('group_id required');if(!studentId)throw new Error('student_id required');
  if(force){grammarCache.delete(key);latestGrammar.delete(key)}
  if(grammarCache.has(key)){diag.cacheHits++;return grammarCache.get(key)}
  diag.cacheMisses++;
  const promise=(async()=>{
    const d=await loadDashboard({force}),hit=memberByGroupStudent(groupId,studentId,d);if(!hit)throw new Error('student plan not found');
    const targets=(Array.isArray(hit.member.grammar_patterns)?hit.member.grammar_patterns:[]).filter(r=>num(r.recent_count)>0||num(r.unique_count)>0||num(r.current_wrong)>0);
    let wrong_questions=[];
    try{const wrong=await loadWrongDetail(studentId,hit.member.plan_id,{force});wrong_questions=Array.isArray(wrong?.items)?wrong.items.filter(x=>String(x?.practice_type||x?.section||x?.question_type||'').toLowerCase().includes('grammar')||x?.target):[]}catch(_){wrong_questions=[]}
    const data={targets,wrong_questions,snapshot_version:hit.member.snapshot_version||null,snapshot_updated_at:hit.member.snapshot_updated_at||null};latestGrammar.set(key,data);return data;
  })().catch(error=>{grammarCache.delete(key);latestGrammar.delete(key);throw error});
  grammarCache.set(key,promise);return promise;
}

function getCachedGroups(){return groupsOf(latestDashboard)}
function getCachedGroupMatrix(groupId){const item=groupItem(groupId);return item?{group:item.group||{},member_count:item.member_count??(item.members||[]).length,members:item.members||[]}:null}
function getCachedStudentOverview(planId){const hit=memberByPlan(planId);return hit?overviewFrom(hit.item,hit.member):null}
function getCachedWrongDetail(studentId,planId){return latestWrong.get(`${String(studentId||'')}|${String(planId||'')}`)||null}
function getCachedGrammarTracking(groupId,studentId){return latestGrammar.get(`${String(groupId||'')}|${String(studentId||'')}`)||null}
function invalidateDashboard(){dashboardPromise=null;dashboardRefreshPromise=null;latestDashboard=null}
function invalidateGroupMatrix(){invalidateDashboard()}
function invalidateStudentOverview(){invalidateDashboard()}
function invalidateWrongDetail(studentId,planId){if(studentId){const key=`${String(studentId)}|${String(planId||'')}`;wrongCache.delete(key);latestWrong.delete(key)}else{wrongCache.clear();latestWrong.clear()}}
function invalidateGrammarTracking(groupId,studentId){if(groupId&&studentId){const key=`${String(groupId)}|${String(studentId)}`;grammarCache.delete(key);latestGrammar.delete(key)}else{grammarCache.clear();latestGrammar.clear()}}
function invalidateGroups(){invalidateDashboard()}
function invalidateAll(){invalidateDashboard();invalidateWrongDetail();invalidateGrammarTracking()}
function getDiagnostics(){return{...diag,source:'naesin-snapshot-fast-v1',dashboardCached:!!latestDashboard,wrongCacheEntries:wrongCache.size,grammarCacheEntries:grammarCache.size,groupCount:groupsOf(latestDashboard).length,version:latestDashboard?.version||null,dirtyCount:latestDashboard?.dirty_count??null}}

window.NaesinV2Data={version:'snapshot-fast-v1',loadGroups,refreshGroups:()=>loadGroups({force:true}),getCachedGroups,loadGroupMatrix,refreshGroupMatrix:(groupId)=>loadGroupMatrix(groupId,{force:true}),getCachedGroupMatrix,invalidateGroupMatrix,loadStudentOverview,refreshStudentOverview:(planId)=>loadStudentOverview(planId,{force:true}),getCachedStudentOverview,invalidateStudentOverview,loadWrongDetail,refreshWrongDetail:(studentId,planId)=>loadWrongDetail(studentId,planId,{force:true}),getCachedWrongDetail,invalidateWrongDetail,loadGrammarTracking,refreshGrammarTracking:(groupId,studentId)=>loadGrammarTracking(groupId,studentId,{force:true}),getCachedGrammarTracking,invalidateGrammarTracking,invalidateGroups,invalidateAll,getDiagnostics};
})();
