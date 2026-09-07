(function(){
'use strict';

var MAX_ACTIVE=2;
var CONTENT_HOST='https://gxwfsqxyuufqtitspfqg.supabase.co/rest/v1/';
var originalFetch=window.fetch.bind(window);
var active=0;
var queue=[];
var refreshLesson=null;

function bumpRev(){
  try{
    var el=document.querySelector('[id^="tp-rev"][id$="-badge"]');
    if(el){el.id='tp-rev52o-badge';el.textContent='REV 52o';}
  }catch(_){}
}

function requestUrl(input){
  try{
    if(typeof input==='string')return input;
    if(input&&typeof input.url==='string')return input.url;
  }catch(e){}
  return '';
}

function methodOf(input,init){
  return String((init&&init.method)||((input&&input.method)||'GET')).toUpperCase();
}

function isContentGet(input,init){
  var url=requestUrl(input);
  return methodOf(input,init)==='GET'&&url.indexOf(CONTENT_HOST)===0;
}

function isHeavyLessonGet(input,init){
  if(!isContentGet(input,init))return false;
  var url=requestUrl(input);
  return url.indexOf('/source_content_occurrences?')!==-1 ||
         url.indexOf('/passages?')!==-1 ||
         url.indexOf('/test_prep_questions?')!==-1;
}

function lessonState(s){
  s=s||{};
  return s.tp==='lesson'&&s.planId&&s.lesson?s:null;
}

function onLessonRoute(){
  return !!lessonState(history.state);
}

/* history.state survives a hard refresh. Quarantine a persisted lesson route
   before student-ux-v5.js loads, so the old heavy lesson renderer never sees
   tp:'lesson' during startup. The lightweight renderer restores it after auth. */
function quarantineInitialLesson(){
  var s=lessonState(history.state);
  if(!s)return false;
  refreshLesson={tp:'lesson',planId:String(s.planId),lesson:String(s.lesson),skill:s.skill||null,safeFix4:true};
  try{history.replaceState({tp:'home',tpLessonRecovery:true},'',location.href);}catch(_){}
  return true;
}
quarantineInitialLesson();

function pump(){
  while(active<MAX_ACTIVE&&queue.length){
    var job=queue.shift();
    active++;
    originalFetch(job.input,job.init).then(job.resolve,job.reject).then(done,done);
  }
}

function done(){
  active=Math.max(0,active-1);
  pump();
}

window.fetch=function(input,init){
  if(onLessonRoute()&&isHeavyLessonGet(input,init)){
    return Promise.resolve(new Response('[]',{status:200,headers:{'Content-Type':'application/json'}}));
  }
  if(!isContentGet(input,init))return originalFetch(input,init);
  return new Promise(function(resolve,reject){
    queue.push({input:input,init:init,resolve:resolve,reject:reject});
    pump();
  });
};

function cleanupPractice(){
  try{window.WillenaVocabPractice&&window.WillenaVocabPractice.restore&&window.WillenaVocabPractice.restore();}catch(_){}
  try{window.WillenaVocabTestPractice&&window.WillenaVocabTestPractice.restore&&window.WillenaVocabTestPractice.restore();}catch(_){}
  try{window.WillenaSentencePractice&&window.WillenaSentencePractice.restore&&window.WillenaSentencePractice.restore();}catch(_){}
}

function renderSafeState(s,opts){
  s=lessonState(s);
  if(!s)return false;
  var safe=window.WillenaLessonSafeFix4;
  if(!safe||!safe.renderSafeLesson)return false;
  return !!safe.renderSafeLesson(s.planId,s.lesson,Object.assign({replace:true},opts||{}));
}

function renderSafeRoute(opts){
  return renderSafeState(history.state,opts);
}

window.addEventListener('popstate',function(e){
  var s=lessonState(history.state);
  if(!s)return;
  if(e.stopImmediatePropagation)e.stopImmediatePropagation();
  cleanupPractice();
  var tries=0;
  (function retry(){
    if(renderSafeState(s,{fromPopstate:true}))return;
    if(++tries<120)setTimeout(retry,25);
  })();
});

function recoverInitialLesson(){
  bumpRev();
  if(!refreshLesson)return;
  var target=refreshLesson;
  var tries=0;
  (function retry(){
    if(renderSafeState(target,{fromRefresh:true})){
      refreshLesson=null;
      return;
    }
    if(++tries<240)setTimeout(retry,25);
  })();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',recoverInitialLesson,{once:true});else recoverInitialLesson();
bumpRev();

console.log('[Test Prep] REV52o request gate: quarantined lesson refresh + max 2 content GETs');
})();