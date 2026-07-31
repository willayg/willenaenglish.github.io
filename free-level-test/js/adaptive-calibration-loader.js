(function(){
'use strict';
var sourceUrl='./js/app-classic.js?v=20260731-4';
function replaceOnce(source,from,to,label){
 if(source.indexOf(from)<0)throw new Error('Adaptive calibration patch failed: '+label);
 return source.replace(from,to);
}
fetch(sourceUrl,{cache:'no-store'}).then(function(response){
 if(!response.ok)throw new Error('Could not load test engine ('+response.status+').');
 return response.text();
}).then(function(source){
 source=replaceOnce(source,
  'var S={view:"setup",setupStep:0,setup:{grade:null,years:null,listening:null,length:null},ability:2,maxQ:30,used:new Set(),answers:[],current:null,selected:null,scramblePool:[],wrongByLevel:{},typeCounts:{},lowLevelCounts:{total:0,grammar:0},translationCount:0,playsLeft:0,isSpeaking:false};',
  'var S={view:"setup",setupStep:0,setup:{grade:null,years:null,listening:null,length:null},ability:2,startAbility:2,sectionBaseAbility:2,maxQ:30,fullMode:false,sectionIndex:0,sectionQuestionCount:0,sectionStartAnswer:0,used:new Set(),answers:[],current:null,selected:null,scramblePool:[],wrongByLevel:{},typeCounts:{},lowLevelCounts:{total:0,grammar:0},translationCount:0,playsLeft:0,isSpeaking:false};',
  'state');

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
  'optionButtons([[20,tx("q20")],[30,tx("q30")],[50,tx("qFull")],[40,tx("q40")]],"length")',
  'full choice placement');

 source=replaceOnce(source,
  'function startAbility(years,grade){var yearBase={0:1,1:1.8,2:2.7,4:4,6:5.3},stageAdjustment={1:0,2:0,4:.25,6:.5,8:.75,9:1};return clamp((yearBase[Number(years)]==null?1:yearBase[Number(years)])+(stageAdjustment[Number(grade)]==null?0:stageAdjustment[Number(grade)]),1,7)}',
  'function startAbility(years,grade){var matrix={1:{0:1,1:1.5,2:2,4:2.5,6:3},2:{0:1,1:2,2:3,4:4,6:5},4:{0:1.5,1:2.5,2:4,4:5.5,6:6.5},6:{0:2,1:3,2:4.5,4:6,6:7.5},8:{0:2.5,1:3.5,2:5,4:7,6:8.5},9:{0:3,1:4,2:5.5,4:7.5,6:9}},stage=matrix[Number(grade)]||matrix[1],value=stage[Number(years)];return clamp(value==null?1:value,1,10)}',
  'starting matrix');

 source=replaceOnce(source,
  'function wrongPenalty(level){return Math.pow(.8,S.wrongByLevel[level]||0)}',
  'function wrongPenalty(level){return Math.pow(.8,S.wrongByLevel[level]||0)}function fullSections(){return[{key:"vocabulary",types:["vocabulary"],en:"Vocabulary",ko:"어휘"},{key:"grammar",types:["grammar","grammar_error","question_response"],en:"Grammar",ko:"문법"},{key:"listening",types:["listening"],en:"Listening",ko:"듣기"},{key:"reading",types:["reading"],en:"Reading",ko:"읽기"},{key:"sentence_building",types:["sentence_unscramble"],en:"Sentence Building",ko:"문장 만들기"}]}function activeSection(){return fullSections()[S.sectionIndex]||null}function sectionAnswerCount(){return S.fullMode?S.sectionQuestionCount:S.answers.length}function sectionRows(){return S.fullMode?S.answers.slice(S.sectionStartAnswer):S.answers}function adjustmentStrength(){var n=sectionAnswerCount();if(n<5)return 1.35;var span=S.fullMode?10:S.maxQ,confirmationStart=Math.max(7,Math.floor(span*.75));return n>=confirmationStart?.7:.9}function calibrationTarget(){var n=sectionAnswerCount(),start=S.fullMode?S.sectionBaseAbility:S.startAbility;if(n===0)return start;if(n===1)return start+1;if(n===2)return start-1;var recent=sectionRows().slice(0,Math.min(n,4)),correct=recent.filter(function(x){return x.correct}).length;if(n===3)return start+(correct>=2?2:correct===0?-2:0);if(n===4)return start+(correct>=3?2:correct<=1?-2:0);return S.ability}function antiStallTarget(target){var recent=sectionRows().slice(-3);if(recent.length<2)return target;var lastTwo=recent.slice(-2);if(lastTwo.every(function(x){return x.correct}))target+=1;else if(lastTwo.every(function(x){return !x.correct}))target-=1;if(recent.length===3&&recent.every(function(x){return x.level===recent[0].level})){var right=recent.filter(function(x){return x.correct}).length;target+=right>=2?1:-1}return target}function displayScrambleToken(text,level){var value=String(text==null?"":text);if(Number(level)<6)return value;return value.toLowerCase().replace(/^[\s“”"‘’.,!?;:()]+|[\s“”"‘’.,!?;:()]+$/g,"")}function resetSectionAbility(){S.sectionBaseAbility=clamp(S.startAbility*.7+S.ability*.3,1,10);S.ability=S.sectionBaseAbility;S.sectionQuestionCount=0;S.sectionStartAnswer=S.answers.length}function showSectionIntro(done){var section=activeSection();if(!section){done();return}var ko=document.documentElement.lang==="ko",overlay=document.createElement("div");overlay.className="section-intro-overlay";overlay.setAttribute("role","status");overlay.setAttribute("aria-live","polite");overlay.innerHTML=\'<div class="section-intro-ring"><svg viewBox="0 0 220 220" aria-hidden="true"><circle class="section-intro-track" cx="110" cy="110" r="100"></circle><circle class="section-intro-progress" cx="110" cy="110" r="100"></circle></svg><div class="section-intro-center"><span>\'+(ko?"다음 영역":"Next section")+\'</span><strong>\'+(ko?section.ko:section.en)+\'</strong></div></div>\';document.body.appendChild(overlay);setTimeout(function(){overlay.classList.add("is-leaving")},1450);setTimeout(function(){overlay.remove();done()},1750)}',
  'calibration and section helpers');

 source=replaceOnce(source,
  'function startTest(){document.body.classList.remove("welcome-mode");S.view="test";S.ability=startAbility(S.setup.years,S.setup.grade);S.maxQ=S.setup.length;',
  'function startTest(){document.body.classList.remove("welcome-mode");S.view="test";S.startAbility=startAbility(S.setup.years,S.setup.grade);S.sectionBaseAbility=S.startAbility;S.ability=S.startAbility;S.fullMode=S.setup.length===50;S.sectionIndex=0;S.sectionQuestionCount=0;S.sectionStartAnswer=0;S.maxQ=S.fullMode?50:S.setup.length;if(S.fullMode)S.setup.listening=1;',
  'start state');
 source=replaceOnce(source,
  'S.isSpeaking=false;nextQuestion()}',
  'S.isSpeaking=false;if(S.fullMode)showSectionIntro(nextQuestion);else nextQuestion()}',
  'first section intro');

 source=replaceOnce(source,
  'function pickQuestion(){var target=clamp(Math.round(S.ability),1,10),pool=bank.filter(function(q){return !S.used.has(q.id)&&(S.setup.listening===1||q.type!=="listening")});if(!pool.length)return null;var nearest=Math.min.apply(null,pool.map(function(q){return Math.abs(q.level-target)}));pool=pool.filter(function(q){return Math.abs(q.level-target)===nearest});return pool.map(function(q){return{q:q,d:typePenalty(q)+Math.random()*.45}}).sort(function(a,b){return a.d-b.d})[0].q}',
  'function pickQuestion(){var rawTarget=sectionAnswerCount()<5?calibrationTarget():antiStallTarget(S.ability),target=clamp(Math.round(rawTarget),1,10),section=S.fullMode?activeSection():null,pool=bank.filter(function(q){return !S.used.has(q.id)&&(S.setup.listening===1||q.type!=="listening")&&(!section||section.types.indexOf(q.type)>=0)});if(!pool.length)return null;var nearest=Math.min.apply(null,pool.map(function(q){return Math.abs(q.level-target)}));pool=pool.filter(function(q){return Math.abs(q.level-target)===nearest});return pool.map(function(q){return{q:q,d:typePenalty(q)+Math.random()*.45}}).sort(function(a,b){return a.d-b.d})[0].q}',
  'section question selection');

 source=replaceOnce(source,
  'function nextQuestion(){if(S.answers.length>=S.maxQ){finish();return}S.current=pickQuestion();',
  'function nextQuestion(){if(S.answers.length>=S.maxQ){finish();return}if(S.fullMode&&S.sectionQuestionCount>=10){S.sectionIndex++;if(S.sectionIndex>=fullSections().length){finish();return}resetSectionAbility();showSectionIntro(nextQuestion);return}S.current=pickQuestion();',
  'section transitions');

 source=replaceOnce(source,
  'function renderScramble(){var parts=scrambleParts(),chosen=parts.chosen,available=parts.available,meaning=S.current&&S.current.meaning||"";return \'<p class="prompt scramble-instruction">\'+tx("unscramble")+\'</p>\'+(meaning?\'<div class="scramble-meaning"><strong>\'+escText(meaning)+\'</strong></div>\':"")+\'<div class="scramble-answer \'+(chosen.length?"has-tokens":"")+\'">\'+(chosen.map(function(x,i){return \'<button class="scramble-token chosen" data-chosen="\'+i+\'">\'+escText(x.text)+\'</button>\'}).join("")||\'<span>\'+tx("tapUndo")+\'</span>\')+\'</div><div class="scramble-bank">\'+available.map(function(x){return \'<button class="scramble-token" data-uid="\'+escAttr(x.uid)+\'">\'+escText(x.text)+\'</button>\'}).join("")+\'</div>\'}',
  'function renderScramble(){var parts=scrambleParts(),chosen=parts.chosen,available=parts.available,meaning=S.current&&S.current.meaning||"",level=S.current&&S.current.level||1;return \'<p class="prompt scramble-instruction">\'+tx("unscramble")+\'</p>\'+(meaning?\'<div class="scramble-meaning"><strong>\'+escText(meaning)+\'</strong></div>\':"")+\'<div class="scramble-answer \'+(chosen.length?"has-tokens":"")+\'">\'+(chosen.map(function(x,i){return \'<button class="scramble-token chosen" data-chosen="\'+i+\'">\'+escText(displayScrambleToken(x.text,level))+\'</button>\'}).join("")||\'<span>\'+tx("tapUndo")+\'</span>\')+\'</div><div class="scramble-bank">\'+available.map(function(x){return \'<button class="scramble-token" data-uid="\'+escAttr(x.uid)+\'">\'+escText(displayScrambleToken(x.text,level))+\'</button>\'}).join("")+\'</div>\'}',
  'scramble display');

 source=replaceOnce(source,
  '<div class="question-card" data-question-level="\'+escAttr(q.level)+\'">\'+(isScramble?renderScramble():(isListening?listeningMarkup(q):\'<p class="prompt">\'+escText(q.q)+\'</p>\')',
  '<div class="question-card" data-question-id="\'+escAttr(q.id)+\'" data-question-level="\'+escAttr(q.level)+\'">\'+(isScramble?renderScramble():(isListening?listeningMarkup(q):\'<p class="prompt \'+(String(q.q||"").length>105?"prompt-long":"")+\'">\'+escText(q.q)+\'</p>\')',
  'question metadata and long prompt');

 source=replaceOnce(source,
  'function submit(){var q=S.current,isScramble=q.type==="sentence_unscramble",selectedAnswer=isScramble?S.selected.map(function(x){return x.text}):S.selected,ok=isScramble?JSON.stringify(selectedAnswer)===JSON.stringify(q.tokens):selectedAnswer===q.a,e=expected(S.ability,q.level),delta=.95*confidenceFactor()*((ok?1:0)-e);if(ok)delta*=wrongPenalty(q.level);else S.wrongByLevel[q.level]=(S.wrongByLevel[q.level]||0)+1;S.ability=clamp(S.ability+delta,1,10);',
  'function submit(){var q=S.current,isScramble=q.type==="sentence_unscramble",selectedAnswer=isScramble?S.selected.map(function(x){return x.text}):S.selected,ok=isScramble?JSON.stringify(selectedAnswer)===JSON.stringify(q.tokens):selectedAnswer===q.a,e=expected(S.ability,q.level),delta=adjustmentStrength()*((ok?1:0)-e);if(ok)delta*=wrongPenalty(q.level);else S.wrongByLevel[q.level]=(S.wrongByLevel[q.level]||0)+1;S.ability=clamp(S.ability+delta,1,10);',
  'ability update');
 source=replaceOnce(source,
  'S.answers.push({id:q.id,level:q.level,type:q.type,correct:ok,selected:selectedAnswer,answer:q.a});nextQuestion()}',
  'S.answers.push({id:q.id,level:q.level,type:q.type,correct:ok,selected:selectedAnswer,answer:q.a});if(S.fullMode)S.sectionQuestionCount++;nextQuestion()}',
  'section question count');

 var script=document.createElement('script');
 script.text=source+'\n//# sourceURL=app-classic-calibrated-full.js';
 document.head.appendChild(script);
 script.remove();
}).catch(function(error){
 console.error(error);
 var app=document.querySelector('#app');
 if(app)app.innerHTML='<section class="screen"><h2>Could not load the test</h2><p class="error">Please refresh the page.</p></section>';
});
})();