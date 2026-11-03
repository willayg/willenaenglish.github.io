import {geniusSessionContext,geniusHomeworkFromUrl,geniusSessionHeader} from '../components/genius-session-context.js?v=20261104-a';
import {renderStudentSessionFinish} from '../components/student-session-finish.js?v=1';
import {capturePointOrigin,showPointAward} from '../components/student-point-feedback.js?v=20260927-startup2';
import {createMissedOnlyRetry} from '../vocab-study/vocab-pass-flow.js?v=20261103-missed-only1';
import {playStudentSfx,preloadStudentSfx} from '../shared/student-sfx.js?v=20260927-startup2';
import {grammarEngine} from './engine.js?v=1';
const DB='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const $=id=>document.getElementById(id),list=$('grammarBookList'),home=$('grammarBooksHome'),detail=$('grammarBookDetail'),back=$('grammarBookBack'),title=$('grammarBookTitle');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const modes=[{id:'choose',label:'빈칸 선택',ko:'빈칸에 알맞은 말을 고르시오.',icon:'◉'},{id:'check',label:'문장 판단',ko:'어법에 맞는 문장이나 틀린 문장을 고르시오.',icon:'✓'},{id:'hunt',label:'오류 찾기',ko:'밑줄 친 부분 중 어법상 틀린 것을 고르시오.',icon:'⌕'}];
let homeworkAttemptIds=new Set(),homeworkSaveTimer=null,activeHomework=null,homeworkModeEvidence=new Map(),homeworkWrite=Promise.resolve();
let books=[],catalog=null,chapterPack=null,activeBook=null,activeMode=null,position=0,checked=false,correct=0,renderer=null,units=[],activeUnit=1,activeQuestions=[],masteredIds=new Set(),retryingWrong=false,chapterProgress=[],rewardSession=null,navEpoch=0;
const retryQueue=createMissedOnlyRetry({idOf:q=>q.id});
const roundTotal=()=>rewardSession?.total||8;
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
 const percent=Math.round(reward.firstCorrect/roundTotal()*100);
 const stars=reward.reviewOnly?0:starsForPercent(percent);
 const points=reward.reviewOnly?0:reward.points;
 if(reward.reviewOnly)return {percent,stars,points};
 const bookId='1e3a2112-07be-45e2-a8fc-ce20011e0e57';
 const chapterUnit=units.find(u=>Number(u.unit_number)===Number(reward.chapter));
 const unitId=chapterUnit?.subunits?.[0]?.id;
 if(!unitId){reward.completed=false;throw Error('Original textbook unit ID unavailable for reward');}
 const listName='Grammar Ten 완성 2 · Unit '+reward.chapter+' · '+(modes.find(m=>m.id===reward.mode)?.label||reward.mode);
 const payload={
  reward_only:true,session_id:reward.id,
  client_attempt_id:window.crypto?.randomUUID?.()||('grammar-reward-'+Date.now()),
  book_id:bookId,unit_id:unitId,skill:'grammar',response_type:'reward',
  activity_id:'grammar-books-reward',reward_mode:'grammar_books_'+reward.mode,
  reward_list_name:listName,reward_list_size:roundTotal(),reward_started_at:reward.startedAt,
  reward_summary:{
   completed:true,stars,accuracy:reward.firstCorrect/roundTotal(),percent,
   score:reward.firstCorrect,total:roundTotal(),points_earned:points,
   book_id:bookId,unit_id:unitId,assignment_id:null,session_source:'student',
   grammar_mode:reward.mode,grammar_chapter:reward.chapter,
   reward_scheme:'grammar-books-v1',star_cap:5
  }
 };
 try{
  const apiFetch=window.WillenaAPI&&typeof window.WillenaAPI.fetch==='function' ? window.WillenaAPI.fetch.bind(window.WillenaAPI) : window.fetch.bind(window);
  const response=await apiFetch('/.netlify/functions/progress_summary?section=study_attempt&_='+Date.now(),{
    method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload})
  });
  if(!response.ok)throw Error('Reward save HTTP '+response.status);
  const data=await response.json().catch(()=>null);
  if(data?.error||data?.success===false)throw Error(data?.error||'Reward save rejected');
  window.dispatchEvent(new CustomEvent('session:ended',{detail:{session_id:reward.id,mode:'grammar_books_'+reward.mode,list_name:listName,list_size:roundTotal()}}));
  window.dispatchEvent(new CustomEvent('stars:refresh',{detail:{earned:stars}}));
  try{localStorage.setItem('stars:refresh',String(Date.now()))}catch(_){}
  return {percent,stars,points};
 }catch(error){
  reward.completed=false;
  console.warn('[Grammar Books] reward save failed',error);
  throw error;
 }
}
async function recordAssignedGrammarHomework(chapter,mode,sessionId,ids){
 const apiFetch=window.WillenaAPI?.fetch?.bind(window.WillenaAPI);
 const token=window.WillenaAPI?.getLocalAccessToken?.();
 if(!token||!sessionId||!ids?.length)return;
 const response=await fetch('https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/record_grammar_book_homework_questions_v1',{
  method:'POST',cache:'no-store',
  headers:{'Content-Type':'application/json','apikey':'sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e','Authorization':'Bearer '+token},
  body:JSON.stringify({p_chapter:chapter,p_mode:mode,p_session_id:sessionId,p_mastered_ids:ids})
 });
 if(!response.ok)throw Error('Assignment recognition HTTP '+response.status);
 const result=await response.json();
 if(result?.eligible_assignments>0)void window.WillenaMissionBasket?.refresh?.();
}
const HOMEWORK_DB='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/';
const HOMEWORK_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
async function homeworkFetch(path,options={}){
 const token=window.WillenaAPI?.getLocalAccessToken?.();
 if(!token)throw Error('Student sign-in required for homework');
 const response=await fetch(HOMEWORK_DB+path,{...options,cache:'no-store',headers:{apikey:HOMEWORK_KEY,Authorization:'Bearer '+token,...options.headers}});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw Error(data?.message||'Homework request failed ('+response.status+')');
 return data;
}
async function loadGrammarHomework(){
 const id=geniusHomeworkFromUrl();
 if(!id)return null;
 const rows=await homeworkFetch('homework_assignments?select=id,title,list_meta,active,status,created_at,due_at&source_type=eq.grammar_books&id=eq.'+encodeURIComponent(id)+'&active=eq.true&limit=1');
 const a=rows?.[0];
 if(!a||a.status!=='active'||a.list_meta?.book_key!=='grammar_ten_2')throw Error('This textbook homework is no longer available.');
 const chapter=Number(a.list_meta.chapter);
 if(!Number.isInteger(chapter)||chapter<1||chapter>11)throw Error('Invalid textbook homework chapter');
 const modesRequired=(a.list_meta.required_modes||[]).filter(mode=>modes.some(m=>m.id===mode));
 if(!modesRequired.length)throw Error('No assigned Grammar activities');
 const evidence=await homeworkFetch('grammar_book_homework_completions?select=mode,correct_count,mastered_question_ids&assignment_id=eq.'+encodeURIComponent(id));
 activeHomework={...a,chapter,required_modes:modesRequired};
 homeworkModeEvidence=new Map((evidence||[]).map(row=>[row.mode,row]));
 return activeHomework;
}
function currentGrammarContext(mode=activeMode){
 return geniusSessionContext({assignmentId:activeHomework?.id,bookId:activeBook?.id,unitId:activeUnit,mode});
}
function saveHomeworkQuestions(){
 if(homeworkSaveTimer){clearTimeout(homeworkSaveTimer);homeworkSaveTimer=null}
 if(!activeHomework||!homeworkAttemptIds.size||!rewardSession?.id||!activeMode)return homeworkWrite;
 const assignment=activeHomework.id,chapter=activeUnit,mode=activeMode,session=rewardSession.id,ids=[...homeworkAttemptIds];
 homeworkWrite=homeworkWrite.catch(()=>{}).then(async()=>{
  const result=await homeworkFetch('rpc/record_grammar_book_homework_questions_v2',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({p_assignment_id:assignment,p_chapter:chapter,p_mode:mode,p_session_id:session,p_mastered_ids:ids})
  });
  if(result?.success!==true)throw Error('Homework is not active or eligible');
  if(activeHomework?.id===assignment){
   const previous=homeworkModeEvidence.get(mode)?.mastered_question_ids||[];
   const merged=[...new Set([...previous,...ids])];
   homeworkModeEvidence.set(mode,{mastered_question_ids:merged,correct_count:Math.min(8,merged.length)});
   if(activeMode===mode&&activeUnit===chapter)renderModeCards();
  }
  await window.WillenaMissionBasket?.refresh?.();
 });
 return homeworkWrite;
}
function scheduleHomeworkSave(){
 if(!activeHomework)return;
 if(homeworkSaveTimer)clearTimeout(homeworkSaveTimer);
 homeworkSaveTimer=setTimeout(()=>{void saveHomeworkQuestions().catch(error=>console.warn('[Grammar Textbooks] homework progress save failed',error))},650);
}
function updateHomeworkIdentity(){
 const existing=document.getElementById('grammarHomeworkIdentity');
 existing?.remove();
 if(!activeHomework||!activeBook||Number(activeUnit)!==activeHomework.chapter)return;
 const parent=$('grammarModePanel');
 const box=document.createElement('div');box.id='grammarHomeworkIdentity';
 box.style.cssText='padding:14px 17px;margin:12px 0;border:2px solid #eeb1d0;border-radius:15px;background:#fff';
 box.innerHTML='<strong style="color:#b83c77">숙제 / Homework</strong><div style="font-size:14px;margin-top:4px">'+esc(activeHomework.title)+'</div><small>Homework progress is separate from Golden Unit mastery.</small>';
 parent.prepend(box);
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
 celebration.setAttribute('label','SESSION REWARD');
 mount.append(celebration);
}
function drawFinishScreen(){
 const mastered=masteredIds.size,missed=retryQueue.pendingCount;
 $('grammarFinishMain').innerHTML=renderStudentSessionFinish({
   title:'잘했어요!',
   description:missed?'틀린 문제만 다시 풀어보세요.':'이번 문법 학습이 끝났어요.',
   stats:[{value:roundTotal(),label:'STUDIED'},{value:mastered,label:'SOLID'},{value:missed,label:'REVIEW'}],
   rewardHtml:'<div id="grammarRewardMount" aria-live="polite"></div>',
   actionsHtml:(missed?'<button id="grammarRetry" class="vocab-review-btn" type="button">Review '+missed+'</button>':'')+
    '<button id="grammarResultBack" class="vocab-done-btn" type="button">Finish</button>'+
    '<button id="grammarResultHome" class="vocab-done-btn" type="button">홈</button>'
 });
 $('grammarFinishMain').scrollTop=0;
}

const bestScore=(chapter,mode)=>{
 const row=chapterProgress.find(p=>Number(p.chapter_number)===Number(chapter)&&p.mode===mode);
 if(Number(chapter)>=2){
  const ids=Array.isArray(row?.mastered_question_ids)?row.mastered_question_ids:[];
  return ids.filter(id=>id.startsWith('gt2-c'+chapter+'-'+mode+'-') && id.endsWith('-r2')).length;
 }
 return Number(row?.best_correct)||0;
};
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
  if(mode==='hunt'&&q.displayStyle!=='sentence-options'){
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
function updateUrl(bookId='',unitNumber=null,mode='',{replace=false}={}){
 const p=new URLSearchParams(location.search);
 bookId?p.set('book',bookId):p.delete('book');
 if(bookId&&unitNumber)p.set('unit',String(unitNumber));else p.delete('unit');
 if(bookId&&mode)p.set('mode',mode);else p.delete('mode');
 if(activeHomework&&bookId)p.set('homework',activeHomework.id);else p.delete('homework');
 const url=location.pathname+(p.size?'?'+p.toString():'');
 if(url===location.pathname+location.search)return;
 history[replace?'replaceState':'pushState']({grammarBook:true,book:bookId||'',unit:unitNumber||null,mode:mode||''},'',url);
}
function bookCard(book){return '<button class="vocab-front-book-card" type="button" data-grammar-book="'+esc(book.id)+'"><span class="vocab-front-card-main"><span class="vocab-front-card-copy"><strong>'+esc(book.title)+'</strong></span></span><span class="vocab-front-arrow" aria-hidden="true">›</span></button>'}
async function loadGrammarBooks(){
 try{
  const response=await fetch(DB+'/rest/v1/content_books?select=id,title,book_number,series_id,metadata&status=eq.published&metadata->>subject=eq.grammar&order=title.asc&limit=100',{headers:{apikey:KEY,Authorization:'Bearer '+KEY}});
  if(!response.ok)throw Error('Book catalog '+response.status);
  books=await response.json();
  if(!books.some(b=>b.title==='Grammar Ten 완성 2'))books.unshift({id:'grammar-ten-2-practice',title:'Grammar Ten 완성 2'});
  list.innerHTML=books.length?books.map(bookCard).join(''):'<div class="vocab-front-empty">등록된 문법 교재가 없습니다.</div>';
  const id=new URLSearchParams(location.search).get('book');
  const found=books.find(book=>String(book.id)===id)||((id==='1e3a2112-07be-45e2-a8fc-ce20011e0e57'||id==='grammar-ten-2-practice')?books.find(book=>book.title==='Grammar Ten 완성 2'):null);
  if(geniusHomeworkFromUrl()){
   try{await loadGrammarHomework()}catch(error){console.warn('[Grammar Textbooks] invalid assignment',error);activeHomework=null;$('grammarNotReady').textContent=error.message;$('grammarNotReady').hidden=false}
  }
  if(found)void showBook(found,false,activeHomework?.chapter||null);
 }catch(error){console.warn('[Grammar books] catalog unavailable',error);books=[{id:'grammar-ten-2-practice',title:'Grammar Ten 완성 2'}];list.innerHTML=books.map(bookCard).join('');}
}
async function loadChapterPack(){
 if(chapterPack)return chapterPack;
 const response=await fetch('./grammar-ten-2-chapters.json?v=2',{cache:'no-store'});
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
function selectUnit(number,{push=true}={}){
 if(activeHomework&&number!==activeHomework.chapter){activeHomework=null;homeworkModeEvidence.clear()}
 activeUnit=number;catalog=null;
 const unit=units.find(u=>Number(u.unit_number)===number);
 $('grammarUnitStrip').querySelectorAll('[data-unit]').forEach(el=>{const active=Number(el.dataset.unit)===number;el.classList.toggle('is-current',active);active?el.setAttribute('aria-current','true'):el.removeAttribute('aria-current')});
 $('grammarUnitTitle').textContent=unit?'Unit '+number+' · '+unit.title:'Unit '+number;
 const playable=activeBook?.title.trim()==='Grammar Ten 완성 2'&&!!unit;
 $('grammarModeCards').hidden=!playable;$('grammarNotReady').hidden=playable;
 $('grammarGuideOpen').disabled=!unit;
 if(playable)renderModeCards();
 updateHomeworkIdentity();
 renderUnitsProgress();
 if(push&&activeBook)updateUrl(activeBook.id,number);
}
function renderModeCards(){
 const mount=$('grammarModeCards');if(!mount)return;
 mount.innerHTML=modes.filter(mode=>!activeHomework||activeHomework.required_modes.includes(mode.id)).map((mode,i)=>{
 const count=activeHomework?Math.min(8,Number(homeworkModeEvidence.get(mode.id)?.correct_count)||0):bestScore(activeUnit,mode.id);
 const pct=Math.round(count/8*100),stars=starsForPercent(pct);
 return '<button class="vocab-skill-card '+['vocab-skill-quiz','vocab-skill-spelling','vocab-skill-pronunciation'][i]+'" type="button" data-grammar-mode="'+mode.id+'"><span class="vocab-skill-ring" style="--progress:'+pct+'"><span>'+pct+'%</span></span><span class="vocab-skill-copy"><small class="vocab-skill-step">'+(activeHomework?'HOMEWORK':'STEP '+(i+1))+'</small><strong>'+mode.label+'</strong><span class="vocab-card-stars">'+(activeHomework?count+'/8 completed':'★ '+stars+'/5')+'</span></span></button>'}).join('');
}
async function showBook(book,push=true,requestedUnit=null){
 if(!book)return;
 const token=++navEpoch;activeBook=book;activeMode=null;catalog=null;
 title.textContent=book.title;home.hidden=true;detail.hidden=false;
 $('grammarModePanel').hidden=false;$('grammarRound').hidden=true;$('grammarResult').hidden=true;
 $('grammarModeCards').hidden=true;
 $('grammarUnitTitle').textContent='단원을 불러오는 중…';
 const loaded=await loadBookUnits(book);
 if(token!==navEpoch||activeBook!==book)return;
 units=loaded;
 const strip=$('grammarUnitStrip');
 strip.innerHTML=units.map(u=>'<button type="button" class="study-v2-unit" data-unit="'+Number(u.unit_number)+'">Unit '+Number(u.unit_number)+'</button>').join('');
 strip.hidden=!units.length;
 if(units.length){
  const wanted=Number(requestedUnit||new URLSearchParams(location.search).get('unit')||units[0].unit_number);
  const chosen=units.some(u=>Number(u.unit_number)===wanted)?wanted:Number(units[0].unit_number);
  selectUnit(chosen,{push:false});
  if(book.title.trim()==='Grammar Ten 완성 2')void refreshGrammarProgress();
  if(push)updateUrl(book.id,chosen);
 }else{
  $('grammarUnitTitle').textContent='등록된 단원이 없습니다.';$('grammarNotReady').hidden=false;
  if(push)updateUrl(book.id);
 }
 window.scrollTo(0,0);
}
function showHome(push=true){saveInterruptedRound();activeHomework=null;homeworkModeEvidence.clear();++navEpoch;activeBook=null;activeMode=null;detail.hidden=true;home.hidden=false;$('grammarRound').hidden=true;$('grammarResult').hidden=true;if(push)updateUrl();window.scrollTo(0,0)}
function toSharedQuestion(q){
 if(q.displayStyle==='sentence-options'){
  return {id:q.id,form:'choice',prompt:q.prompt,choices:q.options,answer:[String(q.answerIndex+1)],context:{},metadata:{sourceKey:q.id,practiceType:'grammar_books',chapter:activeUnit,subunit:q.subunit}};
 }
 if(q.instruction){
  return {id:q.id,form:'choice',prompt:q.instruction+'\n'+q.prompt,choices:q.options,answer:[String(q.answerIndex+1)],context:{},metadata:{sourceKey:q.id,practiceType:'grammar_books',chapter:activeUnit,subunit:q.subunit}};
 }
 const hunt=activeMode==='hunt';
 const sentence=hunt?markedSentence(q):'';
 const instruction=hunt?'다음 문장에서 어법상 틀린 부분을 고르시오.':activeMode==='choose'&&q.prompt.startsWith('다음 중')?'':activeMode==='choose'&&((q.prompt.match(/____/g)||[]).length>1)?'빈칸에 들어갈 말이 바르게 짝지어진 것을 고르시오.':activeMode==='choose'?'빈칸에 들어갈 알맞은 말을 고르시오.':q.prompt;
 return {id:q.id,form:'choice',prompt:instruction+(hunt?'\n'+sentence:activeMode==='choose'?(instruction?'\n':'')+q.prompt:''),choices:q.options,answer:[String(q.answerIndex+1)],context:hunt?{underlined_spans:['①','②','③','④']}:{},metadata:{sourceKey:q.id,practiceType:'grammar_books',chapter:activeUnit,subunit:q.subunit}};
}
function renderQuestion(){
 const questions=activeQuestions,q=questions[position];
 if(!q)return finishRound();
 const mode=modes.find(m=>m.id===activeMode);
 $('grammarRoundTitle').textContent=(activeHomework?'숙제 · ':'')+mode.label+' · '+mode.ko;
 $('grammarRoundCounter').textContent=(position+1)+' / '+questions.length;
 $('grammarRoundProgress').style.width=(position/questions.length*100)+'%';
 const old=$('grammarSharedQuestionHost');
 const host=old.cloneNode(false);old.replaceWith(host);
 renderer=new grammarEngine.QuestionRenderer(host).render(toSharedQuestion(q),{onChange:(_,has)=>{if(!checked)$('grammarCheck').disabled=!has}});
 $('grammarNext').hidden=true;$('grammarNext').classList.remove('is-next');$('grammarCheck').hidden=false;$('grammarCheck').disabled=true;$('grammarSkip').hidden=false;
 
 checked=false;
}
async function startMode(mode,{push=true}={}){
 preloadStudentSfx();
 if(!modes.some(x=>x.id===mode)||!activeBook)return;
 const panel=$('grammarModeCards');
 if(panel.getAttribute('aria-busy')==='true')return;
 panel.setAttribute('aria-busy','true');
 const book=activeBook,chapter=activeUnit,token=++navEpoch;
 try{
  await Promise.all([loadQuestions(),refreshGrammarProgress()]);
  if(token!==navEpoch||activeBook!==book||activeUnit!==chapter)return;
  const all=prepareRound(questionBank()[mode]||[],mode);
  const saved=chapterProgress.find(p=>Number(p.chapter_number)===chapter&&p.mode===mode);
  const eligibleIds=new Set(all.map(q=>q.id));
  const inHomework=!!activeHomework&&activeHomework.chapter===chapter&&activeHomework.required_modes.includes(mode);
  if(activeHomework&&!inHomework)throw Error('This mode is not included in the assignment');
  const savedIds=inHomework?(homeworkModeEvidence.get(mode)?.mastered_question_ids||[]):(Array.isArray(saved?.mastered_question_ids)?saved.mastered_question_ids:[]);
  const alreadyMastered=!inHomework&&bestScore(chapter,mode)===8;
  masteredIds=alreadyMastered?new Set():new Set(savedIds.filter(id=>eligibleIds.has(id)));
  activeQuestions=alreadyMastered?all:all.filter(q=>!masteredIds.has(q.id));
  if(!activeQuestions.length)activeQuestions=all;
  homeworkAttemptIds=new Set(masteredIds);
  activeMode=mode;retryQueue.begin(activeQuestions);retryingWrong=false;position=0;correct=0;checked=false;
  beginRewardSession(mode);
  rewardSession.total=all.length;
  // A repeat session cannot award points for questions mastered in an earlier session.
  if(rewardSession){
   rewardSession.reviewOnly=inHomework||bestScore(chapter,mode)===8;
   rewardSession.awardedIds=new Set(masteredIds);
  }
  $('grammarModePanel').hidden=true;$('grammarResult').hidden=true;$('grammarRound').hidden=false;
  if(push)updateUrl(book.id,chapter,mode);renderQuestion();window.scrollTo(0,0);
 }catch(err){
  console.error('[Grammar Books] could not resume mode',err);
  if(token!==navEpoch)return;
  $('grammarNotReady').textContent='학습 기록이나 문제를 불러오지 못했어요. 다시 시도해 주세요.';
  $('grammarNotReady').hidden=false;
 }finally{panel.removeAttribute('aria-busy')}
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
  if(activeHomework){homeworkAttemptIds.add(q.id);scheduleHomeworkSave()}
  if(rewardSession&&!rewardSession.awardedIds.has(q.id)){
   rewardSession.awardedIds.add(q.id);
   if(!rewardSession.reviewOnly){
    rewardSession.points+=2;
    showPointAward({amount:2,origin:capturePointOrigin($('grammarSharedQuestionHost'))}).catch(()=>{});
   }
   if(!retryingWrong)rewardSession.firstCorrect++;
  }
 }
  retryQueue.record(q,result.correct);
 playStudentSfx(result.correct?'correct':'wrong');
 renderer.showFeedback(result);
 btn.hidden=true;$('grammarSkip').hidden=true;$('grammarNext').hidden=false;$('grammarNext').classList.add('is-next');
 $('grammarNext').textContent=position===activeQuestions.length-1?'Finish':'Next Question →';
}
async function finishRound(){
 playStudentSfx('complete');
 $('grammarRound').hidden=true;
 drawFinishScreen();
 $('grammarResult').hidden=false;
 const rewardMount=$('grammarRewardMount');
 const completed=retryQueue.pendingCount===0;
 // The same Word Genius celebration must mount immediately on session finish.
 // Persistence runs afterward; a failed request must not hide the star animation.
 if(completed&&rewardSession){
  const percent=Math.round(rewardSession.firstCorrect/roundTotal()*100);
  showGrammarReward({
   percent,stars:rewardSession.reviewOnly?0:starsForPercent(percent),
   points:rewardSession.reviewOnly?0:rewardSession.points
  });
 }
 if(!retryingWrong||completed){
  try{
   if(typeof window.WillenaMissionBasket?.recordGrammarBookRound!=='function')throw Error('Grammar progress writer unavailable');
   const alreadyGold=goldChapter(activeUnit);
   if(currentGrammarContext().isHomework){
     await saveHomeworkQuestions();
     homeworkModeEvidence.set(activeMode,{correct_count:masteredIds.size,mastered_question_ids:[...masteredIds]});
     renderModeCards();
   }else{
     await window.WillenaMissionBasket.recordGrammarBookRound(activeUnit,activeMode,masteredIds.size,[...masteredIds]);
     await refreshGrammarProgress();
   }
   if(!activeHomework&&!alreadyGold&&goldChapter(activeUnit)){
    const actions=$('grammarFinishMain').querySelector('.vocab-finish-actions');
    actions?.insertAdjacentHTML('beforebegin',
      '<div class="vocab-golden-award"><img class="vocab-golden-award-icon" src="/shared/svgs/golden-unit.svg?v=20260927-icons1" alt=""><div><strong>Golden Unit earned!</strong><span>Unit '+activeUnit+' is mastered.</span></div></div>');
   }
  }catch(error){
   console.error('[Grammar Books] progress save failed',error);
   showFinishSaveWarning('학습 기록이 저장되지 않았어요.');
  }
  if(completed){
   try{await completeRewardSession()}
   catch(error){
    console.error('[Grammar Books] award save failed',error);
    showFinishSaveWarning('별과 포인트 저장을 확인하지 못했어요.');
   }
   void window.WillenaMissionBasket?.recordCompletedActivity?.('grammar-ten-2-chapter-'+activeUnit+'-'+activeMode,'Grammar Genius Books');
   void window.WillenaAchievements?.refresh?.();
  }
 }
 window.scrollTo(0,0);
}
function showFinishSaveWarning(message){
 const mount=$('grammarFinishMain');
 if(!mount)return;
 let warning=$('grammarFinishSaveWarning');
 if(!warning){
  warning=document.createElement('p');
  warning.id='grammarFinishSaveWarning';
  warning.setAttribute('role','status');
  warning.style.cssText='margin:12px auto;font-size:14px;font-weight:700;color:#a33';
  mount.querySelector('.vocab-finish-actions')?.before(warning);
 }
 warning.textContent=[warning.textContent,message].filter(Boolean).join(' ');
}
function saveInterruptedRound(){
 if(!activeMode||$('grammarRound').hidden||!masteredIds.size)return;
 const mode=activeMode,chapter=activeUnit,ids=[...masteredIds];
 if(activeHomework){void saveHomeworkQuestions().catch(e=>console.warn('[Grammar Textbooks] unfinished homework save failed',e));return}
 void window.WillenaMissionBasket?.recordGrammarBookRound?.(chapter,mode,ids.length,ids)
  .then(()=>{if(activeBook)void refreshGrammarProgress()})
  .catch(e=>console.warn('[Grammar Books] could not save exited round',e));
}
function goToModes(push=true){
 saveInterruptedRound();
 ++navEpoch;
 $('grammarRound').hidden=true;$('grammarResult').hidden=true;
 $('grammarModePanel').hidden=false;activeMode=null;
 if(activeBook){detail.hidden=false;home.hidden=true;}
 if(push&&activeBook)updateUrl(activeBook.id,activeUnit);
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
$('grammarSkip')?.addEventListener('click',()=>{if(checked||!activeMode)return;retryQueue.record(activeQuestions[position],false);position++;renderQuestion()});
$('grammarNext')?.addEventListener('click',()=>{position++;renderQuestion()});
$('grammarResult')?.addEventListener('click',event=>{
 const button=event.target.closest('button');
 if(!button)return;
 if(button.id==='grammarRetry'){
  if(!activeMode||!retryQueue.pendingCount)return;
  activeQuestions=retryQueue.retry();retryingWrong=true;position=0;correct=0;checked=false;
  $('grammarResult').hidden=true;$('grammarRound').hidden=false;renderQuestion();
 }else if(button.id==='grammarResultBack')goToModes();
 else if(button.id==='grammarResultHome')showHome();
});
$('grammarRoundBack')?.addEventListener('click',goToModes);
$('grammarSessionHome')?.addEventListener('click',()=>showHome());
$('grammarResultHome')?.addEventListener('click',()=>showHome());
back?.addEventListener('click',()=>{if(!$('grammarRound').hidden||!$('grammarResult').hidden){goToModes();return}showHome()});
window.addEventListener('popstate',()=>{
 saveInterruptedRound();
 const params=new URLSearchParams(location.search),id=params.get('book'),book=books.find(b=>String(b.id)===id);
 const unit=Number(params.get('unit'))||null,mode=params.get('mode');
 if(!book){showHome(false);return}
 if(activeBook&&String(activeBook.id)===String(book.id)&&units.length){
  ++navEpoch;
  if(unit&&units.some(u=>Number(u.unit_number)===unit))selectUnit(unit,{push:false});
  if(mode&&modes.some(m=>m.id===mode)){void startMode(mode,{push:false});return}
  $('grammarRound').hidden=true;$('grammarResult').hidden=true;activeMode=null;
  $('grammarModePanel').hidden=false;detail.hidden=false;home.hidden=true;
  renderModeCards();return;
 }
 void showBook(book,false,unit).then(()=>{if(mode&&activeBook===book)void startMode(mode,{push:false})});
});
document.addEventListener('DOMContentLoaded',()=>{window.WillenaMissionBasket?.mount($('appMissionBasket'),{app:'Grammar Genius Books'});loadGrammarBooks()});
