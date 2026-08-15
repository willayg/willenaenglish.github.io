(function(global){
'use strict';
var session=null;
function text(v){return String(v==null?'':v).trim();}
function isKo(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function arr(v){return Array.isArray(v)?v:[];}
function ensureOverlay(){
  var old=document.getElementById('aiCoachPracticeOverlay');
  if(old)old.remove();
  var overlay=document.createElement('section');
  overlay.id='aiCoachPracticeOverlay';
  overlay.className='ai-coach-practice-overlay';
  overlay.innerHTML='<div class="ai-coach-practice-shell"><header class="ai-coach-practice-head"><button id="aiCoachPracticeBack" class="ai-coach-practice-back" type="button" aria-label="Back">←</button><div class="ai-coach-practice-title"><span>AI COACH</span><h2 id="aiCoachPracticeTitle"></h2><div id="aiCoachPracticeProgress" class="ai-coach-practice-progress"></div></div></header><div class="ai-coach-practice-card"><div id="aiCoachActivityRoot"></div></div><button id="aiCoachPracticeNext" class="ai-coach-practice-next" type="button" disabled></button></div>';
  document.body.appendChild(overlay);
  overlay.querySelector('#aiCoachPracticeBack').addEventListener('click',function(){close(false);});
  overlay.querySelector('#aiCoachPracticeNext').addEventListener('click',advance);
  return overlay;
}
function scrollActionIntoView(overlay,action){
  if(!overlay||!action)return;
  requestAnimationFrame(function(){requestAnimationFrame(function(){
    try{action.scrollIntoView({behavior:'smooth',block:'end'});}catch(_){}
  });});
}
function showItem(){
  if(!session)return;
  var item=session.items[session.index];
  if(!item){close(true);return;}
  var overlay=session.overlay;
  var next=overlay.querySelector('#aiCoachPracticeNext');
  session.answered=false;
  next.disabled=true;
  next.textContent=isKo()?'다음':'Next';
  overlay.querySelector('#aiCoachPracticeProgress').textContent=(session.index+1)+' / '+session.items.length;
  session.engine.setActivity(item);
  overlay.scrollTo({top:0,behavior:'auto'});
}
function advance(){
  if(!session||!session.answered)return;
  if(session.index>=session.items.length-1){close(true);return;}
  session.index++;
  showItem();
}
function open(plan){
  if(!plan||!arr(plan.items).length||!global.WillenaActivityEngine)return false;
  var overlay=ensureOverlay();
  var root=overlay.querySelector('#aiCoachActivityRoot');
  var next=overlay.querySelector('#aiCoachPracticeNext');
  session={items:arr(plan.items).slice(0,12),index:0,overlay:overlay,answered:false,engine:null};
  session.engine=new global.WillenaActivityEngine(root,{onAnswer:function(){
    if(!session)return;
    session.answered=true;
    next.disabled=false;
    next.textContent=session.index>=session.items.length-1?(isKo()?'완료':'Finish'):(isKo()?'다음':'Next');
    scrollActionIntoView(overlay,next);
  }});
  overlay.querySelector('#aiCoachPracticeTitle').textContent=plan.title||(isKo()?'AI 코치 연습':'AI Coach Practice');
  document.documentElement.style.overflow='hidden';
  showItem();
  return true;
}
function close(completed){
  var overlay=document.getElementById('aiCoachPracticeOverlay');if(overlay)overlay.remove();
  document.documentElement.style.overflow='';
  session=null;
  if(completed){
    var t=document.getElementById('aiChatTranscript');
    if(t){var row=document.createElement('div');row.className='study-v2-ai-chat-row is-coach';var bubble=document.createElement('div');bubble.className='study-v2-ai-chat-bubble';bubble.textContent=isKo()?'잘했어요! 더 도전하거나 새로운 걸 골라도 좋아요.':'Nice work! You can challenge yourself again or try something new.';row.appendChild(bubble);t.appendChild(row);}
    var section=document.getElementById('aiRecommendations');if(section)section.scrollIntoView({behavior:'auto',block:'start'});
  }
}
document.addEventListener('click',function(e){
  var cta=e.target&&e.target.closest&&e.target.closest('#aiChatCta .study-v2-ai-chat-cta');
  if(!cta)return;
  var coach=global.WillenaStudyV2AIChat,plan=coach&&typeof coach.getLastPlan==='function'?coach.getLastPlan():null;
  if(!plan||!arr(plan.items).length)return;
  e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();
  open(plan);
},true);
global.WillenaStudyV2AIPractice={open:open,close:close};
})(window);
