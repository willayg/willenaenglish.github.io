// Writing Genius v1.11.0: use available unit sentences (up to ten), repeat wrong answers.
// First attempt fixes stars; DB model and approved variations are checked before AI.
import {getAssignedPracticeBooks,getPracticeUnits,
 getTextbookSentences,generatePracticeQuestions} from './sentence-practice-data.js?v=20261025-wg-v1.11.0';
import {sessionSummary,masteredAnswer,publishGeniusStars} from './sentence-practice-rewards.js?v=20261025-wg-v1.11.0';
// Same canonical renderer as Sentence Genius. Writing Genius owns grading and stars,
// but does not duplicate the question prompt, context or typed-English control.
import {QuestionRenderer} from '/shared/questions/question-renderer.js?v=20261025-wg-v1.11.0';
import {playStudentSfx,preloadStudentSfx} from '/students/shared/student-sfx.js';
import {capturePointOrigin,showPointAward} from '/students/components/student-point-feedback.js';
const $=id=>document.getElementById(id);
const txt=(id,value)=>{$(id).textContent=String(value??'')};
const field=id=>$(id).value;
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
const bounded=(promise,ms=12000)=>Promise.race([
 promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('요청 시간이 초과됐어요. 다시 시도해 주세요.')),ms))
]);
const seoulDate=()=>{const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',
 {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'})
 .formatToParts(new Date()).map(x=>[x.type,x.value]));return [parts.year,parts.month,parts.day].join('-')};
let singleton=null;
export function createSentencePractice({api,checksApi,gradeSentence,rewardsApi,quotaApi,onExit}){
 if(singleton)return singleton;
 const state={student:null,books:[],units:[],session:null,recent:[],today:null,bookReq:0,
  queue:Promise.resolve(),timer:null,loading:false,active:false,screen:'picker',catalogError:false,
  rewards:new Map(),rewardInflight:new Set(),renderer:null,hydrating:false,quota:null,
  previewReq:0,previewKey:'',previewCount:null};
 const answerInput=()=>state.renderer?.host?.querySelector('[data-write]')||null;
 const answerValue=()=>answerInput()?.value||'';
 function showQuota(quota){
  if(!quota||typeof quota.remaining!=='number')return;
  state.quota=quota;
  const label=quota.remaining>0
   ?'AI Willi 오늘 남은 확인 '+quota.remaining+'/20'
   :'AI Willi 오늘 20회 완료 · 다른 앱을 연습하고 내일 다시 와요!';
  txt('spAiQuotaPicker',label);txt('spAiQuotaRound',label);
 }
 const hintWords=hint=>{
  const parts=String(hint||'').split('·');
  const content=(parts.length>1?parts.slice(1).join('·'):parts[0]).trim();
  return content.split(/\s*\/\s*/).map(x=>x.trim()).filter(Boolean);
 };
 const questionFor=card=>({
  id:'wg-make-'+(card.sourceIds?.[0]||card.id||'text'),
  form:'write',prompt:card.display||'한국어를 읽고 영어 문장을 만들어 보세요.',
  context:{words:hintWords(card.hint)},
  answer:[card.model],input:{language:'en'},grading:{constraints:{}}
 });
 function mountQuestion(card,resp){
  const host=$('spQuestionHost');
  state.hydrating=true;
  try{
   // QuestionRenderer provides the canonical safely-rendered Korean prompt,
   // visible vocabulary bank and typed answer input.
   state.renderer=new QuestionRenderer(host).render(questionFor(card),{
    onChange:()=>{if(!state.hydrating)changed()}
   });
   const input=answerInput();
   if(!input)throw Error('공용 문장 입력창을 불러오지 못했어요.');
   input.maxLength=600;
   input.setAttribute('aria-label','내 문장 · My sentence');
   input.setAttribute('autocapitalize','sentences');
   input.setAttribute('spellcheck','true');
   input.value=resp.draft||resp.revised||resp.initial||'';
  }finally{state.hydrating=false}
 }
 const notify=(message='',error=false)=>{
  for(const id of ['spMessage','spRoundMessage']){
   txt(id,message);$(id).classList.toggle('is-error',error);
  }
 };
 const saveLabel=message=>{
  txt('spSaveState',message||'');
  txt('spRoundSave',message||'');
 };
 const setScreen=name=>{
  state.screen=name;
  $('spPicker').hidden=name!=='picker';
  $('spRound').hidden=name!=='round';
  $('spDone').hidden=name!=='done';
  txt('spBack',name==='picker'?'← 글쓰기 메뉴':'← 단원 선택');
  notify();
 };
 const current=()=>{
  const session=state.session;
  if(!session||session.current_index>=session.questions.length)return null;
  const i=session.current_index;
  if(!Array.isArray(session.responses))session.responses=[];
  if(!session.responses[i])session.responses[i]={
   initial:'',draft:'',revised:'',compared:false,hintUsed:true,attempts:0,firstFeedback:null};
  return session.responses[i];
 };
 async function persist(){
  clearTimeout(state.timer);state.timer=null;
  const session=state.session;if(!session)return true;
  const snapshot={responses:structuredClone(session.responses||[]),
   current_index:session.current_index,status:session.status};
  const id=session.id;
  const run=()=>api('PATCH','?id=eq.'+encodeURIComponent(id),snapshot);
  state.queue=state.queue.catch(()=>{}).then(run);
  saveLabel('저장 중…');
  try{
   const rows=await state.queue;
   if(!Array.isArray(rows)||!rows.length)throw Error('연습 저장 응답이 없어요.');
   if(state.session?.id===id)saveLabel('저장됨');
   return true;
  }catch(err){
   saveLabel('저장 안 됨');
   notify('저장하지 못했어요. 다시 시도해 주세요. '+err.message,true);
   return false;
  }
 }
 function changed(){
  if(state.screen!=='round'||!state.session||state.session.status==='completed')return;
  const resp=current();
  if(!resp)return;
  resp.draft=answerValue();
  if(resp.feedback)resp.revised=resp.draft;
  clearTimeout(state.timer);
  state.timer=setTimeout(()=>{void persist()},850);
  saveLabel('저장 중…');
  if(resp.feedback?.grade!=='correct')displayGrade(state.session.questions[state.session.current_index],resp);
 }
 const gradeTitle=grade=>grade==='correct'?'정확해요! · 4점':
  grade==='almost'?'거의 맞았어요! · 2점':'다시 살펴봐요 · 0점';
 function displayGrade(card,resp){
  const result=resp.feedback;
  if(result)state.renderer?.showFeedback({
   correct:result.grade==='correct',
   message:result.explanation_ko||'한 번 더 확인해 보세요.'
  });
  $('spFeedback').hidden=!result;
  $('spCompare').hidden=!result;
  const correct=result?.grade==='correct';
  const exhausted=Number(resp.attempts||0)>=10;
  const typed=answerValue().trim();
  const wasChecked=typed===String(result?.checked_text||'').trim();
  $('spCompareBtn').hidden=correct||exhausted;
  $('spCompareBtn').disabled=!typed||wasChecked;
  // Show both choices close to feedback, before the model answer.
  $('spNextActions').hidden=!result;
  $('spRetryBtn').hidden=!result||correct||exhausted;
  $('spNextBtn').hidden=!result;
  const isLast=state.session.current_index===state.session.questions.length-1;
  txt('spNextBtn',isLast?'완료':'다음');
  if(!result){txt('spCompareBtn','AI Willi 확인하기');txt('spMasteryNote','');return}
  txt('spCompareBtn','다시 확인하기 ('+(resp.attempts||1)+'/10)');
  $('spGrade').textContent=gradeTitle(result.grade);
  $('spFeedback').dataset.grade=result.grade;
  txt('spGradeNote',result.explanation_ko||'');
  txt('spSuggestion',result.suggestion?'추천 표현: '+result.suggestion:'');
  refreshMasteryNote();
  txt('spModel',card.model);
  txt('spComparisonNote',card.help||'교재 예문은 다른 올바른 표현 중 하나일 수 있어요.');
 }
 function showRound(){
  const s=state.session;if(!s)return;
  if(s.status==='completed'||s.current_index>=s.questions.length){showDone();return}
  setScreen('round');
  const i=s.current_index,card=s.questions[i],resp=current();
  txt('spModeLabel','문장 만들기');
  txt('spQuestionCount',(i+1)+' / '+s.questions.length);
  $('spProgressBar').style.width=(i/s.questions.length*100)+'%';
  txt('spUnitName',s.book_title+' · '+(card.unitName||'Unit'));
  mountQuestion(card,resp);
  txt('spTaskDetail','');
  $('spCompareBtn').disabled=!answerValue().trim();
  txt('spCompareBtn','확인');
  txt('spNextBtn',i===s.questions.length-1?'완료':'다음');
  displayGrade(card,resp);
  saveLabel('저장됨');
  $('spSessionMain').scrollTop=0;
 }
 function showDone(){
  setScreen('done');
  const session=state.session;
  if(!session)return;
  const summary=sessionSummary(session);
  const award=state.rewards.get(session.book_id+'|'+session.unit_id);
  txt('spStarsEarned','★'.repeat(summary.stars)+'☆'.repeat(5-summary.stars));
  txt('spScoreSummary',summary.percent+'% · '+summary.stars+'/5 stars · 숙달 '+summary.mastered+'/'+summary.total+
   (!summary.eligible?' · 단원 혼합 연습(골드 제외)':''));
  $('spGoldAward').hidden=!award?.golden;
  txt('spSyncStatus','');
  refreshStartButton();
  void synchronizeRewards(session,summary);
 }
 function refreshMasteryNote(){
  const session=state.session,resp=current();
  if(!session||!resp?.feedback){txt('spMasteryNote','');return}
  const card=session.questions[session.current_index];
  txt('spMasteryNote',masteredAnswer(resp,card)?
   '✓ 정답! 첫 번째 점수는 그대로 유지돼요.':
   (Number(resp.attempts||0)>=10
    ?'확인 횟수를 모두 사용했어요. 다음 문장으로 넘어가세요.'
    :'다시 고쳐서 확인하거나 다음 문장으로 넘어갈 수 있어요. 정답이 아닌 문장은 골드 숙달에 포함되지 않아요.'));
 }
 function renderGoldenCount(){
  const book=field('spBook');
  const count=state.units.filter(u=>state.rewards.get(book+'|'+u.id)?.golden).length;
  $('spGoldCount').hidden=!count;
  txt('spGoldCount','Golden Units '+count+' / '+state.units.length);
 }
 async function fetchUnitRewards(){
  try{
   const data=await rewardsApi();
   state.rewards=new Map((Array.isArray(data)?data:[]).map(row=>[
    String(row.book_id)+'|'+String(row.unit_id),row]));
   renderUnitButtons();renderGoldenCount();
  }catch(error){console.warn('[Writing Genius] Gold units unavailable',error)}
 }
 async function synchronizeRewards(session,summary){
  const id=session.id;
  if(state.rewardInflight.has(id))return;
  state.rewardInflight.add(id);
  try{
   const key='writing-genius-reward-synced:'+id;
   let synced=false;
   try{synced=localStorage.getItem(key)==='1'}catch{}
   if(!synced){
    await publishGeniusStars(session,summary,
     state.units.find(u=>u.id===session.unit_id)?.number||'Unit');
    try{localStorage.setItem(key,'1')}catch{}
   }
   if(state.session?.id===id)txt('spSyncStatus','★ 별이 저장되었어요.');
  }catch(error){
   console.warn('[Writing Genius] Star sync unavailable',error);
   if(state.session?.id===id)txt('spSyncStatus',
    '연습 점수는 저장됐어요. 전체 별 동기화는 다음 접속에 다시 시도해요.');
  }finally{
   await fetchUnitRewards();
   if(state.session?.id===id){
    const award=state.rewards.get(session.book_id+'|'+session.unit_id);
    $('spGoldAward').hidden=!award?.golden;
    if(award?.golden)txt('spSyncStatus','골드 유닛 달성! ★');
   }
   state.rewardInflight.delete(id);
  }
 }
 function refreshStartButton(){
  const btn=$('spStart'),last=state.today;
  if(last?.status==='in_progress'){
   btn.disabled=false;txt('spStart','이어서 연습하기 →');
   txt('spSourceNote','완료하지 않은 연습을 이어서 할 수 있어요.');return;
  }
  btn.disabled=state.loading||state.catalogError||!field('spBook')||!field('spUnit');
  txt('spStart','시작');
  const selected=field('spBook')+'|'+field('spUnit');
  if(state.previewKey===selected&&Number.isInteger(state.previewCount)){
   txt('spSourceNote',state.previewCount>0
    ?'이 단원 '+state.previewCount+'문장 · 전부 맞히면 골드 유닛! (5문장이어도 가능)'
    :'이 단원에는 연습할 문장이 없어요. 다른 단원을 선택하세요.');
  }else txt('spSourceNote','선택한 단원에서 문장을 연습해요. 5문장만 있어도 모두 맞히면 골드!');
 }
 async function previewUnit(){
  const book=field('spBook'),unit=field('spUnit'),serial=++state.previewReq;
  if(!book||!unit)return;
  txt('spSourceNote','단원 문장 수를 확인하는 중…');
  try{
   const items=await bounded(getTextbookSentences(book,unit,state.units),18000);
   const count=generatePracticeQuestions('make',items,10).length;
   if(serial!==state.previewReq||book!==field('spBook')||unit!==field('spUnit'))return;
   state.previewKey=book+'|'+unit;
   state.previewCount=count;
   refreshStartButton();
  }catch(error){
   if(serial!==state.previewReq)return;
   txt('spSourceNote','단원 문장 전체를 맞히면 골드! 문장 수는 시작할 때 확인해요.');
  }
 }
 function renderUnitButtons(){
  const strip=$('spUnitStrip');strip.replaceChildren();
  for(const unit of state.units){
   const selected=unit.id===field('spUnit');
   const b=node('button','Unit '+unit.number);
   b.type='button';b.className='study-v2-unit'+(selected?' is-current':'');
   const achievement=state.rewards.get(field('spBook')+'|'+unit.id);
   if(achievement?.golden){
    b.classList.add('is-golden');
    const icon=document.createElement('img');
    icon.className='vocab-unit-gold';
    icon.src='/shared/svgs/golden-unit.svg?v=20260927-icons1';
    icon.alt='Golden Unit';
    b.append(icon);
   }else if(Number(achievement?.best_stars)>0){
    const badge=document.createElement('span');
    badge.className='sp-unit-stars';
    badge.textContent=' ★'+achievement.best_stars;
    b.append(badge);
   }
   b.setAttribute('aria-pressed',String(selected));
   b.title=unit.title;
   b.addEventListener('click',()=>{
    $('spUnit').value=unit.id;
    renderUnitButtons();refreshStartButton();void previewUnit();
   });strip.append(b);
  }
 }
 async function loadUnits(){
  const bookId=field('spBook'),serial=++state.bookReq;
  $('spUnit').value='';state.units=[];$('spUnitStrip').replaceChildren();
  refreshStartButton();
  if(!bookId)return;
  try{
   const units=await bounded(getPracticeUnits(bookId));
   if(serial!==state.bookReq)return;
   state.units=units;
   if(units.length)$('spUnit').value=units[0].id;
   renderUnitButtons();renderGoldenCount();
   state.catalogError=false;
  }catch(err){
   if(serial!==state.bookReq)return;
   state.catalogError=true;
   notify('교재 단원을 불러오지 못했어요. '+err.message,true);
  }
  refreshStartButton();void previewUnit();
 }
 function renderBookTabs(){
  const value=field('spBook');
  [...$('spBookTabs').children].forEach((b,i)=>{
   const active=state.books[i]?.id===value;
   b.classList.toggle('is-current',active);
   b.setAttribute('aria-pressed',String(active));
  });
 }
 async function loadBooks(){
  state.books=await bounded(getAssignedPracticeBooks(state.student.className));
  const select=$('spBook');select.replaceChildren();
  const tabs=$('spBookTabs');tabs.replaceChildren();
  if(!state.books.length){
   state.catalogError=true;
   select.append(Object.assign(node('option','수업 교재가 없어요'),{value:''}));
   notify('학생에게 배정된 교재가 없어요.',true);
   refreshStartButton();return;
  }
  const available=[];
  await Promise.all(state.books.map(async book=>{
   try{
    const units=await bounded(getPracticeUnits(book.id),10000);
    if(!units.length)return;
    const items=await bounded(getTextbookSentences(book.id,'',units),12000);
    if(generatePracticeQuestions('make',items,1).length)available.push(book);
   }catch(error){console.warn('[Writing Genius] book preview unavailable',book.title,error)}
  }));
  // Retain original assignment order after asynchronous checks.
  state.books=state.books.filter(book=>available.some(ok=>ok.id===book.id));
  for(const b of state.books){
   select.append(Object.assign(node('option',b.title),{value:b.id}));
   const btn=node('button',b.title);btn.type='button';
   btn.className='vocab-front-book-card sp-book-tab';
   btn.addEventListener('click',()=>{
    select.value=b.id;renderBookTabs();void loadUnits();
   });tabs.append(btn);
  }
  if(!state.books.length){
   state.catalogError=true;notify('연습할 문장이 없어요.',true);refreshStartButton();return;
  }
  renderBookTabs();
  await loadUnits();
 }
 async function loadChecks(session){
  if(!session||session.status==='completed')return;
  try{
   const list=await checksApi('GET','?select=question_index,attempt_no,feedback,answer_text'+
    '&session_id=eq.'+session.id+'&order=question_index.asc,attempt_no.asc');
   if(!Array.isArray(list))return;
   if(!Array.isArray(session.responses))session.responses=[];
   for(const entry of list){
    if(entry.question_index<0||entry.question_index>=session.questions.length)continue;
    const i=entry.question_index;
    if(!session.responses[i])session.responses[i]={
      initial:entry.answer_text,draft:entry.answer_text,revised:entry.answer_text,attempts:0};
    const record=session.responses[i];
    if(!entry.feedback)continue;
    if(!record.firstFeedback)record.firstFeedback=entry.feedback;
    if(Number(entry.attempt_no||1)>=Number(record.attempts||0)){
     record.feedback=entry.feedback;
     record.attempts=Number(entry.attempt_no||1);
    }
   }
  }catch(error){console.warn('[Writing Genius] Could not refresh AI checks',error)}
 }
 async function loadSessions(){
  const list=await api('GET','?select=id,student_id,exercise_type,book_id,book_title,unit_id,questions,responses,current_index,status,practice_day,created_at,updated_at&order=created_at.desc&limit=25');
  if(!Array.isArray(list))throw Error('연습 기록을 불러오지 못했어요.');
  state.recent=list.filter(x=>x.student_id===state.student.id&&x.exercise_type==='make');
  state.today=state.recent.find(x=>x.status==='in_progress')||null;
  if(state.today&&state.today.status!=='completed')await loadChecks(state.today);
  refreshStartButton();
 }
 async function open(student){
  state.student=student;state.active=true;state.loading=true;state.session=null;
  state.catalogError=false;setScreen('picker');saveLabel('');
  $('spStart').disabled=true;notify('오늘의 연습을 불러오는 중…');
  const outcomes=await Promise.allSettled([
   bounded(loadBooks(),15000),bounded(loadSessions(),15000),
   bounded(fetchUnitRewards(),15000),bounded(quotaApi(),15000)
  ]);
  if(outcomes[3].status==='fulfilled')showQuota(outcomes[3].value);
  else txt('spAiQuotaPicker','AI Willi 하루 20회 · 사용량을 불러오지 못했어요.');
  state.loading=false;
  if(outcomes[0].status==='rejected'){
   state.catalogError=true;notify('교재를 불러오지 못했어요. '+outcomes[0].reason?.message,true);
  }else if(outcomes[1].status==='rejected'){
   state.catalogError=true;notify('연습 기록을 불러오지 못했어요. '+outcomes[1].reason?.message,true);
  }
  refreshStartButton();
  // A successful request previously left the initial "loading" message
  // onscreen indefinitely, even though the textbook buttons were ready.
  if(!state.catalogError)notify('');
  if(state.today?.status==='in_progress'){
   state.session=structuredClone(state.today);showRound();
  }
 }
 async function startSession(){
  if(state.loading)return;
  if(state.today?.status==='in_progress'){
   state.session=structuredClone(state.today);showRound();return;
  }
  const book=state.books.find(b=>b.id===field('spBook')),unit=field('spUnit');
  if(!book||!unit||state.catalogError)return;
  state.loading=true;$('spStart').disabled=true;
  notify('선택한 단원의 문장을 가져오는 중…');
  try{
   const items=await bounded(getTextbookSentences(book.id,unit,state.units),18000);
   const count=Math.min(10,items.length);
   const cards=count?generatePracticeQuestions('make',items,count):[];
   if(!cards.length){
    notify('이 단원에는 연습할 수 있는 문장이 없어요. 다른 단원을 선택해 주세요.',true);return;
   }
   const made=await api('POST','',{
    student_id:state.student.id,exercise_type:'make',book_id:book.id,
    book_title:book.title,unit_id:unit,questions:cards,
    responses:[],current_index:0,status:'in_progress'});
   if(!Array.isArray(made)||!made[0])throw Error('연습 시작 기록을 저장하지 못했어요.');
   state.session=made[0];state.today=made[0];state.recent.unshift(made[0]);
   showRound();
  }catch(error){notify('연습을 시작하지 못했어요. '+error.message,true)}
  finally{state.loading=false;refreshStartButton()}
 }
 async function grade(){
  if(state.loading||!state.session)return;
  const answer=state.renderer?.getResponse()?.trim()||'';
  if(answer.length<3||!/[A-Za-z]/.test(answer)){
   notify('영어 문장을 먼저 써 보세요.',true);answerInput()?.focus();return;
  }
  const resp=current();
  if(resp?.feedback?.grade==='correct')return;
  if(resp.feedback&&answer===resp.feedback.checked_text){
   notify('답을 고친 후 다시 확인해 보세요.',true);return;
  }
  if(Number(resp.attempts||0)>=10){notify('이 문장의 확인 횟수를 모두 사용했어요.',true);return}
  state.loading=true;$('spCompareBtn').disabled=true;
  txt('spCompareBtn','AI Willi 확인 중…');notify('');
  state.renderer?.showThinking?.();
  try{
   const i=state.session.current_index;
   const result=await gradeSentence(state.session.id,i,answer);
   state.renderer?.clearThinking?.();
   if(!result?.feedback)throw Error('확인 결과를 받지 못했어요.');
   if(result.quota)showQuota(result.quota);
   playStudentSfx(result.feedback.grade==='correct'||result.feedback.grade==='almost'?'correct':'wrong');
   if(Number(result.feedback.points)>0){
    try{Promise.resolve(showPointAward({amount:result.feedback.points,
     origin:capturePointOrigin($('spCompareBtn'))})).catch(()=>{})}catch{}
   }
   resp.initial ||= answer;resp.draft=answer;resp.revised=answer;
   resp.compared=true;resp.attempts=Number(result.attempt_no||resp.attempts+1);
   if(!resp.firstFeedback)resp.firstFeedback=result.feedback;
   resp.feedback=result.feedback;
   const saved=await persist();
   displayGrade(state.session.questions[i],resp);
   requestAnimationFrame(()=>setTimeout(()=>{
    const el=$('spFeedback');
    if(!el.hidden)el.scrollIntoView({behavior:'smooth',block:'center'});
   },120));
   if(!saved)notify('확인 결과는 저장됐지만 임시 저장을 다시 시도해야 해요.',true);
   else if(result.feedback.grade!=='correct'){
    notify('다시 써 보거나 다음 문장으로 넘어갈 수 있어요. ('+resp.attempts+'/10)');
   }else if(result.cached){
    notify('✓ 교재 문장 또는 저장된 정답에서 바로 확인했어요.');
   }else notify('✓ AI Willi가 정답으로 인정했어요.');
   if(result.quota?.remaining===0)
    notify('오늘 AI Willi 확인 20회를 모두 사용했어요. 다른 Genius 앱을 연습하고 내일 다시 와요!');
  }catch(error){
   state.renderer?.clearThinking?.();
   if(error.quota)showQuota(error.quota);
   notify(error.code==='DAILY_AI_LIMIT'
     ?'오늘 AI Willi 확인 20회를 모두 사용했어요. 다른 Genius 앱을 연습하고 내일 다시 와요!'
     :'다시 확인해 주세요. '+error.message,true);
  }
  finally{
   state.loading=false;
   if(resp)displayGrade(state.session.questions[state.session.current_index],resp);
  }
 }
 async function next(){
  if(state.loading||!state.session)return;
  const session=state.session,resp=current();
  if(!resp?.feedback)return;
  // After one check, the student may retry or move on with no hard block.
  // Preserve the last checked answer if they cleared the editor.
  const value=state.renderer?.getResponse()?.trim()||resp.feedback.checked_text||resp.initial;
  resp.draft=value;resp.revised=value;
  resp.skipped=!masteredAnswer(resp);
  state.loading=true;$('spNextBtn').disabled=true;
  const prev=session.current_index;
  session.current_index=prev+1;
  if(session.current_index===session.questions.length)session.status='completed';
  const saved=await persist();
  if(saved){
   if(state.today?.id===session.id)Object.assign(state.today,structuredClone(session));
   if(session.status==='completed')state.today=null;
   showRound();
  }else{session.current_index=prev;session.status='in_progress'}
  state.loading=false;$('spNextBtn').disabled=false;
 }
 async function goBack(){
  clearTimeout(state.timer);state.timer=null;
  if(state.screen==='round'){
   const resp=current();if(resp)resp.draft=answerValue();
   if(!(await persist()))return;
  }
  if(state.screen!=='picker'){
   state.session=null;setScreen('picker');refreshStartButton();
  }else{state.active=false;await onExit()}
 }
 async function closeForNavigation(){
  clearTimeout(state.timer);state.timer=null;
  if(state.session&&state.screen==='round'){
   const resp=current();if(resp)resp.draft=answerValue();
   if(!(await persist()))return false;
  }
  state.active=false;state.session=null;setScreen('picker');return true;
 }
 $('spBook').addEventListener('change',()=>{void loadUnits()});
 $('spStart').addEventListener('click',()=>{void startSession()});
 $('spRoundBack').addEventListener('click',()=>{void goBack()});
 $('spRoundHome').addEventListener('click',async()=>{
  if(state.loading)return;
  clearTimeout(state.timer);state.timer=null;
  if(state.screen==='round'){
   const resp=current();if(resp)resp.draft=answerValue();
   if(!(await persist()))return;
  }
  state.session=null;state.active=false;setScreen('picker');
  await onExit();
 });
 $('spBack').addEventListener('click',()=>{void goBack()});
 $('spCompareBtn').addEventListener('click',()=>{void grade()});
 $('spRetryBtn').addEventListener('click',()=>{
  if(state.loading||state.screen!=='round')return;
  const response=current();
  if(!response?.feedback||response.feedback.grade==='correct')return;
  const input=answerInput();
  input?.focus();input?.select?.();
  notify('문장을 고치면 다시 확인할 수 있어요. 첫 번째 점수는 유지돼요.');
 });
 $('spNextBtn').addEventListener('click',()=>{void next()});
 $('spFinished').addEventListener('click',()=>{state.session=null;state.active=false;void onExit()});
 preloadStudentSfx();
 singleton={open,closeForNavigation,get active(){return state.active}};
 return singleton;
}
