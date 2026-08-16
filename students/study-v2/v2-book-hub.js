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
var mode='study';

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

tabs.forEach(function(b){b.addEventListener('click',function(){setMode(b.getAttribute('data-book-mode'),false);});});
if(studyBtn)studyBtn.addEventListener('click',function(){setMode('study',true);});
if(practiceBtn)practiceBtn.addEventListener('click',function(){setMode('practice',true);});
if(langBtn)langBtn.addEventListener('click',function(){setTimeout(labels,0);});
labels();
setMode('study',false);
})();
