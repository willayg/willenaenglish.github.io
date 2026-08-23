(function(global){
'use strict';
var VERSION='coach-stage5-skill-capability-v1.0';
var coach=global.WillenaAICoach;
if(!coach||typeof coach.registerCapability!=='function')return;

function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function shuffle(a){a=arr(a).slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),x=a[i];a[i]=a[j];a[j]=x;}return a;}
function ko(){var p=global.WillenaStudyV2LanguagePreference,v=p&&typeof p.get==='function'?p.get():'';if(v)return v==='ko';var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function stage5(){return global.WillenaCoachStage5Capability||null;}
function listeningEvidence(ctx){var s=stage5(),xs=s&&typeof s.evidence==='function'?s.evidence(ctx):[];return arr(xs).filter(function(x){return x&&x.domain==='listening'&&x.state==='recurring_weakness';});}
function unique(items){var seen={},out=[];arr(items).forEach(function(x){var k=text(x&&x.id||x&&x.sourceId);if(!k||seen[k])return;seen[k]=1;out.push(x);});return out;}
function diversify(items,count,currentUnit){var pools={},keys=[],out=[];arr(items).forEach(function(x){var m=x&&x.metadata||{},k=text(m.book_id||m.source_book_title||'bank');if(!pools[k]){pools[k]=[];keys.push(k);}pools[k].push(x);});keys=shuffle(keys);while(out.length<count&&keys.length){var next=[];keys.forEach(function(k){var pool=pools[k];if(!pool.length)return;var ix=Math.floor(Math.random()*pool.length),item=pool.splice(ix,1)[0];if(item){var m=item.metadata||{};if(currentUnit&&text(m.unit_id)===text(currentUnit)&&out.length<Math.max(2,count-2))pool.push(item);else out.push(item);}if(pool.length)next.push(k);});keys=next;}if(out.length<count){var used={};out.forEach(function(x){used[text(x.id||x.sourceId)]=1;});shuffle(items).forEach(function(x){if(out.length>=count)return;var k=text(x&&x.id||x&&x.sourceId);if(k&&!used[k]){used[k]=1;out.push(x);}});}return out.slice(0,count);}
async function buildListening(ctx,target){
  var bank=global.WillenaStudyQuestionBank;if(!bank||typeof bank.loadLevel!=='function')return null;
  var level=Number(ctx&&ctx.publicLevel)||Number(ctx&&ctx.bookPublicLevel)||1;
  var all=unique(await bank.loadLevel(level,{bookId:ctx&&ctx.bookId,unitId:ctx&&ctx.unitId,bookTitle:ctx&&ctx.bookTitle,unitNumber:ctx&&ctx.unitNumber}));
  var listening=all.filter(function(x){return x&&x.skill==='listening';});
  if(listening.length<4&&bank.loadUnit&&ctx&&ctx.bookId&&ctx.unitId){var unit=await bank.loadUnit(level,{bookId:ctx.bookId,unitId:ctx.unitId,bookTitle:ctx.bookTitle,unitNumber:ctx.unitNumber});listening=unique(listening.concat(arr(unit).filter(function(x){return x&&x.skill==='listening';})));}
  var picked=diversify(listening,Math.min(6,Math.max(4,listening.length)),ctx&&ctx.unitId);
  if(picked.length<3)return{type:'coach_stage5_listening',title:ko()?'듣기 집중 연습':'Listening focus',message:ko()?'반복된 듣기 실수는 확인했지만 지금 수준에서 충분한 듣기 문제를 찾지 못했어요.':'I found the repeated listening misses, but I could not find enough suitable listening items at this level yet.',items:[]};
  picked.forEach(function(x){x.metadata=Object.assign({},x.metadata||{},{ai_coach:true,ai_coach_cross_book:true,stage5_remediation:true,stage5_domain:'listening',stage5_target:target&&target.targetKey||'listening_discrimination',source_label:'AI Coach · Stage 5 listening'});});
  return{type:'coach_stage5_listening',title:ko()?'듣기 집중 연습':'Listening focus',message:ko()?'최근 듣기에서 같은 종류의 실수가 반복됐어요. 다른 문제로 짧게 확인해 볼게요.':'The same kind of listening miss has repeated recently. Let’s check it with a few different listening questions.',items:picked};
}

coach.registerCapability({
  id:'stage5_listening_weakness',
  available:function(ctx){return listeningEvidence(ctx).length>0;},
  score:function(ctx){var x=listeningEvidence(ctx)[0];return x?330+Math.min(120,Number(x.score)||0):0;},
  label:{ko:'반복된 듣기 실수 다시 연습',en:'Practice a recurring listening miss'},
  response:function(ctx){var x=listeningEvidence(ctx)[0];var n=x&&Number(x.count)||0;return ko()?('최근 듣기에서 같은 종류의 실수가 '+n+'번 반복됐어요. 발음 자체가 아니라 듣고 구별하는 부분을 다른 문제로 확인해 볼게요.'):('I found '+n+' recent misses of the same listening type. I’ll check listening discrimination with different items rather than treating it as a pronunciation problem.');},
  actions:function(ctx){var x=listeningEvidence(ctx)[0];return x?[{label:{ko:'듣기 집중 연습 시작',en:'Start listening focus'},run:function(liveCtx){return buildListening(liveCtx||ctx,x);}}]:[];}
});

global.WillenaCoachStage5SkillCapability={version:VERSION,listeningEvidence:listeningEvidence,buildListening:buildListening};
})(window);
