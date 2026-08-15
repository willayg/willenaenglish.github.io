(function(global){
'use strict';

function arr(v){return Array.prototype.slice.call(v||[]);}
function latestCoachBubble(){
  var transcript=document.getElementById('aiChatTranscript');
  if(!transcript)return null;
  var rows=arr(transcript.querySelectorAll('.study-v2-ai-chat-row.is-coach'));
  var row=rows[rows.length-1];
  return row&&row.querySelector('.study-v2-ai-chat-bubble');
}
function moveLinkIntoChat(){
  var wrap=document.getElementById('aiChatCta');
  if(!wrap)return;
  var source=wrap.querySelector('.study-v2-ai-chat-cta');
  if(!source)return;

  var bubble=latestCoachBubble();
  if(!bubble)return;
  bubble.querySelectorAll('.study-v2-ai-inline-link').forEach(function(x){x.remove();});

  var coach=global.WillenaStudyV2AIChat;
  var plan=coach&&typeof coach.getLastPlan==='function'?coach.getLastPlan():null;
  var link=document.createElement('button');
  link.type='button';
  link.className='study-v2-ai-inline-link';
  link.textContent=source.textContent;
  link.addEventListener('click',function(e){
    e.preventDefault();
    e.stopPropagation();
    var practice=global.WillenaStudyV2AIPractice;
    if(plan&&Array.isArray(plan.items)&&plan.items.length&&practice&&typeof practice.open==='function'){
      practice.open(plan);
      return;
    }
    /* Non-custom recommendations still use the original plan-specific launcher. */
    source.click();
  });
  bubble.appendChild(link);

  /* The action now lives in the conversation, so remove the detached CTA area. */
  wrap.innerHTML='';
}
function mount(){
  var wrap=document.getElementById('aiChatCta');
  if(!wrap)return;
  new MutationObserver(function(){moveLinkIntoChat();}).observe(wrap,{childList:true,subtree:false});
  moveLinkIntoChat();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);
