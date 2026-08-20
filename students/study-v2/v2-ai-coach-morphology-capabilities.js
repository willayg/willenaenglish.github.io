(function(global){
'use strict';

var coach=global.WillenaAICoach;
if(!coach||typeof coach.registerCapability!=='function')return;

var CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var HEADERS={apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY};

function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function ko(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function shuffle(a){a=arr(a).slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),x=a[i];a[i]=a[j];a[j]=x;}return a;}
function uid(){try{return text(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function home(){try{return JSON.parse(localStorage.getItem('willena-study-v2-home:v1:'+uid())||'null');}catch(_){return null;}}
async function get(path){var r=await fetch(CONTENT_URL+'/rest/v1/'+path,{headers:HEADERS,cache:'no-store'});if(!r.ok)throw new Error('Content '+r.status);return r.json();}
function optionTexts(row){return arr(row&&row.choices).map(function(x){return typeof x==='string'?x:text(x&&x.text||x&&x.option_text);}).filter(Boolean);}
function answerText(row){var a=row&&row.correct_answer;if(typeof a==='string'||typeof a==='number')return String(a);if(a&&typeof a==='object')return text(a.text||a.answer||a.value);return'';}
function words(v){return text(v).toLowerCase().replace(/[’]/g,"'").replace(/[^a-z']+/g,' ').trim().split(/\s+/).filter(Boolean);}
function thirdFromBase(base,third){
  base=text(base).toLowerCase();third=text(third).toLowerCase();
  if(!base||!third)return false;
  if((base==='have'&&third==='has')||(base==='do'&&third==='does'))return true;
  if(base.slice(-1)==='y'&&base.length>1&&!'aeiou'.includes(base.charAt(base.length-2))&&third===base.slice(0,-1)+'ies')return true;
  if(/(s|sh|ch|x|z|o)$/.test(base)&&third===base+'es')return true;
  return third===base+'s';
}
function usefulThirdPersonPair(correct,wrong,context){
  var c=words(correct),w=words(wrong),ctx=' '+words(context).join(' ')+' ';
  if(!c.length||!w.length)return false;
  if(c.length!==w.length)return false;
  var diffs=[];
  for(var i=0;i<c.length;i++)if(c[i]!==w[i])diffs.push([c[i],w[i]]);
  if(diffs.length!==1)return false;
  var a=diffs[0][0],b=diffs[0][1];
  if((a==='does'&&b==='do')||(a==="doesn't"&&b==="don't")||(a==='has'&&b==='have'))return true;
  if(thirdFromBase(b,a))return true;
  if((ctx.indexOf(' does ')>=0||ctx.indexOf(" doesn't ")>=0||c.indexOf('does')>=0||c.indexOf("doesn't")>=0)&&thirdFromBase(a,b))return true;
  return false;
}
function hasUsefulContext(row){
  var prompt=text(row&&row.prompt_text),context=text(row&&row.context_text);
  var p=prompt.toLowerCase().replace(/[’]/g,"'");
  if(/^\s*(yes|no)\s*,\s*(he|she|it|[a-z]+)\s+_{2,}[.!?]?\s*$/i.test(prompt))return false;
  if(/^\s*(yes|no)\s*,\s*(he|she|it|[a-z]+)\s+\.{2,}[.!?]?\s*$/i.test(prompt))return false;
  if((/^\s*(yes|no)\b/.test(p))&&!/[?]/.test(prompt)&&(!context||/^(빈칸에|알맞은|choose|fill|select)/i.test(context)))return false;
  return true;
}
function isStrictThirdPersonRow(row){
  var prompt=text(row&&row.prompt_text),context=text(row&&row.context_text),correct=answerText(row),opts=optionTexts(row);
  var combined=(prompt+' '+context+' '+correct).toLowerCase().replace(/[’]/g,"'");
  if(!correct||opts.length<2)return false;
  if(!hasUsefulContext(row))return false;
  if(/\b(have|has)\s+[^?.!]{0,18}\bever\b|\bever\b/.test(combined))return false;
  if(/\b(yesterday|last\s+(night|week|month|year)|ago)\b/.test(combined))return false;
  for(var i=0;i<opts.length;i++){
    if(opts[i]===correct)continue;
    if(usefulThirdPersonPair(correct,opts[i],prompt+' '+context+' '+correct))return true;
  }
  return false;
}
function mapGrammar(row){
  var correct=answerText(row),opts=optionTexts(row);if(!correct||!opts.length)return null;
  if(opts.indexOf(correct)<0)opts.push(correct);
  return{
    id:'coach-third-person-'+row.id,
    sourceType:'assessment_item',sourceId:row.id,skill:'grammar',usage:['practice'],
    stimulus:{type:'text',prompt:text(row.prompt_text),context:text(row.context_text)||(ko()?'알맞은 답을 고르세요.':'Choose the best answer.')},
    response:{type:'multiple_choice',choices:shuffle(opts)},answer:correct,
    level:Number(row.level_id)||null,difficulty:Number(row.difficulty_rating)||null,
    metadata:{ai_coach:true,ai_coach_cross_book:true,ai_coach_strict_concept:'third_person',source_label:'AI Coach · strict third person',pattern_id:row.anchor_pattern_id||null,mastery_content_type:row.anchor_pattern_id?'pattern':'assessment_item',mastery_content_id:row.anchor_pattern_id||row.id,authored:true,practice_bank:true}
  };
}

async function level(){
  var h=home(),books=arr(h&&h.books),wanted=text(h&&h.activeBookId),book=books.find(function(b){return String(b.book_id)===wanted;})||books[0]||null;
  if(!book)return 0;
  var direct=Number(book.public_level||book.publicLevel)||0;
  if(direct>=1&&direct<=10)return direct;
  var internal=Number(book.internal_level_id)||0;
  if(internal>2&&internal<=12)return internal-2;
  var id=text(book.book_id);
  if(!id)return 0;
  try{
    var rows=arr(await get('content_books?select=id,public_level&id=eq.'+encodeURIComponent(id)+'&status=in.(review,published)&limit=1'));
    var n=Number(rows[0]&&rows[0].public_level)||0;
    return n>=1&&n<=10?n:0;
  }catch(_){return 0;}
}

if(typeof coach.registerProvider==='function')coach.registerProvider('thirdPersonGrammar',async function(args,ctx){
  var codes=['third_person','does_questions','does_not_negative'];
  var concepts=arr(await get('grammar_concepts?select=id,code&code=in.('+codes.join(',')+')&status=neq.archived'));
  var ids=concepts.map(function(x){return x.id;}).filter(Boolean);if(!ids.length)return null;
  var links=arr(await get('assessment_item_concepts?select=assessment_item_id&concept_domain=eq.grammar&concept_id=in.('+ids.join(',')+')&limit=1000'));
  var pLinks=arr(await get('pattern_concepts?select=pattern_id&concept_id=in.('+ids.join(',')+')&limit=1000'));
  var itemIds=Array.from(new Set(links.map(function(x){return x.assessment_item_id;}).filter(Boolean)));
  var patternIds=Array.from(new Set(pLinks.map(function(x){return x.pattern_id;}).filter(Boolean)));
  var fields='id,book_id,unit_id,level_id,difficulty_rating,item_type,prompt_text,context_text,correct_answer,choices,anchor_pattern_id',rows=[];
  if(itemIds.length)rows=rows.concat(arr(await get('assessment_items?select='+fields+'&id=in.('+itemIds.slice(0,500).join(',')+')&status=eq.published&is_flagged=eq.false&item_type=in.(grammar,grammar_error,grammar_application)&limit=500')));
  if(patternIds.length)rows=rows.concat(arr(await get('assessment_items?select='+fields+'&anchor_pattern_id=in.('+patternIds.slice(0,300).join(',')+')&status=eq.published&is_flagged=eq.false&item_type=in.(grammar,grammar_error,grammar_application)&limit=500')));
  var seen={},filtered=[];
  rows.forEach(function(r){if(!r||!r.id||seen[r.id])return;seen[r.id]=1;if(isStrictThirdPersonRow(r))filtered.push(r);});
  var target=Number(ctx&&ctx.book&&ctx.book.internal_level_id)||((Number(ctx&&ctx.publicLevel)||0)+2);
  if(target)filtered=filtered.filter(function(r){var lv=Number(r.level_id)||target;return lv<=target+1;});
  var items=shuffle(filtered).map(mapGrammar).filter(Boolean).slice(0,Number(args&&args.count)||10);
  return{type:'coach_grammar_concept',title:args&&args.title||{ko:'3인칭 단수 문법 연습',en:'Third-person grammar practice'},message:{ko:'이번에는 3인칭 단수 형태를 실제로 구별해야 하는 문제만 골랐어요.',en:'This set only includes questions that actually test third-person verb forms or does/doesn’t.'},items:items};
});

coach.registerCapability({
  id:'third_person',
  score:async function(){return (await level())>=2?95:0;},
  available:async function(){return (await level())>=2;},
  label:{ko:'3인칭 단수 연습',en:'Third-person verb practice'},
  response:{
    ko:'3인칭 단수는 동사 형태 자체를 연습하거나, 실제 문장 속 문법 문제로 연습할 수 있어요.',
    en:'You can practice third-person verb forms directly or use them in full grammar questions.'
  },
  actions:[
    {label:{ko:'동사 형태 연습',en:'Practice verb forms'},provider:'morphology',args:{type:'third_person',count:10}},
    {label:{ko:'3인칭 단수 문법 문제',en:'Third-person grammar questions'},provider:'thirdPersonGrammar',args:{count:10,title:{ko:'3인칭 단수 문법 연습',en:'Third-person grammar practice'}}}
  ]
});

coach.registerCapability({
  id:'past',
  score:async function(){return (await level())>=4?93:0;},
  available:async function(){return (await level())>=4;},
  label:{ko:'과거형 연습',en:'Past-tense practice'},
  response:{
    ko:'과거형은 동사 형태를 외우는 연습과 실제 문장 속 과거 시제 문법 연습을 같이 하면 좋아요.',
    en:'Past tense is useful to practice both as verb forms and inside full grammar questions.'
  },
  actions:[
    {label:{ko:'과거형 동사 연습',en:'Practice past-tense verbs'},provider:'morphology',args:{type:'past',count:10}},
    {label:{ko:'과거 시제 문법 문제',en:'Past-tense grammar questions'},provider:'grammarConcept',args:{codes:['past_simple','did_questions','past_be'],count:10,title:{ko:'과거 시제 문법 연습',en:'Past-tense grammar practice'}}}
  ]
});

coach.registerCapability({
  id:'past_participle',
  score:async function(){return (await level())>=5?92:0;},
  available:async function(){return (await level())>=5;},
  label:{ko:'과거분사 연습',en:'Past participle practice'},
  response:{
    ko:'과거분사는 규칙형과 불규칙형을 따로 반복해서 익히는 게 좋아요.',
    en:'Past participles are worth practicing as their own verb forms, especially the irregular ones.'
  },
  actions:[
    {label:{ko:'과거분사 동사 연습',en:'Practice participle forms'},provider:'morphology',args:{type:'past_participle',count:10}}
  ]
});
})(window);
