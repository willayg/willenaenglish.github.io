(function(root,factory){
'use strict';
var api=factory();
if(typeof module==='object'&&module.exports)module.exports=api;
root.WillenaLevelReportCalculation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
var MAX_LEVEL=12;
var ASSESSED_SKILLS=['vocabulary','grammar','listening','reading','sentence_building'];
var ALL_SKILLS=ASSESSED_SKILLS.concat(['speaking','writing']);

function skillFor(value){
 var normalized=String(value||'').trim().toLowerCase();
 if(normalized.indexOf('unscramble')>=0||normalized.indexOf('sentence_build')>=0||normalized==='sentence_making')return'sentence_building';
 return({vocabulary:'vocabulary',grammar:'grammar',grammar_error:'grammar',question_response:'grammar',listening:'listening',reading:'reading',speaking:'speaking',writing:'writing'})[normalized]||null;
}
function clampLevel(value,fallback){
 var number=Number(value);
 if(!Number.isFinite(number)||number<=0)number=Number(fallback)||1;
 return Math.max(1,Math.min(MAX_LEVEL,number));
}
function evidenceFromResponses(responses){
 return(Array.isArray(responses)?responses:[]).map(function(row){
  return{
   id:row.question_id||row.assessment_item_id||row.id,
   level:clampLevel(row.question_level||row.level,1),
   type:row.question_type||row.item_type||row.type||row.skill,
   skill:skillFor(row.skill)||skillFor(row.question_type||row.item_type||row.type),
   correct:row.is_correct===true||row.correct===true
  };
 });
}
function probabilities(rows,maxLevel){
 if(!rows.length)return[];
 var ceiling=Math.max(1,Math.min(MAX_LEVEL,Number(maxLevel)||MAX_LEVEL)),scores=[];
 for(var level=1;level<=ceiling;level++){
  var log=0;
  rows.forEach(function(row){
   var p=1/(1+Math.exp((Number(row.level)-level)*1.12));
   log+=Math.log(Math.max(.025,Math.min(.975,row.correct?p:1-p)));
  });
  scores.push({level:level,log:log});
 }
 var max=Math.max.apply(null,scores.map(function(row){return row.log}));
 var weighted=scores.map(function(row){return{level:row.level,w:Math.exp(row.log-max)}});
 var total=weighted.reduce(function(sum,row){return sum+row.w},0)||1;
 return weighted.map(function(row){return{level:row.level,pct:row.w/total*100}}).sort(function(a,b){return b.pct-a.pct});
}
function create(options){
 options=options||{};
 var attempt=options.attempt||{};
 var evidence=Array.isArray(options.evidence)?options.evidence.slice():evidenceFromResponses(options.responses);
 function levelFromRows(rows){
  if(!rows.length)return clampLevel(attempt.recommended_level||attempt.display_level,1);
  var highest=Math.min(MAX_LEVEL,Math.max.apply(null,rows.map(function(row){return Number(row.level)||1}).concat([1])));
  var result=probabilities(rows,highest)[0];
  return result?result.level:1;
 }
 function evidenceOverall(){
  var scores=ASSESSED_SKILLS.map(function(skill){
   var rows=evidence.filter(function(row){return(row.skill||skillFor(row.type))===skill});
   return rows.length>=3?levelFromRows(rows):null;
  }).filter(function(value){return Number.isFinite(value)}).sort(function(a,b){return a-b});
  if(scores.length<3)return 0;
  if(scores.length>=4)scores=scores.slice(0,-1);
  return clampLevel(Math.floor(scores.reduce(function(sum,x){return sum+x},0)/scores.length),1);
 }
 function overall(){
  var fromEvidence=evidenceOverall();
  if(fromEvidence)return fromEvidence;
  var stored=Number(attempt.recommended_level||attempt.display_level);
  return Number.isFinite(stored)&&stored>0?clampLevel(stored,1):levelFromRows(evidence);
 }
 function estimate(skill){
  var rows=evidence.filter(function(row){return(row.skill||skillFor(row.type))===skill});
  if(rows.length<3)return{assessed:false,rows:rows,plus:false,confidence:0};
  var others=evidence.filter(function(row){return(row.skill||skillFor(row.type))!==skill});
  var anchor=others.length>=4?levelFromRows(others):overall();
  var highest=Math.min(MAX_LEVEL,Math.max.apply(null,rows.map(function(row){return row.level})));
  var prior=[{level:anchor,correct:true},{level:Math.min(MAX_LEVEL,anchor+1),correct:false}];
  var fit=probabilities(rows.concat(prior),Math.max(highest,anchor+1))[0]||{level:anchor,pct:0};
  var accuracy=rows.filter(function(row){return row.correct}).length/rows.length;
  var strongUpper=rows.filter(function(row){return row.correct&&Number(row.level)>=anchor+1}).length;
  var allowTwoLevelJump=rows.length>=8&&accuracy>=.70&&strongUpper>=3;
  var cap=Math.min(MAX_LEVEL,anchor+(allowTwoLevelJump?2:1));
  var level=Math.min(fit.level,highest,cap);
  if(accuracy<.5)level=Math.min(level,anchor);
  if(accuracy<.34)level=Math.min(level,Math.max(1,anchor-1));
  level=Math.max(1,level);
  var top=rows.filter(function(row){return row.level===highest});
  var plus=rows.length>=5&&accuracy>=.8&&top.length>=3&&top.every(function(row){return row.correct})&&level===highest;
  var confidence=Math.round(Math.min(92,42+rows.length*7+fit.pct*.15));
  return{assessed:true,rows:rows,level:level,plus:plus,confidence:confidence,accuracy:accuracy,anchor:anchor};
 }
 return{attempt:attempt,evidence:evidence,MAX_LEVEL:MAX_LEVEL,assessed:ASSESSED_SKILLS.slice(),all:ALL_SKILLS.slice(),skillFor:skillFor,overall:overall,estimate:estimate,levelFromRows:levelFromRows};
}
return{MAX_LEVEL:MAX_LEVEL,ASSESSED_SKILLS:ASSESSED_SKILLS,ALL_SKILLS:ALL_SKILLS,skillFor:skillFor,evidenceFromResponses:evidenceFromResponses,create:create};
});