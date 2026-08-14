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
function repaint(){try{if(global.WillenaStudyV2Daily&&WillenaStudyV2Daily.paint)WillenaStudyV2Daily.paint();}catch(_){}}
async function pull(){
  try{
    var d=await api('/.netlify/functions/daily_study_state?date='+encodeURIComponent(dateKey())+'&_='+Date.now());
    var remote=d&&d.session,here=local();
    /* Once a server session exists it is the sole authority. Local state is only a cache. */
    if(remote&&remote.date===dateKey()){
      writeLocal(remote);
      repaint();
      return remote;
    }
    /* One-time migration/offline seed: only when the server has no session yet. */
    if(here){
      var saved=await push(here);
      if(saved&&saved.session){writeLocal(saved.session);repaint();return saved.session;}
    }
    repaint();
    return here;
  }catch(e){console.warn('[StudyV2 Daily Sync] pull failed',e);repaint();return local();}
}
async function push(s){
  s=s||local();if(!s||s.date!==dateKey())return null;
  try{
    var d=await api('/.netlify/functions/daily_study_state?date='+encodeURIComponent(dateKey()),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:s})});
    /* Server may reject a stale/regressive browser and return its authoritative copy. */
    if(d&&d.session&&d.session.date===dateKey()){
      writeLocal(d.session);
      repaint();
    }
    return d;
  }catch(e){console.warn('[StudyV2 Daily Sync] push failed',e);return null;}
}
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
  window.addEventListener('focus',function(){pull();});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)pull();});
  window.addEventListener('pagehide',function(){push();});
  setTimeout(pull,250);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
global.WillenaStudyV2DailySync={pull:pull,push:push};
})(window);
