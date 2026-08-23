(function(global){
'use strict';

var VERSION='coach-concept-retriever-v1.1';
var CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var conceptCache={},candidateCache={};
function text(v){return String(v==null?'':v).trim();}
function lower(v){return text(v).toLowerCase();}
function arr(v){return Array.isArray(v)?v:[];}
function num(v){var n=Number(v);return Number.isFinite(n)?n:0;}
function uniq(xs){var s={},out=[];arr(xs).forEach(function(x){x=text(x);if(!x||s[x])return;s[x]=1;out.push(x);});return out;}
async function get(path){var r=await fetch(CONTENT_URL+'/rest/v1/'+path,{headers:{apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY},cache:'no-store'});if(!r.ok)throw new Error('Stage5 content '+r.status);var d=await r.json();return Array.isArray(d)?d:[];}

var DIAGNOSIS_TO_CONCEPT={
  third_person_s:'third_person',does_base_verb:'does_questions',do_base_verb:'do_questions',did_base_verb:'did_questions',
  have_has_agreement:'have_has',have_tense_form:'have_has',be_agreement:'be_verb',modal_base_verb:'modal_verbs',
  unnecessary_be:'be_verb',be_progressive:'present_progressive',missing_article:'articles',plural_s:'plurals',
  irregular_past:'past_simple',irregular_participle:'present_perfect',word_order:'verb_patterns'
};
function inferConceptCode(diagnosis,activity){
  var m=activity&&activity.metadata||{},raw=text(diagnosis&&diagnosis.concept||m.concept_code||m.ai_coach_strict_concept||m.grammar_concept||'');
  if(raw&&/^[a-z0-9_\-]+$/i.test(raw))return raw;
  var subtype=text(diagnosis&&diagnosis.subtype);if(DIAGNOSIS_TO_CONCEPT[subtype])return DIAGNOSIS_TO_CONCEPT[subtype];
  var cat=text(diagnosis&&diagnosis.category);if(DIAGNOSIS_TO_CONCEPT[cat])return DIAGNOSIS_TO_CONCEPT[cat];
  return'';
}
async function conceptByCode(code){
  code=text(code);if(!code)return null;if(conceptCache[code])return conceptCache[code];
  var rows=await get('grammar_concepts?code=eq.'+encodeURIComponent(code)+'&select=id,code,name,parent_concept_id,description,metadata,status&limit=1');
  conceptCache[code]=rows[0]||null;return conceptCache[code];
}
async function parentConcept(concept){if(!concept||!concept.parent_concept_id)return null;var k='id:'+concept.parent_concept_id;if(conceptCache[k])return conceptCache[k];var rows=await get('grammar_concepts?id=eq.'+encodeURIComponent(concept.parent_concept_id)+'&select=id,code,name,parent_concept_id,description,metadata,status&limit=1');conceptCache[k]=rows[0]||null;return conceptCache[k];}
async function childConcepts(concept){if(!concept)return[];return get('grammar_concepts?parent_concept_id=eq.'+encodeURIComponent(concept.id)+'&select=id,code,name,parent_concept_id,status&status=eq.active&limit=100');}
async function patternLinksForConceptIds(ids){ids=uniq(ids);var out=[];for(var i=0;i<ids.length;i+=20){var group=ids.slice(i,i+20);var q='pattern_concepts?concept_id=in.'+encodeURIComponent('('+group.join(',')+')')+'&select=pattern_id,concept_id,relationship_type,weight,confidence&limit=1000';out=out.concat(await get(q));}return out;}
async function assessmentLinks(patternIds){var out=[];for(var i=0;i<patternIds.length;i+=35){var g=patternIds.slice(i,i+35);out=out.concat(await get('assessment_item_patterns?pattern_id=in.'+encodeURIComponent('('+g.join(',')+')')+'&select=assessment_item_id,pattern_id,relationship_type&limit=1500'));}return out;}
async function itemsByIds(ids){var out=[];for(var i=0;i<ids.length;i+=35){var g=ids.slice(i,i+35);out=out.concat(await get('assessment_items?id=in.'+encodeURIComponent('('+g.join(',')+')')+'&select=id,source_key,level_id,difficulty_rating,item_type,prompt_text,context_text,correct_answer,explanation_en,explanation_ko,anchor_pattern_id,metadata,choices,book_id,unit_id,status&status=in.(review,published)&limit=1000'));}return out;}
async function occurrences(patternIds){var out=[];for(var i=0;i<patternIds.length;i+=35){var g=patternIds.slice(i,i+35);out=out.concat(await get('source_content_occurrences?pattern_id=in.'+encodeURIComponent('('+g.join(',')+')')+'&select=id,pattern_id,book_id,unit_id,source_key,source_text,skill,production_mode,internal_level_id,public_level,status&status=in.(review,published)&limit=1000'));}return out;}
function itemAnswer(x){if(Array.isArray(x.correct_answer))return x.correct_answer.join(' ');if(x.correct_answer&&typeof x.correct_answer==='object'){if(x.correct_answer.text!=null)return text(x.correct_answer.text);try{return JSON.stringify(x.correct_answer);}catch(_){}}return text(x.correct_answer);}
function rank(item,ctx,patternWeight,sourceCounts){
  var score=100*patternWeight,level=num(ctx.levelId),il=num(item.level_id),diff=Math.abs(il-level);
  if(level&&il)score+=Math.max(0,28-diff*8);else score+=8;
  if(ctx.bookId&&text(item.book_id)!==text(ctx.bookId))score+=10;
  if(ctx.unitId&&text(item.unit_id)!==text(ctx.unitId))score+=5;
  var src=text(item.book_id||item.source_key||'willena');score+=Math.max(0,8-num(sourceCounts[src]));
  if(/sentence|build|write|speech|production/i.test(text(item.item_type)))score+=ctx.preferProduction?14:3;
  if(/choice|select|match|recognition/i.test(text(item.item_type)))score+=ctx.preferProduction?-3:7;
  return score;
}
function normalizeItem(x,patternId,concept,score){return{id:x.id,sourceKey:text(x.source_key),bookId:text(x.book_id),unitId:text(x.unit_id),levelId:num(x.level_id)||null,difficulty:num(x.difficulty_rating)||null,itemType:text(x.item_type),prompt:text(x.prompt_text),context:text(x.context_text),answer:itemAnswer(x),choices:arr(x.choices),explanationEn:text(x.explanation_en),explanationKo:text(x.explanation_ko),patternId:patternId,conceptCode:concept.code,conceptName:concept.name,score:Math.round(score*10)/10,metadata:x.metadata||{}};}

async function candidates(input){
  input=input||{};var code=text(input.conceptCode||inferConceptCode(input.diagnosis,input.activity));if(!code)return{version:VERSION,concept:null,items:[],occurrences:[],reason:'no_concept'};
  var key=[code,num(input.levelId),text(input.bookId),text(input.unitId),input.includeChildren!==false,input.includeParent===true,!!input.preferProduction].join('|');if(candidateCache[key])return candidateCache[key];
  var concept=await conceptByCode(code);if(!concept)return{version:VERSION,concept:null,items:[],occurrences:[],reason:'unknown_concept',requestedCode:code};
  var concepts=[concept];if(input.includeChildren!==false)concepts=concepts.concat(await childConcepts(concept));if(input.includeParent===true){var p=await parentConcept(concept);if(p)concepts.push(p);}var conceptIds=uniq(concepts.map(function(c){return c.id;}));
  var pcl=await patternLinksForConceptIds(conceptIds),patternWeights={};pcl.forEach(function(x){var w=Math.max(.1,num(x.weight)||1)*Math.max(.1,num(x.confidence)||1);patternWeights[x.pattern_id]=Math.max(patternWeights[x.pattern_id]||0,w);});
  var patternIds=Object.keys(patternWeights);if(!patternIds.length)return{version:VERSION,concept:concept,items:[],occurrences:[],reason:'no_patterns'};
  var links=await assessmentLinks(patternIds),itemPattern={};links.forEach(function(x){if(!itemPattern[x.assessment_item_id]||patternWeights[x.pattern_id]>patternWeights[itemPattern[x.assessment_item_id]])itemPattern[x.assessment_item_id]=x.pattern_id;});
  var itemIds=Object.keys(itemPattern),rawItems=itemIds.length?await itemsByIds(itemIds):[],sourceCounts={};rawItems.forEach(function(x){var s=text(x.book_id||x.source_key||'willena');sourceCounts[s]=(sourceCounts[s]||0)+1;});
  var ctx={levelId:num(input.levelId),bookId:text(input.bookId),unitId:text(input.unitId),preferProduction:!!input.preferProduction};
  var ranked=rawItems.map(function(x){var pid=itemPattern[x.id],sc=rank(x,ctx,patternWeights[pid]||1,sourceCounts);return normalizeItem(x,pid,concept,sc);}).filter(function(x){return x.prompt&&x.answer;}).sort(function(a,b){return b.score-a.score;});
  var seenPrompt={},seenSource={},diverse=[];ranked.forEach(function(x){var p=lower(x.prompt),src=text(x.bookId||x.sourceKey||'willena');if(seenPrompt[p])return;var penalty=seenSource[src]||0;x.score-=penalty*4;seenPrompt[p]=1;seenSource[src]=penalty+1;diverse.push(x);});diverse.sort(function(a,b){return b.score-a.score;});
  var occ=await occurrences(patternIds.slice(0,140));
  var out={version:VERSION,concept:concept,conceptsConsidered:concepts.map(function(c){return{code:c.code,name:c.name};}),patternCount:patternIds.length,itemCount:diverse.length,items:diverse.slice(0,Math.max(1,num(input.limit)||30)),occurrences:occ.slice(0,80),reason:diverse.length?'ok':'no_assessment_items'};
  candidateCache[key]=out;return out;
}

async function remediationSet(input){
  input=input||{};var state=input.learnerState||{},prefer=state.state==='recall_weakness'||state.action==='production_practice';var result=await candidates(Object.assign({},input,{preferProduction:prefer,limit:Math.max(12,num(input.limit)||20)}));
  if(!result.items.length)return Object.assign({},result,{selected:[]});
  var wanted=Math.max(3,Math.min(6,num(input.count)||4)),selected=[],types={},books={};
  result.items.forEach(function(x){if(selected.length>=wanted)return;var type=lower(x.itemType)||'other',book=x.bookId||x.sourceKey||'willena';var bonus=(types[type]?0:8)+(books[book]?0:5);x.selectionScore=x.score+bonus;selected.push(x);types[type]=1;books[book]=1;});
  selected.sort(function(a,b){return b.selectionScore-a.selectionScore;});
  return Object.assign({},result,{selected:selected.slice(0,wanted)});
}

function selfTest(){return{version:VERSION,mapping:Object.assign({},DIAGNOSIS_TO_CONCEPT),examples:[['third_person_s',inferConceptCode({subtype:'third_person_s'},null)],['did_base_verb',inferConceptCode({subtype:'did_base_verb'},null)],['missing_article',inferConceptCode({subtype:'missing_article'},null)]]};}

global.WillenaCoachConceptRetriever={version:VERSION,inferConceptCode:inferConceptCode,conceptByCode:conceptByCode,candidates:candidates,remediationSet:remediationSet,selfTest:selfTest};
})(window);
