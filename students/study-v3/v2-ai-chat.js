(function(global){
'use strict';

var CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var HEADERS={apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY};
var CACHE_PREFIX='willena-study-v2-home:v1:';
var chatBusy=false;
var lastPlan=null;
var customSession=null;

var KO_SKILL={vocabulary:'어휘',spelling:'철자',grammar:'문법',sentence_building:'문장 만들기',conversation:'회화',listening:'듣기',reading:'읽기'};
var EN_SKILL={vocabulary:'vocabulary',spelling:'spelling',grammar:'grammar',sentence_building:'sentence building',conversation:'conversation',listening:'listening',reading:'reading'};

function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function uid(){try{return text(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function isKo(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function skillName(skill){return (isKo()?KO_SKILL:EN_SKILL)[skill]||skill|| (isKo()?'영어':'English');}
function shuffle(items){var a=items.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
function uniqueById(items){var seen={},out=[];items.forEach(function(x){if(!x||!x.id||seen[x.id])return;seen[x.id]=true;out.push(x);});return out;}
function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}

function currentContext(){
  var c=null;
  try{c=JSON.parse(localStorage.getItem(CACHE_PREFIX+uid())||'null');}catch(_){}
  var books=c&&arr(c.books)||[],wanted=c&&c.activeBookId;
  var book=books.find(function(b){return String(b.book_id)===String(wanted);})||books[0]||null;
  if(!book)return null;
  var unit=book.currentUnit||arr(book.units)[0]||null;
  if(!unit)return null;
  return{bookId:String(book.book_id),bookTitle:text(book.book_title||book.title||document.getElementById('bookTitle')&&document.getElementById('bookTitle').textContent),unitId:String(unit.id),unitNumber:Number(unit.unit_number)||1,unitTitle:text(unit.title),book:book,unit:unit};
}

function masteryRows(){
  return arr(Array.prototype.slice.call(document.querySelectorAll('#masteryGrid [data-skill]'))).map(function(card){
    var pct=Number(text(card.querySelector('.header-skill-master-pct')&&card.querySelector('.header-skill-master-pct').textContent).replace(/[^0-9.]/g,''))||0;
    return{skill:text(card.dataset.skill),pct:pct,card:card};
  }).filter(function(x){return x.skill;});
}
function weakestSkill(preferred){
  var rows=masteryRows();
  if(preferred&&preferred.length){var chosen=rows.filter(function(x){return preferred.indexOf(x.skill)>=0;}).sort(function(a,b){return a.pct-b.pct;})[0];if(chosen)return chosen;}
  return rows.sort(function(a,b){return a.pct-b.pct;})[0]||null;
}

async function get(path){
  var r=await fetch(CONTENT_URL+'/rest/v1/'+path,{headers:HEADERS,cache:'no-store'});
  if(!r.ok)throw new Error('AI Coach question search failed ('+r.status+')');
  return r.json();
}
function selectFields(){return'id,book_id,unit_id,level_id,difficulty_rating,item_type,prompt_text,context_text,correct_answer,metadata,choices,anchor_pattern_id,anchor_lexical_entry_id';}
function optionTexts(row){return arr(row.choices).map(function(x){return typeof x==='string'?x:text(x&&x.text||x&&x.option_text);}).filter(Boolean);}
function answerText(row){var a=row.correct_answer;if(typeof a==='string'||typeof a==='number')return String(a);if(a&&typeof a==='object')return text(a.text||a.answer||a.value);return'';}
function skillForRow(row){var t=text(row.item_type);if(t==='grammar'||t==='grammar_error'||t==='grammar_application')return'grammar';if(t==='vocabulary')return'vocabulary';return null;}
function mapAssessment(row,ctx){
  var skill=skillForRow(row),correct=answerText(row),choices=optionTexts(row);if(!skill||!correct||choices.length<1)return null;
  if(choices.indexOf(correct)<0)choices.push(correct);
  choices=shuffle(choices);
  var patternId=row.anchor_pattern_id||row.metadata&&row.metadata.pattern_id||null;
  var lexicalId=row.anchor_lexical_entry_id||row.metadata&&row.metadata.lexical_entry_id||null;
  var masteryType=skill==='grammar'&&patternId?'pattern':(lexicalId?'lexical_entry':'assessment_item');
  var masteryId=skill==='grammar'&&patternId?patternId:(lexicalId||row.id);
  return{
    id:'ai-coach-'+row.id,
    sourceType:'assessment_item',sourceId:row.id,skill:skill,usage:['practice'],
    stimulus:{type:'text',prompt:text(row.prompt_text),context:text(row.context_text)||(isKo()?'알맞은 답을 고르세요.':'Choose the best answer.')},
    response:{type:'multiple_choice',choices:choices},answer:correct,
    level:Number(row.level_id)||null,difficulty:Number(row.difficulty_rating)||null,
    metadata:{
      book_id:ctx.bookId,unit_id:ctx.unitId,
      ai_coach:true,ai_coach_cross_book:String(row.book_id)!==String(ctx.bookId),
      source_book_id:row.book_id||null,source_unit_id:row.unit_id||null,
      source_label:'AI Coach',assessment_item_type:row.item_type,
      pattern_id:patternId,lexical_entry_id:lexicalId,
      mastery_content_type:masteryType,mastery_content_id:masteryId,
      authored:true,practice_bank:true
    }
  };
}

async function currentUnitAssessment(ctx){
  var path='assessment_items?select='+encodeURIComponent(selectFields())+'&book_id=eq.'+encodeURIComponent(ctx.bookId)+'&unit_id=eq.'+encodeURIComponent(ctx.unitId)+'&status=eq.published&is_flagged=eq.false&item_type=in.(grammar,grammar_error,grammar_application,vocabulary)&limit=240';
  return arr(await get(path));
}
function mostCommon(values){var count={},best=null,bestN=0;values.filter(Boolean).forEach(function(v){count[v]=(count[v]||0)+1;if(count[v]>bestN){best=v;bestN=count[v];}});return best;}
function usefulThemeTag(tags){
  var blocked=/^(willena|auto_link|vocab_expansion|grammar_chunk|core_|level_|come-on|english[-_ ]?bus|starter|verb$|noun$|adjective$|multiword$)/i;
  return arr(tags).map(text).filter(function(t){return t&&!blocked.test(t);})[0]||null;
}

async function grammarChallenge(ctx,currentRows){
  var grammar=currentRows.filter(function(r){return skillForRow(r)==='grammar'&&r.anchor_pattern_id;});
  var patternId=mostCommon(grammar.map(function(r){return r.anchor_pattern_id;}));if(!patternId)return[];
  var path='assessment_items?select='+encodeURIComponent(selectFields())+'&anchor_pattern_id=eq.'+encodeURIComponent(patternId)+'&status=eq.published&is_flagged=eq.false&item_type=in.(grammar,grammar_error,grammar_application)&limit=120';
  var rows=arr(await get(path));
  rows.sort(function(a,b){var ax=String(a.book_id)===ctx.bookId?1:0,bx=String(b.book_id)===ctx.bookId?1:0;return ax-bx;});
  return uniqueById(rows).map(function(r){return mapAssessment(r,ctx);}).filter(Boolean).slice(0,12);
}
async function vocabularyChallenge(ctx,currentRows){
  var ids=currentRows.filter(function(r){return skillForRow(r)==='vocabulary'&&r.anchor_lexical_entry_id;}).map(function(r){return r.anchor_lexical_entry_id;});
  ids=Array.from(new Set(ids)).slice(0,12);if(!ids.length)return[];
  var lex=arr(await get('lexical_entries?select=id,tags&id=in.('+ids.map(encodeURIComponent).join(',')+')&status=in.(review,published)&limit=30'));
  var theme=null;for(var i=0;i<lex.length&&!theme;i++)theme=usefulThemeTag(lex[i].tags);
  var relatedIds=ids.slice();
  if(theme){
    try{
      var rel=arr(await get('lexical_entries?select=id,tags&tags=ov.%7B'+encodeURIComponent(theme)+'%7D&status=in.(review,published)&limit=80'));
      relatedIds=Array.from(new Set(rel.map(function(x){return x.id;}).concat(relatedIds))).slice(0,60);
    }catch(_){}
  }
  if(!relatedIds.length)return[];
  var path='assessment_items?select='+encodeURIComponent(selectFields())+'&anchor_lexical_entry_id=in.('+relatedIds.map(encodeURIComponent).join(',')+')&status=eq.published&is_flagged=eq.false&item_type=eq.vocabulary&limit=160';
  var rows=arr(await get(path));
  rows.sort(function(a,b){var ax=String(a.book_id)===ctx.bookId?1:0,bx=String(b.book_id)===ctx.bookId?1:0;return ax-bx;});
  return uniqueById(rows).map(function(r){return mapAssessment(r,ctx);}).filter(Boolean).slice(0,12);
}

async function levelBank(ctx,avoidSkill){
  var books=arr(await get('content_books?select=internal_level_id,public_level&id=eq.'+encodeURIComponent(ctx.bookId)+'&status=in.(review,published)&limit=1'));
  var book=books[0]||{},level=Number(book.internal_level_id)||((Number(book.public_level)||0)+2)||null;if(!level)return[];
  var path='assessment_items?select='+encodeURIComponent(selectFields())+'&level_id=eq.'+encodeURIComponent(level)+'&status=eq.published&is_flagged=eq.false&item_type=in.(grammar,grammar_error,grammar_application,vocabulary)&limit=220';
  var rows=shuffle(arr(await get(path))).filter(function(r){return String(r.book_id)!==ctx.bookId;});
  if(avoidSkill){var alt=rows.filter(function(r){return skillForRow(r)!==avoidSkill;});if(alt.length>=6)rows=alt;}
  return uniqueById(rows).map(function(r){return mapAssessment(r,ctx);}).filter(Boolean).slice(0,12);
}

function promptText(intent){var ko=isKo();var m=ko?{
  improve:'이 단원에서 뭘 더 연습하면 좋을까요?',challenge:'비슷한 문제로 더 도전할래요',new:'새로운 걸 해볼래요',today:'오늘 뭘 연습하면 좋을까요?'
}:{
  improve:'What can I improve in this unit?',challenge:'Challenge me with more like this',new:'Give me something new',today:'What should I practice today?'
};return m[intent];}

async function candidates(){
  var coach=global.WillenaStudyV2Coach;if(!coach||typeof coach.getCandidates!=='function')return[];
  var list=coach.getCandidates()||[];
  if(!list.length&&typeof coach.refresh==='function'){try{await coach.refresh();}catch(_){}list=coach.getCandidates()||[];}
  return list;
}
function candidateIndex(c,list){return list.indexOf(c);}

async function buildPlan(intent){
  var ctx=currentContext();if(!ctx)return{message:isKo()?'교재 정보를 아직 불러오는 중이에요. 잠시 후 다시 눌러 주세요.':'I am still loading your book. Try again in a moment.',action:null};
  var weak=weakestSkill(),weakName=skillName(weak&&weak.skill);

  if(intent==='improve'){
    if(weak&&['grammar','vocabulary'].indexOf(weak.skill)>=0){
      try{
        var rows=await currentUnitAssessment(ctx),items=rows.filter(function(r){return skillForRow(r)===weak.skill;}).map(function(r){return mapAssessment(r,ctx);}).filter(Boolean);
        items=shuffle(items).slice(0,12);
        if(items.length){return{items:items,title:(isKo()?weakName+' 집중 연습':'Focused '+weakName+' practice'),message:isKo()?'이 단원에서는 '+weakName+'을 조금 더 연습하면 좋아요. 같은 단원에서 핵심 문제 '+items.length+'개를 골랐어요. 한 번 더 풀면 훨씬 탄탄해질 거예요.':'I think a little more '+weakName+' practice will help most in this unit. I picked '+items.length+' useful questions for one focused round.',action:isKo()?items.length+'문제 연습하기 →':'Practice '+items.length+' questions →'};}
      }catch(e){console.debug('[AI Coach improve]',e);}
    }
    if(weak)return{domSkill:weak.skill,message:isKo()?'이 단원에서는 '+weakName+'을 한 번 더 연습하는 게 가장 좋아 보여요. 짧게 다시 풀어 보면 훨씬 편해질 거예요.':'I think '+weakName+' is the best thing to revisit in this unit. One short round should make it feel much easier.',action:isKo()?'연습 시작 →':'Start practice →'};
  }

  if(intent==='challenge'){
    var target=weakestSkill(['grammar','vocabulary'])||weak;
    if(target&&['grammar','vocabulary'].indexOf(target.skill)>=0){
      try{
        var current=await currentUnitAssessment(ctx),related=target.skill==='grammar'?await grammarChallenge(ctx,current):await vocabularyChallenge(ctx,current);
        if(related.length>=3){var sn=skillName(target.skill);return{items:related,title:(isKo()?sn+' 도전':'More '+sn+' like this'),message:isKo()?'좋아요. 이 단원에서 쓰는 '+sn+'과 연결되는 문제를 다른 교재에서도 찾아봤어요. 비슷한 개념이지만 문장과 상황이 다른 문제 '+related.length+'개를 준비했어요.':'Challenge accepted. I found '+related.length+' questions from across the curriculum that use the same '+sn+' idea, but with different sentences and situations.',action:isKo()?related.length+'문제 도전하기 →':'Take the '+related.length+'-question challenge →'};}
      }catch(e){console.debug('[AI Coach challenge]',e);}
    }
  }

  if(intent==='new'){
    try{
      var fresh=await levelBank(ctx,weak&&weak.skill);if(fresh.length){var freshSkill=skillName(fresh[0].skill);return{items:fresh,title:isKo()?'새로운 도전':'Something new',message:isKo()?'좋아요. 지금 수준에 맞지만 이 단원과는 조금 다른 '+freshSkill+' 문제를 골랐어요. 다른 교재에서 가져온 문제도 섞어서 '+fresh.length+'개 준비했어요.':'I found something new at about the right level. I mixed in '+fresh.length+' '+freshSkill+' questions from other parts of the curriculum.',action:isKo()?fresh.length+'문제 해보기 →':'Try '+fresh.length+' questions →'};}
    }catch(e){console.debug('[AI Coach new]',e);}
  }

  var list=await candidates();
  if(list.length){
    var chosen=list[0];
    if(intent==='new')chosen=list.find(function(c){return c.type==='preview'||String(c.bookTitle)!==text(document.getElementById('bookTitle')&&document.getElementById('bookTitle').textContent);})||chosen;
    if(intent==='challenge'&&weak)chosen=list.find(function(c){return c.skill===weak.skill;})||chosen;
    var name=skillName(chosen.skill);
    return{candidateIndex:candidateIndex(chosen,list),message:isKo()?name+'을 연습하는 게 좋아 보여요. 지금 기록을 보고 가장 도움이 될 만한 연습을 골랐어요.':'I think '+name+' is the best choice right now. I picked the practice that should help most from your recent work.',action:isKo()?'추천 연습 시작 →':'Start recommended practice →'};
  }

  if(weak)return{domSkill:weak.skill,message:isKo()?weakName+'을 짧게 한 번 더 해볼까요? 지금 바로 시작할 수 있어요.':'How about one short '+weakName+' round? You can start right away.',action:isKo()?'연습 시작 →':'Start practice →'};
  return{message:isKo()?'아직 추천할 만큼 학습 기록이 없어요. 교재 연습을 조금 한 뒤 다시 물어봐 주세요.':'I need a little more study history before I can make a useful recommendation.',action:null};
}

function trimTranscript(){var t=document.getElementById('aiChatTranscript');if(!t)return;while(t.children.length>7)t.removeChild(t.firstChild);}
function addBubble(kind,content,thinking){var t=document.getElementById('aiChatTranscript');if(!t)return null;var row=document.createElement('div');row.className='study-v2-ai-chat-row is-'+kind;var bubble=document.createElement('div');bubble.className='study-v2-ai-chat-bubble';if(thinking){bubble.innerHTML='<span class="study-v2-ai-thinking">'+escapeHtml(content)+'<span class="study-v2-ai-thinking-dots"><i></i><i></i><i></i></span></span>';}else bubble.textContent=content;row.appendChild(bubble);t.appendChild(row);trimTranscript();return{row:row,bubble:bubble};}
async function typeBubble(message){var x=addBubble('coach','');if(!x)return;var speed=message.length>150?7:11;for(var i=0;i<message.length;i++){x.bubble.textContent+=message.charAt(i);if(i%2===0)await sleep(speed);}return x;}
function setPromptDisabled(disabled){document.querySelectorAll('#aiChatPrompts .study-v2-ai-prompt').forEach(function(b){b.disabled=disabled;});}
function clearCta(){var c=document.getElementById('aiChatCta');if(c)c.innerHTML='';}
function showCta(plan){var c=document.getElementById('aiChatCta');if(!c)return;c.innerHTML='';if(!plan||!plan.action)return;var b=document.createElement('button');b.type='button';b.className='study-v2-ai-chat-cta';b.textContent=plan.action;b.addEventListener('click',function(){launchPlan(plan);});c.appendChild(b);}

async function ask(intent){
  if(chatBusy)return;chatBusy=true;setPromptDisabled(true);clearCta();addBubble('user',promptText(intent));
  var thinking=addBubble('coach',isKo()?'생각하고 있어요':'Thinking',true);
  var start=Date.now(),plan;try{plan=await buildPlan(intent);}catch(e){console.warn('[AI Coach]',e);plan={message:isKo()?'문제를 고르는 중에 잠깐 문제가 생겼어요. 다시 한 번 눌러 주세요.':'I had trouble choosing a practice set. Please try again.',action:null};}
  var wait=Math.max(0,650-(Date.now()-start));if(wait)await sleep(wait);
  if(thinking&&thinking.row&&thinking.row.parentNode)thinking.row.parentNode.removeChild(thinking.row);
  await typeBubble(plan.message);lastPlan=plan;showCta(plan);setPromptDisabled(false);chatBusy=false;
}

function launchPlan(plan){
  if(!plan)return;
  if(plan.items&&plan.items.length){startCustomPractice(plan);return;}
  if(plan.domSkill){var card=document.querySelector('#masteryGrid [data-skill="'+String(plan.domSkill).replace(/"/g,'\\"')+'"]');if(card){card.click();return;}}
  if(Number.isInteger(plan.candidateIndex)){var hidden=document.querySelector('#aiGrid [data-coach-index="'+plan.candidateIndex+'"]');if(hidden){hidden.click();return;}}
}

function ensurePracticeOverlay(){
  var overlay=document.getElementById('aiCoachPracticeOverlay');if(overlay)return overlay;
  overlay=document.createElement('section');overlay.id='aiCoachPracticeOverlay';overlay.className='ai-coach-practice-overlay';overlay.hidden=true;
  overlay.innerHTML='<div class="ai-coach-practice-shell"><header class="ai-coach-practice-head"><button id="aiCoachPracticeBack" class="ai-coach-practice-back" type="button" aria-label="Back">←</button><div class="ai-coach-practice-title"><span>AI COACH</span><h2 id="aiCoachPracticeTitle"></h2><div id="aiCoachPracticeProgress" class="ai-coach-practice-progress"></div></div></header><div class="ai-coach-practice-card"><div id="aiCoachActivityRoot"></div></div><button id="aiCoachPracticeNext" class="ai-coach-practice-next" type="button" disabled></button></div>';
  document.body.appendChild(overlay);
  overlay.querySelector('#aiCoachPracticeBack').addEventListener('click',closeCustomPractice);
  overlay.querySelector('#aiCoachPracticeNext').addEventListener('click',nextCustomPractice);
  return overlay;
}
function startCustomPractice(plan){
  var overlay=ensurePracticeOverlay(),root=overlay.querySelector('#aiCoachActivityRoot'),next=overlay.querySelector('#aiCoachPracticeNext');
  if(!global.WillenaActivityEngine||!root)return;
  customSession={items:shuffle(plan.items).slice(0,12),index:0,answered:false,title:plan.title||'AI Coach',engine:null};
  customSession.engine=new global.WillenaActivityEngine(root,{onAnswer:function(){customSession.answered=true;next.disabled=false;next.textContent=customSession.index>=customSession.items.length-1?(isKo()?'완료':'Finish'):(isKo()?'다음':'Next');}});
  overlay.querySelector('#aiCoachPracticeTitle').textContent=customSession.title;overlay.hidden=false;document.documentElement.style.overflow='hidden';showCustomItem();
}
function showCustomItem(){
  if(!customSession)return;var overlay=ensurePracticeOverlay(),item=customSession.items[customSession.index],next=overlay.querySelector('#aiCoachPracticeNext');if(!item)return closeCustomPractice(true);
  customSession.answered=false;next.disabled=true;next.textContent=isKo()?'다음':'Next';overlay.querySelector('#aiCoachPracticeProgress').textContent=(customSession.index+1)+' / '+customSession.items.length;customSession.engine.setActivity(item);overlay.scrollTo({top:0,behavior:'auto'});
}
function nextCustomPractice(){if(!customSession||!customSession.answered)return;if(customSession.index>=customSession.items.length-1){closeCustomPractice(true);return;}customSession.index++;showCustomItem();}
function closeCustomPractice(completed){
  var overlay=document.getElementById('aiCoachPracticeOverlay');if(overlay)overlay.hidden=true;document.documentElement.style.overflow='';customSession=null;
  if(completed){var section=document.getElementById('aiRecommendations');if(section)section.scrollIntoView({behavior:'auto',block:'start'});setTimeout(function(){addBubble('coach',isKo()?'잘했어요! 한 번 더 도전하거나, 이번에는 새로운 걸 골라도 좋아요.':'Nice work! You can go again, or ask me for something new this time.');},120);}
}

function renderPrompts(){
  var p=document.getElementById('aiChatPrompts');if(!p)return;
  var intents=['improve','challenge','new','today'];p.innerHTML=intents.map(function(i){return'<button class="study-v2-ai-prompt" type="button" data-ai-intent="'+i+'">'+escapeHtml(promptText(i))+'</button>';}).join('');
  p.querySelectorAll('[data-ai-intent]').forEach(function(b){b.addEventListener('click',function(){ask(b.dataset.aiIntent);});});
}
function resetChat(){
  var heading=document.getElementById('aiHeading');if(heading)heading.textContent=isKo()?'AI 코치':'AI Coach';
  var t=document.getElementById('aiChatTranscript');if(t){t.innerHTML='';addBubble('coach',isKo()?'무엇을 도와줄까요? 원하는 걸 골라 보세요.':'What can I help you with? Pick one below.');}
  clearCta();renderPrompts();
}
function mount(){
  var shell=document.getElementById('aiChat');if(!shell)return;resetChat();
  document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('#languageBtn'))setTimeout(resetChat,140);},true);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();

global.WillenaStudyV2AIChat={ask:ask,reset:resetChat,getLastPlan:function(){return lastPlan;}};
})(window);
