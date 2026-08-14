(function(global){
'use strict';
var PREFIX='willena-study-v2-daily:v1:';
var OP_URL='https://fiieuiktlsivwfgyivai.supabase.co';
var OP_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
var opening=false;
function uid(){try{return String(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId')||'').trim();}catch(_){return'';}}
function token(){try{return (global.WillenaAPI&&WillenaAPI.getLocalAccessToken&&WillenaAPI.getLocalAccessToken())||localStorage.getItem('sb_access_token')||'';}catch(_){return'';}}
function dateKey(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function key(){return PREFIX+uid()+':'+dateKey();}
function sessionId(){return 'study-v2-daily:'+uid()+':'+dateKey();}
function local(){try{return JSON.parse(localStorage.getItem(key())||'null');}catch(_){return null;}}
function writeLocal(s){try{if(s&&s.date===dateKey())localStorage.setItem(key(),JSON.stringify(s));}catch(_){}}
function repaint(){try{if(global.WillenaStudyV2Daily&&WillenaStudyV2Daily.paint)WillenaStudyV2Daily.paint();}catch(_){}}
function resolvedCount(s){return Array.isArray(s&&s.completedIds)?s.completedIds.length:Number(s&&s.index||0);}
function rank(s){if(!s)return-1;return resolvedCount(s)*1000000+(s.finishedAt?100000:0)+Number(s.shownCount||0);}
function headers(extra){var t=token();var h={apikey:OP_KEY,'Content-Type':'application/json'};if(t)h.Authorization='Bearer '+t;Object.keys(extra||{}).forEach(function(k){h[k]=extra[k];});return h;}
async function directGet(){
  if(!uid()||!token())return null;
  var q=OP_URL+'/rest/v1/progress_sessions?select=summary&session_id=eq.'+encodeURIComponent(sessionId())+'&limit=1&_='+Date.now();
  var r=await fetch(q,{headers:headers(),cache:'no-store'});
  if(!r.ok)throw new Error('Daily state read '+r.status);
  var rows=await r.json();
  return Array.isArray(rows)&&rows[0]&&rows[0].summary?rows[0].summary:null;
}
async function directPut(state){
  if(!uid()||!token()||!state)return null;
  var current=await directGet();
  if(current&&rank(current)>=rank(state))return current;
  var now=new Date().toISOString();
  var authoritative=Object.assign({},state,{server_saved_at:now,resolved_count:resolvedCount(state)});
  var row={session_id:sessionId(),user_id:uid(),mode:'study-v2-daily',list_name:'daily-study:'+dateKey(),list_size:Number(state.target||20),started_at:state.startedAt?new Date(state.startedAt).toISOString():now,ended_at:state.finishedAt?new Date(state.finishedAt).toISOString():null,summary:authoritative};
  var url=OP_URL+'/rest/v1/progress_sessions?on_conflict=session_id';
  var r=await fetch(url,{method:'POST',headers:headers({Prefer:'resolution=merge-duplicates,return=representation'}),body:JSON.stringify(row),cache:'no-store'});
  if(!r.ok)throw new Error('Daily state write '+r.status);
  var rows=await r.json();
  return Array.isArray(rows)&&rows[0]&&rows[0].summary?rows[0].summary:authoritative;
}
async function pull(){
  try{
    var remote=await directGet(),here=local();
    if(remote&&remote.date===dateKey()){writeLocal(remote);repaint();return remote;}
    if(here){var seeded=await directPut(here);if(seeded){writeLocal(seeded);repaint();return seeded;}}
    repaint();return here;
  }catch(e){console.warn('[StudyV2 Daily Sync] pull failed',e);repaint();return local();}
}
async function push(s){
  s=s||local();if(!s||s.date!==dateKey())return null;
  try{var saved=await directPut(s);if(saved){writeLocal(saved);repaint();}return saved;}catch(e){console.warn('[StudyV2 Daily Sync] push failed',e);return null;}
}
function bind(){
  document.addEventListener('click',async function(e){
    var card=e.target&&e.target.closest&&e.target.closest('#dailyWorkoutCard');
    if(card&&!opening){e.preventDefault();e.stopImmediatePropagation();opening=true;await pull();try{if(global.WillenaStudyV2Daily&&WillenaStudyV2Daily.open)await WillenaStudyV2Daily.open();}finally{setTimeout(function(){opening=false;},250);}return;}
    if(e.target&&e.target.closest&&e.target.closest('#v2PracticeClose,#v2DailyHome'))setTimeout(function(){push();},50);
  },true);
  global.addEventListener('willena:activity-answer',function(){if(document.body.classList.contains('study-v2-daily-mode'))setTimeout(function(){push();},120);});
  global.addEventListener('willena:study-progress-updated',function(){if(document.body.classList.contains('study-v2-daily-mode'))setTimeout(function(){push();},180);});
  window.addEventListener('focus',function(){pull();});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)pull();});
  window.addEventListener('pagehide',function(){push();});
  setTimeout(pull,250);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
global.WillenaStudyV2DailySync={pull:pull,push:push};
})(window);
