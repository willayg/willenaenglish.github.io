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
  /* The home shell can re-expand over several frames after a fixed practice screen closes. */
  requestAnimationFrame(function(){requestAnimationFrame(place);});
  [60,160,320].forEach(function(ms){setTimeout(place,ms);});
}
function isHomeLaunch(target){
  if(!target||!target.closest)return false;
  return !!target.closest(
    '#dailyWorkoutCard,'+
    '#masteryGrid [data-skill],'+
    '#aiChatCta .study-v2-ai-chat-cta'
  );
}
function isReturnControl(target){
  if(!target||!target.closest)return false;
  return !!target.closest('#v2PracticeClose,#aiCoachPracticeBack,.ai-coach-practice-back');
}

/* Capture the page position before any full-screen Study V2 learning route can collapse the home layout. */
document.addEventListener('pointerdown',function(e){
  if(isHomeLaunch(e.target))saveHomePosition();
},true);
document.addEventListener('click',function(e){
  /* Keyboard/assistive activation may not emit pointerdown. */
  if(isHomeLaunch(e.target))saveHomePosition();
  if(isReturnControl(e.target))restoreHomePosition();
},true);

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
