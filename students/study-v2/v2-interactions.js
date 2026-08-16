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

/* Chapter Markers book hub + final tablet layout authority. */
(function(){
'use strict';

var style=document.createElement('style');
style.id='study-v2-book-chapters-tablet-fix';
style.textContent=`
/* Preserve the actual page hierarchy: Daily Study -> AI Coach -> Book. */
.book-hero.daily-inline .study-v2-top-actions{order:1!important}
.book-hero.daily-inline .study-v2-ai{order:2!important}
.book-hero.daily-inline .study-v2-book-hub{order:3!important}

.study-v2-book-hub{
  position:relative;
  margin:0 0 34px!important;
  border:3px solid var(--arcade-cyan,#21b3be)!important;
  border-radius:30px!important;
  background:#fff!important;
  box-shadow:0 10px 30px rgba(38,74,79,.06)!important;
  overflow:hidden!important;
  scroll-margin-top:18px;
}
.study-v2-book-hub-marker-row{
  display:flex;
  align-items:stretch;
  min-height:96px;
  border-bottom:1px solid #dce8ea;
  background:#fff;
}
.study-v2-book-hub-copy{
  flex:1;
  min-width:0;
  padding:18px 22px;
}
.study-v2-book-hub-kicker{
  display:block;
  margin:0 0 4px;
  color:var(--arcade-cyan,#21b3be);
  font-size:.68rem;
  line-height:1;
  font-weight:900;
  letter-spacing:.14em;
}
.study-v2-book-hub-title{
  display:block;
  margin:0;
  color:#244d53;
  font-size:1.38rem;
  line-height:1.12;
  font-weight:900;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.study-v2-book-hub-unit{
  display:block;
  margin-top:6px;
  color:#7c8c91;
  font-size:.78rem;
  line-height:1.3;
  font-weight:750;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.study-v2-book-hub-markers{
  display:grid;
  grid-template-columns:1fr 1fr;
  min-width:300px;
}
.study-v2-book-mode-marker{
  position:relative;
  border:0;
  border-left:1px solid #dce8ea;
  background:#fff;
  color:#74888d;
  padding:0 20px;
  font:900 .76rem/1.2 Poppins,sans-serif;
  letter-spacing:.035em;
  cursor:pointer;
}
.study-v2-book-mode-marker:after{
  content:"";
  position:absolute;
  left:0;
  right:0;
  bottom:0;
  height:4px;
  background:transparent;
}
.study-v2-book-mode-marker.is-active{
  background:#eefafb;
  color:var(--arcade-cyan,#21b3be);
}
.study-v2-book-mode-marker.is-active:after{background:var(--arcade-cyan,#21b3be)}
.study-v2-book-mode-marker:focus-visible{outline:3px solid rgba(33,179,190,.22);outline-offset:-3px}
.study-v2-book-hub>.study-v2-book-study-panel,
.study-v2-book-hub>.study-v2-book-panel{
  margin:0!important;
  border:0!important;
  border-radius:0!important;
  box-shadow:none!important;
  background:#fff!important;
}
.study-v2-book-hub>.study-v2-book-study-panel>.study-v2-section-heading,
.study-v2-book-hub>.study-v2-book-panel>.study-v2-section-heading{display:none!important}

@media (max-width:700px){
  .study-v2-book-hub{border-width:2px!important;border-radius:22px!important}
  .study-v2-book-hub-marker-row{display:block;min-height:0}
  .study-v2-book-hub-copy{padding:16px 15px 14px}
  .study-v2-book-hub-title{font-size:1.12rem}
  .study-v2-book-hub-unit{font-size:.72rem}
  .study-v2-book-hub-markers{min-width:0;height:50px;border-top:1px solid #dce8ea}
  .study-v2-book-mode-marker{border-left:0;padding:0 10px;font-size:.7rem}
  .study-v2-book-mode-marker+.study-v2-book-mode-marker{border-left:1px solid #dce8ea}
}

/* Tablet: compact aligned composition. Daily stays first without swallowing the screen. */
@media (min-width:760px) and (max-width:1024px){
  .book-hero.daily-inline .study-v2-top-actions{
    display:grid!important;
    grid-template-columns:270px repeat(3,minmax(0,1fr))!important;
    grid-template-rows:minmax(178px,auto) 82px!important;
    align-items:stretch!important;
    column-gap:12px!important;
    row-gap:12px!important;
  }
  .book-hero.daily-inline #dailyWorkoutCard.study-v2-daily-primary{
    grid-column:1!important;
    grid-row:1 / span 2!important;
    align-self:stretch!important;
    min-height:272px!important;
    padding:22px 20px 18px!important;
  }
  .book-hero.daily-inline .daily-rail-main{
    grid-column:2 / 5!important;
    grid-row:1!important;
    align-self:stretch!important;
    width:auto!important;
    min-width:0!important;
    min-height:0!important;
    height:auto!important;
    margin:0!important;
    padding:24px 24px 16px!important;
  }
  .book-hero.daily-inline #practiceHeroBtn{
    grid-column:2!important;
    grid-row:2!important;
  }
  .book-hero.daily-inline #bookStudyBtn{
    grid-column:3!important;
    grid-row:2!important;
  }
  .book-hero.daily-inline #bookPracticeBtn{
    grid-column:4!important;
    grid-row:2!important;
  }
  .book-hero.daily-inline .study-v2-top-actions>.study-v2-action-card:not(#dailyWorkoutCard){
    align-self:stretch!important;
    width:100%!important;
    min-width:0!important;
    min-height:82px!important;
    margin:0!important;
    padding:11px 12px!important;
  }
  .book-hero.daily-inline #dailyWorkoutCard.study-v2-daily-primary .progress-ring{
    width:176px!important;
    height:176px!important;
    min-width:176px!important;
    flex:0 0 176px!important;
    margin:18px auto 0!important;
    box-shadow:0 0 0 6px rgba(255,111,176,.06)!important;
  }
  .book-hero.daily-inline #dailyWorkoutCard.study-v2-daily-primary .progress-ring:after{inset:19px!important}
  .book-hero.daily-inline #dailyWorkoutCard.study-v2-daily-primary .progress-ring span{
    font-size:1.5rem!important;
    line-height:1!important;
  }
  .book-hero.daily-inline #dailyWorkoutCard.study-v2-daily-primary strong{
    font-size:1.9rem!important;
    line-height:1.03!important;
  }
  .book-hero.daily-inline .daily-rail-progress{
    width:100%!important;
    margin-top:18px!important;
  }
  .book-hero.daily-inline .daily-rail-headline{font-size:1.65rem!important}
  .book-hero.daily-inline .daily-rail-sub{font-size:.94rem!important}
}
`;
document.head.appendChild(style);

function initBookHub(){
  var study=document.getElementById('bookStudyArea');
  var practice=document.getElementById('bookPracticeArea');
  if(!study||!practice||document.querySelector('.study-v2-book-hub'))return;

  var hub=document.createElement('section');
  hub.className='study-v2-book-hub';
  hub.setAttribute('aria-label','Book Study and Practice');

  var markerRow=document.createElement('div');
  markerRow.className='study-v2-book-hub-marker-row';
  markerRow.innerHTML='<div class="study-v2-book-hub-copy"><span class="study-v2-book-hub-kicker">BOOK</span><strong class="study-v2-book-hub-title">교재</strong><small class="study-v2-book-hub-unit">현재 단원</small></div><div class="study-v2-book-hub-markers" role="tablist" aria-label="Book mode"><button class="study-v2-book-mode-marker is-active" type="button" role="tab" aria-selected="true" data-book-mode="study">01 · STUDY</button><button class="study-v2-book-mode-marker" type="button" role="tab" aria-selected="false" data-book-mode="practice">02 · PRACTICE</button></div>';

  study.parentNode.insertBefore(hub,study);
  hub.appendChild(markerRow);
  hub.appendChild(study);
  hub.appendChild(practice);

  var titleOut=hub.querySelector('.study-v2-book-hub-title');
  var unitOut=hub.querySelector('.study-v2-book-hub-unit');
  var sourceTitle=document.getElementById('bookTitle');
  var sourceUnit=document.getElementById('unitTitle');

  function syncHeader(){
    var t=String(sourceTitle&&sourceTitle.textContent||'').trim();
    var u=String(sourceUnit&&sourceUnit.textContent||'').trim();
    if(titleOut)titleOut.textContent=t&&t!=='Loading…'?t:'교재';
    if(unitOut)unitOut.textContent=u&&u!=='Finding your assigned unit'?u:'현재 단원';
  }

  function setMode(mode,scroll){
    var isPractice=mode==='practice';
    study.style.setProperty('display',isPractice?'none':'block','important');
    practice.style.setProperty('display',isPractice?'block':'none','important');
    hub.dataset.mode=isPractice?'practice':'study';
    hub.querySelectorAll('[data-book-mode]').forEach(function(btn){
      var active=btn.dataset.bookMode===mode;
      btn.classList.toggle('is-active',active);
      btn.setAttribute('aria-selected',active?'true':'false');
    });
    if(scroll)hub.scrollIntoView({behavior:'smooth',block:'start'});
  }

  hub.querySelectorAll('[data-book-mode]').forEach(function(btn){
    btn.addEventListener('click',function(){setMode(btn.dataset.bookMode,false);});
  });

  var studyLaunch=document.getElementById('bookStudyBtn');
  var practiceLaunch=document.getElementById('bookPracticeBtn');
  if(studyLaunch)studyLaunch.addEventListener('click',function(){setTimeout(function(){setMode('study',true);},0);});
  if(practiceLaunch)practiceLaunch.addEventListener('click',function(){setTimeout(function(){setMode('practice',true);},0);});

  if(sourceTitle){new MutationObserver(syncHeader).observe(sourceTitle,{childList:true,characterData:true,subtree:true});}
  if(sourceUnit){new MutationObserver(syncHeader).observe(sourceUnit,{childList:true,characterData:true,subtree:true});}
  syncHeader();
  setMode('study',false);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initBookHub,{once:true});
else initBookHub();
})();
