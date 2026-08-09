(function(global){
'use strict';
var CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var HEADERS={apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY};

function unique(items){var out=[];items.forEach(function(x){if(x!=null&&String(x).trim()&&out.indexOf(x)<0)out.push(x);});return out;}
function shuffle(items){return items.slice().sort(function(){return Math.random()-.5;});}
function firstAlternative(text){return String(text||'').split('/')[0].trim();}
function sentenceTokens(text){return String(text||'').trim().replace(/[.!?]+$/,'').split(/\s+/).filter(Boolean);}
function spellingTokens(word){return String(word||'').toLowerCase().replace(/[^a-z]/g,'').split('');}
function wordLengths(word){return String(word||'').trim().split(/\s+/).map(function(p){return p.replace(/[^a-z]/gi,'').length;}).filter(Boolean);}
function isCleanSentence(text){var s=String(text||'').trim();if(!s||/[+\/]/.test(s))return false;var endings=(s.match(/[.!?](?=\s|$)/g)||[]).length;if(endings>1)return false;var t=sentenceTokens(s);return t.length>=2&&t.length<=12;}
function choices(correct,pool,max){return shuffle(unique([correct].concat(shuffle(unique(pool.filter(function(x){return x&&x!==correct;}))).slice(0,(max||4)-1))));}
async function get(path){var r=await fetch(CONTENT_URL+'/rest/v1/'+path,{headers:HEADERS,cache:'no-store'});if(!r.ok)throw new Error('Content DB '+r.status);return r.json();}
function makePatternGap(text){var s=String(text||'').trim();if(!s)return null;var priority=['going to','want to','like to','likes to','some','any','does','do','did','is','are','was','were','can','should','have','has','this','these','my','your','the','in','on','at','a','an'];for(var i=0;i<priority.length;i++){var p=priority[i],re=new RegExp('\\b'+p.replace(/ /g,'\\s+')+'\\b','i'),m=s.match(re);if(m)return{prompt:s.replace(re,'____'),answer:m[0]};}var words=s.match(/[A-Za-z']+/g)||[];if(words.length>=3){var target=words[Math.min(1,words.length-1)],rx=new RegExp('\\b'+target.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b');return{prompt:s.replace(rx,'____'),answer:target};}return null;}
function lexicalContext(entry,lang){var meta=entry.metadata||{},examples=Array.isArray(meta.sense_examples)?meta.sense_examples:[];if(meta.multiple_meanings||String(entry.translation_ko||'').indexOf('/')>=0){var sample=examples.slice(0,2).map(function(x){return x&&x.en?x.en+(x.ko?' — '+x.ko:''):'';}).filter(Boolean).join(' · ');return (lang==='ko'?'문맥에 따라 뜻이 달라질 수 있어요.':'Meaning can change with context.')+(sample?' '+sample:'');}return lang==='ko'?'한국어 뜻을 고르세요.':'Choose the Korean meaning.';}
function grammarHelp(p,lang){return lang==='ko'?(p.explanation_ko||'질문과 대답의 핵심 문법 표현을 익혀 보세요.'):(p.explanation_en||'Practice the key grammar pattern.');}

async function loadUnitSource(bookId,unitId){
 var occ=await get('source_content_occurrences?select=id,lexical_entry_id,pattern_id,sentence_id,source_text,skill,activity_label,occurrence_type&unit_id=eq.'+encodeURIComponent(unitId)+'&status=in.(review,published)&occurrence_type=in.(lexical_entry,pattern,sentence)');
 var lexIds=unique(occ.map(function(o){return o.lexical_entry_id;}).filter(Boolean));
 var patIds=unique(occ.map(function(o){return o.pattern_id;}).filter(Boolean));
 var senIds=unique(occ.map(function(o){return o.sentence_id;}).filter(Boolean));
 var rows=await Promise.all([
  lexIds.length?get('lexical_entries?select=id,canonical_text,translation_ko,definition_en,emoji,metadata,status&id=in.'+encodeURIComponent('('+lexIds.join(',')+')')+'&status=in.(review,published)'):Promise.resolve([]),
  patIds.length?get('patterns?select=id,name,grammar_category,prompt_pattern,response_pattern,explanation_en,explanation_ko,status&id=in.'+encodeURIComponent('('+patIds.join(',')+')')+'&status=in.(review,published)'):Promise.resolve([]),
  senIds.length?get('sentences?select=id,text,translation_ko,status&id=in.'+encodeURIComponent('('+senIds.join(',')+')')+'&status=in.(review,published)'):Promise.resolve([])
 ]);
 var byLex={},byPat={},bySen={};rows[0].forEach(function(x){byLex[x.id]=x;});rows[1].forEach(function(x){byPat[x.id]=x;});rows[2].forEach(function(x){bySen[x.id]=x;});
 var vocab=[],patterns=[],sentences=[];
 occ.forEach(function(o){
  if(o.lexical_entry_id&&byLex[o.lexical_entry_id])vocab.push(Object.assign({},byLex[o.lexical_entry_id],{occurrenceId:o.id}));
  if(o.pattern_id&&byPat[o.pattern_id])patterns.push(Object.assign({},byPat[o.pattern_id],{occurrenceId:o.id}));
  if(o.sentence_id&&bySen[o.sentence_id])sentences.push(Object.assign({},bySen[o.sentence_id],{occurrenceId:o.id,skill:o.skill||'',label:o.activity_label||''}));
 });
 return{bookId:bookId,unitId:unitId,vocab:vocab,patterns:patterns,sentences:sentences};
}

function buildActivities(source,options){
 options=options||{};var lang=options.language||'ko',bookId=source.bookId,unitId=source.unitId;
 var vocab=source.vocab,patterns=source.patterns,sentences=source.sentences,out=[];
 var koVocab=vocab.filter(function(v){return v.translation_ko&&v.canonical_text;});
 var koPool=koVocab.map(function(v){return v.translation_ko;}),enPool=koVocab.map(function(v){return v.canonical_text;});
 koVocab.forEach(function(v){
  var word=String(v.canonical_text||'').trim(),ko=String(v.translation_ko||'').trim();
  var c1=choices(ko,koPool,4);if(c1.length>=2)out.push({id:'pool-vocab-en-ko-'+v.occurrenceId,sourceType:'lexical_entry',sourceId:v.id,skill:'vocabulary',usage:['practice'],stimulus:{type:'text',prompt:(v.emoji?v.emoji+'  ':'')+word,context:lexicalContext(v,lang)},response:{type:'multiple_choice',choices:c1},answer:ko,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:v.occurrenceId,pool_source:'shared-v1'}});
  var c2=choices(word,enPool,4);if(c2.length>=2)out.push({id:'pool-vocab-ko-en-'+v.occurrenceId,sourceType:'lexical_entry',sourceId:v.id,skill:'vocabulary',usage:['practice'],stimulus:{type:'text',prompt:ko,context:lang==='ko'?'알맞은 영어 표현을 고르세요.':'Choose the English expression.'},response:{type:'multiple_choice',choices:c2},answer:word,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:v.occurrenceId,pool_source:'shared-v1'}});
  var letters=spellingTokens(word);if(letters.length>=2)out.push({id:'pool-spell-'+v.occurrenceId,sourceType:'lexical_entry',sourceId:v.id,skill:'spelling',usage:['practice'],stimulus:{type:'text',prompt:(v.emoji?v.emoji+'  ':'')+ko,context:lang==='ko'?'글자를 눌러 영어 단어를 만드세요.':'Build the English word.'},response:{type:'letter_order',tokens:letters,wordLengths:wordLengths(word)},answer:word,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:v.occurrenceId,pool_source:'shared-v1'}});
  var lc=choices(ko,koPool,4);if(lc.length>=2)out.push({id:'pool-listen-word-'+v.occurrenceId,sourceType:'lexical_entry',sourceId:v.id,skill:'listening',usage:['practice'],stimulus:{type:'audio',prompt:lang==='ko'?'듣고 알맞은 뜻을 고르세요.':'Listen and choose the meaning.',text:word},response:{type:'multiple_choice',choices:lc},answer:ko,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:v.occurrenceId,pool_source:'shared-v1'}});
 });
 var responsePool=unique(patterns.map(function(p){return p.response_pattern;}).concat(sentences.map(function(s){return s.text;})).filter(Boolean));
 var promptPool=unique(patterns.map(function(p){return p.prompt_pattern;}).filter(Boolean));
 patterns.forEach(function(p){
  var q=String(p.prompt_pattern||'').trim(),a=String(p.response_pattern||'').trim(),gap=makePatternGap(a);
  if(gap)out.push({id:'pool-grammar-gap-'+p.occurrenceId,sourceType:'pattern',sourceId:p.id,skill:'grammar',usage:['practice'],stimulus:{type:'text',prompt:gap.prompt,context:(q?q+'\n':'')+grammarHelp(p,lang)},response:{type:'gap_fill_text'},answer:gap.answer,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:p.occurrenceId,pool_source:'shared-v1'}});
  if(a){var opts=choices(a,responsePool,4);if(opts.length>=2)out.push({id:'pool-grammar-choice-'+p.occurrenceId,sourceType:'pattern',sourceId:p.id,skill:'grammar',usage:['practice'],stimulus:{type:'text',prompt:q||p.name||'Grammar',context:grammarHelp(p,lang)},response:{type:'multiple_choice',choices:opts},answer:a,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:p.occurrenceId,pool_source:'shared-v1'}});var concrete=firstAlternative(a);if(isCleanSentence(concrete))out.push({id:'pool-grammar-order-'+p.occurrenceId,sourceType:'pattern',sourceId:p.id,skill:'grammar',usage:['practice'],stimulus:{type:'text',prompt:q||p.name||'Grammar',context:grammarHelp(p,lang)},response:{type:'token_order',tokens:sentenceTokens(concrete)},answer:concrete,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:p.occurrenceId,pool_source:'shared-v1'}});}
  if(q&&a){var replies=choices(a,responsePool,4);if(replies.length>=2)out.push({id:'pool-conv-reply-'+p.occurrenceId,sourceType:'pattern',sourceId:p.id,skill:'conversation',usage:['practice'],stimulus:{type:'text',prompt:q,context:lang==='ko'?'가장 알맞은 대답을 고르세요.':'Choose the best reply.'},response:{type:'multiple_choice',choices:replies},answer:a,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:p.occurrenceId,pool_source:'shared-v1'}});var qs=choices(q,promptPool,4);if(qs.length>=2)out.push({id:'pool-conv-question-'+p.occurrenceId,sourceType:'pattern',sourceId:p.id,skill:'conversation',usage:['practice'],stimulus:{type:'text',prompt:a,context:lang==='ko'?'이 대답에 알맞은 질문을 고르세요.':'Choose the matching question.'},response:{type:'multiple_choice',choices:qs},answer:q,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:p.occurrenceId,pool_source:'shared-v1'}});var lo=choices(a,responsePool,4);if(lo.length>=2)out.push({id:'pool-listen-pattern-'+p.occurrenceId,sourceType:'pattern',sourceId:p.id,skill:'listening',usage:['practice'],stimulus:{type:'audio',prompt:lang==='ko'?'듣고 알맞은 대답을 고르세요.':'Listen and choose the reply.',text:q},response:{type:'multiple_choice',choices:lo},answer:a,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:p.occurrenceId,pool_source:'shared-v1'}});}
 });
 sentences.forEach(function(s){if(isCleanSentence(s.text))out.push({id:'pool-sentence-'+s.occurrenceId,sourceType:'sentence',sourceId:s.id,skill:'sentence_building',usage:['practice'],stimulus:{type:'text',prompt:s.translation_ko||'문장을 올바른 순서로 만드세요.',context:lang==='ko'?'문장 만들기':'Build the sentence'},response:{type:'token_order',tokens:sentenceTokens(s.text)},answer:s.text,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:s.occurrenceId,pool_source:'shared-v1'}});});
 var spoken=sentences.filter(function(s){return s.skill==='speaking';});if(spoken.length<2)spoken=sentences.slice();for(var i=0;i<spoken.length-1;i++){var q=spoken[i],a=spoken[i+1],pool=sentences.map(function(s){return s.text;});var opts=choices(a.text,pool,4);if(opts.length>=2)out.push({id:'pool-conv-next-'+q.occurrenceId+'-'+a.occurrenceId,sourceType:'sentence',sourceId:q.id,skill:'conversation',usage:['practice'],stimulus:{type:'text',prompt:q.text,context:lang==='ko'?'다음에 올 말을 고르세요.':'Choose what comes next.'},response:{type:'multiple_choice',choices:opts},answer:a.text,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:q.occurrenceId,pool_source:'shared-v1'}});}
 var translated=sentences.filter(function(s){return s.translation_ko;});translated.forEach(function(s){var opts=choices(s.translation_ko,translated.map(function(x){return x.translation_ko;}),4);if(opts.length>=2)out.push({id:'pool-listen-sentence-'+s.occurrenceId,sourceType:'sentence',sourceId:s.id,skill:'listening',usage:['practice'],stimulus:{type:'audio',prompt:lang==='ko'?'듣고 알맞은 뜻을 고르세요.':'Listen and choose the meaning.',text:s.text},response:{type:'multiple_choice',choices:opts},answer:s.translation_ko,metadata:{book_id:bookId,unit_id:unitId,occurrence_id:s.occurrenceId,pool_source:'shared-v1'}});});
 return out;
}

async function loadUnitPool(options){options=options||{};if(!options.bookId||!options.unitId)throw new Error('bookId and unitId required');var source=await loadUnitSource(options.bookId,options.unitId);return{source:source,activities:buildActivities(source,options)};}
async function loadBookUnits(bookId){return get('content_units?select=id,unit_number,title,metadata&book_id=eq.'+encodeURIComponent(bookId)+'&status=in.(review,published)&order=unit_number.asc');}
async function findSameLevelBooks(title){var m=String(title||'').match(/(\d+)\s*$/);if(!m)return[];var level=m[1],all=await get('content_books?select=id,title,metadata&status=in.(review,published)&order=title.asc');return all.filter(function(b){return b.title!==title&&new RegExp('(?:English Bus|Let\\'s Go)\\s+'+level+'$','i').test(String(b.title||''));});}

global.WillenaPracticePool={version:'shared-practice-v1',loadUnitPool:loadUnitPool,loadBookUnits:loadBookUnits,findSameLevelBooks:findSameLevelBooks,buildActivities:buildActivities};
})(window);
