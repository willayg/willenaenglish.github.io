(function(global){
'use strict';
var PREFIX='willena-study-v2-daily:v1:';
var opening=false;
function uid(){try{return String(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId')||'').trim();}catch(_){return'';}}
function dateKey(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function key(){return PREFIX+uid()+':'+dateKey();}
function api(url,opts){return (global.WillenaAPI?WillenaAPI.fetch:fetch)(url,Object.assign({credentials:'include',cache:'no-store'},opts||{})).then(function(r){return r.json().then(function(d){if(!r.ok||d&&d.success===false)throw new Error(d&&d.error||'Request failed');return d;});});}
function local(){try{return JSON.parse(localStorage.getItem(key())||'null');}catch(_){return null;}}
function writeLocal(s){try{if(s&&s.date===dateKey())localStorage.setItem(key(),JSON.stringify(s));}catch(_){}}
function score(s){if(!s)return 0;var done=Array.isArray(s.completedIds)?s.completedIds.length:Number(s.index||0);return done*100000+Number(s.shownCount||0)*100+Number(s.finishedAt||0);}
async function pull(){try{var d=await api('/.netlify/functions/daily_study_state?date='+encodeURIComponent(dateKey())+'&_='+Date.now());var remote=d&&d.session,here=local();if(remote&&remote.date===dateKey()&&score(remote)>=score(here)){writeLocal(remote);return remote;}if(here)await push(here);return here;}catch(e){console.warn('[StudyV2 Daily Sync] pull failed',e);return local();}}
async function push(s){s=s||local();if(!s||s.date!==dateKey())return;try{await api('/.netlify/functions/daily_study_state?date='+encodeURIComponent(dateKey()),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:s})});}catch(e){console.warn('[StudyV2 Daily Sync] push failed',e);}}
function bind(){
  document.addEventListener('click',async function(e){
    var card=e.target&&e.target.closest&&e.target.closest('#dailyWorkoutCard');
    if(card&&!opening){
      e.preventDefault();e.stopImmediatePropagation();opening=true;
      await pull();
      try{if(global.WillenaStudyV2Daily&&WillenaStudyV2Daily.open)await WillenaStudyV2Daily.open();}finally{setTimeout(function(){opening=false;},250);}
      return;
    }
    if(e.target&&e.target.closest&&e.target.closest('#v2PracticeClose,#v2DailyHome'))setTimeout(function(){push();},50);
  },true);
  global.addEventListener('willena:activity-answer',function(){if(document.body.classList.contains('study-v2-daily-mode'))setTimeout(function(){push();},120);});
  global.addEventListener('willena:study-progress-updated',function(){if(document.body.classList.contains('study-v2-daily-mode'))setTimeout(function(){push();},180);});
  window.addEventListener('pagehide',function(){push();});
  setTimeout(pull,250);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
global.WillenaStudyV2DailySync={pull:pull,push:push};
})(window);