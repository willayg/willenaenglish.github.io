(function(){
'use strict';
if(!/^\/students\/study\/?(?:index\.html)?$/i.test(location.pathname))return;

var BOOK_KEY='willena-study-selected-book:v1';
var bookList=[];
var activeBookId='';

function clearLegacyAssignmentCache(){try{var uid=String(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId')||'').trim();if(!uid)return;var prefix='willena-study-cache:v1:'+uid+':assignment:',remove=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(!k||k.indexOf(prefix)!==0)continue;try{var o=JSON.parse(localStorage.getItem(k)||'null');if(!o||!o.v||!Array.isArray(o.v.assignments))remove.push(k);}catch(_){remove.push(k);}}remove.forEach(function(k){localStorage.removeItem(k);});}catch(_){}}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function bookId(b){return String(b&&(b.book_id||b.id)||'');}
function bookTitle(b){return String(b&&(b.book_title||b.title||b.name)||'Book');}
function uniqueBooks(rows){var out=[],seen={};(rows||[]).forEach(function(b){var id=bookId(b);if(!id||seen[id])return;seen[id]=1;out.push(b);});return out;}
function extractBooks(data){if(!data||typeof data!=='object')return[];var candidates=[];if(Array.isArray(data.assignments))candidates=data.assignments;else if(Array.isArray(data.books))candidates=data.books;else if(Array.isArray(data.assignment))candidates=data.assignment;else if(data.assignment&&Array.isArray(data.assignment.books))candidates=data.assignment.books;var rows=uniqueBooks(candidates);var current=data.assignment&&!Array.isArray(data.assignment)?data.assignment:null;if(current&&bookId(current)&&!rows.some(function(b){return bookId(b)===bookId(current);})){rows.unshift(current);}return rows;}
function selectedAssignment(data,rows){if(!rows.length)return data&&data.assignment;var saved='';try{saved=sessionStorage.getItem(BOOK_KEY)||'';}catch(_){ }
 var chosen=rows.find(function(b){return bookId(b)===saved;})||((data&&data.assignment&&!Array.isArray(data.assignment))?rows.find(function(b){return bookId(b)===bookId(data.assignment);}):null)||rows[0];
 activeBookId=bookId(chosen);return chosen;
}
function installStyle(){if(document.getElementById('studyBookSwitcherStyle'))return;var s=document.createElement('style');s.id='studyBookSwitcherStyle';s.textContent='.book-hero .hero-copy>span.eyebrow:first-child{display:none!important}.study-book-tabs{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:0 0 14px;padding:0 0 2px}.study-book-tabs::-webkit-scrollbar{display:none}.study-book-tab{flex:0 0 auto;border:2px solid var(--cyan);background:#fff;color:var(--pink-dark);border-radius:999px;padding:8px 13px;font-weight:800;font-size:.72rem;cursor:pointer}.study-book-tab.is-active{border-color:var(--pink);background:#fff3f9;color:var(--pink-dark)}.study-book-swipe{touch-action:pan-y;user-select:none}.study-book-pips{display:flex;justify-content:center;gap:7px;margin:9px 0 2px}.study-book-pip{width:7px;height:7px;border:0;border-radius:999px;padding:0;background:#cfecef}.study-book-pip.is-active{width:22px;background:var(--pink)}@media(max-width:560px){.study-book-tabs{margin-bottom:11px}.study-book-tab{font-size:.65rem;padding:7px 10px}}';document.head.appendChild(s);}
function activateBook(id){if(!id||id===activeBookId)return;try{sessionStorage.setItem(BOOK_KEY,id);}catch(_){ }location.reload();}
function renderBookUi(){installStyle();if(bookList.length<=1){try{sessionStorage.removeItem(BOOK_KEY);}catch(_){ }return;}
 var title=document.getElementById('bookTitle'),unit=document.getElementById('unitTitle');if(!title||!unit)return;var hero=title.parentNode;if(!hero)return;
 if(!document.getElementById('studyBookTabs')){var tabs=document.createElement('nav');tabs.id='studyBookTabs';tabs.className='study-book-tabs';tabs.setAttribute('aria-label','Books');hero.insertBefore(tabs,title);}
 var tabsEl=document.getElementById('studyBookTabs');tabsEl.innerHTML=bookList.map(function(b){var id=bookId(b),active=id===activeBookId;return '<button class="study-book-tab'+(active?' is-active':'')+'" type="button" data-book-id="'+esc(id)+'">'+esc(bookTitle(b))+'</button>';}).join('');tabsEl.querySelectorAll('[data-book-id]').forEach(function(b){b.addEventListener('click',function(){activateBook(b.dataset.bookId);});});
 var swipe=document.getElementById('studyBookSwipe');if(!swipe){swipe=document.createElement('div');swipe.id='studyBookSwipe';swipe.className='study-book-swipe';hero.insertBefore(swipe,title);swipe.appendChild(title);swipe.appendChild(unit);}
 var pips=document.getElementById('studyBookPips');if(!pips){pips=document.createElement('div');pips.id='studyBookPips';pips.className='study-book-pips';swipe.insertAdjacentElement('afterend',pips);}pips.innerHTML=bookList.map(function(b){return '<button class="study-book-pip'+(bookId(b)===activeBookId?' is-active':'')+'" type="button" data-book-id="'+esc(bookId(b))+'" aria-label="'+esc(bookTitle(b))+'"></button>';}).join('');pips.querySelectorAll('[data-book-id]').forEach(function(b){b.addEventListener('click',function(){activateBook(b.dataset.bookId);});});
 if(swipe.dataset.bookSwipeBound!=='1'){swipe.dataset.bookSwipeBound='1';var sx=0,sy=0;swipe.addEventListener('touchstart',function(e){if(!e.touches||!e.touches[0])return;sx=e.touches[0].clientX;sy=e.touches[0].clientY;},{passive:true});swipe.addEventListener('touchend',function(e){if(!e.changedTouches||!e.changedTouches[0]||bookList.length<=1)return;var dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)<50||Math.abs(dx)<Math.abs(dy))return;var idx=bookList.findIndex(function(b){return bookId(b)===activeBookId;});if(idx<0)idx=0;idx=dx<0?(idx+1)%bookList.length:(idx-1+bookList.length)%bookList.length;activateBook(bookId(bookList[idx]));},{passive:true});}
}

clearLegacyAssignmentCache();
if(!window.__willenaBookFetchWrapped){window.__willenaBookFetchWrapped=true;var nativeFetch=window.fetch.bind(window);window.fetch=async function(input,init){var response=await nativeFetch(input,init);try{var url=typeof input==='string'?input:(input&&input.url)||'';if(url.indexOf('/rest/v1/rpc/get_study_assignment_for_class')>=0&&response.ok){var clone=response.clone(),data=await clone.json();var rows=extractBooks(data);if(rows.length){bookList=rows;var chosen=selectedAssignment(data,rows);if(chosen)data.assignment=chosen;setTimeout(renderBookUi,0);if(rows.length>1){return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers:response.headers});}}}}catch(e){console.debug('[WillenaStudyBooks] selector fallback',e);}return response;};}

try{
 var uid=String(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId')||'').trim();
 var prefix=uid?'willena-study-cache:v1:'+uid+':':'',maxAge=7*24*60*60*1000;
 function read(k){if(!prefix)return null;var raw=localStorage.getItem(prefix+k);if(!raw)return null;var o=JSON.parse(raw);if(!o||!o.t||Date.now()-o.t>maxAge)return null;return o.v||null;}
 function by(id){return document.getElementById(id);}
 function txt(id,v){var e=by(id);if(e&&v!=null&&v!=='')e.textContent=v;}
 var summary=read('summary');if(summary){txt('bookTitle',summary.bookTitle);txt('unitTitle',summary.unitText);}
 var map=by('learningMap');if(map)map.innerHTML='<div class="study-sk-unit"><div class="study-sk study-sk-line med"></div><div class="study-sk study-sk-line"></div><div class="study-sk study-sk-line short"></div></div><div class="study-sk-unit"><div class="study-sk study-sk-line med"></div><div class="study-sk study-sk-line"></div><div class="study-sk study-sk-line short"></div></div><div class="study-sk-unit"><div class="study-sk study-sk-line med"></div><div class="study-sk study-sk-line"></div><div class="study-sk study-sk-line short"></div></div>';
 var grid=by('skillGrid');if(grid){var cards='';for(var i=0;i<6;i++)cards+='<div class="study-sk-card" aria-hidden="true"><div class="study-sk study-sk-icon"></div><div class="study-sk-lines"><div class="study-sk study-sk-line med"></div><div class="study-sk study-sk-line short"></div></div></div>';grid.innerHTML=cards;}
 var vocab=by('vocabPreview');if(vocab){var rows='';for(var j=0;j<5;j++)rows+='<div class="study-sk-vrow" aria-hidden="true"><div class="study-sk study-sk-vicon"></div><div class="study-sk-lines"><div class="study-sk study-sk-line med"></div><div class="study-sk study-sk-line short"></div></div></div>';vocab.innerHTML=rows;}
 var status=by('contentStatus');if(status)status.textContent='';
}catch(_){ }
installStyle();
if(!document.querySelector('script[data-study-home-polish]')){var s=document.createElement('script');s.src='./study-home-polish.js?v=20260810-home5';s.dataset.studyHomePolish='1';s.defer=true;document.head.appendChild(s);}
})();