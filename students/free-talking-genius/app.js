// Free Talking Genius: real textbook questions, student-owned attempts and AI Willi.
// Reuses Word Genius's question renderer, reward display, header, finish and session UI.
// No dashboard registration and no changes to Writing Genius.
import {studentIdentity,signedInProfile} from '/students/sentence-genius/content.js?v=20261024-wg-auth1';
import {contentDbGet} from '/students/shared/content-db.js?v=1.0.0';
import {QuestionRenderer} from '/shared/questions/question-renderer.js?v=20261023-speaking-ai1';
import {renderStudentSessionFinish} from '/students/components/student-session-finish.js?v=1';
import {playStudentSfx} from '/students/shared/student-sfx.js?v=20260927-startup2';
import {capturePointOrigin,showPointAward} from '/students/components/student-point-feedback.js';
import {geniusSessionContext} from '/students/components/genius-session-context.js?v=20261104-a';
import {createFreeTalkingVoice} from './question-voice.js?v=20261105-r2fix2';
const API='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const BOOK='8e949813-fa91-4adc-a709-905efc980d8b';
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const state={student:null,profile:null,questions:[],unit:1,mode:null,sessions:[],attempts:[],session:null,renderer:null,
 current:null,cursor:0,feedback:null,loading:false,finishing:false,identity:null,awards:new Set()};
const groups=()=>state.questions.filter(x=>Number(x.unit_number)===state.unit).sort((a,b)=>a.question_number-b.question_number);
const questionVoice=createFreeTalkingVoice({host:$('ftWilliVoice'),getToken:token});
function showError(message){$('ftError').textContent=message||'Unknown error';$('ftError').hidden=false;console.error('[Free Talking]',message)}
function clearError(){$('ftError').hidden=true;$('ftError').textContent=''}
function view(which){if(which!=='ftSession')questionVoice.stop();for(const id of ['ftHome','ftBook','ftSession','ftFinish'])$(id).hidden=id!==which;clearError();window.scrollTo({top:0,behavior:'instant'})}
async function token(refresh=false){
 const existing=window.WillenaAPI?.getLocalAccessToken?.();
 if(existing&&!refresh)return existing;
 const fn=window.WillenaAPI?.fetch?window.WillenaAPI.fetch.bind(window.WillenaAPI):fetch;
 const res=await fn('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now(),{credentials:'include',cache:'no-store'});
 const d=await res.json().catch(()=>null);
 if(!res.ok||!d?.access_token)throw Error('로그인이 만료됐어요. 다시 로그인해 주세요.');
 window.WillenaAPI?.setLocalTokens?.(d.access_token,d.refresh_token||'');
 return d.access_token;
}
async function api(table,{method='GET',body=null,params=''}={}){
 const call=async access=>fetch(API+table+params,{method,cache:'no-store',
  headers:{apikey:KEY,Authorization:'Bearer '+access,...(body===null?{}:{'Content-Type':'application/json',Prefer:'return=representation'})},
  ...(body===null?{}:{body:JSON.stringify(body)})});
 let response=await call(await token());
 if(response.status===401)response=await call(await token(true));
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw Error(data?.message||data?.error||'Database request failed ('+response.status+')');
 return data;
}
async function stableRewardUuid(value){
 if(!globalThis.crypto?.subtle)throw Error('Secure reward ID unavailable in this browser');
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
 const b=bytes.slice(0,16);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
 return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20,32)].join('-');
}
async function syncQuestionReward(question,bestPoints){
 const pts=Math.max(0,Math.min(4,Number(bestPoints)||0));
 if(!pts)return;
 const rewardId=await stableRewardUuid('free-talking-question-v1|'+state.student.id+'|'+state.mode+'|'+question.id);
 const payload={reward_only:true,session_id:rewardId,client_attempt_id:rewardId,
  book_id:BOOK,unit_id:question.unit_id,
  reward_mode:'free_talking_'+state.mode+'_question',
  reward_list_name:'Free Talking Genius · Unit '+state.unit+' · '+state.mode+' · Q'+question.question_number,
  reward_list_size:1,reward_started_at:state.session?.created_at||new Date().toISOString(),
  reward_summary:{completed:true,stars:0,percent:pts*25,accuracy:pts/4,score:pts,total:4,
   points_earned:pts,book_id:BOOK,unit_id:question.unit_id,
   free_talking_question_id:question.id,free_talking_mode:state.mode,
   reward_scheme:'free-talking-question-v1',session_source:'student'}};
 const fn=window.WillenaAPI?.fetch?window.WillenaAPI.fetch.bind(window.WillenaAPI):fetch;
 const response=await fn('/.netlify/functions/progress_summary?section=study_attempt&_='+Date.now(),{
  method:'POST',credentials:'include',cache:'no-store',
  headers:{'Content-Type':'application/json'},body:JSON.stringify({payload})});
 const result=await response.json().catch(()=>null);
 if(!response.ok||result?.success!==true)throw Error(result?.error||'Question points could not be confirmed');
 state.awards.add(state.mode+':'+question.id);
}
async function syncPendingQuestionRewards(){
 for(const question of groups()){
  const best=bestUnitPoints(state.unit,state.mode,question.id);
  if(best>0&&!state.awards.has(state.mode+':'+question.id))await syncQuestionReward(question,best);
 }
}
const pct=x=>Math.max(0,Math.min(100,Math.round(Number(x)||0)));
function attemptsFor(sessionId,questionId){
 return state.attempts.filter(a=>a.session_id===sessionId&&a.question_id===questionId)
  .sort((a,b)=>a.attempt_no-b.attempt_no);
}
function questionBest(sessionId,id){return Math.max(0,...attemptsFor(sessionId,id).map(a=>Number(a.grammar_points)+Number(a.quality_points)))}
function bestUnitPoints(unit,mode,questionId){
 const ids=new Set(state.sessions.filter(s=>s.book_id===BOOK&&s.unit_number===unit&&s.mode===mode).map(s=>s.id));
 return Math.max(0,...state.attempts.filter(a=>ids.has(a.session_id)&&a.question_id===questionId)
  .map(a=>Number(a.grammar_points)+Number(a.quality_points)));
}
function masteryCount(unit,mode){
 const prompts=state.questions.filter(x=>Number(x.unit_number)===unit);
 return prompts.filter(q=>bestUnitPoints(unit,mode,q.id)===4).length;
}
function unitGold(unit){return masteryCount(unit,'speaking')===8&&masteryCount(unit,'writing')===8}
async function refreshData(){
 const list=await api('free_talking_sessions',{params:'?select=*&student_id=eq.'+state.student.id+'&book_id=eq.'+BOOK+'&order=created_at.desc&limit=200'});
 state.sessions=Array.isArray(list)?list:[];
 const ids=state.sessions.map(s=>s.id);
 state.attempts=ids.length?await api('free_talking_attempts',{params:'?select=*&session_id=in.('+ids.join(',')+')&order=created_at.asc&limit=2000'}):[];
}
async function loadQuestions(){
 const path='/rest/v1/free_talking_questions?select=id,unit_id,unit_number,question_number,question_en,question_ko,grammar_focus&book_id=eq.'+BOOK+'&is_published=eq.true&order=unit_number.asc,question_number.asc&limit=100';
 const list=await contentDbGet(path);
 if(!Array.isArray(list)||list.length!==64)throw Error('Oxford Buzz 6 question bank is incomplete: expected 64 published prompts.');
 for(let n=1;n<=8;n++)if(list.filter(row=>Number(row.unit_number)===n).length!==8)throw Error('Unit '+n+' is missing questions.');
 state.questions=list;
}
function renderUnitStrip(){
 const host=$('ftUnitStrip');host.replaceChildren();
 for(let n=1;n<=8;n++){
  const button=document.createElement('button');
  button.type='button';button.className=(n===state.unit?'is-current ':'')+(unitGold(n)?'is-golden':'');
  button.textContent='Unit '+n;
  if(unitGold(n)){const img=document.createElement('img');img.src='/shared/svgs/golden-unit.svg';img.alt='Gold';button.append(img)}
  button.addEventListener('click',()=>selectUnit(n));host.append(button);
 }
}
function renderBook(){
 renderUnitStrip();
 const prompts=groups();$('ftUnitTitle').textContent='Unit '+state.unit+' · '+({
  1:'Travel in the City',2:'The Seasons',3:'The Environment',4:'A Trip to the Theater',
  5:'World Food',6:"Let's Connect",7:'In the Country',8:'A Journey to Space'})[state.unit];
 $('ftUnitFocus').textContent=prompts[0]?.grammar_focus?'Grammar opportunity · '+prompts[0].grammar_focus:'';
 for(const mode of ['speaking','writing']){
  const count=masteryCount(state.unit,mode),card=$('ft'+(mode==='speaking'?'Speaking':'Writing')+'Card');
  const percent=pct(count/8*100);
  card.querySelector('.vocab-skill-ring').style.setProperty('--progress',percent);
  card.querySelector('.vocab-skill-ring span').textContent=percent+'%';
  card.querySelector('.vocab-card-stars').textContent=count+'/8 mastered';
 }
}
function selectUnit(n){state.unit=n;renderBook();view('ftBook');}
function setBusy(value){
 state.loading=!!value;
 $('ftSubmit').disabled=value||!validAnswer();
 $('ftSkip').disabled=value;$('ftRetry').disabled=value;$('ftNext').disabled=value;
}
function validAnswer(){
 if(!state.current)return false;
 const typed=state.mode==='speaking'?$('ftTranscriptEdit').value.trim():state.renderer?.getResponse()?.trim();
 return typed?.length>=3&&/[a-z]/i.test(typed);
}
function captureAnswer(){
 return state.mode==='speaking'?$('ftTranscriptEdit').value.trim():state.renderer?.getResponse()?.trim()||'';
}
function markFeedback(attempt){
 if(!attempt)return;
 $('ftFeedback').hidden=false;
 const grammar=Number(attempt.grammar_points),quality=Number(attempt.quality_points),sum=grammar+quality;
 $('ftFeedbackTitle').textContent=sum===4?'잘했어요! · 4/4 points':sum>=2?'좋아요! 조금만 고쳐 봐요. · '+sum+'/4':'한 번 더 도전해 봐요. · '+sum+'/4';
 $('ftGrammarScore').textContent=grammar+'/2';
 $('ftQualityScore').textContent=quality+'/2';
 $('ftGrammarFeedback').textContent=attempt.grammar_feedback_ko||'';
 $('ftQualityFeedback').textContent=attempt.quality_feedback_ko||'';
 $('ftCorrection').textContent=attempt.correction||attempt.answer_text||'';
 $('ftRetry').hidden=sum===4||attemptsFor(state.session.id,state.current.id).length>=5;
 $('ftNext').hidden=false;
 $('ftSubmit').hidden=true;
 $('ftSkip').hidden=true;
 $('ftAttemptStatus').textContent=sum===4?'이 질문은 숙달했어요. 다음 질문으로 넘어가요.':
 '다시 답하면 점수를 올릴 수 있어요. 바로 다음 질문으로 가도 괜찮아요.';
}
function questionIndexAfter(start=0){
 const questions=groups();
 // Every saved first answer counts as finished. Improving to 4/4 is optional.
 for(let i=0;i<questions.length;i++){
  const index=(start+i)%questions.length,q=questions[index];
  if(attemptsFor(state.session.id,q.id).length===0)return index;
 }
 return -1;
}
function renderQuestion({retry=false}={}){
 const questions=groups();
 if(!state.session||!questions.length)return;
 const sameQuestion=retry&&state.current&&attemptsFor(state.session.id,state.current.id).length<5&&questionBest(state.session.id,state.current.id)<4;
 const idx=sameQuestion?questions.findIndex(q=>q.id===state.current.id):questionIndexAfter(state.cursor);
 if(idx<0){void conclude();return}
 state.cursor=idx;state.current=questions[idx];state.feedback=null;
 $('ftFeedback').hidden=true;$('ftSubmit').hidden=false;$('ftNext').hidden=true;$('ftRetry').hidden=true;$('ftSkip').hidden=false;
 $('ftAttemptStatus').textContent=retry?'답을 더 자연스럽게 고쳐서 다시 시도해 보세요.':'자신의 생각으로 자유롭게 답해 보세요.';
 $('ftPromptLabel').textContent='QUESTION '+(idx+1);
 const answered=questions.filter(q=>attemptsFor(state.session.id,q.id).length>0).length;
 $('ftSessionProgress').textContent=answered+'/8 answered';
 $('ftProgressFill').style.width=pct(answered/8*100)+'%';
 $('ftSessionTitle').textContent=(state.mode==='speaking'?'Speaking':'Writing')+' · Unit '+state.unit;
 try{state.renderer?.speechRecognition?.stop?.()}catch{}
 state.renderer=new QuestionRenderer($('ftQuestionHost'));
 const form=state.mode==='speaking'?'speaking':'write';
 state.renderer.render({form,prompt:state.current.question_en,context:{korean:state.current.question_ko},answer:[],
  ...(form==='write'?{hints:{placeholder:'Write your own English answer...'}}:{})},{
  onChange:()=>{
   if(state.mode==='speaking'){
    const heard=String(state.renderer?.getResponse()||'').trim();
    if(heard)$('ftTranscriptEdit').value=heard;
   }
   $('ftSubmit').disabled=state.loading||!validAnswer();
  }
 });
 $('ftTranscriptRow').hidden=state.mode!=='speaking';
 $('ftTranscriptEdit').value='';
 if(state.mode==='speaking'){
  const supported=Boolean(window.SpeechRecognition||window.webkitSpeechRecognition);
  const status=$('ftQuestionHost').querySelector('[data-speaking-status]');
  if(!supported&&status)status.textContent='이 브라우저에서는 마이크 입력이 지원되지 않아요. 아래에 직접 영어로 입력할 수 있어요.';
  $('ftTranscriptEdit').placeholder=supported
   ?'마이크가 잘못 들었다면 영어 문장을 수정하거나 직접 입력하세요.'
   :'여기에 영어 답변을 직접 입력하세요.';
 }
 $('ftSubmit').disabled=true;
 // A restored unfinished question shows its previously saved guidance.
 const previous=attemptsFor(state.session.id,state.current.id);
 if(previous.length)$('ftAttemptStatus').textContent='이전에 '+previous.length+'번 답했어요. 더 좋은 답으로 다시 도전해 보세요.';
 view('ftSession');
 void questionVoice.select(state.current.id,{autoplay:!retry});
}
async function openMode(mode){
 if(state.loading)return;
 if(!['speaking','writing'].includes(mode))return;
 state.mode=mode;state.identity=geniusSessionContext({bookId:BOOK,unitId:groups()[0]?.unit_id,mode});
 setBusy(true);
 try{
  await refreshData();
  let session=state.sessions.find(s=>s.book_id===BOOK&&s.unit_number===state.unit&&s.mode===mode&&s.status==='in_progress');
  if(session){
   // Keep unfinished sessions, even if eight answers are already present:
   // renderQuestion will safely finalize the session rather than orphaning it.
   const hasUnanswered=groups().some(q=>attemptsFor(session.id,q.id).length===0);
   if(!hasUnanswered)state.cursor=0;
  }
  if(!session){
   const created=await api('free_talking_sessions',{method:'POST',body:{
    student_id:state.student.id,book_id:BOOK,unit_id:groups()[0].unit_id,unit_number:state.unit,mode,status:'in_progress'}});
   session=created?.[0];
   if(!session?.id)throw Error('Cannot create a new study session.');
   state.sessions.unshift(session);
  }
  state.session=session;state.cursor=0;
  renderQuestion();
 }catch(error){showError('세션을 시작할 수 없어요. '+error.message)}
 finally{setBusy(false)}
}
async function submit(){
 if(state.loading||!state.current||!validAnswer())return;
 const answer=captureAnswer(),question=state.current;
 setBusy(true);$('ftAttemptStatus').textContent='AI Willi가 문법과 답변 내용을 확인하는 중…';
 try{
  const run=async access=>fetch('/api/free-talking-grade',{
   method:'POST',credentials:'include',cache:'no-store',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},
   body:JSON.stringify({session_id:state.session.id,question_id:question.id,answer}),signal:AbortSignal.timeout(36000)});
  let response=await run(await token());
  if(response.status===401)response=await run(await token(true));
  const payload=await response.json().catch(()=>null);
  if(!response.ok||payload?.success!==true)throw Error(payload?.error||'AI feedback request failed');
  const attempt=payload.attempt;
  if(!attempt?.id)throw Error('Feedback was not confirmed as saved');
  const prior=bestUnitPoints(state.unit,state.mode,question.id);
  if(!state.attempts.some(row=>row.id===attempt.id))state.attempts.push(attempt);
  state.feedback=attempt;markFeedback(attempt);
  const best=bestUnitPoints(state.unit,state.mode,question.id);
  try{
   if(best>0)await syncQuestionReward(question,best);
   const gained=Math.max(0,best-prior);
   if(gained>0)void showPointAward({amount:gained,origin:capturePointOrigin($('ftSubmit'))}).catch(()=>{});
  }catch(pointError){
   state.awards.delete(state.mode+':'+question.id);
   $('ftAttemptStatus').textContent='답변과 점수는 저장됐지만 포인트 동기화가 필요해요: '+pointError.message;
  }
  playStudentSfx(Number(attempt.grammar_points)+Number(attempt.quality_points)===4?'correct':'wrong');
  const answered=groups().filter(q=>attemptsFor(state.session.id,q.id).length>0).length;
  $('ftSessionProgress').textContent=answered+'/8 answered';
  $('ftProgressFill').style.width=pct(answered/8*100)+'%';
 }catch(error){$('ftAttemptStatus').textContent='저장하지 못했어요. '+error.message;console.warn('[Free Talking] grade',error)}
 finally{setBusy(false)}
}
async function conclude(){
 if(!state.session||state.finishing)return;
 state.finishing=true;
 try{
  const data=await api('rpc/free_talking_finish_v1',{method:'POST',body:{p_session_id:state.session.id}});
  if(data?.completed){
   Object.assign(state.session,{status:'completed',reward_points:data.points,reward_stars:data.stars,
    first_try_percent:data.percent,reward_synced:data.reward_synced});
   await renderFinish(data);
  }else{
   view('ftFinish');
   $('ftFinishContent').innerHTML=renderStudentSessionFinish({title:'아직 답하지 않은 질문이 있어요.',
     description:'완료하려면 여덟 질문에 한 번씩 답해 주세요. 4/4 만점은 선택 사항이에요.',
     stats:[{label:'Answered',value:groups().filter(q=>attemptsFor(state.session.id,q.id).length>0).length+'/8'},{label:'Mastered',value:(data?.mastered||0)+'/8'}]});
   $('ftFinishStatus').textContent='지금까지의 답변은 모두 저장되어 있어요.';
   $('ftRetrySync').hidden=true;
  }
 }catch(error){showError('완료 상태를 저장하지 못했어요. '+error.message)}
 finally{state.finishing=false}
}
async function rewardSync(data){
 await syncPendingQuestionRewards();
 if(data?.reward_synced)return true;
 if(Number(data.points)===0&&Number(data.stars)===0){
  const ok=await api('rpc/free_talking_reward_synced_v1',{method:'POST',body:{p_session_id:state.session.id}});
  return ok===true;
 }
 const unit='Buzz 6 · Unit '+state.unit,mode=state.mode;
 const payload={reward_only:true,session_id:state.session.id,client_attempt_id:state.session.id,
   book_id:BOOK,unit_id:groups()[0].unit_id,
   skill:mode==='speaking'?'speaking':'writing_sentence',response_type:'reward',
   activity_id:'free-talking-genius-reward',reward_mode:'free_talking_'+mode,
   reward_list_name:'Free Talking Genius · '+unit+' · '+mode,
   reward_list_size:8,reward_started_at:state.session.created_at,
   reward_summary:{completed:true,stars:Number(data.stars)||0,percent:Number(data.percent)||0,
    accuracy:(Number(data.percent)||0)/100,score:Number(data.percent)||0,total:100,
    points_earned:0,book_id:BOOK,unit_id:groups()[0].unit_id,
    reward_scheme:'free-talking-v1',star_cap:5,session_source:'student',free_talking_mode:mode}};
 const fn=window.WillenaAPI?.fetch?window.WillenaAPI.fetch.bind(window.WillenaAPI):fetch;
 const response=await fn('/.netlify/functions/progress_summary?section=study_attempt&_='+Date.now(),{
  method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload})});
 const result=await response.json().catch(()=>null);
 if(!response.ok||result?.error||result?.success!==true)throw Error(result?.error||'Could not confirm Willena rewards');
 const synced=await api('rpc/free_talking_reward_synced_v1',{method:'POST',body:{p_session_id:state.session.id}});
 if(synced!==true)throw Error('Reward record saved, confirmation pending');
 state.session.reward_synced=true;
 window.dispatchEvent(new CustomEvent('stars:refresh',{detail:{earned:Number(data.stars)||0}}));
 return true;
}
async function renderFinish(data){
 view('ftFinish');
 const scores={percent:Number(data.percent)||0,stars:Number(data.stars)||0,points:Number(data.points)||0};
 const reward='<student-reward-celebration percent="'+pct(scores.percent)+'" stars="'+scores.stars+
  '" star-max="5" points="'+scores.points+'" label="FREE TALKING REWARD"></student-reward-celebration>';
 $('ftFinishContent').innerHTML=renderStudentSessionFinish({title:'잘했어요! · Unit '+state.unit+' complete',
  description:'8개 질문의 답변과 AI 피드백을 저장했어요. 만점이 아니어도 활동을 마칠 수 있어요.',
  stats:[{label:'First-try accuracy',value:pct(scores.percent)+'%'},
   {label:'Stars',value:scores.stars+'/5'},{label:'Points',value:scores.points}],
  rewardHtml:reward});
 $('ftRetrySync').hidden=true;
 $('ftFinishStatus').textContent='진행 상황이 저장됐어요. 별과 포인트를 연결하는 중…';
 try{await rewardSync(data);$('ftFinishStatus').textContent='별과 포인트까지 저장했어요.'}
 catch(error){$('ftFinishStatus').textContent='답변은 저장됐지만 별/포인트 동기화가 필요해요: '+error.message;
 $('ftRetrySync').hidden=false}
}
async function exit(){
 if(state.loading)return;
 questionVoice.stop();
 try{state.renderer?.speechRecognition?.stop?.()}catch{}state.current=null;state.session=null;
 try{await refreshData()}catch(error){console.warn('[Free Talking] refresh',error)}
 renderBook();view('ftBook');
}
async function startup(){
 $('ftOpenBook').disabled=true;
 try{
  state.student=await studentIdentity();
  state.profile=await signedInProfile(state.student.id);
  if(state.profile?.role!=='student'||state.profile?.approved===false)throw Error('Student sign-in required');
  await Promise.all([loadQuestions(),refreshData()]);
  $('ftOpenBook').disabled=false;
  $('ftLoading').textContent='Oxford Buzz 6 is ready · 64 questions · 2 answer modes';
 }catch(error){showError('Free Talking을 열 수 없어요. '+error.message);
  $('ftLoading').textContent='로그인이나 Content Database 연결을 확인해 주세요.'}
}
$('ftOpenBook').addEventListener('click',()=>selectUnit(1));
$('ftBackHome').addEventListener('click',()=>view('ftHome'));
$('ftSpeakingCard').addEventListener('click',()=>void openMode('speaking'));
$('ftWritingCard').addEventListener('click',()=>void openMode('writing'));
$('ftTranscriptEdit').addEventListener('input',()=>{$('ftSubmit').disabled=state.loading||!validAnswer()});
$('ftSubmit').addEventListener('click',()=>void submit());
$('ftRetry').addEventListener('click',()=>renderQuestion({retry:true}));
$('ftSkip').addEventListener('click',()=>{state.cursor=(state.cursor+1)%8;renderQuestion()});
$('ftNext').addEventListener('click',()=>{state.cursor=(state.cursor+1)%8;renderQuestion()});
$('ftSessionExit').addEventListener('click',()=>void exit());
$('ftSessionHome').addEventListener('click',()=>void exit());
$('ftFinishHome').addEventListener('click',()=>void exit());
$('ftRetrySync').addEventListener('click',()=>void renderFinish({percent:state.session.first_try_percent,stars:state.session.reward_stars,
 points:state.session.reward_points,reward_synced:state.session.reward_synced}));
void startup();
