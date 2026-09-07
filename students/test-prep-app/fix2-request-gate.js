(function(){
'use strict';

var MAX_ACTIVE=2;
var CONTENT_HOST='https://gxwfsqxyuufqtitspfqg.supabase.co/rest/v1/';
var originalFetch=window.fetch.bind(window);
var active=0;
var queue=[];

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
  if(isContentGet(input,init)&&onLessonRoute()){
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

/* Register before student-ux-v5 so Back never reaches the heavy lesson renderer. */
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

/* A browser refresh preserves history.state. On reload, student-ux used to see
   tp=lesson and begin its old heavy hydration before the lightweight renderer
   was installed. Keep content GETs inert above and hand that preserved route to
   the safe renderer as soon as auth + lesson-safe are ready. */
function recoverInitialLesson(){
  if(!onLessonRoute())return;
  var tries=0;
  (function retry(){
    if(renderSafeRoute({fromRefresh:true}))return;
    if(++tries<200)setTimeout(retry,25);
  })();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',recoverInitialLesson,{once:true});else recoverInitialLesson();

console.log('[Test Prep] REV52l request gate: refresh-safe lesson route + max 2 content GETs');
})();