const EDGE='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-student-rev47e';
const API_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const LOGIN='/students/signin.html?next='+encodeURIComponent('/students/test-prep-v2/');

const state={user:null,plans:[],plan:null,lesson:null,session:null,practice:null,startedAt:0};
const token=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
const routedFetch=(url,opts={})=>window.WillenaAPI?.fetch?window.WillenaAPI.fetch(url,{credentials:'include',cache:'no-store',...opts}):fetch(url,{credentials:'include',cache:'no-store',...opts});

async function refreshToken(){
  try{const r=await routedFetch(`/.netlify/functions/supabase_auth?action=refresh&_=${Date.now()}`),d=await r.json().catch(()=>({}));if(r.ok&&d?.success&&d.access_token){window.WillenaAPI?.setLocalTokens?.(d.access_token,d.refresh_token||'');return d.access_token}}catch(_){}
  return'';
}
async function ensureToken(){return token()||await refreshToken()}
async function edge(action,opts={}){
  const access=await ensureToken();if(!access)throw new Error('AUTH_REQUIRED');
  const headers={...(opts.headers||{}),Authorization:`Bearer ${access}`,apikey:API_KEY};
  const r=await fetch(`${EDGE}?action=${encodeURIComponent(action)}`,{...opts,headers,cache:'no-store',credentials:'omit'}),text=await r.text();
  let data={};try{data=JSON.parse(text)}catch{throw new Error(`Invalid API response (${r.status})`)}
  if(r.status===401)throw new Error('AUTH_REQUIRED');if(!r.ok||data.success===false)throw new Error(data.error||`Request failed (${r.status})`);return data;
}
export async function initTracking(){
  try{const d=await edge('me');state.user=d.user||null;state.plans=Array.isArray(d.plans)?d.plans:[];return state}catch(e){if(e.message==='AUTH_REQUIRED'){location.replace(LOGIN);return state}throw e}
}
export async function refreshTrackingState(){const d=await edge('me');state.user=d.user||null;state.plans=Array.isArray(d.plans)?d.plans:[];return state}
export function setTrackingContext(plan,lesson){state.plan=plan||null;state.lesson=lesson||null;state.session=null;state.practice=null;state.startedAt=0}
export async function startSession(practiceType){
  if(state.session&&state.practice===practiceType)return state.session;
  if(state.session)await completeSession({correct:0,total:0,wrongIds:[]});
  if(!state.plan)throw new Error('No active test-prep plan.');
  const d=await edge('start_session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan_id:state.plan.id,practice_type:practiceType,unit_key:state.lesson||null})});
  state.session=d.session||null;state.practice=practiceType;state.startedAt=Date.now();return state.session;
}
function uuid(){try{return crypto.randomUUID()}catch(_){return'v2-'+Date.now()+'-'+Math.random().toString(36).slice(2)}}
export async function recordAttempt({question,response,result,practiceType,skipped=false}){
  const session=await startSession(practiceType);if(!session)return null;
  const attempt={
    client_attempt_id:uuid(),session_id:session.id,question_id:String(question.id),selected_answer:response,correct_answer:question.answer,is_correct:!!result.correct,
    question_type:question.tracking?.questionType||null,targets:Array.isArray(question.tracking?.targets)?question.tracking.targets:[],response_time_ms:Number(result.responseTimeMs)||0,
    metadata:{renderer_rev:'v2.1',form:question.form,mastery_key:question.masteryKey,source_code:question.source?.code||null,source_id:question.source?.sourceId||null,source_question_number:question.source?.sourceQuestionNumber??null,grading_method:result.method||null,ai_reason:result.aiReason||null,lesson:state.lesson,plan_id:state.plan?.id||null,practice_type:practiceType,skipped:!!skipped,source:skipped?'skip':'test-prep-v2'}
  };
  return edge('batch_attempts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:session.id,attempts:[attempt]})});
}
export async function completeSession({correct=0,total=0,wrongIds=[]}={}){
  const s=state.session;if(!s)return null;
  const activeTimeMs=state.startedAt?Math.max(0,Date.now()-state.startedAt):0;
  try{return await edge('complete_session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:s.id,correct_count:Number(correct)||0,question_count:Number(total)||0,wrong_ids:Array.isArray(wrongIds)?wrongIds:[],active_time_ms:activeTimeMs})})}
  finally{state.session=null;state.practice=null;state.startedAt=0}
}
export function trackingState(){return state}
