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
  'var S={view:"setup",setupStep:0,setup:{grade:null,years:null,listening:null,length:null},ability:2,startAbility:2,maxQ:30,used:new Set(),answers:[],current:null,selected:null,scramblePool:[],wrongByLevel:{},typeCounts:{},lowLevelCounts:{total:0,grammar:0},translationCount:0,playsLeft:0,isSpeaking:false};',
  'state');

 source=replaceOnce(source,
  'function startAbility(years,grade){var yearBase={0:1,1:1.8,2:2.7,4:4,6:5.3},stageAdjustment={1:0,2:0,4:.25,6:.5,8:.75,9:1};return clamp((yearBase[Number(years)]==null?1:yearBase[Number(years)])+(stageAdjustment[Number(grade)]==null?0:stageAdjustment[Number(grade)]),1,7)}',
  'function startAbility(years,grade){var matrix={1:{0:1,1:1.5,2:2,4:2.5,6:3},2:{0:1,1:2,2:3,4:4,6:5},4:{0:1.5,1:2.5,2:4,4:5.5,6:6.5},6:{0:2,1:3,2:4.5,4:6,6:7.5},8:{0:2.5,1:3.5,2:5,4:7,6:8.5},9:{0:3,1:4,2:5.5,4:7.5,6:9}},stage=matrix[Number(grade)]||matrix[1],value=stage[Number(years)];return clamp(value==null?1:value,1,10)}',
  'starting matrix');

 source=replaceOnce(source,
  'function wrongPenalty(level){return Math.pow(.8,S.wrongByLevel[level]||0)}',
  'function wrongPenalty(level){return Math.pow(.8,S.wrongByLevel[level]||0)}function adjustmentStrength(){var n=S.answers.length;if(n<5)return 1.35;var confirmationStart=Math.max(15,Math.floor(S.maxQ*.75));return n>=confirmationStart?.7:.9}function calibrationTarget(){var n=S.answers.length,start=S.startAbility;if(n===0)return start;if(n===1)return start+1;if(n===2)return start-1;var recent=S.answers.slice(0,Math.min(n,4)),correct=recent.filter(function(x){return x.correct}).length;if(n===3)return start+(correct>=2?2:correct===0?-2:0);if(n===4)return start+(correct>=3?2:correct<=1?-2:0);return S.ability}function antiStallTarget(target){var recent=S.answers.slice(-3);if(recent.length<2)return target;var lastTwo=recent.slice(-2);if(lastTwo.every(function(x){return x.correct}))target+=1;else if(lastTwo.every(function(x){return !x.correct}))target-=1;if(recent.length===3&&recent.every(function(x){return x.level===recent[0].level})){var right=recent.filter(function(x){return x.correct}).length;target+=right>=2?1:-1}return target}',
  'calibration helpers');

 source=replaceOnce(source,
  'function startTest(){document.body.classList.remove("welcome-mode");S.view="test";S.ability=startAbility(S.setup.years,S.setup.grade);S.maxQ=S.setup.length;',
  'function startTest(){document.body.classList.remove("welcome-mode");S.view="test";S.startAbility=startAbility(S.setup.years,S.setup.grade);S.ability=S.startAbility;S.maxQ=S.setup.length;',
  'start state');

 source=replaceOnce(source,
  'function pickQuestion(){var target=clamp(Math.round(S.ability),1,10),pool=bank.filter(function(q){return !S.used.has(q.id)&&(S.setup.listening===1||q.type!=="listening")});if(!pool.length)return null;var nearest=Math.min.apply(null,pool.map(function(q){return Math.abs(q.level-target)}));pool=pool.filter(function(q){return Math.abs(q.level-target)===nearest});return pool.map(function(q){return{q:q,d:typePenalty(q)+Math.random()*.45}}).sort(function(a,b){return a.d-b.d})[0].q}',
  'function pickQuestion(){var rawTarget=S.answers.length<5?calibrationTarget():antiStallTarget(S.ability),target=clamp(Math.round(rawTarget),1,10),pool=bank.filter(function(q){return !S.used.has(q.id)&&(S.setup.listening===1||q.type!=="listening")});if(!pool.length)return null;var nearest=Math.min.apply(null,pool.map(function(q){return Math.abs(q.level-target)}));pool=pool.filter(function(q){return Math.abs(q.level-target)===nearest});return pool.map(function(q){return{q:q,d:typePenalty(q)+Math.random()*.45}}).sort(function(a,b){return a.d-b.d})[0].q}',
  'question selection');

 source=replaceOnce(source,
  'function submit(){var q=S.current,isScramble=q.type==="sentence_unscramble",selectedAnswer=isScramble?S.selected.map(function(x){return x.text}):S.selected,ok=isScramble?JSON.stringify(selectedAnswer)===JSON.stringify(q.tokens):selectedAnswer===q.a,e=expected(S.ability,q.level),delta=.95*confidenceFactor()*((ok?1:0)-e);if(ok)delta*=wrongPenalty(q.level);else S.wrongByLevel[q.level]=(S.wrongByLevel[q.level]||0)+1;S.ability=clamp(S.ability+delta,1,10);',
  'function submit(){var q=S.current,isScramble=q.type==="sentence_unscramble",selectedAnswer=isScramble?S.selected.map(function(x){return x.text}):S.selected,ok=isScramble?JSON.stringify(selectedAnswer)===JSON.stringify(q.tokens):selectedAnswer===q.a,e=expected(S.ability,q.level),delta=adjustmentStrength()*((ok?1:0)-e);if(ok)delta*=wrongPenalty(q.level);else S.wrongByLevel[q.level]=(S.wrongByLevel[q.level]||0)+1;S.ability=clamp(S.ability+delta,1,10);',
  'ability update');

 var script=document.createElement('script');
 script.text=source+'\n//# sourceURL=app-classic-calibrated.js';
 document.head.appendChild(script);
 script.remove();
}).catch(function(error){
 console.error(error);
 var app=document.querySelector('#app');
 if(app)app.innerHTML='<section class="screen"><h2>Could not load the test</h2><p class="error">Please refresh the page.</p></section>';
});
})();