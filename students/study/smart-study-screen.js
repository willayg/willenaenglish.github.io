(function(){
'use strict';
/* Render the already-requested assignment as soon as its RPC returns. This adds no request. */
(function primeVisibleAssignment(){
 var nativeFetch=window.fetch.bind(window);
 window.fetch=async function(input,init){
  var response=await nativeFetch(input,init),url=typeof input==='string'?input:(input&&input.url)||'';
  if(response.ok&&url.indexOf('/rest/v1/rpc/get_study_assignment_for_class')>=0){
   response.clone().json().then(function(data){
    var a=data&&data.assignment;if(!a)return;
    var book=document.getElementById('bookTitle'),unit=document.getElementById('unitTitle');
    if(book&&a.book_title)book.textContent=a.book_title;
    var n=a.current_unit||a.starting_unit;
    if(unit&&n)unit.textContent='Unit '+String(n).replace(/^Unit\s*/i,'');
   }).catch(function(){});
  }
  return response;
 };
})();
function addCss(href){if(document.querySelector('link[href="'+href+'"]'))return;var l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l);}
function load(src){return new Promise(function(resolve,reject){var s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=function(){reject(new Error('Could not load '+src));};document.head.appendChild(s);});}
addCss('./study-coach.css?v=20260809-phase1b');
addCss('./conversation-order.css?v=20260809-conversationonly2');
addCss('./study-listening.css?v=20260809-leveltestaudio1');
(async function(){
 try{
  /* engine.js, practice-pool.js and adaptive-study.js are already loaded by index.html */
  await load('./rest-pagination-guard.js?v=20260810-restpage2');
  await load('./study-question-bank.js?v=20260810-indexedunit1');
  await load('./study-practice-override.js?v=20260810-authoredunit1');
  await load('./study-question-policy.js?v=20260809-phase1');
  await load('./study-coach.js?v=20260809-stableunits');
  await load('./daily-workout.js?v=20260810-comeonfix1');
 }catch(error){console.error('[WillenaStudy Phase1]',error);}
})();
})();
