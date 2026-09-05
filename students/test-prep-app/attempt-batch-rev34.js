(function(){
'use strict';
const AUTH=window.WillenaTestPrepAuth;
if(!AUTH){console.warn('[REV34 batch] auth tracker unavailable');return}
const ENDPOINT='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-attempt-batch-staging';
const API_KEY=['sb_publishable_','e-K50PquV9gHdfmefG6tmg_','o-vVSl0e'].join('');
const STORAGE_KEY='willena_testprep_rev34_pending_attempts';
const BATCH_SIZE=5;
const FLUSH_DELAY_MS=12000;
const originalRecord=AUTH.recordAttempt.bind(AUTH);
const originalComplete=AUTH.completeSession.bind(AUTH);
let queue=[];
let flushing=false;
let flushTimer=null;
let sessionPromise=null;
let savedCount=0;
let failedCount=0;
let lastBatch='—';
let lastStatus='Idle';
const pendingEnqueues=new Set();
const events=[];

function loadQueue(){try{const raw=localStorage.getItem(STORAGE_KEY);const parsed=raw?JSON.parse(raw):[];return Array.isArray(parsed)?parsed:[]}catch(_){return[]}}
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(queue.slice(-200)))}catch(_){}}
function token(){try{return window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||''}catch(_){return''}}
function makeId(){try{return crypto.randomUUID()}catch(_){return 'tp-'+Date.now()+'-'+Math.random().toString(36).slice(2,10)}}
function addEvent(text){events.unshift(new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})+'  '+text);if(events.length>4)events.length=4;renderRecorder()}

function ensureRecorder(){if(document.getElementById('tpBatchRecorder34'))return;const el=document.createElement('div');el.id='tpBatchRecorder34';el.innerHTML='<div class="tpbr-head"><b>REV34 · BATCH RECORDER</b><span id="tpbrState">Idle</span></div><div class="tpbr-grid"><div><small>Queued</small><strong id="tpbrQueued">0</strong></div><div><small>Saved</small><strong id="tpbrSaved">0</strong></div><div><small>Failed</small><strong id="tpbrFailed">0</strong></div><div><small>Last batch</small><strong id="tpbrLast">—</strong></div></div><div id="tpbrEvents" class="tpbr-events">Waiting for attempts…</div>';
const s=document.createElement('style');s.id='tpBatchRecorder34Style';s.textContent='#tpBatchRecorder34{position:fixed;left:10px;bottom:10px;z-index:2147483646;width:min(330px,calc(100vw - 20px));background:rgba(24,39,46,.96);color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:10px 11px;font:700 10px/1.25 Poppins,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.22);pointer-events:none}.tpbr-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px}.tpbr-head b{font-size:10px;letter-spacing:.05em}.tpbr-head span{font-size:9px;padding:3px 7px;border-radius:999px;background:#314d58}.tpbr-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.tpbr-grid div{background:rgba(255,255,255,.07);border-radius:9px;padding:6px;min-width:0}.tpbr-grid small{display:block;font-size:8px;opacity:.68;margin-bottom:2px}.tpbr-grid strong{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tpbr-events{margin-top:7px;padding-top:6px;border-top:1px solid rgba(255,255,255,.12);font:600 8px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;opacity:.85;white-space:pre-line;min-height:12px}';document.head.appendChild(s);document.body.appendChild(el)}
function renderRecorder(){ensureRecorder();const q=document.getElementById('tpbrQueued'),sv=document.getElementById('tpbrSaved'),f=document.getElementById('tpbrFailed'),l=document.getElementById('tpbrLast'),st=document.getElementById('tpbrState'),ev=document.getElementById('tpbrEvents');if(q)q.textContent=String(queue.length);if(sv)sv.textContent=String(savedCount);if(f)f.textContent=String(failedCount);if(l)l.textContent=lastBatch;if(st){st.textContent=lastStatus;st.style.background=flushing?'#765d1f':lastStatus==='Error'?'#74363d':'#314d58'}if(ev)ev.textContent=events.length?events.join('\n'):'Waiting for attempts…'}

async function getSession(practiceType){const p=String(practiceType||'reading').toLowerCase();if(AUTH.state?.session&&AUTH.state?.sessionSection===p)return AUTH.state.session;if(sessionPromise)return sessionPromise;sessionPromise=(async()=>AUTH.ensureSession(p))();try{return await sessionPromise}finally{sessionPromise=null}}
function buildRequest(payload,s){return{client_attempt_id:makeId(),session_id:s.id,question_id:payload.question_id,selected_answer:payload.selected_answer,correct_answer:payload.correct_answer,is_correct:!!payload.is_correct,question_type:payload.question_type||null,targets:Array.isArray(payload.targets)?payload.targets:[],response_time_ms:Number(payload.response_time_ms)||0,metadata:{...(payload.metadata&&typeof payload.metadata==='object'?payload.metadata:{}),source_question_number:payload.source_question_number,question_type:payload.question_type,source_label:payload.source_label,lesson:AUTH.state?.lesson,plan_id:AUTH.state?.plan?.id}}}
function scheduleFlush(){if(flushTimer||!queue.length)return;flushTimer=setTimeout(()=>{flushTimer=null;flushQueue('timer')},FLUSH_DELAY_MS)}
async function enqueue(payload){const s=await getSession(payload?.practice_type);if(!s)throw new Error('No active test-prep session');const request=buildRequest(payload,s);queue.push(request);persist();lastStatus='Queued';addEvent('＋ '+String(request.metadata?.mastery_target_text||request.question_id).slice(0,28));if(queue.length>=BATCH_SIZE)await flushQueue('size');else scheduleFlush();return{queued:true,client_attempt_id:request.client_attempt_id}}

async function sendGroup(sessionId,attempts){const t=token();if(!t)throw new Error('No auth token');const res=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${t}`,apikey:API_KEY},cache:'no-store',credentials:'omit',body:JSON.stringify({session_id:sessionId,attempts})});const data=await res.json().catch(()=>({}));if(!res.ok||data?.success===false)throw new Error(data?.error||`Batch failed (${res.status})`);return data}
async function flushQueue(reason='manual'){
 if(flushing||!queue.length)return;
 flushing=true;lastStatus='Flushing';if(flushTimer){clearTimeout(flushTimer);flushTimer=null}renderRecorder();
 const snapshot=queue.splice(0,queue.length);persist();addEvent('⇧ FLUSH '+snapshot.length+' ('+reason+')');
 const groups=new Map();for(const a of snapshot){if(!groups.has(a.session_id))groups.set(a.session_id,[]);groups.get(a.session_id).push(a)}
 const failed=[];
 try{
  for(const [sid,attempts] of groups){try{const data=await sendGroup(sid,attempts);const okCount=(data?.results||[]).filter(r=>r?.success).length||attempts.length;savedCount+=okCount;lastBatch=attempts.length+' → '+okCount;addEvent('✓ SAVED '+okCount);try{window.dispatchEvent(new CustomEvent('testprep:tracking',{detail:{type:'attempt_batch_saved',at:new Date().toISOString(),count:okCount,session_id:sid}}))}catch(_){}}catch(e){failed.push(...attempts);failedCount+=attempts.length;lastBatch=attempts.length+' failed';lastStatus='Error';addEvent('✕ FAILED '+attempts.length);console.warn('[REV34 batch] batch save failed',e)}}
 }finally{
  if(failed.length){queue=[...failed,...queue];persist();scheduleFlush()}else{lastStatus='Idle'}flushing=false;renderRecorder();
 }
}
async function waitPendingEnqueues(){if(!pendingEnqueues.size)return;await Promise.allSettled([...pendingEnqueues])}

AUTH.recordAttempt=function(payload){const p=enqueue(payload).catch(e=>{failedCount++;lastStatus='Error';addEvent('✕ QUEUE ERROR');console.warn('[REV34 batch] queue failed',e);return originalRecord(payload)});pendingEnqueues.add(p);p.finally(()=>pendingEnqueues.delete(p));return p};
AUTH.completeSession=async function(correctCount,questionCount,wrongIds){await waitPendingEnqueues();await flushQueue('complete');return originalComplete(correctCount,questionCount,wrongIds)};
AUTH.flushAttemptBatch=flushQueue;
AUTH.getAttemptBatchState=()=>({queued:queue.length,flushing,saved:savedCount,failed:failedCount,lastBatch});

queue=loadQueue();ensureRecorder();if(queue.length){lastStatus='Recovered';addEvent('↻ recovered '+queue.length);setTimeout(()=>flushQueue('recovery'),1500)}else renderRecorder();
document.addEventListener('visibilitychange',()=>{if(document.hidden&&queue.length)flushQueue('hidden')});
window.addEventListener('online',()=>{if(queue.length)flushQueue('online')});
window.addEventListener('pagehide',()=>persist());
console.log('[REV34 batch] staging attempt batching active',{batchSize:BATCH_SIZE,flushDelayMs:FLUSH_DELAY_MS});
})();