(function(){
'use strict';
var CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var HEADERS={apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY};
var TARGET=12,pool=[],queue=[],baseIds=new Set(),settled=new Set(),current=null,answered=false,engine=null;
var root=document.getElementById('smartActivityRoot'),nextBtn=document.getElementById('smartNext'),contextEl=document.getElementById('smartContext');
var qs=new URLSearchParams(location.search),bookTitle=String(qs.get('book')||'').trim(),unitNo=String(qs.get('unit')||'').trim();
function unique(a){var o=[];a.forEach(function(x){if(x!=null&&o.indexOf(x)<0)o.push(x);});return o;}
function shuffle(a){return a.slice().sort(function(){return Math.random()-.5;});}
function dateKey(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function contextKey(){return bookTitle+'|Unit '+unitNo;}
function dailyKey(){return'willena-smart-daily-v1|'+dateKey()+'|'+contextKey();}
function wrongKey(){return'willena-smart-wrong-v1|'+contextKey();}
function read(k,f){try{var v=JSON.parse(localStorage.getItem(k)||'null');return v==null?f:v;}catch(_){return f;}}
function write(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}}
function count(){var n=Number(read(dailyKey(),0));return Number.isFinite(n)?n:0;}
function addDaily(){write(dailyKey(),count()+1);}
function wrongIds(){var v=read(wrongKey(),[]);return Array.isArray(v)?v:[];}
function rememberWrong(id){write(wrongKey(),unique(wrongIds().concat(id)));}
function clearWrong(id){write(wrongKey(),wrongIds().filter(function(x){return x!==id;}));}
async function get(path){var r=await fetch(CONTENT_URL+'/rest/v1/'+path,{headers:HEADERS,cache:'no-store'});if(!r.ok)throw new Error('Content DB '+r.status);return r.json();}
function letters(text){return String(text||'').toLowerCase().replace(/[^a-z]/g,'').split('');}
function tokens(text){return String(text||'').trim().replace(/[.!?]+$/,'').split(/\s+/).filter(Boolean);}
function choices(correct,all){return shuffle(unique([correct].concat(shuffle(all.filter(function(x){return x&&x!==correct;})).slice(0,3))));}
async function buildPool(){
 if(!bookTitle||!unitNo)throw new Error('Missing book or unit');
 var books=await get('content_books?select=id,title&title=eq.'+encodeURIComponent(bookTitle)+'&status=in.(review,published)&limit=1');if(!books.length)throw new Error('Book not found');
 var units=await get('content_units?select=id,unit_number,title&book_id=eq.'+books[0].id+'&unit_number=eq.'+encodeURIComponent(unitNo)+'&status=in.(review,published)&limit=1');if(!units.length)throw new Error('Unit not found');
 var bookId=books[0].id,unit=units[0],unitId=unit.id;if(contextEl)contextEl.textContent=bookTitle+' · Unit '+unit.unit_number+' · '+(unit.title||'');
 var occ=await get('source_content_occurrences?select=id,lexical_entry_id,sentence_id,occurrence_type&unit_id=eq.'+unitId+'&occurrence_type=in.(lexical_entry,sentence)&status=in.(review,published)');
 var lexIds=unique(occ.map(function(o){return o.lexical_entry_id;}).filter(Boolean)),senIds=unique(occ.map(function(o){return o.sentence_id;}).filter(Boolean));
 var lex=lexIds.length?await get('lexical_entries?select=id,canonical_text,translation_ko,emoji&id=in.'+encodeURIComponent('('+lexIds.join(',')+')')+'&status=in.(review,published)'):[];
 var sen=senIds.length?await get('sentences?select=id,text,translation_ko&id=in.'+encodeURIComponent('('+senIds.join(',')+')')+'&status=in.(review,published)'):[];
 var byLex={},bySen={};lex.forEach(function(x){byLex[x.id]=x;});sen.forEach(function(x){bySen[x.id]=x;});var koPool=lex.map(function(x){return x.translation_ko;}).filter(Boolean),out=[];
 occ.forEach(function(o){var x=o.lexical_entry_id&&byLex[o.lexical_entry_id];if(x){var word=String(x.canonical_text||'').trim(),ko=String(x.translation_ko||'').trim();if(word&&ko){var c=choices(ko,koPool);if(c.length>=2)out.push({id:'smart-vocab-'+o.id,sourceType:'lexical_entry',sourceId:x.id,skill:'vocabulary',usage:['practice'],stimulus:{type:'text',prompt:(x.emoji?x.emoji+'  ':'')+word,context:'한국어 뜻을 고르세요.'},response:{type:'multiple_choice',choices:c},answer:ko,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:o.id,smart_study:true}});var l=letters(word);if(l.length>=2)out.push({id:'smart-spell-'+o.id,sourceType:'lexical_entry',sourceId:x.id,skill:'spelling',usage:['practice'],stimulus:{type:'text',prompt:ko,context:'글자를 눌러 영어 단어를 만드세요.'},response:{type:'letter_order',tokens:l,wordLengths:word.split(/\s+/).map(function(p){return p.replace(/[^a-z]/gi,'').length;}).filter(Boolean)},answer:word,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:o.id,smart_study:true}});}}
 var s=o.sentence_id&&bySen[o.sentence_id];if(s){var ts=tokens(s.text);if(ts.length>=3&&ts.length<=12&&!/[+\/]/.test(s.text||''))out.push({id:'smart-sentence-'+o.id,sourceType:'sentence',sourceId:s.id,skill:'sentence_building',usage:['practice'],stimulus:{type:'text',prompt:s.translation_ko||'문장을 올바른 순서로 만드세요.',context:'문장 만들기'},response:{type:'token_order',tokens:ts},answer:s.text,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:o.id,smart_study:true}});}});
 pool=out;
}
function makeSession(){var prior=wrongIds().map(function(id){return pool.find(function(a){return a.id===id;});}).filter(Boolean),chosen=prior.slice(0,TARGET);shuffle(pool).forEach(function(a){if(chosen.length<TARGET&&!chosen.some(function(x){return x.id===a.id;}))chosen.push(a);});queue=chosen.slice();baseIds=new Set(chosen.map(function(a){return a.id;}));settled=new Set();renderNext();}
function renderNext(){if(!queue.length){finish();return;}current=queue.shift();answered=false;document.getElementById('smartTitle').textContent='오늘의 연습 · '+(settled.size+1)+' / '+TARGET;engine=new WillenaActivityEngine(root,{onAnswer:function(){}});engine.setActivity(current);nextBtn.disabled=true;}
function onAnswer(e){if(!current||answered)return;var d=e.detail||{},a=d.activity||{},r=d.result||{};if(a.id!==current.id)return;answered=true;if(r.correct){clearWrong(current.id);if(baseIds.has(current.id)&&!settled.has(current.id)){settled.add(current.id);addDaily();}}else{rememberWrong(current.id);queue.push(current);}nextBtn.disabled=false;nextBtn.textContent=queue.length?'다음':'완료';}
function finish(){root.innerHTML='<div class="activity-card"><span class="eyebrow">SMART STUDY</span><h2 style="margin:8px 0">오늘 연습 완료</h2><p style="font-weight:700;color:var(--muted)">'+TARGET+'개 목표를 끝냈어요. 틀린 문제는 다시 맞힐 때까지 연습했습니다.</p></div>';document.getElementById('smartTitle').textContent='완료 · '+Math.round(count()/TARGET*100)+'%';nextBtn.disabled=true;}
async function init(){try{await buildPool();if(!pool.length)throw new Error('No practice activities');makeSession();}catch(e){root.innerHTML='<div class="study-loading">Smart Study를 불러오지 못했습니다. '+String(e.message||e)+'</div>';}}
document.getElementById('smartBack').addEventListener('click',function(){location.href='./';});nextBtn.addEventListener('click',renderNext);window.addEventListener('willena:activity-answer',onAnswer);init();
})();