(function(global){
'use strict';
var ENDPOINT='/.netlify/functions/log_word_attempt';
var refreshTimer=0;
function text(v){return String(v==null?'':v).trim();}
function valueText(v){if(Array.isArray(v))return v.join(' ');if(v&&typeof v==='object')try{return JSON.stringify(v);}catch(_){return String(v);}return String(v==null?'':v);}
function overlayOpen(){return !!document.getElementById('aiCoachPracticeOverlay');}
function scheduleHistoryRefresh(){
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(function(){
    var history=global.WillenaCoachHistory,coach=global.WillenaAICoach;
    if(!history||typeof history.refresh!=='function'||!coach||typeof coach.context!=='function')return;
    Promise.resolve(history.refresh(coach.context())).then(function(){if(!overlayOpen()&&typeof coach.refresh==='function')return coach.refresh();}).catch(function(){});
  },250);
}
function diagnose(activity,result){
  var engine=global.WillenaAICoachDiagnosis,history=global.WillenaCoachHistory;
  if(!engine||typeof engine.diagnose!=='function')return null;
  try{return engine.diagnose({activity:activity,result:result,history:history&&typeof history.getSnapshot==='function'?history.getSnapshot():null});}catch(e){console.warn('[AI Coach] mistake diagnosis failed',e);return null;}
}
async function record(detail){
  var result=detail&&detail.result||{};if(result.correct)return false;
  var activity=detail&&detail.activity||{},meta=activity.metadata||{};
  if(!overlayOpen()||meta.morphology_sidecar===true)return false;
  var diagnosis=diagnose(activity,result);
  var extra={source:'study_v2_ai_coach',skill:text(activity.skill),plan_type:text(meta.ai_coach_strict_concept||meta.source_label||''),activity_id:text(activity.id),book_id:text(meta.book_id),unit_id:text(meta.unit_id)};
  if(diagnosis)extra.diagnosis=diagnosis;
  var body={
    event_type:'attempt',
    session_id:'ai-coach-wrong-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),
    mode:'ai_coach',
    word:text(activity.id||activity.sourceId||'ai-coach-answer'),
    is_correct:false,
    answer:valueText(result.selected),
    correct_answer:valueText(result.answer),
    points:0,
    duration_ms:Number(detail&&detail.responseTimeMs||result.responseTimeMs)||null,
    extra:extra
  };
  try{
    var request=(global.WillenaAPI&&typeof global.WillenaAPI.fetch==='function')?global.WillenaAPI.fetch:fetch;
    var r=await request(ENDPOINT,{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    var data=await r.json().catch(function(){return{};});
    if(!r.ok||data&&data.error)throw new Error((data&&data.error)||('attempt '+r.status));
    scheduleHistoryRefresh();
    return true;
  }catch(e){console.warn('[AI Coach] wrong attempt log failed',e);return false;}
}
global.addEventListener('willena:activity-answer',function(e){record(e&&e.detail||{});});
})(window);
