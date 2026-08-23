(function(global){
'use strict';

var VERSION='coach-stage5-capability-v1.0';
var coach=global.WillenaAICoach;
if(!coach||typeof coach.registerCapability!=='function')return;

function text(v){return String(v==null?'':v).trim();}
function lower(v){return text(v).toLowerCase();}
function arr(v){return Array.isArray(v)?v:[];}
function num(v){var n=Number(v);return Number.isFinite(n)?n:0;}
function shuffle(a){a=arr(a).slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),x=a[i];a[i]=a[j];a[j]=x;}return a;}
function ko(){var p=global.WillenaStudyV2LanguagePreference,v=p&&typeof p.get==='function'?p.get():'';if(v)return v==='ko';var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function history(){var h=global.WillenaCoachHistory;return h&&typeof h.getSnapshot==='function'?h.getSnapshot():null;}
function retriever(){return global.WillenaCoachConceptRetriever||null;}
function stateOf(d){return d&&d.learnerState&&d.learnerState.state||d&&d.learner_state||'';}
function stateAction(d){return d&&d.learnerState&&d.learnerState.action||d&&d.remediationAction||'';}
function validState(s){return s==='concept_weakness'||s==='recall_weakness';}
function stateWeight(s){return s==='concept_weakness'?5:s==='recall_weakness'?4:0;}
function diagnosisConcept(d,a){var r=retriever();return r&&typeof r.inferConceptCode==='function'?r.inferConceptCode(d,a):text(d&&d.concept);}

function evidence(ctx){
  var h=history(),rows=arr(h&&h.recentAttempts).slice(0,160),groups={};
  rows.forEach(function(x){
    if(!x||x.correct||!x.diagnosis)return;
    var d=x.diagnosis,s=stateOf(d);if(!validState(s))return;
    var fakeActivity={skill:x.skill,metadata:{concept_code:text(d.concept),book_id:x.bookId,unit_id:x.unitId}},code=diagnosisConcept(d,fakeActivity);if(!code)return;
    var g=groups[code]||(groups[code]={conceptCode:code,state:s,action:stateAction(d),count:0,confidence:0,lastSeen:0,diagnosis:d,bookId:text(x.bookId),unitId:text(x.unitId),skill:text(x.skill)});
    g.count++;g.confidence=Math.max(g.confidence,num(d.learnerState&&d.learnerState.confidence||d.confidence));g.lastSeen=Math.max(g.lastSeen,Date.parse(x.createdAt||'')||0);if(stateWeight(s)>stateWeight(g.state)){g.state=s;g.action=stateAction(d);g.diagnosis=d;}
  });
  var grammar=arr(h&&h.grammar&&h.grammar.weak);
  grammar.forEach(function(x){var code=text(x&&x.key);if(!code||groups[code])return;var attempts=num(x.attempts),mastery=num(x.mastery),accuracy=num(x.accuracy);if(attempts<2)return;groups[code]={conceptCode:code,state:'concept_weakness',action:'concept_remediation',count:Math.max(2,Math.round(attempts)),confidence:.78,lastSeen:Date.parse(x.lastSeen||'')||0,diagnosis:{concept:code,subtype:'mastery_weakness'},bookId:'',unitId:'',skill:'grammar',mastery:mastery,accuracy:accuracy};});
  return Object.keys(groups).map(function(k){var g=groups[k];g.score=stateWeight(g.state)*100+g.count*18+g.confidence*20+(g.lastSeen?Math.max(0,20-(Date.now()-g.lastSeen)/86400000):0);return g;}).sort(function(a,b){return b.score-a.score;}).slice(0,8);
}
function labelFor(x){var code=text(x&&x.conceptCode).replace(/_/g,' ');return code||'grammar';}
function stateMessage(x){if(!x)return{ko:'문법을 조금 더 연습해 볼까요?',en:'Let’s do a little more grammar practice.'};var c=labelFor(x);if(x.state==='recall_weakness')return{ko:'규칙은 어느 정도 알고 있지만 직접 문장을 만들 때 조금 더 연습이 필요해 보여요.',en:'You seem to know the rule, but producing it yourself still needs a little practice.'};return{ko:'같은 문법 포인트에서 몇 번 막힌 흔적이 있어요. 짧게 다른 문제로 다시 확인해 볼게요.',en:'I found repeated trouble with the same grammar point. Let’s check it with a few different questions.'};}
function tokenActivity(item,i,concept){var answer=text(item.answer),tokens=answer.replace(/([?.!,])/g,' $1 ').split(/\s+/).filter(Boolean);if(tokens.length<3)return null;return{id:'stage5-build-'+item.id+'-'+i,sourceType:'assessment_item',sourceId:item.id,skill:'sentence_building',usage:['practice'],stimulus:{type:'text',prompt:text(item.prompt),context:ko()?'단어를 올바른 순서로 배열하세요.':'Put the words in the correct order.'},response:{type:'token_order',tokens:shuffle(tokens)},answer:tokens,level:item.levelId||null,difficulty:item.difficulty||null,metadata:Object.assign({},item.metadata||{},{ai_coach:true,ai_coach_cross_book:true,stage5_remediation:true,stage5_mode:'production',concept_code:concept,pattern_id:item.patternId||null,book_id:item.bookId||null,unit_id:item.unitId||null,source_label:'AI Coach · Stage 5 production',mastery_content_type:'pattern',mastery_content_id:item.patternId||item.id})};}
function choiceActivity(item,i,concept){var choices=arr(item.choices).map(function(x){return typeof x==='string'?x:text(x&&x.text||x&&x.option_text);}).filter(Boolean),answer=text(item.answer);if(!answer||choices.length<2)return null;if(choices.indexOf(answer)<0)choices.push(answer);return{id:'stage5-concept-'+item.id+'-'+i,sourceType:'assessment_item',sourceId:item.id,skill:'grammar',usage:['practice'],stimulus:{type:'text',prompt:text(item.prompt),context:text(item.context)||(ko()?'알맞은 답을 고르세요.':'Choose the best answer.')},response:{type:'multiple_choice',choices:shuffle(choices)},answer:answer,level:item.levelId||null,difficulty:item.difficulty||null,metadata:Object.assign({},item.metadata||{},{ai_coach:true,ai_coach_cross_book:true,stage5_remediation:true,stage5_mode:'concept',concept_code:concept,pattern_id:item.patternId||null,book_id:item.bookId||null,unit_id:item.unitId||null,source_label:'AI Coach · Stage 5 concept',mastery_content_type:'pattern',mastery_content_id:item.patternId||item.id})};}
async function buildPlan(target,ctx){
  var r=retriever();if(!r||typeof r.remediationSet!=='function')return null;
  var level=num(ctx&&ctx.internalLevel)||((num(ctx&&ctx.publicLevel)||0)+2),set=await r.remediationSet({conceptCode:target.conceptCode,diagnosis:target.diagnosis,learnerState:{state:target.state,action:target.action},levelId:level,bookId:ctx&&ctx.bookId,unitId:ctx&&ctx.unitId,count:5,limit:24,includeChildren:true});
  var items=[],seen={};arr(set&&set.selected).concat(arr(set&&set.items)).forEach(function(x,i){if(items.length>=5||!x||seen[x.id])return;seen[x.id]=1;var a=target.state==='recall_weakness'?tokenActivity(x,i,target.conceptCode):null;if(!a)a=choiceActivity(x,i,target.conceptCode);if(a)items.push(a);});
  if(items.length<3)return null;
  return{type:'coach_stage5_concept',title:ko()?'AI 코치 맞춤 연습':'AI Coach · Targeted practice',message:target.state==='recall_weakness'?(ko()?'이번에는 직접 문장을 만들어 보면서 기억을 꺼내 볼게요.':'This time, practise pulling the language out yourself.'):(ko()?'같은 문법을 다른 문제로 짧게 확인해 볼게요.':'Let’s check the same grammar with a few different questions.'),items:items,concept:set&&set.concept||null};
}

coach.registerCapability({
  id:'stage5_concept_weakness',
  available:function(ctx){return evidence(ctx).length>0&&!!retriever();},
  score:function(ctx){var x=evidence(ctx)[0];return x?350+Math.min(120,x.score):0;},
  label:function(ctx){var x=evidence(ctx)[0];if(!x)return{ko:'AI 코치 맞춤 연습',en:'AI Coach targeted practice'};return x.state==='recall_weakness'?{ko:'문장 만들기 다시 연습',en:'Practise producing the sentence'}:{ko:'헷갈린 문법 다시 잡기',en:'Fix a recurring grammar point'};},
  response:function(ctx){return stateMessage(evidence(ctx)[0]);},
  actions:function(ctx){var xs=evidence(ctx).slice(0,3);return xs.map(function(x){return{label:{ko:labelFor(x)+' 연습하기',en:'Practise '+labelFor(x)},run:function(liveCtx){return buildPlan(x,liveCtx||ctx);}};});}
});

global.WillenaCoachStage5Capability={version:VERSION,evidence:evidence,buildPlan:buildPlan};
})(window);
