(function(){
'use strict';
function restoreNormalScreen(){setTimeout(function(){var study=document.getElementById('studyPanel'),practice=document.getElementById('practicePanel');if(study)study.hidden=true;if(practice)practice.hidden=true;},0);}
function mount(){
 if(!document.getElementById('smartPracticePanel')){
  var main=document.getElementById('app');
  if(!main)return;
  var section=document.createElement('section');
  section.id='smartPracticePanel';
  section.className='practice-panel';
  section.hidden=true;
  section.innerHTML='<div class="practice-toolbar"><button id="smartClose" class="ghost-button" type="button">← 뒤로</button><div><span class="eyebrow">SMART STUDY</span><h2>오늘의 연습</h2><small id="smartCount" class="section-note">— / 12</small></div><button id="smartNext" class="secondary-button" type="button" disabled>다음</button></div><div id="smartActivityRoot"></div>';
  main.appendChild(section);
  document.getElementById('smartClose').addEventListener('click',restoreNormalScreen);
 }
 if(!document.querySelector('script[data-smart-study]')){
  var s=document.createElement('script');s.src='./smart-study.js?v=20260809-2';s.dataset.smartStudy='1';document.body.appendChild(s);
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();