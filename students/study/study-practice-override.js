(function(global){
'use strict';
var URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var HEADERS={apikey:KEY,Authorization:'Bearer '+KEY};
function text(v){return String(v==null?'':v).trim();}
function unitNumber(v){var m=text(v).match(/Unit\s*(\d+)/i);return m?Number(m[1]):null;}
async function get(path){var r=await fetch(URL+'/rest/v1/'+path,{headers:HEADERS,cache:'no-store'});if(!r.ok)throw new Error('Content DB '+r.status);return r.json();}
async function context(){var rt=global.WillenaStudyRuntime&&global.WillenaStudyRuntime.getContext&&global.WillenaStudyRuntime.getContext();if(rt&&rt.bookId&&rt.unitId)return{bookId:rt.bookId,unitId:rt.unitId};var title=text(document.getElementById('bookTitle')&&document.getElementById('bookTitle').textContent),n=unitNumber(document.getElementById('unitTitle')&&document.getElementById('unitTitle').textContent);if(!title||!n)return null;var books=await get('content_books?select=id,title&title=eq.'+encodeURIComponent(title)+'&status=in.(review,published)&limit=1');if(!books.length)return null;var units=await get('content_units?select=id,unit_number&book_id=eq.'+encodeURIComponent(books[0].id)+'&unit_number=eq.'+n+'&status=in.(review,published)&limit=1');if(!units.length)return null;return{bookId:books[0].id,unitId:units[0].id};}
async function launch(skill,label){try{var c=await context();if(!c)return;global.dispatchEvent(new CustomEvent('willena:smart-study-focus',{detail:{bookId:c.bookId,unitId:c.unitId,skill:skill,skillLabel:label}}));}catch(e){console.debug('[StudyPracticeOverride]',e);}}
document.addEventListener('click',function(e){var direct=e.target.closest('[data-practice]');if(direct){var mode=direct.dataset.practice;if(mode==='conversation'||mode==='grammar'){e.preventDefault();e.stopImmediatePropagation();launch(mode,mode==='conversation'?'Conversation':'Grammar');return;}}var card=e.target.closest('.skill-card');if(!card)return;var label=text(card.querySelector('strong')&&card.querySelector('strong').textContent).toLowerCase();var skill=null;if(label==='회화'||label==='conversation')skill='conversation';if(label==='문법'||label==='grammar')skill='grammar';if(!skill)return;e.preventDefault();e.stopImmediatePropagation();launch(skill,skill==='conversation'?'Conversation':'Grammar');},true);
})(window);
