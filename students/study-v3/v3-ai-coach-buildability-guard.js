(function(global){
'use strict';
var VERSION='coach-buildability-guard-v1.0';
var coach=global.WillenaAICoach;
var installed=false;
var PROBE_IDS={
  weakness:1,
  stage5_exact_missed_review:1,
  stage5_vocabulary_weakness:1,
  stage5_listening_weakness:1,
  stage5_conversation_weakness:1,
  stage5_spelling_weakness:1,
  stage5_reading_weakness:1
};
function arr(v){return Array.isArray(v)?v:[];}
function usable(result){return !!(result&&(arr(result.items).length||arr(result.actions).length||result.launched===true));}
async function actionsFor(cap,ctx){try{return typeof cap.actions==='function'?arr(await cap.actions(ctx)):arr(cap.actions);}catch(e){console.warn('[AI Coach buildability] actions failed',cap&&cap.id,e);return[];}}
async function prepare(action,ctx){if(!action)return null;try{
  if(typeof action.run==='function')return await action.run(ctx);
  if(action.provider&&coach&&typeof coach.provider==='function')return await coach.provider(action.provider,action.args||{});
}catch(e){console.warn('[AI Coach buildability] prepare failed',e);}return null;}
function wrapCapability(cap,prepared,preparedAt){
  var originalActions=cap.actions;
  var wrapped=Object.assign({},cap);
  wrapped.actions=async function(ctx){
    var list=typeof originalActions==='function'?arr(await originalActions(ctx)):arr(originalActions);
    if(!list.length)return[];
    var first=Object.assign({},list[0]);
    var originalRun=first.run,provider=first.provider,args=first.args;
    if(Date.now()-preparedAt<30000){
      first.run=function(){return prepared;};
      delete first.provider;
      delete first.args;
    }else if(typeof originalRun==='function'){
      first.run=originalRun;
    }else if(provider){
      first.provider=provider;
      first.args=args;
    }
    list[0]=first;
    return list;
  };
  return wrapped;
}
async function vet(cap,ctx){
  if(!cap||!PROBE_IDS[cap.id])return cap;
  var actions=await actionsFor(cap,ctx);
  if(!actions.length)return null;
  var prepared=await prepare(actions[0],ctx);
  if(!usable(prepared)){
    console.info('[AI Coach buildability] hiding empty recommendation',cap.id,prepared&&{type:prepared.type,itemCount:arr(prepared.items).length,dueCount:prepared.dueCount,matchedCount:prepared.matchedCount});
    return null;
  }
  return wrapCapability(cap,prepared,Date.now());
}
function install(){
  if(installed)return true;
  coach=global.WillenaAICoach;
  if(!coach||typeof coach.getSuggestions!=='function')return false;
  var original=coach.getSuggestions.bind(coach);
  coach.getSuggestions=async function(){
    var caps=arr(await original()),ctx=coach.context&&coach.context();
    var checked=await Promise.all(caps.map(function(cap){return vet(cap,ctx);}));
    return checked.filter(Boolean);
  };
  installed=true;
  return true;
}
if(!install()){
  var tries=0,iv=setInterval(function(){tries++;if(install()||tries>120)clearInterval(iv);},100);
}
global.addEventListener('willena:coach-bootstrap-ready',function(){install();});
global.WillenaCoachBuildabilityGuard={version:VERSION,install:install};
})(window);
