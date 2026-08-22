(function(){
'use strict';
var HOME_PREFIX='willena-study-v2-home:v1:';
var ACTIVE_BOOK_KEY='willena-study-v2-active-book';
var banks=new Map();
var loading=new Map();
var activeRows=[];
var activeIndex=0;
var engine=null;
var preloadTimer=null;
var preloadAttempts=0;

function text(v){return String(v==null?'':v).trim();}
function uid(){try{return text(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function home(){try{var u=uid();if(!u)return null;var raw=localStorage.getItem(HOME_PREFIX+u);if(!raw)return null;var o=JSON.parse(raw);return o&&Array.isArray(o.books)?o:null;}catch(_){return null;}}
function key(book,unit){return String(book.book_id)+':'+String(unit.id);}
function context(book,unit){return{bookId:book.book_id,bookTitle:book.book_title,unitId:unit.id,unitNumber:Number(unit.unit_number),unitTitle:unit.title||''};}
function activeBook(){var h=home();if(!h||!h.books.length)return null;var id='';try{id=localStorage.getItem(ACTIVE_BOOK_KEY)||h.activeBookId||'';}catch(_){id=h.activeBookId||'';}return h.books.find(function(b){return String(b.book_id)===String(id);})||h.books[0];}
async function ensureBank(book,unit){if(!book||!unit||!window.WillenaStudyQuestionBank)return[];var k=key(book,unit);if(banks.has(k))return banks.get(k);if(loading.has(k))return loading.get(k);var started=performance.now();var p=WillenaStudyQuestionBank.loadUnit(null,context(book,unit)).then(function(rows){rows=Array.isArray(rows)?rows:[];banks.set(k,rows);loading.delete(k);console.debug('[StudyV2 Practice] preloaded',book.book_title,'Unit '+unit.unit_number,rows.length+' items',Math.round(performance.now()-started)+'ms');return rows;}).catch(function(err){loading.delete(k);console.warn('[StudyV2 Practice] preload failed',err);return[];});loading.set(k,p);return p;}
function preloadBooks(){var h=home();if(!h||!h.books.length)return false;h.books.slice(0,3).forEach(function(b){if(b&&b.currentUnit)ensureBank(b,b.currentUnit);});return true;}
function startPreload(){if(preloadTimer)return;preloadTimer=setInterval(function(){preloadAttempts++;if(preloadBooks()||preloadAttempts>=20){clearInterval(preloadTimer);preloadTimer=null;}},150);preloadBooks();}
function skillRows(rows,skill){var out=rows.filter(function(a){return a&&a.skill===skill;});return out.length?out:rows;
}
function preferredRows(rows){var grammar=skillRows(rows,'grammar');if(grammar.length&&grammar!==rows)return grammar;var order=['vocabulary','sentence_building','conversation','listening','spelling'];for(var i=0;i<order.length;i++){var found=skillRows(rows,order[i]);if(found.length&&found!==rows)return found;}return rows;}
function langKo(){var b=document.getElementById('languageBtn');return !b||b.textContent.trim()==='English';}
function showPerf(ms,preloaded,count){var n=document.getElementById('practicePerf');if(!n)return;n.textContent=(langKo()?'열기 ':'Open ')+Math.round(ms)+' ms · '+(preloaded?(langKo()?'미리 준비됨':'preloaded'):(langKo()?'방금 불러옴':'loaded now'))+' · '+count+(langKo()?'문항':' items');}
function renderActivity(){if(!activeRows.length)return;var row=activeRows[activeIndex%activeRows.length],root=document.getElementById('v2ActivityRoot');if(!root||!window.WillenaActivityEngine)return;var label=document.getElementById('v2PracticeSkill'),title=document.getElementById('v2PracticeTitle');if(label)label.textContent=langKo()?({grammar:'문법',vocabulary:'어휘',spelling:'철자',sentence_building:'문장 만들기',conversation:'회화',listening:'듣기'}[row.skill]||'연습'):String(row.skill||'Practice').replace('_',' ').toUpperCase();if(title)title.textContent=langKo()?'연습':'Practice';engine=new WillenaActivityEngine(root,{onAnswer:function(){}});engine.setActivity(row);}
async function openPractice(){var clicked=performance.now(),book=activeBook();if(!book||!book.currentUnit)return;var k=key(book,book.currentUnit),wasReady=banks.has(k),rows=await ensureBank(book,book.currentUnit);if(!rows.length){var p=document.getElementById('practicePerf');if(p)p.textContent=langKo()?'이 단원에는 연습 문제가 없습니다.':'No practice items found for this unit.';return;}activeRows=preferredRows(rows);activeIndex=0;document.body.classList.add('study-v2-practice-mode');var panel=document.getElementById('v2PracticePanel');if(panel)panel.hidden=false;renderActivity();showPerf(performance.now()-clicked,wasReady,activeRows.length);window.scrollTo({top:0,behavior:'instant'});}
function closePractice(){document.body.classList.remove('study-v2-practice-mode');var panel=document.getElementById('v2PracticePanel');if(panel)panel.hidden=true;var root=document.getElementById('v2ActivityRoot');if(root)root.innerHTML='';engine=null;window.scrollTo({top:0,behavior:'instant'});}
function next(){if(!activeRows.length)return;activeIndex=(activeIndex+1)%activeRows.length;renderActivity();}
function bind(){var test=document.getElementById('v2PracticeTest'),close=document.getElementById('v2PracticeClose'),nextBtn=document.getElementById('v2PracticeNext');if(test)test.addEventListener('click',openPractice);if(close)close.addEventListener('click',closePractice);if(nextBtn)nextBtn.addEventListener('click',next);document.addEventListener('click',function(e){var unit=e.target&&e.target.closest&&e.target.closest('.study-v2-unit');if(!unit)return;setTimeout(function(){preloadBooks();},450);});}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){bind();startPreload();},{once:true});else{bind();startPreload();}
window.WillenaStudyV2Practice={open:openPractice,close:closePractice,preload:preloadBooks,getBank:function(bookId,unitId){return banks.get(String(bookId)+':'+String(unitId))||[];}};
})();
