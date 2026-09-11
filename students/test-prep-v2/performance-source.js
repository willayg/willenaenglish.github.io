import {contentDbGet} from '../shared/content-db.js?v=1.0.0';

const TRACK_DB='https://fiieuiktlsivwfgyivai.supabase.co';
const TRACK_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
let assignmentCache=null;
const assessmentCache=new Map();

const token=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';

async function trackingRequest(path,{method='GET',body=null,prefer=''}={}){
  const access=token();
  if(!access)throw new Error('로그인이 필요합니다.');
  const headers={apikey:TRACK_KEY,Authorization:`Bearer ${access}`};
  if(body!=null)headers['Content-Type']='application/json';
  if(prefer)headers.Prefer=prefer;
  const response=await fetch(`${TRACK_DB}${path}`,{method,headers,body:body==null?null:JSON.stringify(body),cache:'no-store'});
  if(!response.ok)throw new Error(await response.text());
  const text=await response.text();
  return text?JSON.parse(text):null;
}

export async function loadPerformanceAssignments({force=false}={}){
  if(assignmentCache&&!force)return assignmentCache;
  const rows=await trackingRequest('/rest/v1/student_performance_assessments?select=id,student_id,plan_id,content_assessment_id,book_key,unit_key,title,due_date,status,metadata&status=eq.active&order=due_date.asc.nullslast,created_at.asc');
  assignmentCache=Array.isArray(rows)?rows:[];
  return assignmentCache;
}

export function performanceAssignmentsForPlan(planId){
  return (assignmentCache||[]).filter(row=>String(row.plan_id)===String(planId));
}

export function performanceAssignmentById(id){
  return (assignmentCache||[]).find(row=>String(row.id)===String(id))||null;
}

export async function loadPerformanceAssessment(assignment){
  if(!assignment?.content_assessment_id)throw new Error('수행평가 콘텐츠 연결이 없습니다.');
  const key=String(assignment.content_assessment_id);
  if(assessmentCache.has(key))return assessmentCache.get(key);
  const promise=Promise.all([
    contentDbGet(`/rest/v1/performance_assessment_sets?select=id,title,assessment_type,item_count,instructions,metadata,status,book_id,unit_id&id=eq.${encodeURIComponent(key)}&limit=1`),
    contentDbGet(`/rest/v1/performance_assessment_items?select=id,assessment_id,item_number,prompt_ko,target_en,chunks,exact_required,no_partial_credit,metadata&assessment_id=eq.${encodeURIComponent(key)}&order=item_number.asc`)
  ]).then(([sets,items])=>{
    if(!sets?.[0])throw new Error('수행평가 세트를 찾지 못했습니다.');
    if(!Array.isArray(items)||!items.length)throw new Error('수행평가 문장을 찾지 못했습니다.');
    return{assignment,set:sets[0],items};
  }).catch(e=>{assessmentCache.delete(key);throw e});
  assessmentCache.set(key,promise);
  return promise;
}

export async function loadPerformanceProgress(assignmentId){
  const rows=await trackingRequest(`/rest/v1/performance_assessment_progress?select=item_id,stage,mastered,last_correct,last_attempt_at,updated_at&assignment_id=eq.${encodeURIComponent(assignmentId)}&order=updated_at.asc`);
  const map=new Map();
  for(const row of Array.isArray(rows)?rows:[])map.set(String(row.item_id),row);
  return map;
}

export async function savePerformanceProgress({studentId,assignmentId,itemId,stage,mastered=false,lastCorrect=null}){
  if(!studentId||!assignmentId||!itemId)throw new Error('수행평가 진도 저장 정보가 부족합니다.');
  const now=new Date().toISOString();
  const row={student_id:studentId,assignment_id:assignmentId,item_id:itemId,stage:Math.max(0,Math.min(5,Number(stage)||0)),mastered:!!mastered,last_correct:lastCorrect,last_attempt_at:lastCorrect==null?null:now,updated_at:now};
  const result=await trackingRequest('/rest/v1/performance_assessment_progress?on_conflict=student_id,assignment_id,item_id',{method:'POST',body:row,prefer:'resolution=merge-duplicates,return=representation'});
  return Array.isArray(result)?result[0]||row:row;
}

export function clearPerformanceSourceCache(){assignmentCache=null;assessmentCache.clear()}
