(function(){
'use strict';
var root=document.querySelector('#app');
if(!root)return;
var SUPABASE_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var SUPABASE_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var activeSourceKey='';

function ko(){return document.documentElement.lang==='ko'}
function text(en,kr){return ko()?kr:en}
function ensureModal(){
 if(document.querySelector('#questionFlagModal'))return;
 var modal=document.createElement('div');
 modal.id='questionFlagModal';
 modal.className='question-flag-modal';
 modal.setAttribute('aria-hidden','true');
 modal.innerHTML='<div class="question-flag-dialog" role="dialog" aria-modal="true" aria-labelledby="questionFlagTitle">'+
  '<button class="question-flag-close" type="button" aria-label="Close">×</button>'+
  '<h3 id="questionFlagTitle"></h3>'+
  '<p class="question-flag-copy"></p>'+
  '<label class="question-flag-label" for="questionFlagPin"></label>'+
  '<input id="questionFlagPin" class="question-flag-input" type="password" inputmode="numeric" maxlength="4" autocomplete="off">'+
  '<label class="question-flag-label" for="questionFlagMessage"></label>'+
  '<textarea id="questionFlagMessage" class="question-flag-textarea" maxlength="1000"></textarea>'+
  '<p class="question-flag-error" role="alert"></p>'+
  '<div class="question-flag-actions"><button class="question-flag-cancel" type="button"></button><button class="question-flag-send" type="button"></button></div>'+
  '</div>';
 document.body.appendChild(modal);
 modal.addEventListener('click',function(event){if(event.target===modal||event.target.closest('.question-flag-close,.question-flag-cancel'))closeModal()});
 modal.querySelector('.question-flag-send').addEventListener('click',submitFlag);
}
function localizeModal(){
 var modal=document.querySelector('#questionFlagModal');if(!modal)return;
 modal.querySelector('#questionFlagTitle').textContent=text('Flag this question for review','이 문항 검토 요청');
 modal.querySelector('.question-flag-copy').textContent=text('The question will be removed from new test sessions until it is reviewed in Curriculum Studio.','검토가 끝날 때까지 새 테스트에서는 이 문항이 나오지 않습니다.');
 modal.querySelector('label[for="questionFlagPin"]').textContent=text('Reviewer PIN','검토자 PIN');
 modal.querySelector('label[for="questionFlagMessage"]').textContent=text('What needs reviewing?','검토가 필요한 내용을 적어 주세요.');
 modal.querySelector('#questionFlagMessage').placeholder=text('Example: Two answers seem possible, wording is unnatural, audio is unclear…','예: 정답이 두 개처럼 보임, 문장이 어색함, 듣기 음성이 불명확함…');
 modal.querySelector('.question-flag-cancel').textContent=text('Cancel','취소');
 modal.querySelector('.question-flag-send').textContent=text('Send flag','검토 요청 보내기');
}
function openModal(sourceKey){
 activeSourceKey=sourceKey;
 ensureModal();localizeModal();
 var modal=document.querySelector('#questionFlagModal');
 modal.querySelector('#questionFlagPin').value='';
 modal.querySelector('#questionFlagMessage').value='';
 modal.querySelector('.question-flag-error').textContent='';
 modal.classList.add('is-open');modal.setAttribute('aria-hidden','false');
 setTimeout(function(){modal.querySelector('#questionFlagPin').focus()},30);
}
function closeModal(){
 var modal=document.querySelector('#questionFlagModal');if(!modal)return;
 modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true');activeSourceKey='';
}
async function submitFlag(){
 var modal=document.querySelector('#questionFlagModal');if(!modal||!activeSourceKey)return;
 var pin=modal.querySelector('#questionFlagPin').value.trim();
 var message=modal.querySelector('#questionFlagMessage').value.trim();
 var error=modal.querySelector('.question-flag-error');
 var send=modal.querySelector('.question-flag-send');
 error.textContent='';
 if(pin.length!==4){error.textContent=text('Enter the four-digit reviewer PIN.','4자리 검토자 PIN을 입력하세요.');return}
 if(!message){error.textContent=text('Write a short review note.','검토 내용을 간단히 적어 주세요.');return}
 send.disabled=true;send.textContent=text('Sending…','보내는 중…');
 try{
  var response=await fetch(SUPABASE_URL+'/rest/v1/rpc/flag_assessment_item',{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_source_key:activeSourceKey,p_message:message,p_pin:pin})});
  var payload=await response.json().catch(function(){return{}});
  if(!response.ok)throw new Error(response.status===401||response.status===403?text('The PIN is incorrect.','PIN이 올바르지 않습니다.'):payload.message||text('Could not send the flag.','검토 요청을 보내지 못했습니다.'));
  var button=document.querySelector('.question-review-flag[data-source-key="'+CSS.escape(activeSourceKey)+'"]');
  if(button){button.classList.add('is-flagged');button.disabled=true;button.innerHTML='✓ '+text('Flagged','검토 요청됨')}
  closeModal();
 }catch(err){error.textContent=err.message||text('Could not send the flag.','검토 요청을 보내지 못했습니다.')}finally{send.disabled=false;send.textContent=text('Send flag','검토 요청 보내기')}
}
function addFlagButton(){
 var card=root.querySelector('.question-card[data-question-id]');
 if(!card||card.querySelector('.question-review-flag'))return;
 var sourceKey=card.getAttribute('data-question-id');
 if(!sourceKey)return;
 var button=document.createElement('button');
 button.type='button';button.className='question-review-flag';button.dataset.sourceKey=sourceKey;
 button.setAttribute('aria-label',text('Flag question for review','문항 검토 요청'));
 button.innerHTML='<span aria-hidden="true">⚑</span><span>'+text('Review','검토')+'</span>';
 button.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();openModal(sourceKey)});
 card.appendChild(button);
}
var scheduled=false;
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;addFlagButton()})}
new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
new MutationObserver(function(){localizeModal();var b=root.querySelector('.question-review-flag:not(.is-flagged) span:last-child');if(b)b.textContent=text('Review','검토')}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
schedule();
})();