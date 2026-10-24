// Sentence Genius entrypoint. Uses Word Genius's CSS and canonical question
// renderer, same student assignment service, reward scoring, audio and history.
import {QuestionRenderer} from '/shared/questions/question-renderer.js';
import {studentIdentity,assignedBooks,loadUnits,loadSentences} from './content.js';
import {openUnit,checkOrder,MODES} from './scoring.js';
import {recordSentenceAttempt,getSentenceMastery} from './tracking.js';
import {connectSpeechSupport,playModel,prefetchAudio,stopAudio,matchSentence} from './speech.js';
import {createVocabHistoryNavigation} from '/students/vocab-study/navigation-history.js';
import {playStudentSfx} from '/students/shared/student-sfx.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
const state={student:null,books:[],book:null,units:[],unit:null,items:[],store:null,
  screen:'home',mode:null,queue:[],index:0,answered:false,renderer:null,speech:null,
  startedAt:0,generation:0,attemptNumbers:new Map(),loading:false};
const nav=createVocabHistoryNavigation({applyRoute:applyRoute});
const labels={coach:'Practice Coach · 연습',unscramble:'문장 배열',speaking:'말하기'};
const show=(id,visible)=>{$(id).hidden=!visible};
const message=text=>{$('message').textContent=text||''};
const uuid=v=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
function clearQuestion(){state.speech?.dispose();state.speech=null;try{state.renderer?.speechRecognition?.stop()}catch{};state.renderer=null;stopAudio()}
function showScreen(screen){
  state.screen=screen;
  show('front',screen==='home');show('bookScreen',screen==='book');show('session',screen==='activity');
  if(screen!=='home')message('');
}
function front(){
  const list=$('bookList');list.replaceChildren();
  if(!state.books.length){list.textContent='현재 배정된 교재가 없습니다.';return}
  state.books.forEach(book=>{
    const btn=document.createElement('button');
    btn.type='button';btn.className='vocab-front-book-card';btn.innerHTML=
      '<span class="vocab-front-card-main"><span class="vocab-front-card-copy"><span class="eyebrow">SENTENCE GENIUS</span><strong>'+esc(book.title)+'</strong><small>문장을 연습해 보세요</small></span></span>'+
      '<span class="vocab-front-arrow" aria-hidden="true">›</span>';
    btn.onclick=()=>void openBook(book.id);
    list.append(btn);
  });
}
async function openBook(id,{historyMode='push',unitId}={}){
  if(state.loading)return;
  state.loading=true;message('교재와 단원을 불러오는 중…');
  try{
    const book=state.books.find(x=>x.id===id);
    if(!book)throw Error('Book not assigned to this student');
    state.book=book;
    state.units=await loadUnits(id);
    if(!state.units.length)throw Error('No published units available in this book');
    showScreen('book');
    await selectUnit(unitId||state.units[0].id,{historyMode:'none'});
    if(historyMode!=='none'){nav[historyMode]({screen:'book',bookId:id,unitId:state.unit.id})}
  }catch(error){console.warn('[Sentence Genius] book',error);message(error.message);showScreen('home')}
  finally{state.loading=false}
}
async function selectUnit(id,{historyMode='replace'}={}){
  const unit=state.units.find(x=>x.id===id);if(!unit)return;
  const generation=++state.generation;
  state.unit=unit;state.items=[];message('교재 문장을 불러오는 중…');
  $('unitTitle').textContent='Unit '+(unit.unit_number||'')+' · '+(unit.title||'');
  updateCards();
  try{
    const items=await loadSentences(state.book.id,unit.id);
    if(state.generation!==generation)return;
    state.items=items;state.store=openUnit(state.student.id,unit.id);
    renderUnits();updateCards();
    // Rehydrate from the operational DB on every unit visit; local data is
    // only an optimistic cache if a write is still queued or network is down.
    try{state.store.hydrateServer(await getSentenceMastery(state.book.id,unit.id))}
    catch(error){console.warn('[Sentence Genius] server snapshot unavailable',error)}
    if(state.generation!==generation)return;
    updateCards();message(items.length?'':'이 단원에는 영어·한국어 문장 쌍이 아직 없습니다.');
    if(historyMode!=='none')nav[historyMode]({screen:'book',bookId:state.book.id,unitId:unit.id});
  }catch(error){if(state.generation===generation){message(error.message);console.warn('[Sentence Genius] unit',error)}}
}
function renderUnits(){
  const root=$('unitStrip');root.replaceChildren();
  state.units.forEach(unit=>{
    const btn=document.createElement('button');btn.type='button';btn.className='sg-unit'+(unit.id===state.unit?.id?' active':'');
    btn.textContent='Unit '+(unit.unit_number||'');
    btn.setAttribute('aria-pressed',String(unit.id===state.unit?.id));
    btn.onclick=()=>void selectUnit(unit.id);root.append(btn);
  });
}
function updateCards(){
  const items=state.items,store=state.store;
  $('bookName').textContent=state.book?.title||'Sentence Genius';
  $('itemCount').textContent=items.length+' sentences';
  for(const [id,mode] of [['coachCard','coach'],['unscrambleCard','unscramble'],['speakingCard','speaking']]){
    const btn=$(id);btn.disabled=!items.length;
    const percent=store&&items.length?store.percent(mode,items):0;
    btn.querySelector('.vocab-skill-ring').style.setProperty('--progress',percent);
    btn.querySelector('.vocab-skill-ring span').textContent=percent+'%';
    if(mode!=='coach')$(mode+'Stars').textContent=(store?store.stars(mode,items):0)+'/5 stars';
  }
  const gold=!!(store&&store.gold(items));
  $('goldStatus').classList.toggle('is-gold',gold);
  $('goldStatus').lastChild.textContent=gold?'Golden Unit · 완성!':' Complete Unscramble + Speaking for gold.';
}
function shuffle(items){
  const a=items.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a;
}
function queueFor(mode){
  const unseen=state.store.pending(mode,state.items);
  // Once mastered, a student may revisit a mode for unscored revision.
  return shuffle((unseen.length?unseen:state.items).map(x=>({...x,retryCount:0})));
}
function begin(mode,{historyMode='push'}={}){
  if(!state.items.length||!MODES[mode])return;
  clearQuestion();state.mode=mode;state.queue=queueFor(mode);state.index=0;state.answered=false;
  $('sessionTitle').textContent=labels[mode];$('sessionFooter').hidden=false;
  showScreen('activity');
  if(historyMode!=='none')nav[historyMode]({screen:'activity',bookId:state.book.id,unitId:state.unit.id,activityKind:mode,parentScreen:'book'});
  renderQuestion();
}
function orderQuestion(item){
  const tokens=item.en.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?|[^\s]/gu)||[];
  if(tokens.length<2)return null;
  let scrambled=shuffle(tokens);
  // Shuffle again if the initial sequence is unchanged, including short sentences.
  if(tokens.length>1&&scrambled.join(' ')==tokens.join(' '))scrambled=[...tokens.slice(1),tokens[0]];
  return {id:'sentence-order-'+item.id,form:'order',prompt:item.ko,context:{},answer:[tokens.join(' ')],
    chips:scrambled,input:{language:'en'},grading:{constraints:{}}};
}
function speakingQuestion(item){
  return {id:'sentence-speaking-'+item.id,form:'speaking',prompt:item.ko,context:{},answer:[item.en],input:{language:'en'},grading:{constraints:{}}};
}
function renderQuestion(){
  clearQuestion();
  const item=state.queue[state.index];
  if(!item){finish();return}
  state.answered=false;state.startedAt=Date.now();
  $('sessionIndex').textContent=(state.index+1)+' / '+state.queue.length;
  $('sessionBar').style.width=Math.round(100*state.index/Math.max(1,state.queue.length))+'%';
  $('instruction').textContent=state.mode==='coach'?'영어 문장을 듣고 따라 말하세요.':
    state.mode==='unscramble'?'우리말을 보고 영어 문장을 만드세요.':'우리말을 보고 영어로 말하세요.';
  show('englishCoach',state.mode==='coach');
  $('englishCoach').textContent=state.mode==='coach'?item.en:'';
  show('listenTools',state.mode!=='unscramble');
  show('skip',state.mode==='speaking');
  show('answerNote',false);
  $('action').textContent='Check Answer';$('action').disabled=true;$('action').classList.remove('is-next');
  const question=state.mode==='unscramble'?orderQuestion(item):speakingQuestion(item);
  if(!question){state.index++;renderQuestion();return}
  const renderer=new QuestionRenderer($('questionRoot')).render(question,{
    onChange:(_value,has)=>{if(!state.answered)$('action').disabled=!has}
  });
  state.renderer=renderer;
  if(state.mode!=='unscramble'){
    const myIndex=state.index, myMode=state.mode;
    state.speech=connectSpeechSupport({
      host:$('questionRoot'),renderer,item,
      isCurrent:()=>state.index===myIndex&&state.mode===myMode&&state.renderer===renderer&&!state.answered&&state.screen==='activity',
      onAccepted:()=>{if(!state.answered)void submit()}
    });
    prefetchAudio(state.queue.slice(state.index,state.index+3));
  }
  $('sessionMain').scrollTop=0;
}
async function submit(){
  const item=state.queue[state.index],renderer=state.renderer;
  if(!item||!renderer)return;
  if(state.answered){state.index++;renderQuestion();return}
  const response=renderer.getResponse();
  if(!String(response??'').trim())return;
  const assessment=state.mode==='unscramble'
    ?{correct:checkOrder(response,item.en),matchedBy:'order'}
    :matchSentence(item.en,renderer.getSpeechAlternatives?.().length?renderer.getSpeechAlternatives():[response]);
  const correct=!!assessment.correct;
  const itemUnitId=state.unit.id;
  // Coach retries do not hurt a unit; they are deliberate practice.
  const result=state.store.attempt(state.mode,item.id,{correct});
  if(result.repeat){state.queue.push({...item,retryCount:item.retryCount+1})}
  try{
    void recordSentenceAttempt({
      book:state.book,unit:state.unit,item,mode:state.mode,response,correct,
      retryCount:item.retryCount,points:result.points,
      source:assessment.matchedBy==='ai'?'openai_ai_fallback':'browser',
      elapsedMs:Date.now()-state.startedAt
    }).then(async()=>{
      // The canonical recorder stores the attempt before this resolves.
      if(state.unit?.id===itemUnitId&&state.store){
        try{state.store.hydrateServer(await getSentenceMastery(state.book.id,itemUnitId));updateCards()}
        catch(error){console.warn('[Sentence Genius] snapshot refresh',error)}
      }
    }).catch(error=>console.warn('[Sentence Genius] study record',error));
  }catch(error){console.error('[Sentence Genius] missing study recorder',error);message('Progress recorder unavailable');}
  state.answered=true;state.speech?.dispose();state.speech=null;
  playStudentSfx(correct?'correct':'wrong');
  renderer.setDisabled(true);renderer.showFeedback({
    correct,correctAnswer:[item.en],message:correct?'정답입니다!':'다시 연습해 보세요.'
  });
  // Speaking transcripts can be wrong even when they sound correct.
  $('answerNote').textContent=correct?'좋아요! '+item.en:'Correct sentence: '+item.en;
  show('answerNote',true);
  $('action').textContent='Next →';$('action').disabled=false;$('action').classList.add('is-next');
  updateCards();
}
function skip(){
  const item=state.queue[state.index];if(!item||state.answered)return;
  state.queue.push({...item,retryCount:item.retryCount+1});state.index++;renderQuestion();
}
function finish(){
  clearQuestion();
  $('sessionTitle').textContent='완료 · Session complete';$('sessionIndex').textContent='Done';
  $('sessionBar').style.width='100%';$('sessionFooter').hidden=true;
  show('englishCoach',false);show('listenTools',false);
  $('instruction').textContent=state.mode==='coach'?'Practice Coach complete':'잘했어요!';
  $('questionRoot').innerHTML='<div class="vocab-finish"><span class="eyebrow">SENTENCE GENIUS</span><h2>Session complete!</h2><p>다음 단계도 도전해 보세요.</p><div class="vocab-finish-stats"><div><strong>'+
    state.store.percent(state.mode,state.items)+'%</strong><span>Unit mastery</span></div><div><strong>'+
    state.store.stars(state.mode,state.items)+'/5</strong><span>Stars</span></div><div><strong>'+
    (state.store.gold(state.items)?'Gold':'—')+'</strong><span>Golden Unit</span></div></div>'+
    '<div class="vocab-finish-actions"><button type="button" class="vocab-done-btn" id="finishBook">Back to unit</button><button type="button" class="vocab-review-btn" id="finishAgain">Practice again</button></div></div>';
  $('finishBook').onclick=()=>void returnBook();
  $('finishAgain').onclick=()=>begin(state.mode,{historyMode:'replace'});
}
async function returnBook(){
  clearQuestion();showScreen('book');renderUnits();updateCards();
  nav.replace({screen:'book',bookId:state.book.id,unitId:state.unit.id});
}
async function applyRoute(route){
  if(route.screen==='home'){clearQuestion();showScreen('home');front();return}
  if(route.bookId&&route.bookId!==state.book?.id){
    await openBook(route.bookId,{historyMode:'none',unitId:route.unitId});
  }else if(route.unitId&&route.unitId!==state.unit?.id){
    await selectUnit(route.unitId,{historyMode:'none'});
  }
  if(route.screen==='book'){clearQuestion();showScreen('book');updateCards();return}
  if(route.screen==='activity'&&MODES[route.activityKind])begin(route.activityKind,{historyMode:'none'});
}
async function boot(){
  try{
    const student=await studentIdentity();
    if(!student.id||!student.className)throw Error('Student identity or class not available');
    state.student=student;
    state.books=await assignedBooks(student.className);
    front();showScreen('home');message(state.books.length?'':'현재 배정된 교재가 없습니다.');
    await nav.start({screen:'home'});
  }catch(error){
    console.error('[Sentence Genius] start',error);
    message('앱을 불러오지 못했습니다: '+error.message);
    if(/session|expired|401|auth/i.test(error.message))location.replace('/students/signin.html?next='+encodeURIComponent('/students/sentence-genius/'));
  }
}
$('bookBack').onclick=()=>nav.home();
$('sessionHome').onclick=()=>nav.home();
$('sessionBack').onclick=()=>nav.back({screen:'book',bookId:state.book?.id,unitId:state.unit?.id});
$('coachCard').onclick=()=>begin('coach');
$('unscrambleCard').onclick=()=>begin('unscramble');
$('speakingCard').onclick=()=>begin('speaking');
$('action').onclick=()=>void submit();
$('skip').onclick=skip;
$('listen').onclick=async()=>{
  if(state.mode==='unscramble'||!state.queue[state.index])return;
  const button=$('listen');button.disabled=true;$('listenLabel').textContent='음성 준비 중…';
  try{state.renderer?.speechRecognition?.stop();await playModel(state.queue[state.index].en)}
  finally{button.disabled=false;$('listenLabel').textContent='Listen · 발음 듣기'}
};
window.addEventListener('pagehide',clearQuestion);
void boot();
