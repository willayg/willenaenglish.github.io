(function(){
'use strict';
var sourceUrl='./js/adaptive-calibration-loader.js?v=20260731-2';
function replaceOnce(source,from,to,label){
 if(source.indexOf(from)<0)throw new Error('Full test patch failed: '+label);
 return source.replace(from,to);
}
fetch(sourceUrl,{cache:'no-store'}).then(function(response){
 if(!response.ok)throw new Error('Could not load calibrated test engine ('+response.status+').');
 return response.text();
}).then(function(source){
 source=replaceOnce(source,
  'q40:"Detailed · 40 questions",back:',
  'q40:"Detailed · 40 questions",qFull:"Full test · 50 questions",back:',
  'English full option');
 source=replaceOnce(source,
  'q40:"자세히 · 40문제",back:',
  'q40:"자세히 · 40문제",qFull:"전체 테스트 · 50문제",back:',
  'Korean full option');
 source=replaceOnce(source,
  'optionButtons([[20,tx("q20")],[30,tx("q30")],[40,tx("q40")]],"length")',
  'optionButtons([[50,tx("qFull")],[20,tx("q20")],[30,tx("q30")],[40,tx("q40")]],"length")',
  'full choice placement');
 source=replaceOnce(source,
  'ability:2,startAbility:2,maxQ:30,used:new Set()',
  'ability:2,startAbility:2,maxQ:30,fullMode:false,sectionIndex:0,sectionQuestionCount:0,sectionStartAnswer:0,used:new Set()',
  'full state');
 source=replaceOnce(source,
  'function displayScrambleToken(text,level){var value=String(text==null?"":text);if(Number(level)<6)return value;return value.toLowerCase().replace(/^[\\s“”"‘’.,!?;:()]+|[\\s“”"‘’.,!?;:()]+$/g,"")}',
  'function displayScrambleToken(text,level){var value=String(text==null?"":text);if(Number(level)<6)return value;return value.toLowerCase().replace(/^[\\s“”"‘’.,!?;:()]+|[\\s“”"‘’.,!?;:()]+$/g,"")}function fullSections(){return[{key:"vocabulary",types:["vocabulary"],en:"Vocabulary",ko:"어휘"},{key:"grammar",types:["grammar","grammar_error","question_response"],en:"Grammar",ko:"문법"},{key:"listening",types:["listening"],en:"Listening",ko:"듣기"},{key:"reading",types:["reading"],en:"Reading",ko:"읽기"},{key:"sentence_building",types:["sentence_unscramble"],en:"Sentence Building",ko:"문장 만들기"}]}function activeSection(){return fullSections()[S.sectionIndex]||null}function sectionAnswerCount(){return S.fullMode?S.sectionQuestionCount:S.answers.length}function resetSectionAbility(){S.ability=clamp(S.startAbility*.7+S.ability*.3,1,10);S.sectionQuestionCount=0;S.sectionStartAnswer=S.answers.length}function showSectionIntro(done){var section=activeSection();if(!section){done();return}var ko=document.documentElement.lang==="ko",overlay=document.createElement("div");overlay.className="section-intro-overlay";overlay.setAttribute("role","status");overlay.innerHTML=\'<div class="section-intro-ring"><svg viewBox="0 0 220 220" aria-hidden="true"><circle class="section-intro-track" cx="110" cy="110" r="100"></circle><circle class="section-intro-progress" cx="110" cy="110" r="100"></circle></svg><div class="section-intro-center"><span>\'+(ko?"다음 영역":"Next section")+\'</span><strong>\'+(ko?section.ko:section.en)+\'</strong></div></div>\';document.body.appendChild(overlay);setTimeout(function(){overlay.classList.add("is-leaving")},1450);setTimeout(function(){overlay.remove();done()},1750)}',
  'section helpers');
 source=replaceOnce(source,
  'function adjustmentStrength(){var n=S.answers.length;',
  'function adjustmentStrength(){var n=sectionAnswerCount();',
  'section adjustment count');
 source=replaceOnce(source,
  'function calibrationTarget(){var n=S.answers.length,start=S.startAbility;',
  'function calibrationTarget(){var n=sectionAnswerCount(),start=S.ability;',
  'section calibration');
 source=replaceOnce(source,
  'var recent=S.answers.slice(0,Math.min(n,4))',
  'var recent=S.fullMode?S.answers.slice(S.sectionStartAnswer,S.sectionStartAnswer+Math.min(n,4)):S.answers.slice(0,Math.min(n,4))',
  'section calibration evidence');
 source=replaceOnce(source,
  'function antiStallTarget(target){var recent=S.answers.slice(-3);',
  'function antiStallTarget(target){var recent=S.fullMode?S.answers.slice(-Math.min(3,S.sectionQuestionCount)):S.answers.slice(-3);',
  'section anti stall');
 source=replaceOnce(source,
  'S.startAbility=startAbility(S.setup.years,S.setup.grade);S.ability=S.startAbility;S.maxQ=S.setup.length;',
  'S.startAbility=startAbility(S.setup.years,S.setup.grade);S.ability=S.startAbility;S.fullMode=S.setup.length===50;S.sectionIndex=0;S.sectionQuestionCount=0;S.sectionStartAnswer=0;S.maxQ=S.fullMode?50:S.setup.length;if(S.fullMode)S.setup.listening=1;',
  'full start state');
 source=replaceOnce(source,
  'S.isSpeaking=false;nextQuestion()}',
  'S.isSpeaking=false;if(S.fullMode)showSectionIntro(nextQuestion);else nextQuestion()}',
  'first section intro');
 source=replaceOnce(source,
  'function pickQuestion(){var rawTarget=S.answers.length<5?calibrationTarget():antiStallTarget(S.ability),target=clamp(Math.round(rawTarget),1,10),pool=bank.filter(function(q){return !S.used.has(q.id)&&(S.setup.listening===1||q.type!=="listening")});',
  'function pickQuestion(){var rawTarget=sectionAnswerCount()<5?calibrationTarget():antiStallTarget(S.ability),target=clamp(Math.round(rawTarget),1,10),section=S.fullMode?activeSection():null,pool=bank.filter(function(q){return !S.used.has(q.id)&&(S.setup.listening===1||q.type!=="listening")&&(!section||section.types.indexOf(q.type)>=0)});',
  'section question pool');
 source=replaceOnce(source,
  'function nextQuestion(){if(S.answers.length>=S.maxQ){finish();return}S.current=pickQuestion();',
  'function nextQuestion(){if(S.answers.length>=S.maxQ){finish();return}if(S.fullMode&&S.sectionQuestionCount>=10){S.sectionIndex++;if(S.sectionIndex>=fullSections().length){finish();return}resetSectionAbility();showSectionIntro(nextQuestion);return}S.current=pickQuestion();',
  'section transitions');
 source=replaceOnce(source,
  'S.answers.push({id:q.id,level:q.level,type:q.type,correct:ok,selected:selectedAnswer,answer:q.a});nextQuestion()}',
  'S.answers.push({id:q.id,level:q.level,type:q.type,correct:ok,selected:selectedAnswer,answer:q.a});if(S.fullMode)S.sectionQuestionCount++;nextQuestion()}',
  'section question count');
 var script=document.createElement('script');
 script.text=source+'\n//# sourceURL=adaptive-calibration-full-test.js';
 document.head.appendChild(script);
 script.remove();
}).catch(function(error){
 console.error(error);
 var app=document.querySelector('#app');
 if(app)app.innerHTML='<section class="screen"><h2>Could not load the test</h2><p class="error">Please refresh the page.</p></section>';
});
})();