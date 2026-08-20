(function(global){
'use strict';

var CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var HEADERS={apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY};
var capabilities=[];
var providers={};
var busy=false;
var state={view:'home',capability:null};
var unitCache={};
var levelCache={};

function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function ko(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function t(v){if(v==null)return'';if(typeof v==='string')return v;return ko()?text(v.ko||v.en):text(v.en||v.ko);}
function uid(){try{return text(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function shuffle(a){a=arr(a).slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),x=a[i];a[i]=a[j];a[j]=x;}return a;}
function unique(a){var seen={},out=[];arr(a).forEach(function(x){var id=text(x&&x.id||x&&x.sourceId);if(!id||seen[id])return;seen[id]=1;out.push(x);});return out;}
function getHome(){try{return JSON.parse(localStorage.getItem('willena-study-v2-home:v1:'+uid())||'null');}catch(_){return null;}}
function context(){var h=getHome(),books=arr(h&&h.books),wanted=h&&h.activeBookId,book=books.find(function(b){return String(b.book_id)===String(wanted);})||books[0]||null;if(!book)return null;var unit=book.currentUnit||arr(book.units)[0]||null;if(!unit)return null;var publicLevel=Number(book.public_level||book.publicLevel)||0;if(!publicLevel&&Number(book.internal_level_id)>2)publicLevel=Number(book.internal_level_id)-2;return{book:book,books:books,bookId:String(book.book_id),bookTitle:text(book.book_title||book.title),unit:unit,unitId:String(unit.id),unitNumber:Number(unit.unit_number)||1,publicLevel:publicLevel||1};}
function mastery(){return Array.prototype.slice.call(document.querySelectorAll('#masteryGrid [data-skill]')).map(function(card){var raw=text(card.querySelector('.header-skill-master-pct')&&card.querySelector('.header-skill-master-pct').textContent);return{skill:text(card.dataset.skill),pct:Number(raw.replace(/[^0-9.]/g,''))||0};}).filter(function(x){return x.skill;});}
function weakest(){return mastery().filter(function(x){return x.pct>0;}).sort(function(a,b){return a.pct-b.pct;})[0]||null;}
function skillName(s){var K={vocabulary:'어휘',spelling:'철자',grammar:'문법',sentence_building:'문장 만들기',conversation:'회화',listening:'듣기',reading:'읽기'},E={vocabulary:'vocabulary',spelling:'spelling',grammar:'grammar',sentence_building:'sentence building',conversation:'conversation',listening:'listening',reading:'reading'};return (ko()?K:E)[s]||s;}

function transcript(){return document.getElementById('aiChatTranscript');}
function choices(){return document.getElementById('aiCoachChoices');}
function clearLegacy(){var old=document.getElementById('aiChatPrompts');if(old){old.id='aiChatPromptsLegacy';old.hidden=true;old.innerHTML='';}var c=document.getElementById('aiChatCta');if(c){c.hidden=true;c.innerHTML='';}}
function ensureChoices(){var p=choices();if(p)return p;var chat=document.getElementById('aiChat');if(!chat)return null;p=document.createElement('div');p.id='aiCoachChoices';p.className='study-v2-ai-chat-prompts';chat.appendChild(p);return p;}
function bubble(kind,msg){var root=transcript();if(!root)return null;var row=document.createElement('div');row.className='study-v2-ai-chat-row is-'+kind;var b=document.createElement('div');b.className='study-v2-ai-chat-bubble';b.textContent=msg;row.appendChild(b);root.appendChild(row);while(root.children.length>8)root.removeChild(root.firstChild);try{root.scrollTop=root.scrollHeight;}catch(_){}return b;}
function renderButtons(buttons){var p=ensureChoices();if(!p)return;p.innerHTML='';arr(buttons).forEach(function(def){var b=document.createElement('button');b.type='button';b.className='study-v2-ai-prompt'+(def.kind==='launch'?' is-launch':'');if(def.kind==='launch'){b.style.background='#3d5f5d';b.style.borderColor='#3d5f5d';b.style.color='#fff';}b.textContent=t(def.label);b.addEventListener('click',function(){if(busy)return;Promise.resolve(def.onClick&&def.onClick()).catch(function(e){console.warn('[AI Coach action]',e);bubble('coach',ko()?'문제를 불러오는 중에 문제가 생겼어요. 다시 해볼까요?':'I had trouble loading that. Please try again.');});});p.appendChild(b);});}
function setBusy(v){busy=!!v;var p=choices();if(p)p.querySelectorAll('button').forEach(function(b){b.disabled=busy;});}
function launch(plan){if(!plan||!arr(plan.items).length)return false;var practice=global.WillenaStudyV2AIPractice;if(!practice||typeof practice.open!=='function')return false;practice.open(plan);return true;}

function registerProvider(id,fn){if(!id||typeof fn!=='function')throw new Error('Invalid Coach provider');providers[id]=fn;}
function registerCapability(def){if(!def||!def.id)throw new Error('Invalid Coach capability');capabilities=capabilities.filter(function(x){return x.id!==def.id;});capabilities.push(def);return def;}
async function provider(id,args){if(!providers[id])throw new Error('Unknown Coach provider: '+id);return providers[id](args||{},context());}
async function available(def,ctx){try{return typeof def.available==='function'?!!(await def.available(ctx)):def.available!==false;}catch(_){return false;}}
async function relevance(def,ctx){try{return typeof def.score==='function'?Number(await def.score(ctx))||0:Number(def.score)||0;}catch(_){return 0;}}
async function homeCapabilities(){var ctx=context(),ranked=[];for(var i=0;i<capabilities.length;i++){var cap=capabilities[i];if(!(await available(cap,ctx)))continue;var score=await relevance(cap,ctx);if(score<=0)continue;ranked.push({cap:cap,score:score,index:i});}ranked.sort(function(a,b){return (b.score-a.score)||(a.index-b.index);});return ranked.map(function(x){return x.cap;});}
async function renderHome(resetMessage){state={view:'home',capability:null};if(resetMessage){var tr=transcript();if(tr)tr.innerHTML='';bubble('coach',ko()?'추천 순서대로 보여줄게요. 아래에서 원하는 연습을 골라도 돼요.':'I put the strongest recommendations first, but you can choose any practice below.');}var caps=await homeCapabilities();if(!caps.length){bubble('coach',ko()?'지금은 추천을 만들 만큼 학습 정보가 충분하지 않아요. 조금 더 공부한 뒤 다시 볼게요.':'I do not have enough study evidence to make a useful recommendation yet.');renderButtons([]);return;}renderButtons(caps.map(function(cap){return{label:cap.label,onClick:function(){return openCapability(cap);}};}));}
async function openCapability(cap){if(busy)return;setBusy(true);state={view:'capability',capability:cap.id};bubble('user',t(cap.label));var ctx=context();var intro=typeof cap.response==='function'?await cap.response(ctx):t(cap.response);if(intro)bubble('coach',intro);var actions=typeof cap.actions==='function'?await cap.actions(ctx):arr(cap.actions);var buttons=actions.map(function(action){return{label:action.label,kind:(action.provider||action.run)?'launch':null,onClick:function(){return runAction(cap,action);}};});buttons.push({label:{ko:'← 추천으로 돌아가기',en:'← Back to suggestions'},onClick:function(){return renderHome(false);}});renderButtons(buttons);setBusy(false);}
async function runAction(cap,action){if(busy)return;setBusy(true);bubble('user',t(action.label));try{var result;if(typeof action.run==='function')result=await action.run(context());else if(action.provider)result=await provider(action.provider,action.args||{});if(result&&result.message)bubble('coach',t(result.message));if(result&&arr(result.items).length){var plan={type:result.type||cap.id,title:t(result.title||cap.label),items:result.items};renderButtons([{label:result.startLabel||{ko:result.items.length+'문제 시작하기',en:'Start '+result.items.length+' questions'},kind:'launch',onClick:function(){launch(plan);}},{label:{ko:'← 추천으로 돌아가기',en:'← Back to suggestions'},onClick:function(){return renderHome(false);}}]);}else if(result&&result.launched){renderButtons([{label:{ko:'← 추천으로 돌아가기',en:'← Back to suggestions'},onClick:function(){return renderHome(false);}}]);}else{renderButtons([{label:{ko:'← 추천으로 돌아가기',en:'← Back to suggestions'},onClick:function(){return renderHome(false);}}]);}}catch(e){console.warn('[AI Coach]',e);bubble('coach',ko()?'지금은 그 연습을 만들 수 없어요. 다른 추천을 골라 볼까요?':'I could not build that practice right now. Try another suggestion?');renderHome(false);}finally{setBusy(false);}}

function bank(){return global.WillenaStudyQuestionBank;}
registerProvider('unit',async function(args,ctx){if(!ctx)return null;var api=bank();if(!api||typeof api.loadUnit!=='function')return null;var key=ctx.bookId+'|'+ctx.unitId;if(!unitCache[key])unitCache[key]=api.loadUnit(ctx.publicLevel,{bookId:ctx.bookId,unitId:ctx.unitId,bookTitle:ctx.bookTitle,unitNumber:ctx.unitNumber}).catch(function(){return[];});var all=unique(await unitCache[key]);if(args.skill){var filtered=all.filter(function(x){return x.skill===args.skill;});if(filtered.length>=6)all=filtered;}var items=shuffle(all).slice(0,args.count||10);return{type:'coach_unit',title:args.title||{ko:'추천 연습',en:'Recommended practice'},message:args.message||{ko:'이 단원에서 연습하기 좋은 문제를 골랐어요.',en:'I picked a useful practice set from this unit.'},items:items};});
registerProvider('level',async function(args,ctx){if(!ctx)return null;var api=bank();if(!api||typeof api.loadLevel!=='function')return null;var key=String(ctx.publicLevel);if(!levelCache[key])levelCache[key]=api.loadLevel(ctx.publicLevel,{bookId:ctx.bookId,unitId:ctx.unitId,bookTitle:ctx.bookTitle,unitNumber:ctx.unitNumber}).catch(function(){return[];});var all=unique(await levelCache[key]).filter(function(x){var m=x.metadata||{};return String(m.unit_id||'')!==ctx.unitId;});if(args.skill){var f=all.filter(function(x){return x.skill===args.skill;});if(f.length>=6)all=f;}var items=shuffle(all).slice(0,args.count||10);return{type:'coach_level',title:args.title||{ko:'새로운 연습',en:'New practice'},message:args.message||{ko:'현재 수준에 맞는 다른 문제도 골라 봤어요.',en:'I picked some different questions around your current level.'},items:items};});

async function get(path){var r=await fetch(CONTENT_URL+'/rest/v1/'+path,{headers:HEADERS,cache:'no-store'});if(!r.ok)throw new Error('Content '+r.status);return r.json();}
function optionTexts(row){return arr(row.choices).map(function(x){return typeof x==='string'?x:text(x&&x.text||x&&x.option_text);}).filter(Boolean);}
function answerText(row){var a=row.correct_answer;if(typeof a==='string'||typeof a==='number')return String(a);if(a&&typeof a==='object')return text(a.text||a.answer||a.value);return'';}
function mapGrammar(row){var correct=answerText(row),opts=optionTexts(row);if(!correct||!opts.length)return null;if(opts.indexOf(correct)<0)opts.push(correct);return{id:'coach-concept-'+row.id,sourceType:'assessment_item',sourceId:row.id,skill:'grammar',usage:['practice'],stimulus:{type:'text',prompt:text(row.prompt_text),context:text(row.context_text)||(ko()?'알맞은 답을 고르세요.':'Choose the best answer.')},response:{type:'multiple_choice',choices:shuffle(opts)},answer:correct,level:Number(row.level_id)||null,difficulty:Number(row.difficulty_rating)||null,metadata:{ai_coach:true,ai_coach_cross_book:true,source_label:'AI Coach · grammar concept',pattern_id:row.anchor_pattern_id||null,mastery_content_type:row.anchor_pattern_id?'pattern':'assessment_item',mastery_content_id:row.anchor_pattern_id||row.id,authored:true,practice_bank:true}};}
registerProvider('grammarConcept',async function(args,ctx){var codes=arr(args.codes||args.code).filter(Boolean);if(!codes.length)return null;var concepts=arr(await get('grammar_concepts?select=id,code&code=in.('+codes.join(',')+')&status=neq.archived'));var ids=concepts.map(function(x){return x.id;});if(!ids.length)return null;var links=arr(await get('assessment_item_concepts?select=assessment_item_id&concept_domain=eq.grammar&concept_id=in.('+ids.join(',')+')&limit=1000'));var pLinks=arr(await get('pattern_concepts?select=pattern_id&concept_id=in.('+ids.join(',')+')&limit=1000'));var itemIds=Array.from(new Set(links.map(function(x){return x.assessment_item_id;}).filter(Boolean))),patternIds=Array.from(new Set(pLinks.map(function(x){return x.pattern_id;}).filter(Boolean)));var fields='id,book_id,unit_id,level_id,difficulty_rating,item_type,prompt_text,context_text,correct_answer,choices,anchor_pattern_id',rows=[];if(itemIds.length)rows=rows.concat(arr(await get('assessment_items?select='+fields+'&id=in.('+itemIds.slice(0,500).join(',')+')&status=eq.published&is_flagged=eq.false&item_type=in.(grammar,grammar_error,grammar_application)&limit=500')));if(patternIds.length)rows=rows.concat(arr(await get('assessment_items?select='+fields+'&anchor_pattern_id=in.('+patternIds.slice(0,300).join(',')+')&status=eq.published&is_flagged=eq.false&item_type=in.(grammar,grammar_error,grammar_application)&limit=500')));var seen={},uniqueRows=[];rows.forEach(function(r){if(r&&r.id&&!seen[r.id]){seen[r.id]=1;uniqueRows.push(r);}});var target=Number(ctx&&ctx.book&&ctx.book.internal_level_id)||((Number(ctx&&ctx.publicLevel)||0)+2);if(target)uniqueRows=uniqueRows.filter(function(r){var lv=Number(r.level_id)||target;return lv<=target+1;});var items=shuffle(uniqueRows).map(mapGrammar).filter(Boolean).slice(0,args.count||10);return{type:'coach_grammar_concept',title:args.title||{ko:'문법 연습',en:'Grammar practice'},message:args.message||{ko:'같은 문법 포인트를 여러 교재에서 골랐어요.',en:'I found the same grammar point across different books.'},items:items};});
registerProvider('morphology',async function(args){var side=global.WillenaMorphologySidecar;if(!side||typeof side.launchQuiz!=='function')throw new Error('Morphology unavailable');var ok=await side.launchQuiz(args.type,args.count||10);return{launched:!!ok};});

registerCapability({
  id:'weakness',
  score:function(){var w=weakest();return w?Math.max(70,120-w.pct):0;},
  available:function(){return !!weakest();},
  label:function(){var w=weakest();return w?{ko:skillName(w.skill)+'을 더 연습할래요',en:'More '+skillName(w.skill)+' practice'}:{ko:'약한 부분 연습',en:'Practice a weak area'};},
  response:function(){var w=weakest();return w?(ko()?skillName(w.skill)+'이 지금 가장 먼저 챙기기 좋은 영역이에요.':'Your '+skillName(w.skill)+' looks like the best place to focus right now.'):'';},
  actions:function(){var w=weakest();return w?[{label:{ko:skillName(w.skill)+' 집중 연습',en:'Focus on '+skillName(w.skill)},provider:'unit',args:{skill:w.skill,count:10}}]:[];}
});

registerCapability({
  id:'third_person',
  score:function(ctx){return ctx&&ctx.publicLevel>=2?95:0;},
  available:function(ctx){return !!(ctx&&ctx.publicLevel>=2);},
  label:{ko:'3인칭 단수 연습',en:'Third-person verb practice'},
  response:{ko:'3인칭 단수는 동사 형태 자체를 연습하거나, 실제 문장 속 문법 문제로 연습할 수 있어요.',en:'You can practice third-person verb forms directly or use them in full grammar questions.'},
  actions:[
    {label:{ko:'동사 형태 연습',en:'Practice verb forms'},provider:'morphology',args:{type:'third_person',count:10}},
    {label:{ko:'3인칭 단수 문법 문제',en:'Third-person grammar questions'},provider:'grammarConcept',args:{codes:['third_person','does_questions','does_not_negative'],count:10,title:{ko:'3인칭 단수 문법 연습',en:'Third-person grammar practice'}}}
  ]
});

registerCapability({
  id:'past',
  score:function(ctx){return ctx&&ctx.publicLevel>=4?93:0;},
  available:function(ctx){return !!(ctx&&ctx.publicLevel>=4);},
  label:{ko:'과거형 연습',en:'Past-tense practice'},
  response:{ko:'과거형은 동사 형태를 외우는 연습과 실제 문장 속 과거 시제 문법 연습을 같이 하면 좋아요.',en:'Past tense is useful to practice both as verb forms and inside full grammar questions.'},
  actions:[
    {label:{ko:'과거형 동사 연습',en:'Practice past-tense verbs'},provider:'morphology',args:{type:'past',count:10}},
    {label:{ko:'과거 시제 문법 문제',en:'Past-tense grammar questions'},provider:'grammarConcept',args:{codes:['past_simple','did_questions','past_be'],count:10,title:{ko:'과거 시제 문법 연습',en:'Past-tense grammar practice'}}}
  ]
});

registerCapability({
  id:'past_participle',
  score:function(ctx){return ctx&&ctx.publicLevel>=5?92:0;},
  available:function(ctx){return !!(ctx&&ctx.publicLevel>=5);},
  label:{ko:'과거분사 연습',en:'Past participle practice'},
  response:{ko:'과거분사는 규칙형과 불규칙형을 따로 반복해서 익히는 게 좋아요.',en:'Past participles are worth practicing as their own verb forms, especially the irregular ones.'},
  actions:[{label:{ko:'과거분사 동사 연습',en:'Practice participle forms'},provider:'morphology',args:{type:'past_participle',count:10}}]
});

registerCapability({
  id:'unit_mix',
  score:function(){return weakest()?55:68;},
  available:function(ctx){return !!ctx;},
  label:{ko:'이 단원에서 골고루 연습',en:'Mixed practice from this unit'},
  response:{ko:'이 단원의 여러 영역을 섞어서 짧게 확인해 볼 수 있어요.',en:'I can mix several useful skills from this unit into one short set.'},
  actions:[{label:{ko:'혼합 문제 시작',en:'Start mixed practice'},provider:'unit',args:{count:10}}]
});

registerCapability({
  id:'new',
  score:function(ctx){return ctx?35:0;},
  available:function(ctx){return !!ctx;},
  label:{ko:'다른 내용도 해볼래요',en:'Try something different'},
  response:{ko:'현재 수준에 맞는 다른 교재 문제를 골라 볼게요.',en:'I can pick something different from other books around your current level.'},
  actions:[{label:{ko:'새로운 문제 보기',en:'Show me something new'},provider:'level',args:{count:10}}]
});

function bind(){clearLegacy();ensureChoices();var hero=document.getElementById('practiceHeroBtn');if(hero)hero.addEventListener('click',function(){var shell=document.getElementById('aiRecommendations');if(shell)try{shell.scrollIntoView({behavior:'smooth',block:'start'});}catch(_){}renderHome(false);});var lang=document.getElementById('languageBtn');if(lang)lang.addEventListener('click',function(){setTimeout(function(){if(state.view==='home')renderHome(false);},30);},true);global.addEventListener('willena:study-recording',function(){if(state.view==='home')setTimeout(function(){renderHome(false);},250);});global.addEventListener('willena:morphology-updated',function(){if(state.view==='home')setTimeout(function(){renderHome(false);},120);});setTimeout(function(){renderHome(true);},120);}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
global.WillenaAICoach={registerCapability:registerCapability,registerProvider:registerProvider,refresh:function(){return renderHome(false);},getSuggestions:homeCapabilities,getState:function(){return Object.assign({},state);}};
})(window);