(function(){
'use strict';

var MAX_ACTIVE=2;
var CONTENT_HOST='https://gxwfsqxyuufqtitspfqg.supabase.co/rest/v1/';
var originalFetch=window.fetch.bind(window);
var active=0;
var queue=[];
var refreshLesson=null;
var recoveryLock=false;
var recoveryTarget=null;
var selectionDescriptor=null;
var selectionOverrideInstalled=false;
var recoveryStarted=false;

function bumpRev(){
  try{
    var el=document.querySelector('[id^="tp-rev"][id$="-badge"]');
    if(el){el.id='tp-rev52t-badge';el.textContent='REV 52t';}
  }catch(_){}
}
function requestUrl(input){try{if(typeof input==='string')return input;if(input&&typeof input.url==='string')return input.url}catch(e){}return ''}
function methodOf(input,init){return String((init&&init.method)||((input&&input.method)||'GET')).toUpperCase()}
function isContentGet(input,init){var url=requestUrl(input);return methodOf(input,init)==='GET'&&url.indexOf(CONTENT_HOST)===0}
function isHeavyLessonGet(input,init){if(!isContentGet(input,init))return false;var url=requestUrl(input);return url.indexOf('/source_content_occurrences?')!==-1||url.indexOf('/passages?')!==-1||url.indexOf('/test_prep_questions?')!==-1}
function lessonState(s){s=s||{};return s.tp==='lesson'&&s.planId&&s.lesson?s:null}
function onLessonRoute(){return !!lessonState(history.state)}

function installSelectionOverride(){
  if(selectionOverrideInstalled||(!refreshLesson&&!recoveryLock))return;
  var assigned=window.WillenaAssignedTestPrep;if(!assigned)return;
  try{
    selectionDescriptor=Object.getOwnPropertyDescriptor(assigned,'selection')||null;
    Object.defineProperty(assigned,'selection',{configurable:true,enumerable:true,get:function(){if(refreshLesson||recoveryLock)return {__lessonRecovery:true};return selectionDescriptor&&selectionDescriptor.get?selectionDescriptor.get.call(assigned):null}});
    selectionOverrideInstalled=true;
  }catch(_){}
}
function restoreSelectionOverride(){
  if(!selectionOverrideInstalled)return;
  try{var assigned=window.WillenaAssignedTestPrep;if(assigned&&selectionDescriptor)Object.defineProperty(assigned,'selection',selectionDescriptor)}catch(_){}
  selectionOverrideInstalled=false;selectionDescriptor=null;
}
function quarantineInitialLesson(){
  var s=lessonState(history.state);if(!s)return false;
  refreshLesson={tp:'lesson',planId:String(s.planId),lesson:String(s.lesson),skill:s.skill||null,safeFix4:true};
  recoveryTarget=refreshLesson;
  recoveryLock=true;
  window.__WillenaLessonColdBoot=refreshLesson;
  installSelectionOverride();
  try{history.replaceState({tp:'practice',planId:String(s.planId),lesson:String(s.lesson),returnTo:'lesson',tpLessonRecovery:true},'',location.href)}catch(_){}
  return true;
}
quarantineInitialLesson();

function pump(){while(active<MAX_ACTIVE&&queue.length){var job=queue.shift();active++;originalFetch(job.input,job.init).then(job.resolve,job.reject).then(done,done)}}
function done(){active=Math.max(0,active-1);pump()}
window.fetch=function(input,init){
  /* Bootstrap gets a clean path only until the safe lesson is painted. After
     that, the heavy legacy lesson reads are blocked while the safe RPC settles. */
  if(refreshLesson)return originalFetch(input,init);
  if((onLessonRoute()||recoveryLock)&&isHeavyLessonGet(input,init))return Promise.resolve(new Response('[]',{status:200,headers:{'Content-Type':'application/json'}}));
  if(!isContentGet(input,init))return originalFetch(input,init);
  return new Promise(function(resolve,reject){queue.push({input:input,init:init,resolve:resolve,reject:reject});pump()});
};

function cleanupPractice(){try{window.WillenaVocabPractice&&window.WillenaVocabPractice.restore&&window.WillenaVocabPractice.restore()}catch(_){}try{window.WillenaVocabTestPractice&&window.WillenaVocabTestPractice.restore&&window.WillenaVocabTestPractice.restore()}catch(_){}try{window.WillenaSentencePractice&&window.WillenaSentencePractice.restore&&window.WillenaSentencePractice.restore()}catch(_){}}
function renderSafeState(s,opts){s=lessonState(s);if(!s)return false;var safe=window.WillenaLessonSafeFix4;if(!safe||!safe.renderSafeLesson)return false;return !!safe.renderSafeLesson(s.planId,s.lesson,Object.assign({replace:true},opts||{}))}

function releaseRecoveryLock(reason){
  if(!recoveryLock)return;
  recoveryLock=false;
  recoveryTarget=null;
  window.__WillenaLessonColdBoot=null;
  restoreSelectionOverride();
  console.log('[Test Prep] REV52t safe lesson ownership released:',reason||'settled');
}
function waitForSafeHydration(){
  var checks=0;
  (function check(){
    if(!recoveryLock)return;
    var pill=document.getElementById('tpLessonDataDiagnostic');
    var text=String(pill&&pill.textContent||'');
    var done=!!pill&&text.indexOf('loading')===-1&&text.indexOf('waiting')===-1;
    if(done){releaseRecoveryLock('rpc-settled');return;}
    if(++checks>=30){releaseRecoveryLock('timeout');return;}
    setTimeout(check,200);
  })();
}

/* Registered before student-ux-v5. While recovery is locked, no later state
   refresh is allowed to hand the lesson back to the legacy renderer. */
window.addEventListener('testprep:student-state-refresh',function(e){
  var s=lessonState(history.state);
  if(refreshLesson||recoveryLock){
    if(e&&e.stopImmediatePropagation)e.stopImmediatePropagation();
    if(refreshLesson)recoverAfterAuth();
    else if(s&&s.safeFix4===true)setTimeout(function(){renderSafeState(s,{fromStateRefresh:true})},0);
    return;
  }
  if(!s||s.safeFix4!==true)return;
  if(e&&e.stopImmediatePropagation)e.stopImmediatePropagation();
  setTimeout(function(){renderSafeState(s,{fromStateRefresh:true})},0);
});

window.addEventListener('popstate',function(e){var s=lessonState(history.state);if(!s)return;if(e.stopImmediatePropagation)e.stopImmediatePropagation();cleanupPractice();var tries=0;(function retry(){if(renderSafeState(s,{fromPopstate:true}))return;if(++tries<80)setTimeout(retry,100)})()});
function showRecoverySurface(){try{var h=document.getElementById('assignmentHome'),q=document.getElementById('assignedQuizPane');if(q)q.style.display='none';if(h){h.style.display='block';h.innerHTML='<div class="tp-shell-loading">Lesson을 다시 여는 중...</div>'}}catch(_){}}
function finishRecovery(target){
  if(!refreshLesson)return true;
  installSelectionOverride();
  if(!renderSafeState(target,{fromRefresh:true}))return false;
  /* Safe DOM now owns the screen. Turn the heavy-read blocker back on, but
     keep the cold-boot ownership lock until the RPC pill actually settles. */
  refreshLesson=null;
  recoveryLock=true;
  recoveryTarget=target;
  window.__WillenaLessonColdBoot=target;
  installSelectionOverride();
  waitForSafeHydration();
  return true;
}
function recoverAfterAuth(){
  if(recoveryStarted||!refreshLesson)return;recoveryStarted=true;showRecoverySurface();var target=refreshLesson,auth=window.WillenaTestPrepAuth,ready=auth&&auth.ready;
  Promise.resolve(ready).catch(function(){}).then(function(){var tries=0;(function retry(){if(finishRecovery(target))return;if(++tries<120)setTimeout(retry,100)})()});
}
function bootRecovery(){bumpRev();if(!refreshLesson)return;installSelectionOverride();recoverAfterAuth()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootRecovery,{once:true});else bootRecovery();
bumpRev();
console.log('[Test Prep] REV52t: safe lesson keeps ownership until RPC settles');
})();