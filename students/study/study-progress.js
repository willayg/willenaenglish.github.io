(function(global){
'use strict';
var OP_URL='https://fiieuiktlsivwfgyivai.supabase.co';
var OP_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
var AUTH_ENDPOINT='/.netlify/functions/supabase_auth';
var QUEUE_KEY='willena-study-attempt-queue-v1';
var PREVIEW_KEY='willena-study-preview-book';
var SCORING_VERSION='activity-v1';
var PROGRESS_VERSION='study-v1';
var cachedAuth=null;
var flushing=false;

function uuid(){if(global.crypto&&crypto.randomUUID)return crypto.randomUUID();return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0,v=c==='x'?r:(r&3|8);return v.toString(16);});}
function previewActive(){try{return !!sessionStorage.getItem(PREVIEW_KEY)||document.documentElement.classList.contains('study-preview-active');}catch(_){return document.documentElement.classList.contains('study-preview-active');}}
function readQueue(){try{var q=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');return Array.isArray(q)?q:[];}catch(_){return[];}}
function writeQueue(q){try{localStorage.setItem(QUEUE_KEY,JSON.stringify(q.slice(-100)));}catch(_){}}
function queueAttempt(item){var q=readQueue();if(!q.some(function(x){return x&&x.payload&&x.payload.client_attempt_id===item.payload.client_attempt_id;}))q.push(item);writeQueue(q);}
function sessionId(bookId,unitId){var key='willena-study-session-v1:'+bookId+':'+unitId;try{var id=sessionStorage.getItem(key);if(!id){id=uuid();sessionStorage.setItem(key,id);}return id;}catch(_){return uuid();}}
async function authRequest(action){var response=await (global.WillenaAPI?WillenaAPI.fetch:fetch)(AUTH_ENDPOINT+'?action='+encodeURIComponent(action)+'&_='+Date.now(),{credentials:'include',cache:'no-store'});var data=await response.json().catch(function(){return{}});return{response:response,data:data};}
async function getAuth(force){if(cachedAuth&&!force)return cachedAuth;var refresh=await authRequest('refresh');if(!refresh.response.ok||!refresh.data.success||!refresh.data.access_token)throw new Error('Could not refresh study recording session.');if(global.WillenaAPI&&WillenaAPI.setLocalTokens)WillenaAPI.setLocalTokens(refresh.data.access_token,refresh.data.refresh_token);var who=await authRequest('whoami');if(!who.response.ok||!who.data.success)throw new Error('Could not identify student for study recording.');var userId=who.data.user_id||who.data.id;if(!userId)throw new Error('Student ID missing from session.');cachedAuth={studentId:userId,accessToken:refresh.data.access_token};return cachedAuth;}
async function rpc(name,args,forceAuth){var auth=await getAuth(!!forceAuth);var response=await fetch(OP_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:OP_KEY,Authorization:'Bearer '+auth.accessToken,'Content-Type':'application/json'},body:JSON.stringify(args),cache:'no-store'});if(response.status===401&&!forceAuth){cachedAuth=null;return rpc(name,args,true);}var data=await response.json().catch(function(){return{}});if(!response.ok)throw new Error(data.message||data.error||('Study progress RPC failed ('+response.status+').'));return data;}
function payloadFrom(detail){var activity=detail&&detail.activity||{},result=detail&&detail.result||{},meta=activity.metadata||{},bookId=meta.book_id,unitId=meta.unit_id;if(!bookId||!unitId)return null;return{
 session_id:sessionId(bookId,unitId),client_attempt_id:uuid(),book_id:bookId,unit_id:unitId,
 skill:String(activity.skill||'practice'),response_type:String(activity.response&&activity.response.type||'unknown'),
 content_type:String(activity.sourceType||'activity'),content_id:activity.sourceId||null,occurrence_id:meta.occurrence_id||null,
 activity_id:String(activity.id||''),stimulus_snapshot:activity.stimulus||{},student_answer:result.selected===undefined?null:result.selected,
 correct_answer:result.answer===undefined?null:result.answer,score:result.correct?1:0,is_correct:!!result.correct,
 response_time_ms:Number(detail.responseTimeMs||result.responseTimeMs||0)||0,hints_used:0,retry_count:0,
 metadata:Object.assign({},meta,{usage:activity.usage||[],recorded_from:'student-study'}),
 scoring_version:SCORING_VERSION,progress_version:PROGRESS_VERSION,preview_mode:false
 };}
async function send(item){if(previewActive())return{success:false,skipped:'preview'};var auth=await getAuth(false);return rpc('record_study_attempt_v1',{p_student_id:auth.studentId,p_payload:item.payload},false);}
async function getProgress(bookId,unitId){if(previewActive())return{success:true,preview:true,progress_version:PROGRESS_VERSION,unit_skills:[],needs_review:[]};var auth=await getAuth(false);return rpc('get_study_progress_v1',{p_student_id:auth.studentId,p_book_id:bookId||null,p_unit_id:unitId||null},false);}
async function flush(){if(flushing||previewActive())return;flushing=true;try{var q=readQueue(),remaining=[];for(var i=0;i<q.length;i++){try{await send(q[i]);}catch(error){remaining.push(q[i]);}}writeQueue(remaining);}finally{flushing=false;}}
async function record(detail){if(previewActive()){global.dispatchEvent(new CustomEvent('willena:study-recording',{detail:{status:'preview-skipped'}}));return;}var payload=payloadFrom(detail);if(!payload)return;var item={payload:payload,queued_at:new Date().toISOString()};try{var result=await send(item);global.dispatchEvent(new CustomEvent('willena:study-recording',{detail:{status:'recorded',result:result,payload:payload}}));try{var progress=await getProgress(payload.book_id,payload.unit_id);global.dispatchEvent(new CustomEvent('willena:study-progress-updated',{detail:progress}));}catch(_){}}catch(error){console.warn('[WillenaStudyProgress] queued attempt after recording failure',error);queueAttempt(item);global.dispatchEvent(new CustomEvent('willena:study-recording',{detail:{status:'queued',error:error.message,payload:payload}}));}}

global.addEventListener('willena:activity-answer',function(event){record(event.detail);});
global.addEventListener('online',flush);
global.addEventListener('auth:changed',function(){cachedAuth=null;flush();});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',flush,{once:true});else setTimeout(flush,0);
global.WillenaStudyProgress={record:record,flush:flush,getProgress:getProgress,isPreview:previewActive,scoringVersion:SCORING_VERSION,progressVersion:PROGRESS_VERSION};
})(window);
