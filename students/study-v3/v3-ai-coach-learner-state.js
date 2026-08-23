(function(global){
'use strict';

var VERSION='coach-learner-state-v1.1';
function text(v){return String(v==null?'':v).trim();}
function lower(v){return text(v).toLowerCase();}
function arr(v){return Array.isArray(v)?v:[];}
function num(v){var n=Number(v);return Number.isFinite(n)?n:0;}
function clamp(v,min,max){return Math.max(min,Math.min(max,num(v)));}
function meta(a){return a&&a.metadata&&typeof a.metadata==='object'?a.metadata:{};}
function skill(a,d){return lower(a&&a.skill||d&&d.skill||meta(a).skill);}
function responseType(a){return lower(a&&a.response&&a.response.type||meta(a).response_type);}
function isSpeech(a,r){return skill(a).indexOf('speak')>=0||responseType(a)==='speech'||!!meta(a).v3_speaking_integration||r&&r.speech_match!=null;}
function speechUncertain(r){if(!r)return false;return r.skipped===true||r.speech_match==='close'||r.accepted_by==='two_close_matches'||(r.similarity!=null&&num(r.similarity)>=.7&&num(r.similarity)<.9);}
function diagnosisKey(d){return text(d&&d.subtype||d&&d.category);}
function conceptCode(d,a){var m=meta(a);return text(d&&d.concept||m.concept_code||m.ai_coach_strict_concept||m.target_form_type||m.grammar_concept||'');}
function sameDiagnosisAttempts(history,key){return arr(history&&history.recentAttempts).filter(function(x){var dx=x&&x.diagnosis;return dx&&diagnosisKey(dx)===key;});}
function masteryFor(history,code){code=lower(code);if(!code)return null;return arr(history&&history.grammar&&history.grammar.mastery).find(function(x){return lower(x&&x.key)===code||lower(x&&x.name)===code;})||null;}
function recentCorrectFor(history,key,code){var attempts=arr(history&&history.recentAttempts).slice(0,80);code=lower(code);return attempts.filter(function(x){if(!x||!x.correct)return false;var d=x.diagnosis||{};if(key&&diagnosisKey(d)===key)return true;return code&&lower(d.concept)===code;}).length;}
function productionActivity(a){var s=skill(a),rt=responseType(a),m=meta(a);return rt==='speech'||/sentence|build|order|write|spell|speak|production/.test(s+' '+rt+' '+lower(m.production_mode||m.question_form));}
function recognitionActivity(a){var s=skill(a),rt=responseType(a),m=meta(a);return /choice|select|match|listen|recognition|receptive/.test(s+' '+rt+' '+lower(m.production_mode||m.question_form));}

function interpret(input){
  input=input||{};
  var d=input.diagnosis||{},a=input.activity||{},r=input.result||{},h=input.history||null;
  var key=diagnosisKey(d),code=conceptCode(d,a),speech=isSpeech(a,r),uncertain=speech&&speechUncertain(r);
  var same=sameDiagnosisAttempts(h,key),misses=same.filter(function(x){return !x.correct;}).length;
  var correct=same.filter(function(x){return x.correct;}).length+recentCorrectFor(h,key,code);
  var mastery=masteryFor(h,code),attempts=num(mastery&&mastery.attempts),accuracy=num(mastery&&mastery.accuracy),masteryScore=num(mastery&&mastery.mastery),lapses=num(mastery&&mastery.lapses);
  var recurring=!!d.recurring||misses>=2||lapses>0;
  var strongHistory=(attempts>=3&&masteryScore>=80&&accuracy>=80)||correct>=5;
  var weakHistory=(attempts>=2&&(masteryScore<70||accuracy<75))||misses>=2||lapses>0;
  var state='single_mistake',label='Single mistake',confidence=.55,action='light_retry';

  if(speech&&uncertain){
    state='speech_uncertainty';label='Speech recognition uncertainty';confidence=.94;action='retry_speech_later';
  }else if(speech&&!r.correct&&num(r.similarity)>=.55){
    state='speech_uncertainty';label='Possible speech recognition mismatch';confidence=.82;action='retry_speech_later';
  }else if(d.possibleSlip||(!recurring&&strongHistory)){
    state='likely_slip';label='Likely slip';confidence=d.possibleSlip?.9:.82;action='light_retry';
  }else if(weakHistory&&productionActivity(a)&&!recognitionActivity(a)){
    state='recall_weakness';label='Recall / production weakness';confidence=.86;action='production_practice';
  }else if(weakHistory||recurring){
    state='concept_weakness';label='Concept weakness';confidence=.88;action='concept_remediation';
  }else if(strongHistory){
    state='recovering';label='Mostly secure';confidence=.78;action='light_retry';
  }

  var conceptPenalty=state==='concept_weakness'?1:state==='recall_weakness'?.55:state==='single_mistake'?.2:0;
  if(state==='speech_uncertainty'||state==='likely_slip')conceptPenalty=0;
  return{
    version:VERSION,
    state:state,
    label:label,
    confidence:Math.round(clamp(confidence,.01,.99)*100)/100,
    action:action,
    conceptCode:code,
    diagnosisKey:key,
    evidence:{recentSameDiagnosis:same.length,recentMisses:misses,recentCorrect:correct,mastery:masteryScore||null,accuracy:accuracy||null,masteryAttempts:attempts,lapses:lapses,recurring:recurring,strongHistory:strongHistory,weakHistory:weakHistory,speech:speech,speechUncertain:uncertain},
    conceptPenaltyWeight:conceptPenalty
  };
}

function installDiagnosisBridge(){
  var engine=global.WillenaAICoachDiagnosis;
  if(!engine||typeof engine.diagnose!=='function'||engine.__stage5LearnerState)return false;
  var original=engine.diagnose;
  engine.diagnose=function(input){
    var d=original.call(engine,input||{}),state=interpret({diagnosis:d,activity:input&&input.activity||{},result:input&&input.result||{},history:input&&input.history||null});
    return Object.assign({},d,{learnerState:state,learner_state:state.state,remediationAction:state.action,conceptPenaltyWeight:state.conceptPenaltyWeight});
  };
  engine.__stage5LearnerState=true;
  return true;
}

function selfTest(){
  var cases=[
    {name:'speech close',input:{activity:{skill:'speaking',response:{type:'speech'},metadata:{concept_code:'past_be'}},result:{correct:true,speech_match:'close',similarity:.8},diagnosis:{subtype:'be_agreement'}},want:'speech_uncertainty'},
    {name:'strong history slip',input:{activity:{skill:'grammar',metadata:{concept_code:'third_person'}},result:{correct:false},diagnosis:{subtype:'third_person_s',possibleSlip:true},history:{}},want:'likely_slip'},
    {name:'recurring production',input:{activity:{skill:'sentence_building',metadata:{concept_code:'third_person'}},result:{correct:false},diagnosis:{subtype:'third_person_s',recurring:true},history:{}},want:'recall_weakness'},
    {name:'recurring recognition',input:{activity:{skill:'grammar',response:{type:'choice'},metadata:{concept_code:'third_person'}},result:{correct:false},diagnosis:{subtype:'third_person_s',recurring:true},history:{}},want:'concept_weakness'}
  ];
  var results=cases.map(function(c){var got=interpret(c.input);return{name:c.name,want:c.want,got:got.state,pass:got.state===c.want};});
  return{version:VERSION,passed:results.filter(function(x){return x.pass;}).length,total:results.length,bridgeInstalled:!!(global.WillenaAICoachDiagnosis&&global.WillenaAICoachDiagnosis.__stage5LearnerState),results:results};
}

global.WillenaCoachLearnerState={version:VERSION,interpret:interpret,installDiagnosisBridge:installDiagnosisBridge,selfTest:selfTest};
installDiagnosisBridge();
})(window);
