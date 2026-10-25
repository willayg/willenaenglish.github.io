// Writing Genius sentence practice: no AI calls, no exact-answer grading.
// Exercises draw only from assigned textbook content, with optional hints and
// one possible model sentence. Five-question sessions are saved to Supabase.
import {EXERCISE_LABELS,getAssignedPracticeBooks,getPracticeUnits,
 getTextbookSentences,generatePracticeQuestions} from './sentence-practice-data.js?v=20261025-sp-v1';

const $=id=>document.getElementById(id);
const txt=(id,value)=>{$(id).textContent=String(value??'')};
const kinds=new Set(Object.keys(EXERCISE_LABELS));
const field=id=>$(id).value;
const el=(name,cls,value)=>{const n=document.createElement(name);if(cls)n.className=cls;if(value!==undefined)n.textContent=value;return n};
const rows=val=>Array.isArray(val)?val:[];
const LABEL_SAVE='저장됨';
let singleton=null;
export function createSentencePractice({api,onExit}){
 if(singleton)return singleton;
 const state={student:null,bookList:[],units:[],kind:'make',session:null,
  recent:[],timer:null,queue:Promise.resolve(),revision:0,loading:false,saving:false,
  active:false,screen:'picker'};
 const msg=(value='',error=false)=>{txt('spMessage',value);$('spMessage').classList.toggle('is-error',error)};
 const saveLabel=(value='')=>txt('spSaveState',value);
 const setScreen=name=>{
  state.screen=name;
  $('spPicker').hidden=name!=='picker';
  $('spRound').hidden=name!=='round';
  $('spDone').hidden=name!=='done';
  $('spBack').textContent=name==='picker'?'← 글쓰기 메뉴':'← 연습 선택';
  msg('');
 };
 function selectKind(kind){
  if(!kinds.has(kind))return;
  state.kind=kind;
  document.querySelectorAll('[data-practice-kind]').forEach(b=>{
   const active=b.dataset.practiceKind===kind;b.setAttribute('aria-pressed',String(active));
   b.classList.toggle('is-selected',active);
  });
 }
 async function persist(){
  const session=state.session;if(!session)return true;
  clearTimeout(state.timer);state.timer=null;
  const snapshot={responses:structuredClone(session.responses||[]),
   current_index:session.current_index,status:session.status};
  const id=session.id;
  const run=async()=>api('PATCH','?id=eq.'+encodeURIComponent(id),snapshot);
  state.queue=state.queue.catch(()=>{}).then(run);
  saveLabel('저장 중…');
  try{
   const updated=await state.queue;
   if(!Array.isArray(updated)||!updated.length)throw Error('저장된 연습을 확인할 수 없어요.');
   if(state.session?.id===id)saveLabel(LABEL_SAVE);
   return true;
  }catch(error){
   if(state.session?.id===id){saveLabel('저장 안 됨');msg('연습 저장에 실패했어요. 다시 눌러 주세요. '+error.message,true)}
   return false;
  }
 }
 function currentResponse(){
  if(!state.session)return null;
  const index=state.session.current_index,all=state.session.responses;
  if(!all[index])all[index]={initial:'',draft:'',revised:'',compared:false,hintUsed:false};
  return all[index];
 }
 function queueDraftSave(){
  if(!state.session||state.session.status==='completed'||state.screen!=='round')return;
  const answer=currentResponse();
  answer.draft=field('spAnswer');
  if(answer.compared)answer.revised=answer.draft;
  clearTimeout(state.timer);
  state.timer=setTimeout(()=>{void persist()},900);
  saveLabel('저장 전…');
 }
 function revealReference(card,response){
  $('spCompare').hidden=!response.compared;
  txt('spModel',card.model);
  txt('spComparisonNote',card.help||'교재 예문과 내 문장을 비교해 보세요.');
  $('spNextBtn').hidden=!response.compared;
  $('spCompareBtn').hidden=response.compared;
 }
 function showRound(){
  const session=state.session;
  if(!session)return;
  if(session.status==='completed'||session.current_index>=5){setScreen('done');return}
  setScreen('round');
  const index=session.current_index,card=session.questions[index],resp=currentResponse();
  txt('spModeLabel',EXERCISE_LABELS[session.exercise_type]);
  txt('spQuestionCount',(index+1)+' / 5');
  $('spProgressBar').style.width=(index/5*100)+'%';
  txt('spUnitName',session.book_title+' · '+card.unitName);
  txt('spTaskPrompt',card.prompt);
  txt('spTaskDisplay',card.display);
  txt('spTaskDetail',card.detail);
  $('spAnswer').value=resp.draft||resp.revised||resp.initial||'';
  $('spAnswer').disabled=false;
  $('spHint').hidden=!resp.hintUsed;
  txt('spHint',card.hint);
  revealReference(card,resp);
  txt('spNextBtn',index===4?'연습 끝내기 ✓':'다음 문제 →');
  saveLabel('저장됨');
  window.scrollTo({top:0,behavior:'auto'});
 }
 function showSessions(){
  const box=$('spSaved'),list=$('spSessionList');
  list.replaceChildren();
  box.hidden=state.recent.length===0;
  for(const session of state.recent){
   const b=el('button','sp-history');b.type='button';
   const left=el('span','');
   left.append(el('strong','',EXERCISE_LABELS[session.exercise_type]||'문장 연습'),
    el('small','',session.book_title||'Textbook'));
   const right=el('span','sp-history-tag',session.status==='completed'?'완료 ✓':'이어하기 · '+(Math.min(5,session.current_index+1))+'/5');
   b.append(left,right);
   b.addEventListener('click',()=>{state.session=structuredClone(session);showRound()});
   list.append(b);
  }
 }
 async function loadSessions(){
  const data=await api('GET','?select=id,student_id,exercise_type,book_id,book_title,unit_id,questions,responses,current_index,status,created_at,updated_at&order=updated_at.desc&limit=12');
  state.recent=rows(data).filter(s=>s.student_id===state.student.id);
  showSessions();
 }
 async function setBooks(){
  const books=await getAssignedPracticeBooks(state.student.className);
  state.bookList=books;
  const select=$('spBook');select.replaceChildren();
  if(!books.length){
   const option=el('option','','등록된 교재가 없어요');option.value='';select.append(option);
   $('spStart').disabled=true;
   msg('수업 교재를 찾지 못했어요. 선생님에게 교재 등록을 요청해 주세요.',true);
   return;
  }
  for(const b of books){const option=el('option','',b.title);option.value=b.id;select.append(option)}
  await setUnits();
 }
 async function setUnits(){
  const bookId=field('spBook');
  const select=$('spUnit');select.replaceChildren();
  const option=el('option','','전체 단원 · All units');option.value='';select.append(option);
  if(!bookId){state.units=[];$('spStart').disabled=true;return}
  try{
   const units=await getPracticeUnits(bookId);
   if(state.bookList.some(b=>b.id===bookId)){
    state.units=units;
    for(const u of units){const o=el('option','',u.number+' · '+u.title);o.value=u.id;select.append(o)}
    $('spStart').disabled=false;
    txt('spSourceNote','교재 문장을 사용해 나만의 영어를 만들어 보세요.');
   }
  }catch(err){state.units=[];$('spStart').disabled=true;msg('단원을 불러오지 못했어요: '+err.message,true)}
 }
 async function open(student){
  state.student=student;state.active=true;state.session=null;state.loading=true;
  setScreen('picker');
  $('spStart').disabled=true;saveLabel('');
  msg('교재와 연습 기록을 불러오는 중…');
  const results=await Promise.allSettled([setBooks(),loadSessions()]);
  if(results[0].status==='rejected'){
   $('spStart').disabled=true;
   msg('교재를 불러오지 못했어요. '+results[0].reason?.message,true);
  }else if(results[1].status==='rejected'){
   msg('지난 연습을 불러오지 못했어요. '+results[1].reason?.message,true);
  }else msg('');
  state.loading=false;
 }
 async function startSession(){
  if(state.loading||!state.student||!field('spBook'))return;
  const book=state.bookList.find(b=>b.id===field('spBook'));if(!book)return;
  state.loading=true;$('spStart').disabled=true;saveLabel('');
  msg('교재에서 문장 5개를 고르는 중…');
  try{
   const candidates=await getTextbookSentences(book.id,field('spUnit'),state.units);
   let cards=generatePracticeQuestions(state.kind,candidates);
   // If a unit cannot supply five distinct prompts, fill the session from
   // other units of the SAME assigned textbook rather than from unrelated
   // books. The on-screen source label always identifies the actual unit.
   if(cards.length!==5&&field('spUnit')){
    const all=await getTextbookSentences(book.id,'',state.units);
    cards=generatePracticeQuestions(state.kind,all);
    if(cards.length===5)txt('spSourceNote','이 단원에는 예문이 적어 같은 교재의 다른 단원도 포함했어요.');
   }
   if(cards.length!==5){
    msg('이 교재/단원에는 이 유형에 적합한 문장이 5개 미만이에요. 전체 단원이나 다른 유형을 선택해 주세요.',true);
    return;
   }
   const payload={id:crypto.randomUUID(),student_id:state.student.id,
    exercise_type:state.kind,book_id:book.id,book_title:book.title,
    unit_id:field('spUnit')||null,questions:cards,responses:[],current_index:0,status:'in_progress'};
   const created=await api('POST','',payload);
   if(!Array.isArray(created)||!created[0])throw Error('연습 저장에 실패했어요.');
   state.session=created[0];
   state.recent=[state.session,...state.recent].slice(0,12);
   showRound();
  }catch(err){msg('연습을 시작하지 못했어요. '+err.message,true)}
  finally{state.loading=false;$('spStart').disabled=!field('spBook')}
 }
 async function compare(){
  const response=currentResponse();if(!response||state.loading)return;
  const answer=field('spAnswer').trim();
  if(answer.length<3||!/[A-Za-z]/.test(answer)){msg('영어 문장을 먼저 써 보세요.',true);$('spAnswer').focus();return}
  if(!response.initial)response.initial=answer;
  response.draft=answer;response.revised=answer;response.compared=true;
  revealReference(state.session.questions[state.session.current_index],response);
  msg('교재 예문은 한 가지 답이에요. 내 문장을 고친 뒤 다음 문제로 넘어가세요.');
  void persist();
 }
 async function next(){
  const session=state.session;if(!session||state.loading)return;
  const response=currentResponse();
  if(!response?.compared)return;
  response.revised=field('spAnswer').trim();
  response.draft=response.revised;
  if(!response.revised){msg('고친 문장을 남겨 주세요.',true);return}
  state.loading=true;$('spNextBtn').disabled=true;
  const old=session.current_index;
  session.current_index=old+1;
  session.status=session.current_index===5?'completed':'in_progress';
  const okay=await persist();
  if(okay){
   const recent=state.recent.find(r=>r.id===session.id);
   if(recent)Object.assign(recent,structuredClone(session));
   if(session.status==='completed')showSessions();
   showRound();
  }else{session.current_index=old;session.status='in_progress'}
  state.loading=false;$('spNextBtn').disabled=false;
 }
 async function goBack(){
  clearTimeout(state.timer);state.timer=null;
  if(state.screen==='round'){
   const current=currentResponse();if(current)current.draft=field('spAnswer');
   const okay=await persist();if(!okay)return;
  }
  if(state.screen!=='picker'){
   setScreen('picker');
   try{await loadSessions()}catch(err){msg(err.message,true)}
  }else{
   state.active=false;state.session=null;await onExit();
  }
 }
 async function closeForNavigation(){
  clearTimeout(state.timer);state.timer=null;
  if(state.session&&state.screen==='round'){
   currentResponse().draft=field('spAnswer');
   const okay=await persist();if(!okay)return false;
  }
  state.active=false;state.session=null;setScreen('picker');
  return true;
 }
 // Do not let a delayed editor save clobber another session.
 document.querySelectorAll('[data-practice-kind]').forEach(button=>
  button.addEventListener('click',()=>selectKind(button.dataset.practiceKind)));
 $('spBook').addEventListener('change',()=>{void setUnits()});
 $('spStart').addEventListener('click',()=>void startSession());
 $('spBack').addEventListener('click',()=>void goBack());
 $('spAnswer').addEventListener('input',queueDraftSave);
 $('spHintBtn').addEventListener('click',()=>{
  const resp=currentResponse();if(!resp)return;
  resp.hintUsed=true;$('spHint').hidden=false;
  txt('spHint',state.session.questions[state.session.current_index].hint);
  queueDraftSave();
 });
 $('spCompareBtn').addEventListener('click',()=>void compare());
 $('spNextBtn').addEventListener('click',()=>void next());
 $('spAgain').addEventListener('click',()=>{state.session=null;setScreen('picker');void loadSessions()});
 $('spFinished').addEventListener('click',()=>{state.session=null;state.active=false;void onExit()});
 selectKind('make');
 singleton={open,closeForNavigation,get active(){return state.active},get student(){return state.student}};
 return singleton;
}
