// Free Talking Genius: real textbook questions, student-owned attempts and AI Willi.
// Reuses Word Genius's question renderer, reward display, header, finish and session UI.
// No dashboard registration and no changes to Writing Genius.
import {studentIdentity,signedInProfile} from '/students/sentence-genius/content.js?v=20261024-wg-auth1';
import {fetchClassBookAssignments,extractClassBookAssignments} from '/students/shared/class-book-assignments.js?v=20261105-shared1';
import {contentDbGet} from '/students/shared/content-db.js?v=1.0.0';
import {QuestionRenderer} from '/shared/questions/question-renderer.js?v=20261107-stable-speech-rollback4';
import {renderStudentSessionFinish} from '/students/components/student-session-finish.js?v=1';
import {playStudentSfx,preloadStudentSfx} from '/students/shared/student-sfx.js?v=20260927-startup2';
import {capturePointOrigin,showPointAward} from '/students/components/student-point-feedback.js';
import {geniusSessionContext} from '/students/components/genius-session-context.js?v=20261104-a';
import {createFreeTalkingVoice} from './question-voice.js?v=20261107-exact-characters1';
import {createFreeTalkingRecorder} from './ai-recording.js?v=20261107-score-repeat1';
import {createFreeTalkingRetryVoice} from './retry-voice.js?v=20261107-exact-characters1';
import {createFreeTalkingCharacters} from './character-actor.js?v=20261107-pig-gradient2';
const API='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
// Book selection is resolved from the current student's class assignments.
const BOOK=()=>state.bookId;
const bookTitle=()=>state.books.find(b=>b.id===state.bookId)?.title||'Textbook';
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const state={student:null,profile:null,books:[],bookId:null,questions:[],unitTitles:new Map(),unit:1,mode:null,sessions:[],attempts:[],session:null,renderer:null,
 current:null,cursor:0,feedback:null,loading:false,finishing:false,identity:null,awards:new Set(),hints:new Map(),hintTexts:new Map(),phase:'ready',repeatStep:false,repeatTranscript:null,repeatChecking:false,seenChallenges:new Set()};
const groups=()=>state.questions.filter(x=>x.book_id===state.bookId&&Number(x.unit_number)===state.unit).sort((a,b)=>a.question_number-b.question_number);
const questionVoice=createFreeTalkingVoice({host:$('ftWilliVoice'),getToken:token});
const characters=createFreeTalkingCharacters({circle:$('ftTurnCircle'),session:$('ftSession'),voiceHost:$('ftWilliVoice'),choices:{ftChooseLili:'bunny-v3',ftChoosePigfish:'pigfish'}});
const retryVoice=createFreeTalkingRetryVoice({
 getToken:token,
 onFinished:()=>{
  if(visibleScreen==='ftSession'&&state.mode==='speaking'&&state.current&&state.phase==='student')
   void aiRecorder.prepare();
 }
});
function encourageQuietSpeech(){
 if(state.repeatStep){$('ftRepeatMessage').textContent='조금 더 크게 다시 말해 보세요.';return}
 if(visibleScreen!=='ftSession'||state.mode!=='speaking'||!state.current||state.phase!=='student')return;
 $('ftRecordStatus').textContent='목소리가 잘 안 들려요. 조금 더 크게 말해 볼까요?';
 void retryVoice.play(questionVoice.getVoice());
}

const aiRecorder=createFreeTalkingRecorder({
 getToken:token,
 onStatus:message=>{$('ftRecordStatus').textContent=message},
 onQuiet:encourageQuietSpeech,
 onProgress:progress=>{
  $('ftTurnCircle').style.setProperty('--ft-record-offset',String(Math.max(0,Math.min(100,progress*100))));
 },
 onTranscript:text=>{
  if(visibleScreen!=='ftSession')return;
  if(state.repeatStep){
   state.repeatTranscript=String(text||'').trim();
   $('ftRepeatMessage').textContent='확인 중…';
   return;
  }
  if(state.mode!=='speaking')return;
  $('ftTranscriptEdit').value=text;
  $('ftHeardText').textContent=text;
  $('ftHeardSentence').hidden=false;
  $('ftEditTranscript').disabled=false;
  $('ftSubmit').disabled=state.loading||!validAnswer();
 },
 onState:({recording,processing})=>{
  if(state.repeatStep&&recording)$('ftRepeatMessage').textContent='녹음 중…';
  if(state.repeatStep&&processing)$('ftRepeatMessage').textContent='확인 중…';
  if(state.repeatStep&&!recording&&!processing&&state.repeatTranscript&&!state.repeatChecking){
   const spoken=state.repeatTranscript;state.repeatTranscript=null;
   void submitRepetition(spoken);
  }
  $('ftTurnCircle').dataset.listening=recording?'true':'false';
  $('ftTurnCircle').dataset.aiRecording=recording?'true':'false';
  $('ftTurnCircle').dataset.transcribing=processing?'true':'false';
  $('ftSubmit').disabled=state.loading||recording||processing||!validAnswer();
 }
});
function useAiAudio(){return state.mode==='speaking'}
function resetSpeechAnswer(){
 $('ftTranscriptEdit').value='';
 $('ftHeardText').textContent='';
 $('ftHeardSentence').hidden=true;
 $('ftEditTranscript').disabled=true;
 $('ftSubmit').disabled=true;
 if(state.renderer){
  state.renderer.state.speakingTranscript='';
  state.renderer.state.speakingAlternatives=[];
  const shown=$('ftQuestionHost').querySelector('[data-speaking-transcript]');
  if(shown){shown.hidden=true;shown.textContent=''}
 }
}
function applySpeechPath(){
 aiRecorder.cancel();
 try{state.renderer?.speechRecognition?.stop?.()}catch{}
 resetSpeechAnswer();
 $('ftRecordStatus').textContent='AI 녹음 · 최대 30초 · 원을 눌러 시작 / 다시 눌러 종료';
 $('ftTurnCircle').dataset.listening='false';
 if(useAiAudio())void aiRecorder.prepare();
}

const RUBRIC_NAMES={grammar:'문법',length:'문장 길이와 내용',context:'문법 · 질문에 맞는 시제',appropriate:'질문에 맞는 답변',vocabulary:'어휘와 표현'};
const SCORE_SFX_BANDS=[
 {min:0,max:2,sfx:'wrong'}, // needs more practice
 {min:3,max:5,sfx:'correct'}, // okay
 {min:6,max:8,sfx:'star'}, // good
 {min:9,max:10,sfx:'complete'} // excellent
];
function playFreeTalkingScoreSfx(points){
 const score=Math.max(0,Math.min(10,Math.round(Number(points)||0)));
 const band=SCORE_SFX_BANDS.find(b=>score>=b.min&&score<=b.max);
 if(band)playStudentSfx(band.sfx);
}
// Same gold Points coin as the student dashboard leaderboard metric tab.
function createScoreCoin(earned){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 32 32');
 svg.setAttribute('aria-hidden','true');
 svg.setAttribute('class','ft-point-coin'+(earned?' is-earned':' is-unearned'));
 const circle=(radius,fill,stroke,width)=>{
  const el=document.createElementNS('http://www.w3.org/2000/svg','circle');
  for(const [k,v] of Object.entries({cx:'16',cy:'16',r:String(radius),fill,stroke,'stroke-width':String(width)}))el.setAttribute(k,v);
  svg.appendChild(el);
 };
 circle(12.5,'#f7c948','#d99a12',2);
 circle(8.2,'#ffd96d','#e3aa22',1.2);
 const path=document.createElementNS('http://www.w3.org/2000/svg','path');
 for(const [k,v] of Object.entries({d:'M16 10.3v11.4M12.7 13.1c1-2.1 6.4-2 6.8.2.4 2.4-6.2 1.8-6.4 4.3-.2 2.2 5.8 2.8 6.8.3',fill:'none',stroke:'#a46b00','stroke-width':'1.7','stroke-linecap':'round'}))path.setAttribute(k,v);
 svg.appendChild(path);
 return svg;
}
function appendCriterionCoins(summary,value){
 const coins=document.createElement('span');
 coins.className='ft-criterion-coins';
 const score=Math.max(0,Math.min(2,Math.round(Number(value)||0)));
 coins.setAttribute('role','img');
 coins.setAttribute('aria-label',score+'점 / 최대 2점');
 for(let i=0;i<2;i++)coins.appendChild(createScoreCoin(i<score));
 summary.appendChild(coins);
}

function setTurn(phase){
 if(!['ready','ai','student','thinking','feedback'].includes(phase))phase='ready';
 state.phase=phase;
 const circle=$('ftTurnCircle');
 circle.dataset.phase=phase;
 const replay=$('ftListenAgain');
 const prominent=phase==='student'&&state.listenFinished===true;
 replay.classList.toggle('is-replay-ready',prominent);
 replay.setAttribute('aria-label',prominent?'질문이 어려웠나요? 다시 듣기':'질문 다시 듣기');
 const labels={ready:'원을 눌러 질문을 들어 보세요.',ai:'AI가 질문을 읽는 중…',student:state.mode==='speaking'?'내 차례! 원을 눌러 영어로 말해 보세요.':'내 차례! 영어로 답변을 작성해 보세요.',thinking:'AI가 답변을 확인하고 있어요…',feedback:'점수가 나왔어요. 피드백을 확인해 보세요.'};
 $('ftTurnStatus').textContent=labels[phase];
 $('ftTurnStatus').hidden=phase==='feedback';
 $('ftQuestionStage').dataset.phase=phase;
 const hintsVisible=phase==='student';
 const hints=$('ftHintActions');
 hints.classList.toggle('is-concealed',!hintsVisible);
 hints.setAttribute('aria-hidden',String(!hintsVisible));
 hints.inert=!hintsVisible;
 circle.setAttribute('aria-label',phase==='ready'?'Start question audio':phase==='student'?(state.mode==='speaking'?'Tap to start or stop speaking':'Tap to focus your writing answer'):'AI question circle');
 if(phase!=='student')circle.dataset.listening='false';
}
function hintButton(kind){
 return $(({translation:'ftHintTranslation',starter:'ftHintStarter',english_prompt:'ftHintEnglish',typed_review:'ftEditTranscript'})[kind]);
}
const ALL_HINTS=['translation','starter','english_prompt','typed_review'];
function updateHintCap(){
 const used=ALL_HINTS.filter(k=>state.hints.get(k)).length;
 const deduction=Math.max(0,used-1);
 $('ftHintCap').hidden=deduction===0;
 $('ftHintCap').textContent=deduction?'힌트 −'+deduction+'점':'';
 for(const kind of ALL_HINTS){
  const button=hintButton(kind);
  if(!button||state.hints.get(kind))continue;
  let cost=button.querySelector('small');
  if(!cost){cost=document.createElement('small');button.appendChild(cost)}
  cost.textContent=used?'−1':'무료';
 }
}
const VISIBLE_HINTS=['english_prompt','translation','starter'];
const HINT_TITLES={english_prompt:'영어 질문',translation:'한국어 뜻',starter:'문장 힌트'};
let activeHint=null;
function showHint(kind){
 const unlocked=VISIBLE_HINTS.filter(k=>state.hints.get(k)&&state.hintTexts?.get(k));
 if(!unlocked.length){$('ftHintViewer').hidden=true;activeHint=null;return}
 activeHint=unlocked.includes(kind)?kind:(unlocked.includes(activeHint)?activeHint:unlocked[0]);
 const idx=unlocked.indexOf(activeHint);
 $('ftHintViewerTitle').textContent=HINT_TITLES[activeHint];
 $('ftHintViewerValue').textContent=state.hintTexts.get(activeHint);
 $('ftHintViewerCount').textContent=unlocked.length>1?(idx+1)+' / '+unlocked.length:'';
 $('ftHintViewerGuide').textContent=unlocked.length>1?'탭하면 다른 힌트를 볼 수 있어요 ↻':'';
 $('ftHintViewer').hidden=false;
 $('ftHintViewer').disabled=unlocked.length<2;
 $('ftHintViewer').setAttribute('aria-label',unlocked.length>1?HINT_TITLES[activeHint]+' · 누르면 다음 힌트':'열어 본 힌트: '+HINT_TITLES[activeHint]);
 for(const k of VISIBLE_HINTS)hintButton(k)?.classList.toggle('is-current',k===activeHint);
}
function cycleHints(){
 const unlocked=VISIBLE_HINTS.filter(k=>state.hints.get(k)&&state.hintTexts?.get(k));
 if(unlocked.length<2)return;
 showHint(unlocked[(unlocked.indexOf(activeHint)+1)%unlocked.length]);
}
function animateHintCost(button){
 const marker=document.createElement('span');
 marker.className='ft-hint-cost-float';marker.textContent='−1';
 marker.setAttribute('aria-hidden','true');
 button.appendChild(marker);
 marker.addEventListener('animationend',()=>marker.remove(),{once:true});
}
async function requestHint(kind){
 if(state.loading||!state.current||!state.session||
  !['translation','starter','english_prompt','typed_review'].includes(kind))return false;
 if(state.hints.get(kind)){
  if(kind!=='typed_review')showHint(kind);
  return true;
 }
 const button=hintButton(kind);button.disabled=true;
 $('ftAttemptStatus').textContent='힌트를 준비하는 중…';
 try{
  const call=async access=>fetch('/api/free-talking-grade',{
   method:'POST',credentials:'include',cache:'no-store',
   headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},
   body:JSON.stringify({action:'hint',session_id:state.session.id,question_id:state.current.id,hint_type:kind}),
   signal:AbortSignal.timeout(24000)});
  let res=await call(await token());
  if(res.status===401)res=await call(await token(true));
  const body=await res.json().catch(()=>null);
  if(!res.ok||!body?.success)throw Error(body?.error||'Hint unavailable');
  if(kind!=='typed_review')state.hintTexts.set(kind,String(body.value||((kind==='english_prompt'&&state.current.question_en)||'')).trim());
  state.hints.set(kind,true);
  if(kind!=='typed_review')showHint(kind);
  button.disabled=false;
  button.querySelector('small')?.remove();
  button.classList.add('is-used');
  if(ALL_HINTS.filter(k=>state.hints.get(k)).length>1)animateHintCost(button);
  updateHintCap();
  $('ftAttemptStatus').textContent='';
  return true;
 }catch(error){
  button.disabled=false;
  $('ftAttemptStatus').textContent='도움말을 열 수 없어요. '+error.message;
  return false;
 }
}
function resetHints(){
 state.hints.clear();
 state.hintTexts=new Map();
 activeHint=null;
 $('ftHintViewer').hidden=true;
 for(const [id,label] of [
  ['ftHintTranslation','한국어 뜻'],
  ['ftHintStarter','문장 힌트'],
  ['ftHintEnglish','영어 질문'],
  ['ftEditTranscript','답변 수정']]){
  const button=$(id);button.disabled=false;
  button.classList.remove('is-used','is-current');
  button.replaceChildren(document.createTextNode(label+' '));
  const cost=document.createElement('small');cost.textContent='무료';button.append(cost);
 }
 $('ftQuestionText').hidden=state.mode==='speaking';
 closeTranscriptModal();
 $('ftEditTranscript').setAttribute('aria-expanded','false');
 $('ftHintCap').textContent='';$('ftHintCap').hidden=true;
}
function closeTranscriptModal(){
 const modal=$('ftTranscriptRow');
 modal.hidden=true;
 $('ftEditTranscript').setAttribute('aria-expanded','false');
}
function openTranscriptModal(){
 const modal=$('ftTranscriptRow');
 modal.hidden=false;
 $('ftEditTranscript').setAttribute('aria-expanded','true');
 $('ftTranscriptEdit').focus();
}
function updateMicListening(){
 if(useAiAudio())return;
 const recognition=state.renderer?.speechRecognition;
 const button=$('ftQuestionHost').querySelector('[data-speaking-mic]');
 $('ftTurnCircle').dataset.listening=button?.classList.contains('is-listening')?'true':'false';
 if(recognition?.onspeechstart&&state.phase==='ready')setTurn('student');
}
function showError(message){$('ftError').textContent=message||'Unknown error';$('ftError').hidden=false;console.error('[Free Talking]',message)}
function clearError(){$('ftError').hidden=true;$('ftError').textContent=''}
// Navigation history belongs to this app, not to the student's saved attempts.
// Store the screen and unit in browser history; never use history to modify scores.
const FT_NAV_KEY='willenaFreeTalkingNavV1';
const FT_SCREENS=new Set(['ftHome','ftBook','ftCharacter','ftSession','ftFinish']);
let visibleScreen='ftHome',navigatingHistory=false;
function navState(screen){
 return {screen,bookId:state.bookId||null,unit:state.unit,mode:state.mode||null,
  sessionId:state.session?.id||null};
}
function sameNav(a,b){
 return !!a&&a.screen===b.screen&&a.bookId===b.bookId&&
  Number(a.unit)===Number(b.unit)&&a.mode===b.mode&&a.sessionId===b.sessionId;
}
function view(which,{record=true}={}){
 if(!FT_SCREENS.has(which))return;
 if(which!=='ftSession'){retryVoice.stop();aiRecorder.cancel();questionVoice.stop();try{state.renderer?.speechRecognition?.stopExtended?.();state.renderer?.speechRecognition?.stop?.()}catch{}}
 for(const id of FT_SCREENS)$(id).hidden=id!==which;
 visibleScreen=which;clearError();
 if(record&&!navigatingHistory){
  const next=navState(which),previous=history.state?.[FT_NAV_KEY];
  if(!sameNav(previous,next)){
   history.pushState({...history.state,[FT_NAV_KEY]:next},'');
  }
 }
 window.scrollTo({top:0,behavior:'instant'});
}
function restoreNavigation(nav){
 if(!nav||!FT_SCREENS.has(nav.screen))return;
 navigatingHistory=true;
 try{
  if(nav.screen==='ftHome'){view('ftHome',{record:false});return}
  if(!state.books.length){view('ftHome',{record:false});return}
  const book=state.books.find(b=>b.id===nav.bookId&&b.ready);
  if(!book){view('ftHome',{record:false});return}
  state.bookId=book.id;
  const availableUnits=new Set(state.questions.filter(q=>q.book_id===book.id).map(q=>Number(q.unit_number)));
  if(availableUnits.has(Number(nav.unit)))state.unit=Number(nav.unit);
  else state.unit=Math.min(...availableUnits);
  renderBook();
  if(nav.screen==='ftSession'){
   if(state.session?.id===nav.sessionId&&state.session.status==='in_progress'&&state.mode===nav.mode){
    renderQuestion();return;
   }
   // Never create a new session from browser history. Resume only an active
   // in-memory session; a refresh must start via the normal authenticated flow.
   view('ftBook',{record:false});return;
  }
  if(nav.screen==='ftCharacter'){view('ftBook',{record:false});return;}
  if(nav.screen==='ftFinish'&&state.session?.id===nav.sessionId&&state.session.status==='completed'){
   view('ftFinish',{record:false});return;
  }
  view('ftBook',{record:false});
 }finally{navigatingHistory=false}
}
history.replaceState({...history.state,[FT_NAV_KEY]:navState('ftHome')},'');
window.addEventListener('popstate',event=>{
 const snapshot=event.state?.[FT_NAV_KEY];
 if(snapshot)restoreNavigation(snapshot);
});
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
async function syncQuestionReward(question,bonus){
 const earned=Math.max(0,Math.min(2,bonus));
 const legacy=legacyQuestionPoints(state.unit,state.mode,question.id);
 const fn=window.WillenaAPI?.fetch?window.WillenaAPI.fetch.bind(window.WillenaAPI):fetch;
 for(let tier=legacy+1;tier<=earned;tier++){
  const awardKey=state.mode+':'+question.id+':'+tier;
  if(state.awards.has(awardKey))continue;
  const rewardId=await stableRewardUuid('free-talking-bonus-v2|'+state.student.id+'|'+state.mode+'|'+question.id+'|'+tier);
  const payload={reward_only:true,session_id:rewardId,client_attempt_id:rewardId,
   book_id:BOOK(),unit_id:question.unit_id,reward_mode:'free_talking_'+state.mode+'_bonus',
   reward_list_name:'Free Talking Genius · '+bookTitle()+' · Unit '+state.unit+' · Q'+question.question_number+' · Bonus '+tier,
   reward_list_size:1,reward_started_at:state.session?.created_at||new Date().toISOString(),
   reward_summary:{completed:true,stars:0,percent:100,accuracy:1,score:1,total:1,points_earned:1,
    book_id:BOOK(),unit_id:question.unit_id,free_talking_question_id:question.id,
    free_talking_mode:state.mode,reward_scheme:'free-talking-bonus-v2',session_source:'student'}};
  const response=await fn('/.netlify/functions/progress_summary?section=study_attempt&_='+Date.now(),{
   method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload})});
  const result=await response.json().catch(()=>null);
  if(!response.ok||result?.success!==true)throw Error(result?.error||'Bonus points could not be confirmed');
  state.awards.add(awardKey);
 }
}
// Creativity is a rare one-time gift, independent of the scored answer.
async function syncCreativityGift(question){
 const key='creative:'+state.mode+':'+question.id;
 if(state.awards.has(key))return false;
 const rewardId=await stableRewardUuid('free-talking-creative-v1|'+state.student.id+'|'+state.mode+'|'+question.id);
 const payload={reward_only:true,session_id:rewardId,client_attempt_id:rewardId,
  book_id:BOOK(),unit_id:question.unit_id,reward_mode:'free_talking_creativity_gift',
  reward_list_name:'Free Talking Genius · 반짝 아이디어 보너스 · '+bookTitle()+' · Q'+question.question_number,
  reward_list_size:1,reward_started_at:state.session?.created_at||new Date().toISOString(),
  reward_summary:{completed:true,stars:0,percent:100,accuracy:1,score:5,total:5,
   points_earned:5,book_id:BOOK(),unit_id:question.unit_id,
   free_talking_question_id:question.id,free_talking_mode:state.mode,
   reward_scheme:'free-talking-creativity-gift-v1',session_source:'student'}};
 const fn=window.WillenaAPI?.fetch?window.WillenaAPI.fetch.bind(window.WillenaAPI):fetch;
 const response=await fn('/.netlify/functions/progress_summary?section=study_attempt&_='+Date.now(),{
  method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({payload})});
 const data=await response.json().catch(()=>null);
 if(!response.ok||data?.success!==true)throw Error(data?.error||'Creativity gift sync failed');
 state.awards.add(key);
 return true;
}
function showCreativitySurprise(reason){
 // Keep the child's individual AI comment; only the reward framing is translated.
 document.querySelector('.ft-creativity-overlay')?.remove();
 const overlay=document.createElement('div');
 overlay.className='ft-creativity-overlay';
 const popup=document.createElement('button');
 popup.type='button';popup.className='ft-creativity-surprise';
 popup.setAttribute('aria-label','반짝 아이디어 보너스 5점. 화면을 눌러 닫기');
 const icon=document.createElement('span');
 icon.className='ft-creativity-sparkle';
 icon.setAttribute('aria-hidden','true');
 icon.innerHTML='<svg viewBox="0 0 112 112" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M56 5L66 36L98 25L80 53L108 72L75 74L68 106L51 79L19 94L34 63L6 44L40 43Z" fill="#8E6BCE" stroke="#5B4299" stroke-width="5" stroke-linejoin="round"/><path d="M55 23L61 47L85 40L71 58L91 70L66 69L63 92L52 73L31 81L42 60L23 49L47 50Z" fill="#D8C6F5"/><circle cx="21" cy="16" r="6" fill="#62C8D0"/><circle cx="96" cy="99" r="5" fill="#62C8D0"/><path d="M93 5v18m-9-9h18" stroke="#62C8D0" stroke-width="4" stroke-linecap="round"/></svg>';
 const heading=document.createElement('strong');heading.textContent='반짝 아이디어! +5';
 const detail=document.createElement('p');detail.textContent=reason||'상상력이 반짝였어요!';
 const hint=document.createElement('span');hint.className='ft-creativity-dismiss';hint.textContent='화면을 눌러 닫기';
 popup.append(icon,heading,detail,hint);
 overlay.appendChild(popup);document.body.appendChild(overlay);
 const dismiss=()=>{document.removeEventListener('keydown',onKey);overlay.remove()};
 const onKey=e=>{if(e.key==='Escape')dismiss()};
 overlay.addEventListener('click',dismiss);
 document.addEventListener('keydown',onKey);
 popup.focus({preventScroll:true});
 try{const sound=new Audio('/Games/english_arcade/assets/audio/right-answer.mp3');sound.volume=.7;void sound.play().catch(()=>{});}catch{}
 void showPointAward({amount:5,origin:capturePointOrigin(icon)}).catch(()=>{});
}
async function syncPendingQuestionRewards(){
 for(const question of groups()){
  const bonus=bestUnitBonus(state.unit,state.mode,question.id);
  if(bonus>legacyQuestionPoints(state.unit,state.mode,question.id))await syncQuestionReward(question,bonus);
  if(unitAttempts(state.unit,state.mode,question.id).some(a=>a.rubric_v2?.creativity_gift===true))await syncCreativityGift(question);
 }
}
const pct=x=>Math.max(0,Math.min(100,Math.round(Number(x)||0)));
function attemptsFor(sessionId,questionId){
 return state.attempts.filter(a=>a.session_id===sessionId&&a.question_id===questionId)
  .sort((a,b)=>a.attempt_no-b.attempt_no);
}
const FT_PASS_SCORE=8;
function attemptScore(a){return a?.score_total_v2!=null?Number(a.score_total_v2):Math.round((Number(a?.grammar_points||0)+Number(a?.quality_points||0))*2.5)}
function bestScore(sessionId,id){return Math.max(0,...attemptsFor(sessionId,id).map(attemptScore))}
function unitAttempts(unit,mode,id){
 const ids=new Set(state.sessions.filter(s=>s.book_id===BOOK()&&Number(s.unit_number)===unit&&s.mode===mode).map(s=>s.id));
 return state.attempts.filter(a=>ids.has(a.session_id)&&a.question_id===id);
}
function attemptPassed(a){return attemptScore(a)>=FT_PASS_SCORE && (a?.rubric_v2?.pass_score===8?a.rubric_v2.passed===true:a?.rubric_v2?.passed!==false)}
function unitHasPass(unit,mode,id){return unitAttempts(unit,mode,id).some(attemptPassed)}
function bestUnitScore(unit,mode,id){return Math.max(0,...unitAttempts(unit,mode,id).map(attemptScore))}
function bestUnitBonus(unit,mode,id){return Math.max(0,...unitAttempts(unit,mode,id).filter(attemptPassed).map(a=>Math.max(0,attemptScore(a)-FT_PASS_SCORE)))}
function legacyQuestionPoints(unit,mode,id){
 return Math.max(0,...unitAttempts(unit,mode,id).filter(a=>!a.rubric_v2?.bonus_scheme)
  .map(a=>Number(a.grammar_points||0)+Number(a.quality_points||0)));
}
function completedCount(unit,mode){
 const prompts=state.questions.filter(x=>x.book_id===state.bookId&&Number(x.unit_number)===unit);
 return prompts.filter(q=>unitHasPass(unit,mode,q.id)).length;
}
function unitComplete(unit){return completedCount(unit,'speaking')===8&&completedCount(unit,'writing')===8}
async function refreshData(){
 const list=await api('free_talking_sessions',{params:'?select=*&student_id=eq.'+state.student.id+'&book_id=eq.'+BOOK()+'&order=created_at.desc&limit=200'});
 state.sessions=Array.isArray(list)?list:[];
 const ids=state.sessions.map(s=>s.id);
 state.attempts=ids.length?await api('free_talking_attempts',{params:'?select=*&session_id=in.('+ids.join(',')+')&order=created_at.asc&limit=2000'}):[];
}
async function loadQuestions(){
 const path='/rest/v1/free_talking_questions?select=id,book_id,unit_id,unit_number,question_number,question_en,question_ko,grammar_focus&is_published=eq.true&order=book_id.asc,unit_number.asc,question_number.asc&limit=800';
 const list=await contentDbGet(path);
 if(!Array.isArray(list))throw Error('Free Talking question bank unavailable.');
 state.questions=list.filter(q=>q.id&&q.book_id&&q.unit_id);
 const ids=[...new Set(state.questions.map(q=>q.book_id))];
 if(!ids.length)throw Error('No published Free Talking questions.');
 const [catalog,units]=await Promise.all([
  contentDbGet('/rest/v1/content_books?select=id,title&status=in.(review,published)&id=in.('+ids.join(',')+')&limit=100'),
  contentDbGet('/rest/v1/content_units?select=id,book_id,unit_number,title&book_id=in.('+ids.join(',')+')&status=in.(review,published)&limit=200')
 ]);
 state.catalog=Array.isArray(catalog)?catalog:[];
 state.unitTitles=new Map((Array.isArray(units)?units:[]).map(u=>[u.book_id+':'+u.unit_number,u.title||'']));
}
async function detectBooks(){
 const className=state.student?.className||state.profile?.className;
 if(!className)throw Error('No class assigned to your student account.');
 const assigned=extractClassBookAssignments(await fetchClassBookAssignments(className));
 const published=new Set(state.questions.map(q=>q.book_id));
 const titles=new Map((state.catalog||[]).map(b=>[b.id,b.title]));
 const unique=new Map();
 // Assignment detection and Free Talking content readiness are distinct.
 // Always display genuinely assigned books, even if no question bank exists yet.
 for(const b of assigned)if(b.book_id){
  unique.set(b.book_id,{id:b.book_id,title:titles.get(b.book_id)||b.book_title||b.title||'Textbook',ready:published.has(b.book_id)});
 }
 state.books=[...unique.values()].sort((a,b)=>a.title.localeCompare(b.title));
 if(!state.books.length){state.bookId=null;return;}
 const previous=state.bookId;
 state.bookId=state.books.some(b=>b.id===previous)?previous:state.books[0].id;
}
function renderBookChoices(){
 const host=$('ftBookChoices');host.replaceChildren();
 for(const b of state.books){
  const button=document.createElement('button');
  button.type='button';button.className='vocab-front-book-card ft-book-choice';
  const count=state.questions.filter(q=>q.book_id===b.id).length;
  button.disabled=!b.ready;
  if(!b.ready)button.title='This textbook is assigned, but Free Talking questions are not available yet.';
  button.innerHTML='<span class="vocab-front-card-main">'+
   '<span class="vocab-front-card-copy"><span class="eyebrow">FREE TALKING</span><strong>'+escape(b.title)+'</strong><small>'+
   (b.ready?count+' questions · Speaking & Writing':'Assigned textbook · Free Talking questions not available yet')+
   '</small></span></span><span class="vocab-front-arrow" aria-hidden="true">'+(b.ready?'›':'')+'</span>';
  if(b.ready)button.addEventListener('click',()=>void chooseBook(b.id));host.append(button);
 }
}
async function chooseBook(id){
 if(!state.books.some(b=>b.id===id&&b.ready))return;
 state.bookId=id;state.unit=Math.min(...state.questions.filter(q=>q.book_id===id).map(q=>Number(q.unit_number)));state.session=null;state.current=null;state.awards.clear();
 try{
  await refreshData();
  questionVoice.setQuestionBank(state.questions.filter(q=>q.book_id===id),state.unit);
  renderBook();view('ftBook');
 }catch(error){showError('Could not open this textbook: '+error.message)}
}
function renderBookTabs(){
 const host=$('ftBookTabs');host.replaceChildren();
 for(const book of state.books.filter(b=>b.ready)){
  const button=document.createElement('button');
  button.type='button';button.className='vocab-book-choice'+(book.id===state.bookId?' is-active':'');
  button.textContent=book.title;button.setAttribute('aria-pressed',String(book.id===state.bookId));
  button.addEventListener('click',()=>{if(book.id!==state.bookId)void chooseBook(book.id)});
  host.append(button);
 }
 $('ftBookPicker').hidden=host.childElementCount<2;
}
function renderUnitStrip(){
 const host=$('ftUnitStrip');host.replaceChildren();
 for(const n of [...new Set(state.questions.filter(q=>q.book_id===state.bookId).map(q=>Number(q.unit_number)))].sort((a,b)=>a-b)){
  const button=document.createElement('button');
  button.type='button';button.className=(n===state.unit?'is-current ':'')+(unitComplete(n)?'is-complete':'');
  button.textContent='Unit '+n;
  if(unitComplete(n)){button.title='Speaking and Writing completed';button.setAttribute('aria-label','Unit '+n+' completed')}
  button.addEventListener('click',()=>selectUnit(n));host.append(button);
 }
}
function renderBook(){
 renderBookTabs();
 renderUnitStrip();
 $('ftUnitTitle').textContent='Unit '+state.unit+' · '+(state.unitTitles.get(state.bookId+':'+state.unit)||'');
 for(const mode of ['speaking','writing']){
  const count=completedCount(state.unit,mode),card=$('ft'+(mode==='speaking'?'Speaking':'Writing')+'Card');
  const percent=pct(count/8*100);
  card.querySelector('.vocab-skill-ring').style.setProperty('--progress',percent);
  card.querySelector('.vocab-skill-ring span').textContent=percent+'%';
  card.querySelector('.vocab-card-stars').textContent=count+'/8';
 }
}
function selectUnit(n){state.unit=n;renderBook();view('ftBook');questionVoice.preload(n);}
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
function renderCorrectionDiff(original,corrected){
 const host=$('ftCorrection');host.replaceChildren();
 const a=(String(original||'').match(/\S+/g)||[]).slice(0,120),b=(String(corrected||'').match(/\S+/g)||[]).slice(0,120);
 const dp=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
 for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)
  dp[i][j]=a[i].toLowerCase()===b[j].toLowerCase()?1+dp[i+1][j+1]:Math.max(dp[i+1][j],dp[i][j+1]);
 let i=0,j=0;
 function add(word,pink){
  if(host.childNodes.length)host.appendChild(document.createTextNode(' '));
  if(pink){const mark=document.createElement('mark');mark.className='ft-pink-fix';mark.textContent=word;host.appendChild(mark)}
  else host.appendChild(document.createTextNode(word));
 }
 while(i<a.length||j<b.length){
  if(i<a.length&&j<b.length&&a[i].toLowerCase()===b[j].toLowerCase()){add(b[j]);i++;j++}
  else if(j<b.length&&(i===a.length||dp[i][j+1]>=dp[i+1][j])){add(b[j],true);j++}
  else i++;
 }
 if(!host.textContent.trim())host.textContent=corrected||original;
}
function markFeedback(attempt){
 if(!attempt)return;
 state.repeatStep=false;state.repeatTranscript=null;
 $('ftQuestionStage').dataset.step='score';
 $('ftFeedback').hidden=false;
 $('ftScoreSplash').hidden=false;$('ftRepeatScreen').hidden=true;
 $('ftQuestionHost').hidden=true;$('ftHeardSentence').hidden=true;
 $('ftHintViewer').hidden=true;$('ftHintActions').classList.add('is-concealed');
 $('ftLanguageChallenge').hidden=true;$('ftChallengeSplash').hidden=true;$('ftTranscriptRow').hidden=true;
 const passed=attemptPassed(attempt),score=attemptScore(attempt);
 const skills=$('ftSplashSkills');skills.replaceChildren();
 const details=attempt.rubric_v2?.scores||{};
 const labels=[
  ['grammar','문법'],
  ['context','문법 · 문맥'],
  ['appropriate','질문에 맞는 답변'],
  ['length','내용'],
  ['vocabulary','어휘']
 ];
 for(const [index,[key,label]] of labels.entries()){
  const row=document.createElement('div');row.className='ft-skill-pop';
  row.style.setProperty('--reveal-index',index);
  const name=document.createElement('strong');name.textContent=label;
  const indicators=document.createElement('span');indicators.className='ft-skill-indicators';
  const earned=Math.max(0,Math.min(2,Number(details[key]??0)));
  for(let dot=0;dot<2;dot++){
   const pip=document.createElement('i');pip.className='ft-skill-pip'+(dot<earned?' is-earned':'');
   indicators.appendChild(pip);
  }
  const value=document.createElement('b');value.textContent=earned+'/2';
  row.append(name,indicators,value);skills.appendChild(row);
 }
 $('ftSplashScore').textContent=score+' out of 10';
 $('ftSplashPassIcon').hidden=!passed;$('ftSplashRetryIcon').hidden=passed;
 const passMessages=['Pass!','Nice!','Awesome!','Great job!','Well done!'];
 const retryMessages=['Try again!','One more time!','Almost there!','Give it another go!'];
 const messages=passed?passMessages:retryMessages;
 $('ftSplashTitle').textContent=messages[Math.floor(Math.random()*messages.length)];
 $('ftScoreSplash').classList.remove('is-showing');
 void $('ftScoreSplash').offsetWidth;
 $('ftScoreSplash').classList.add('is-showing');
 $('ftNext').hidden=false;$('ftNext').textContent=passed?'다음 문제':'다음';
 $('ftRetry').hidden=true;$('ftSkip').hidden=true;$('ftSubmit').hidden=true;
 $('ftAttemptStatus').textContent='';
 setTurn('feedback');
}
function showRepeatScreen(){
 if(!state.feedback||attemptPassed(state.feedback))return;
 state.repeatStep=true;state.repeatTranscript=null;state.repeatChecking=false;
 aiRecorder.cancel();retryVoice.stop();
 $('ftQuestionStage').dataset.step='repeat';
 $('ftScoreSplash').hidden=true;$('ftRepeatScreen').hidden=false;
 $('ftOriginalAnswer').textContent=state.feedback.answer_text||'';
 renderCorrectionDiff(state.feedback.answer_text,state.feedback.correction||state.feedback.answer_text||'');
 $('ftRepeatMessage').textContent='원을 눌러 다시 말하세요.';
 $('ftRepeatCircleMount').appendChild($('ftTurnCircle'));
 $('ftNext').hidden=true;$('ftRetry').hidden=true;$('ftSubmit').hidden=true;
 $('ftListenAgain').disabled=true;
 setTurn('student');
 void aiRecorder.prepare();
}
async function submitRepetition(transcript){
 if(!state.repeatStep||state.repeatChecking||!state.feedback?.id||!state.session?.id)return;
 state.repeatChecking=true;$('ftTurnCircle').disabled=true;
 $('ftRepeatMessage').textContent='확인 중…';
 try{
  const call=async access=>fetch('/api/free-talking-grade',{
   method:'POST',credentials:'include',cache:'no-store',
   headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},
   body:JSON.stringify({action:'rehearse',session_id:state.session.id,question_id:state.current.id,
    original_attempt_id:state.feedback.id,answer:transcript}),signal:AbortSignal.timeout(20000)});
  let response=await call(await token());
  if(response.status===401)response=await call(await token(true));
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data?.success)throw Error(data?.error||'다시 녹음해 주세요.');
  if(!data.passed){
   $('ftRepeatMessage').textContent='조금 더 정확하게 다시 말해 보세요.';
   playStudentSfx('wrong');return;
  }
  if(!state.attempts.some(a=>a.id===data.attempt.id))state.attempts.push(data.attempt);
  state.feedback=data.attempt;
  const completed=groups().filter(q=>unitHasPass(state.unit,state.mode,q.id)).length;
  $('ftSessionProgress').textContent=completed+'/8 completed';
  $('ftProgressFill').style.width=pct(completed/8*100)+'%';
  $('ftWilliVoice').prepend($('ftTurnCircle'));
  markFeedback(data.attempt);
  characters.celebrate();
  playFreeTalkingScoreSfx(8);
 }catch(error){
  $('ftRepeatMessage').textContent=String(error.message||'다시 녹음해 주세요.');
 }finally{
  state.repeatChecking=false;$('ftTurnCircle').disabled=false;
  if(state.repeatStep)void aiRecorder.prepare();
 }
}
function questionIndexAfter(start=0){
 const questions=groups();
 // Only scores of 6/10 or higher count as completed; higher scores earn bonuses.
 for(let i=0;i<questions.length;i++){
  const index=(start+i)%questions.length,q=questions[index];
  if(!unitHasPass(state.unit,state.mode,q.id))return index;
 }
 return -1;
}
function renderQuestion({retry=false}={}){
 retryVoice.stop();
 aiRecorder.cancel();
 state.repeatStep=false;state.repeatTranscript=null;
 $('ftWilliVoice').prepend($('ftTurnCircle'));
 delete $('ftQuestionStage').dataset.step;
 const questions=groups();
 if(!state.session||!questions.length)return;
 const sameQuestion=retry&&state.current&&attemptsFor(state.session.id,state.current.id).length<20;
 const idx=sameQuestion?questions.findIndex(q=>q.id===state.current.id):questionIndexAfter(state.cursor);
 if(idx<0){void conclude();return}
 state.cursor=idx;state.current=questions[idx];state.feedback=null;
 state.questionStarted=false;
 state.aiWasPlaying=false;
 state.listenFinished=false;
 $('ftListenAgain').disabled=true;
 $('ftListenAgain').classList.remove('is-replay-ready');
 // Turn state controls the hint toolbar.
 $('ftQuestionHost').hidden=false;
 $('ftHeardSentence').hidden=true;
 $('ftHeardText').textContent='';
 resetHints();setTurn('ready');
 $('ftFeedback').hidden=true;$('ftSubmit').hidden=false;$('ftNext').hidden=true;$('ftRetry').hidden=true;$('ftSkip').hidden=true;
 $('ftAttemptStatus').textContent='';
 $('ftSession').dataset.mode=state.mode;
 $('ftRecordStatus').textContent='AI 녹음 · 최대 30초 · 원을 눌러 시작 / 다시 눌러 종료';
 $('ftPromptLabel').textContent='QUESTION '+(idx+1);
 $('ftQuestionText').textContent=state.current.question_en;
 const challenge=String(state.current.grammar_focus||'');
 const goals={
  1:'좋아하는 활동 + 자세한 내용',
  2:'과거형 + 경험 한 가지',
  3:'좋아하는 점 + 이유',
  4:'보고 싶은 동물 + 이유',
  5:'would/could + 행동',
  6:'might/could + 구체적인 추측',
  7:'필요한 것 + 이유',
  8:'would/could + 야영 활동'
 };
 const isForestUnit=state.current.book_id==='c437909b-f399-468a-bc31-996147d82fd8'&&Number(state.unit)===2;
 const goal=isForestUnit
  ?goals[Number(state.current.question_number)]||'완전한 문장 + 자세한 내용'
  :challenge.startsWith('Challenge:')?challenge.slice(10).trim():'완전한 문장 + 자세한 내용';
 $('ftLanguageChallenge').hidden=true;
 $('ftChallengeText').textContent='';
 const splashKey=state.session.id+':'+state.current.id;
 const splash=$('ftChallengeSplash');
 splash.classList.remove('is-dismissing');
 $('ftChallengeSplashText').textContent=goal;
 splash.hidden=retry||state.seenChallenges.has(splashKey);
 $('ftHintEnglish').hidden=state.mode!=='speaking';
 $('ftQuestionText').hidden=state.mode==='speaking';
 const answered=questions.filter(q=>unitHasPass(state.unit,state.mode,q.id)).length;
 $('ftSessionProgress').textContent=answered+'/8 completed';
 $('ftProgressFill').style.width=pct(answered/8*100)+'%';
 $('ftSessionTitle').textContent=(state.mode==='speaking'?'Speaking':'Writing')+' · Unit '+state.unit;
 try{state.renderer?.speechRecognition?.stopExtended?.();state.renderer?.speechRecognition?.stop?.()}catch{}
 state.renderer=new QuestionRenderer($('ftQuestionHost'));
 const form=state.mode==='speaking'?'speaking':'write';
 state.renderer.render({form,prompt:state.current.question_en,context:{},answer:[],
  ...(form==='write'?{hints:{placeholder:'Write your own English answer...'}}:{})},{
  onChange:()=>{
   if(state.mode==='speaking'&&!useAiAudio()){
    const heard=String(state.renderer?.getResponse()||'').trim();
    if(heard){
     $('ftTranscriptEdit').value=heard;
     $('ftHeardText').textContent=heard;
     $('ftHeardSentence').hidden=false;
     $('ftEditTranscript').disabled=false;
    }
   }
   $('ftSubmit').disabled=state.loading||!validAnswer();
   if(state.questionStarted&&state.aiWasPlaying&&!state.loading&&state.phase!=='feedback')setTurn('student');
  }
 });
 state.micObserver?.disconnect?.();
 state.micObserver=null;
 const micButton=$('ftQuestionHost').querySelector('[data-speaking-mic]');
 if(micButton){
  state.micObserver=new MutationObserver(()=>updateMicListening());
  state.micObserver.observe(micButton,{attributes:true,attributeFilter:['class']});
 }
 // Speech transcript is stored for scoring, but the editor is opt-in.
 $('ftTranscriptRow').hidden=true;
 $('ftEditTranscript').hidden=state.mode!=='speaking';
 $('ftEditTranscript').disabled=true;
 $('ftEditTranscript').setAttribute('aria-expanded','false');
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
 // Earlier attempts are retained without showing a second progress message.
 view('ftSession');
 if(useAiAudio())void aiRecorder.prepare();
 void questionVoice.select(state.current.id,{autoplay:false});
}
let roundChoice=null;
function chooseRoundVoice(voice){
 if(!['marin','bunny-v3','pigfish'].includes(voice))return;
 roundChoice=voice;
 retryVoice.preloadBoth();
 for(const [id,value] of [['ftChooseWilli','marin'],['ftChooseLili','bunny-v3'],['ftChoosePigfish','pigfish']])
  $(id).setAttribute('aria-pressed',String(value===voice));
 $('ftCharacterContinue').disabled=false;
}
function openMode(mode){
 if(state.loading||!['speaking','writing'].includes(mode))return;
 state.pendingMode=mode;roundChoice=null;
 $('ftCharacterRound').textContent=bookTitle()+' · Unit '+state.unit+' · '+(mode==='speaking'?'말하기':'쓰기');
 for(const id of ['ftChooseWilli','ftChooseLili','ftChoosePigfish'])$(id).setAttribute('aria-pressed','false');
 $('ftCharacterContinue').disabled=true;
 preloadStudentSfx();
 view('ftCharacter');
}
async function beginRound(mode){
 if(state.loading||!['speaking','writing'].includes(mode)||!roundChoice)return;
 if(!questionVoice.setVoice(roundChoice)){
  showError('캐릭터 음성을 선택할 수 없어요.');return;
 }
 characters.select(roundChoice);

 state.mode=mode;state.identity=geniusSessionContext({bookId:BOOK(),unitId:groups()[0]?.unit_id,mode});
 setBusy(true);
 try{
  await refreshData();
  let session=state.sessions.find(s=>s.book_id===BOOK()&&s.unit_number===state.unit&&s.mode===mode&&s.status==='in_progress');
  if(session){
   // Keep unfinished sessions, even if eight answers are already present:
   // renderQuestion will safely finalize the session rather than orphaning it.
   const hasUnanswered=groups().some(q=>!unitHasPass(state.unit,mode,q.id));
   if(!hasUnanswered)state.cursor=0;
  }
  if(!session){
   const created=await api('free_talking_sessions',{method:'POST',body:{
    student_id:state.student.id,book_id:BOOK(),unit_id:groups()[0].unit_id,unit_number:state.unit,mode,status:'in_progress'}});
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
 if(state.loading||aiRecorder.isRecording()||aiRecorder.isProcessing()||!state.current||!validAnswer())return;
 const answer=captureAnswer(),question=state.current;
 try{state.renderer?.speechRecognition?.stopExtended?.()}catch{}
 setBusy(true);setTurn('thinking');$('ftAttemptStatus').textContent='';
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
  const prior=bestUnitBonus(state.unit,state.mode,question.id);
  const previouslyCreative=unitAttempts(state.unit,state.mode,question.id).some(a=>a.rubric_v2?.creativity_gift===true);
  if(!state.attempts.some(row=>row.id===attempt.id))state.attempts.push(attempt);
  state.feedback=attempt;markFeedback(attempt);
  if(attemptPassed(attempt))characters.celebrate();
  if(attemptPassed(attempt))playFreeTalkingScoreSfx(attemptScore(attempt));
  else playStudentSfx('wrong');
  const best=bestUnitBonus(state.unit,state.mode,question.id);
  try{
   if(best>legacyQuestionPoints(state.unit,state.mode,question.id))await syncQuestionReward(question,best);
   const gained=Math.max(0,best-Math.max(prior,legacyQuestionPoints(state.unit,state.mode,question.id)));
   if(gained>0)void showPointAward({amount:gained,origin:capturePointOrigin($('ftSubmit'))}).catch(()=>{});
   if(attempt.rubric_v2?.creativity_gift===true){
    const confirmed=await syncCreativityGift(question);
    if(confirmed&&!previouslyCreative&&!payload.reused)showCreativitySurprise(attempt.rubric_v2.creativity_reason);
   }
  }catch(pointError){
   $('ftAttemptStatus').textContent='보너스 포인트 동기화가 필요해요: '+pointError.message;
  }

  const answered=groups().filter(q=>unitHasPass(state.unit,state.mode,q.id)).length;
  $('ftSessionProgress').textContent=answered+'/8 completed';
  $('ftProgressFill').style.width=pct(answered/8*100)+'%';
 }catch(error){setTurn('student');$('ftAttemptStatus').textContent='저장하지 못했어요. '+error.message;console.warn('[Free Talking] grade',error)}
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
     description:'모든 질문에서 8점 이상 받아야 해요. 문장을 고치고 다시 도전하세요.',
     stats:[{label:'Completed',value:groups().filter(q=>unitHasPass(state.unit,state.mode,q.id)).length+'/8'}]});
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
 const unit=bookTitle()+' · Unit '+state.unit,mode=state.mode;
 const payload={reward_only:true,session_id:state.session.id,client_attempt_id:state.session.id,
   book_id:BOOK(),unit_id:groups()[0].unit_id,
   skill:mode==='speaking'?'speaking':'writing_sentence',response_type:'reward',
   activity_id:'free-talking-genius-reward',reward_mode:'free_talking_'+mode,
   reward_list_name:'Free Talking Genius · '+unit+' · '+mode,
   reward_list_size:8,reward_started_at:state.session.created_at,
   reward_summary:{completed:true,stars:Number(data.stars)||0,percent:Number(data.percent)||0,
    accuracy:(Number(data.percent)||0)/100,score:Number(data.percent)||0,total:100,
    points_earned:0,book_id:BOOK(),unit_id:groups()[0].unit_id,
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
 const earnedBonus=groups().reduce((sum,q)=>sum+Math.max(0,bestUnitBonus(state.unit,state.mode,q.id)-legacyQuestionPoints(state.unit,state.mode,q.id)),0);
 const scores={percent:Number(data.percent)||0,stars:Number(data.stars)||0,points:earnedBonus};
 const reward='<student-reward-celebration percent="'+pct(scores.percent)+'" stars="'+scores.stars+
  '" star-max="5" points="'+scores.points+'" label="FREE TALKING REWARD"></student-reward-celebration>';
 $('ftFinishContent').innerHTML=renderStudentSessionFinish({title:'잘했어요! · Unit '+state.unit+' complete',
  description:'8개 질문 모두 8점 이상! 9점부터는 보너스 포인트를 받아요.',
  stats:[{label:'Completed',value:'8/8'},
   {label:'Stars',value:scores.stars+'/5'},{label:'Bonus points',value:scores.points}],
  rewardHtml:reward});
 $('ftRetrySync').hidden=true;
 $('ftFinishStatus').textContent='진행 상황이 저장됐어요. 별과 포인트를 연결하는 중…';
 try{await rewardSync(data);$('ftFinishStatus').textContent='별과 포인트까지 저장했어요.'}
 catch(error){$('ftFinishStatus').textContent='답변은 저장됐지만 별/포인트 동기화가 필요해요: '+error.message;
 $('ftRetrySync').hidden=false}
}
async function exit(){
 if(state.loading)return;
 retryVoice.stop();
 aiRecorder.cancel();
 questionVoice.stop();
 try{state.renderer?.speechRecognition?.stopExtended?.();state.renderer?.speechRecognition?.stop?.()}catch{}state.current=null;state.session=null;
 try{await refreshData()}catch(error){console.warn('[Free Talking] refresh',error)}
 renderBook();
 // The session was entered from its unit screen; go back to that history
 // entry instead of adding a duplicate Book screen over the session.
 if(history.state?.[FT_NAV_KEY]?.screen==='ftSession')history.back();
 else view('ftBook');
}
async function startup(){
 try{
  preloadStudentSfx();
  state.student=await studentIdentity();
  state.profile=await signedInProfile(state.student.id);
  if(state.profile?.role!=='student'||state.profile?.approved===false)throw Error('Student sign-in required');
  await loadQuestions();
  await detectBooks();
  renderBookChoices();
  // Only show an empty-state message when there are genuinely no assigned books.
  $('ftLoading').hidden=state.books.length>0;
  $('ftLoading').textContent=state.books.length?'':'아직 배정된 교재가 없어요.';
 }catch(error){showError('Free Talking을 열 수 없어요. '+error.message);
  $('ftLoading').textContent='로그인이나 Content Database 연결을 확인해 주세요.'}
}
// Book cards are created dynamically from the student's active class assignments.
$('ftBackHome').addEventListener('click',()=>view('ftHome'));
$('ftChooseWilli').addEventListener('click',()=>chooseRoundVoice('marin'));
$('ftChooseLili').addEventListener('click',()=>chooseRoundVoice('bunny-v3'));
$('ftChoosePigfish').addEventListener('click',()=>chooseRoundVoice('pigfish'));
$('ftCharacterContinue').addEventListener('click',()=>void beginRound(state.pendingMode));
$('ftCharacterBack').addEventListener('click',()=>view('ftBook'));

$('ftSpeakingCard').addEventListener('click',()=>void openMode('speaking'));
$('ftWritingCard').addEventListener('click',()=>void openMode('writing'));
$('ftTranscriptEdit').addEventListener('input',()=>{
 $('ftHeardText').textContent=$('ftTranscriptEdit').value.trim();
 $('ftHeardSentence').hidden=!$('ftTranscriptEdit').value.trim();
 $('ftSubmit').disabled=state.loading||!validAnswer();
});
$('ftEditTranscript').addEventListener('click',async()=>{
 if(state.loading||state.mode!=='speaking'||!$('ftTranscriptEdit').value.trim())return;
 if(!$('ftTranscriptRow').hidden){closeTranscriptModal();return}
 if(!state.hints.get('typed_review')){
  const ok=await requestHint('typed_review');
  if(!ok)return;
 }
 openTranscriptModal();
});
$('ftCloseTranscript').addEventListener('click',closeTranscriptModal);
$('ftSaveTranscript').addEventListener('click',closeTranscriptModal);
$('ftTranscriptRow').addEventListener('click',e=>{if(e.target===$('ftTranscriptRow'))closeTranscriptModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('ftTranscriptRow').hidden)closeTranscriptModal()});

$('ftWilliVoice').addEventListener('ft:voice-playing',e=>{
 if(visibleScreen!=='ftSession'||state.phase==='thinking'||state.phase==='feedback'||!state.questionStarted)return;
 if(e.detail?.playing){
  state.aiWasPlaying=true;state.listenFinished=false;
  $('ftListenAgain').disabled=true;
  setTurn('ai');
 }else if(state.aiWasPlaying){
  state.listenFinished=true;
  $('ftListenAgain').disabled=false;
  setTurn('student');
 }
});
$('ftTurnCircle').addEventListener('click',()=>{
 if(state.loading||!state.current||state.phase==='thinking')return;
 if(state.repeatStep){
  if(state.repeatChecking||aiRecorder.isProcessing())return;
  if(aiRecorder.isRecording())aiRecorder.stop();
  else{state.repeatTranscript=null;void aiRecorder.start(state.session.id,state.current.id,'rehearse');}
  return;
 }
 if(state.phase==='feedback')return;
 if(state.phase==='ready'){
  state.questionStarted=true;
  $('ftTurnStatus').textContent='질문 음성을 준비하는 중…';
  void questionVoice.start();
  return;
 }
 if(state.phase==='ai'){ $('ftWilliVoice').querySelector('[data-ft-listen]')?.click();return; }
 setTurn('student');
 if(state.mode==='speaking'&&useAiAudio()){
  if(aiRecorder.isProcessing())return;
  if(aiRecorder.isRecording())aiRecorder.stop();
  else{
   retryVoice.stop();
   resetSpeechAnswer();
   void aiRecorder.start(state.session.id,state.current.id);
  }
  return;
 }
 if(state.mode==='speaking'){
  const mic=$('ftQuestionHost').querySelector('[data-speaking-mic]');
  mic?.click();
  requestAnimationFrame(updateMicListening);
 }else $('ftQuestionHost').querySelector('textarea.answer')?.focus();
});
$('ftListenAgain').addEventListener('click',()=>{
 if(state.loading||!state.current||!state.listenFinished)return;
 state.listenFinished=false;
 $('ftListenAgain').classList.remove('is-replay-ready');
 $('ftWilliVoice').querySelector('[data-ft-listen]')?.click();
});
$('ftHintEnglish').addEventListener('click',()=>void requestHint('english_prompt'));
$('ftHintTranslation').addEventListener('click',()=>void requestHint('translation'));
$('ftHintStarter').addEventListener('click',()=>void requestHint('starter'));
$('ftHintViewer').addEventListener('click',cycleHints);
$('ftQuestionHost').addEventListener('click',e=>{
 if(e.target.closest('[data-speaking-mic]')){setTurn('student');requestAnimationFrame(updateMicListening);}
});
$('ftSubmit').addEventListener('click',()=>void submit());
$('ftRetry').addEventListener('click',()=>{});
$('ftSkip').addEventListener('click',()=>{});
$('ftNext').addEventListener('click',()=>{
 if(!state.current||!state.feedback)return;
 if(!attemptPassed(state.feedback)){showRepeatScreen();return}
 state.cursor=(state.cursor+1)%8;renderQuestion();
});
$('ftChallengeSplash').addEventListener('click',()=>{
 const splash=$('ftChallengeSplash');
 if(splash.hidden||splash.classList.contains('is-dismissing'))return;
 if(state.session&&state.current)state.seenChallenges.add(state.session.id+':'+state.current.id);
 splash.classList.add('is-dismissing');
 setTimeout(()=>{
  if(!splash.classList.contains('is-dismissing'))return;
  splash.hidden=true;splash.classList.remove('is-dismissing');
  $('ftTurnCircle').focus({preventScroll:true});
 },190);
});
$('ftSessionExit').addEventListener('click',()=>void exit());
$('ftSessionHome').addEventListener('click',()=>void exit());
$('ftFinishHome').addEventListener('click',()=>{
 // Finish follows Session, which follows Book. Skip completed screens.
 const current=history.state?.[FT_NAV_KEY];
 if(current?.screen==='ftFinish')history.go(-2);
 else void exit();
});
$('ftRetrySync').addEventListener('click',()=>void renderFinish({percent:state.session.first_try_percent,stars:state.session.reward_stars,
 points:state.session.reward_points,reward_synced:state.session.reward_synced}));
void startup();
