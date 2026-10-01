(function(){
'use strict';
var params=new URLSearchParams(location.search);
var requested=String(params.get('question')||params.get('q')||'').trim();
var browse=params.get('browse')==='1'||params.get('questions')==='all'||requested.toLowerCase()==='all';
if(!requested&&!browse)return;
window.WillenaQuestionPreviewActive=true;
window.WillenaQuestionPreviewKey=requested;

var root=document.querySelector('#app');
if(!root)return;
var question=null,bankReady=false,appReady=true,rendering=false;
var bank=[],previewBank=[],currentIndex=-1;
var observer=null;
var browserState={level:'all',type:'all',images:'all',search:''};

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function clean(v){return String(v==null?'':v).trim()}
function same(a,b){return clean(a).toLowerCase()===clean(b).toLowerCase()}
function sourceKey(q){return clean(q&&q.metadata&&q.metadata.source_key||q&&q.id)}
function promptText(q){return clean(q&&q.q||q&&q.prompt||q&&q.prompt_text||q&&q.metadata&&q.metadata.prompt_text)}
function hasImages(q){
 if(!q)return false;
 if(clean(q.renderKind)==='image_choice')return true;
 if(Array.isArray(q.options)&&q.options.some(function(o){return o&&(clean(o.kind)==='image'||clean(o.assetKey||o.asset_key)||clean(o.src||o.image_src||o.url))}))return true;
 var m=q.metadata||{};
 return Boolean(m.choice_visuals||m.choice_assets||m.option_visuals||m.image||m.image_url||m.visual_key);
}
function imageUrls(q){
 var urls=[];
 var assets=window.WillenaAssessmentAssets;
 function add(v){
  if(!v)return;
  var u='';
  if(typeof v==='string'){
   if(/^https?:\/\//i.test(v)||v.charAt(0)==='/')u=v;
   else if(assets&&typeof assets.resolve==='function')u=assets.resolve(v)||'';
  }else if(typeof v==='object'){
   u=clean(v.src||v.image_src||v.url);
   if(!u){
    var key=clean(v.assetKey||v.asset_key);
    if(key&&assets&&typeof assets.resolve==='function')u=assets.resolve(key)||'';
   }
  }
  if(u&&urls.indexOf(u)<0)urls.push(u);
 }
 (q.options||[]).forEach(function(o){if(o&&(clean(o.kind)==='image'||o.assetKey||o.asset_key||o.src||o.image_src||o.url))add(o)});
 var m=q.metadata||{};
 [m.image,m.image_url].forEach(add);
 var visuals=m.choice_visuals||m.choice_assets||m.option_visuals;
 if(Array.isArray(visuals))visuals.forEach(add);
 else if(visuals&&typeof visuals==='object')Object.keys(visuals).forEach(function(k){add(visuals[k])});
 return urls.slice(0,6);
}
function findQuestion(items,key){
 return (items||[]).find(function(q){
  return same(q&&q.id,key)||same(q&&q.sourceId,key)||same(q&&q.metadata&&q.metadata.source_key,key);
 })||null;
}
function sortQuestions(items){
 return (items||[]).slice().sort(function(a,b){
  var levelDiff=(Number(a&&a.level)||0)-(Number(b&&b.level)||0);
  if(levelDiff)return levelDiff;
  var typeDiff=clean(a&&a.type).localeCompare(clean(b&&b.type));
  if(typeDiff)return typeDiff;
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
 var url=new URL(location.href);url.searchParams.set('question',sourceKey(question));url.searchParams.delete('q');url.searchParams.delete('browse');url.searchParams.delete('questions');
 history.replaceState(null,'',url.pathname+url.search+url.hash);
 window.WillenaQuestionPreviewKey=sourceKey(question);
}
function selectQuestion(q){
 if(!q)return;
 question=q;buildPreviewBank(bank,q);updateUrl();renderPreview();
}
function selectIndex(index){
 if(!previewBank.length)return;
 index=Math.max(0,Math.min(previewBank.length-1,index));
 currentIndex=index;question=previewBank[index];updateUrl();renderPreview();
}
function browserUrl(){
 var url=new URL(location.href);url.searchParams.delete('question');url.searchParams.delete('q');url.searchParams.delete('questions');url.searchParams.set('browse','1');return url.pathname+url.search+url.hash;
}
function installStyle(){
 if(document.getElementById('visitorQuestionPreviewStyle'))return;
 var s=document.createElement('style');
 s.id='visitorQuestionPreviewStyle';
 s.textContent='.candidate-flow,.visitor-v2-overlay{display:none!important}.visitor-question-preview{width:min(980px,100%);margin:0 auto}.visitor-question-preview-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 14px;padding:11px 14px;border:1px dashed #b9cad4;border-radius:14px;background:#f7fafc;color:#64748b;font:600 12px/1.4 Poppins,system-ui,sans-serif}.visitor-question-preview-bar strong{color:#17243f}.visitor-question-preview-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.visitor-question-preview button.preview-tool,.question-browser button.preview-tool{border:0;border-radius:10px;padding:8px 12px;font:700 12px Poppins,system-ui,sans-serif;cursor:pointer}.visitor-question-preview button.preview-tool:disabled{opacity:.35;cursor:default}.visitor-question-preview-nav{background:#e9f5f7;color:#176b72}.visitor-question-preview-answer{background:#17243f;color:#fff}.visitor-question-preview-browser{background:#fff0f6;color:#a42f68;border:1px solid #ffd2e3!important}.visitor-question-preview-answerbox{margin:0 0 14px;padding:12px 14px;border-radius:14px;background:#eefaf7;color:#176b57;font:700 14px Poppins,system-ui,sans-serif}.visitor-question-preview .choice.selected{outline:3px solid rgba(37,185,197,.28);border-color:#25b9c5}.visitor-question-preview .scramble-bank{margin-top:14px}.visitor-question-preview-loading{width:min(900px,100%);margin:0 auto;padding:36px 24px;text-align:center;color:#64748b;font:700 14px Poppins,system-ui,sans-serif}.question-browser{width:min(1100px,100%);margin:0 auto}.question-browser-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:14px}.question-browser-head h1{margin:0;color:#17243f;font:800 clamp(24px,4vw,34px)/1.1 Poppins,sans-serif}.question-browser-head p{margin:6px 0 0;color:#738196;font:600 13px Poppins,sans-serif}.question-browser-count{padding:8px 12px;border-radius:999px;background:#e9f8fa;color:#176b72;font:800 12px Poppins,sans-serif}.question-browser-filters{display:grid;grid-template-columns:1.4fr repeat(3,minmax(135px,.7fr));gap:10px;margin:0 0 16px}.question-browser-filters input,.question-browser-filters select{width:100%;min-height:46px;border:1px solid #cfdde1;border-radius:12px;background:#fff;color:#17243f;padding:0 12px;font:600 13px Poppins,sans-serif;outline:0}.question-browser-filters input:focus,.question-browser-filters select:focus{border-color:#25b9c5;box-shadow:0 0 0 3px rgba(37,185,197,.12)}.question-browser-list{display:grid;gap:9px}.question-browser-row{display:grid;grid-template-columns:92px minmax(150px,.9fr) 95px 150px minmax(0,2fr) auto;align-items:center;gap:10px;width:100%;text-align:left;border:1px solid #dce8eb;border-radius:14px;background:#fff;padding:12px 14px;cursor:pointer;box-shadow:0 6px 16px rgba(23,66,83,.04)}.question-browser-row:hover{border-color:#95d9df;background:#fbfeff}.question-browser-thumb{width:82px;height:62px;border:1px solid #dce8eb;border-radius:10px;background:#f8fbfc;display:flex;align-items:center;justify-content:center;gap:3px;overflow:hidden}.question-browser-thumb img{max-width:100%;max-height:100%;object-fit:contain}.question-browser-thumb.multi img{width:48%;height:100%}.question-browser-thumb.empty{color:#a7b3bc;font:700 10px Poppins,sans-serif}.question-browser-key{font:800 12px Poppins,sans-serif;color:#17243f;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.question-browser-meta{font:700 11px Poppins,sans-serif;color:#718096}.question-browser-prompt{font:600 12px/1.4 Poppins,sans-serif;color:#425466;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.question-browser-badges{display:flex;gap:5px;justify-content:flex-end}.question-browser-badge{display:inline-flex;align-items:center;justify-content:center;padding:5px 8px;border-radius:999px;background:#f3f6f8;color:#5e7180;font:800 10px Poppins,sans-serif;white-space:nowrap}.question-browser-badge.image{background:#fff0f6;color:#a42f68}.question-browser-empty{padding:34px;border:1px dashed #cfdde1;border-radius:14px;background:#fff;text-align:center;color:#718096;font:700 13px Poppins,sans-serif}@media(max-width:760px){.question-browser-filters{grid-template-columns:1fr 1fr}.question-browser-filters input{grid-column:1/-1}.question-browser-row{grid-template-columns:1fr auto;gap:5px 10px}.question-browser-thumb{grid-column:1;grid-row:1/4;width:74px;height:58px}.question-browser-key{grid-column:2}.question-browser-meta{grid-column:2}.question-browser-prompt{grid-column:1/-1;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.question-browser-badges{grid-column:2;grid-row:1/3;align-self:center}.visitor-question-preview-tools{width:100%;display:grid;grid-template-columns:1fr 1fr}.visitor-question-preview-answer,.visitor-question-preview-browser{grid-column:auto}}@media(max-width:480px){.question-browser-filters{grid-template-columns:1fr}.question-browser-filters input{grid-column:auto}}';
 document.head.appendChild(s);
}
function renderLoading(){
 if(rendering)return;
 rendering=true;installStyle();document.body.classList.remove('welcome-mode');
 root.innerHTML='<section class="screen screen-safe-in screen-safe-ready"><div class="visitor-question-preview-loading">Loading question bank…</div></section>';
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
 root.innerHTML='<section class="screen screen-safe-in screen-safe-ready"><div class="visitor-question-preview"><div class="visitor-question-preview-bar"><strong>Question preview</strong><div class="visitor-question-preview-tools"><button class="preview-tool visitor-question-preview-browser" id="previewAll" type="button">All Questions</button></div></div><div class="question-card"><p class="prompt">'+esc(message)+'</p></div></div></section>';
 rendering=false;
}
function filteredQuestions(){
 var search=browserState.search.toLowerCase();
 return bank.filter(function(q){
  if(browserState.level!=='all'&&String(Number(q.level))!==browserState.level)return false;
  if(browserState.type!=='all'&&clean(q.type)!==browserState.type)return false;
  var image=hasImages(q);
  if(browserState.images==='yes'&&!image)return false;
  if(browserState.images==='no'&&image)return false;
  if(search){
   var hay=[sourceKey(q),promptText(q),clean(q.type),String(q.level)].join(' ').toLowerCase();
   if(hay.indexOf(search)<0)return false;
  }
  return true;
 });
}
function renderBrowser(){
 if(!bankReady||rendering)return;
 rendering=true;installStyle();document.body.classList.remove('welcome-mode');
 var levels=[...new Set(bank.map(function(q){return Number(q.level)}).filter(Boolean))].sort(function(a,b){return a-b});
 var types=[...new Set(bank.map(function(q){return clean(q.type)}).filter(Boolean))].sort();
 var shown=filteredQuestions();
 root.innerHTML='<section class="screen screen-safe-in screen-safe-ready"><div class="question-browser"><div class="question-browser-head"><div><h1>All Questions</h1><p>Published visitor level-test question bank</p></div><span class="question-browser-count">'+shown.length+' / '+bank.length+'</span></div><div class="question-browser-filters"><input id="questionBrowserSearch" type="search" placeholder="Search question text or source key…" value="'+esc(browserState.search)+'"><select id="questionBrowserLevel"><option value="all">All levels</option>'+levels.map(function(l){return '<option value="'+l+'" '+(browserState.level===String(l)?'selected':'')+'>Internal '+l+'</option>'}).join('')+'</select><select id="questionBrowserType"><option value="all">All types</option>'+types.map(function(t){return '<option value="'+esc(t)+'" '+(browserState.type===t?'selected':'')+'>'+esc(t)+'</option>'}).join('')+'</select><select id="questionBrowserImages"><option value="all" '+(browserState.images==='all'?'selected':'')+'>All image states</option><option value="yes" '+(browserState.images==='yes'?'selected':'')+'>Has images</option><option value="no" '+(browserState.images==='no'?'selected':'')+'>No images</option></select></div><div class="question-browser-list">'+(shown.length?shown.map(function(q){var imgs=imageUrls(q);var thumb=imgs.length?'<span class="question-browser-thumb '+(imgs.length>1?'multi':'')+'">'+imgs.slice(0,2).map(function(src){return '<img src="'+esc(src)+'" alt="" loading="lazy">'}).join('')+'</span>':'<span class="question-browser-thumb empty">'+(hasImages(q)?'Broken / unresolved':'No image')+'</span>';return '<button class="question-browser-row" type="button" data-browser-question="'+esc(sourceKey(q))+'">'+thumb+'<span class="question-browser-key">'+esc(sourceKey(q))+'</span><span class="question-browser-meta">Internal '+esc(q.level)+'</span><span class="question-browser-meta">'+esc(q.type)+'</span><span class="question-browser-prompt">'+esc(promptText(q)||'(No prompt text)')+'</span><span class="question-browser-badges">'+(hasImages(q)?'<span class="question-browser-badge image">Image</span>':'')+(q.type==='listening'?'<span class="question-browser-badge">Audio</span>':'')+'</span></button>'}).join(''):'<div class="question-browser-empty">No questions match these filters.</div>')+'</div></div></section>';
 rendering=false;
 history.replaceState(null,'',browserUrl());
}
function renderPreview(){
 if(!bankReady||!appReady||rendering)return;
 if(!question){renderError('Question not found in the published level-test bank.');return}
 rendering=true;installStyle();document.body.classList.remove('welcome-mode');
 if(window.speechSynthesis)window.speechSynthesis.cancel();
 var type=clean(question.type),body=type==='listening'?listeningHtml(question):(type==='sentence_unscramble'?scrambleHtml(question):normalHtml(question));
 var pos=currentIndex>=0?(currentIndex+1)+' / '+previewBank.length:'';
 root.innerHTML='<section class="screen screen-safe-in screen-safe-ready"><div class="visitor-question-preview"><div class="visitor-question-preview-bar"><span><strong>'+esc(sourceKey(question))+'</strong> · internal '+esc(question.level)+' · '+esc(type)+(pos?' · '+esc(pos):'')+(hasImages(question)?' · image':'')+'</span><div class="visitor-question-preview-tools"><button class="preview-tool visitor-question-preview-browser" id="previewAll" type="button">All Questions</button><button class="preview-tool visitor-question-preview-nav" id="previewPrev" type="button" '+(currentIndex<=0?'disabled':'')+'>← Previous</button><button class="preview-tool visitor-question-preview-nav" id="previewNext" type="button" '+(currentIndex<0||currentIndex>=previewBank.length-1?'disabled':'')+'>Next →</button><button class="preview-tool visitor-question-preview-answer" id="previewAnswer" type="button">Show answer</button></div></div><div id="previewAnswerBox" class="visitor-question-preview-answerbox" hidden>Answer: '+esc(Array.isArray(question.a)?question.a.join(' '):question.a)+'</div><div class="question-card" data-question-id="'+esc(question.id)+'" data-question-level="'+esc(question.level)+'">'+body+'</div></div></section>';
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
function browserChanged(){
 var s=root.querySelector('#questionBrowserSearch'),l=root.querySelector('#questionBrowserLevel'),t=root.querySelector('#questionBrowserType'),i=root.querySelector('#questionBrowserImages');
 if(s)browserState.search=s.value;if(l)browserState.level=l.value;if(t)browserState.type=t.value;if(i)browserState.images=i.value;renderBrowser();
}
root.addEventListener('input',function(e){if(e.target&&e.target.id==='questionBrowserSearch'){browserState.search=e.target.value;renderBrowser();var box=root.querySelector('#questionBrowserSearch');if(box){box.focus();box.setSelectionRange(box.value.length,box.value.length)}}},true);
root.addEventListener('change',function(e){if(e.target&&/^questionBrowser(Level|Type|Images)$/.test(e.target.id))browserChanged()},true);
root.addEventListener('click',function(e){
 if(!window.WillenaQuestionPreviewActive)return;
 var browseButton=e.target.closest('#previewAll');if(browseButton){e.preventDefault();e.stopImmediatePropagation();question=null;requested='';renderBrowser();return}
 var browserQuestion=e.target.closest('[data-browser-question]');if(browserQuestion){e.preventDefault();e.stopImmediatePropagation();selectQuestion(findQuestion(bank,browserQuestion.getAttribute('data-browser-question')));return}
 var play=e.target.closest('#previewPlayAudio');if(play){e.preventDefault();e.stopImmediatePropagation();speak();return}
 var prev=e.target.closest('#previewPrev');if(prev&&!prev.disabled){e.preventDefault();e.stopImmediatePropagation();selectIndex(currentIndex-1);return}
 var next=e.target.closest('#previewNext');if(next&&!next.disabled){e.preventDefault();e.stopImmediatePropagation();selectIndex(currentIndex+1);return}
 var answer=e.target.closest('#previewAnswer');if(answer){var box=root.querySelector('#previewAnswerBox');if(box){box.hidden=!box.hidden;answer.textContent=box.hidden?'Show answer':'Hide answer'}return}
 var choice=e.target.closest('.choice');if(choice){root.querySelectorAll('.choice').forEach(function(x){x.classList.remove('selected')});choice.classList.add('selected');e.stopImmediatePropagation();}
},true);
window.addEventListener('keydown',function(e){
 if(!window.WillenaQuestionPreviewActive||browse||root.querySelector('.question-browser')||e.altKey||e.ctrlKey||e.metaKey)return;
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
 if(browse&&!root.querySelector('.question-browser'))renderBrowser();
 else if(!browse&&!root.querySelector('.visitor-question-preview'))renderPreview();
});
observer.observe(root,{childList:true,subtree:true});

if(typeof window.loadQuestionBank!=='function'){bankReady=true;renderError('Question bank loader is not available.');return}
window.loadQuestionBank().then(function(items){
 bank=sortQuestions(items);
 if(browse){bankReady=true;renderBrowser();return}
 question=findQuestion(bank,requested);buildPreviewBank(bank,question);bankReady=true;updateUrl();renderPreview();
}).catch(function(error){bankReady=true;question=null;renderError(error&&error.message||'Could not load the question bank.')});
})();