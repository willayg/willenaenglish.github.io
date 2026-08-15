(function(global){
'use strict';

var CACHE_PREFIX='willena-study-v2-home:v1:';
var ACTIVE_BOOK_KEY='willena-study-v2-active-book';
var latest={};
var applying=false;

function text(v){return String(v==null?'':v).trim();}
function uid(){try{return text(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function cacheKey(){return CACHE_PREFIX+uid();}
function readCache(){try{var o=JSON.parse(localStorage.getItem(cacheKey())||'null');return o&&Array.isArray(o.books)?o:null;}catch(_){return null;}}
function activeBookId(){
  try{var id=text(localStorage.getItem(ACTIVE_BOOK_KEY));if(id)return id;}catch(_){}
  var c=readCache();
  if(c&&c.activeBookId)return text(c.activeBookId);
  return c&&c.books&&c.books[0]?text(c.books[0].book_id):'';
}
function visibleUnitId(bookId){
  try{var selected=text(localStorage.getItem('willena-study-v2-unit:'+bookId));if(selected)return selected;}catch(_){}
  var c=readCache(),book=c&&c.books&&c.books.find(function(b){return String(b.book_id)===String(bookId);});
  return text(book&&book.currentUnit&&book.currentUnit.id);
}
function rows(progress){
  if(progress&&Array.isArray(progress.skill_summary))return progress.skill_summary;
  if(progress&&Array.isArray(progress.unit_skills))return progress.unit_skills;
  return [];
}
function progressMap(progress){
  var out={};rows(progress).forEach(function(r){
    var skill=text(r&&r.skill);if(!skill)return;
    out[skill]=Math.max(0,Math.min(100,Math.round(Number(r.mastery_score)||0)));
  });return out;
}
function updateCache(bookId,unitId,progress){
  try{
    var c=readCache();if(!c)return;
    var book=c.books.find(function(b){return String(b.book_id)===String(bookId);});
    if(!book||!book.currentUnit||String(book.currentUnit.id)!==String(unitId))return;
    book.progress=progress;c.t=Date.now();localStorage.setItem(cacheKey(),JSON.stringify(c));
  }catch(_){}
}
function apply(bookId,unitId,progress){
  latest[String(bookId)+'|'+String(unitId)]=progress;
  updateCache(bookId,unitId,progress);
  if(String(activeBookId())!==String(bookId)||String(visibleUnitId(bookId))!==String(unitId))return;
  var grid=document.getElementById('masteryGrid');if(!grid)return;
  var map=progressMap(progress);applying=true;
  Object.keys(map).forEach(function(skill){
    var card=grid.querySelector('[data-skill="'+CSS.escape(skill)+'"]');if(!card)return;
    var pct=card.querySelector('.header-skill-master-pct'),fill=card.querySelector('.header-skill-master-fill');
    if(pct)pct.textContent=map[skill]+'%';
    if(fill)fill.style.width=map[skill]+'%';
  });
  setTimeout(function(){applying=false;},0);
}
function reapplyVisible(){
  var bookId=activeBookId();if(!bookId)return;var unitId=visibleUnitId(bookId);if(!unitId)return;
  var progress=latest[String(bookId)+'|'+String(unitId)];if(progress)apply(bookId,unitId,progress);
}
async function fetchProgress(bookId,unitId){
  var path='/.netlify/functions/progress_summary?section=study_progress&_='+Date.now()+'&book_id='+encodeURIComponent(bookId)+'&unit_id='+encodeURIComponent(unitId);
  var r=await (global.WillenaAPI?global.WillenaAPI.fetch:fetch)(path,{credentials:'include',cache:'no-store'});
  var d=await r.json().catch(function(){return{};});
  if(!r.ok||d&&d.success===false)throw new Error(d.error||('Study progress refresh failed ('+r.status+').'));
  return d;
}
async function onRecorded(e){
  var d=e&&e.detail||{},p=d.payload||{},m=p.metadata||{};
  if(d.status!=='recorded'||m.daily_mode!==true||m.daily_test_mode===true)return;
  var bookId=text(p.book_id||m.book_id),unitId=text(p.unit_id||m.unit_id);if(!bookId||!unitId)return;
  try{apply(bookId,unitId,await fetchProgress(bookId,unitId));}
  catch(error){console.warn('[StudyV2] live Daily Study mastery refresh',error);}
}
function bind(){
  global.addEventListener('willena:study-recording',onRecorded);
  var grid=document.getElementById('masteryGrid');
  if(grid&&global.MutationObserver){new MutationObserver(function(){if(!applying)reapplyVisible();}).observe(grid,{childList:true,subtree:true});}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})(window);
