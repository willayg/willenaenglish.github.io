(function(global){
'use strict';
function keyFor(activity){return String(activity.sourceType||'activity')+'|'+String(activity.sourceId||'')+'|'+String(activity.skill||'');}
function stateKey(item){return String(item.content_type||'activity')+'|'+String(item.content_id||'')+'|'+String(item.skill||'');}
function nowMs(){return Date.now();}
function parseDate(v){var n=Date.parse(v||'');return Number.isFinite(n)?n:0;}
function buildStateMap(state){var map={};((state&&state.items)||[]).forEach(function(item){map[stateKey(item)]=item;});return map;}
function scoreActivity(activity,stateMap,options){
 options=options||{};var s=stateMap[keyFor(activity)]||null,meta=activity.metadata||{},score=0,now=nowMs();
 var mastery=s&&Number(s.mastery_score),due=!s||!s.next_review_at||parseDate(s.next_review_at)<=now;
 if(!s){score+=36;}else{
  if(due)score+=100;
  if(Number.isFinite(mastery))score+=(100-mastery)*.55;
  score+=Math.min(30,Number(s.lapses||0)*8);
  if(s.review_state==='learning')score+=22;
  if(s.review_state==='mastered')score+=8;
  if(!due&&Number.isFinite(mastery)&&mastery>=80)score-=95;
 }
 if(options.currentBookId&&String(meta.book_id)===String(options.currentBookId))score+=20;
 if(options.currentUnitId&&String(meta.unit_id)===String(options.currentUnitId))score+=28;
 if(meta.same_level_extension)score+=6;
 if(options.focusSkill&&activity.skill===options.focusSkill)score+=80;
 if(options.focusUnitId&&String(meta.unit_id)===String(options.focusUnitId))score+=90;
 score+=Math.random()*7;
 return{score:score,state:s,due:due};
}
function chooseSession(activities,state,options){
 options=options||{};var target=Number(options.target||12),stateMap=buildStateMap(state),seenContent={},skillCounts={},chosen=[];
 var rows=(activities||[]).filter(function(a){
  if(!a||!a.id)return false;
  if(options.focusSkill&&a.skill!==options.focusSkill)return false;
  if(options.focusUnitId&&String(a.metadata&&a.metadata.unit_id)!==String(options.focusUnitId))return false;
  return true;
 }).map(function(a){var ranked=scoreActivity(a,stateMap,options);return{activity:a,score:ranked.score,state:ranked.state,due:ranked.due};}).sort(function(a,b){return b.score-a.score;});

 while(rows.length&&chosen.length<target){
  var pickIndex=-1;
  for(var i=0;i<rows.length;i++){
   var row=rows[i],a=row.activity,content=String(a.sourceType)+'|'+String(a.sourceId||a.id),skill=a.skill||'practice';
   var duplicate=seenContent[content]||0,sameSkill=skillCounts[skill]||0;
   if(duplicate>=1)continue;
   if(chosen.length>=3&&sameSkill>=Math.ceil((chosen.length+1)*.5))continue;
   pickIndex=i;break;
  }
  if(pickIndex<0)pickIndex=0;
  var picked=rows.splice(pickIndex,1)[0],pa=picked.activity,pcontent=String(pa.sourceType)+'|'+String(pa.sourceId||pa.id),pskill=pa.skill||'practice';
  seenContent[pcontent]=(seenContent[pcontent]||0)+1;skillCounts[pskill]=(skillCounts[pskill]||0)+1;chosen.push(pa);
 }
 return chosen;
}
function retryPosition(queue){if(!queue||!queue.length)return 0;return Math.min(queue.length,Math.max(3,Math.floor(3+Math.random()*3)));}
function insertRetry(queue,activity){var idx=retryPosition(queue);queue.splice(idx,0,activity);return idx;}
function stateFor(activity,state){return buildStateMap(state)[keyFor(activity)]||null;}
global.WillenaAdaptiveStudy={version:'adaptive-v1',chooseSession:chooseSession,insertRetry:insertRetry,stateFor:stateFor,keyFor:keyFor,buildStateMap:buildStateMap};
})(window);
