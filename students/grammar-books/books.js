import {capturePointOrigin,showPointAward} from '../components/student-point-feedback.js?v=20260927-startup2';
import {repeatUntilCorrect} from '../vocab-study/vocab-pass-flow.js?v=20260927-startup2';
import {playStudentSfx,preloadStudentSfx} from '../shared/student-sfx.js?v=20260927-startup2';
import {grammarEngine} from './engine.js?v=1';
const DB='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const $=id=>document.getElementById(id),list=$('grammarBookList'),home=$('grammarBooksHome'),detail=$('grammarBookDetail'),back=$('grammarBookBack'),title=$('grammarBookTitle');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const modes=[{id:'choose',label:'빈칸 선택',ko:'빈칸에 알맞은 말을 고르시오.',icon:'◉'},{id:'check',label:'문장 판단',ko:'어법에 맞는 문장이나 틀린 문장을 고르시오.',icon:'✓'},{id:'hunt',label:'오류 찾기',ko:'밑줄 친 부분 중 어법상 틀린 것을 고르시오.',icon:'⌕'}];
let books=[],catalog=null,chapterPack=null,activeBook=null,activeMode=null,position=0,checked=false,correct=0,renderer=null,units=[],activeUnit=1,activeQuestions=[],masteredIds=new Set(),missedQuestions=[],retryingWrong=false,chapterProgress=[],rewardSession=null;
const questionBank=()=>catalog?.modes||{};
function beginRewardSession(mode){
 const reviewOnly=goldChapter(activeUnit);
 rewardSession={id:window.crypto?.randomUUID?.()||('grammar-'+Date.now()+'-'+Math.random().toString(16).slice(2)),
  chapter:activeUnit,mode,startedAt:new Date().toISOString(),firstCorrect:0,
  points:0,awardedIds:new Set(),reviewOnly,completed:false};
}
async function completeRewardSession(){
 const reward=rewardSession;
 if(!reward||reward.completed)return null;
 reward.completed=true;
 const percent=Math.round(reward.firstCorrect/8*100);
 const stars=reward.reviewOnly?0:starsForPercent(percent);
 const points=reward.reviewOnly?0:reward.points;
 if(reward.reviewOnly)return {percent,stars,points};
 const listName='Grammar Ten 완성 2 · Unit '+reward.chapter+' · '+(modes.find(m=>m.id===reward.mode)?.label||reward.mode);
 const payload={
  reward_only:true,session_id:reward.id,
  client_attempt_id:window.crypto?.randomUUID?.()||('grammar-reward-'+Date.now()),
  book_id:null,unit_id:null,skill:'grammar',response_type:'reward',
  activity_id:'grammar-books-reward',reward_mode:'grammar_books_'+reward.mode,
  reward_list_name:listName,reward_list_size:8,reward_started_at:reward.startedAt,
  reward_summary:{
   completed:true,stars,accuracy:reward.firstCorrect/8,percent,
   score:reward.firstCorrect,total:8,points_earned:points,
   book_id:null,unit_id:null,assignment_id:null,session_source:'student',
   grammar_mode:reward.mode,grammar_chapter:reward.chapter,
   reward_scheme:'grammar-books-v1',star_cap:5
  }
 };
 try{
  const response=await (window.WillenaAPI?.fetch||fetch)('/.netlify/functions/progress_summary?section=study_attempt&_='+Date.now(),{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload})
  });
  if(!response.ok)throw Error('Reward save HTTP '+response.status);
  const data=await response.json().catch(()=>null);
  if(data?.error||data?.success===false)throw Error(data?.error||'Reward save rejected');
  window.dispatchEvent(new CustomEvent('session:ended',{detail:{session_id:reward.id,mode:'grammar_books_'+reward.mode,list_name:listName,list_size:8}}));
  window.dispatchEvent(new CustomEvent('stars:refresh',{detail:{earned:stars}}));
  try{localStorage.setItem('stars:refresh',String(Date.now()))}catch(_){}
  return {percent,stars,points};
 }catch(error){
  reward.completed=false;
  console.warn('[Grammar Books] reward save failed',error);
  throw error;
 }
}
function showGrammarReward(reward){
 const mount=$('grammarRewardMount');
 if(!mount)return;
 mount.replaceChildren();
 if(!reward||!(reward.points||reward.stars))return;
 const celebration=document.createElement('student-reward-celebration');
 celebration.setAttribute('percent',String(reward.percent));
 celebration.setAttribute('stars',String(reward.stars));
 celebration.setAttribute('star-max','5');
 celebration.setAttribute('points',String(reward.points));
 celebration.setAttribute('label','GRAMMAR REWARD');
 mount.append(celebration);
}

const bestScore=(chapter,mode)=>Number(chapterProgress.find(p=>Number(p.chapter_number)===Number(chapter)&&p.mode===mode)?.best_correct)||0;
const goldChapter=chapter=>modes.every(mode=>bestScore(chapter,mode.id)===8);
const starsForPercent=p=>p>=100?5:p>=90?4:p>=80?3:p>=70?2:p>=60?1:0;
async function refreshGrammarProgress(){
 try{chapterProgress=await window.WillenaMissionBasket?.getGrammarBookProgress?.()||[];renderUnitsProgress();renderModeCards();}
 catch(e){console.warn('[Grammar Books] saved mastery unavailable',e)}
}
function renderUnitsProgress(){
 $('grammarUnitStrip')?.querySelectorAll('[data-unit]').forEach(el=>{
  const number=Number(el.dataset.unit),gold=goldChapter(number);
  el.classList.toggle('is-golden',gold);
  el.querySelector('.vocab-unit-gold')?.remove();
  if(gold)el.insertAdjacentHTML('beforeend','<img class="vocab-unit-gold" src="/shared/svgs/golden-unit.svg?v=20260927-icons1" alt="골드 메달">');
 });
 const count=$('grammarGoldCount');if(count)count.textContent=String(units.filter(u=>goldChapter(u.unit_number)).length);
}
function shuffle(items){const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}
function prepareRound(questions,mode){
 return shuffle(questions).map(q=>{
  if(mode==='hunt'){
   const wrong=q.options[q.answerIndex];
   const options=[...q.options];let ordered=null;
   const walk=(parts,left)=>{
    if(ordered)return;
    if(!left.length){if(parts.join(' ').replace(/\s+([,.!?])/g,'$1')===q.sentence)ordered=parts;return}
    left.forEach((part,i)=>walk([...parts,part],left.filter((_,j)=>j!==i)));
   };
   walk([],options);
   if(!ordered)throw Error('Error Hunt spans do not reconstruct sentence: '+q.id);
   return {...q,options:ordered,answerIndex:ordered.indexOf(wrong),underlined:ordered};
  }
  const opts=shuffle(q.options.map((value,i)=>({value,i})));
  return {...q,options:opts.map(o=>o.value),answerIndex:opts.findIndex(o=>o.i===q.answerIndex)};
 });
}
function markedSentence(q){
 const markers=['①','②','③','④'];
 const tokens=q.options.map((part,i)=>({part,marker:markers[i],at:q.sentence.indexOf(part)})).sort((a,b)=>a.at-b.at);
 let out='',cursor=0;
 for(const token of tokens){
  if(token.at<cursor)return q.sentence;
  out+=q.sentence.slice(cursor,token.at)+token.marker+' '+token.part;
  cursor=token.at+token.part.length;
 }
 return out+q.sentence.slice(cursor);
}
function updateUrl(bookId=''){const p=new URLSearchParams(location.search);bookId?p.set('book',bookId):p.delete('book');const u=location.pathname+(p.size?'?'+p.toString():'');history.pushState({},'',u)}
function bookCard(book){return '<button class="vocab-front-book-card" type="button" data-grammar-book="'+esc(book.id)+'"><span class="vocab-front-card-main"><span class="vocab-front-card-copy"><strong>'+esc(book.title)+'</strong></span></span><span class="vocab-front-arrow" aria-hidden="true">›</span></button>'}
async function loadGrammarBooks(){
 try{
  const response=await fetch(DB+'/rest/v1/content_books?select=id,title,book_number,series_id,metadata&status=eq.published&metadata->>subject=eq.grammar&order=title.asc&limit=100',{headers:{apikey:KEY,Authorization:'Bearer '+KEY}});
  if(!response.ok)throw Error('Book catalog '+response.status);
  books=await response.json();
  if(!books.some(b=>b.title==='Grammar Ten 완성 2'))books.unshift({id:'grammar-ten-2-practice',title:'Grammar Ten 완성 2'});
  list.innerHTML=books.length?books.map(bookCard).join(''):'<div class="vocab-front-empty">등록된 문법 교재가 없습니다.</div>';
  const id=new URLSearchParams(location.search).get('book');
  const found=books.find(book=>String(book.id)===id);
  if(found)showBook(found,false);
 }catch(error){console.warn('[Grammar books] catalog unavailable',error);books=[{id:'grammar-ten-2-practice',title:'Grammar Ten 완성 2'}];list.innerHTML=books.map(bookCard).join('');}
}
async function loadChapterPack(){
 if(chapterPack)return chapterPack;
 const response=await fetch('./grammar-ten-2-chapters.json?v=1',{cache:'no-store'});
 if(!response.ok)throw Error('Grammar Ten chapter content unavailable');
 const data=await response.json();
 if(!Array.isArray(data.chapters)||data.chapters.length!==11)throw Error('Invalid Grammar Ten chapters');
 for(const chapter of data.chapters){
  for(const mode of modes){
   const questions=chapter.modes?.[mode.id];
   if(!Array.isArray(questions)||questions.length!==8||questions.some(q=>q.options?.length!==4||!Number.isInteger(q.answerIndex)||q.answerIndex<0||q.answerIndex>=4))throw Error('Invalid chapter '+chapter.chapter+' '+mode.id);
  }
 }
 chapterPack=data;return data;
}
async function loadQuestions(){
 if(catalog)return catalog;
 if(activeBook?.title.trim()!=='Grammar Ten 완성 2')throw Error('No questions for this book');
 const data=await loadChapterPack();
 const chapter=data.chapters.find(c=>Number(c.chapter)===Number(activeUnit));
 if(!chapter)throw Error('Chapter not found');
 catalog=chapter;return chapter;
}
async function loadBookUnits(book){
 const match=book.title.trim()==='Grammar Ten 완성 2';
 const bookId=match?'1e3a2112-07be-45e2-a8fc-ce20011e0e57':book.id;
 try{
  const response=await fetch(DB+'/rest/v1/content_units?select=id,unit_number,title,metadata&book_id=eq.'+encodeURIComponent(bookId)+'&status=eq.published&order=unit_number.asc&limit=100',{headers:{apikey:KEY,Authorization:'Bearer '+KEY}});
  if(!response.ok)throw Error('Unit catalog '+response.status);
  const rows=await response.json();
  if(!match)return rows;
  const map=new Map();
  for(const row of rows){
   const chapter=Number(row.metadata?.chapter_number);
   if(!Number.isInteger(chapter)||chapter<1||chapter>11)continue;
   if(!map.has(chapter))map.set(chapter,{unit_number:chapter,title:row.metadata?.chapter_title||'문법 학습',subunits:[]});
   map.get(chapter).subunits.push(row);
  }
  if(map.size===11)return [...map.values()].sort((a,b)=>a.unit_number-b.unit_number);
  throw Error('Incomplete chapter grouping');
 }catch(error){
  console.warn('[grammar books] unit catalog fallback',error);
  if(!match)return [];
  const data=await loadChapterPack();
  return data.chapters.map(c=>({unit_number:c.chapter,title:c.title,subunits:c.topics.map((title,i)=>({unit_number:i+1,title}))}));
 }
}
function selectUnit(number){
 activeUnit=number;catalog=null;
 const unit=units.find(u=>Number(u.unit_number)===number);
 $('grammarUnitStrip').querySelectorAll('[data-unit]').forEach(el=>{const active=Number(el.dataset.unit)===number;el.classList.toggle('is-current',active);active?el.setAttribute('aria-current','true'):el.removeAttribute('aria-current')});
 $('grammarUnitTitle').textContent=unit?'Unit '+number+' · '+unit.title:'Unit '+number;
 const playable=activeBook?.title.trim()==='Grammar Ten 완성 2'&&!!unit;
 $('grammarModeCards').hidden=!playable;$('grammarNotReady').hidden=playable;
 $('grammarGuideOpen').disabled=!unit;
 if(playable)renderModeCards();
 renderUnitsProgress();
}
function renderModeCards(){
 const mount=$('grammarModeCards');if(!mount)return;
 mount.innerHTML=modes.map((mode,i)=>{const best=bestScore(activeUnit,mode.id),pct=Math.round(best/8*100),stars=starsForPercent(pct);return '<button class="vocab-skill-card '+['vocab-skill-quiz','vocab-skill-spelling','vocab-skill-pronunciation'][i]+'" type="button" data-grammar-mode="'+mode.id+'"><span class="vocab-skill-ring" style="--progress:'+pct+'"><span>'+pct+'%</span></span><span class="vocab-skill-copy"><small class="vocab-skill-step">STEP '+(i+1)+'</small><strong>'+mode.label+'</strong><span class="vocab-card-stars">★ '+stars+'/5</span></span></button>'}).join('');
}
async function showBook(book,push=true){
 if(!book)return;activeBook=book;activeMode=null;
 title.textContent=book.title;home.hidden=true;detail.hidden=false;
 $('grammarModePanel').hidden=false;$('grammarRound').hidden=true;$('grammarResult').hidden=true;
 $('grammarModeCards').hidden=true;
 $('grammarUnitTitle').textContent='단원을 불러오는 중…';
 units=await loadBookUnits(book);
 if(activeBook!==book)return;
 const strip=$('grammarUnitStrip');
 strip.innerHTML=units.map(u=>'<button type="button" class="study-v2-unit" data-unit="'+Number(u.unit_number)+'">Unit '+Number(u.unit_number)+'</button>').join('');
 strip.hidden=!units.length;
 if(units.length){selectUnit(Number(units[0].unit_number));if(book.title.trim()==='Grammar Ten 완성 2')void refreshGrammarProgress();}
 else {$('grammarUnitTitle').textContent='등록된 단원이 없습니다.';$('grammarNotReady').hidden=false;}
 if(push)updateUrl(book.id);
 window.scrollTo(0,0);
}
function showHome(push=true){activeBook=null;activeMode=null;detail.hidden=true;home.hidden=false;if(push)updateUrl();window.scrollTo(0,0)}
function toSharedQuestion(q){
 const hunt=activeMode==='hunt';
 const sentence=hunt?markedSentence(q):'';
 const instruction=hunt?'다음 문장에서 어법상 틀린 부분을 고르시오.':activeMode==='choose'?'빈칸에 들어갈 알맞은 말을 고르시오.':q.prompt;
 return {id:q.id,form:'choice',prompt:instruction+(hunt?'\n'+sentence:activeMode==='choose'?'\n'+q.prompt:''),choices:q.options,answer:[String(q.answerIndex+1)],context:hunt?{underlined_spans:['①','②','③','④']}:{},metadata:{sourceKey:q.id,practiceType:'grammar_books',chapter:activeUnit,subunit:q.subunit}};
}
function renderQuestion(){
 const questions=activeQuestions,q=questions[position];
 if(!q)return finishRound();
 const mode=modes.find(m=>m.id===activeMode);
 $('grammarRoundTitle').textContent=mode.label+' · '+mode.ko;
 $('grammarRoundCounter').textContent=(position+1)+' / '+questions.length;
 $('grammarRoundProgress').style.width=(position/questions.length*100)+'%';
 const old=$('grammarSharedQuestionHost');
 const host=old.cloneNode(false);old.replaceWith(host);
 renderer=new grammarEngine.QuestionRenderer(host).render(toSharedQuestion(q),{onChange:(_,has)=>{if(!checked)$('grammarCheck').disabled=!has}});
 $('grammarNext').hidden=true;$('grammarNext').classList.remove('is-next');$('grammarCheck').hidden=false;$('grammarCheck').disabled=true;$('grammarSkip').hidden=false;
 
 checked=false;
}
function startMode(mode){
 preloadStudentSfx();
 if(!modes.some(x=>x.id===mode)||!activeBook)return;
 const panel=$('grammarModeCards');panel.setAttribute('aria-busy','true');
 loadQuestions().then(()=>{
  activeMode=mode;activeQuestions=prepareRound(questionBank()[mode]||[],mode);masteredIds=new Set();missedQuestions=[];retryingWrong=false;position=0;correct=0;checked=false;beginRewardSession(mode);
  $('grammarModePanel').hidden=true;$('grammarResult').hidden=true;$('grammarRound').hidden=false;
  renderQuestion();window.scrollTo(0,0);
 }).catch(err=>{console.error(err);$('grammarNotReady').textContent='문제를 불러오지 못했어요. 다시 시도해 주세요.';$('grammarNotReady').hidden=false}).finally(()=>panel.removeAttribute('aria-busy'));
}
async function checkAnswer(){
 if(checked||!renderer)return;
 const q=activeQuestions[position],shared=toSharedQuestion(q),response=renderer.getResponse();
 if(!Array.isArray(response)||!response.length)return;
 const btn=$('grammarCheck');btn.disabled=true;renderer.setDisabled(true);
 let result;
 try{result=await grammarEngine.gradeQuestion(shared,response)}catch(e){console.error('[grammar books] grading failed',e);renderer.setDisabled(false);btn.disabled=false;return}
 checked=true;
 if(result.correct){
  correct++;masteredIds.add(q.id);
  if(rewardSession&&!rewardSession.awardedIds.has(q.id)){
   rewardSession.awardedIds.add(q.id);
   if(!rewardSession.reviewOnly){
    rewardSession.points+=2;
    showPointAward({amount:2,origin:capturePointOrigin($('grammarSharedQuestionHost'))}).catch(()=>{});
   }
   if(!retryingWrong)rewardSession.firstCorrect++;
  }
 }else if(repeatUntilCorrect(result.correct))missedQuestions.push(q);
 playStudentSfx(result.correct?'correct':'wrong');
 renderer.showFeedback(result);
 btn.hidden=true;$('grammarSkip').hidden=true;$('grammarNext').hidden=false;$('grammarNext').classList.add('is-next');
 $('grammarNext').textContent=position===activeQuestions.length-1?'Finish':'Next Question →';
}
async function finishRound(){
 playStudentSfx('complete');
 $('grammarRound').hidden=true;$('grammarResult').hidden=false;
 const total=8,mastered=masteredIds.size;
 $('grammarResultScore').textContent=mastered+' / '+total;
 $('grammarResultPercent').textContent=Math.round(mastered/total*100)+'%';
 $('grammarResultText').textContent=missedQuestions.length?'틀린 문제 '+missedQuestions.length+'개만 다시 풀어보세요.':'모든 문제를 맞혔어요!';
 showGrammarReward(null);
 $('grammarRetry').hidden=missedQuestions.length===0;
 $('grammarRetry').textContent='오답 다시 풀기 ('+missedQuestions.length+')';
 if(!retryingWrong||!missedQuestions.length){
  try{
   if(typeof window.WillenaMissionBasket?.recordGrammarBookRound!=='function')throw Error('Grammar progress writer unavailable');
   await window.WillenaMissionBasket.recordGrammarBookRound(activeUnit,activeMode,mastered);
   await refreshGrammarProgress();
   if(!missedQuestions.length){
    try{showGrammarReward(await completeRewardSession())}
    catch(rewardError){$('grammarResultText').textContent+=' 보상 저장에 실패했습니다.'}
   }
   if(!missedQuestions.length){
    void window.WillenaMissionBasket?.recordCompletedActivity?.('grammar-ten-2-chapter-'+activeUnit+'-'+activeMode,'Grammar Genius Books');
    void window.WillenaAchievements?.refresh?.();
   }
  }catch(error){console.error('[Grammar Books] result not saved',error);$('grammarResultText').textContent+=' 점수를 저장하지 못했습니다. 다시 시도해 주세요.';}
 }
 window.scrollTo(0,0);
}
function goToModes(){
 $('grammarRound').hidden=true;$('grammarResult').hidden=true;$('grammarModePanel').hidden=false;activeMode=null;
 renderModeCards();window.scrollTo(0,0);
}
$('grammarUnitStrip')?.addEventListener('click',event=>{const el=event.target.closest('[data-unit]');if(el)selectUnit(Number(el.dataset.unit))});
$('grammarGuideOpen')?.addEventListener('click',async()=>{
 const unit=units.find(u=>Number(u.unit_number)===activeUnit);
 const heading=$('grammarGuideHeading'),body=$('grammarGuideContent');
 heading.textContent=unit?.title||'문법 설명';
 body.textContent='문법 설명을 불러오는 중…';
 $('grammarGuideDialog').showModal();
 try{
  if(activeBook?.title.trim()==='Grammar Ten 완성 2'){
   const pack=await loadChapterPack();
   const chapter=pack.chapters.find(c=>Number(c.chapter)===activeUnit);
   if(!chapter){body.textContent='해당 단원의 설명이 없습니다.';return}
   heading.textContent='Unit '+activeUnit+' · '+chapter.title;
   body.textContent=chapter.explanation;
  }else body.textContent='이 교재의 문법 설명을 준비 중입니다.';
 }catch(error){console.warn('[grammar books] explanation failed',error);body.textContent='문법 설명을 불러오지 못했어요.'}
});
$('grammarGuideClose')?.addEventListener('click',()=>$('grammarGuideDialog').close());
list?.addEventListener('click',e=>{const el=e.target.closest('[data-grammar-book]');if(el)showBook(books.find(b=>String(b.id)===el.dataset.grammarBook))});
$('grammarModeCards')?.addEventListener('click',e=>{const el=e.target.closest('[data-grammar-mode]');if(el)startMode(el.dataset.grammarMode)});
$('grammarCheck')?.addEventListener('click',checkAnswer);
$('grammarSkip')?.addEventListener('click',()=>{if(checked||!activeMode)return;missedQuestions.push(activeQuestions[position]);position++;renderQuestion()});
$('grammarNext')?.addEventListener('click',()=>{position++;renderQuestion()});
$('grammarRetry')?.addEventListener('click',()=>{
 if(!activeMode||!missedQuestions.length)return;
 activeQuestions=[...missedQuestions];missedQuestions=[];retryingWrong=true;position=0;correct=0;checked=false;
 $('grammarResult').hidden=true;$('grammarRound').hidden=false;renderQuestion();
});
$('grammarResultBack')?.addEventListener('click',goToModes);
$('grammarRoundBack')?.addEventListener('click',goToModes);
$('grammarSessionHome')?.addEventListener('click',()=>{goToModes();showHome()});
$('grammarResultHome')?.addEventListener('click',()=>showHome());
back?.addEventListener('click',()=>{if(!$('grammarRound').hidden||!$('grammarResult').hidden){goToModes();return}showHome()});
window.addEventListener('popstate',()=>{const id=new URLSearchParams(location.search).get('book');const book=books.find(b=>String(b.id)===id);book?showBook(book,false):showHome(false)});
document.addEventListener('DOMContentLoaded',()=>{window.WillenaMissionBasket?.mount($('appMissionBasket'),{app:'Grammar Genius Books'});loadGrammarBooks()});
