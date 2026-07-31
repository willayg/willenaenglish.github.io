(function(){
'use strict';
var root=document.querySelector('#app');
if(!root||location.hostname.indexOf('staging.')!==0)return;
var SUPABASE_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var SUPABASE_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var activeSourceKey='',activeKind='flag';
function ko(){return document.documentElement.lang==='ko'}
function text(en,kr){return ko()?kr:en}
function ensureModal(){
 if(document.querySelector('#questionFeedbackModal'))return;
 var modal=document.createElement('div');
 modal.id='questionFeedbackModal';modal.className='question-flag-modal';modal.setAttribute('aria-hidden','true');
 modal.innerHTML='<div class="question-flag-dialog" role="dialog" aria-modal="true" aria-labelledby="questionFeedbackTitle"><button class="question-flag-close" type="button" aria-label="Close">×</button><h3 id="questionFeedbackTitle"></h3><p class="question-flag-copy"></p><label class="question-flag-label" for="questionFeedbackMessage"></label><textarea id="questionFeedbackMessage" class="question-flag-textarea" maxlength="1000"></textarea><p class="question-flag-error" role="alert"></p><div class="question-flag-actions"><button class="question-flag-cancel" type="button"></button><button class="question-flag-send" type="button"></button></div></div>';
 document.body.appendChild(modal);
 modal.addEventListener('click',function(event){if(event.target===modal||event.target.closest('.question-flag-close,.question-flag-cancel'))closeModal()});
 modal.querySelector('.question-flag-send').addEventListener('click',submitFeedback);
}
function localizeModal(){
 var modal=document.querySelector('#questionFeedbackModal');if(!modal)return;
 var like=activeKind==='like';
 modal.querySelector('#questionFeedbackTitle').textContent=like?text('Like this question','이 문항 좋아요'):text('Flag this question for review','이 문항 검토 요청');
 modal.querySelector('.question-flag-copy').textContent=like?text('Tell us why this question fits the level particularly well.','이 문항이 해당 레벨에 특히 잘 맞는 이유를 알려 주세요.'):text('The question will be removed from new test sessions until it is reviewed.','검토가 끝날 때까지 새 테스트에서는 이 문항이 나오지 않습니다.');
 modal.querySelector('label[for="questionFeedbackMessage"]').textContent=like?text('Why is this a good question?','좋은 문항인 이유'):text('What needs reviewing?','검토가 필요한 내용');
 modal.querySelector('#questionFeedbackMessage').placeholder=like?text('Example: Natural language, exactly right difficulty, strong distractors…','예: 자연스러운 문장, 정확한 난이도, 좋은 오답 선택지…'):text('Example: Two answers seem possible, wording is unnatural, formatting is broken…','예: 정답이 두 개처럼 보임, 문장이 어색함, 형식이 깨짐…');
 modal.querySelector('.question-flag-cancel').textContent=text('Cancel','취소');
 modal.querySelector('.question-flag-send').textContent=like?text('Send like','좋아요 보내기'):text('Send flag','검토 요청 보내기');
}
function openModal(sourceKey,kind){
 activeSourceKey=sourceKey;activeKind=kind;ensureModal();localizeModal();
 var modal=document.querySelector('#questionFeedbackModal');modal.querySelector('#questionFeedbackMessage').value='';modal.querySelector('.question-flag-error').textContent='';modal.classList.add('is-open');modal.setAttribute('aria-hidden','false');setTimeout(function(){modal.querySelector('#questionFeedbackMessage').focus()},30);
}
function closeModal(){var modal=document.querySelector('#questionFeedbackModal');if(!modal)return;modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true');activeSourceKey=''}
async function submitFeedback(){
 var modal=document.querySelector('#questionFeedbackModal');if(!modal||!activeSourceKey)return;
 var message=modal.querySelector('#questionFeedbackMessage').value.trim(),error=modal.querySelector('.question-flag-error'),send=modal.querySelector('.question-flag-send');
 error.textContent='';if(activeKind==='flag'&&!message){error.textContent=text('Write a short review note.','검토 내용을 간단히 적어 주세요.');return}
 send.disabled=true;send.textContent=text('Sending…','보내는 중…');
 try{
  var response=await fetch(SUPABASE_URL+'/rest/v1/rpc/submit_assessment_feedback',{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_source_key:activeSourceKey,p_kind:activeKind,p_message:message||null})});
  var payload=await response.json().catch(function(){return{}});if(!response.ok)throw new Error(payload.message||text('Could not send feedback.','피드백을 보내지 못했습니다.'));
  var selector=activeKind==='like'?'.question-review-like':'.question-review-flag',button=document.querySelector(selector+'[data-source-key="'+CSS.escape(activeSourceKey)+'"]');
  if(button){button.classList.add(activeKind==='like'?'is-liked':'is-flagged');button.disabled=true;button.innerHTML=activeKind==='like'?'♥':'✓'}
  closeModal();
 }catch(err){error.textContent=err.message||text('Could not send feedback.','피드백을 보내지 못했습니다.')}finally{send.disabled=false;localizeModal()}
}
function addButtons(){
 var card=root.querySelector('.question-card[data-question-id]');if(!card||card.querySelector('.question-feedback-tools'))return;
 var sourceKey=card.getAttribute('data-question-id');if(!sourceKey)return;
 var tools=document.createElement('div');tools.className='question-feedback-tools';
 tools.innerHTML='<button type="button" class="question-review-flag" data-source-key="'+sourceKey+'" aria-label="'+text('Flag question','문항 검토 요청')+'"><span aria-hidden="true">⚑</span><span>'+text('Review','검토')+'</span></button><button type="button" class="question-review-like" data-source-key="'+sourceKey+'" aria-label="'+text('Like question','문항 좋아요')+'"><span aria-hidden="true">♡</span><span>'+text('Like','좋아요')+'</span></button>';
 tools.querySelector('.question-review-flag').addEventListener('click',function(e){e.preventDefault();e.stopPropagation();openModal(sourceKey,'flag')});
 tools.querySelector('.question-review-like').addEventListener('click',function(e){e.preventDefault();e.stopPropagation();openModal(sourceKey,'like')});
 card.appendChild(tools);
}
var scheduled=false;function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;addButtons()})}
new MutationObserver(schedule).observe(root,{childList:true,subtree:true});new MutationObserver(function(){localizeModal();var tools=root.querySelector('.question-feedback-tools');if(tools)tools.remove();schedule()}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});schedule();
})();