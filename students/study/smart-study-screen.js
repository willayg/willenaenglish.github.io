(function(global){
'use strict';
var CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var HEADERS={apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY};
var TARGET=12,engine=null,pool=[],queue=[],baseIds=new Set(),settled=new Set(),current=null,answered=false,previousScroll=0;
var card=document.querySelector('.unit-progress-card'),ring=document.querySelector('.progress-ring'),title=document.getElementById('smartProgressTitle'),copy=document.getElementById('smartProgressCopy'),pctEl=document.getElementById('smartDailyPct');
var panel=document.getElementById('smartPracticePanel'),root=document.getElementById('smartActivityRoot'),closeBtn=document.getElementById('smartClose'),countEl=document.getElementById('smartCount');
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function unique(a){var o=[];a.forEach(function(x){if(x!=null&&o.indexOf(x)<0)o.push(x);});return o;}
function shuffle(a){return a.slice().sort(function(){return Math.random()-.5;});}
function dateKey(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function context(){var b=document.getElementById('bookTitle'),u=document.getElementById('unitTitle');return{book:String(b&&b.textContent||'').trim(),unit:String(u&&u.textContent||'').trim()};}
function unitNumber(text){var m=String(text||'').match(/Unit\s*(\d+)/i);return m?m[1]:'';}
function contextKey(){var c=context();return c.book+'|'+c.unit;}
function dailyKey(){return'willena-smart-daily-v1|'+dateKey()+'|'+contextKey();}
function wrongKey(){return'willena-smart-wrong-v1|'+contextKey();}
function readJson(k,fallback){try{var v=JSON.parse(localStorage.getItem(k)||'null');return v==null?fallback:v;}catch(_){return fallback;}}
function writeJson(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}}
function dailyCount(){var n=Number(readJson(dailyKey(),0));return Number.isFinite(n)?n:0;}
function addDaily(){writeJson(dailyKey(),dailyCount()+1);paint();}
function wrongIds(){var v=readJson(wrongKey(),[]);return Array.isArray(v)?v:[];}
function rememberWrong(id){writeJson(wrongKey(),unique(wrongIds().concat(id)));}
function clearWrong(id){writeJson(wrongKey(),wrongIds().filter(function(x){return x!==id;}));}
function ready(){var c=context();return c.book&&!/^Loading/i.test(c.book)&&unitNumber(c.unit);}
function paint(){if(!ring)return;var pct=ready()?Math.round(dailyCount()/TARGET*100):0,fill=Math.min(100,pct);ring.style.background='conic-gradient(var(--pink) 0 '+fill+'%,#dff5f7 '+fill+'% 100%)';if(pctEl)pctEl.textContent=pct+'%';if(title)title.textContent='Smart Study';if(copy)copy.textContent='오늘 목표 '+TARGET+'문항 · 탭해서 시작';}
async function get(path){var r=await fetch(CONTENT_URL+'/rest/v1/'+path,{headers:HEADERS,cache:'no-store'});if(!r.ok)throw new Error('Content DB '+r.status);return r.json();}
function cleanTokens(text){return String(text||'').trim().replace(/[.!?]+$/,'').split(/\s+/).filter(Boolean);}
function letters(text){return String(text||'').toLowerCase().replace(/[^a-z]/g,'').split('');}
function choices(correct,all){return shuffle(unique([correct].concat(shuffle(all.filter(function(x){return x&&x!==correct;})).slice(0,3))));}
function lexicalContext(x){var meta=x&&x.metadata||{},examples=Array.isArray(meta.sense_examples)?meta.sense_examples:[];if(meta.multiple_meanings||String(x.translation_ko||'').indexOf('/')>=0){var english=examples.map(function(row){return row&&row.en;}).filter(Boolean).slice(0,2);return '문맥에 따라 뜻이 달라질 수 있어요.'+(english.length?'\n예: '+english.join(' · '):'');}return '한국어 뜻을 고르세요.';}
async function buildPool(){
 var c=context(),m=unitNumber(c.unit);if(!c.book||!m)throw new Error('Book/unit not ready');
 var books=await get('content_books?select=id,title&title=eq.'+encodeURIComponent(c.book)+'&status=in.(review,published)&limit=1');if(!books.length)throw new Error('Book not found');
 var units=await get('content_units?select=id,unit_number,title&book_id=eq.'+books[0].id+'&unit_number=eq.'+m+'&status=in.(review,published)&limit=1');if(!units.length)throw new Error('Unit not found');var bookId=books[0].id,unitId=units[0].id;
 var occ=await get('source_content_occurrences?select=id,lexical_entry_id,sentence_id,occurrence_type&unit_id=eq.'+unitId+'&occurrence_type=in.(lexical_entry,sentence)&status=in.(review,published)');
 var lexIds=unique(occ.map(function(o){return o.lexical_entry_id;}).filter(Boolean)),senIds=unique(occ.map(function(o){return o.sentence_id;}).filter(Boolean));
 var lex=lexIds.length?await get('lexical_entries?select=id,canonical_text,translation_ko,emoji,definition_en,metadata&id=in.'+encodeURIComponent('('+lexIds.join(',')+')')+'&status=in.(review,published)'):[];
 var sen=senIds.length?await get('sentences?select=id,text,translation_ko&id=in.'+encodeURIComponent('('+senIds.join(',')+')')+'&status=in.(review,published)'):[];
 var byLex={},bySen={};lex.forEach(function(x){byLex[x.id]=x;});sen.forEach(function(x){bySen[x.id]=x;});var koPool=lex.map(function(x){return x.translation_ko;}).filter(Boolean),out=[];
 occ.forEach(function(o){var x=o.lexical_entry_id&&byLex[o.lexical_entry_id];if(x){var word=String(x.canonical_text||'').trim(),ko=String(x.translation_ko||'').trim();if(word&&ko){var c1=choices(ko,koPool);if(c1.length>=2)out.push({id:'smart-vocab-'+o.id,sourceType:'lexical_entry',sourceId:x.id,skill:'vocabulary',usage:['practice'],stimulus:{type:'text',prompt:(x.emoji?x.emoji+'  ':'')+word,context:lexicalContext(x)},response:{type:'multiple_choice',choices:c1},answer:ko,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:o.id,smart_study:true}});var ls=letters(word);if(ls.length>=2)out.push({id:'smart-spell-'+o.id,sourceType:'lexical_entry',sourceId:x.id,skill:'spelling',usage:['practice'],stimulus:{type:'text',prompt:ko,context:'글자를 눌러 영어 단어를 만드세요.'},response:{type:'letter_order',tokens:ls,wordLengths:word.split(/\s+/).map(function(p){return p.replace(/[^a-z]/gi,'').length;}).filter(Boolean)},answer:word,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:o.id,smart_study:true}});}}
 var s=o.sentence_id&&bySen[o.sentence_id];if(s){var ts=cleanTokens(s.text);if(ts.length>=3&&ts.length<=12&&!/[+\/]/.test(s.text||''))out.push({id:'smart-sentence-'+o.id,sourceType:'sentence',sourceId:s.id,skill:'sentence_building',usage:['practice'],stimulus:{type:'text',prompt:s.translation_ko||'문장을 올바른 순서로 만드세요.',context:'문장 만들기'},response:{type:'token_order',tokens:ts},answer:s.text,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:o.id,smart_study:true}});}});
 pool=out;
}
function showSmartScreen(){previousScroll=window.scrollY||0;panel.hidden=false;panel.style.position='fixed';panel.style.inset='0';panel.style.zIndex='10000';panel.style.margin='0';panel.style.borderRadius='0';panel.style.width='100vw';panel.style.height='100dvh';panel.style.maxHeight='100dvh';panel.style.overflowY='auto';panel.style.overflowX='hidden';panel.style.boxSizing='border-box';panel.style.background='linear-gradient(180deg,#dff7f8 0,#effafb 34%,#f7fafb 100%)';panel.style.padding='clamp(12px,3.5vw,34px)';panel.scrollTop=0;}
function closeSmartScreen(){panel.hidden=true;paint();window.scrollTo({top:previousScroll,left:0,behavior:'auto'});}
function makeSession(){var prior=wrongIds().map(function(id){return pool.find(function(a){return a.id===id;});}).filter(Boolean),chosen=prior.slice(0,TARGET);shuffle(pool).forEach(function(a){if(chosen.length<TARGET&&!chosen.some(function(x){return x.id===a.id;}))chosen.push(a);});queue=chosen.slice();baseIds=new Set(chosen.map(function(a){return a.id;}));settled=new Set();renderNext();}
function renderNext(){if(!queue.length){finish();return;}current=queue.shift();answered=false;countEl.textContent=(settled.size+1)+' / '+TARGET;engine=new WillenaActivityEngine(root,{onAnswer:function(){}});engine.setActivity(current);panel.scrollTop=0;}
function turnCheckIntoNext(){var check=root.querySelector('.activity-check');if(!check)return;var replacement=check.cloneNode(true);replacement.disabled=false;replacement.textContent=queue.length?'다음':'완료';check.replaceWith(replacement);replacement.addEventListener('click',renderNext,{once:true});}
function onAnswer(e){if(panel.hidden||!current||answered)return;var d=e.detail||{},a=d.activity||{},r=d.result||{};if(a.id!==current.id)return;answered=true;if(r.correct){clearWrong(current.id);if(baseIds.has(current.id)&&!settled.has(current.id)){settled.add(current.id);addDaily();}}else{rememberWrong(current.id);queue.push(current);}turnCheckIntoNext();}
function finish(){countEl.textContent='완료';root.innerHTML='<div class="activity-card smart-finish"><div class="smart-confetti" aria-hidden="true">🎉 ✨ 🎊 ⭐ 🎉</div><span class="eyebrow">SMART STUDY</span><h2>잘했어요!</h2><p>'+TARGET+'개 목표를 모두 끝냈어요.</p><p class="smart-finish-note">틀린 문제도 다시 연습해서 맞혔습니다. 오늘 공부 완료!</p><button type="button" class="activity-check smart-home-button">학습 화면으로 돌아가기</button></div>';var back=root.querySelector('.smart-home-button');if(back)back.addEventListener('click',closeSmartScreen,{once:true});paint();}
async function start(e){if(e){e.preventDefault();e.stopPropagation();}if(!ready())return;showSmartScreen();root.innerHTML='<div class="study-loading">Smart Study 준비 중…</div>';countEl.textContent='— / '+TARGET;try{pool=[];await buildPool();if(!pool.length)throw new Error('No practice activities');makeSession();}catch(err){root.innerHTML='<div class="study-loading">Smart Study를 불러오지 못했습니다. '+esc(err.message||err)+'</div>';}}
if(!card||!panel)return;card.setAttribute('role','button');card.setAttribute('tabindex','0');card.setAttribute('aria-label','Start Smart Study');card.style.cursor='pointer';card.addEventListener('click',start,true);card.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){start(e);}},true);closeBtn.addEventListener('click',closeSmartScreen);global.addEventListener('willena:activity-answer',onAnswer);paint();var tries=0,t=setInterval(function(){tries++;paint();if(ready()&&tries>5||tries>30)clearInterval(t);},350);window.addEventListener('pageshow',function(){setTimeout(paint,100);});
})(window);