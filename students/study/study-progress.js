(function(global){
'use strict';
var PROGRESS_ENDPOINT='/.netlify/functions/progress_summary';
var QUEUE_KEY='willena-study-attempt-queue-v1';
var PREVIEW_KEY='willena-study-preview-book';
var SCORING_VERSION=(global.WillenaActivityScoring&&WillenaActivityScoring.version)||'activity-v1';
var PROGRESS_VERSION='study-v1';
var SCHEDULER_VERSION='adaptive-v2-question-fast-pass';
var CONCEPT_EVIDENCE_VERSION='grammar-taxonomy-v1';
var flushing=false;
var taxonomyPromise=null;

function uuid(){if(global.crypto&&crypto.randomUUID)return crypto.randomUUID();return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0,v=c==='x'?r:(r&3|8);return v.toString(16);});}
function previewActive(){try{return !!sessionStorage.getItem(PREVIEW_KEY)||document.documentElement.classList.contains('study-preview-active');}catch(_){return document.documentElement.classList.contains('study-preview-active');}}
function ensureStatus(){if(!/^staging\./i.test(location.hostname))return null;var n=document.getElementById('studyRecordingStatus');if(n)return n;n=document.createElement('div');n.id='studyRecordingStatus';n.style.cssText='position:fixed;right:10px;bottom:10px;z-index:9998;padding:8px 11px;border-radius:999px;background:#173f46;color:#fff;font:700 12px Poppins,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.18);opacity:.9;max-width:calc(100vw - 20px);white-space:normal';n.textContent=previewActive()?'Preview · recording':'Recorder ready';document.body.appendChild(n);return n;}
function setStatus(text,bg){var n=ensureStatus();if(!n)return;n.textContent=text;if(bg)n.style.background=bg;}
function readQueue(){try{var q=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');return Array.isArray(q)?q:[];}catch(_){return[];}}
function writeQueue(q){try{localStorage.setItem(QUEUE_KEY,JSON.stringify(q.slice(-100)));}catch(_){}}
function queueAttempt(item){var q=readQueue();if(!q.some(function(x){return x&&x.payload&&x.payload.client_attempt_id===item.payload.client_attempt_id;}))q.push(item);writeQueue(q);}
function sessionId(bookId,unitId){var key='willena-study-session-v1:'+bookId+':'+unitId;try{var id=sessionStorage.getItem(key);if(!id){id=uuid();sessionStorage.setItem(key,id);}return id;}catch(_){return uuid();}}
function payloadFrom(detail){var activity=detail&&detail.activity||{},result=detail&&detail.result||{},meta=activity.metadata||{},bookId=meta.book_id,unitId=meta.unit_id;if(!bookId||!unitId)return null;var contentType=String(activity.sourceType||'activity'),contentId=activity.sourceId||null;var masteryType=meta.mastery_content_type||contentType,masteryId=meta.mastery_content_id||contentId;if(activity.skill==='grammar'&&meta.pattern_id){masteryType='pattern';masteryId=meta.pattern_id;}var isPreview=previewActive();return{
 session_id:sessionId(bookId,unitId),client_attempt_id:uuid(),book_id:bookId,unit_id:unitId,
 skill:String(activity.skill||'practice'),response_type:String(activity.response&&activity.response.type||'unknown'),
 content_type:contentType,content_id:contentId,mastery_content_type:String(masteryType||contentType),mastery_content_id:masteryId||null,occurrence_id:meta.occurrence_id||null,
 activity_id:String(activity.id||''),stimulus_snapshot:activity.stimulus||{},student_answer:result.selected===undefined?null:result.selected,
 correct_answer:result.answer===undefined?null:result.answer,score:result.correct?1:0,is_correct:!!result.correct,
 response_time_ms:Number(detail.responseTimeMs||result.responseTimeMs||0)||0,hints_used:0,retry_count:0,
 metadata:Object.assign({},meta,{usage:activity.usage||[],recorded_from:isPreview?'student-study-preview':'student-study',preview_mode:isPreview}),
 scoring_version:SCORING_VERSION,progress_version:PROGRESS_VERSION,study_context:isPreview?'independent':'current',preview_mode:false
 };}
function normalizeQueuedPreview(item){if(!item||!item.payload)return item;var p=item.payload,m=p.metadata||{};if(p.preview_mode===true||m.preview_mode===true||m.recorded_from==='student-study-preview'){p.preview_mode=false;p.study_context='independent';p.metadata=Object.assign({},m,{preview_mode:true,recorded_from:'student-study-preview'});}return item;}
function patternIdFor(payload){var m=payload&&payload.metadata||{};if(payload&&payload.skill==='grammar'&&m.pattern_id)return String(m.pattern_id);if(payload&&payload.mastery_content_type==='pattern'&&payload.mastery_content_id)return String(payload.mastery_content_id);if(payload&&payload.content_type==='pattern'&&payload.content_id)return String(payload.content_id);return'';}
function ensureConceptTaxonomy(){
 if(global.WillenaStudyConceptTaxonomy)return Promise.resolve(global.WillenaStudyConceptTaxonomy);
 if(taxonomyPromise)return taxonomyPromise;
 taxonomyPromise=new Promise(function(resolve){
   var s=document.createElement('script');s.src='./study-concept-taxonomy.js?v=20260819-concepts1';s.async=true;
   s.onload=function(){resolve(global.WillenaStudyConceptTaxonomy||null);};
   s.onerror=function(){resolve(null);};
   (document.head||document.documentElement).appendChild(s);
 });
 return taxonomyPromise;
}
async function attachConceptEvidence(payload){
 if(!payload||payload.skill!=='grammar')return payload;
 var patternId=patternIdFor(payload);if(!patternId)return payload;
 try{
   var taxonomy=await ensureConceptTaxonomy();
   if(!taxonomy||typeof taxonomy.getPatternConcepts!=='function')return payload;
   var evidence=await taxonomy.getPatternConcepts(patternId);
   if(Array.isArray(evidence)&&evidence.length)payload.metadata=Object.assign({},payload.metadata,{concept_evidence:evidence,concept_evidence_version:CONCEPT_EVIDENCE_VERSION});
 }catch(error){console.debug('[WillenaStudyProgress] concept evidence unavailable',error);}
 return payload;
}
function attachDiagnosis(payload){
 if(!payload||payload.is_correct)return payload;
 try{
   var engine=global.WillenaAICoachDiagnosis;
   if(!engine||typeof engine.diagnose!=='function')return payload;
   var history=global.WillenaCoachHistory&&typeof global.WillenaCoachHistory.getSnapshot==='function'?global.WillenaCoachHistory.getSnapshot():null;
   var activity={
     id:payload.activity_id,
     skill:payload.skill,
     sourceType:payload.content_type,
     sourceId:payload.content_id,
     stimulus:payload.stimulus_snapshot||{},
     response:{type:payload.response_type},
     metadata:payload.metadata||{}
   };
   var diagnosis=engine.diagnose({activity:activity,result:{correct:false,selected:payload.student_answer,answer:payload.correct_answer},history:history});
   if(diagnosis)payload.metadata=Object.assign({},payload.metadata,{diagnosis:diagnosis,diagnosis_version:diagnosis.version||engine.version||'coach-diagnosis'});
 }catch(error){console.debug('[WillenaStudyProgress] diagnosis unavailable',error);}
 return payload;
}
async function api(path,options){var response=await (global.WillenaAPI?WillenaAPI.fetch:fetch)(PROGRESS_ENDPOINT+path,Object.assign({credentials:'include',cache:'no-store'},options||{}));var data=await response.json().catch(function(){return{}});if(!response.ok||data&&data.success===false)throw new Error(data.error||('Study progress API failed ('+response.status+').'));return data;}
async function send(item){item=normalizeQueuedPreview(item);return api('?section=study_attempt&_='+Date.now(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload:item.payload})});}
async function getProgress(bookId,unitId){var q='?section=study_progress&_='+Date.now();if(bookId)q+='&book_id='+encodeURIComponent(bookId);if(unitId)q+='&unit_id='+encodeURIComponent(unitId);return api(q);}
async function getAdaptiveState(){return api('?section=adaptive_state&_='+Date.now());}
async function getContentMastery(bookId,unitId){var q='?section=study_content_mastery&_='+Date.now();if(bookId)q+='&book_id='+encodeURIComponent(bookId);if(unitId)q+='&unit_id='+encodeURIComponent(unitId);return api(q);}
async function flush(){if(flushing)return;flushing=true;try{var q=readQueue().map(normalizeQueuedPreview),remaining=[];for(var i=0;i<q.length;i++){try{await attachConceptEvidence(q[i].payload);attachDiagnosis(q[i].payload);await send(q[i]);}catch(error){remaining.push(q[i]);}}writeQueue(remaining);if(q.length&&!remaining.length)setStatus('Saved queued answers','#23704a');else if(remaining.length)setStatus('Queued '+remaining.length,'#a66a15');else setStatus(previewActive()?'Preview · recording':'Recorder ready','#173f46');}finally{flushing=false;}}
async function record(detail){var payload=payloadFrom(detail);if(!payload){setStatus('Recorder · missing activity data','#a0443c');return;}await attachConceptEvidence(payload);attachDiagnosis(payload);var item={payload:payload,queued_at:new Date().toISOString()};setStatus(previewActive()?'Preview · saving…':'Saving…','#315e64');try{var result=await send(item);setStatus((previewActive()?'Preview · ':'')+'Saved ✓ · '+(result.study_context==='independent'?'independent':'current'),'#23704a');global.dispatchEvent(new CustomEvent('willena:study-recording',{detail:{status:'recorded',result:result,payload:payload}}));try{var progress=await getProgress(payload.book_id,payload.unit_id);global.dispatchEvent(new CustomEvent('willena:study-progress-updated',{detail:progress}));}catch(_){}try{var mastery=await getContentMastery(payload.book_id,payload.unit_id);global.dispatchEvent(new CustomEvent('willena:content-mastery-updated',{detail:{book_id:payload.book_id,unit_id:payload.unit_id,data:mastery}}));}catch(_){}}catch(error){console.warn('[WillenaStudyProgress] queued attempt after recording failure',error);queueAttempt(item);setStatus('Queued · '+error.message,'#a66a15');global.dispatchEvent(new CustomEvent('willena:study-recording',{detail:{status:'queued',error:error.message,payload:payload}}));}}

global.addEventListener('willena:activity-answer',function(event){var activity=event&&event.detail&&event.detail.activity,meta=activity&&activity.metadata||{};if(meta.daily_test_mode===true||meta.morphology_sidecar===true||meta.ai_coach_cross_book===true)return;record(event.detail);});
global.addEventListener('online',flush);
global.addEventListener('auth:changed',flush);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){ensureStatus();flush();},{once:true});else{ensureStatus();setTimeout(flush,0);}
global.WillenaStudyProgress={record:record,flush:flush,getProgress:getProgress,getAdaptiveState:getAdaptiveState,getContentMastery:getContentMastery,isPreview:previewActive,scoringVersion:SCORING_VERSION,progressVersion:PROGRESS_VERSION,schedulerVersion:SCHEDULER_VERSION,conceptEvidenceVersion:CONCEPT_EVIDENCE_VERSION};
})(window);
