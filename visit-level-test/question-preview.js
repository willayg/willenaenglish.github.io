(function(){
'use strict';
var params=new URLSearchParams(location.search);
var requested=String(params.get('question')||params.get('q')||'').trim();
if(!requested)return;
window.WillenaQuestionPreviewActive=true;
window.WillenaQuestionPreviewKey=requested;

var root=document.querySelector('#app');
if(!root)return;
var question=null,bankReady=false,appReady=false,rendering=false;
var observer=null;

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function clean(v){return String(v==null?'':v).trim()}
function same(a,b){return clean(a).toLowerCase()===clean(b).toLowerCase()}
function findQuestion(items){
 return (items||[]).find(function(q){
  return same(q&&q.id,requested)||same(q&&q.sourceId,requested)||same(q&&q.metadata&&q.metadata.source_key,requested);
 })||null;
}
function installStyle(){
 if(document.getElementById('visitorQuestionPreviewStyle'))return;
 var s=document.createElement('style');
 s.id='visitorQuestionPreviewStyle';
 s.textContent='.candidate-flow,.visitor-v2-overlay{display:none!important}.visitor-question-preview{width:min(900px,100%);margin:0 auto}.visitor-question-preview-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 14px;padding:11px 14px;border:1px dashed #b9cad4;border-radius:14px;background:#f7fafc;color:#64748b;font:600 12px/1.4 Poppins,system-ui,sans-serif}.visitor-question-preview-bar strong{color:#17243f}.visitor-question-preview-answer{border:0;border-radius:10px;background:#17243f;color:#fff;padding:8px 12px;font:700 12px Poppins,system-ui,sans-serif;cursor:pointer}.visitor-question-preview-answerbox{margin:0 0 14px;padding:12px 14px;border-radius:14px;background:#eefaf7;color:#176b57;font:700 14px Poppins,system-ui,sans-serif}.visitor-question-preview .choice.selected{outline:3px solid rgba(37,185,197,.28);border-color:#25b9c5}.visitor-question-preview .scramble-bank{margin-top:14px}';
 document.head.appendChild(s);
}
function optionHtml(q){
 return '<div class="choices">'+(q.choices||[]).map(function(c){return '<button class="choice" type="button" data-value="'+esc(c)+'">'+esc(c)+'</button>'}).join('')+'</div>';
}
function listeningHtml(q){
 return '<div class="listening-panel"><div class="listening-icon" aria-hidden="true">🎧</div><p>음성을 듣고 가장 알맞은 답을 고르세요.</p><button class="listen-button" id="previewPlayAudio" type="button"><span>음성 듣기</span></button><small>Preview</small></div><p class="prompt listening-question">'+esc(q.q||q.prompt)+'</p>'+optionHtml(q);
}
function scrambleHtml(q){
 var tokens=Array.isArray(q.tokens)?q.tokens:[];
 return '<p class="prompt">'+esc(q.q||q.prompt)+'</p>'+(q.meaning?'<div class="scramble-meaning"><strong>'+esc(q.meaning)+'</strong></div>':'')+'<div class="scramble-bank">'+tokens.map(function(t){return '<button class="scramble-token" type="button">'+esc(t)+'</button>'}).join('')+'</div>';
}
function normalHtml(q){return '<p class="prompt">'+esc(q.q||q.prompt)+'</p>'+optionHtml(q)}
function renderError(message){
 rendering=true;document.body.classList.remove('welcome-mode');
 root.innerHTML='<section class="screen screen-safe-in screen-safe-ready"><div class="visitor-question-preview"><div class="visitor-question-preview-bar"><strong>Question preview</strong><span>'+esc(requested)+'</span></div><div class="question-card"><p class="prompt">'+esc(message)+'</p></div></div></section>';
 rendering=false;
}
function renderPreview(){
 if(!bankReady||!appReady||rendering)return;
 if(!question){renderError('Question not found in the published level-test bank.');return}
 rendering=true;installStyle();document.body.classList.remove('welcome-mode');
 if(window.speechSynthesis)window.speechSynthesis.cancel();
 var type=clean(question.type),body=type==='listening'?listeningHtml(question):(type==='sentence_unscramble'?scrambleHtml(question):normalHtml(question));
 root.innerHTML='<section class="screen screen-safe-in screen-safe-ready"><div class="visitor-question-preview"><div class="visitor-question-preview-bar"><span><strong>'+esc(question.metadata&&question.metadata.source_key||question.id)+'</strong> · internal '+esc(question.level)+' · '+esc(type)+'</span><button class="visitor-question-preview-answer" id="previewAnswer" type="button">Show answer</button></div><div id="previewAnswerBox" class="visitor-question-preview-answerbox" hidden>Answer: '+esc(Array.isArray(question.a)?question.a.join(' '):question.a)+'</div><div class="question-card" data-question-id="'+esc(question.id)+'" data-question-level="'+esc(question.level)+'">'+body+'</div></div></section>';
 rendering=false;
 window.dispatchEvent(new CustomEvent('willena:assessment-bank-ready',{detail:{preview:true}}));
}
function speak(){
 if(!question||question.type!=='listening')return;
 var text=clean(question.stimulus&&question.stimulus.text||question.metadata&&question.metadata.transcript);
 if(!text||!window.speechSynthesis||!window.SpeechSynthesisUtterance)return;
 window.speechSynthesis.cancel();
 var u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=Number(question.metadata&&question.metadata.rate)||0.9;
 var voices=window.speechSynthesis.getVoices();u.voice=voices.find(function(v){return v.lang==='en-US'&&/Samantha|Ava|Google US English|Microsoft/i.test(v.name)})||voices.find(function(v){return /^en/i.test(v.lang)})||null;
 window.speechSynthesis.speak(u);
}
root.addEventListener('click',function(e){
 if(!window.WillenaQuestionPreviewActive)return;
 var play=e.target.closest('#previewPlayAudio');if(play){e.preventDefault();e.stopImmediatePropagation();speak();return}
 var answer=e.target.closest('#previewAnswer');if(answer){var box=root.querySelector('#previewAnswerBox');if(box){box.hidden=!box.hidden;answer.textContent=box.hidden?'Show answer':'Hide answer'}return}
 var choice=e.target.closest('.choice');if(choice){root.querySelectorAll('.choice').forEach(function(x){x.classList.remove('selected')});choice.classList.add('selected');e.stopImmediatePropagation();}
},true);

function markAppReady(){if(appReady)return;appReady=true;renderPreview()}
observer=new MutationObserver(function(){
 if(rendering)return;
 if(!appReady&&(root.querySelector('#welcomeStart')||root.querySelector('.setup-options')||root.querySelector('.question-card')))markAppReady();
 else if(appReady&&!root.querySelector('.visitor-question-preview'))renderPreview();
});
observer.observe(root,{childList:true,subtree:true});
setTimeout(markAppReady,1800);

if(typeof window.loadQuestionBank!=='function'){renderError('Question bank loader is not available.');return}
window.loadQuestionBank().then(function(items){question=findQuestion(items);bankReady=true;renderPreview()}).catch(function(error){bankReady=true;question=null;renderError(error&&error.message||'Could not load the question bank.')});
})();
