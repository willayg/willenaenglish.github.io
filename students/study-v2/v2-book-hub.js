(function(){
'use strict';
var hub=document.getElementById('bookHub');
if(!hub)return;
var tabs=hub.querySelectorAll('[data-book-mode]');
var study=document.getElementById('bookStudyArea');
var practice=document.getElementById('bookPracticeArea');
var studyBtn=document.getElementById('bookStudyBtn');
var practiceBtn=document.getElementById('bookPracticeBtn');
var langBtn=document.getElementById('languageBtn');
var unitStrip=document.getElementById('unitStrip');
var studyContent=document.getElementById('bookStudyContent');
var mode='study';
var switchTimer=0;
var switching=false;

function ko(){return !langBtn||String(langBtn.textContent||'').trim()==='English';}
function labels(){
  tabs.forEach(function(b){
    var m=b.getAttribute('data-book-mode');
    b.textContent=m==='study'?(ko()?'공부':'Study'):(ko()?'연습':'Practice');
  });
}
function setMode(next,scroll){
  mode=next==='practice'?'practice':'study';
  tabs.forEach(function(b){
    var on=b.getAttribute('data-book-mode')===mode;
    b.classList.toggle('is-active',on);
    b.setAttribute('aria-selected',on?'true':'false');
    b.tabIndex=on?0:-1;
  });
  if(study)study.hidden=mode!=='study';
  if(practice)practice.hidden=mode!=='practice';
  hub.setAttribute('data-mode',mode);
  if(scroll)hub.scrollIntoView({behavior:'smooth',block:'start'});
}
function beginUnitSwitch(){
  if(!studyContent)return;
  var h=Math.max(260,Math.round(studyContent.getBoundingClientRect().height||0));
  studyContent.style.minHeight=h+'px';
  studyContent.classList.remove('is-unit-entering');
  studyContent.classList.add('is-unit-switching');
  switching=true;
  clearTimeout(switchTimer);
  switchTimer=setTimeout(finishUnitSwitch,2200);
}
function finishUnitSwitch(){
  if(!studyContent||!switching)return;
  switching=false;
  clearTimeout(switchTimer);
  studyContent.classList.remove('is-unit-switching');
  studyContent.classList.add('is-unit-entering');
  setTimeout(function(){
    studyContent.classList.remove('is-unit-entering');
    studyContent.style.minHeight='';
  },260);
}

tabs.forEach(function(b){b.addEventListener('click',function(){setMode(b.getAttribute('data-book-mode'),false);});});
if(studyBtn)studyBtn.addEventListener('click',function(){setMode('study',true);});
if(practiceBtn)practiceBtn.addEventListener('click',function(){setMode('practice',true);});
if(langBtn)langBtn.addEventListener('click',function(){setTimeout(labels,0);});
if(unitStrip&&studyContent){
  unitStrip.addEventListener('click',function(e){
    var b=e.target&&e.target.closest?e.target.closest('[data-unit-id]'):null;
    if(!b||b.classList.contains('is-current'))return;
    beginUnitSwitch();
  },true);
  if(window.MutationObserver){
    new MutationObserver(function(mutations){
      if(!switching)return;
      var ready=mutations.some(function(m){
        return m.type==='childList'&&studyContent.querySelector('.book-study-content-top,.book-study-section');
      });
      if(ready)requestAnimationFrame(function(){requestAnimationFrame(finishUnitSwitch);});
    }).observe(studyContent,{childList:true,subtree:true});
  }
}
labels();
setMode('study',false);
})();
