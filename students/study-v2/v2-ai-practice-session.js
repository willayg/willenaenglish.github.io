(function(global){
'use strict';
var session=null;
function text(v){return String(v==null?'':v).trim();}
function isKo(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function arr(v){return Array.isArray(v)?v:[];}
function answerText(v){return Array.isArray(v)?v.map(text).filter(Boolean).join(' '):text(v);}
function normalizedAnswer(v){return answerText(v).toLowerCase().replace(/[“”"]/g,'').replace(/[.,!?;:]+/g,'').replace(/\s+/g,' ').trim();}
function sameAnswer(a,b){return normalizedAnswer(a)===normalizedAnswer(b);}
function shuffle(items){var a=items.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
function ensureOverlay(){
  var old=document.getElementById('aiCoachPracticeOverlay');
  if(old)old.remove();
  var overlay=document.createElement('section');
  overlay.id='aiCoachPracticeOverlay';
  overlay.className='ai-coach-practice-overlay ai-coach-practice-overlay-v2';
  overlay.innerHTML='<div class="ai-coach-practice-shell"><header class="ai-coach-practice-head"><button id="aiCoachPracticeBack" class="ai-coach-practice-back" type="button" aria-label="Back">←</button><div class="ai-coach-practice-title"><span>AI COACH</span><h2 id="aiCoachPracticeTitle"></h2><div id="aiCoachPracticeProgress" class="ai-coach-practice-progress"></div></div></header><div id="aiCoachPracticeQuestion" class="ai-coach-question-card"></div></div>';
  document.body.appendChild(overlay);
  overlay.querySelector('#aiCoachPracticeBack').addEventListener('click',function(){close(false);});
  return overlay;
}
function activityResult(item,selected){
  var correct=sameAnswer(selected,item&&item.answer);
  return{correct:correct,selected:selected,answer:item&&item.answer,responseTimeMs:0};
}
function dispatchAnswer(item,result){
  try{global.dispatchEvent(new CustomEvent('willena:activity-answer',{detail:{activity:item,result:result,responseTimeMs:0}}));}catch(_){}
}
function scrollActionIntoView(overlay,action){
  if(!overlay||!action)return;
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      try{overlay.scrollTo({top:overlay.scrollHeight,behavior:'smooth'});}
      catch(_){try{action.scrollIntoView({behavior:'smooth',block:'end'});}catch(__){}}
    });
  });
}
function advance(){
  if(!session||!session.answered)return;
  if(session.index>=session.items.length-1){close(true);return;}
  session.index++;
  render();
}
function makeFeedback(root){
  var feedback=document.createElement('div');
  feedback.className='ai-coach-question-feedback';
  feedback.hidden=true;
  root.appendChild(feedback);
  return feedback;
}
function makeAction(root){
  var action=document.createElement('button');
  action.type='button';
  action.className='ai-coach-question-check ai-coach-question-action';
  action.textContent=isKo()?'확인':'Check';
  action.disabled=true;
  root.appendChild(action);
  return action;
}
function finishGrade(item,result,feedback,action,overlay){
  session.answered=true;
  feedback.hidden=false;
  feedback.classList.remove('is-correct','is-wrong');
  feedback.classList.add(result.correct?'is-correct':'is-wrong');
  feedback.textContent=result.correct?(isKo()?'정답이에요!':'Correct!'):(isKo()?'정답 · '+answerText(item.answer):'Answer · '+answerText(item.answer));
  action.disabled=false;
  action.textContent=session.index>=session.items.length-1?(isKo()?'완료':'Finish'):(isKo()?'다음':'Next');
  action.classList.add('is-next');
  dispatchAnswer(item,result);
  scrollActionIntoView(overlay,action);
}
function renderMultipleChoice(item,root,overlay){
  var choices=arr(item.response&&item.response.choices||item.choices).slice();
  var choicesWrap=document.createElement('div');
  choicesWrap.className='ai-coach-question-choices';
  root.appendChild(choicesWrap);
  var feedback=makeFeedback(root);
  var action=makeAction(root);

  choices.forEach(function(choice){
    var b=document.createElement('button');
    b.type='button';
    b.className='ai-coach-question-choice';
    b.textContent=text(choice);
    b.addEventListener('click',function(){
      if(session.answered)return;
      session.selected=text(choice);
      choicesWrap.querySelectorAll('button').forEach(function(x){x.classList.remove('is-selected');});
      b.classList.add('is-selected');
      action.disabled=false;
    });
    choicesWrap.appendChild(b);
  });

  action.addEventListener('click',function(){
    if(!session)return;
    if(session.answered){advance();return;}
    if(!session.selected)return;
    var result=activityResult(item,session.selected);
    choicesWrap.querySelectorAll('button').forEach(function(x){
      x.disabled=true;
      if(sameAnswer(x.textContent,item.answer))x.classList.add('is-correct');
      else if(x.classList.contains('is-selected'))x.classList.add('is-wrong');
    });
    finishGrade(item,result,feedback,action,overlay);
  });
}
function promptTokens(item){
  var tokens=arr(item.response&&item.response.tokens).map(text).filter(Boolean);
  if(tokens.length)return tokens;
  var p=text(item.stimulus&&item.stimulus.prompt||item.q),colon=p.indexOf(':');
  if(colon>=0&&p.slice(colon+1).indexOf('/')>=0)return p.slice(colon+1).split('/').map(text).filter(Boolean);
  return answerText(item.answer).split(/\s+/).map(text).filter(Boolean);
}
function renderTokenOrder(item,root,overlay){
  var source=promptTokens(item);
  if(!source.length){renderMultipleChoice(item,root,overlay);return;}
  var tokenObjects=source.map(function(t,i){return{id:'tok-'+i,text:t};});
  var poolOrder=shuffle(tokenObjects);
  var selectedIds=[];

  var builder=document.createElement('div');
  builder.className='ai-coach-token-builder';
  var selectedLabel=document.createElement('div');
  selectedLabel.className='ai-coach-token-label';
  selectedLabel.textContent=isKo()?'문장':'Your sentence';
  var selectedWrap=document.createElement('div');
  selectedWrap.className='ai-coach-token-selected';
  selectedWrap.setAttribute('aria-label',selectedLabel.textContent);
  var poolLabel=document.createElement('div');
  poolLabel.className='ai-coach-token-label';
  poolLabel.textContent=isKo()?'단어를 순서대로 눌러 보세요':'Tap the words in order';
  var pool=document.createElement('div');
  pool.className='ai-coach-token-pool';
  builder.appendChild(selectedLabel);
  builder.appendChild(selectedWrap);
  builder.appendChild(poolLabel);
  builder.appendChild(pool);
  root.appendChild(builder);
  var feedback=makeFeedback(root);
  var action=makeAction(root);

  function tokenById(id){return tokenObjects.find(function(x){return x.id===id;});}
  function renderTokens(){
    selectedWrap.innerHTML='';
    pool.innerHTML='';
    selectedIds.forEach(function(id){
      var tok=tokenById(id);if(!tok)return;
      var b=document.createElement('button');
      b.type='button';b.className='ai-coach-token is-selected';b.textContent=tok.text;
      b.disabled=!!session.answered;
      b.addEventListener('click',function(){
        if(session.answered)return;
        selectedIds=selectedIds.filter(function(x){return x!==id;});
        renderTokens();
      });
      selectedWrap.appendChild(b);
    });
    poolOrder.forEach(function(tok){
      if(selectedIds.indexOf(tok.id)>=0)return;
      var b=document.createElement('button');
      b.type='button';b.className='ai-coach-token';b.textContent=tok.text;
      b.disabled=!!session.answered;
      b.addEventListener('click',function(){
        if(session.answered)return;
        selectedIds.push(tok.id);
        renderTokens();
      });
      pool.appendChild(b);
    });
    selectedWrap.classList.toggle('is-empty',selectedIds.length===0);
    if(!session.answered)action.disabled=selectedIds.length!==tokenObjects.length;
  }

  action.addEventListener('click',function(){
    if(!session)return;
    if(session.answered){advance();return;}
    if(selectedIds.length!==tokenObjects.length)return;
    var selected=selectedIds.map(function(id){var t=tokenById(id);return t?t.text:'';}).filter(Boolean).join(' ');
    session.selected=selected;
    var result=activityResult(item,selected);
    session.answered=true;
    renderTokens();
    selectedWrap.classList.add(result.correct?'is-correct':'is-wrong');
    finishGrade(item,result,feedback,action,overlay);
  });
  renderTokens();
}
function render(){
  if(!session)return;
  var item=session.items[session.index];
  if(!item){close(true);return;}
  var overlay=session.overlay,root=overlay.querySelector('#aiCoachPracticeQuestion');
  session.answered=false;
  session.selected=null;
  overlay.querySelector('#aiCoachPracticeProgress').textContent=(session.index+1)+' / '+session.items.length;
  root.innerHTML='';

  var context=text(item.stimulus&&item.stimulus.context);
  var prompt=text(item.stimulus&&item.stimulus.prompt||item.q);
  if(context){var c=document.createElement('div');c.className='ai-coach-question-context';c.textContent=context;root.appendChild(c);}
  var h=document.createElement('h3');h.className='ai-coach-question-prompt';h.textContent=prompt||(isKo()?'알맞은 답을 고르세요.':'Choose the best answer.');root.appendChild(h);

  var responseType=text(item.response&&item.response.type);
  if(responseType==='token_order')renderTokenOrder(item,root,overlay);
  else renderMultipleChoice(item,root,overlay);

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
