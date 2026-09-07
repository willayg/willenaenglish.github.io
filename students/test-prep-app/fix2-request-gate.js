(function(){
'use strict';

var MAX_ACTIVE=2;
var CONTENT_HOST='https://gxwfsqxyuufqtitspfqg.supabase.co/rest/v1/';
var originalFetch=window.fetch.bind(window);
var active=0;
var queue=[];

function bumpRev(){
  try{
    var el=document.querySelector('[id^="tp-rev"][id$="-badge"]');
    if(el){el.id='tp-rev52n-badge';el.textContent='REV 52n';}
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

function onLessonRoute(){
  var s=history.state||{};
  return s.tp==='lesson'&&s.planId&&s.lesson;
}

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
  /* On a hard refresh history.state can still say lesson before auth/plans have
     bootstrapped. Only suppress the known heavy lesson hydrator reads; allow
     books/units/bootstrap requests through so the shell can actually start. */
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

function renderSafeRoute(opts){
  var s=history.state||{};
  if(s.tp!=='lesson'||!s.planId||!s.lesson)return false;
  var safe=window.WillenaLessonSafeFix4;
  if(!safe||!safe.renderSafeLesson)return false;
  return !!safe.renderSafeLesson(s.planId,s.lesson,Object.assign({replace:true},opts||{}));
}

window.addEventListener('popstate',function(e){
  var s=history.state||{};
  if(s.tp!=='lesson'||!s.planId||!s.lesson)return;
  if(e.stopImmediatePropagation)e.stopImmediatePropagation();
  cleanupPractice();
  var tries=0;
  (function retry(){
    if(renderSafeRoute({fromPopstate:true}))return;
    if(++tries<120)setTimeout(retry,25);
  })();
});

function recoverInitialLesson(){
  bumpRev();
  if(!onLessonRoute())return;
  var tries=0;
  (function retry(){
    if(renderSafeRoute({fromRefresh:true}))return;
    if(++tries<200)setTimeout(retry,25);
  })();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',recoverInitialLesson,{once:true});else recoverInitialLesson();
bumpRev();

console.log('[Test Prep] REV52n request gate: bootstrap-safe lesson refresh + max 2 content GETs');
})();