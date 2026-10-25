// Writing Genius: five source-based Make a Sentence prompts, one KST session/day.
// One bounded AI Willi (Luna) check per question; revision is free. All save to Supabase.
import {getAssignedPracticeBooks,getPracticeUnits,
 getTextbookSentences,generatePracticeQuestions} from './sentence-practice-data.js?v=20261025-make-only-v2';
import {sessionSummary,masteredAnswer,publishGeniusStars} from './sentence-practice-rewards.js?v=20261025-writing-rewards-v1';
const $=id=>document.getElementById(id);
const txt=(id,value)=>{$(id).textContent=String(value??'')};
const field=id=>$(id).value;
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
const seoulDate=()=>{const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',
 {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'})
 .formatToParts(new Date()).map(x=>[x.type,x.value]));return [parts.year,parts.month,parts.day].join('-')};
let singleton=null;
export function createSentencePractice({api,checksApi,gradeSentence,rewardsApi,onExit}){
 if(singleton)return singleton;
 const state={student:null,books:[],units:[],session:null,recent:[],today:null,bookReq:0,
  queue:Promise.resolve(),timer:null,loading:false,active:false,screen:'picker',catalogError:false,
  rewards:new Map(),rewardInflight:new Set()};
 const notify=(message='',error=false)=>{
  txt('spMessage',message);$('spMessage').classList.toggle('is-error',error);
 };
 const saveLabel=message=>txt('spSaveState',message||'');
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
  if(!session||session.current_index>=5)return null;
  const i=session.current_index;
  if(!Array.isArray(session.responses))session.responses=[];
  if(!session.responses[i])session.responses[i]={
   initial:'',draft:'',revised:'',compared:false,hintUsed:true};
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
  resp.draft=field('spAnswer');
  if(resp.feedback)resp.revised=resp.draft;
  clearTimeout(state.timer);
  state.timer=setTimeout(()=>{void persist()},850);
  saveLabel('저장 중…');
  refreshMasteryNote();
 }
 const gradeTitle=grade=>grade==='correct'?'정확해요! · 4점':
  grade==='almost'?'거의 맞았어요! · 2점':'다시 살펴봐요 · 0점';
 function displayGrade(card,resp){
  const result=resp.feedback;
  $('spFeedback').hidden=!result;
  $('spCompare').hidden=!result;
  $('spCompareBtn').hidden=!!result;
  $('spNextBtn').hidden=!result;
  if(!result)return;
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
  if(s.status==='completed'||s.current_index>=5){showDone();return}
  setScreen('round');
  const i=s.current_index,card=s.questions[i],resp=current();
  txt('spModeLabel','문장 만들기');
  txt('spQuestionCount',(i+1)+' / 5');
  $('spProgressBar').style.width=(i/5*100)+'%';
  txt('spUnitName',s.book_title+' · '+(card.unitName||'Unit'));
  txt('spTaskPrompt',card.prompt);
  txt('spTaskDisplay',card.display);
  txt('spTaskDetail',s.questions.some(q=>q.sourceUnitId!==s.unit_id)?
    '같은 교재의 다른 단원도 포함된 연습입니다. 이 세션에서는 골드 유닛을 획득하지 않습니다.':
    '한국어를 읽고 영어 문장을 만들어 보세요.');
  txt('spHint',card.hint||'');
  $('spHint').hidden=false;
  $('spAnswer').value=resp.draft||resp.revised||resp.initial||'';
  $('spAnswer').disabled=false;
  $('spCompareBtn').disabled=false;
  txt('spCompareBtn','AI Willi 확인하기');
  txt('spNextBtn',i===4?'완료하기 ✓':'다음 문장 →');
  displayGrade(card,resp);
  saveLabel('저장됨');
  window.scrollTo({top:0,behavior:'auto'});
 }
 function showDone(){
  setScreen('done');
  const session=state.session;
  if(!session)return;
  const summary=sessionSummary(session);
  const award=state.rewards.get(session.book_id+'|'+session.unit_id);
  txt('spStarsEarned','★'.repeat(summary.stars)+'☆'.repeat(5-summary.stars));
  txt('spScoreSummary',summary.percent+'% · '+summary.stars+'/5 stars · 숙달 '+summary.mastered+'/5'+
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
   '✓ 골드 숙달 완료 · 첫 번째 AI 점수는 그대로 유지돼요.':
   '추천 표현이나 교재 예문처럼 자연스럽게 문장을 고쳐 보세요.');
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
  const btn=$('spStart');
  if(state.today){
   if(state.today.status==='completed'){
    btn.disabled=true;txt('spStart','오늘은 완료했어요 ✓');
    txt('spSourceNote','내일 새 문장 5개를 연습할 수 있어요.');return;
   }
   btn.disabled=false;txt('spStart','오늘의 연습 이어하기 →');
   txt('spSourceNote','오늘 시작한 문장 연습을 이어서 할 수 있어요.');return;
  }
  btn.disabled=state.loading||state.catalogError||!field('spBook')||!field('spUnit');
  txt('spStart','오늘의 문장 5개 시작하기 →');
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
    renderUnitButtons();refreshStartButton();
   });strip.append(b);
  }
 }
 async function loadUnits(){
  const bookId=field('spBook'),serial=++state.bookReq;
  $('spUnit').value='';state.units=[];$('spUnitStrip').replaceChildren();
  refreshStartButton();
  if(!bookId)return;
  try{
   const units=await getPracticeUnits(bookId);
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
  refreshStartButton();
 }
 async function loadBooks(){
  state.books=await getAssignedPracticeBooks(state.student.className);
  const select=$('spBook');select.replaceChildren();
  if(!state.books.length){
   state.catalogError=true;
   select.append(Object.assign(node('option','수업 교재가 없어요'),{value:''}));
   notify('학생에게 배정된 교재가 없어요.',true);
   refreshStartButton();return;
  }
  for(const b of state.books)select.append(Object.assign(node('option',b.title),{value:b.id}));
  await loadUnits();
 }
 async function loadChecks(session){
  if(!session||session.status==='completed')return;
  try{
   const list=await checksApi('GET','?select=question_index,feedback,answer_text&session_id=eq.'+session.id);
   if(!Array.isArray(list))return;
   if(!Array.isArray(session.responses))session.responses=[];
   for(const record of list){
    if(!record?.feedback||record.question_index<0||record.question_index>4)continue;
    if(!session.responses[record.question_index])session.responses[record.question_index]={
      initial:record.answer_text,draft:record.answer_text,revised:record.answer_text};
    session.responses[record.question_index].feedback=record.feedback;
   }
  }catch(error){console.warn('[Writing Genius] Could not refresh AI checks',error)}
 }
 async function loadSessions(){
  const list=await api('GET','?select=id,student_id,exercise_type,book_id,book_title,unit_id,questions,responses,current_index,status,practice_day,created_at,updated_at&order=created_at.desc&limit=25');
  if(!Array.isArray(list))throw Error('연습 기록을 불러오지 못했어요.');
  state.recent=list.filter(x=>x.student_id===state.student.id&&x.exercise_type==='make');
  state.today=state.recent.find(x=>x.practice_day===seoulDate())||null;
  if(state.today&&state.today.status!=='completed')await loadChecks(state.today);
  refreshStartButton();
 }
 async function open(student){
  state.student=student;state.active=true;state.loading=true;state.session=null;
  state.catalogError=false;setScreen('picker');saveLabel('');
  $('spStart').disabled=true;notify('오늘의 연습을 불러오는 중…');
  const outcomes=await Promise.allSettled([loadBooks(),loadSessions(),fetchUnitRewards()]);
  state.loading=false;
  if(outcomes[0].status==='rejected'){
   state.catalogError=true;notify('교재를 불러오지 못했어요. '+outcomes[0].reason?.message,true);
  }else if(outcomes[1].status==='rejected'){
   state.catalogError=true;notify('연습 기록을 불러오지 못했어요. '+outcomes[1].reason?.message,true);
  }
  refreshStartButton();
  if(!state.catalogError&&state.today?.status==='completed'){
   state.session=structuredClone(state.today);showDone();return;
  }
  if(!state.catalogError&&state.today?.status==='in_progress'){
   state.session=structuredClone(state.today);showRound();
  }
 }
 async function startSession(){
  if(state.loading)return;
  if(state.today){
   if(state.today.status==='completed')return;
   state.session=structuredClone(state.today);showRound();return;
  }
  const book=state.books.find(b=>b.id===field('spBook')),unit=field('spUnit');
  if(!book||!unit||state.catalogError)return;
  state.loading=true;$('spStart').disabled=true;
  notify('교재에서 문장 5개를 가져오는 중…');
  try{
   let items=await getTextbookSentences(book.id,unit,state.units);
   let cards=generatePracticeQuestions('make',items);
   if(cards.length!==5){
    items=await getTextbookSentences(book.id,'',state.units);
    cards=generatePracticeQuestions('make',items);
   }
   if(cards.length!==5){
    notify('이 교재에 적합한 문장이 5개 미만이에요. 다른 교재를 골라 주세요.',true);return;
   }
   const payload={student_id:state.student.id,exercise_type:'make',
    book_id:book.id,book_title:book.title,unit_id:unit,
    questions:cards,responses:[],current_index:0,status:'in_progress'};
   const made=await api('POST','',payload);
   if(!Array.isArray(made)||!made[0])throw Error('새 연습을 저장하지 못했어요.');
   state.session=made[0];state.today=made[0];state.recent.unshift(made[0]);
   showRound();
  }catch(error){
   if(error.code==='23505'){
    await loadSessions();
    if(state.today?.status==='in_progress'){state.session=structuredClone(state.today);showRound();return}
    notify('오늘은 이미 연습을 완료했어요.',true);
   }else notify('연습을 시작하지 못했어요. '+error.message,true);
  }finally{state.loading=false;refreshStartButton()}
 }
 async function grade(){
  if(state.loading||!state.session)return;
  const answer=field('spAnswer').trim();
  if(answer.length<3||!/[A-Za-z]/.test(answer)){
   notify('영어 문장을 먼저 써 보세요.',true);$('spAnswer').focus();return;
  }
  const resp=current();if(resp?.feedback){displayGrade(state.session.questions[state.session.current_index],resp);return}
  state.loading=true;$('spCompareBtn').disabled=true;
  txt('spCompareBtn','AI Willi 확인 중…');notify('');
  try{
   const index=state.session.current_index;
   const data=await gradeSentence(state.session.id,index,answer);
   if(!data?.feedback)throw Error('AI 결과가 없어요.');
   if(!resp.initial)resp.initial=answer;
   resp.draft=answer;resp.revised=answer;resp.compared=true;resp.feedback=data.feedback;
   const saved=await persist();
   if(!saved)notify('AI 확인은 완료됐어요. 다음으로 넘어가기 전에 저장을 다시 확인해 주세요.',true);
   displayGrade(state.session.questions[index],resp);
  }catch(error){
   notify('AI Willi 확인에 실패했어요. 다시 눌러 주세요. '+error.message,true);
  }finally{
   state.loading=false;$('spCompareBtn').disabled=false;txt('spCompareBtn','AI Willi 확인하기');
  }
 }
 async function next(){
  if(state.loading||!state.session)return;
  const session=state.session,resp=current();
  if(!resp?.feedback)return;
  resp.draft=field('spAnswer').trim();resp.revised=resp.draft;
  if(resp.revised.length<3){notify('문장을 지우지 말고 고쳐 써 주세요.',true);return}
  if(!masteredAnswer(resp,session.questions[session.current_index])){
   notify('AI 제안 또는 교재 예문을 참고해서 문장을 완성해 주세요.',true);
   $('spAnswer').focus();return;
  }
  state.loading=true;$('spNextBtn').disabled=true;
  const prev=session.current_index;
  session.current_index=prev+1;
  if(session.current_index===5)session.status='completed';
  const saved=await persist();
  if(saved){
   if(state.today?.id===session.id)Object.assign(state.today,structuredClone(session));
   showRound();
  }else{session.current_index=prev;session.status='in_progress'}
  state.loading=false;$('spNextBtn').disabled=false;
 }
 async function goBack(){
  clearTimeout(state.timer);state.timer=null;
  if(state.screen==='round'){
   const resp=current();if(resp)resp.draft=field('spAnswer');
   if(!(await persist()))return;
  }
  if(state.screen!=='picker'){
   state.session=null;setScreen('picker');refreshStartButton();
  }else{state.active=false;await onExit()}
 }
 async function closeForNavigation(){
  clearTimeout(state.timer);state.timer=null;
  if(state.session&&state.screen==='round'){
   const resp=current();if(resp)resp.draft=field('spAnswer');
   if(!(await persist()))return false;
  }
  state.active=false;state.session=null;setScreen('picker');return true;
 }
 $('spBook').addEventListener('change',()=>{void loadUnits()});
 $('spStart').addEventListener('click',()=>{void startSession()});
 $('spBack').addEventListener('click',()=>{void goBack()});
 $('spAnswer').addEventListener('input',changed);
 $('spCompareBtn').addEventListener('click',()=>{void grade()});
 $('spNextBtn').addEventListener('click',()=>{void next()});
 $('spFinished').addEventListener('click',()=>{state.session=null;state.active=false;void onExit()});
 singleton={open,closeForNavigation,get active(){return state.active}};
 return singleton;
}
