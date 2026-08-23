(function(global){
'use strict';

var VERSION='coach-stage5-capability-v1.1';
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
function diagnosisKey(d){return text(d&&d.subtype||d&&d.category);}
function diagnosisDomain(d,skill){var domain=lower(d&&d.domain);if(domain&&domain!=='general')return domain;skill=lower(skill);if(skill.indexOf('listen')>=0)return'listening';if(skill.indexOf('vocab')>=0||skill.indexOf('word')>=0)return'vocabulary';if(skill.indexOf('spell')>=0)return'spelling';if(skill.indexOf('read')>=0)return'reading';if(skill.indexOf('conversation')>=0)return'conversation';if(skill.indexOf('sentence')>=0||skill.indexOf('grammar')>=0)return'grammar';return domain||skill||'general';}
function isSpeechAttempt(x,d){var s=lower(x&&x.skill),st=stateOf(d);return s.indexOf('speak')>=0||st==='speech_uncertainty'||lower(d&&d.domain)==='speech';}
function isProduction(x){var s=lower(x&&x.skill),d=x&&x.diagnosis||{},a=lower(stateAction(d));return /sentence|build|write|production/.test(s)||a==='production_practice';}
function diagnosisConcept(d,a){var r=retriever();return r&&typeof r.inferConceptCode==='function'?r.inferConceptCode(d,a):text(d&&d.concept);}
function actionFor(domain,state){if(state==='recall_weakness')return'production_practice';if(domain==='grammar')return'concept_remediation';if(domain==='listening')return'listening_practice';if(domain==='vocabulary')return'vocabulary_practice';if(domain==='spelling')return'spelling_practice';if(domain==='conversation')return'conversation_practice';if(domain==='reading')return'reading_practice';return'targeted_practice';}
function stateWeight(s){return s==='concept_weakness'?5:s==='recall_weakness'?4.8:s==='recurring_weakness'?4.5:0;}

function aggregateEvidence(ctx){
  var h=history(),rows=arr(h&&h.recentAttempts).slice(0,180),groups={};
  rows.forEach(function(x){
    if(!x||x.correct||!x.diagnosis)return;
    var d=x.diagnosis;if(isSpeechAttempt(x,d))return;
    var domain=diagnosisDomain(d,x.skill),fakeActivity={skill:x.skill,metadata:{concept_code:text(d.concept),book_id:x.bookId,unit_id:x.unitId}},concept=domain==='grammar'?diagnosisConcept(d,fakeActivity):'',diag=diagnosisKey(d);
    var target=concept||diag;if(!target)return;
    var key=domain+'|'+target,g=groups[key]||(groups[key]={domain:domain,targetKey:target,conceptCode:concept||'',diagnosisKey:diag,state:'',action:'',count:0,distinctItems:0,productionMisses:0,confidence:0,lastSeen:0,diagnosis:d,bookId:text(x.bookId),unitId:text(x.unitId),skill:text(x.skill),items:{},days:{}});
    g.count++;
    var item=text(x.activityId||x.id);if(item)g.items[item]=1;
    var day=text(x.createdAt).slice(0,10);if(day)g.days[day]=1;
    if(isProduction(x))g.productionMisses++;
    g.confidence=Math.max(g.confidence,num(d.learnerState&&d.learnerState.confidence||d.confidence));
    g.lastSeen=Math.max(g.lastSeen,Date.parse(x.createdAt||'')||0);
    if(!g.bookId&&x.bookId)g.bookId=text(x.bookId);if(!g.unitId&&x.unitId)g.unitId=text(x.unitId);
  });

  Object.keys(groups).forEach(function(k){
    var g=groups[k];g.distinctItems=Object.keys(g.items).length;g.distinctDays=Object.keys(g.days).length;delete g.items;delete g.days;
    if(g.domain==='grammar'){
      if(g.productionMisses>=2&&g.productionMisses>=Math.ceil(g.count*.5)){g.state='recall_weakness';}
      else if(g.count>=2){g.state='concept_weakness';}
    }else if((g.count>=3&&g.distinctItems>=2)||g.count>=4){
      g.state='recurring_weakness';
    }
    if(g.state)g.action=actionFor(g.domain,g.state);
  });

  var grammar=arr(h&&h.grammar&&h.grammar.weak);
  grammar.forEach(function(x){
    var code=text(x&&x.key);if(!code)return;var key='grammar|'+code,attempts=num(x.attempts),mastery=num(x.mastery),accuracy=num(x.accuracy);if(attempts<2)return;
    var existing=groups[key];
    if(existing){existing.mastery=mastery;existing.accuracy=accuracy;existing.count=Math.max(existing.count,Math.round(attempts));if(!existing.state)existing.state='concept_weakness';existing.action=actionFor('grammar',existing.state);return;}
    groups[key]={domain:'grammar',targetKey:code,conceptCode:code,diagnosisKey:'mastery_weakness',state:'concept_weakness',action:'concept_remediation',count:Math.max(2,Math.round(attempts)),distinctItems:0,distinctDays:0,productionMisses:0,confidence:.78,lastSeen:Date.parse(x.lastSeen||'')||0,diagnosis:{concept:code,subtype:'mastery_weakness'},bookId:'',unitId:'',skill:'grammar',mastery:mastery,accuracy:accuracy};
  });

  return Object.keys(groups).map(function(k){var g=groups[k];if(!g.state)return null;g.score=stateWeight(g.state)*100+Math.min(8,g.count)*18+Math.min(5,g.distinctItems)*7+g.confidence*20+(g.lastSeen?Math.max(0,20-(Date.now()-g.lastSeen)/86400000):0);return g;}).filter(Boolean).sort(function(a,b){return b.score-a.score;}).slice(0,12);
}
function evidence(ctx){return aggregateEvidence(ctx);}
function grammarEvidence(ctx){return aggregateEvidence(ctx).filter(function(x){return x.domain==='grammar'&&x.conceptCode;});}
function labelFor(x){var code=text(x&&x.targetKey||x&&x.conceptCode).replace(/_/g,' ');return code||'grammar';}
function stateMessage(x){if(!x)return{ko:'문법을 조금 더 연습해 볼까요?',en:'Let’s do a little more grammar practice.'};if(x.state==='recall_weakness')return{ko:'규칙은 어느 정도 알고 있지만 직접 문장을 만들 때 조금 더 연습이 필요해 보여요.',en:'You seem to know the rule, but producing it yourself still needs a little practice.'};return{ko:'같은 문법 포인트에서 몇 번 막힌 흔적이 있어요. 짧게 다른 문제로 다시 확인해 볼게요.',en:'I found repeated trouble with the same grammar point. Let’s check it with a few different questions.'};}
function tokenActivity(item,i,concept){var answer=text(item.answer),tokens=answer.replace(/([?.!,])/g,' $1 ').split(/\s+/).filter(Boolean);if(tokens.length<3)return null;return{id:'stage5-build-'+item.id+'-'+i,sourceType:'assessment_item',sourceId:item.id,skill:'sentence_building',usage:['practice'],stimulus:{type:'text',prompt:text(item.prompt),context:ko()?'단어를 올바른 순서로 배열하세요.':'Put the words in the correct order.'},response:{type:'token_order',tokens:shuffle(tokens)},answer:tokens,level:item.levelId||null,difficulty:item.difficulty||null,metadata:Object.assign({},item.metadata||{},{ai_coach:true,ai_coach_cross_book:true,stage5_remediation:true,stage5_mode:'production',concept_code:concept,pattern_id:item.patternId||null,book_id:item.bookId||null,unit_id:item.unitId||null,source_label:'AI Coach · Stage 5 production',mastery_content_type:'pattern',mastery_content_id:item.patternId||item.id})};}
function choiceActivity(item,i,concept){var choices=arr(item.choices).map(function(x){return typeof x==='string'?x:text(x&&x.text||x&&x.option_text);}).filter(Boolean),answer=text(item.answer);if(!answer||choices.length<2)return null;if(choices.indexOf(answer)<0)choices.push(answer);return{id:'stage5-concept-'+item.id+'-'+i,sourceType:'assessment_item',sourceId:item.id,skill:'grammar',usage:['practice'],stimulus:{type:'text',prompt:text(item.prompt),context:text(item.context)||(ko()?'알맞은 답을 고르세요.':'Choose the best answer.')},response:{type:'multiple_choice',choices:shuffle(choices)},answer:answer,level:item.levelId||null,difficulty:item.difficulty||null,metadata:Object.assign({},item.metadata||{},{ai_coach:true,ai_coach_cross_book:true,stage5_remediation:true,stage5_mode:'concept',concept_code:concept,pattern_id:item.patternId||null,book_id:item.bookId||null,unit_id:item.unitId||null,source_label:'AI Coach · Stage 5 concept',mastery_content_type:'pattern',mastery_content_id:item.patternId||item.id})};}
async function buildPlan(target,ctx){
  var r=retriever();if(!r||typeof r.remediationSet!=='function'||!target||target.domain!=='grammar'||!target.conceptCode)return null;
  var level=num(ctx&&ctx.internalLevel)||((num(ctx&&ctx.publicLevel)||0)+2),set=await r.remediationSet({conceptCode:target.conceptCode,diagnosis:target.diagnosis,learnerState:{state:target.state,action:target.action},levelId:level,bookId:ctx&&ctx.bookId,unitId:ctx&&ctx.unitId,count:5,limit:24,includeChildren:true});
  var items=[],seen={};arr(set&&set.selected).concat(arr(set&&set.items)).forEach(function(x,i){if(items.length>=5||!x||seen[x.id])return;seen[x.id]=1;var a=target.state==='recall_weakness'?tokenActivity(x,i,target.conceptCode):null;if(!a)a=choiceActivity(x,i,target.conceptCode);if(a)items.push(a);});
  if(items.length<3)return null;
  return{type:'coach_stage5_concept',title:ko()?'AI 코치 맞춤 연습':'AI Coach · Targeted practice',message:target.state==='recall_weakness'?(ko()?'이번에는 직접 문장을 만들어 보면서 기억을 꺼내 볼게요.':'This time, practise pulling the language out yourself.'):(ko()?'같은 문법을 다른 문제로 짧게 확인해 볼게요.':'Let’s check the same grammar with a few different questions.'),items:items,concept:set&&set.concept||null};
}

coach.registerCapability({
  id:'stage5_concept_weakness',
  available:function(ctx){return grammarEvidence(ctx).length>0&&!!retriever();},
  score:function(ctx){var x=grammarEvidence(ctx)[0];return x?350+Math.min(120,x.score):0;},
  label:function(ctx){var x=grammarEvidence(ctx)[0];if(!x)return{ko:'AI 코치 맞춤 연습',en:'AI Coach targeted practice'};return x.state==='recall_weakness'?{ko:'문장 만들기 다시 연습',en:'Practise producing the sentence'}:{ko:'헷갈린 문법 다시 잡기',en:'Fix a recurring grammar point'};},
  response:function(ctx){return stateMessage(grammarEvidence(ctx)[0]);},
  actions:function(ctx){var xs=grammarEvidence(ctx).slice(0,3);return xs.map(function(x){return{label:{ko:labelFor(x)+' 연습하기',en:'Practise '+labelFor(x)},run:function(liveCtx){return buildPlan(x,liveCtx||ctx);}};});}
});

global.WillenaCoachStage5Capability={version:VERSION,evidence:evidence,grammarEvidence:grammarEvidence,buildPlan:buildPlan};
})(window);
