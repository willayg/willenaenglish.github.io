(function(){
'use strict';
if(location.hostname.indexOf('staging.')!==0)return;
var root=document.querySelector('#app');
var header=document.querySelector('.app-header');
if(!root||!header)return;
var internalLevelTest=location.pathname.indexOf('/students/level-test/')>=0;
var pointsBefore=null;
var awardedDelta=null;
var finishEvent=null;
var pointsCheckRunning=false;

function moveTools(){
 var card=root.querySelector('.question-card[data-question-id]');
 if(!card)return;
 var tools=card.querySelector('.question-feedback-tools:not(.question-feedback-sentinel)');
 if(!tools)return;
 var old=header.querySelector('.question-feedback-tools');
 if(old&&old!==tools)old.remove();
 tools.classList.add('question-feedback-header-tools');
 header.insertBefore(tools,header.firstChild);
 var sentinel=document.createElement('span');
 sentinel.className='question-feedback-tools question-feedback-sentinel';
 sentinel.hidden=true;
 card.appendChild(sentinel);
}

async function fetchPointsTotal(){
 if(!internalLevelTest||!window.WillenaAPI||typeof WillenaAPI.fetch!=='function')return null;
 try{
  var response=await WillenaAPI.fetch('/.netlify/functions/count_true_attempts?_='+Date.now(),{credentials:'include',cache:'no-store'});
  var data=await response.json().catch(function(){return{}});
  if(!response.ok)return null;
  if(typeof data.points==='number')return data.points;
  if(typeof data.correct==='number')return data.correct;
 }catch(_){}
 return null;
}

async function rememberPointsBefore(){
 var total=await fetchPointsTotal();
 if(typeof total==='number')pointsBefore=total;
}

function showPointsLoading(){
 if(!internalLevelTest)return;
 document.documentElement.classList.remove('willena-internal-finishing');
 root.innerHTML='<section class="student-complete"><div class="student-complete-card"><h1>포인트를 불러오는 중이에요</h1><p>잠시만 기다려 주세요.</p><div style="width:44px;height:44px;margin:22px auto 0;border:5px solid #dceff1;border-top-color:#20b9c5;border-radius:50%;animation:willenaPointsSpin .8s linear infinite"></div></div></section>';
 if(!document.getElementById('willenaPointsLoadingStyle')){
  var style=document.createElement('style');
  style.id='willenaPointsLoadingStyle';
  style.textContent='@keyframes willenaPointsSpin{to{transform:rotate(360deg)}}';
  document.head.appendChild(style);
 }
}

function questionCountFromFinish(){
 var detail=finishEvent&&finishEvent.detail||{};
 var attempt=detail.result&&detail.result.attempt||{};
 var q=Number(attempt.total_questions)||Number(detail.answered_count)||0;
 return [20,30,40,50].indexOf(q)>=0?q:0;
}

function polishInternalReward(){
 if(!internalLevelTest)return;
 var reward=root.querySelector('.reward-card');
 if(!reward)return;
 var q=questionCountFromFinish();
 var delta=typeof awardedDelta==='number'?awardedDelta:null;
 var hit=Boolean(q&&delta===q*2);
 var number=reward.querySelector('.reward-number');
 if(number&&delta!==null)number.textContent=String(delta);
 var target=reward.querySelector('.reward-target');
 if(target)target.style.display='none';
 var note=reward.querySelector('.reward-note');
 if(note)note.textContent=hit?'Wow, you did awesome!':'Nice job! Wanna try again?';
 if(!reward.querySelector('.reward-retry')){
  var home=reward.querySelector('.reward-home');
  var actions=document.createElement('div');
  actions.className='reward-actions';
  actions.style.cssText='display:flex;gap:12px;justify-content:center;flex-wrap:wrap';
  var retry=document.createElement('a');
  retry.className='reward-home reward-retry';
  retry.href='/students/level-test/';
  retry.textContent='Try again';
  retry.style.background='#20b9c5';
  if(home){home.parentNode.insertBefore(actions,home);actions.appendChild(retry);actions.appendChild(home)}
  else{actions.appendChild(retry);reward.appendChild(actions)}
 }
}

async function resolveAwardedPoints(){
 if(pointsCheckRunning)return;
 pointsCheckRunning=true;
 if(typeof pointsBefore!=='number')await rememberPointsBefore();
 var start=Date.now();
 while(Date.now()-start<10000){
  var total=await fetchPointsTotal();
  if(typeof total==='number'&&typeof pointsBefore==='number'&&total>pointsBefore){
   awardedDelta=total-pointsBefore;
   try{window.dispatchEvent(new CustomEvent('points:update',{detail:{total:total}}))}catch(_){}
   polishInternalReward();
   pointsCheckRunning=false;
   return;
  }
  await new Promise(function(resolve){setTimeout(resolve,300)});
 }
 pointsCheckRunning=false;
}

if(internalLevelTest){
 rememberPointsBefore();
 window.addEventListener('willena:student-ready',function(){rememberPointsBefore()});
 window.addEventListener('willena:recording-finished',function(event){
  finishEvent=event;
  showPointsLoading();
  resolveAwardedPoints();
 });
}

var pending=false;
function schedule(){
 if(pending)return;
 pending=true;
 requestAnimationFrame(function(){
  pending=false;
  moveTools();
  polishInternalReward();
 });
}
new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
schedule();
})();