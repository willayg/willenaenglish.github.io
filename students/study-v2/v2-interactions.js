(function(){
'use strict';
var grid=document.getElementById('masteryGrid');
var mastery=document.getElementById('headerSkillMastery');
var back=document.getElementById('v2PracticeClose');
var panel=document.getElementById('v2PracticePanel');
var previous={};
var watchTimer=null;

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
function loading(on){
  if(mastery)mastery.classList.toggle('is-loading',!!on);
}
function animateFreshCards(){
  if(!grid)return false;
  var cards=Array.from(grid.querySelectorAll('[data-skill]'));
  if(!cards.length)return false;
  var changed=false;
  cards.forEach(function(card){
    var skill=card.dataset.skill,target=pct(card),fill=card.querySelector('.header-skill-master-fill');
    if(!fill)return;
    var start=Object.prototype.hasOwnProperty.call(previous,skill)?previous[skill]:0;
    if(Math.abs(start-target)>.01)changed=true;
    fill.style.transition='none';
    fill.style.width=start+'%';
    fill.offsetWidth;
    fill.style.transition='width .52s cubic-bezier(.22,.8,.24,1)';
    requestAnimationFrame(function(){fill.style.width=target+'%';});
  });
  loading(false);
  return changed||cards.length>0;
}
function watchForNewMastery(oldUnit){
  clearInterval(watchTimer);
  var tries=0;
  watchTimer=setInterval(function(){
    tries++;
    var current=document.querySelector('.study-v2-unit.is-current');
    var currentId=current&&current.dataset.unitId||'';
    var cards=grid&&grid.querySelectorAll('[data-skill]');
    if(currentId&&currentId!==oldUnit&&cards&&cards.length){
      clearInterval(watchTimer);watchTimer=null;
      requestAnimationFrame(function(){requestAnimationFrame(animateFreshCards);});
    }else if(tries>=30){
      clearInterval(watchTimer);watchTimer=null;loading(false);
    }
  },70);
}

document.addEventListener('pointerdown',function(e){
  var unit=e.target&&e.target.closest&&e.target.closest('.study-v2-unit');
  if(unit&&!unit.classList.contains('is-current')){
    snapshot();
    var current=document.querySelector('.study-v2-unit.is-current');
    var oldId=current&&current.dataset.unitId||'';
    loading(true);
    watchForNewMastery(oldId);
  }
},true);

if(back){
  back.style.touchAction='manipulation';
  back.addEventListener('pointerdown',function(){
    if(panel&&!panel.hidden){
      panel.hidden=true;
      document.body.classList.remove('study-v2-practice-mode');
    }
  },{capture:true,passive:true});
}
})();
