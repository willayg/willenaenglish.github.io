(function(global){
'use strict';
var busy=false,observer=null,timer=0;
var CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var HEADERS={apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY};
var CACHE_PREFIX='willena-study-v2-home:v1:';
function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function uid(){try{return text(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function ko(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function label(type){
  if(type==='past_participle')return ko()?'과거분사 퀴즈 해볼래요?':'How about a participle quiz?';
  if(type==='past')return ko()?'과거형 퀴즈 해볼래요?':'How about a past-tense quiz?';
  return ko()?'3인칭 단수 퀴즈 해볼래요?':'How about a third-person verb quiz?';
}
function userChoice(type){
  if(type==='past_participle')return ko()?'과거분사를 연습하고 싶어요.':'I want to practice past participles.';
  if(type==='past')return ko()?'과거형을 연습하고 싶어요.':'I want to practice past tense.';
  return ko()?'3인칭 단수를 연습하고 싶어요.':'I want to practice third-person verbs.';
}
function typesFor(level){
  if(level<=1)return[];
  if(level===2)return['third_person'];
  if(level===3)return['third_person'];
  if(level===4)return['third_person','past'];
  if(level===5)return['past','past_participle'];
  return['past_participle','past','third_person'];
}
function schedule(){clearTimeout(timer);timer=setTimeout(sync,80);}
function sameTypes(buttons,types){if(buttons.length!==types.length)return false;for(var i=0;i<types.length;i++)if(buttons[i].dataset.morphType!==types[i])return false;return true;}
function ownedNode(n){return !!(n&&n.nodeType===1&&n.matches&&n.matches('[data-morph-coach]'));}
function addBubble(kind,message){
  var t=document.getElementById('aiChatTranscript');if(!t)return;
  var row=document.createElement('div');row.className='study-v2-ai-chat-row is-'+kind;
  var bubble=document.createElement('div');bubble.className='study-v2-ai-chat-bubble';bubble.textContent=message;
  row.appendChild(bubble);t.appendChild(row);while(t.children.length>7)t.removeChild(t.firstChild);
}
function clearCta(){var c=document.getElementById('aiChatCta');if(c)c.innerHTML='';}
function setPromptActions(actions){
  var p=document.getElementById('aiChatPrompts');if(!p)return;
  p.innerHTML='';
  arr(actions).forEach(function(a){
    var b=document.createElement('button');b.type='button';b.className='study-v2-ai-prompt';b.dataset.morphCoach='followup';b.textContent=a.label;b.addEventListener('click',a.handler,{once:true});p.appendChild(b);
  });
}
function currentBook(){
  try{var c=JSON.parse(localStorage.getItem(CACHE_PREFIX+uid())||'null'),books=arr(c&&c.books),wanted=c&&c.activeBookId;return books.find(function(b){return String(b.book_id)===String(wanted);})||books[0]||null;}catch(_){return null;}
}
async function get(path){var r=await fetch(CONTENT_URL+'/rest/v1/'+path,{headers:HEADERS,cache:'no-store'});if(!r.ok)throw new Error('Coach grammar '+r.status);return r.json();}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),x=a[i];a[i]=a[j];a[j]=x;}return a;}
function optionTexts(row){return arr(row.choices).map(function(x){return typeof x==='string'?x:text(x&&x.text||x&&x.option_text);}).filter(Boolean);}
function answerText(row){var a=row.correct_answer;if(typeof a==='string'||typeof a==='number')return String(a);if(a&&typeof a==='object')return text(a.text||a.answer||a.value);return'';}
function mapGrammar(row){
  var correct=answerText(row),choices=optionTexts(row);if(!correct||!choices.length)return null;if(choices.indexOf(correct)<0)choices.push(correct);
  return{id:'ai-coach-third-person-'+row.id,sourceType:'assessment_item',sourceId:row.id,skill:'grammar',usage:['practice'],stimulus:{type:'text',prompt:text(row.prompt_text),context:text(row.context_text)||(ko()?'알맞은 답을 고르세요.':'Choose the best answer.')},response:{type:'multiple_choice',choices:shuffle(choices)},answer:correct,level:Number(row.level_id)||null,difficulty:Number(row.difficulty_rating)||null,metadata:{ai_coach:true,ai_coach_cross_book:true,source_label:'AI Coach · third person',assessment_item_type:row.item_type,pattern_id:row.anchor_pattern_id||null,mastery_content_type:row.anchor_pattern_id?'pattern':'assessment_item',mastery_content_id:row.anchor_pattern_id||row.id,authored:true,practice_bank:true}};
}
async function thirdPersonGrammarItems(){
  var concepts=arr(await get('grammar_concepts?select=id&code=in.(third_person,does_questions,does_not_negative)&status=neq.archived'));
  var conceptIds=concepts.map(function(x){return x.id;});if(!conceptIds.length)return[];
  var inConcept='('+conceptIds.join(',')+')';
  var links=arr(await get('assessment_item_concepts?select=assessment_item_id&concept_domain=eq.grammar&concept_id=in.'+inConcept+'&limit=1000'));
  var patternLinks=arr(await get('pattern_concepts?select=pattern_id&concept_id=in.'+inConcept+'&limit=1000'));
  var itemIds=Array.from(new Set(links.map(function(x){return x.assessment_item_id;}).filter(Boolean)));
  var patternIds=Array.from(new Set(patternLinks.map(function(x){return x.pattern_id;}).filter(Boolean)));
  var fields='id,book_id,unit_id,level_id,difficulty_rating,item_type,prompt_text,context_text,correct_answer,choices,anchor_pattern_id';
  var rows=[];
  if(itemIds.length)rows=rows.concat(arr(await get('assessment_items?select='+fields+'&id=in.('+itemIds.slice(0,500).join(',')+')&status=eq.published&is_flagged=eq.false&item_type=in.(grammar,grammar_error,grammar_application)&limit=500')));
  if(patternIds.length)rows=rows.concat(arr(await get('assessment_items?select='+fields+'&anchor_pattern_id=in.('+patternIds.slice(0,300).join(',')+')&status=eq.published&is_flagged=eq.false&item_type=in.(grammar,grammar_error,grammar_application)&limit=500')));
  var seen={},unique=[];rows.forEach(function(r){if(r&&r.id&&!seen[r.id]){seen[r.id]=1;unique.push(r);}});
  var book=currentBook(),target=Number(book&&(book.internal_level_id||book.internalLevel))||0;
  if(!target){try{var bId=book&&book.book_id;if(bId){var br=arr(await get('content_books?select=internal_level_id,public_level&id=eq.'+encodeURIComponent(bId)+'&limit=1'))[0]||{};target=Number(br.internal_level_id)||((Number(br.public_level)||0)+2);}}catch(_){}}
  if(target)unique=unique.filter(function(r){var lv=Number(r.level_id)||target;return lv<=target+1;}).sort(function(a,b){return Math.abs((Number(a.level_id)||target)-target)-Math.abs((Number(b.level_id)||target)-target);});
  return shuffle(unique.slice(0,60)).map(mapGrammar).filter(Boolean).slice(0,12);
}
async function launchThirdPersonGrammar(){
  clearCta();setPromptActions([]);addBubble('user',ko()?'문장 속에서 연습할래요.':'Practice it in grammar questions.');
  addBubble('coach',ko()?'좋아요. 여러 교재에서 3인칭 단수와 does 문법 문제를 찾고 있어요.':'Great. I’m pulling third-person and does grammar questions from across the curriculum.');
  try{
    var items=await thirdPersonGrammarItems();
    if(!items.length){addBubble('coach',ko()?'지금 사용할 수 있는 문법 문제를 찾지 못했어요.':'I couldn’t find a usable grammar set just now.');return;}
    var practice=global.WillenaStudyV2AIPractice;if(!practice||typeof practice.open!=='function')return;
    practice.open({type:'third_person_grammar',title:ko()?'3인칭 단수 문법 연습':'Third-person grammar practice',items:items});
  }catch(e){console.debug('[Morphology Coach grammar]',e);addBubble('coach',ko()?'문법 문제를 불러오는 중에 문제가 생겼어요. 다시 시도해 주세요.':'I had trouble loading the grammar questions. Please try again.');}
}
function respond(type){
  clearCta();addBubble('user',userChoice(type));
  var side=global.WillenaMorphologySidecar;if(!side)return;
  if(type==='third_person'){
    addBubble('coach',ko()?'좋아요. 3인칭 단수는 두 가지로 연습하면 좋아요. likes, goes, has, does 같은 동사 형태 자체를 연습할 수도 있고, 여러 교재에서 3인칭 단수를 실제 문장에 쓰는 문법 문제를 풀 수도 있어요. 어떤 걸 해볼까요?':'Good choice. There are two useful ways to practice third-person verbs: work directly on forms like likes, goes, has and does, or use them in full grammar questions pulled from across the curriculum. Which would you like?');
    setPromptActions([
      {label:ko()?'동사 형태 연습':'Practice verb forms',handler:function(){side.launchQuiz('third_person',10);}},
      {label:ko()?'3인칭 단수 문법 문제':'Third-person grammar questions',handler:launchThirdPersonGrammar}
    ]);
    return;
  }
  if(type==='past'){
    addBubble('coach',ko()?'좋아요. 과거형은 특히 불규칙 동사를 반복해서 익히는 게 중요해요. 먼저 동사 형태를 집중해서 연습해 볼까요?':'Good choice. Past-tense practice is especially useful for building strong recall of irregular verbs. Start with a focused verb-form round?');
    setPromptActions([{label:ko()?'과거형 동사 연습':'Practice past-tense verbs',handler:function(){side.launchQuiz('past',10);}}]);return;
  }
  addBubble('coach',ko()?'좋아요. 과거분사는 불규칙 형태와 규칙형을 함께 익히는 게 중요해요. 동사 형태부터 집중해서 연습해 볼까요?':'Good choice. Past participles are worth practicing as their own forms, especially the irregular ones. Start with a focused verb-form round?');
  setPromptActions([{label:ko()?'과거분사 동사 연습':'Practice participle forms',handler:function(){side.launchQuiz('past_participle',10);}}]);
}
async function sync(){
  if(busy)return;busy=true;
  try{
    var side=global.WillenaMorphologySidecar,p=document.getElementById('aiChatPrompts');
    if(!side||typeof side.resolveLevel!=='function'||typeof side.launchQuiz!=='function'||!p)return;
    if(p.querySelector('[data-morph-coach="followup"]'))return;
    var level=Number(await side.resolveLevel())||0,types=typesFor(level),existing=Array.prototype.slice.call(p.querySelectorAll('[data-morph-coach="maintenance"]'));
    if(sameTypes(existing,types)){existing.forEach(function(b,i){var next=label(types[i]);if(b.textContent!==next)b.textContent=next;});return;}
    p.querySelectorAll('[data-morph-coach]').forEach(function(b){b.remove();});
    var maxPrompts=4,morphCount=Math.min(types.length,maxPrompts),normalLimit=Math.max(0,maxPrompts-morphCount),normal=Array.prototype.slice.call(p.children);
    while(normal.length>normalLimit){var el=normal.pop();if(el&&el.parentNode===p)p.removeChild(el);}
    types.slice(0,morphCount).forEach(function(type){var b=document.createElement('button');b.type='button';b.className='study-v2-ai-prompt';b.dataset.morphCoach='maintenance';b.dataset.morphType=type;b.textContent=label(type);p.appendChild(b);});
  }catch(e){console.debug('[Morphology Coach Menu] sync skipped',e);}finally{busy=false;}
}
function bind(){
  var p=document.getElementById('aiChatPrompts');
  if(p&&global.MutationObserver){observer=new MutationObserver(function(mutations){var meaningful=mutations.some(function(m){return Array.prototype.some.call(m.addedNodes,function(n){return n.nodeType===1&&!ownedNode(n);})||Array.prototype.some.call(m.removedNodes,function(n){return n.nodeType===1&&!ownedNode(n);});});if(meaningful)schedule();});observer.observe(p,{childList:true});}
  document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('#aiChatPrompts [data-morph-coach="maintenance"][data-morph-type]');if(!b)return;e.preventDefault();e.stopPropagation();respond(b.dataset.morphType);},true);
  global.addEventListener('willena:morphology-updated',schedule);global.addEventListener('focus',schedule);
  document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('#languageBtn'))setTimeout(schedule,100);},true);
  var tries=0,boot=setInterval(function(){tries++;if(global.WillenaMorphologySidecar){clearInterval(boot);schedule();}else if(tries>80)clearInterval(boot);},100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})(window);
