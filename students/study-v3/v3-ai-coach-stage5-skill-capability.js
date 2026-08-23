(function(global){
'use strict';
var VERSION='coach-stage5-skill-capability-v1.2';
var coach=global.WillenaAICoach;
if(!coach||typeof coach.registerCapability!=='function')return;

function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function shuffle(a){a=arr(a).slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),x=a[i];a[i]=a[j];a[j]=x;}return a;}
function ko(){var p=global.WillenaStudyV2LanguagePreference,v=p&&typeof p.get==='function'?p.get():'';if(v)return v==='ko';var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function stage5(){return global.WillenaCoachStage5Capability||null;}
function evidenceFor(ctx,domain){var s=stage5(),xs=s&&typeof s.evidence==='function'?s.evidence(ctx):[];return arr(xs).filter(function(x){return x&&x.domain===domain&&(x.state==='recurring_weakness'||x.state==='recovering');});}
function unique(items){var seen={},out=[];arr(items).forEach(function(x){var k=text(x&&x.id||x&&x.sourceId);if(!k||seen[k])return;seen[k]=1;out.push(x);});return out;}
function diversify(items,count,currentUnit){var pools={},keys=[],out=[];arr(items).forEach(function(x){var m=x&&x.metadata||{},k=text(m.book_id||m.source_book_title||'bank');if(!pools[k]){pools[k]=[];keys.push(k);}pools[k].push(x);});keys=shuffle(keys);while(out.length<count&&keys.length){var next=[];keys.forEach(function(k){var pool=pools[k];if(!pool.length)return;var ix=Math.floor(Math.random()*pool.length),item=pool.splice(ix,1)[0];if(item){var m=item.metadata||{};if(currentUnit&&text(m.unit_id)===text(currentUnit)&&out.length<Math.max(2,count-2))pool.push(item);else out.push(item);}if(pool.length)next.push(k);});keys=next;}if(out.length<count){var used={};out.forEach(function(x){used[text(x.id||x.sourceId)]=1;});shuffle(items).forEach(function(x){if(out.length>=count)return;var k=text(x&&x.id||x&&x.sourceId);if(k&&!used[k]){used[k]=1;out.push(x);}});}return out.slice(0,count);}
function config(domain){
  var map={
    listening:{skill:'listening',type:'coach_stage5_listening',titleKo:'듣기 집중 연습',titleEn:'Listening focus',labelKo:'반복된 듣기 실수 다시 연습',labelEn:'Practice a recurring listening miss',recoverKo:'듣기 실력 회복 확인',recoverEn:'Confirm listening recovery',startKo:'듣기 집중 연습 시작',startEn:'Start listening focus',weakKo:'최근 듣기에서 같은 종류의 실수가 반복됐어요. 다른 문제로 짧게 확인해 볼게요.',weakEn:'The same kind of listening miss has repeated recently. Let’s check it with a few different listening questions.'},
    conversation:{skill:'conversation',type:'coach_stage5_conversation',titleKo:'대화 응답 집중 연습',titleEn:'Conversation response focus',labelKo:'대화 응답 다시 연습',labelEn:'Practice conversation responses',recoverKo:'대화 응답 회복 확인',recoverEn:'Confirm conversation recovery',startKo:'대화 연습 시작',startEn:'Start conversation practice',weakKo:'최근 대화에서 알맞은 응답을 고르는 실수가 반복됐어요. 다른 상황으로 다시 확인해 볼게요.',weakEn:'Choosing the right response has been difficult recently. Let’s check it with different conversation situations.'},
    vocabulary:{skill:'vocabulary',type:'coach_stage5_vocabulary',titleKo:'단어 집중 연습',titleEn:'Vocabulary focus',labelKo:'헷갈린 단어 다시 연습',labelEn:'Practice tricky vocabulary',recoverKo:'단어 회복 확인',recoverEn:'Confirm vocabulary recovery',startKo:'단어 집중 연습 시작',startEn:'Start vocabulary focus',weakKo:'최근 단어 문제에서 같은 종류의 실수가 반복됐어요. 다른 문제로 짧게 확인해 볼게요.',weakEn:'The same kind of vocabulary miss has repeated recently. Let’s check it with a few different items.'},
    spelling:{skill:'spelling',type:'coach_stage5_spelling',titleKo:'철자 집중 연습',titleEn:'Spelling focus',labelKo:'헷갈린 철자 다시 연습',labelEn:'Practice tricky spelling',recoverKo:'철자 회복 확인',recoverEn:'Confirm spelling recovery',startKo:'철자 집중 연습 시작',startEn:'Start spelling focus',weakKo:'최근 철자에서 반복되는 실수가 보여요. 짧게 다시 확인해 볼게요.',weakEn:'I found a repeated spelling difficulty. Let’s check it again with a short set.'},
    reading:{skill:'reading',type:'coach_stage5_reading',titleKo:'읽기 집중 연습',titleEn:'Reading focus',labelKo:'읽기 이해 다시 연습',labelEn:'Practice reading comprehension',recoverKo:'읽기 회복 확인',recoverEn:'Confirm reading recovery',startKo:'읽기 집중 연습 시작',startEn:'Start reading focus',weakKo:'최근 읽기 문제에서 같은 종류의 실수가 반복됐어요. 다른 글과 문제로 확인해 볼게요.',weakEn:'The same kind of reading miss has repeated recently. Let’s check it with different reading items.'}
  };return map[domain]||null;
}
async function loadSkillItems(ctx,domain){
  var bank=global.WillenaStudyQuestionBank,c=config(domain);if(!c||!bank||typeof bank.loadLevel!=='function')return[];
  var level=Number(ctx&&ctx.publicLevel)||Number(ctx&&ctx.bookPublicLevel)||1;
  var bankCtx={bookId:ctx&&ctx.bookId,unitId:ctx&&ctx.unitId,bookTitle:ctx&&ctx.bookTitle,unitNumber:ctx&&ctx.unitNumber};
  var all=unique(await bank.loadLevel(level,bankCtx)),items=all.filter(function(x){return x&&x.skill===c.skill;});
  if(items.length<4&&bank.loadUnit&&ctx&&ctx.bookId&&ctx.unitId){var unit=await bank.loadUnit(level,bankCtx);items=unique(items.concat(arr(unit).filter(function(x){return x&&x.skill===c.skill;})));}
  return items;
}
async function buildSkill(ctx,target){
  var domain=target&&target.domain,c=config(domain);if(!c)return null;
  var items=await loadSkillItems(ctx,domain),count=target&&target.state==='recovering'?4:6,picked=diversify(items,Math.min(count,items.length),ctx&&ctx.unitId);
  if(picked.length<3)return{type:c.type,title:ko()?c.titleKo:c.titleEn,message:ko()?'반복된 실수는 확인했지만 지금 수준에서 충분한 연습 문제를 찾지 못했어요.':'I found the repeated difficulty, but I could not find enough suitable practice items at this level yet.',items:[]};
  picked.forEach(function(x){x.metadata=Object.assign({},x.metadata||{},{ai_coach:true,ai_coach_cross_book:true,stage5_remediation:true,stage5_domain:domain,stage5_target:target&&target.targetKey||domain,source_label:'AI Coach · Stage 5 '+domain});});
  return{type:c.type,title:ko()?c.titleKo:c.titleEn,message:target&&target.state==='recovering'?(ko()?'좋아지고 있어요. 몇 문제만 더 확인해 볼게요.':'You are improving. Let’s confirm it with just a few more questions.'):(ko()?c.weakKo:c.weakEn),items:picked};
}
function registerDomain(domain,baseScore){
  var c=config(domain);if(!c)return;
  coach.registerCapability({
    id:'stage5_'+domain+'_weakness',
    available:function(ctx){return evidenceFor(ctx,domain).length>0;},
    score:function(ctx){var x=evidenceFor(ctx,domain)[0];if(!x)return 0;return x.state==='recovering'?185+Math.min(70,Number(x.score)||0):baseScore+Math.min(120,Number(x.score)||0);},
    label:function(ctx){var x=evidenceFor(ctx,domain)[0];return x&&x.state==='recovering'?{ko:c.recoverKo,en:c.recoverEn}:{ko:c.labelKo,en:c.labelEn};},
    response:function(ctx){var x=evidenceFor(ctx,domain)[0],n=x&&Number(x.count)||0;if(x&&x.state==='recovering')return ko()?'최근 답이 좋아지고 있어요. 완전히 안정됐는지 몇 문제만 더 확인할 수 있어요.':'Your recent answers are improving. We can check a few more before considering this fully secure.';return ko()?('최근 '+n+'번의 반복 실수가 보여요. 같은 기술을 다른 문제로 짧게 확인해 볼게요.'):('I found '+n+' repeated misses in this skill. Let’s check the same skill with a few different items.');},
    actions:function(ctx){var x=evidenceFor(ctx,domain)[0];return x?[{label:x.state==='recovering'?{ko:'몇 문제 더 확인',en:'Check a few more'}:{ko:c.startKo,en:c.startEn},run:function(liveCtx){return buildSkill(liveCtx||ctx,x);}}]:[];}
  });
}

registerDomain('listening',330);
registerDomain('conversation',320);
registerDomain('vocabulary',310);
registerDomain('spelling',315);
registerDomain('reading',305);

global.WillenaCoachStage5SkillCapability={version:VERSION,evidenceFor:evidenceFor,buildSkill:buildSkill,loadSkillItems:loadSkillItems};
})(window);
