(function(global){
'use strict';
var CACHE_PREFIX='willena-study-v2-home:v1:';
var CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var HEADERS={apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY};
var lastNeeds=[],lastRaw=null,refreshing=null;
function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function clamp(v,min,max){return Math.max(min,Math.min(max,Number(v)||0));}
function uid(){try{return text(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function cache(){try{var id=uid(),o=id&&JSON.parse(localStorage.getItem(CACHE_PREFIX+id)||'null');return o&&Array.isArray(o.books)?o:null;}catch(_){return null;}}
function api(path){var fn=global.WillenaAPI&&typeof global.WillenaAPI.fetch==='function'?global.WillenaAPI.fetch.bind(global.WillenaAPI):fetch;return fn(path,{credentials:'include',cache:'no-store'}).then(function(r){return r.json().catch(function(){return{};}).then(function(d){if(!r.ok||d&&d.success===false)throw new Error(d&&d.error||('Request failed ('+r.status+')'));return d;});});}
function db(path){return fetch(CONTENT_URL+'/rest/v1/'+path,{headers:HEADERS,cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('Content DB '+r.status);return r.json();});}
function bookMap(){var c=cache(),out={};arr(c&&c.books).forEach(function(b){out[String(b.book_id)]=b;});return out;}
function unitInfo(book,unitId){var u=arr(book&&book.units).find(function(x){return String(x.id)===String(unitId);});return u||null;}
function normalizeType(r){var raw=text(r&&r.content_type||r&&r.mastery_content_type||r&&r.type).toLowerCase();if(raw==='lexical'||raw==='vocab'||raw==='vocabulary')raw='lexical_entry';if(raw==='grammar_pattern'||raw==='pattern_id')raw='pattern';return raw||'assessment_item';}
function normalizeId(r){return text(r&&r.content_id||r&&r.mastery_content_id||r&&r.lexical_entry_id||r&&r.pattern_id||r&&r.assessment_item_id||r&&r.id);}
function needKey(r){return [text(r.book_id),text(r.unit_id),text(r.skill),normalizeType(r),normalizeId(r)].join('|');}
function mergeRows(progress,adaptive){
  var by={};
  function rowFor(r){var id=normalizeId(r);if(!id||!r.book_id||!r.unit_id||!r.skill)return null;var k=needKey(r);if(!by[k])by[k]={key:k,bookId:String(r.book_id),unitId:String(r.unit_id),skill:String(r.skill),contentType:normalizeType(r),contentId:id,attempts:0,correct:0,lapses:0,due:false,mastery:null,lastSeen:0,recentResults:[],sources:0};return by[k];}
  arr(progress&&progress.records).forEach(function(r){var n=rowFor(r);if(!n)return;n.sources++;n.attempts=Math.max(n.attempts,Number(r.attempts)||0);n.correct=Math.max(n.correct,Number(r.correct)||0);n.lapses=Math.max(n.lapses,Number(r.lapses)||0);if(Number.isFinite(Number(r.mastery_score)))n.mastery=clamp(r.mastery_score,0,100);var when=Date.parse(r.last_seen_at||r.updated_at||'');if(Number.isFinite(when))n.lastSeen=Math.max(n.lastSeen,when);if(r.due===true)n.due=true;if(r.next_due_at&&Date.parse(r.next_due_at)<=Date.now())n.due=true;if(Array.isArray(r.recent_results))n.recentResults=r.recent_results.slice(-8);});
  arr(adaptive&&adaptive.items).forEach(function(r){var n=rowFor(r);if(!n)return;n.sources++;n.attempts=Math.max(n.attempts,Number(r.attempts)||0);n.correct=Math.max(n.correct,Number(r.correct)||0);n.lapses=Math.max(n.lapses,Number(r.lapses)||0);if(Number.isFinite(Number(r.mastery_score)))n.mastery=n.mastery==null?clamp(r.mastery_score,0,100):Math.min(n.mastery,clamp(r.mastery_score,0,100));var when=Date.parse(r.last_seen_at||r.updated_at||'');if(Number.isFinite(when))n.lastSeen=Math.max(n.lastSeen,when);if(r.due===true)n.due=true;if(r.next_due_at&&Date.parse(r.next_due_at)<=Date.now())n.due=true;if(Array.isArray(r.recent_results)&&r.recent_results.length)n.recentResults=r.recent_results.slice(-8);});
  return Object.keys(by).map(function(k){return by[k];});
}
function scoreNeed(n){
  var mastery=n.mastery==null?50:n.mastery,gap=Math.max(0,85-mastery),attempts=Math.max(0,n.attempts),accuracy=attempts?Math.round(n.correct/attempts*100):null;
  var parts={base:18,masteryGap:Math.min(38,gap*.65),lapses:Math.min(30,n.lapses*7),due:n.due?14:0,accuracy:accuracy!=null&&accuracy<75?Math.min(18,(75-accuracy)*.45):0,repeatProof:0,recency:0};
  if(n.recentResults.length){var recent=n.recentResults.slice(-5),good=recent.filter(function(x){return x===true;}).length;if(recent.length>=3&&good===recent.length)parts.repeatProof=-32;else if(recent.length>=4&&good/recent.length>=.8)parts.repeatProof=-18;}
  if(n.lastSeen){var hours=(Date.now()-n.lastSeen)/3600000;if(hours<2)parts.recency=-8;else if(hours>72)parts.recency=Math.min(8,Math.floor(hours/24)-3);}
  var total=Object.keys(parts).reduce(function(s,k){return s+parts[k];},0);
  n.mastery=mastery;n.accuracy=accuracy;n.parts=parts;n.score=Math.max(0,Math.round(total*10)/10);
  n.status=n.score>=70?'weak':n.score>=45?'watch':n.due?'due':'secure';
  return n;
}
async function resolveLabels(needs){
  var lexical=Array.from(new Set(needs.filter(function(n){return n.contentType==='lexical_entry';}).map(function(n){return n.contentId;}))).slice(0,120);
  var patterns=Array.from(new Set(needs.filter(function(n){return n.contentType==='pattern';}).map(function(n){return n.contentId;}))).slice(0,120);
  var assessments=Array.from(new Set(needs.filter(function(n){return n.contentType==='assessment_item';}).map(function(n){return n.contentId;}))).slice(0,120),labels={};
  if(lexical.length){try{arr(await db('lexical_entries?select=id,canonical_text,translation_ko&id=in.('+lexical.map(encodeURIComponent).join(',')+')&limit=120')).forEach(function(r){labels['lexical_entry|'+r.id]=text(r.canonical_text)+(r.translation_ko?' · '+text(r.translation_ko):'');});}catch(_){}}
  if(patterns.length){try{arr(await db('grammar_patterns?select=id,pattern_text,title,name&id=in.('+patterns.map(encodeURIComponent).join(',')+')&limit=120')).forEach(function(r){labels['pattern|'+r.id]=text(r.title||r.name||r.pattern_text)||('Grammar pattern '+r.id);});}catch(_){}}
  if(assessments.length){try{arr(await db('assessment_items?select=id,prompt_text,correct_answer,anchor_pattern_id,anchor_lexical_entry_id&id=in.('+assessments.map(encodeURIComponent).join(',')+')&limit=120')).forEach(function(r){labels['assessment_item|'+r.id]=text(r.prompt_text)||('Assessment '+r.id);});}catch(_){}}
  needs.forEach(function(n){n.label=labels[n.contentType+'|'+n.contentId]||((n.contentType==='pattern'?'Grammar pattern ':n.contentType==='lexical_entry'?'Word ':'Item ')+n.contentId);});
  return needs;
}
async function refresh(){
  if(refreshing)return refreshing;
  refreshing=(async function(){
    try{
      var both=await Promise.all([api('/.netlify/functions/progress_summary?section=study_progress&_='+Date.now()).catch(function(){return{records:[]};}),api('/.netlify/functions/progress_summary?section=adaptive_state&_='+Date.now()).catch(function(){return{items:[]};})]);
      var books=bookMap(),needs=mergeRows(both[0],both[1]).map(scoreNeed).filter(function(n){return books[n.bookId];});
      await resolveLabels(needs);
      needs.forEach(function(n){var b=books[n.bookId],u=unitInfo(b,n.unitId);n.bookTitle=text(b&&b.book_title||b&&b.title||'Book');n.unitNumber=Number(u&&u.unit_number)||null;n.unitTitle=text(u&&u.title);});
      needs.sort(function(a,b){return b.score-a.score||b.lapses-a.lapses||(a.mastery||0)-(b.mastery||0);});
      lastNeeds=needs;lastRaw={progress:both[0],adaptive:both[1]};
      global.dispatchEvent(new CustomEvent('willena:coach-needs-updated',{detail:{needs:lastNeeds.slice()}}));
      return lastNeeds.slice();
    }finally{refreshing=null;}
  })();
  return refreshing;
}
function needsForCandidate(c){return lastNeeds.filter(function(n){return String(n.bookId)===String(c.bookId)&&String(n.unitId)===String(c.unitId)&&String(n.skill)===String(c.skill);});}
function topActionable(limit){return lastNeeds.filter(function(n){return n.status==='weak'||n.status==='watch'||n.due;}).slice(0,limit||12);}
global.addEventListener('willena:study-recording',function(e){var d=e&&e.detail||{};if(d.status==='recorded'&&!(d.metadata&&d.metadata.daily_test_mode===true))setTimeout(refresh,250);});
global.addEventListener('focus',function(){setTimeout(refresh,100);});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(refresh,200);},{once:true});else setTimeout(refresh,200);
global.WillenaStudyV2Needs={refresh:refresh,getNeeds:function(){return lastNeeds.slice();},getTopNeeds:topActionable,forCandidate:needsForCandidate,getRaw:function(){return lastRaw;}};
})(window);
