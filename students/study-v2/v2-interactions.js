(function(){
'use strict';
var grid=document.getElementById('masteryGrid');
var mastery=document.getElementById('headerSkillMastery');
var back=document.getElementById('v2PracticeClose');
var panel=document.getElementById('v2PracticePanel');
var previous={};
var watchTimer=null;
var initialTimer=null;
var backClosing=false;
var initialStarted=false;
var HOME_SCROLL_KEY='willena-study-v2-home-scroll:v1';
var rememberedHomeY=null;
var sessionHistoryArmed=false;
var sessionEverActive=false;
var suppressPop=false;
var leavePromptOpen=false;

function pct(card){
  var el=card&&card.querySelector('.header-skill-master-pct');
  var n=parseFloat(String(el&&el.textContent||'').replace('%',''));
  return Number.isFinite(n)?Math.max(0,Math.min(100,n)):0;
}
function snapshot(){
  previous={};
  if(!grid)return;
  grid.querySelectorAll('[data-skill]').forEach(function(card){previous[card.dataset.skill]=pct(card);});
}
function loading(on){if(mastery)mastery.classList.toggle('is-loading',!!on);}
function animateFreshCards(fromFull){
  if(!grid)return false;
  var cards=Array.from(grid.querySelectorAll('[data-skill]'));
  if(!cards.length)return false;
  cards.forEach(function(card){
    var skill=card.dataset.skill,target=pct(card),fill=card.querySelector('.header-skill-master-fill');
    if(!fill)return;
    var start=fromFull?100:(Object.prototype.hasOwnProperty.call(previous,skill)?previous[skill]:0);
    fill.style.transition='none';
    fill.style.width=start+'%';
    fill.offsetWidth;
    fill.style.transition='width .52s cubic-bezier(.22,.8,.24,1)';
    requestAnimationFrame(function(){fill.style.width=target+'%';});
  });
  loading(false);
  return true;
}
function watchForLoadedMastery(firstNode){
  clearInterval(watchTimer);
  var tries=0,interimNode=null;
  watchTimer=setInterval(function(){
    tries++;
    var node=grid&&grid.firstElementChild;
    if(node&&node!==firstNode){
      if(!interimNode)interimNode=node;
      else if(node!==interimNode){
        clearInterval(watchTimer);watchTimer=null;
        requestAnimationFrame(function(){requestAnimationFrame(function(){animateFreshCards(false);});});
        return;
      }
    }
    if(tries>=32){
      clearInterval(watchTimer);watchTimer=null;
      if(node)animateFreshCards(false);else loading(false);
    }
  },70);
}
function watchInitialCache(firstNode){
  clearInterval(initialTimer);
  var tries=0;
  loading(true);
  initialTimer=setInterval(function(){
    tries++;
    var node=grid&&grid.firstElementChild;
    if(node&&node!==firstNode){
      clearInterval(initialTimer);initialTimer=null;
      requestAnimationFrame(function(){requestAnimationFrame(function(){animateFreshCards(true);});});
      return;
    }
    if(tries>=120){
      clearInterval(initialTimer);initialTimer=null;
      loading(false);
    }
  },50);
}
function waitForInitialCards(){
  if(!grid||initialStarted)return;
  var tries=0;
  var timer=setInterval(function(){
    tries++;
    var first=grid.firstElementChild;
    if(first){
      clearInterval(timer);
      initialStarted=true;
      watchInitialCache(first);
    }else if(tries>=120){
      clearInterval(timer);
    }
  },25);
}

function saveHomePosition(){
  var y=Math.max(0,Math.round(window.scrollY||window.pageYOffset||0));
  rememberedHomeY=y;
  try{sessionStorage.setItem(HOME_SCROLL_KEY,String(y));}catch(_){}
}
function readHomePosition(){
  if(Number.isFinite(rememberedHomeY))return rememberedHomeY;
  try{
    var raw=sessionStorage.getItem(HOME_SCROLL_KEY),n=Number(raw);
    if(Number.isFinite(n))return Math.max(0,n);
  }catch(_){}
  return 0;
}
function restoreHomePosition(){
  var y=readHomePosition();
  function place(){
    try{window.scrollTo({top:y,left:0,behavior:'auto'});}catch(_){window.scrollTo(0,y);}
  }
  requestAnimationFrame(function(){requestAnimationFrame(place);});
  [60,160,320].forEach(function(ms){setTimeout(place,ms);});
}
function isHomeLaunch(target){
  if(!target||!target.closest)return false;
  return !!target.closest('#dailyWorkoutCard,#masteryGrid [data-skill],#aiChatCta .study-v2-ai-chat-cta');
}
function isReturnControl(target){
  if(!target||!target.closest)return false;
  return !!target.closest('#v2PracticeClose,#aiCoachPracticeBack,.ai-coach-practice-back,#v2DailyHome');
}
function activeSessionType(){
  if(document.getElementById('aiCoachPracticeOverlay'))return'ai';
  if(document.body.classList.contains('study-v2-daily-mode')&&panel&&!panel.hidden)return'daily';
  if(document.body.classList.contains('study-v2-practice-mode')&&panel&&!panel.hidden)return'skill';
  return'';
}
function closeActiveSession(type){
  if(type==='ai'&&window.WillenaStudyV2AIPractice&&typeof window.WillenaStudyV2AIPractice.close==='function'){
    window.WillenaStudyV2AIPractice.close(false);
  }else if(type==='daily'&&window.WillenaStudyV2Daily&&typeof window.WillenaStudyV2Daily.close==='function'){
    window.WillenaStudyV2Daily.close();
  }else if(type==='skill'&&back){
    back.click();
  }
  restoreHomePosition();
}
function ensureLeavePromptStyles(){
  if(document.getElementById('v2LeaveSessionStyle'))return;
  var style=document.createElement('style');
  style.id='v2LeaveSessionStyle';
  style.textContent='.v2-leave-session-shade{position:fixed;inset:0;z-index:30000;display:grid;place-items:center;padding:22px;background:rgba(19,36,41,.42);backdrop-filter:blur(5px)}.v2-leave-session-box{width:min(420px,100%);padding:24px;border:1px solid #dce7e9;border-radius:24px;background:#fff;box-shadow:0 22px 55px rgba(18,35,40,.22);font-family:Poppins,sans-serif}.v2-leave-session-box h3{margin:0 0 9px;color:#294950;font-size:1.25rem;line-height:1.35}.v2-leave-session-box p{margin:0;color:#6d8085;font-size:.96rem;line-height:1.55;font-weight:650}.v2-leave-session-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:22px}.v2-leave-session-actions button{min-height:54px;padding:12px 14px;border-radius:16px;font:800 .96rem/1.2 Poppins,sans-serif;cursor:pointer}.v2-leave-stay{border:2px solid #25b8c4;background:#eefafb;color:#176f78}.v2-leave-go{border:2px solid #e4e8e9;background:#fff;color:#64757a}@media(max-width:520px){.v2-leave-session-box{padding:21px;border-radius:21px}.v2-leave-session-actions{grid-template-columns:1fr}.v2-leave-session-actions button{min-height:56px}}';
  document.head.appendChild(style);
}
function askLeaveSession(onStay,onLeave){
  if(leavePromptOpen)return;
  leavePromptOpen=true;
  ensureLeavePromptStyles();
  var shade=document.createElement('div');
  shade.className='v2-leave-session-shade';
  shade.setAttribute('role','dialog');
  shade.setAttribute('aria-modal','true');
  shade.setAttribute('aria-labelledby','v2LeaveTitle');
  shade.innerHTML='<div class="v2-leave-session-box"><h3 id="v2LeaveTitle">학습을 종료하고 돌아가시겠어요?</h3><p>현재 진행 중인 학습은 여기서 종료됩니다.</p><div class="v2-leave-session-actions"><button class="v2-leave-stay" type="button">계속 학습하기</button><button class="v2-leave-go" type="button">나가기</button></div></div>';
  document.body.appendChild(shade);
  function done(fn){shade.remove();leavePromptOpen=false;if(fn)fn();}
  shade.querySelector('.v2-leave-stay').addEventListener('click',function(){done(onStay);});
  shade.querySelector('.v2-leave-go').addEventListener('click',function(){done(onLeave);});
  shade.querySelector('.v2-leave-stay').focus();
}
function armSessionHistory(){
  if(sessionHistoryArmed)return;
  saveHomePosition();
  try{
    history.pushState(Object.assign({},history.state||{},{willenaStudySession:true}),'',location.href);
    sessionHistoryArmed=true;
    sessionEverActive=false;
    setTimeout(function(){
      if(sessionHistoryArmed&&!sessionEverActive&&!activeSessionType())disarmSessionHistory();
    },900);
  }catch(_){}
}
function disarmSessionHistory(){
  if(!sessionHistoryArmed)return;
  sessionHistoryArmed=false;
  sessionEverActive=false;
  suppressPop=true;
  try{history.back();}catch(_){suppressPop=false;}
}

/* Save home position and create one temporary history entry before entering a full-screen learning route. */
document.addEventListener('pointerdown',function(e){
  if(isHomeLaunch(e.target)){
    saveHomePosition();
    armSessionHistory();
  }
},true);
document.addEventListener('click',function(e){
  if(isHomeLaunch(e.target)){
    saveHomePosition();
    if(!sessionHistoryArmed)armSessionHistory();
  }
  if(isReturnControl(e.target))restoreHomePosition();
},true);

window.addEventListener('popstate',function(){
  if(suppressPop){suppressPop=false;return;}
  var type=activeSessionType();
  if(!sessionHistoryArmed||!type)return;
  sessionHistoryArmed=false;
  askLeaveSession(function(){
    try{history.pushState(Object.assign({},history.state||{},{willenaStudySession:true}),'',location.href);sessionHistoryArmed=true;sessionEverActive=true;}catch(_){}
  },function(){
    sessionEverActive=false;
    closeActiveSession(type);
  });
});

/* If a session closes through its own on-screen Back/Finish control, remove our temporary history entry silently. */
var sessionObserver=new MutationObserver(function(){
  var active=!!activeSessionType();
  if(active){sessionEverActive=true;return;}
  if(sessionHistoryArmed&&sessionEverActive)disarmSessionHistory();
});
sessionObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});

document.addEventListener('pointerdown',function(e){
  var unit=e.target&&e.target.closest&&e.target.closest('.study-v2-unit');
  if(unit&&!unit.classList.contains('is-current')){
    snapshot();
    loading(true);
    watchForLoadedMastery(grid&&grid.firstElementChild);
  }
},true);

if(back){
  back.style.touchAction='manipulation';
  back.addEventListener('pointerdown',function(e){
    if(backClosing||!panel||panel.hidden)return;
    backClosing=true;
    panel.hidden=true;
    document.body.classList.remove('study-v2-practice-mode');
    e.preventDefault();
    setTimeout(function(){
      back.click();
      backClosing=false;
    },0);
  },{capture:true});
}

waitForInitialCards();
})();
