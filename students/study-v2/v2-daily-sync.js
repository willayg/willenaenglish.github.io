(function(global){
'use strict';
var PREFIX='willena-study-v2-daily:v1:';
var ENDPOINT='https://api.willenaenglish.com/api/daily-study-state';
var opening=false;
function uid(){try{return String(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId')||'').trim();}catch(_){return'';}}
function dateKey(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function key(){return PREFIX+uid()+':'+dateKey();}
function local(){try{return JSON.parse(localStorage.getItem(key())||'null');}catch(_){return null;}}
function writeLocal(s){try{if(s&&s.date===dateKey())localStorage.setItem(key(),JSON.stringify(s));}catch(_){}}
function repaint(){try{if(global.WillenaStudyV2Daily&&WillenaStudyV2Daily.paint)WillenaStudyV2Daily.paint();}catch(_){}}
async function request(method,state,keepalive){
  var url=ENDPOINT+'?date='+encodeURIComponent(dateKey())+'&_='+Date.now();
  var opts={method:method,credentials:'include',cache:'no-store',headers:{Accept:'application/json'}};
  if(method==='POST'){
    opts.headers['Content-Type']='application/json';
    opts.body=JSON.stringify({session:state});
    if(keepalive)opts.keepalive=true;
  }
  var r=await fetch(url,opts),d=await r.json().catch(function(){return{};});
  if(!r.ok||d.success===false)throw new Error((d&&d.error)||('Daily Study sync '+r.status));
  return d;
}
async function pull(){
  try{
    var d=await request('GET'),remote=d&&d.session,here=local();
    if(remote&&remote.date===dateKey()){
      writeLocal(remote);repaint();return remote;
    }
    if(here){
      var seeded=await push(here);
      if(seeded){writeLocal(seeded);repaint();return seeded;}
    }
    repaint();return here;
  }catch(e){console.warn('[StudyV2 Daily Sync] pull failed',e);repaint();return local();}
}
async function push(s,keepalive){
  s=s||local();if(!s||s.date!==dateKey())return null;
  try{
    var d=await request('POST',s,!!keepalive),saved=d&&d.session;
    if(saved&&saved.date===dateKey()){writeLocal(saved);repaint();return saved;}
    return null;
  }catch(e){console.warn('[StudyV2 Daily Sync] push failed',e);return null;}
}
function bind(){
  document.addEventListener('click',async function(e){
    var card=e.target&&e.target.closest&&e.target.closest('#dailyWorkoutCard');
    if(card&&!opening){
      e.preventDefault();e.stopImmediatePropagation();opening=true;
      await pull();
      try{if(global.WillenaStudyV2Daily&&WillenaStudyV2Daily.open)await WillenaStudyV2Daily.open();}
      finally{setTimeout(function(){opening=false;},250);}
      return;
    }
    if(e.target&&e.target.closest&&e.target.closest('#v2PracticeClose,#v2DailyHome'))setTimeout(function(){push();},50);
  },true);
  global.addEventListener('willena:activity-answer',function(){if(document.body.classList.contains('study-v2-daily-mode'))setTimeout(function(){push();},120);});
  global.addEventListener('willena:study-progress-updated',function(){if(document.body.classList.contains('study-v2-daily-mode'))setTimeout(function(){push();},180);});
  window.addEventListener('focus',function(){pull();});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)pull();});
  window.addEventListener('pagehide',function(){push(null,true);});
  setTimeout(pull,250);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
global.WillenaStudyV2DailySync={pull:pull,push:push};
})(window);
