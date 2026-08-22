(function(global){
'use strict';
var base=global.WillenaCoachHistory;if(!base||typeof base.load!=='function')return;
var SCORE_URL='https://fiieuiktlsivwfgyivai.supabase.co';
var SCORE_KEY=['sb_publishable_','e-K50PquV9gHdfmefG6tmg_','o-vVSl0e'].join('');
var enhanced=null,loading=null;
function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function num(v){var n=Number(v);return Number.isFinite(n)?n:0;}
function clamp(v,min,max){return Math.max(min,Math.min(max,num(v)));}
function pct(v){var n=num(v);if(n>=0&&n<=1)n*=100;return Math.round(clamp(n,0,100)*10)/10;}
function ms(v){var n=Date.parse(v||'');return Number.isFinite(n)?n:0;}
function uid(){try{return text(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function token(){try{var api=global.WillenaAPI;if(api&&typeof api.getLocalAccessToken==='function'){var t=text(api.getLocalAccessToken());if(t)return t;}return text(localStorage.getItem('sb_access_token')||sessionStorage.getItem('sb_access_token'));}catch(_){return'';}}
async function fetchAllMastery(){
  var id=uid(),t=token();if(!id||!t)return[];
  var out=[],offset=0,page=1000,fields='book_id,unit_id,content_type,content_id,skill,attempts,correct_attempts,accuracy,mastery_score,last_seen_at,next_review_at,updated_at,lapses,review_state';
  while(offset<20000){
    var path='/rest/v1/student_content_mastery?student_id=eq.'+encodeURIComponent(id)+'&select='+fields+'&order=updated_at.desc&limit='+page+'&offset='+offset;
    var r=await fetch(SCORE_URL+path,{headers:{apikey:SCORE_KEY,Authorization:'Bearer '+t},cache:'no-store'});if(!r.ok)throw new Error('Coach mastery page '+r.status);
    var rows=await r.json();if(!Array.isArray(rows))break;out=out.concat(rows);if(rows.length<page)break;offset+=page;
  }
  return out;
}
function skillMastery(rows){var g={};arr(rows).forEach(function(r){var sk=text(r&&r.skill);if(!sk)return;var x=g[sk]||(g[sk]={skill:sk,attempts:0,correct:0,lapses:0,wm:0,w:0,last:0,due:0}),a=Math.max(0,num(r.attempts)),c=Math.max(0,num(r.correct_attempts)),w=Math.max(1,a);x.attempts+=a;x.correct+=c;x.lapses+=Math.max(0,num(r.lapses));x.wm+=pct(r.mastery_score)*w;x.w+=w;x.last=Math.max(x.last,ms(r.last_seen_at||r.updated_at));if(r.next_review_at&&ms(r.next_review_at)<=Date.now())x.due++;});return Object.keys(g).map(function(k){var x=g[k];return{skill:x.skill,attempts:x.attempts,correct:x.correct,accuracy:x.attempts?Math.round(x.correct/x.attempts*1000)/10:null,mastery:x.w?Math.round(x.wm/x.w*10)/10:0,lapses:x.lapses,due:x.due,lastSeen:x.last?new Date(x.last).toISOString():null};}).sort(function(a,b){return a.mastery-b.mastery||b.lapses-a.lapses||a.skill.localeCompare(b.skill);});}
function locations(rows){var g={};arr(rows).forEach(function(r){var sk=text(r&&r.skill),bid=text(r&&r.book_id),uid=text(r&&r.unit_id);if(!sk||!bid||!uid)return;var key=bid+'|'+uid+'|'+sk,x=g[key]||(g[key]={bookId:bid,unitId:uid,skill:sk,attempts:0,correct:0,lapses:0,wm:0,w:0,last:0}),a=Math.max(0,num(r.attempts)),c=Math.max(0,num(r.correct_attempts)),w=Math.max(1,a);x.attempts+=a;x.correct+=c;x.lapses+=Math.max(0,num(r.lapses));x.wm+=pct(r.mastery_score)*w;x.w+=w;x.last=Math.max(x.last,ms(r.last_seen_at||r.updated_at));});return Object.keys(g).map(function(k){var x=g[k];return{bookId:x.bookId,unitId:x.unitId,skill:x.skill,attempts:x.attempts,correct:x.correct,accuracy:x.attempts?Math.round(x.correct/x.attempts*1000)/10:null,mastery:x.w?Math.round(x.wm/x.w*10)/10:0,lapses:x.lapses,lastSeen:x.last?new Date(x.last).toISOString():null};}).sort(function(a,b){return a.mastery-b.mastery||b.lapses-a.lapses||b.attempts-a.attempts||ms(b.lastSeen)-ms(a.lastSeen);});}
function contentSignals(rows){return arr(rows).map(function(r){return{type:'content',key:text(r.content_id),name:text(r.content_id),skill:text(r.skill),bookId:text(r.book_id),unitId:text(r.unit_id),contentType:text(r.content_type),contentId:text(r.content_id),mastery:pct(r.mastery_score),accuracy:pct(r.accuracy),attempts:num(r.attempts),lapses:num(r.lapses),reviewState:text(r.review_state),lastSeen:r.last_seen_at||r.updated_at||null,nextReview:r.next_review_at||null};}).filter(function(x){return x.key;});}
function weak(rows){return arr(rows).filter(function(x){return x.attempts>0&&(x.mastery<70||x.accuracy<75||x.lapses>0);}).sort(function(a,b){return b.lapses-a.lapses||a.mastery-b.mastery||a.accuracy-b.accuracy;}).slice(0,60);}
function due(rows){var now=Date.now();return arr(rows).filter(function(x){return x.nextReview&&ms(x.nextReview)<=now;}).sort(function(a,b){return ms(a.nextReview)-ms(b.nextReview);}).slice(0,60);}
function strengths(rows){var cutoff=Date.now()-14*86400000;return arr(rows).filter(function(x){return x.attempts>=2&&x.mastery>=80&&x.accuracy>=80&&ms(x.lastSeen)>=cutoff;}).sort(function(a,b){return ms(b.lastSeen)-ms(a.lastSeen)||b.mastery-a.mastery;}).slice(0,30);}
function apply(snapshot,rows){if(!snapshot||!rows.length)return snapshot;var c=contentSignals(rows);snapshot.skillMastery=skillMastery(rows);snapshot.skillLocations=locations(rows);snapshot.content=snapshot.content||{};snapshot.content.mastery=c;snapshot.content.weak=weak(c);snapshot.content.due=due(c);snapshot.content.recentStrengths=strengths(c);snapshot.signals=snapshot.signals||{};snapshot.signals.weakSkills=snapshot.skillMastery.filter(function(x){return x.attempts>0&&(x.mastery<70||x.accuracy<75||x.lapses>0);}).slice(0,20);snapshot.historyRowCount=rows.length;snapshot.historyPagination=true;return snapshot;}
async function load(ctx,opts){if(loading)return loading;loading=Promise.all([base.load(ctx,opts||{}),fetchAllMastery().catch(function(e){console.warn('[AI Coach history pagination]',e);return[];})]).then(function(x){enhanced=apply(x[0],x[1]);return enhanced;}).finally(function(){loading=null;});return loading;}
function invalidate(){enhanced=null;if(typeof base.invalidate==='function')base.invalidate();}
function refresh(ctx){invalidate();return load(ctx,{force:true});}
function getSnapshot(){return enhanced||(typeof base.getSnapshot==='function'?base.getSnapshot():null);}
global.addEventListener('willena:study-recording',function(){enhanced=null;});global.addEventListener('willena:study-progress-updated',function(){enhanced=null;});global.addEventListener('willena:morphology-updated',function(){enhanced=null;});
global.WillenaCoachHistory={version:'coach-history-v1.2-paged',load:load,refresh:refresh,getSnapshot:getSnapshot,invalidate:invalidate};
})(window);
