(function(){
'use strict';
function addCss(href){if(document.querySelector('link[href="'+href+'"]'))return;var l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l);}
function load(src){return new Promise(function(resolve,reject){var s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=function(){reject(new Error('Could not load '+src));};document.head.appendChild(s);});}
addCss('./study-coach.css?v=20260809-phase1b');
addCss('./conversation-order.css?v=20260809-conversationonly2');
addCss('./study-listening.css?v=20260809-leveltestaudio1');
(async function(){
 try{
  await load('/shared/learning-engine/engine.js?v=20260810-multiline1');
  await load('/shared/learning-engine/practice-pool.js?v=20260810-chunkspelling1');
  await load('/shared/learning-engine/adaptive-study.js?v=20260810-patternrecovery1');
  await load('./study-question-policy.js?v=20260809-phase1');
  await load('./study-question-bank.js?v=20260810-eb6feedback1');
  await load('./study-coach.js?v=20260809-stableunits');
  await load('./daily-workout.js?v=20260810-grammarminimums1');
  await load('./study-practice-override.js?v=20260809-directunit');
 }catch(error){console.error('[WillenaStudy Phase1]',error);}
})();
})();
