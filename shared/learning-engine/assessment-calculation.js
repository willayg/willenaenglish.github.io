(function(root,factory){
'use strict';
var api=factory();
if(typeof module==='object'&&module.exports)module.exports=api;
root.WillenaAssessmentCalculation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

var VERSION='placement-v1';
var MIN_LEVEL=1;
var MAX_LEVEL=12;
var COMPUTER_SKILLS=['vocabulary','grammar','listening','reading','sentence_building'];
var ALL_SKILLS=COMPUTER_SKILLS.concat(['speaking']);
var MIN_ITEMS_PER_SKILL=3;
var DEFAULT_MIN_COMPUTER_SKILLS=3;
var SLOPE=1.25;
var PRIOR_STRENGTH=.08;
var SCAN_STEP=.05;

function finite(value){var n=Number(value);return Number.isFinite(n)?n:null}
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function clampLevel(value){var n=finite(value);return n===null?null:clamp(n,MIN_LEVEL,MAX_LEVEL)}
function round2(value){return Math.round(Number(value)*100)/100}
function roundHalfDown(value){
 var n=clampLevel(value);
 if(n===null)return null;
 return clamp(Math.floor(n+.499999999),MIN_LEVEL,MAX_LEVEL);
}
function mean(values){return values.length?values.reduce(function(sum,n){return sum+n},0)/values.length:null}

function skillFor(value){
 var normalized=String(value||'').trim().toLowerCase();
 if(!normalized)return null;
 if(normalized.indexOf('unscramble')>=0||normalized.indexOf('sentence_build')>=0||normalized==='sentence_making')return'sentence_building';
 if(normalized.indexOf('listen')>=0)return'listening';
 if(normalized.indexOf('read')>=0)return'reading';
 if(normalized.indexOf('vocab')>=0||normalized.indexOf('word')>=0)return'vocabulary';
 if(normalized.indexOf('speak')>=0)return'speaking';
 if(normalized.indexOf('writ')>=0)return'writing';
 return({grammar:'grammar',grammar_error:'grammar',question_response:'grammar'})[normalized]||null;
}

function normalizeResponse(row,index){
 row=row||{};
 var level=clampLevel(row.question_level!=null?row.question_level:row.level);
 var skill=skillFor(row.skill)||skillFor(row.question_type||row.item_type||row.type);
 if(level===null||!skill)return null;
 var correct=row.is_correct===true||row.correct===true;
 return{
  id:row.question_id||row.assessment_item_id||row.id||String(index+1),
  skill:skill,
  level:level,
  correct:correct,
  type:row.question_type||row.item_type||row.type||null
 };
}
function normalizeResponses(rows){
 return(Array.isArray(rows)?rows:[]).map(normalizeResponse).filter(Boolean);
}

function abilityFromRows(rows){
 rows=Array.isArray(rows)?rows:[];
 if(!rows.length)return null;
 var levels=rows.map(function(row){return clampLevel(row.level)}).filter(function(x){return x!==null});
 if(!levels.length)return null;
 var priorCentre=mean(levels),best=priorCentre,bestLog=-Infinity;
 for(var ability=MIN_LEVEL;ability<=MAX_LEVEL+.0001;ability+=SCAN_STEP){
  var log=-PRIOR_STRENGTH*Math.pow(ability-priorCentre,2);
  rows.forEach(function(row){
   var level=clamp(Number(row.level),MIN_LEVEL,MAX_LEVEL);
   var p=1/(1+Math.exp((level-ability)*SLOPE));
   p=clamp(p,.025,.975);
   log+=Math.log(row.correct?p:1-p);
  });
  if(log>bestLog){bestLog=log;best=ability}
 }
 return round2(clamp(best,MIN_LEVEL,MAX_LEVEL));
}
function skillConfidence(rows){
 var count=rows.length;
 if(!count)return'none';
 var spread=new Set(rows.map(function(row){return Math.round(Number(row.level)||0)})).size;
 if(count>=8&&spread>=2)return'high';
 if(count>=3)return'medium';
 return'low';
}
function estimateSkill(skill,evidence,minimumItems){
 var rows=evidence.filter(function(row){return row.skill===skill});
 var min=Number(minimumItems)||MIN_ITEMS_PER_SKILL;
 var correct=rows.filter(function(row){return row.correct}).length;
 var estimate=rows.length?abilityFromRows(rows):null;
 return{
  skill:skill,
  assessed:rows.length>=min&&estimate!==null,
  estimate:estimate,
  level:estimate===null?null:roundHalfDown(estimate),
  items:rows.length,
  correct:correct,
  accuracy:rows.length?round2(correct/rows.length):null,
  confidence:skillConfidence(rows),
  min_level:rows.length?Math.min.apply(null,rows.map(function(row){return row.level})):null,
  max_level:rows.length?Math.max.apply(null,rows.map(function(row){return row.level})):null
 };
}

function speakingFromOptions(options){
 options=options||{};
 var attempt=options.attempt||{};
 var setup=attempt.setup&&typeof attempt.setup==='object'?attempt.setup:{};
 var state=options.speaking&&typeof options.speaking==='object'?options.speaking:{};
 var recommendation=state.recommendation&&typeof state.recommendation==='object'?state.recommendation:{};
 var teacher=finite(state.teacher_level!=null?state.teacher_level:setup.teacher_speaking_level);
 var estimate=finite(recommendation.estimate!=null?recommendation.estimate:(setup.speaking_estimate!=null?setup.speaking_estimate:null));
 var recommended=finite(recommendation.recommended_level!=null?recommendation.recommended_level:(setup.speaking_recommended_level!=null?setup.speaking_recommended_level:setup.speaking_level));
 var stateEvidence=Array.isArray(state.evidence)?state.evidence:[];
 var setupEvidence=Array.isArray(setup.speaking_evidence)?setup.speaking_evidence:[];
 var evidenceCount=Math.max(
  Number(recommendation.evidence_count)||0,
  Number(setup.speaking_evidence_count)||0,
  stateEvidence.length,
  setupEvidence.length
 );
 var confidence=String(recommendation.confidence||setup.speaking_confidence||'').toLowerCase()||'none';
 var minimumEvidence=Number(options.minimumSpeakingEvidence)||3;
 var hasTeacher=teacher!==null&&teacher>0;
 var automatic=estimate!==null&&estimate>0?estimate:(recommended!==null&&recommended>0?recommended:null);
 var automaticReady=automatic!==null&&evidenceCount>=minimumEvidence;
 var ability=hasTeacher?clamp(teacher,MIN_LEVEL,MAX_LEVEL):(automaticReady?clamp(automatic,MIN_LEVEL,MAX_LEVEL):null);
 return{
  skill:'speaking',
  assessed:ability!==null,
  estimate:ability===null?null:round2(ability),
  level:ability===null?null:roundHalfDown(ability),
  items:evidenceCount,
  correct:null,
  accuracy:null,
  confidence:hasTeacher?'teacher':confidence,
  source:hasTeacher?'teacher':(automaticReady?'speaking_assessment':null),
  teacher_level:hasTeacher?clamp(teacher,MIN_LEVEL,MAX_LEVEL):null,
  recommended_level:recommended===null?null:clamp(recommended,MIN_LEVEL,MAX_LEVEL),
  raw_estimate:estimate===null?null:round2(clamp(estimate,MIN_LEVEL,MAX_LEVEL)),
  minimum_evidence:minimumEvidence
 };
}

function calculate(options){
 options=options||{};
 var evidence=Array.isArray(options.evidence)?normalizeResponses(options.evidence):normalizeResponses(options.responses);
 var minimumItems=Number(options.minimumItemsPerSkill)||MIN_ITEMS_PER_SKILL;
 var minimumComputerSkills=Number(options.minimumComputerSkills)||DEFAULT_MIN_COMPUTER_SKILLS;
 var skills={};
 COMPUTER_SKILLS.forEach(function(skill){skills[skill]=estimateSkill(skill,evidence,minimumItems)});
 skills.speaking=speakingFromOptions(options);
 var assessedComputer=COMPUTER_SKILLS.map(function(skill){return skills[skill]}).filter(function(result){return result.assessed});
 var computerScores=assessedComputer.map(function(result){return result.estimate});
 var computerAbility=computerScores.length?round2(mean(computerScores)):null;
 var computerReady=assessedComputer.length>=minimumComputerSkills;
 var contributions=assessedComputer.map(function(result){return{skill:result.skill,estimate:result.estimate}});
 if(skills.speaking.assessed)contributions.push({skill:'speaking',estimate:skills.speaking.estimate});
 var finalAbility=computerReady&&contributions.length?round2(mean(contributions.map(function(item){return item.estimate}))):null;
 return{
  calculation_version:VERSION,
  ready:finalAbility!==null,
  computer_ready:computerReady,
  minimum_computer_skills:minimumComputerSkills,
  minimum_items_per_skill:minimumItems,
  computer_skills_assessed:assessedComputer.length,
  computer_ability:computerAbility,
  speaking_counted:skills.speaking.assessed,
  final_ability:finalAbility,
  final_level:finalAbility===null?null:roundHalfDown(finalAbility),
  skills:skills,
  contributions:contributions,
  evidence_count:evidence.length
 };
}

return{
 VERSION:VERSION,
 MIN_LEVEL:MIN_LEVEL,
 MAX_LEVEL:MAX_LEVEL,
 COMPUTER_SKILLS:COMPUTER_SKILLS.slice(),
 ALL_SKILLS:ALL_SKILLS.slice(),
 MIN_ITEMS_PER_SKILL:MIN_ITEMS_PER_SKILL,
 skillFor:skillFor,
 normalizeResponse:normalizeResponse,
 normalizeResponses:normalizeResponses,
 abilityFromRows:abilityFromRows,
 estimateSkill:estimateSkill,
 speakingFromOptions:speakingFromOptions,
 roundHalfDown:roundHalfDown,
 calculate:calculate
};
});
