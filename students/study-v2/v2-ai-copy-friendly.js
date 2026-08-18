(function(global){
'use strict';

var KO={vocabulary:'어휘',spelling:'철자',grammar:'문법',sentence_building:'문장 만들기',conversation:'회화',listening:'듣기',reading:'읽기'};
var EN={vocabulary:'vocabulary',spelling:'spelling',grammar:'grammar',sentence_building:'sentence building',conversation:'conversation',listening:'listening',reading:'reading'};
var observer=null;
var timer=0;

function text(v){return String(v==null?'':v).trim();}
function isKo(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function skillName(skill,ko){return (ko?KO:EN)[skill]||(ko?'영어':'English');}

function friendlyCopy(c){
  var ko=isKo();
  var skill=skillName(c&&c.skill,ko);
  var unit='Unit '+(Number(c&&c.unitNumber)||1);
  var kick=text(c&&c.bookTitle)+' · '+unit;

  if(ko){
    if(c.type==='weak')return{kick:kick,title:skill+'을 한 번 더 연습해 봐요',copy:'틀렸던 '+skill+' 문제를 다시 연습하면 영어를 더 정확하고 자신 있게 사용할 수 있어요.',action:'다시 연습 →'};
    if(c.type==='due')return{kick:kick,title:'배운 '+skill+'을 다시 확인해 봐요',copy:'전에 배운 내용을 짧게 복습하면 더 오래 기억하고 다음 문제도 더 쉽게 풀 수 있어요.',action:'짧게 복습 →'};
    if(c.type==='coverage')return{kick:kick,title:skill+'을 조금 더 연습해 봐요',copy:'몇 문제만 더 풀어 보면 '+skill+'이 훨씬 편해질 거예요.',action:'조금 더 연습 →'};
    if(c.type==='near')return{kick:kick,title:skill+'은 거의 다 왔어요!',copy:'한 번만 더 연습하면 배운 내용을 훨씬 탄탄하게 만들 수 있어요.',action:'마무리 연습 →'};
    if(c.type==='preview')return{kick:kick,title:'다음 단원을 살짝 볼까요?',copy:'지금 단원을 잘하고 있어요. 다음 단원의 '+skill+'을 조금 미리 연습해 봐도 좋아요.',action:'미리보기 →'};
    return{kick:kick,title:'이번 단원을 한 번 더 연습해 봐요',copy:'짧게 한 번 더 연습하면 배운 영어를 더 오래 기억할 수 있어요.',action:'연습 시작 →'};
  }

  if(c.type==='weak')return{kick:kick,title:'Let’s practice '+skill+' again',copy:'Going back over the questions you missed will help make your English more accurate and confident.',action:'Practice again →'};
  if(c.type==='due')return{kick:kick,title:'A quick '+skill+' review',copy:'A short review of what you learned before will help it stick and make the next questions easier.',action:'Quick review →'};
  if(c.type==='coverage')return{kick:kick,title:'A little more '+skill+' practice',copy:'A few more questions should make this feel much easier.',action:'Practice a little more →'};
  if(c.type==='near')return{kick:kick,title:'You’re nearly there with '+skill,copy:'One more short round should make what you learned feel much more solid.',action:'Finish strong →'};
  if(c.type==='preview')return{kick:kick,title:'Ready for a small look ahead?',copy:'You’re doing well in this unit, so you can try a little '+skill+' from the next one.',action:'Preview →'};
  return{kick:kick,title:'Let’s give this unit one more go',copy:'One short review will help you remember what you learned for longer.',action:'Start practice →'};
}

function apply(){
  timer=0;
  var coach=global.WillenaStudyV2Coach;
  var grid=document.getElementById('aiGrid');
  if(!coach||typeof coach.getCandidates!=='function'||!grid)return;
  var candidates=coach.getCandidates()||[];
  grid.querySelectorAll('[data-coach-index]').forEach(function(card){
    var i=Number(card.dataset.coachIndex),c=candidates[i];
    if(!c)return;
    var copy=friendlyCopy(c);
    var kicker=card.querySelector('.coach-kicker');
    var title=card.querySelector('strong');
    var body=card.querySelector('small');
    var action=card.querySelector('.coach-action');
    if(kicker)kicker.textContent=copy.kick;
    if(title)title.textContent=copy.title;
    if(body)body.textContent=copy.copy;
    if(action)action.textContent=copy.action;
  });
}

function schedule(){if(timer)return;timer=setTimeout(apply,0);}
function mount(){
  var grid=document.getElementById('aiGrid');
  if(!grid)return;
  observer=new MutationObserver(schedule);
  observer.observe(grid,{childList:true});
  schedule();
  document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('#languageBtn'))setTimeout(schedule,120);},true);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);

/* AI Coach v2 diagnostics + need-level session layer. Kept separate from the legacy skill scorer. */
(function(){
  function load(src,done){
    if(document.querySelector('script[data-ai-layer="'+src+'"]')){if(done)done();return;}
    var s=document.createElement('script');s.src='./'+src+'?v=20260818-needs1';s.dataset.aiLayer=src;s.async=false;if(done)s.onload=done;document.head.appendChild(s);
  }
  load('v2-ai-needs.js',function(){
    load('v2-ai-smart-session.js');
    if(location.hostname==='staging.willenaenglish.com')load('v2-ai-debug-needs.js');
  });
})();
