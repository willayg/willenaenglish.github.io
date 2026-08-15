(function(global){
'use strict';
var session=null;
function text(v){return String(v==null?'':v).trim();}
function isKo(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function arr(v){return Array.isArray(v)?v:[];}
function sameAnswer(a,b){return text(a).toLowerCase()===text(b).toLowerCase();}
function ensureOverlay(){
  var old=document.getElementById('aiCoachPracticeOverlay');
  if(old)old.remove();
  var overlay=document.createElement('section');
  overlay.id='aiCoachPracticeOverlay';
  overlay.className='ai-coach-practice-overlay ai-coach-practice-overlay-v2';
  overlay.innerHTML='<div class="ai-coach-practice-shell"><header class="ai-coach-practice-head"><button id="aiCoachPracticeBack" class="ai-coach-practice-back" type="button" aria-label="Back">←</button><div class="ai-coach-practice-title"><span>AI COACH</span><h2 id="aiCoachPracticeTitle"></h2><div id="aiCoachPracticeProgress" class="ai-coach-practice-progress"></div></div></header><div id="aiCoachPracticeQuestion" class="ai-coach-question-card"></div><button id="aiCoachPracticeNext" class="ai-coach-practice-next" type="button" disabled></button></div>';
  document.body.appendChild(overlay);
  overlay.querySelector('#aiCoachPracticeBack').addEventListener('click',function(){close(false);});
  overlay.querySelector('#aiCoachPracticeNext').addEventListener('click',next);
  return overlay;
}
function activityResult(item,selected){
  var correct=sameAnswer(selected,item&&item.answer);
  return{correct:correct,selected:selected,answer:item&&item.answer,responseTimeMs:0};
}
function dispatchAnswer(item,result){
  try{global.dispatchEvent(new CustomEvent('willena:activity-answer',{detail:{activity:item,result:result,responseTimeMs:0}}));}catch(_){}
}
function render(){
  if(!session)return;
  var item=session.items[session.index];
  if(!item){close(true);return;}
  var overlay=session.overlay,root=overlay.querySelector('#aiCoachPracticeQuestion'),nextBtn=overlay.querySelector('#aiCoachPracticeNext');
  session.answered=false;session.selected=null;
  overlay.querySelector('#aiCoachPracticeProgress').textContent=(session.index+1)+' / '+session.items.length;
  nextBtn.disabled=true;nextBtn.textContent=isKo()?'다음':'Next';
  root.innerHTML='';

  var context=text(item.stimulus&&item.stimulus.context);
  var prompt=text(item.stimulus&&item.stimulus.prompt||item.q);
  if(context){var c=document.createElement('div');c.className='ai-coach-question-context';c.textContent=context;root.appendChild(c);}
  var h=document.createElement('h3');h.className='ai-coach-question-prompt';h.textContent=prompt|| (isKo()?'알맞은 답을 고르세요.':'Choose the best answer.');root.appendChild(h);

  var choices=arr(item.response&&item.response.choices||item.choices).slice();
  var choicesWrap=document.createElement('div');choicesWrap.className='ai-coach-question-choices';root.appendChild(choicesWrap);
  choices.forEach(function(choice){
    var b=document.createElement('button');b.type='button';b.className='ai-coach-question-choice';b.textContent=text(choice);
    b.addEventListener('click',function(){
      if(session.answered)return;
      session.selected=text(choice);
      choicesWrap.querySelectorAll('button').forEach(function(x){x.classList.remove('is-selected');});
      b.classList.add('is-selected');
      check.disabled=false;
    });
    choicesWrap.appendChild(b);
  });

  var feedback=document.createElement('div');feedback.className='ai-coach-question-feedback';feedback.hidden=true;root.appendChild(feedback);
  var check=document.createElement('button');check.type='button';check.className='ai-coach-question-check';check.textContent=isKo()?'확인':'Check';check.disabled=true;root.appendChild(check);
  check.addEventListener('click',function(){
    if(session.answered||!session.selected)return;
    var result=activityResult(item,session.selected);session.answered=true;
    choicesWrap.querySelectorAll('button').forEach(function(x){
      x.disabled=true;
      if(sameAnswer(x.textContent,item.answer))x.classList.add('is-correct');
      else if(x.classList.contains('is-selected'))x.classList.add('is-wrong');
    });
    feedback.hidden=false;feedback.classList.add(result.correct?'is-correct':'is-wrong');
    feedback.textContent=result.correct?(isKo()?'정답이에요!':'Correct!'):(isKo()?'정답 · '+text(item.answer):'Answer · '+text(item.answer));
    check.disabled=true;check.hidden=true;
    nextBtn.disabled=false;nextBtn.textContent=session.index>=session.items.length-1?(isKo()?'완료':'Finish'):(isKo()?'다음':'Next');
    dispatchAnswer(item,result);
  });
  overlay.scrollTo({top:0,behavior:'auto'});
}
function open(plan){
  if(!plan||!arr(plan.items).length)return false;
  var overlay=ensureOverlay();
  session={items:arr(plan.items).slice(0,12),index:0,overlay:overlay,answered:false,selected:null};
  overlay.querySelector('#aiCoachPracticeTitle').textContent=plan.title||(isKo()?'AI 코치 연습':'AI Coach Practice');
  document.documentElement.style.overflow='hidden';
  render();
  return true;
}
function next(){
  if(!session||!session.answered)return;
  if(session.index>=session.items.length-1){close(true);return;}
  session.index++;render();
}
function close(completed){
  var overlay=document.getElementById('aiCoachPracticeOverlay');if(overlay)overlay.remove();
  document.documentElement.style.overflow='';session=null;
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
