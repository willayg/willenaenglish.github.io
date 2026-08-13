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
var rewardAnimationStarted=false;

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

function installBonusStyles(){
 if(document.getElementById('willenaBonusRevealStyles'))return;
 var style=document.createElement('style');
 style.id='willenaBonusRevealStyles';
 style.textContent='.reward-number.willena-bonus-shake{animation:willenaBonusShake .48s ease-in-out!important}.reward-number.willena-bonus-pop{animation:willenaBonusPop .58s cubic-bezier(.18,.9,.25,1.35)!important}.willena-target-hit{height:28px;margin:2px 0 10px;font-size:14px;font-weight:900;letter-spacing:.15em;color:#f0a323;opacity:0;transform:translateY(7px)}.willena-target-hit.show{animation:willenaTargetIn .25s ease forwards}.willena-bonus-particle{--a:0deg;--d:110px;position:absolute;left:50%;top:49%;width:7px;height:17px;border-radius:5px;background:currentColor;opacity:0;z-index:4;pointer-events:none;animation:willenaBonusBurst .75s ease-out forwards}.willena-bonus-particle:nth-child(3n+1){color:#20b9c5}.willena-bonus-particle:nth-child(3n+2){color:#f2b13b}.willena-bonus-particle:nth-child(3n+3){color:#6d79da}@keyframes willenaBonusShake{0%,100%{transform:translateX(0) rotate(0)}15%{transform:translateX(-3px) rotate(-1deg)}30%{transform:translateX(4px) rotate(1deg)}45%{transform:translateX(-5px) rotate(-1deg)}60%{transform:translateX(5px) rotate(1deg)}75%{transform:translateX(-3px) rotate(-.5deg)}}@keyframes willenaBonusPop{0%{transform:scale(.62);opacity:.45}55%{transform:scale(1.22);opacity:1}75%{transform:scale(.94)}100%{transform:scale(1)}}@keyframes willenaTargetIn{to{opacity:1;transform:translateY(0)}}@keyframes willenaBonusBurst{0%{opacity:1;transform:translate(-50%,-50%) rotate(var(--a)) translateY(-18px) scale(.5)}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--a)) translateY(calc(var(--d) * -1)) rotate(180deg) scale(1)}}';
 document.head.appendChild(style);
}

function makeBonusBurst(reward){
 var holder=reward.querySelector('.reward-points')||reward;
 for(var i=0;i<24;i++){
  var p=document.createElement('span');
  p.className='willena-bonus-particle';
  p.style.setProperty('--a',((360/24)*i)+'deg');
  p.style.setProperty('--d',(85+Math.random()*65)+'px');
  p.style.animationDelay=(Math.random()*70)+'ms';
  holder.appendChild(p);
  setTimeout(function(el){if(el&&el.parentNode)el.parentNode.removeChild(el)},1000,p);
 }
}

function ensureRewardActions(reward){
 if(reward.querySelector('.reward-retry'))return;
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

function animateConfirmedReward(reward,q,delta){
 if(rewardAnimationStarted)return;
 rewardAnimationStarted=true;
 installBonusStyles();
 var hit=Boolean(q&&delta===q*2);
 var base=q?Math.round(q/2):delta;
 var number=reward.querySelector('.reward-number');
 var target=reward.querySelector('.reward-target');
 if(target)target.style.display='none';
 var note=reward.querySelector('.reward-note');
 ensureRewardActions(reward);
 if(!number)return;

 if(!hit){
  setTimeout(function(){number.textContent=String(delta);if(note)note.textContent='Nice job! Wanna try again?'},1050);
  return;
 }

 if(note)note.textContent='Nice job!';
 setTimeout(function(){
  number.textContent=String(base);
  var hitLabel=document.createElement('div');
  hitLabel.className='willena-target-hit';
  hitLabel.textContent='TARGET HIT';
  var points=reward.querySelector('.reward-points');
  if(points)points.insertAdjacentElement('afterend',hitLabel);
  setTimeout(function(){hitLabel.classList.add('show')},180);
  setTimeout(function(){number.classList.add('willena-bonus-shake')},300);
  setTimeout(function(){
   number.classList.remove('willena-bonus-shake');
   makeBonusBurst(reward);
   number.textContent=String(delta);
   number.classList.add('willena-bonus-pop');
   if(note)note.textContent='Wow, you did awesome!';
   setTimeout(function(){number.classList.remove('willena-bonus-pop')},700);
  },850);
 },1080);
}

function polishInternalReward(){
 if(!internalLevelTest)return;
 var reward=root.querySelector('.reward-card');
 if(!reward)return;
 var q=questionCountFromFinish();
 var delta=typeof awardedDelta==='number'?awardedDelta:null;
 var target=reward.querySelector('.reward-target');
 if(target)target.style.display='none';
 ensureRewardActions(reward);
 if(delta!==null)animateConfirmedReward(reward,q,delta);
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
  rewardAnimationStarted=false;
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