(function(global){
'use strict';
if(!global.WillenaStudyQuestionBank||!global.WillenaStudyQuestionBank.loadUnit)return;
var DB='https://gxwfsqxyuufqtitspfqg.supabase.co';
var KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var HEADERS={apikey:KEY,Authorization:'Bearer '+KEY};
var originalLoadUnit=global.WillenaStudyQuestionBank.loadUnit.bind(global.WillenaStudyQuestionBank);
function arr(v){return Array.isArray(v)?v:[];}
function text(v){return String(v==null?'':v).trim();}
function unique(values){var out=[];values.forEach(function(v){v=text(v);if(v&&out.indexOf(v)<0)out.push(v);});return out;}
function shuffle(values){return values.slice().sort(function(){return Math.random()-.5;});}
function choices(correct,pool,max){return shuffle(unique([correct].concat(shuffle(unique(pool.filter(function(v){return text(v)!==text(correct);}))).slice(0,(max||4)-1))));}
function sentenceTokens(value){return text(value).replace(/[.!?]+$/,'').split(/\s+/).filter(Boolean);}
function firstAlternative(value){return text(value).split('/')[0].trim();}
function cleanSentence(value){var s=text(value);if(!s||/[+\/]/.test(s))return false;var endings=(s.match(/[.!?](?=\s|$)/g)||[]).length,tokens=sentenceTokens(s);return endings<=1&&tokens.length>=2&&tokens.length<=12;}
function lowLevelBadItem(a){
  if(!a)return false;
  var m=a.metadata||{},level=Number(a.level||m.bank_level_id||m.public_level)||99;
  if(level>2)return false;
  var qf=text(m.question_form||m.conversation_form),prompt=text(a.stimulus&&a.stimulus.prompt||a.q),context=text(a.stimulus&&a.stimulus.context||a.meaning);
  if(qf==='matching_question')return true;
  if((prompt==='맞는 문장을 고르세요.'||prompt==='맞는 대답을 고르세요.')&&(!context||/^(알맞은 답을 고르세요\.?|가장 알맞은 응답을 고르세요\.?|가장 자연스러운 말을 고르세요\.?)$/.test(context)))return true;
  if(/^(Seven\.|How many\?|I[’']m ___ \.|They[’']re ___ \.|It[’']s ___ \.|It[’']s a ___ \.|This is my ___ \.|These are my ___ \.|I hurt my ___ \.|I can ___ \.)$/.test(prompt))return true;
  return false;
}
async function get(path){var r=await fetch(DB+'/rest/v1/'+path,{headers:HEADERS,cache:'no-store'});if(!r.ok)throw new Error('V2 source fallback '+r.status);return r.json();}
async function getAll(path){var out=[],offset=0,pageSize=1000;while(true){var sep=path.indexOf('?')>=0?'&':'?';var rows=arr(await get(path+sep+'limit='+pageSize+'&offset='+offset));out=out.concat(rows);if(rows.length<pageSize)break;offset+=pageSize;if(offset>100000)throw new Error('V2 source pagination safety limit exceeded');}return out;}
async function loadSentences(unitId){var occ=arr(await getAll('source_content_occurrences?select=id,sentence_id,source_text,skill,activity_label&unit_id=eq.'+encodeURIComponent(unitId)+'&occurrence_type=eq.sentence&status=in.(review,published)'));var ids=unique(occ.map(function(o){return o.sentence_id;}));if(!ids.length)return[];var rows=arr(await getAll('sentences?select=id,text,translation_ko&id=in.'+encodeURIComponent('('+ids.join(',')+')')+'&status=in.(review,published)')),by={};rows.forEach(function(r){by[r.id]=r;});return occ.map(function(o){var s=by[o.sentence_id];return s?{id:s.id,occurrenceId:o.id,text:text(s.text||o.source_text),ko:text(s.translation_ko),skill:text(o.skill),label:text(o.activity_label)}:null;}).filter(Boolean);}
async function loadPatterns(unitId){var occ=arr(await getAll('source_content_occurrences?select=id,pattern_id&unit_id=eq.'+encodeURIComponent(unitId)+'&occurrence_type=eq.pattern&status=in.(review,published)'));var ids=unique(occ.map(function(o){return o.pattern_id;}));if(!ids.length)return[];var rows=arr(await getAll('patterns?select=id,prompt_pattern,response_pattern,explanation_ko&id=in.'+encodeURIComponent('('+ids.join(',')+')')+'&status=in.(review,published)')),by={};rows.forEach(function(r){by[r.id]=r;});return occ.map(function(o){var p=by[o.pattern_id];return p?Object.assign({},p,{occurrenceId:o.id}):null;}).filter(Boolean);}
async function loadVocabulary(unitId){var occ=arr(await getAll('source_content_occurrences?select=id,lexical_entry_id,source_text&unit_id=eq.'+encodeURIComponent(unitId)+'&occurrence_type=eq.lexical_entry&status=in.(review,published)'));var ids=unique(occ.map(function(o){return o.lexical_entry_id;}));if(!ids.length)return[];var rows=arr(await getAll('lexical_entries?select=id,canonical_text,translation_ko&id=in.'+encodeURIComponent('('+ids.join(',')+')')+'&status=in.(review,published)')),by={};rows.forEach(function(r){by[r.id]=r;});return occ.map(function(o){var e=by[o.lexical_entry_id];return e?{id:e.id,occurrenceId:o.id,word:text(e.canonical_text||o.source_text),ko:text(e.translation_ko)}:null;}).filter(function(x){return x&&x.word;});}
function meta(context,occurrenceId,label){return{book_id:context.bookId,unit_id:context.unitId,occurrence_id:occurrenceId||null,pool_source:'source_content',source_label:label||'Focused unit practice',generated_v1_fallback:true};}
function buildSentence(context,sentences,patterns){var out=[];sentences.filter(function(s){return cleanSentence(s.text);}).forEach(function(s){out.push({id:'v2-sentence-'+s.occurrenceId,sourceType:'sentence',sourceId:s.id,skill:'sentence_building',usage:['practice'],stimulus:{type:'text',prompt:s.ko||'단어를 올바른 순서로 배열하세요.',context:s.ko?'단어를 올바른 순서로 배열하세요.':''},response:{type:'token_order',tokens:sentenceTokens(s.text)},answer:s.text,metadata:meta(context,s.occurrenceId,'Focused unit practice')});});
/* Sentence Builder must use real unit sentences only. Pattern templates such as
   "It's a ..." are not complete student sentences and must never be padded/repeated. */
return out.slice(0,10);
}
function buildListening(context,vocab,sentences,patterns){var out=[],responses=unique(patterns.map(function(p){return p.response_pattern;}));patterns.forEach(function(p){var prompt=text(p.prompt_pattern),answer=text(p.response_pattern),opts=choices(answer,responses,4);if(prompt&&answer&&opts.length>=2)out.push({id:'v2-listen-pattern-'+p.occurrenceId,sourceType:'pattern',sourceId:p.id,skill:'listening',usage:['practice'],stimulus:{type:'audio',prompt:'소리를 듣고 알맞은 답을 고르세요.',text:prompt},response:{type:'multiple_choice',choices:opts},answer:answer,metadata:meta(context,p.occurrenceId,'Focused unit practice')});});
var vocabKo=vocab.filter(function(v){return v.ko;}),koPool=vocabKo.map(function(v){return v.ko;});vocabKo.forEach(function(v){var opts=choices(v.ko,koPool,4);if(opts.length>=2)out.push({id:'v2-listen-word-'+v.occurrenceId,sourceType:'lexical_entry',sourceId:v.id,skill:'listening',usage:['practice'],stimulus:{type:'audio',prompt:'소리를 듣고 알맞은 답을 고르세요.',text:v.word},response:{type:'multiple_choice',choices:opts},answer:v.ko,metadata:meta(context,v.occurrenceId,'Focused unit practice')});});
var trans=sentences.filter(function(s){return s.ko;}),transPool=trans.map(function(s){return s.ko;});trans.forEach(function(s){var opts=choices(s.ko,transPool,4);if(opts.length>=2)out.push({id:'v2-listen-sentence-'+s.occurrenceId,sourceType:'sentence',sourceId:s.id,skill:'listening',usage:['practice'],stimulus:{type:'audio',prompt:'소리를 듣고 알맞은 답을 고르세요.',text:s.text},response:{type:'multiple_choice',choices:opts},answer:s.ko,metadata:meta(context,s.occurrenceId,'Focused unit practice')});});
return out.slice(0,10);
}
global.WillenaStudyQuestionBank.loadUnit=async function(publicLevel,context){
  context=context||{};
  var rows=arr(await originalLoadUnit(publicLevel,context)).filter(function(a){return !lowLevelBadItem(a);});
  if(!context.unitId||!context.bookId)return rows;
  var haveSentence=rows.some(function(a){return a&&a.skill==='sentence_building';}),haveListening=rows.some(function(a){return a&&a.skill==='listening';});
  if(haveSentence&&haveListening)return rows;
  try{
    var data=await Promise.all([loadSentences(context.unitId),loadPatterns(context.unitId),loadVocabulary(context.unitId)]),extra=[];
    if(!haveSentence)extra=extra.concat(buildSentence(context,data[0],data[1]));
    if(!haveListening)extra=extra.concat(buildListening(context,data[2],data[0],data[1]));
    return rows.concat(extra);
  }catch(e){console.warn('[StudyV2] V1 source fallback',e);return rows;}
};
})(window);
