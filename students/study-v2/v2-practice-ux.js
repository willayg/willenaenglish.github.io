(function(global){
'use strict';
var root=document.getElementById('v2ActivityRoot');
var panel=document.getElementById('v2PracticePanel');
var countEl=document.getElementById('practicePerf');
var titleEl=document.getElementById('v2PracticeTitle');
var position=0;
var target=10;

function currentLanguage(){var b=document.getElementById('languageBtn');return b&&String(b.textContent||'').trim()==='English'?'ko':'en';}
function isDaily(){return document.body.classList.contains('study-v2-daily-mode');}
function setFocusHeader(){if(isDaily())return;if(titleEl)titleEl.textContent=currentLanguage()==='ko'?'약한 부분 집중 연습':'Focused practice';if(countEl)countEl.textContent=(position+1)+' / '+target;}
function addSourceBadge(){if(isDaily()||!root)return;var card=root.querySelector('.activity-card');if(!card||card.querySelector('.activity-source-badge'))return;var badge=document.createElement('div');badge.className='activity-source-badge';badge.textContent='Source · Focused unit practice';card.insertBefore(badge,card.firstChild);}
function decorate(){if(isDaily())return;setFocusHeader();addSourceBadge();if(panel)panel.scrollTop=0;}

if(global.WillenaActivityEngine&&global.WillenaActivityEngine.prototype){
  var originalSetActivity=global.WillenaActivityEngine.prototype.setActivity;
  global.WillenaActivityEngine.prototype.setActivity=function(raw){
    var result=originalSetActivity.call(this,raw);
    decorate();
    return result;
  };
}

document.addEventListener('click',function(e){
  if(isDaily())return;
  var mastery=e.target&&e.target.closest&&e.target.closest('#masteryGrid [data-skill]');
  if(mastery){position=0;setTimeout(setFocusHeader,0);return;}
  var close=e.target&&e.target.closest&&e.target.closest('#v2PracticeClose');
  if(close){position=0;}
},true);

global.addEventListener('willena:activity-answer',function(){
  if(isDaily()||!panel||panel.hidden||!root)return;
  var check=root.querySelector('.activity-check');
  if(!check)return;
  var replacement=check.cloneNode(true);
  replacement.disabled=false;
  replacement.textContent=position+1>=target?(currentLanguage()==='ko'?'완료':'Done'):(currentLanguage()==='ko'?'다음':'Next');
  check.replaceWith(replacement);
  replacement.addEventListener('click',function(){
    position++;
    var hiddenNext=document.getElementById('v2PracticeNext');
    if(hiddenNext)hiddenNext.click();
  },{once:true});
});
})(window);
