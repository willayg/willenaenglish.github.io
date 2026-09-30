(function(){
'use strict';
var params=new URLSearchParams(location.search);
var requested=String(params.get('question')||params.get('q')||'').trim();
if(!requested)return;
window.WillenaQuestionPreviewActive=true;
window.WillenaQuestionPreviewKey=requested;

var root=document.querySelector('#app');
if(!root)return;
var question=null,bankReady=false,appReady=true,rendering=false;
var bank=[],previewBank=[],currentIndex=-1;
var observer=null;

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function clean(v){return String(v==null?'':v).trim()}
function same(a,b){return clean(a).toLowerCase()===clean(b).toLowerCase()}
function sourceKey(q){return clean(q&&q.metadata&&q.metadata.source_key||q&&q.id)}
function findQuestion(items,key){
 return (items||[]).find(function(q){
  return same(q&&q.id,key)||same(q&&q.sourceId,key)||same(q&&q.metadata&&q.metadata.source_key,key);
 })||null;
}
function sortQuestions(items){
 return (items||[]).slice().sort(function(a,b){
  var levelDiff=(Number(a&&a.level)||0)-(Number(b&&b.level)||0);
  if(levelDiff)return levelDiff;
  return sourceKey(a).localeCompare(sourceKey(b),undefined,{numeric:true,sensitivity:'base'});
 });
}
function buildPreviewBank(items,startQuestion){
 bank=sortQuestions(items);
 if(!startQuestion){previewBank=[];currentIndex=-1;return}
 previewBank=bank.filter(function(q){return Number(q&&q.level)===Number(startQuestion.level)&&clean(q&&q.type)===clean(startQuestion.type)});
 previewBank=sortQuestions(previewBank);
 currentIndex=previewBank.findIndex(function(q){return same(q&&q.id,startQuestion.id)});
 if(currentIndex<0){previewBank=[startQuestion];currentIndex=0}
}
function updateUrl(){
 if(!question)return;
 var url=new URL(location.href);url.searchParams.set('question',sourceKey(question));url.searchParams.delete('q');
 history.replaceState(null,'',url.pathname+url.search+url.hash);
 window.WillenaQuestionPreviewKey=sourceKey(question);
}
function selectIndex(index){
 if(!previewBank.length)return;
 index=Math.max(0,Math.min(previewBank.length-1,index));
 currentIndex=index;question=previewBank[index];updateUrl();renderPreview();
}
function installStyle(){
 if(document.getElementById('visitorQuestionPreviewStyle'))return;
 var s=document.createElement('style');
 s.id='visitorQuestionPreviewStyle';
 s.textContent='.candidate-flow,.visitor-v2-overlay{display:none!important}.visitor-question-preview{width:min(900px,100%);margin:0 auto}.visitor-question-preview-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 14px;padding:11px 14px;border:1px dashed #b9cad4;border-radius:14px;background:#f7fafc;color:#64748b;font:600 12px/1.4 Poppins,system-ui,sans-serif}.visitor-question-preview-bar strong{color:#17243f}.visitor-question-preview-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.visitor-question-preview button.preview-tool{border:0;border-radius:10px;padding:8px 12px;font:700 12px Poppins,system-ui,sans-serif;cursor:pointer}.visitor-question-preview button.preview-tool:disabled{opacity:.35;cursor:default}.visitor-question-preview-nav{background:#e9f5f7;color:#176b72}.visitor-question-preview-answer{background:#17243f;color:#fff}.visitor-question-preview-answerbox{margin:0 0 14px;padding:12px 14px;border-radius:14px;background:#eefaf7;color:#176b57;font:700 14px Poppins,system-ui,sans-serif}.visitor-question-preview .choice.selected{outline:3px solid rgba(37,185,197,.28);border-color:#25b9c5}.visitor-question-preview .scramble-bank{margin-top:14px}.visitor-question-preview-loading{width:min(900px,100%);margin:0 auto;padding:36px 24px;text-align:center;color:#64748b;font:700 14px Poppins,system-ui,sans-serif}@media(max-width:520px){.visitor-question-preview-tools{width:100%;display:grid;grid-template-columns:1fr 1fr}.visitor-question-preview-answer{grid-column:1/-1}}';
 document.head.appendChild(s);
}
function renderLoading(){
 if(rendering)return;
 rendering=true;installStyle();document.body.classList.remove('welcome-mode');
 root.innerHTML='<section class="screen screen-safe-in screen-safe-ready"><div class="visitor-question-preview-loading">Loading question…</div></section>';
 rendering=false;
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
 rendering=true;installStyle();document.body.classList.remove('welcome-mode');
 root.innerHTML='<section class="screen screen-safe-in screen-safe-ready"><div class="visitor-question-preview"><div class="visitor-question-preview-bar"><strong>Question preview</strong><span>'+esc(requested)+'</span></div><div class="question-card"><p class="prompt">'+esc(message)+'</p></div></div></section>';
 rendering=false;
}
function renderPreview(){
 if(!bankReady||!appReady||rendering)return;
 if(!question){renderError('Question not found in the published level-test bank.');return}
 rendering=true;installStyle();document.body.classList.remove('welcome-mode');
 if(window.speechSynthesis)window.speechSynthesis.cancel();
 var type=clean(question.type),body=type==='listening'?listeningHtml(question):(type==='sentence_unscramble'?scrambleHtml(question):normalHtml(question));
 var pos=currentIndex>=0?(currentIndex+1)+' / '+previewBank.length:'';
 root.innerHTML='<section class="screen screen-safe-in screen-safe-ready"><div class="visitor-question-preview"><div class="visitor-question-preview-bar"><span><strong>'+esc(sourceKey(question))+'</strong> · internal '+esc(question.level)+' · '+esc(type)+(pos?' · '+esc(pos):'')+'</span><div class="visitor-question-preview-tools"><button class="preview-tool visitor-question-preview-nav" id="previewPrev" type="button" '+(currentIndex<=0?'disabled':'')+'>← Previous</button><button class="preview-tool visitor-question-preview-nav" id="previewNext" type="button" '+(currentIndex<0||currentIndex>=previewBank.length-1?'disabled':'')+'>Next →</button><button class="preview-tool visitor-question-preview-answer" id="previewAnswer" type="button">Show answer</button></div></div><div id="previewAnswerBox" class="visitor-question-preview-answerbox" hidden>Answer: '+esc(Array.isArray(question.a)?question.a.join(' '):question.a)+'</div><div class="question-card" data-question-id="'+esc(question.id)+'" data-question-level="'+esc(question.level)+'">'+body+'</div></div></section>';
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
 var prev=e.target.closest('#previewPrev');if(prev&&!prev.disabled){e.preventDefault();e.stopImmediatePropagation();selectIndex(currentIndex-1);return}
 var next=e.target.closest('#previewNext');if(next&&!next.disabled){e.preventDefault();e.stopImmediatePropagation();selectIndex(currentIndex+1);return}
 var answer=e.target.closest('#previewAnswer');if(answer){var box=root.querySelector('#previewAnswerBox');if(box){box.hidden=!box.hidden;answer.textContent=box.hidden?'Show answer':'Hide answer'}return}
 var choice=e.target.closest('.choice');if(choice){root.querySelectorAll('.choice').forEach(function(x){x.classList.remove('selected')});choice.classList.add('selected');e.stopImmediatePropagation();}
},true);
window.addEventListener('keydown',function(e){
 if(!window.WillenaQuestionPreviewActive||e.altKey||e.ctrlKey||e.metaKey)return;
 if(e.key==='ArrowLeft'&&currentIndex>0){e.preventDefault();selectIndex(currentIndex-1)}
 if(e.key==='ArrowRight'&&currentIndex>=0&&currentIndex<previewBank.length-1){e.preventDefault();selectIndex(currentIndex+1)}
});

renderLoading();
observer=new MutationObserver(function(){
 if(rendering)return;
 if(!bankReady){
  if(!root.querySelector('.visitor-question-preview-loading'))renderLoading();
  return;
 }
 if(!root.querySelector('.visitor-question-preview'))renderPreview();
});
observer.observe(root,{childList:true,subtree:true});

if(typeof window.loadQuestionBank!=='function'){bankReady=true;renderError('Question bank loader is not available.');return}
window.loadQuestionBank().then(function(items){
 question=findQuestion(items,requested);buildPreviewBank(items,question);bankReady=true;updateUrl();renderPreview();
}).catch(function(error){bankReady=true;question=null;renderError(error&&error.message||'Could not load the question bank.')});
})();
