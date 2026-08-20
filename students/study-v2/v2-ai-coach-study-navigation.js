(function(global){
'use strict';
var coach=global.WillenaAICoach;
if(!coach||typeof coach.registerProvider!=='function')return;

var CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var HEADERS={apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY};
var guideTimer=0;

function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function ko(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
function current(){try{return coach.context();}catch(_){return null;}}
async function waitFor(test,timeout){var start=Date.now(),limit=Number(timeout)||5000;while(Date.now()-start<limit){try{var value=test();if(value)return value;}catch(_){}await sleep(50);}return null;}
async function get(path){var r=await fetch(CONTENT_URL+'/rest/v1/'+path,{headers:HEADERS,cache:'no-store'});if(!r.ok)throw new Error('Study navigation content '+r.status);return r.json();}
function inList(values){return encodeURIComponent('('+values.join(',')+')');}
function kindForSkill(skill){skill=text(skill);if(skill==='grammar')return'grammar';if(skill==='vocabulary'||skill==='spelling')return'vocabulary';if(['sentence_building','conversation','listening','reading'].indexOf(skill)>=0)return'sentences';return'';}

function installGuideStyle(){
  if(document.getElementById('coachStudyGuideStyle'))return;
  var style=document.createElement('style');
  style.id='coachStudyGuideStyle';
  style.textContent='\
.coach-study-guide-overlay{position:fixed;inset:0;z-index:10070;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(18,25,31,.48);opacity:0;transition:opacity .2s ease;cursor:pointer}\
.coach-study-guide-overlay.is-visible{opacity:1}\
.coach-study-guide-overlay.is-leaving{opacity:0}\
.coach-study-guide{position:relative;width:min(430px,calc(100vw - 44px));padding:24px 22px 21px;background:#fff;border:4px solid #173f46;border-radius:0;box-shadow:8px 8px 0 #f2b4cf,-8px -8px 0 #7fd8df,12px 12px 0 rgba(23,63,70,.18);font-family:Poppins,sans-serif;text-align:center;color:#173f46;image-rendering:pixelated}\
.coach-study-guide:before,.coach-study-guide:after{content:"";position:absolute;width:12px;height:12px;background:#fff}\
.coach-study-guide:before{left:-4px;top:-4px;border-right:4px solid #173f46;border-bottom:4px solid #173f46}\
.coach-study-guide:after{right:-4px;bottom:-4px;border-left:4px solid #173f46;border-top:4px solid #173f46}\
.coach-study-guide-mark{display:block;width:74px;height:74px;margin:0 auto 11px;object-fit:contain;image-rendering:auto}\
.coach-study-guide-badge{display:inline-block;margin-bottom:9px;padding:5px 9px;background:#173f46;color:#fff;border:0;border-radius:0;font-size:10px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;box-shadow:3px 3px 0 #7fd8df}\
.coach-study-guide strong{display:block;margin:0 0 7px;color:#173f46;font-size:18px;font-weight:800;line-height:1.25}\
.coach-study-guide p{margin:0;color:#315e64;font-size:14px;font-weight:600;line-height:1.6}\
.coach-study-guide-dismiss{display:block;margin-top:13px;color:#7a878a;font-size:10px;font-weight:700;letter-spacing:.05em}\
.coach-study-guide-pixels{display:flex;justify-content:center;gap:5px;margin-top:14px}\
.coach-study-guide-pixels i{display:block;width:9px;height:9px;border-radius:0}\
.coach-study-guide-pixels i:nth-child(1){background:#ef78ae}.coach-study-guide-pixels i:nth-child(2){background:#6fd2d8}.coach-study-guide-pixels i:nth-child(3){background:#5785df}.coach-study-guide-pixels i:nth-child(4){background:#f0a24b}\
@media(prefers-reduced-motion:reduce){.coach-study-guide-overlay{transition:none}}';
  document.head.appendChild(style);
}
function guideCopy(skill,kind){
  skill=text(skill);kind=text(kind);
  var copy={
    vocabulary:{ko:'단어, 뜻, 발음을 함께 확인해 보세요. 각 단어의 듣기 버튼을 눌러 소리도 익혀 보세요.',en:'Study each word, its meaning, and its pronunciation. Use the Listen button to hear every word.'},
    spelling:{ko:'단어를 눈으로 확인하고 소리도 들어 보세요. 철자와 발음을 함께 연결해서 기억해 보세요.',en:'Look closely at each word and listen to it too. Connect the spelling with the way the word sounds.'},
    sentence_building:{ko:'문장을 천천히 읽고 단어 순서를 살펴보세요. 듣기 버튼으로 들은 뒤 문장을 소리 내어 따라 해 보세요.',en:'Read these sentences carefully and notice the word order. Listen, then say each sentence aloud.'},
    listening:{ko:'먼저 문장을 2~3번 들어 보세요. 가능하면 글을 읽기 전에 뜻을 알아듣고, 그다음 문장을 확인하세요.',en:'Listen to each sentence two or three times. Try to understand it before reading the text, then check the sentence.'},
    conversation:{ko:'문장을 읽고 들어 본 뒤 실제로 말하듯 소리 내어 따라 해 보세요. 질문과 답의 표현을 함께 익혀 보세요.',en:'Read and listen to the sentences, then say them aloud as if you were really speaking. Notice the question-and-answer patterns.'},
    reading:{ko:'문장을 천천히 읽으며 뜻을 확인하세요. 모르는 표현은 소리도 들어 보면서 문장 전체를 이해해 보세요.',en:'Read the sentences slowly for meaning. Listen to unfamiliar expressions and make sure you understand the whole sentence.'},
    grammar:{ko:'문법 규칙과 예문을 함께 읽어 보세요. 문장 형태가 어떻게 달라지는지 비교한 뒤 다시 연습해 보세요.',en:'Read the grammar rule and examples together. Compare how the sentence forms change before you return to practice.'}
  };
  var key=copy[skill]?skill:(kind==='grammar'?'grammar':kind==='vocabulary'?'vocabulary':'sentence_building');
  return copy[key]||copy.sentence_building;
}
function dismissGuide(overlay){
  clearTimeout(guideTimer);
  overlay=overlay||document.getElementById('coachStudyGuideOverlay');
  if(!overlay||!overlay.parentNode)return;
  overlay.classList.add('is-leaving');
  setTimeout(function(){if(overlay.parentNode)overlay.remove();},220);
}
function showGuide(skill,kind){
  installGuideStyle();
  var old=document.getElementById('coachStudyGuideOverlay');if(old)old.remove();
  clearTimeout(guideTimer);
  var c=guideCopy(skill,kind),overlay=document.createElement('div'),box=document.createElement('div');
  overlay.id='coachStudyGuideOverlay';overlay.className='coach-study-guide-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',ko()?'AI 코치 학습 안내':'AI Coach study tip');
  box.id='coachStudyGuide';box.className='coach-study-guide';
  var mark=document.createElement('img');mark.className='coach-study-guide-mark';mark.src='./assets/ai-coach-mark.svg?v=20260820-rebuild1';mark.alt='';
  var badge=document.createElement('span');badge.className='coach-study-guide-badge';badge.textContent=ko()?'AI 코치 추천':'AI COACH TIP';
  var title=document.createElement('strong');title.textContent=ko()?'이렇게 공부해 보세요':'How to study this';
  var p=document.createElement('p');p.textContent=ko()?c.ko:c.en;
  var dismiss=document.createElement('span');dismiss.className='coach-study-guide-dismiss';dismiss.textContent=ko()?'화면을 누르면 닫혀요':'Tap anywhere to close';
  var pixels=document.createElement('span');pixels.className='coach-study-guide-pixels';pixels.setAttribute('aria-hidden','true');for(var i=0;i<4;i++)pixels.appendChild(document.createElement('i'));
  box.appendChild(mark);box.appendChild(badge);box.appendChild(title);box.appendChild(p);box.appendChild(dismiss);box.appendChild(pixels);overlay.appendChild(box);document.body.appendChild(overlay);
  overlay.addEventListener('click',function(){dismissGuide(overlay);},{once:true});
  requestAnimationFrame(function(){requestAnimationFrame(function(){overlay.classList.add('is-visible');});});
  guideTimer=setTimeout(function(){dismissGuide(overlay);},8500);
}

async function chooseBook(bookId){bookId=text(bookId);if(!bookId)return false;var ctx=current();if(ctx&&String(ctx.bookId)===bookId)return true;var books=arr(ctx&&ctx.books),index=books.findIndex(function(b){return String(b&&b.book_id)===bookId;});if(index<0)return false;var button=document.querySelector('#bookTabs [data-book-index="'+index+'"]')||document.querySelector('#bookPips [data-book-index="'+index+'"]');if(!button)return false;button.click();return !!(await waitFor(function(){var c=current();return c&&String(c.bookId)===bookId;},3500));}
async function chooseUnit(unitId){unitId=text(unitId);if(!unitId)return false;var ctx=current();if(ctx&&String(ctx.unitId)===unitId)return true;var button=await waitFor(function(){return document.querySelector('#unitStrip [data-unit-id="'+CSS.escape(unitId)+'"]');},2500);if(!button)return false;button.click();return !!(await waitFor(function(){var c=current();return c&&String(c.unitId)===unitId;},6000));}
function openStudyMode(){var tab=document.querySelector('#bookHub [data-book-mode="study"]');if(tab)tab.click();}
async function waitForBookStudy(unitId){unitId=text(unitId);return waitFor(function(){var root=document.getElementById('bookStudyContent');if(!root||!root.querySelector('.book-study-content-top'))return null;if(unitId){var selected=document.querySelector('#bookStudyUnitStrip [data-study-unit-id="'+CSS.escape(unitId)+'"].is-current');if(!selected)return null;}return root;},6500);}
async function openKind(kind,unitId){kind=text(kind);if(!kind)return null;var root=await waitForBookStudy(unitId);if(!root)return null;var tab=await waitFor(function(){return root.querySelector('[data-study-kind="'+CSS.escape(kind)+'"]');},2500);if(tab)tab.click();return waitFor(function(){var section=root.querySelector('.book-study-section[data-kind="'+CSS.escape(kind)+'"]');return section&&!section.hidden?section:null;},2000);}
function findPatternCard(name){name=text(name).toLowerCase();if(!name)return null;var cards=Array.prototype.slice.call(document.querySelectorAll('#bookStudyContent .book-study-grammar'));return cards.find(function(card){var h=card.querySelector('h5');return text(h&&h.textContent).toLowerCase()===name;})||cards.find(function(card){var h=card.querySelector('h5');var t=text(h&&h.textContent).toLowerCase();return t&&name&&(t.indexOf(name)>=0||name.indexOf(t)>=0);})||null;}
function scrollStudyTop(){var area=document.getElementById('bookStudyArea');if(!area)return false;try{area.scrollIntoView({behavior:'smooth',block:'start'});}catch(_){area.scrollIntoView();}return true;}
async function openDestination(dest){
  dest=dest||{};
  var ctx=current(),bookId=text(dest.bookId||ctx&&ctx.bookId),unitId=text(dest.unitId||ctx&&ctx.unitId),kind=text(dest.kind||kindForSkill(dest.skill)),skill=text(dest.skill);
  if(bookId&&!(await chooseBook(bookId)))throw new Error('Coach Study book unavailable');
  if(unitId&&!(await chooseUnit(unitId)))throw new Error('Coach Study unit unavailable');
  openStudyMode();
  var target=kind?await openKind(kind,unitId):await waitForBookStudy(unitId);
  if(dest.patternName){var card=await waitFor(function(){return findPatternCard(dest.patternName);},2500);if(card)target=card;}
  if(target){requestAnimationFrame(function(){requestAnimationFrame(function(){scrollStudyTop();setTimeout(function(){showGuide(skill||kind,kind);},180);});});}
  return{bookId:bookId,unitId:unitId,kind:kind,skill:skill,patternName:text(dest.patternName)};
}

async function resolveGrammarDestination(codes,ctx){codes=arr(codes).map(text).filter(Boolean);ctx=ctx||current();if(!codes.length||!ctx)return null;var concepts=arr(await get('grammar_concepts?select=id,code&code=in.'+inList(codes)+'&status=neq.archived'));var conceptIds=concepts.map(function(x){return x.id;}).filter(Boolean);if(!conceptIds.length)return null;var links=arr(await get('pattern_concepts?select=pattern_id,concept_id&concept_id=in.'+inList(conceptIds)+'&limit=1000'));var patternIds=Array.from(new Set(links.map(function(x){return x.pattern_id;}).filter(Boolean)));if(!patternIds.length)return null;var occ=arr(await get('source_content_occurrences?select=unit_id,pattern_id&pattern_id=in.'+inList(patternIds)+'&status=in.(review,published)&limit=2000'));var unitIds=Array.from(new Set(occ.map(function(x){return x.unit_id;}).filter(Boolean)));if(!unitIds.length)return null;var units=arr(await get('content_units?select=id,book_id,unit_number,title&id=in.'+inList(unitIds)+'&status=in.(review,published)&limit=1000'));var assigned={};arr(ctx.books).forEach(function(b,i){assigned[String(b.book_id)]={index:i,book:b};});var candidates=[];units.forEach(function(u){var a=assigned[String(u.book_id)];if(!a)return;var rows=occ.filter(function(o){return String(o.unit_id)===String(u.id);});rows.forEach(function(o){candidates.push({bookId:String(u.book_id),unitId:String(u.id),unitNumber:Number(u.unit_number)||0,patternId:o.pattern_id,bookIndex:a.index,currentBook:String(u.book_id)===String(ctx.bookId),currentUnit:String(u.id)===String(ctx.unitId)});});});if(!candidates.length)return null;candidates.sort(function(a,b){return Number(b.currentUnit)-Number(a.currentUnit)||Number(b.currentBook)-Number(a.currentBook)||a.bookIndex-b.bookIndex||a.unitNumber-b.unitNumber;});var chosen=candidates[0];var patterns=arr(await get('patterns?select=id,name&id=eq.'+encodeURIComponent(chosen.patternId)+'&limit=1'));chosen.kind='grammar';chosen.skill='grammar';chosen.patternName=text(patterns[0]&&patterns[0].name);return chosen;}

async function studyProvider(args,ctx){args=args||{};var dest=null;if(args.codes||args.code)dest=await resolveGrammarDestination(arr(args.codes||args.code),ctx);if(!dest)dest={bookId:text(args.bookId||ctx&&ctx.bookId),unitId:text(args.unitId||ctx&&ctx.unitId),kind:text(args.kind||kindForSkill(args.skill)),skill:text(args.skill),patternName:text(args.patternName)};if(!dest||!dest.bookId||!dest.unitId)return{message:{ko:'이 학습 내용을 연결할 교재 위치를 찾지 못했어요.',en:'I could not find a linked Study location for this yet.'}};await openDestination(dest);return{message:args.message||{ko:'교재 공부에서 바로 확인할 수 있게 열어 두었어요.',en:'I opened the matching Book Study section for you.'},destination:dest};}

coach.registerProvider('studyNavigation',studyProvider);
global.WillenaStudyNavigator={version:'coach-study-nav-v1.3',open:openDestination,resolveGrammar:resolveGrammarDestination,kindForSkill:kindForSkill,dismissGuide:dismissGuide};
})(window);
