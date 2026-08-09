(function(global){
'use strict';
var PROGRESS_ENDPOINT='/.netlify/functions/progress_summary';
var QUEUE_KEY='willena-study-attempt-queue-v1';
var PREVIEW_KEY='willena-study-preview-book';
var SCORING_VERSION=(global.WillenaActivityScoring&&WillenaActivityScoring.version)||'activity-v1';
var PROGRESS_VERSION='study-v1';
var SCHEDULER_VERSION='adaptive-v1';
var flushing=false;

function uuid(){if(global.crypto&&crypto.randomUUID)return crypto.randomUUID();return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0,v=c==='x'?r:(r&3|8);return v.toString(16);});}
function previewActive(){try{return !!sessionStorage.getItem(PREVIEW_KEY)||document.documentElement.classList.contains('study-preview-active');}catch(_){return document.documentElement.classList.contains('study-preview-active');}}
function ensureStatus(){if(!/^staging\./i.test(location.hostname))return null;var n=document.getElementById('studyRecordingStatus');if(n)return n;n=document.createElement('div');n.id='studyRecordingStatus';n.style.cssText='position:fixed;right:10px;bottom:10px;z-index:9998;padding:8px 11px;border-radius:999px;background:#173f46;color:#fff;font:700 12px Poppins,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.18);opacity:.9;max-width:calc(100vw - 20px);white-space:normal';n.textContent=previewActive()?'Preview · not recording':'Recorder ready';document.body.appendChild(n);return n;}
function setStatus(text,bg){var n=ensureStatus();if(!n)return;n.textContent=text;if(bg)n.style.background=bg;}
function readQueue(){try{var q=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');return Array.isArray(q)?q:[];}catch(_){return[];}}
function writeQueue(q){try{localStorage.setItem(QUEUE_KEY,JSON.stringify(q.slice(-100)));}catch(_){}}
function queueAttempt(item){var q=readQueue();if(!q.some(function(x){return x&&x.payload&&x.payload.client_attempt_id===item.payload.client_attempt_id;}))q.push(item);writeQueue(q);}
function sessionId(bookId,unitId){var key='willena-study-session-v1:'+bookId+':'+unitId;try{var id=sessionStorage.getItem(key);if(!id){id=uuid();sessionStorage.setItem(key,id);}return id;}catch(_){return uuid();}}
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
async function api(path,options){var response=await (global.WillenaAPI?WillenaAPI.fetch:fetch)(PROGRESS_ENDPOINT+path,Object.assign({credentials:'include',cache:'no-store'},options||{}));var data=await response.json().catch(function(){return{}});if(!response.ok||data&&data.success===false)throw new Error(data.error||('Study progress API failed ('+response.status+').'));return data;}
async function send(item){if(previewActive())return{success:false,skipped:'preview'};return api('?section=study_attempt&_='+Date.now(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload:item.payload})});}
async function getProgress(bookId,unitId){if(previewActive())return{success:true,preview:true,progress_version:PROGRESS_VERSION,unit_skills:[],needs_review:[]};var q='?section=study_progress&_='+Date.now();if(bookId)q+='&book_id='+encodeURIComponent(bookId);if(unitId)q+='&unit_id='+encodeURIComponent(unitId);return api(q);}
async function getAdaptiveState(){if(previewActive())return{success:true,preview:true,scheduler_version:SCHEDULER_VERSION,items:[]};return api('?section=adaptive_state&_='+Date.now());}
async function getContentMastery(bookId,unitId){if(previewActive())return{success:true,preview:true,progress_version:PROGRESS_VERSION,items:[]};var q='?section=study_content_mastery&_='+Date.now();if(bookId)q+='&book_id='+encodeURIComponent(bookId);if(unitId)q+='&unit_id='+encodeURIComponent(unitId);return api(q);}
async function flush(){if(flushing||previewActive())return;flushing=true;try{var q=readQueue(),remaining=[];for(var i=0;i<q.length;i++){try{await send(q[i]);}catch(error){remaining.push(q[i]);}}writeQueue(remaining);if(q.length&&!remaining.length)setStatus('Saved queued answers','#23704a');else if(remaining.length)setStatus('Queued '+remaining.length,'#a66a15');else setStatus('Recorder ready','#173f46');}finally{flushing=false;}}
async function record(detail){if(previewActive()){setStatus('Preview · not recording','#e60076');global.dispatchEvent(new CustomEvent('willena:study-recording',{detail:{status:'preview-skipped'}}));return;}var payload=payloadFrom(detail);if(!payload){setStatus('Recorder · missing activity data','#a0443c');return;}var item={payload:payload,queued_at:new Date().toISOString()};setStatus('Saving…','#315e64');try{var result=await send(item);setStatus('Saved ✓ · '+(result.study_context==='independent'?'independent':'current'),'#23704a');global.dispatchEvent(new CustomEvent('willena:study-recording',{detail:{status:'recorded',result:result,payload:payload}}));try{var progress=await getProgress(payload.book_id,payload.unit_id);global.dispatchEvent(new CustomEvent('willena:study-progress-updated',{detail:progress}));}catch(_){}try{var mastery=await getContentMastery(payload.book_id,payload.unit_id);global.dispatchEvent(new CustomEvent('willena:content-mastery-updated',{detail:{book_id:payload.book_id,unit_id:payload.unit_id,data:mastery}}));}catch(_){}}catch(error){console.warn('[WillenaStudyProgress] queued attempt after recording failure',error);queueAttempt(item);setStatus('Queued · '+error.message,'#a66a15');global.dispatchEvent(new CustomEvent('willena:study-recording',{detail:{status:'queued',error:error.message,payload:payload}}));}}

global.addEventListener('willena:activity-answer',function(event){record(event.detail);});
global.addEventListener('online',flush);
global.addEventListener('auth:changed',flush);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){ensureStatus();flush();},{once:true});else{ensureStatus();setTimeout(flush,0);}
global.WillenaStudyProgress={record:record,flush:flush,getProgress:getProgress,getAdaptiveState:getAdaptiveState,getContentMastery:getContentMastery,isPreview:previewActive,scoringVersion:SCORING_VERSION,progressVersion:PROGRESS_VERSION,schedulerVersion:SCHEDULER_VERSION};
})(window);
