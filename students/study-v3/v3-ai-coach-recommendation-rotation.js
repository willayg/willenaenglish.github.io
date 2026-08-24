(function(global){
'use strict';

var VERSION='coach-recommendation-rotation-v1.0';
var COMPLETION_KEY='willena-ai-coach-completions:v1:';
var installed=false;

function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function num(v){var n=Number(v);return Number.isFinite(n)?n:0;}
function uid(){try{return text(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function ko(){var p=global.WillenaStudyV2LanguagePreference,v=p&&typeof p.get==='function'?p.get():'';if(v)return v==='ko';var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function pretty(v){return text(v).replace(/^concept:/,'').replace(/_/g,' ');}
function completionStore(){try{return JSON.parse(localStorage.getItem(COMPLETION_KEY+uid())||'{}')||{};}catch(_){return{};}}
function targetKey(code){return'concept:'+text(code);}
function localCompletion(code){var row=completionStore()[targetKey(code)];return row&&typeof row==='object'?row:null;}
function targetHistory(){var h=global.WillenaCoachStage5TargetHistory;var s=h&&typeof h.getSnapshot==='function'?h.getSnapshot():null;return arr(s&&s.attempts);}
function matchingTargetAttempt(x,code){var wanted=targetKey(code);if(text(x&&x.targetKey)===wanted)return true;var m=x&&x.metadata||{};if(text(m.stage5_target)===wanted)return true;return false;}
function sourceIdFromActivityId(v){var s=text(v),m=s.match(/^stage5-(?:concept|build)-(.+?)-\d+(?:-retry.*)?$/);return m&&m[1]?m[1]:'';}
function recentSourceIds(code){
  var out=[],seen={},local=localCompletion(code);
  arr(local&&local.itemIds).forEach(function(id){id=text(id);if(id&&!seen[id]){seen[id]=1;out.push(id);}});
  targetHistory().filter(function(x){return matchingTargetAttempt(x,code);}).forEach(function(x){var id=text(x&&x.sourceId)||sourceIdFromActivityId(x&&x.activityId);if(id&&!seen[id]){seen[id]=1;out.push(id);}});
  return out.slice(0,30);
}
function historyShowsRecovery(code){
  var rows=targetHistory().filter(function(x){return matchingTargetAttempt(x,code);}).slice(0,8);
  if(rows.length<4)return false;
  var latest=Date.parse(rows[0]&&rows[0].createdAt||'')||0;if(!latest||Date.now()-latest>24*60*60*1000)return false;
  var streak=0;for(var i=0;i<rows.length;i++){if(rows[i]&&rows[i].correct)streak++;else break;}
  if(streak>=4)return true;
  var firstFive=rows.slice(0,5);return firstFive.length===5&&firstFive.filter(function(x){return x&&x.correct;}).length>=4;
}
function cooldownActive(code){
  var row=localCompletion(code);if(row&&num(row.until)>Date.now())return true;
  return historyShowsRecovery(code);
}
function decoratePlan(plan,target){
  if(!plan||!target||!target.conceptCode)return plan;
  var code=text(target.conceptCode),key=targetKey(code),label=pretty(code),baseDiagnosis=target.diagnosis&&typeof target.diagnosis==='object'?target.diagnosis:{};
  arr(plan.items).forEach(function(item){
    if(!item)return;var m=item.metadata&&typeof item.metadata==='object'?item.metadata:{};
    m.stage5_target=key;
    m.stage5_target_type='grammar_concept';
    m.stage5_target_label=label;
    m.concept_code=code;
    if(!m.pattern_id&&item.patternId)m.pattern_id=item.patternId;
    if(!m.mastery_content_type)m.mastery_content_type='pattern';
    if(!m.mastery_content_id)m.mastery_content_id=text(m.pattern_id||item.sourceId||item.id);
    m.diagnosis=Object.assign({},baseDiagnosis,{domain:'grammar',concept:code,subtype:text(baseDiagnosis.subtype||target.diagnosisKey||'stage5_target')});
    item.metadata=m;
  });
  return plan;
}
function patchRetriever(retriever){
  if(!retriever||retriever.__willenaRotationPatched||typeof retriever.remediationSet!=='function')return;
  var original=retriever.remediationSet.bind(retriever);
  retriever.remediationSet=async function(input){
    input=input||{};var result=await original(input);var pool=arr(result&&result.items).slice();if(!pool.length)return result;
    var wanted=Math.max(3,Math.min(6,num(input.count)||4)),recent=recentSourceIds(input.conceptCode),recentRank={};
    recent.forEach(function(id,i){if(recentRank[id]==null)recentRank[id]=Math.max(22,125-i*6);});
    var selected=[],used={},types={},books={};
    for(var slot=0;slot<wanted&&selected.length<pool.length;slot++){
      var best=null,bestScore=-Infinity;
      pool.forEach(function(x,index){if(!x||used[x.id])return;var type=text(x.itemType).toLowerCase()||'other',book=text(x.bookId||x.sourceKey||'willena'),penalty=recentRank[text(x.id)]||0;var score=num(x.score)-penalty+(types[type]?0:8)+(books[book]?0:5)+Math.random()*2;if(score>bestScore){bestScore=score;best={item:x,index:index,type:type,book:book,score:score};}});
      if(!best)break;used[best.item.id]=1;types[best.type]=1;books[best.book]=1;selected.push(Object.assign({},best.item,{selectionScore:Math.round(best.score*10)/10}));
    }
    return Object.assign({},result,{selected:selected});
  };
  retriever.__willenaRotationPatched=true;
}
function activeEvidence(cap,ctx){return arr(cap&&typeof cap.grammarEvidence==='function'?cap.grammarEvidence(ctx):[]).filter(function(x){return x&&x.conceptCode&&!cooldownActive(x.conceptCode);});}
function stateMessage(x){
  if(!x)return ko()?'문법을 조금 더 연습해 볼까요?':'Let’s do a little more grammar practice.';
  if(x.state==='recall_weakness')return ko()?'규칙은 어느 정도 알고 있지만 직접 문장을 만들 때 조금 더 연습이 필요해 보여요.':'You seem to know the rule, but producing it yourself still needs a little practice.';
  return ko()?'같은 문법 포인트에서 몇 번 막힌 흔적이 있어요. 이번에는 다른 문제로 짧게 확인해 볼게요.':'I found repeated trouble with the same grammar point. This time I’ll check it with different questions.';
}
function replaceCapability(coach,cap){
  coach.registerCapability({
    id:'stage5_concept_weakness',
    available:function(ctx){return activeEvidence(cap,ctx).length>0;},
    score:function(ctx){var x=activeEvidence(cap,ctx)[0];return x?350+Math.min(120,num(x.score)):0;},
    label:function(ctx){var x=activeEvidence(cap,ctx)[0];if(!x)return{ko:'AI 코치 맞춤 연습',en:'AI Coach targeted practice'};return x.state==='recall_weakness'?{ko:'문장 만들기 다시 연습',en:'Practise producing the sentence'}:{ko:'헷갈린 문법 다시 잡기',en:'Fix a recurring grammar point'};},
    response:function(ctx){return stateMessage(activeEvidence(cap,ctx)[0]);},
    actions:function(ctx){return activeEvidence(cap,ctx).slice(0,3).map(function(x){return{label:{ko:pretty(x.conceptCode)+' 연습하기',en:'Practise '+pretty(x.conceptCode)},run:function(liveCtx){return Promise.resolve(cap.buildPlan(x,liveCtx||ctx)).then(function(plan){return decoratePlan(plan,x);});}};});}
  });
}
function install(){
  if(installed)return true;
  var coach=global.WillenaAICoach,cap=global.WillenaCoachStage5Capability,retriever=global.WillenaCoachConceptRetriever;
  if(!coach||typeof coach.registerCapability!=='function'||!cap||typeof cap.buildPlan!=='function'||!retriever)return false;
  patchRetriever(retriever);replaceCapability(coach,cap);installed=true;
  return true;
}

global.addEventListener('willena:coach-bootstrap-ready',install);
if(!install()){
  var tries=0,iv=setInterval(function(){tries++;if(install()||tries>120)clearInterval(iv);},100);
}
global.WillenaCoachRecommendationRotation={version:VERSION,install:install,cooldownActive:cooldownActive,recentSourceIds:recentSourceIds};
})(window);
