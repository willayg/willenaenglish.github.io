(function(global){
'use strict';
var coach=global.WillenaAICoach;
if(!coach||typeof coach.registerProvider!=='function')return;
var CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var HEADERS={apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY};
var cache={},vocabCache={};
function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function shuffle(a){a=arr(a).slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),x=a[i];a[i]=a[j];a[j]=x;}return a;}
function unique(a){var seen={},out=[];arr(a).forEach(function(x){var id=text(x&&x.id||x&&x.sourceId);if(!id||seen[id])return;seen[id]=1;out.push(x);});return out;}
function uniqueText(a){var out=[];arr(a).forEach(function(x){x=text(x);if(x&&out.indexOf(x)<0)out.push(x);});return out;}
function bookLevel(b,ctx){var n=Number(b&&(b.public_level||b.publicLevel))||0;if(!n&&Number(b&&b.internal_level_id)>2)n=Number(b.internal_level_id)-2;return n||Number(ctx&&ctx.bookPublicLevel)||Number(ctx&&ctx.publicLevel)||0;}
async function get(path){var r=await fetch(CONTENT_URL+'/rest/v1/'+path,{headers:HEADERS,cache:'no-store'});if(!r.ok)throw new Error('Targeted practice content '+r.status);return r.json();}
async function loadSourceVocabulary(unitId){
  unitId=text(unitId);if(!unitId)return[];
  if(vocabCache[unitId])return vocabCache[unitId];
  vocabCache[unitId]=(async function(){
    var occ=arr(await get('source_content_occurrences?select=id,lexical_entry_id,source_text&unit_id=eq.'+encodeURIComponent(unitId)+'&occurrence_type=eq.lexical_entry&status=in.(review,published)&limit=1000'));
    var ids=uniqueText(occ.map(function(o){return o&&o.lexical_entry_id;}));
    if(!ids.length)return[];
    var rows=arr(await get('lexical_entries?select=id,canonical_text,translation_ko,emoji&id=in.'+encodeURIComponent('('+ids.join(',')+')')+'&status=in.(review,published)&limit=1000'));
    var by={};rows.forEach(function(r){if(r&&r.id)by[r.id]=r;});
    return occ.map(function(o){var e=by[o.lexical_entry_id];if(!e)return null;return{id:e.id,occurrenceId:o.id,word:text(e.canonical_text||o.source_text),ko:text(e.translation_ko),emoji:e.emoji||null};}).filter(function(x){return x&&x.word&&x.ko;});
  })().catch(function(){return[];});
  return vocabCache[unitId];
}
function sourceVocabularyActivities(bookId,unitId,items){
  var out=[],koPool=uniqueText(items.map(function(x){return x.ko;})),enPool=uniqueText(items.map(function(x){return x.word;}));
  items.forEach(function(item){
    var koChoices=shuffle(uniqueText([item.ko].concat(shuffle(koPool.filter(function(x){return x!==item.ko;})).slice(0,3))));
    if(koChoices.length>=2)out.push({id:'coach-vocab-en-ko-'+item.occurrenceId,sourceType:'lexical_entry',sourceId:item.id,skill:'vocabulary',usage:['practice'],stimulus:{type:'text',prompt:(item.emoji?item.emoji+'  ':'')+item.word,context:'한국어 뜻을 고르세요.'},response:{type:'multiple_choice',choices:koChoices},answer:item.ko,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:item.occurrenceId,pool_source:'source_content',source_label:'Book vocabulary',ai_coach:true}});
    var enChoices=shuffle(uniqueText([item.word].concat(shuffle(enPool.filter(function(x){return x!==item.word;})).slice(0,3))));
    if(enChoices.length>=2)out.push({id:'coach-vocab-ko-en-'+item.occurrenceId,sourceType:'lexical_entry',sourceId:item.id,skill:'vocabulary',usage:['practice'],stimulus:{type:'text',prompt:item.ko,context:'알맞은 영어 표현을 고르세요.'},response:{type:'multiple_choice',choices:enChoices},answer:item.word,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:item.occurrenceId,pool_source:'source_content',source_label:'Book vocabulary',ai_coach:true}});
    var letters=item.word.toLowerCase().replace(/[^a-z]/g,'').split('');
    if(letters.length>=2)out.push({id:'coach-spelling-'+item.occurrenceId,sourceType:'lexical_entry',sourceId:item.id,skill:'spelling',usage:['practice'],stimulus:{type:'text',prompt:item.ko,context:'글자를 눌러 영어 단어를 만드세요.'},response:{type:'letter_order',tokens:letters,wordLengths:[letters.length]},answer:item.word.toLowerCase().replace(/[^a-z]/g,''),metadata:{book_id:bookId,unit_id:unitId,occurrence_id:item.occurrenceId,pool_source:'source_content',source_label:'Book vocabulary',ai_coach:true}});
  });
  return out;
}
coach.registerProvider('unit',async function(args,ctx){
  args=args||{};if(!ctx)return null;
  var api=global.WillenaStudyQuestionBank;if(!api||typeof api.loadUnit!=='function')return null;
  var bookId=text(args.bookId||ctx.bookId),unitId=text(args.unitId||ctx.unitId),books=arr(ctx.books),book=books.find(function(b){return String(b&&b.book_id)===bookId;})||ctx.book;
  if(!book)return null;
  var units=arr(book.units),unit=units.find(function(u){return String(u&&u.id)===unitId;})||((String(ctx.unitId)===unitId)?ctx.unit:null);
  if(!unit)return null;
  var level=bookLevel(book,ctx),key=bookId+'|'+unitId;
  if(!cache[key])cache[key]=api.loadUnit(level,{bookId:bookId,unitId:unitId,bookTitle:text(book.book_title||book.title),unitNumber:Number(unit.unit_number)||1}).catch(function(){return[];});
  var all=unique(await cache[key]),skill=text(args.skill);
  if(skill==='vocabulary'||skill==='spelling'){
    var vocab=await loadSourceVocabulary(unitId),generated=sourceVocabularyActivities(bookId,unitId,vocab);
    all=unique(all.concat(generated));
  }
  if(skill)all=all.filter(function(x){return text(x&&x.skill)===skill;});
  var items=shuffle(all).slice(0,Number(args.count)||10);
  if(!items.length)return{type:'coach_unit',title:args.title||{ko:'추천 연습',en:'Recommended practice'},message:{ko:'이 단원에서 해당 영역의 연습 문제를 찾지 못했어요.',en:'I could not find practice questions for that skill in this unit.'},items:[]};
  return{type:'coach_unit',title:args.title||{ko:'추천 연습',en:'Recommended practice'},message:args.message||{ko:'이 단원의 해당 영역 문제만 골랐어요.',en:'I picked only the matching skill questions from that unit.'},items:items};
});
global.WillenaCoachTargetedPractice={version:'targeted-practice-v1.1'};
})(window);
