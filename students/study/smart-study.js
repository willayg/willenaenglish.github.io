(function(global){
'use strict';
var CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var HEADERS={apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY};
var TARGET=12,engine=null,pool=[],queue=[],baseIds=new Set(),settled=new Set(),current=null,answered=false;
var card,ring,title,copy,panel,root,nextBtn,closeBtn,countEl;
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function unique(a){var o=[];a.forEach(function(x){if(x!=null&&o.indexOf(x)<0)o.push(x);});return o;}
function shuffle(a){return a.slice().sort(function(){return Math.random()-.5;});}
function dateKey(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function contextKey(){return String(document.getElementById('bookTitle').textContent||'book')+'|'+String(document.getElementById('unitTitle').textContent||'unit');}
function dailyKey(){return'willena-smart-daily-v1|'+dateKey()+'|'+contextKey();}
function wrongKey(){return'willena-smart-wrong-v1|'+contextKey();}
function readJson(k,fallback){try{var v=JSON.parse(localStorage.getItem(k)||'null');return v==null?fallback:v;}catch(_){return fallback;}}
function writeJson(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}}
function dailyCount(){var v=Number(readJson(dailyKey(),0));return Number.isFinite(v)?v:0;}
function addDaily(){writeJson(dailyKey(),dailyCount()+1);updateMeter();}
function wrongIds(){var v=readJson(wrongKey(),[]);return Array.isArray(v)?v:[];}
function setWrong(ids){writeJson(wrongKey(),unique(ids));}
function rememberWrong(id){setWrong(wrongIds().concat(id));}
function clearWrong(id){setWrong(wrongIds().filter(function(x){return x!==id;}));}
function updateMeter(){if(!ring)return;var pct=Math.round(dailyCount()/TARGET*100);ring.style.background='conic-gradient(var(--pink) 0 '+Math.min(100,pct)+'%,#dff5f7 '+Math.min(100,pct)+'% 100%)';ring.querySelector('span').textContent=pct+'%';if(title)title.textContent='Smart Study';if(copy)copy.textContent='오늘 목표 '+TARGET+'문항 · 탭해서 시작';}
async function get(path){var r=await fetch(CONTENT_URL+'/rest/v1/'+path,{headers:HEADERS,cache:'no-store'});if(!r.ok)throw new Error('Content DB '+r.status);return r.json();}
function cleanTokens(text){return String(text||'').trim().replace(/[.!?]+$/,'').split(/\s+/).filter(Boolean);}
function letters(text){return String(text||'').toLowerCase().replace(/[^a-z]/g,'').split('');}
function choices(correct,all){return shuffle(unique([correct].concat(shuffle(all.filter(function(x){return x&&x!==correct;})).slice(0,3))));}
async function buildPool(){
 var bookTitle=String(document.getElementById('bookTitle').textContent||'').trim(),unitText=String(document.getElementById('unitTitle').textContent||''),m=unitText.match(/Unit\s*(\d+)/i);if(!bookTitle||!m)throw new Error('Book/unit not ready');
 var books=await get('content_books?select=id,title&title=eq.'+encodeURIComponent(bookTitle)+'&status=in.(review,published)&limit=1');if(!books.length)throw new Error('Book not found');
 var units=await get('content_units?select=id,unit_number,title&book_id=eq.'+books[0].id+'&unit_number=eq.'+m[1]+'&status=in.(review,published)&limit=1');if(!units.length)throw new Error('Unit not found');var bookId=books[0].id,unitId=units[0].id;
 var occ=await get('source_content_occurrences?select=id,lexical_entry_id,sentence_id,source_text,occurrence_type&unit_id=eq.'+unitId+'&occurrence_type=in.(lexical_entry,sentence)&status=in.(review,published)');
 var lexIds=unique(occ.filter(function(o){return o.lexical_entry_id;}).map(function(o){return o.lexical_entry_id;}));var senIds=unique(occ.filter(function(o){return o.sentence_id;}).map(function(o){return o.sentence_id;}));
 var lex=lexIds.length?await get('lexical_entries?select=id,canonical_text,translation_ko,emoji&id=in.'+encodeURIComponent('('+lexIds.join(',')+')')+'&status=in.(review,published)'):[];
 var sen=senIds.length?await get('sentences?select=id,text,translation_ko&id=in.'+encodeURIComponent('('+senIds.join(',')+')')+'&status=in.(review,published)'):[];
 var byLex={},bySen={};lex.forEach(function(x){byLex[x.id]=x;});sen.forEach(function(x){bySen[x.id]=x;});var koPool=lex.map(function(x){return x.translation_ko;}).filter(Boolean),enPool=lex.map(function(x){return x.canonical_text;}).filter(Boolean),out=[];
 occ.forEach(function(o){if(o.lexical_entry_id&&byLex[o.lexical_entry_id]){var x=byLex[o.lexical_entry_id],word=String(x.canonical_text||'').trim(),ko=String(x.translation_ko||'').trim();if(word&&ko){var c1=choices(ko,koPool);if(c1.length>=2)out.push({id:'smart-vocab-'+o.id,sourceType:'lexical_entry',sourceId:x.id,skill:'vocabulary',usage:['practice'],stimulus:{type:'text',prompt:(x.emoji?x.emoji+'  ':'')+word,context:'한국어 뜻을 고르세요.'},response:{type:'multiple_choice',choices:c1},answer:ko,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:o.id,smart_study:true}});var t=letters(word);if(t.length>=2)out.push({id:'smart-spell-'+o.id,sourceType:'lexical_entry',sourceId:x.id,skill:'spelling',usage:['practice'],stimulus:{type:'text',prompt:ko,context:'글자를 눌러 영어 단어를 만드세요.'},response:{type:'letter_order',tokens:t,wordLengths:word.split(/\s+/).map(function(p){return p.replace(/[^a-z]/gi,'').length;}).filter(Boolean)},answer:word,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:o.id,smart_study:true}});}}
 if(o.sentence_id&&bySen[o.sentence_id]){var s=bySen[o.sentence_id],tokens=cleanTokens(s.text);if(tokens.length>=3&&tokens.length<=12&&!/[+\/]/.test(s.text||''))out.push({id:'smart-sentence-'+o.id,sourceType:'sentence',sourceId:s.id,skill:'sentence_building',usage:['practice'],stimulus:{type:'text',prompt:s.translation_ko||'문장을 올바른 순서로 만드세요.',context:'문장 만들기'},response:{type:'token_order',tokens:tokens},answer:s.text,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:o.id,smart_study:true}});}});
 pool=out;return out;
}
function setScreen(on){['.book-hero','.learning-map-section','.section-block','.lower-grid','#studyStats','#studyPanel','#practicePanel'].forEach(function(sel){var n=document.querySelector(sel);if(n)n.hidden=!!on;});if(panel)panel.hidden=!on;if(on)panel.scrollIntoView({behavior:'smooth',block:'start'});else document.querySelector('.book-hero').scrollIntoView({behavior:'smooth',block:'start'});}
function makeSession(){var missed=wrongIds().map(function(id){return pool.find(function(a){return a.id===id;});}).filter(Boolean);var chosen=missed.slice(0,TARGET);shuffle(pool).forEach(function(a){if(chosen.length<TARGET&&!chosen.some(function(x){return x.id===a.id;}))chosen.push(a);});queue=chosen.slice();baseIds=new Set(chosen.map(function(a){return a.id;}));settled=new Set();answered=false;renderNext();}
function renderNext(){if(!queue.length){finish();return;}current=queue.shift();answered=false;countEl.textContent=(settled.size+1)+' / '+TARGET;engine=new WillenaActivityEngine(root,{onAnswer:function(){}});engine.setActivity(current);nextBtn.disabled=true;}
function onAnswer(e){if(!panel||panel.hidden||!current||answered)return;var d=e.detail||{},a=d.activity||{},r=d.result||{};if(a.id!==current.id)return;answered=true;if(r.correct){clearWrong(current.id);if(baseIds.has(current.id)&&!settled.has(current.id)){settled.add(current.id);addDaily();}}else{rememberWrong(current.id);queue.push(current);}nextBtn.disabled=false;nextBtn.textContent=queue.length?'다음':'완료';}
function finish(){root.innerHTML='<div class="activity-card"><span class="eyebrow">SMART STUDY</span><h2 style="margin:8px 0">오늘 연습 완료</h2><p style="font-weight:700;color:var(--muted)">'+TARGET+'개 목표를 끝냈어요. 틀렸던 문제는 맞힐 때까지 다시 연습했습니다.</p></div>';countEl.textContent='완료';nextBtn.disabled=true;updateMeter();}
async function start(){try{setScreen(true);root.innerHTML='<div class="study-loading">Smart Study 준비 중…</div>';countEl.textContent='— / '+TARGET;if(!pool.length)await buildPool();if(!pool.length)throw new Error('No practice activities');makeSession();}catch(err){root.innerHTML='<div class="study-loading">Smart Study를 불러오지 못했습니다. '+esc(err.message)+'</div>';}}
function mount(){card=document.querySelector('.unit-progress-card');ring=document.querySelector('.progress-ring');title=document.getElementById('progressTitle');copy=document.getElementById('progressCopy');panel=document.getElementById('smartPracticePanel');root=document.getElementById('smartActivityRoot');nextBtn=document.getElementById('smartNext');closeBtn=document.getElementById('smartClose');countEl=document.getElementById('smartCount');if(!card||!panel)return;card.setAttribute('role','button');card.setAttribute('tabindex','0');card.setAttribute('aria-label','Start Smart Study');card.style.cursor='pointer';card.addEventListener('click',start);card.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();start();}});nextBtn.addEventListener('click',renderNext);closeBtn.addEventListener('click',function(){setScreen(false);updateMeter();});global.addEventListener('willena:activity-answer',onAnswer);setTimeout(updateMeter,0);setTimeout(updateMeter,800);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);
