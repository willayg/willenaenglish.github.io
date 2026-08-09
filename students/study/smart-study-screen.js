(function(){
'use strict';
function addCss(href){if(document.querySelector('link[href="'+href+'"]'))return;var l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l);}
function load(src){return new Promise(function(resolve,reject){var s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=function(){reject(new Error('Could not load '+src));};document.head.appendChild(s);});}
addCss('./study-coach.css?v=20260809-phase1b');
(async function(){
 try{
  await load('/shared/learning-engine/adaptive-study.js?v=20260809-phase1');
  await load('./study-question-policy.js?v=20260809-phase1');
  await load('./study-question-bank.js?v=20260809-levelmap');
  await load('./study-coach.js?v=20260809-phase1b');
  await load('./daily-workout.js?v=20260809-publiclevel');
  await load('./study-practice-override.js?v=20260809-phase1');
 }catch(error){console.error('[WillenaStudy Phase1]',error);}
})();
})();
