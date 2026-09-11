const EDGE='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-student-rev47e';
const API_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const LOGIN='/students/signin.html?next='+encodeURIComponent('/students/test-prep-v2/');
const OUTBOX_KEY='willena_testprep_v2_attempt_outbox';
const SESSION_KEY='willena_testprep_v2_active_session';
const CLOSE_KEY='willena_testprep_v2_pending_session_closes';
const BATCH_SIZE=5;
const FLUSH_DELAY=12000;

const state={user:null,plans:[],plan:null,lesson:null,session:null,practice:null,startedAt:0};
let outbox=readList(OUTBOX_KEY),pendingCloses=readList(CLOSE_KEY),recoveredSession=readObject(SESSION_KEY);
let flushTimer=null,flushPromise=null,closePromise=null,activeMs=0,activeTick=0;

const token=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
const routedFetch=(url,opts={})=>window.WillenaAPI?.fetch?window.WillenaAPI.fetch(url,{credentials:'include',cache:'no-store',...opts}):fetch(url,{credentials:'include',cache:'no-store',...opts});

function readList(key){try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[]}catch(_){return[]}}
function readObject(key){try{const v=JSON.parse(localStorage.getItem(key)||'null');return v&&typeof v==='object'&&!Array.isArray(v)?v:null}catch(_){return null}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch(_){}}
function remove(key){try{localStorage.removeItem(key)}catch(_){}}
function saveOutbox(){write(OUTBOX_KEY,outbox.slice(-300))}
function savePendingCloses(){write(CLOSE_KEY,pendingCloses.slice(-30))}
function emit(type,data={}){try{window.dispatchEvent(new CustomEvent('testprep:v2-tracking',{detail:{type,at:new Date().toISOString(),...data}}))}catch(_){}}
function uuid(){try{return crypto.randomUUID()}catch(_){return'v2-'+Date.now()+'-'+Math.random().toString(36).slice(2)}}

function isActive(){return !document.hidden&&document.hasFocus()}
function syncActive(){
  const now=performance.now();
  if(activeTick)activeMs+=Math.max(0,now-activeTick);
  activeTick=state.session&&isActive()?now:0;
}
function beginActive(baseMs=0){activeMs=Math.max(0,Number(baseMs)||0);activeTick=state.session&&isActive()?performance.now():0}
function getActiveTimeMs(){syncActive();return Math.max(0,Math.round(activeMs))}
function resetActive(){activeMs=0;activeTick=0}
function saveSessionRecord(){
  if(!state.session){remove(SESSION_KEY);return}
  write(SESSION_KEY,{session:state.session,planId:state.plan?.id||null,lesson:state.lesson||null,practice:state.practice||null,startedAt:state.startedAt||Date.now(),activeTimeMs:getActiveTimeMs(),savedAt:new Date().toISOString()});
}

async function refreshToken(){
  try{const r=await routedFetch(`/.netlify/functions/supabase_auth?action=refresh&_=${Date.now()}`),d=await r.json().catch(()=>({}));if(r.ok&&d?.success&&d.access_token){window.WillenaAPI?.setLocalTokens?.(d.access_token,d.refresh_token||'');return d.access_token}}catch(_){}
  return'';
}
async function requestEdge(action,opts,access){
  const headers={...(opts.headers||{}),Authorization:`Bearer ${access}`,apikey:API_KEY};
  return fetch(`${EDGE}?action=${encodeURIComponent(action)}`,{...opts,headers,cache:'no-store',credentials:'omit'});
}
async function edge(action,opts={}){
  let access=token()||await refreshToken();if(!access)throw new Error('AUTH_REQUIRED');
  let r=await requestEdge(action,opts,access);
  if(r.status===401){access=await refreshToken();if(!access)throw new Error('AUTH_REQUIRED');r=await requestEdge(action,opts,access)}
  const text=await r.text();let data={};try{data=JSON.parse(text)}catch{throw new Error(`Invalid API response (${r.status})`)}
  if(r.status===401)throw new Error('AUTH_REQUIRED');if(!r.ok||data.success===false)throw new Error(data.error||`Request failed (${r.status})`);return data;
}

function syncStateFromMe(d){state.user=d.user||null;state.plans=Array.isArray(d.plans)?d.plans:[];return state}
export async function initTracking(){
  try{
    const d=await edge('me');syncStateFromMe(d);
    setTimeout(async()=>{await flushAttemptBatch('recovery');await flushPendingSessionCloses('recovery')},250);
    return state;
  }catch(e){if(e.message==='AUTH_REQUIRED'){location.replace(LOGIN);return state}throw e}
}
export async function refreshTrackingState(){const d=await edge('me');return syncStateFromMe(d)}

function sameContext(record,practiceType){
  return !!(record?.session&&String(record.planId||'')===String(state.plan?.id||'')&&String(record.lesson||'')===String(state.lesson||'')&&String(record.practice||'')===String(practiceType||''));
}
function recoverSession(practiceType){
  if(!sameContext(recoveredSession,practiceType))return null;
  const sessionId=String(recoveredSession.session?.id||'');
  if(!sessionId||pendingCloses.some(x=>String(x.session_id)===sessionId)){recoveredSession=null;remove(SESSION_KEY);return null}
  state.session=recoveredSession.session;state.practice=String(practiceType);state.startedAt=Number(recoveredSession.startedAt)||Date.now();beginActive(recoveredSession.activeTimeMs);recoveredSession=null;saveSessionRecord();emit('session_recovered',{session_id:sessionId,practice_type:practiceType});return state.session;
}
export function setTrackingContext(plan,lesson){
  if(state.session)saveSessionRecord();
  state.plan=plan||null;state.lesson=lesson||null;
  if(!state.session){state.practice=null;state.startedAt=0;resetActive()}
}
export async function startSession(practiceType){
  const practice=String(practiceType||'').toLowerCase();
  const sameLiveContext=state.session&&state.practice===practice&&String(state.session?.unit_key||'')===String(state.lesson||'');
  if(sameLiveContext)return state.session;
  if(state.session)await completeSession({correct:0,total:0,wrongIds:[]});
  await flushPendingSessionCloses('before-start');
  if(!state.plan)throw new Error('No active test-prep plan.');
  const recovered=recoverSession(practice);if(recovered)return recovered;
  const d=await edge('start_session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan_id:state.plan.id,practice_type:practice,unit_key:state.lesson||null})});
  state.session=d.session||null;state.practice=practice;state.startedAt=Date.now();beginActive(0);saveSessionRecord();emit('session_started',{session_id:state.session?.id||null,plan_id:state.plan.id,lesson:state.lesson,practice_type:practice});return state.session;
}

function scheduleFlush(){if(flushTimer||!outbox.length)return;flushTimer=setTimeout(()=>{flushTimer=null;flushAttemptBatch('timer')},FLUSH_DELAY)}
export async function flushAttemptBatch(reason='manual'){
  if(flushPromise)return flushPromise;
  if(!outbox.length)return{saved:0,remaining:0};
  if(flushTimer){clearTimeout(flushTimer);flushTimer=null}
  const snapshot=outbox.slice();
  flushPromise=(async()=>{
    const groups=new Map();for(const a of snapshot){if(!groups.has(a.session_id))groups.set(a.session_id,[]);groups.get(a.session_id).push(a)}
    let saved=0;
    for(const [sessionId,attempts] of groups){
      try{
        const d=await edge('batch_attempts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sessionId,attempts})});
        const ack=new Set((d.results||[]).filter(r=>r?.success&&r.client_attempt_id).map(r=>String(r.client_attempt_id)));
        if(ack.size){outbox=outbox.filter(a=>!ack.has(String(a.client_attempt_id)));saved+=ack.size;saveOutbox();emit('attempts_saved',{session_id:sessionId,count:ack.size,reason})}
      }catch(e){console.warn('[v2 tracking] batch save failed',e);emit('sync_error',{kind:'attempts',session_id:sessionId,error:String(e?.message||e)})}
    }
    return{saved,remaining:outbox.length};
  })().finally(()=>{flushPromise=null;if(outbox.length)scheduleFlush()});
  return flushPromise;
}

function queueClose(req){
  const id=String(req.session_id);const i=pendingCloses.findIndex(x=>String(x.session_id)===id);
  if(i>=0)pendingCloses[i]={...pendingCloses[i],...req};else pendingCloses.push(req);
  savePendingCloses();
}
async function flushSessionAttempts(sessionId){
  for(let i=0;i<4;i++){
    if(flushPromise)await flushPromise;
    if(!outbox.some(a=>String(a.session_id)===String(sessionId)))return true;
    await flushAttemptBatch('complete');
    if(!navigator.onLine)break;
  }
  return !outbox.some(a=>String(a.session_id)===String(sessionId));
}
export async function flushPendingSessionCloses(reason='manual'){
  if(closePromise)return closePromise;
  if(!pendingCloses.length)return{closed:0,remaining:0};
  closePromise=(async()=>{
    let closed=0;
    for(const req of [...pendingCloses]){
      const sid=String(req.session_id||'');if(!sid)continue;
      if(!await flushSessionAttempts(sid))continue;
      try{
        await edge('complete_session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(req)});
        pendingCloses=pendingCloses.filter(x=>String(x.session_id)!==sid);savePendingCloses();closed++;emit('session_completed',{...req,reason});
      }catch(e){console.warn('[v2 tracking] session close failed',e);emit('sync_error',{kind:'session',session_id:sid,error:String(e?.message||e)})}
    }
    return{closed,remaining:pendingCloses.length};
  })().finally(()=>{closePromise=null});
  return closePromise;
}

export async function recordAttempt({question,response,result,practiceType,skipped=false,source='test-prep-v2',metadata={}}){
  const session=await startSession(practiceType);if(!session)return null;
  const trackedQuestionId=String(question.tracking?.questionId||question.id);
  const attemptSource=skipped&&source==='test-prep-v2'?'skip':String(source||'test-prep-v2');
  const extra=metadata&&typeof metadata==='object'?metadata:{};
  const attempt={
    client_attempt_id:uuid(),session_id:session.id,question_id:trackedQuestionId,selected_answer:response,correct_answer:question.answer,is_correct:!!result.correct,
    question_type:question.tracking?.questionType||null,targets:Array.isArray(question.tracking?.targets)?question.tracking.targets:[],response_time_ms:Number(result.responseTimeMs)||0,
    metadata:{app_rev:'2.17',renderer_rev:'central-v2',form:question.form,mastery_key:question.masteryKey,variant_question_id:String(question.id),source_code:question.source?.code||null,source_id:question.source?.sourceId||null,source_question_number:question.source?.sourceQuestionNumber??null,grading_method:result.method||null,ai_reason:result.aiReason||null,lesson:state.lesson,plan_id:state.plan?.id||null,practice_type:practiceType,skipped:!!skipped,...extra,source:attemptSource}
  };
  if(attemptSource==='wrong-review')attempt.metadata.review_mode=true;
  outbox.push(attempt);saveOutbox();saveSessionRecord();emit('attempt_queued',{client_attempt_id:attempt.client_attempt_id,session_id:session.id,question_id:attempt.question_id,practice_type:practiceType,source:attemptSource});
  const urgent=attempt.metadata.source==='wrong-review';
  if(urgent)await flushAttemptBatch('review');else if(outbox.length>=BATCH_SIZE)flushAttemptBatch('size');else scheduleFlush();
  return{queued:true,client_attempt_id:attempt.client_attempt_id};
}

export async function completeSession({correct=0,total=0,wrongIds=[]}={}){
  const s=state.session;if(!s){resetActive();return null}
  const req={session_id:s.id,correct_count:Number(correct)||0,question_count:Number(total)||0,wrong_ids:Array.isArray(wrongIds)?wrongIds:[],active_time_ms:getActiveTimeMs()};
  queueClose(req);
  state.session=null;state.practice=null;state.startedAt=0;resetActive();remove(SESSION_KEY);recoveredSession=null;
  await flushAttemptBatch('complete');
  const result=await flushPendingSessionCloses('complete');
  return{queued:pendingCloses.some(x=>String(x.session_id)===String(s.id)),sync:result};
}

function handleActivityState(){syncActive();saveSessionRecord()}
document.addEventListener('visibilitychange',()=>{handleActivityState();if(document.hidden&&outbox.length)flushAttemptBatch('hidden')});
window.addEventListener('focus',handleActivityState);
window.addEventListener('blur',handleActivityState);
window.addEventListener('online',async()=>{await flushAttemptBatch('online');await flushPendingSessionCloses('online')});
window.addEventListener('pagehide',()=>{saveOutbox();savePendingCloses();saveSessionRecord()});

export function trackingState(){return{...state,sync:{queuedAttempts:outbox.length,flushing:!!flushPromise,pendingSessionCloses:pendingCloses.length}}}
