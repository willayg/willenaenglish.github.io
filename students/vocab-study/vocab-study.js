import {QuestionRenderer} from '/shared/questions/question-renderer.js?v=20260925-speaking2';
import {capturePointOrigin,showPointAward} from '/students/components/student-point-feedback.js?v=20260926-v0003';
import {getSpellingTarget} from './spelling-targets.js?v=20260925-v0019';
import {isSpeakableTarget,matchSpeakingTarget} from './speaking-match.js?v=20260925-v0022';
import {getAssignment,setAssignment,getBookMeta,setBookMeta,getVocabulary,setVocabulary,background} from './vocab-startup-cache.js?v=20260925-v0001';
import {snapshotPercent,snapshotStars,loadVocabSnapshot,nextSkillTargets} from './vocab-progress-snapshot.js?v=20260925-v0005';
import {coachAttempt,repeatUntilCorrect,appendRetry,uniquePassedCount,wrongAttemptCount} from './vocab-pass-flow.js?v=20260925-v0002';

const CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const OP_URL='https://fiieuiktlsivwfgyivai.supabase.co';
const OP_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const ACTIVE_BOOK_KEY='willena-study-v2-active-book';

const el=id=>document.getElementById(id);
const statusEl=el('vocabStudyStatus');
const bookTitleEl=el('vocabBookTitle');
const unitTitleEl=el('vocabUnitTitle');
const itemCountEl=el('vocabItemCount');
const wordListOpenBtn=el('vocabWordListOpen');
const wordModalEl=el('vocabWordModal');
const wordModalCloseBtn=el('vocabWordModalClose');
const wordModalListEl=el('vocabWordModalList');
const wordModalMetaEl=el('vocabWordModalMeta');
const startBtn=el('vocabStudyStart');
const spellingPreviewBtn=el('vocabSpellingPreview');
const pronunciationStartBtn=el('vocabPronunciationStart');
const quizRingEl=startBtn?.querySelector('.vocab-skill-ring');
const spellingRingEl=spellingPreviewBtn?.querySelector('.vocab-skill-ring');
const speakingRingEl=pronunciationStartBtn?.querySelector('.vocab-skill-ring');
const quizStarsEl=el('vocabQuizStars');
const spellingStarsEl=el('vocabSpellingStars');
const speakingStarsEl=el('vocabSpeakingStars');
const sessionEl=el('vocabStudySession');
const sessionMain=el('vocabSessionMain');
const root=el('vocabActivityRoot');
const closeBtn=el('vocabStudyClose');
const actionBtn=el('vocabStudyAction');
const progressEl=el('vocabStudyProgress');
const progressFill=el('vocabProgressFill');
const titleEl=el('vocabStudyTitle');
const instructionEl=el('vocabInstruction');
const answerNote=el('vocabAnswerNote');
const questionStage=el('vocabQuestionStage');
const bottomEl=el('vocabSessionBottom');
const adminPickerEl=el('vocabAdminPicker');
const adminBookSelect=el('vocabAdminBookSelect');
const bookPickerEl=el('vocabBookPicker');
const bookChoicesEl=el('vocabBookChoices');
const unitStripEl=el('vocabUnitStrip');
const currentUnitLabelEl=el('vocabCurrentUnitLabel');
const motivationEl=el('vocabMotivation');
const streakCurrentEl=el('vocabStreakCurrent');
const streakBestEl=el('vocabStreakBest');
const goldenCountEl=el('vocabGoldenCount');
const teacherPracticeEl=el('vocabTeacherPractice');
const teacherPracticeListEl=el('vocabTeacherPracticeList');
const teacherPracticeCountEl=el('vocabTeacherPracticeCount');
const frontMenuEl=el('vocabFrontMenu');
const frontBookListEl=el('vocabFrontBookList');
const frontWordTestCardEl=el('vocabFrontWordTestCard');
const frontWordTestMetaEl=el('vocabFrontWordTestMeta');
const frontWordTestRingEl=el('vocabFrontWordTestRing');
const bookScreenEl=el('vocabBookScreen');
const bookBackBtn=el('vocabBookBack');
const wordTestScreenEl=el('vocabWordTestScreen');
const wordTestBackBtn=el('vocabWordTestBack');
const wordTestEmptyEl=el('vocabWordTestEmpty');
const oldTestsOpenBtn=el('vocabOldTestsOpen');
const oldTestsPanelEl=el('vocabOldTestsPanel');
const oldTestsBooksEl=el('vocabOldTestsBooks');
const oldTestsListEl=el('vocabOldTestsList');
const oldTestsMetaEl=el('vocabOldTestsMeta');

const state={
  book:null,unit:null,units:[],items:[],assignments:[],books:[],activeIndex:0,
  queue:[],index:0,checked:false,renderer:null,
  outcomes:new Map(),reviewKeys:new Set(),retryCounts:new Map(),
  spellingPractice:null,spellingTest:null,speakingSession:null,
  adminMode:false,nextReadyAt:0,questionStartedAt:0,
  progressSnapshot:null,
  rewardSession:null,
  pointTapOrigin:null,
  motivation:null,
  pendingGoldenAward:null,
  teacherAssignments:[],
  teacherAssignmentHistory:[],
  wordTestBookFilter:'',
  activeScreen:'home',
  shellWired:false,
  activeTeacherAssignment:null,
  activeTeacherItems:[],
  pendingTeacherRecords:new Set()
};

function txt(v){return String(v==null?'':v).trim()}
function arr(v){return Array.isArray(v)?v:[]}
function unique(items){return [...new Set(items.map(txt).filter(Boolean))]}
function shuffle(items){
  const a=items.slice();
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  return a;
}
function setStatus(message){if(statusEl)statusEl.textContent=message}

function vocabPointValue(skill,responseType,{correct=true,hintsUsed=0,metadata={}}={}){
  if(!correct)return 0;
  const mode=txt(metadata?.vocab_mode);
  if(mode==='spelling_coach'){
    const hints=Math.max(0,Number(hintsUsed)||0);
    if(hints===0)return 3;
    if(hints===1)return 2;
    return 1;
  }
  if(responseType==='multiple_choice')return 2;
  if(skill==='spelling'||skill==='speaking')return 4;
  return 0;
}
function starsForPercent(percent){
  const p=Math.max(0,Math.min(100,Number(percent)||0));
  if(p>=100)return 5;
  if(p>=90)return 4;
  if(p>=80)return 3;
  if(p>=70)return 2;
  if(p>=60)return 1;
  return 0;
}
function wordTestStarsForPercent(percent){
  const p=Math.max(0,Math.min(100,Number(percent)||0));
  return Math.max(0,Math.min(10,Math.floor(p/10)));
}
function startRewardSession(mode){
  const rewardSessionId=(window.crypto?.randomUUID?.()||('vocab-'+Date.now()+'-'+Math.random().toString(16).slice(2)));
  const listName=state.activeTeacherAssignment
    ?('Word Test Study · '+txt(state.activeTeacherAssignment?.assignment?.title||'Vocabulary'))
    :('Vocabulary · '+txt(state.book?.book_title||state.book?.book_id||'Book')+' · Unit '+txt(state.unit?.unit_number||state.unit?.id||''));
  state.rewardSession={
    mode:txt(mode),
    firstTotal:0,
    firstCorrect:0,
    points:0,
    completed:false,
    rewardSessionId,
    listName,
    startedAt:new Date().toISOString()
  };
}
function noteRewardAttempt(correct,retryCount,points){
  const reward=state.rewardSession;
  if(!reward)return;
  reward.points+=Math.max(0,Number(points)||0);
  if(Math.max(0,Number(retryCount)||0)===0){
    reward.firstTotal+=1;
    if(correct)reward.firstCorrect+=1;
  }
}
function rewardPercent(reward=state.rewardSession){
  return reward?.firstTotal?Math.round(reward.firstCorrect*100/reward.firstTotal):0;
}
async function completeRewardSession(){
  const reward=state.rewardSession;
  if(!reward||reward.completed||state.adminMode)return reward;
  reward.completed=true;
  reward.percent=rewardPercent(reward);
  const teacher=state.activeTeacherAssignment;
  reward.stars=teacher?wordTestStarsForPercent(reward.percent):starsForPercent(reward.percent);
  const listName=reward.listName||(
    teacher
      ?('Word Test Study · '+txt(teacher?.assignment?.title||'Vocabulary'))
      :('Vocabulary · '+txt(state.book?.book_title||state.book?.book_id||'Book')+' · Unit '+txt(state.unit?.unit_number||state.unit?.id||''))
  );
  try{
    if(teacher&&state.pendingTeacherRecords.size){
      await Promise.allSettled([...state.pendingTeacherRecords]);
    }
    const payload={
      reward_only:true,
      session_id:reward.rewardSessionId,
      client_attempt_id:(window.crypto?.randomUUID?.()||('reward-'+Date.now()+'-'+Math.random().toString(16).slice(2))),
      book_id:teacher?(teacher?.assignment?.book_id||null):(state.book?.book_id||null),
      unit_id:teacher?(teacher?.assignment?.unit_id||null):(state.unit?.id||null),
      skill:'vocabulary',
      response_type:'reward',
      activity_id:'vocab-reward',
      reward_mode:'vocab_'+reward.mode,
      reward_list_name:listName,
      reward_list_size:reward.firstTotal,
      reward_started_at:reward.startedAt||new Date().toISOString(),
      reward_summary:{
        completed:true,
        stars:reward.stars,
        accuracy:reward.firstTotal?reward.firstCorrect/reward.firstTotal:0,
        percent:reward.percent,
        score:reward.firstCorrect,
        total:reward.firstTotal,
        points_earned:reward.points,
        book_id:teacher?(teacher?.assignment?.book_id||null):(state.book?.book_id||null),
        unit_id:teacher?(teacher?.assignment?.unit_id||null):(state.unit?.id||null),
        assignment_id:teacher?.assignment?.id||null,
        session_source:teacher?'teacher':'student',
        vocab_mode:reward.mode,
        reward_scheme:teacher?'word-test-study-v1':'vocab-study-v1',
        star_cap:teacher?10:5
      }
    };
    payload.assignment_id=teacher?.assignment?.id||null;
    await api('/.netlify/functions/progress_summary?section=study_attempt&_='+Date.now(),{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({payload})
    });
    try{
      window.dispatchEvent(new CustomEvent('session:ended',{detail:{session_id:reward.rewardSessionId,mode:'vocab_'+reward.mode,list_name:listName,list_size:reward.firstTotal}}));
      window.dispatchEvent(new CustomEvent('stars:refresh',{detail:{earned:reward.stars}}));
      localStorage.setItem('stars:refresh',String(Date.now()));
    }catch(_){}
    if(teacher)await loadTeacherAssignments();
    else await checkGoldenUnit();
  }catch(error){
    console.warn('[Vocab Study] reward session save failed',error);
  }
  return reward;
}
function rewardSummaryHtml(reward=state.rewardSession,{pointsOnly=false}={}){
  if(!reward)return'';
  const starMax=state.activeTeacherAssignment?10:5;
  const stars=Math.max(0,Math.min(starMax,Number(reward.stars)||0));
  const points=Math.max(0,Number(reward.points)||0);
  return '<student-reward-celebration '+(pointsOnly?'points-only ':'')+'percent="'+rewardPercent(reward)+'" stars="'+stars+'" star-max="'+starMax+'" points="'+points+'" label="'+(state.activeTeacherAssignment?'WORD TEST STUDY':'SESSION REWARD')+'"></student-reward-celebration>';
}

function perfNow(){return window.performance?.now?.()||Date.now()}
const startupPerf={startedAt:perfNow(),entries:[]};
async function timed(label,fn){
  const start=perfNow();
  try{return await fn()}
  finally{
    const ms=Math.round((perfNow()-start)*10)/10;
    startupPerf.entries.push({label,ms});
    console.info('[Vocab Study perf]',label,ms+'ms');
  }
}
function perfOverlayEnabled(){
  try{return new URLSearchParams(location.search).get('perf')==='1'}catch(_){return false}
}
function showStartupPerf(rows,total){
  if(!perfOverlayEnabled())return;
  let panel=document.getElementById('vocabPerfPanel');
  if(!panel){
    panel=document.createElement('section');
    panel.id='vocabPerfPanel';
    panel.style.cssText='position:fixed;left:10px;right:10px;bottom:10px;z-index:99999;max-height:52vh;overflow:auto;background:#102f35;color:#fff;border-radius:16px;padding:14px 16px;box-shadow:0 12px 36px rgba(0,0,0,.3);font:600 12px/1.45 Poppins,sans-serif';
    document.body.appendChild(panel);
  }
  panel.innerHTML=
    '<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:8px">'+
      '<strong style="font-size:14px">Vocab Study startup</strong>'+
      '<strong>'+total+' ms</strong>'+
    '</div>'+
    rows.map(row=>
      '<div style="display:flex;justify-content:space-between;gap:14px;border-top:1px solid rgba(255,255,255,.12);padding:6px 0">'+
        '<span>'+escapeHtml(row.label)+'</span><b>'+row.ms+' ms</b>'+
      '</div>'
    ).join('');
}
function markPerf(label,ms=0){
  startupPerf.entries.push({label,ms});
}
function reportStartupPerf(){
  const total=Math.round((perfNow()-startupPerf.startedAt)*10)/10;
  const rows=startupPerf.entries.concat([{label:'TOTAL BOOT',ms:total}]);
  console.table(rows);
  window.WillenaVocabStudyPerf={totalMs:total,entries:rows.slice()};
  showStartupPerf(rows,total);
}

function goldenUnits(){
  return arr(state.motivation?.golden_units);
}
function isGoldenUnit(unitId){
  return goldenUnits().some(row=>String(row?.unit_id)===String(unitId));
}
function renderMotivation(){
  if(!motivationEl)return;
  if(state.adminMode||!state.motivation){
    motivationEl.hidden=true;
    return;
  }
  motivationEl.hidden=false;
  if(streakCurrentEl)streakCurrentEl.textContent=String(Math.max(0,Number(state.motivation.current_streak)||0));
  if(streakBestEl)streakBestEl.textContent=String(Math.max(0,Number(state.motivation.best_streak)||0));
  if(goldenCountEl)goldenCountEl.textContent=String(goldenUnits().length);
}
async function loadMotivation(bookId=state.book?.book_id){
  if(state.adminMode||!bookId){
    state.motivation=null;
    renderMotivation();
    return null;
  }
  try{
    const data=await api('/.netlify/functions/progress_summary?section=vocab_motivation&book_id='+encodeURIComponent(bookId)+'&_='+Date.now());
    if(String(bookId)!==String(state.book?.book_id))return data;
    state.motivation=data||null;
    renderMotivation();
    renderUnits();
    return data;
  }catch(error){
    console.warn('[Vocab Study] motivation snapshot unavailable',error);
    return null;
  }
}
function eligibleSkillTotals(){
  return{
    quiz:unitVocabularyWords(state.items).map(w=>w.id).filter(isUuid).length,
    spelling:spellingWords(state.items).map(w=>w.id).filter(isUuid).length,
    speaking:speakingWords(state.items).map(w=>w.id).filter(isUuid).length
  };
}
async function checkGoldenUnit(){
  if(state.adminMode||!state.book?.book_id||!state.unit?.id)return null;
  const totals=eligibleSkillTotals();
  if(totals.quiz<=0||totals.spelling<=0)return null;
  try{
    const result=await api('/.netlify/functions/progress_summary?section=vocab_golden_unit&_='+Date.now(),{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        book_id:state.book.book_id,
        unit_id:state.unit.id,
        quiz_total:totals.quiz,
        spelling_total:totals.spelling,
        speaking_total:totals.speaking
      })
    });
    if(result?.earned_now){
      state.pendingGoldenAward={
        unitId:state.unit.id,
        unitNumber:state.unit.unit_number,
        earnedAt:result?.achievement?.earned_at||new Date().toISOString()
      };
    }
    await loadMotivation(state.book.book_id);
    return result;
  }catch(error){
    console.warn('[Vocab Study] golden unit check unavailable',error);
    return null;
  }
}
function goldenAwardHtml(){
  const award=state.pendingGoldenAward;
  if(!award)return'';
  state.pendingGoldenAward=null;
  return '<div class="vocab-golden-award"><img class="vocab-golden-award-icon" src="/shared/svgs/golden-unit.svg" alt=""><div><strong>Golden Unit earned!</strong><span>Unit '+escapeHtml(award.unitNumber||'')+' is mastered.</span></div></div>';
}

function wireShellNavigation(){
  if(state.shellWired)return;
  state.shellWired=true;
  frontWordTestCardEl?.addEventListener('click',openWordTestScreen);
  bookBackBtn?.addEventListener('click',()=>setMainScreen('home'));
  wordTestBackBtn?.addEventListener('click',()=>setMainScreen('home'));
  frontBookListEl?.addEventListener('click',event=>{
    const btn=event.target?.closest?.('[data-front-book]');
    if(!btn||!frontBookListEl.contains(btn))return;
    openBookById(btn.dataset.frontBook).catch(error=>{
      console.error('[Vocab Study] book navigation failed',error);
      setStatus(error?.message||'교재를 열지 못했습니다.');
    });
  });
  oldTestsOpenBtn?.addEventListener('click',()=>{
    if(!oldTestsPanelEl)return;
    oldTestsPanelEl.hidden=!oldTestsPanelEl.hidden;
    if(!oldTestsPanelEl.hidden)renderOldWordTests();
  });
}
function setMainScreen(screen){
  state.activeScreen=screen;
  if(frontMenuEl)frontMenuEl.hidden=screen!=='home';
  if(bookScreenEl)bookScreenEl.hidden=screen!=='book';
  if(wordTestScreenEl)wordTestScreenEl.hidden=screen!=='wordtest';
  try{window.scrollTo({top:0,behavior:'auto'})}catch(_){}
}
function frontBookRows(){
  const seen=new Set(),rows=[];
  arr(state.books).forEach((loaded,index)=>{
    const id=txt(loaded?.book?.book_id);
    if(!id||seen.has(id))return;
    seen.add(id);
    rows.push({
      bookId:id,
      title:txt(loaded?.book?.book_title||'Book'),
      assignment:state.assignments.find(item=>String(item?.book_id)===String(id))||null,
      index
    });
  });
  arr(state.assignments).forEach((assignment,index)=>{
    const id=txt(assignment?.book_id);
    if(!id||seen.has(id))return;
    seen.add(id);
    rows.push({
      bookId:id,
      title:txt(assignment?.book_title||assignment?.title||'Book'),
      assignment,
      index
    });
  });
  return rows;
}
async function openBookById(bookId){
  const id=txt(bookId);if(!id)return;
  let index=state.books.findIndex(item=>String(item?.book?.book_id)===String(id));
  if(index<0){
    const assignment=state.assignments.find(item=>String(item?.book_id)===String(id));
    if(!assignment)return;
    setStatus('교재를 불러오는 중...');
    const loaded=await loadAssignedBook(assignment);
    if(!loaded)return;
    state.books.push(loaded);
    index=state.books.length-1;
  }
  activateBook(index);
  setMainScreen('book');
}
function renderFrontMenu(){
  if(!frontBookListEl)return;
  const books=frontBookRows();
  frontBookListEl.innerHTML=books.length?books.map(row=>
    '<button class="vocab-front-book-card" type="button" data-front-book="'+escapeHtml(row.bookId)+'">'+
      '<span class="vocab-front-card-main">'+
        '<img class="vocab-front-card-icon" src="/shared/svgs/book-study.svg" alt="" aria-hidden="true">'+
        '<span class="vocab-front-card-copy"><span class="eyebrow">교재 공부</span><strong>'+escapeHtml(row.title)+'</strong><small>단원 · 퀴즈 · 철자 · 말하기</small></span>'+
      '</span>'+
      '<span class="vocab-front-arrow" aria-hidden="true">›</span>'+
    '</button>'
  ).join(''):'<div class="vocab-front-empty">No assigned books found.</div>';
  const current=arr(state.teacherAssignments);
  if(frontWordTestRingEl){
    const modePercents=[];
    current.forEach(row=>{
      const assignment=row?.assignment||{};
      const student=arr(row?.students)[0]||{};
      const modes=arr(assignment.required_modes).length?arr(assignment.required_modes):['quiz','spelling_test','speaking'];
      modes.forEach(mode=>{
        const modeState=student?.modes?.[mode]||{};
        const explicit=Number(modeState.percent);
        const total=Number(modeState.total);
        const clean=Number(modeState.clean);
        const value=Number.isFinite(explicit)
          ? explicit
          : (Number.isFinite(total)&&total>0&&Number.isFinite(clean)?100*clean/total:0);
        modePercents.push(Math.max(0,Math.min(100,value)));
      });
    });
    const overall=modePercents.length?Math.round(modePercents.reduce((sum,value)=>sum+value,0)/modePercents.length):0;
    frontWordTestRingEl.style.setProperty('--progress',overall);
    const ringLabel=frontWordTestRingEl.querySelector('span');
    if(ringLabel)ringLabel.textContent=overall+'%';
    frontWordTestRingEl.setAttribute('aria-label',overall+'% 완료');
  }
  if(frontWordTestCardEl){
    frontWordTestCardEl.hidden=state.adminMode;
    if(frontWordTestMetaEl){
      if(current.length){
        const due=current.map(row=>row?.assignment?.due_at).filter(Boolean).sort()[0];
        frontWordTestMetaEl.textContent='진행 중 '+current.length+'개'+(due?' · 다음 마감 '+formatTeacherDue(due):'');
      }else{
        frontWordTestMetaEl.textContent=state.teacherAssignmentHistory.length?'지난 단어 시험 복습하기':'현재 숙제가 없어요';
      }
    }
  }
}
function assignmentBookId(row){
  return txt(row?.assignment?.list_meta?.source_book_id||row?.assignment?.source_book_id||'');
}
async function resolveAssignmentBookIds(envelopes){
  const rows=arr(envelopes);
  const missing=rows.filter(a=>!txt(a?.list_meta?.source_book_id)&&txt(a?.list_meta?.word_builder_collection_id));
  const ids=unique(missing.map(a=>a.list_meta.word_builder_collection_id));
  if(ids.length){
    try{
      const collections=await content('collections?select=id,book_id&id=in.'+encodeURIComponent('('+ids.join(',')+')'));
      const by={};arr(collections).forEach(row=>{by[txt(row.id)]=txt(row.book_id)});
      rows.forEach(a=>{
        const cid=txt(a?.list_meta?.word_builder_collection_id);
        const bookId=by[cid];
        if(bookId){
          a.list_meta=Object.assign({},a.list_meta||{},{source_book_id:bookId});
        }
      });
    }catch(error){
      console.warn('[Vocab Study] assignment book lookup unavailable',error);
    }
  }
  return rows;
}
function renderOldWordTests(){
  if(!oldTestsBooksEl||!oldTestsListEl)return;
  const history=arr(state.teacherAssignmentHistory);
  const bookMap=new Map();
  history.forEach(row=>{
    const bookId=assignmentBookId(row)||'other';
    if(!bookMap.has(bookId))bookMap.set(bookId,[]);
    bookMap.get(bookId).push(row);
  });
  const knownBooks=frontBookRows();
  const bookTitle=id=>{
    const known=knownBooks.find(b=>String(b.bookId)===String(id));
    if(known)return known.title;
    const row=bookMap.get(id)?.[0];
    return txt(row?.assignment?.title||'Other word tests').replace(/\s+Unit\b.*$/i,'')||'Other word tests';
  };
  const bookIds=[...bookMap.keys()];
  if(oldTestsMetaEl)oldTestsMetaEl.textContent=history.length?('지난 시험 '+history.length+'개 · 교재별 보기'):'지난 단어 시험이 없어요';
  if(!history.length){
    oldTestsBooksEl.innerHTML='';
    oldTestsListEl.innerHTML='<div class="vocab-old-empty">완료한 단어 시험이 여기에 표시됩니다.</div>';
    return;
  }
  if(!state.wordTestBookFilter||!bookMap.has(state.wordTestBookFilter))state.wordTestBookFilter=bookIds[0]||'';
  oldTestsBooksEl.innerHTML=bookIds.map(id=>
    '<button class="vocab-old-book'+(String(id)===String(state.wordTestBookFilter)?' is-active':'')+'" type="button" data-old-book="'+escapeHtml(id)+'">'+escapeHtml(bookTitle(id))+'</button>'
  ).join('');
  const selected=bookMap.get(state.wordTestBookFilter)||[];
  oldTestsListEl.innerHTML=selected.map((row,index)=>{
    const a=row.assignment||{},student=arr(row.students)[0]||{},modes=arr(a.required_modes);
    const starTotal=modes.reduce((sum,mode)=>sum+Math.max(0,Number(student?.modes?.[mode]?.stars)||0),0);
    const starMax=modes.length*10;
    return '<article class="vocab-old-test-row">'+
      '<div><strong>'+escapeHtml(a.title||'Word Test')+'</strong><small>'+teacherAssignmentWords(row).length+' words'+(a.due_at?' · '+escapeHtml(formatTeacherDue(a.due_at)):'')+'</small></div>'+
      '<span>★ '+starTotal+'/'+starMax+'</span>'+
    '</article>';
  }).join('');
  oldTestsBooksEl.querySelectorAll('[data-old-book]').forEach(btn=>btn.addEventListener('click',()=>{
    state.wordTestBookFilter=btn.dataset.oldBook||'';
    renderOldWordTests();
  }));
}
function openWordTestScreen(){
  renderTeacherAssignments();
  renderOldWordTests();
  setMainScreen('wordtest');
}
function formatTeacherDue(value){
  const d=new Date(value||'');
  if(Number.isNaN(d.getTime()))return'';
  try{return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}catch(_){return''}
}
function teacherAssignmentWords(row){
  return arr(row?.targets).map((target,index)=>{
    const id=txt(target?.lexical_entry_id),word=txt(target?.english),ko=txt(target?.korean);
    return id&&word&&ko?{id,word,ko,position:Number(target?.position)||index}:null;
  }).filter(Boolean);
}
function teacherAssignmentActivities(row){
  const items=teacherAssignmentWords(row);
  const koPool=unique(items.map(x=>x.ko)),enPool=unique(items.map(x=>x.word)),out=[];
  items.forEach((item,index)=>{
    const koChoices=shuffle(unique([item.ko,...shuffle(koPool.filter(x=>x!==item.ko)).slice(0,3)]));
    if(koChoices.length>=2)out.push({
      id:'teacher-vocab-en-ko-'+item.id+'-'+index,sourceType:'lexical_entry',sourceId:item.id,skill:'vocabulary',
      stimulus:{type:'text',prompt:item.word,context:'한국어 뜻을 고르세요.'},
      response:{type:'multiple_choice',choices:koChoices},answer:item.ko,
      metadata:{lexical_entry_id:item.id,canonical_lookup:item.word,translation_ko:item.ko,pair_form:'en_ko',pool_source:'teacher_assignment'}
    });
    const enChoices=shuffle(unique([item.word,...shuffle(enPool.filter(x=>x!==item.word)).slice(0,3)]));
    if(enChoices.length>=2)out.push({
      id:'teacher-vocab-ko-en-'+item.id+'-'+index,sourceType:'lexical_entry',sourceId:item.id,skill:'vocabulary',
      stimulus:{type:'text',prompt:item.ko,context:'알맞은 영어 표현을 고르세요.'},
      response:{type:'multiple_choice',choices:enChoices},answer:item.word,
      metadata:{lexical_entry_id:item.id,canonical_lookup:item.word,translation_ko:item.ko,pair_form:'ko_en',pool_source:'teacher_assignment'}
    });
  });
  return out;
}
function renderTeacherAssignments(){
  if(!teacherPracticeEl||!teacherPracticeListEl)return;
  if(state.adminMode||!state.teacherAssignments.length){
    teacherPracticeEl.hidden=true;
    teacherPracticeListEl.innerHTML='';
    if(wordTestEmptyEl)wordTestEmptyEl.hidden=state.adminMode;
    return;
  }
  teacherPracticeEl.hidden=false;
  if(wordTestEmptyEl)wordTestEmptyEl.hidden=true;
  if(teacherPracticeCountEl)teacherPracticeCountEl.textContent=state.teacherAssignments.length+' assignment'+(state.teacherAssignments.length===1?'':'s');
  teacherPracticeListEl.innerHTML=state.teacherAssignments.map((row,index)=>{
    const a=row.assignment||{},student=arr(row.students)[0]||{},modes=arr(a.required_modes);
    const labels={quiz:'Quiz',spelling_test:'Spelling',speaking:'Speaking'};
    const modeClasses={quiz:'vocab-skill-quiz',spelling_test:'vocab-skill-spelling',speaking:'vocab-skill-pronunciation'};
    const modeHtml=modes.map(mode=>{
      const m=student.modes?.[mode]||{};
      const complete=Number(m.total)>0&&Number(m.clean)>=Number(m.total);
      const progress=Number(m.total)>0?Math.round(100*Number(m.clean||0)/Number(m.total)):0;
      const stars=Math.max(0,Math.min(10,Number(m.stars)||0));
      return '<button class="vocab-teacher-mode vocab-skill-card '+escapeHtml(modeClasses[mode]||'')+(complete?' is-complete':'')+'" type="button" data-teacher-assignment="'+index+'" data-teacher-mode="'+escapeHtml(mode)+'">'+
        '<span class="vocab-skill-ring" style="--progress:'+progress+'"><span>'+progress+'%</span></span>'+
        '<span class="vocab-skill-copy"><strong>'+escapeHtml(labels[mode]||mode)+'</strong><span class="vocab-teacher-stars" aria-label="'+stars+' out of 10 stars">★ '+stars+'/10</span></span>'+
      '</button>';
    }).join('');
    return '<article class="vocab-teacher-card">'+
      '<div class="vocab-teacher-card-title"><strong>'+escapeHtml(a.title||'Vocabulary Practice')+'</strong><small>'+teacherAssignmentWords(row).length+' words'+(a.due_at?' · Due '+escapeHtml(formatTeacherDue(a.due_at)):'')+'</small></div>'+
      '<div class="vocab-teacher-modes">'+modeHtml+'</div>'+
    '</article>';
  }).join('');
  teacherPracticeListEl.querySelectorAll('[data-teacher-assignment]').forEach(btn=>btn.addEventListener('click',()=>{
    const row=state.teacherAssignments[Number(btn.dataset.teacherAssignment)];
    if(row)startTeacherAssignment(row,btn.dataset.teacherMode);
  }));
}
async function loadTeacherAssignments(){
  if(state.adminMode)return[];
  try{
    const list=await api('/.netlify/functions/homework_api?action=list_assignments&mode=student&include_history=1&_='+Date.now());
    const envelopes=await resolveAssignmentBookIds(arr(list.assignments).filter(a=>txt(a?.source_type)==='vocab_study'));
    const hydrated=[];
    for(const assignment of envelopes){
      try{
        const row=await api('/.netlify/functions/homework_api?action=vocab_assignment_progress&assignment_id='+encodeURIComponent(assignment.id)+'&_='+Date.now());
        if(row?.success){
          row.assignment=Object.assign({},row.assignment||{},{
            list_meta:assignment.list_meta||{},
            list_key:assignment.list_key||null,
            active:assignment.active,
            ended_at:assignment.ended_at||null,
            status:assignment.status||row.assignment?.status
          });
          hydrated.push(row);
        }
      }catch(error){
        console.warn('[Vocab Study] word test assignment unavailable',assignment?.id,error);
      }
    }
    state.teacherAssignments=hydrated.filter(row=>row?.assignment?.active!==false&&!row?.assignment?.ended_at);
    state.teacherAssignmentHistory=hydrated.filter(row=>row?.assignment?.active===false||!!row?.assignment?.ended_at);
    renderTeacherAssignments();
    renderOldWordTests();
    renderFrontMenu();
    return state.teacherAssignments;
  }catch(error){
    console.warn('[Vocab Study] word test assignments unavailable',error);
    state.teacherAssignments=[];
    state.teacherAssignmentHistory=[];
    renderTeacherAssignments();
    renderOldWordTests();
    renderFrontMenu();
    return[];
  }
}
function teacherTitle(mode){
  const title=txt(state.activeTeacherAssignment?.assignment?.title||'Word Test Study');
  const suffix={quiz:'Quiz',spelling_test:'Spelling Test',speaking:'Speaking'}[mode]||'Practice';
  return title+' · '+suffix;
}
function startTeacherAssignment(row,mode){
  const words=teacherAssignmentWords(row);
  if(!words.length)return;
  state.activeTeacherAssignment=row;
  state.activeTeacherItems=teacherAssignmentActivities(row);
  state.progressSnapshot=null;
  if(mode==='quiz')startSession(state.activeTeacherItems,{teacher:true});
  else if(mode==='spelling_test')openSpellingTest({teacherWords:words});
  else if(mode==='speaking')openSpeakingSession({teacherWords:words});
}

function ringPercent(value){
  return Math.max(0,Math.min(100,Math.round(Number(value)||0)));
}
function setSkillRing(ring,value){
  if(!ring)return;
  const pct=ringPercent(value);
  ring.style.setProperty('--progress',pct);
  const label=ring.querySelector('span');
  if(label)label.textContent=pct+'%';
}
function starsText(count){
  const n=Math.max(0,Math.min(5,Math.round(Number(count)||0)));
  return '★'.repeat(n)+'☆'.repeat(5-n);
}
function setSkillCardStars({skill,ids,starsEl}){
  const stars=snapshotStars(state.progressSnapshot,skill,ids);
  if(starsEl){
    starsEl.textContent=starsText(stars);
    starsEl.setAttribute('aria-label',stars+' out of 5 stars');
  }
}
function renderSkillProgress(){
  const vocabIds=unitVocabularyWords(state.items).map(w=>w.id).filter(isUuid);
  const spellingIds=spellingWords(state.items).map(w=>w.id).filter(isUuid);
  const speakingIds=speakingWords(state.items).map(w=>w.id).filter(isUuid);
  setSkillRing(quizRingEl,snapshotPercent(state.progressSnapshot,'vocabulary',vocabIds));
  setSkillRing(spellingRingEl,snapshotPercent(state.progressSnapshot,'spelling',spellingIds));
  setSkillRing(speakingRingEl,snapshotPercent(state.progressSnapshot,'speaking',speakingIds));
  setSkillCardStars({skill:'vocabulary',ids:vocabIds,starsEl:quizStarsEl});
  setSkillCardStars({skill:'spelling',ids:spellingIds,starsEl:spellingStarsEl});
  setSkillCardStars({skill:'speaking',ids:speakingIds,starsEl:speakingStarsEl});
}
async function loadSkillProgress(){
  const bookId=state.book?.book_id,unitId=state.unit?.id;
  state.progressSnapshot=null;
  renderSkillProgress();
  if(state.adminMode||!bookId||!unitId)return;
  try{
    const data=await timed('progress snapshot '+bookId+' unit '+unitId,()=>loadVocabSnapshot(bookId,unitId));
    if(String(bookId)!==String(state.book?.book_id)||String(unitId)!==String(state.unit?.id))return;
    state.progressSnapshot=data||null;
    renderSkillProgress();
  }catch(error){
    console.warn('[Vocab Study] progress snapshot unavailable',error);
  }
}
async function ensureProgressSnapshot(){
  if(state.adminMode)return state.progressSnapshot;
  if(state.progressSnapshot)return state.progressSnapshot;
  const bookId=state.book?.book_id,unitId=state.unit?.id;
  if(!bookId||!unitId)return null;
  try{
    const data=await loadVocabSnapshot(bookId,unitId);
    if(String(bookId)!==String(state.book?.book_id)||String(unitId)!==String(state.unit?.id))return null;
    state.progressSnapshot=data||null;
    renderSkillProgress();
    return state.progressSnapshot;
  }catch(error){
    console.warn('[Vocab Study] progress snapshot unavailable',error);
    return null;
  }
}


function isUuid(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(txt(value))}
function recordVocabAttempt({skill,responseType,lexicalEntryId,activityId,prompt,studentAnswer,correctAnswer,correct,metadata,hintsUsed=0,retryCount=0,attemptNumber=1,sessionSource='student'}){
  if(state.adminMode)return;
  const pointValue=vocabPointValue(skill,responseType,{correct,hintsUsed,metadata});
  noteRewardAttempt(correct,retryCount,pointValue);
  const pointOrigin=pointValue>0
    ? (state.pointTapOrigin||capturePointOrigin(root?.querySelector?.('.question-card')||root||actionBtn))
    : null;
  state.pointTapOrigin=null;
  if(pointValue>0)showPointAward({amount:pointValue,origin:pointOrigin}).catch(()=>{});

  const lexicalId=isUuid(lexicalEntryId)?txt(lexicalEntryId):null;
  const teacher=state.activeTeacherAssignment;
  const baseMeta=Object.assign({
    book_id:teacher?(teacher?.assignment?.book_id||null):(state.book?.book_id||null),
    unit_id:teacher?(teacher?.assignment?.unit_id||null):(state.unit?.id||null),
    lexical_entry_id:lexicalId,
    mastery_content_type:'lexical_entry',
    mastery_content_id:lexicalId,
    vocab_study:true,
    points_override:pointValue,
    assignment_id:teacher?.assignment?.id||null
  },metadata||{});

  const recorder=window.WillenaStudyProgress;
  if(!recorder||typeof recorder.record!=='function'){
    console.warn('[Vocab Study] canonical study recorder unavailable');
    return;
  }

  const detail={
    activity:{
      id:txt(activityId)||('vocab-study-'+skill),
      skill:txt(skill),
      sourceType:'lexical_entry',
      sourceId:lexicalId,
      stimulus:{type:'text',prompt:txt(prompt)},
      response:{type:txt(responseType)},
      answer:correctAnswer,
      metadata:baseMeta
    },
    result:{selected:studentAnswer,answer:correctAnswer,correct:!!correct,score:correct?1:0},
    responseTimeMs:state.questionStartedAt?Math.max(0,Date.now()-state.questionStartedAt):0,
    hintsUsed:Math.max(0,Number(hintsUsed)||0),
    retryCount:Math.max(0,Number(retryCount)||0),
    attemptNumber:Math.max(1,Number(attemptNumber)||1),
    sessionSource:teacher?'teacher':(txt(sessionSource)||'student')
  };

  const save=recorder.record(detail);
  if(teacher&&save&&typeof save.then==='function'){
    state.pendingTeacherRecords.add(save);
    save.finally(()=>state.pendingTeacherRecords.delete(save));
  }
}


async function api(url,opts){
  const fn=window.WillenaAPI&&typeof window.WillenaAPI.fetch==='function'?window.WillenaAPI.fetch.bind(window.WillenaAPI):window.fetch.bind(window);
  const r=await fn(url,Object.assign({credentials:'include',cache:'no-store'},opts||{}));
  const d=await r.json().catch(()=>({}));
  if(!r.ok||(d&&d.success===false))throw new Error(d&&d.error||('Request failed ('+r.status+').'));
  return d;
}
async function whoami(){return api('/.netlify/functions/supabase_auth?action=whoami&_='+Date.now())}
async function fetchAssignmentsNetwork(className){
  const r=await fetch(OP_URL+'/rest/v1/rpc/get_study_assignment_for_class',{
    method:'POST',headers:{apikey:OP_KEY,Authorization:'Bearer '+OP_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({p_class_name:className}),cache:'no-store'
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.success)throw new Error(d.error||'Could not load assigned books.');
  return d;
}
async function assignments(className){
  const cached=getAssignment(className);
  if(cached){
    markPerf('assignment cache',0);
    background(async()=>{
      const fresh=await fetchAssignmentsNetwork(className);
      setAssignment(className,fresh);
    },'assignment revalidate');
    return cached;
  }
  const fresh=await timed('assignment lookup',()=>fetchAssignmentsNetwork(className));
  setAssignment(className,fresh);
  return fresh;
}
async function content(path){
  const out=[];let offset=0;const pageSize=1000;
  while(true){
    const sep=path.includes('?')?'&':'?';
    const r=await fetch(CONTENT_URL+'/rest/v1/'+path+sep+'limit='+pageSize+'&offset='+offset,{
      headers:{apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY},cache:'no-store'
    });
    if(!r.ok)throw new Error('Content DB '+r.status);
    const rows=await r.json();
    if(!Array.isArray(rows))throw new Error('Content DB returned invalid data.');
    out.push(...rows);
    if(rows.length<pageSize)break;
    offset+=pageSize;
    if(offset>100000)throw new Error('Content DB pagination safety limit exceeded.');
  }
  return out;
}

function resolveUnit(rows,assignment){
  if(!rows.length)return null;
  let saved='';try{saved=localStorage.getItem('willena-study-v2-unit:'+assignment.book_id)||''}catch(_){}
  const hint=saved||assignment.current_unit||assignment.starting_unit||'';
  const n=(String(hint).match(/\d+/)||[])[0];
  return rows.find(u=>String(u.id)===String(hint)||String(u.unit_number)===String(n))||rows[0];
}
function adminParams(){
  const p=new URLSearchParams(location.search);
  return{enabled:p.get('admin')==='1',bookId:txt(p.get('book_id')),unit:txt(p.get('unit'))};
}
async function requireAdminMode(){
  const params=adminParams();
  if(adminPickerEl)adminPickerEl.hidden=true;
  if(!params.enabled)return params;
  const who=await whoami();
  if(!who?.success||!who.user_id)throw new Error('Admin preview requires a signed-in administrator.');
  const roleData=await api('/.netlify/functions/supabase_auth?action=get_role&user_id='+encodeURIComponent(who.user_id)+'&_='+Date.now());
  if(txt(roleData?.role).toLowerCase()!=='admin')throw new Error('Admin preview is restricted to administrators.');
  state.adminMode=true;
  return params;
}
async function loadAdminCatalog(selectedId){
  if(!state.adminMode||!adminBookSelect)return;
  const books=await content('content_books?select=id,title,public_level,internal_level_id&status=in.(review,published)&order=title.asc');
  adminBookSelect.innerHTML='<option value="">Choose a book…</option>'+books.map(b=>{
    const level=Number(b.public_level)||Number(b.internal_level_id)||'';
    return '<option value="'+String(b.id).replace(/"/g,'&quot;')+'"'+(String(b.id)===String(selectedId)?' selected':'')+'>'+String(b.title||'Untitled book')+(level?' · L'+level:'')+'</option>';
  }).join('');
  adminPickerEl.hidden=false;
  adminBookSelect.onchange=()=>{
    const id=txt(adminBookSelect.value);if(!id)return;
    const p=new URLSearchParams(location.search);p.set('admin','1');p.set('book_id',id);p.delete('unit');location.search=p.toString();
  };
}
async function resolveAdminBookAndUnit(params){
  if(!params.bookId)throw new Error('Choose a book above to start admin preview.');
  const [books,units]=await Promise.all([
    content('content_books?select=id,title,public_level,internal_level_id&id=eq.'+encodeURIComponent(params.bookId)+'&status=in.(review,published)'),
    content('content_units?select=id,unit_number,title,metadata&book_id=eq.'+encodeURIComponent(params.bookId)+'&status=in.(review,published)&order=unit_number.asc')
  ]);
  const meta=books[0];if(!meta)throw new Error('That book could not be found.');
  if(!units.length)throw new Error('That book has no available units.');
  let unit=params.unit?units.find(u=>String(u.id)===String(params.unit)||String(u.unit_number)===String(params.unit)):null;
  unit=unit||units[0];
  return{book:{book_id:meta.id,book_title:txt(meta.title||'Vocabulary'),public_level:Number(meta.public_level)||null,internal_level_id:Number(meta.internal_level_id)||null},unit,units};
}
async function fetchBookMetaNetwork(id){
  const [books,units]=await Promise.all([
    content('content_books?select=id,public_level,internal_level_id&id=eq.'+encodeURIComponent(id)+'&status=in.(review,published)'),
    content('content_units?select=id,unit_number,title,metadata&book_id=eq.'+encodeURIComponent(id)+'&status=in.(review,published)&order=unit_number.asc')
  ]);
  return{books,units};
}
async function loadBookMeta(id){
  const cached=getBookMeta(id);
  if(cached){
    markPerf('book/unit metadata cache '+id,0);
    background(async()=>setBookMeta(id,await fetchBookMetaNetwork(id)),'book metadata revalidate');
    return cached;
  }
  const fresh=await timed('book/unit metadata '+id,()=>fetchBookMetaNetwork(id));
  setBookMeta(id,fresh);
  return fresh;
}
async function loadUnitVocabulary(book,unit){
  const cached=getVocabulary(book.book_id,unit.id);
  if(cached){
    markPerf('vocabulary cache '+book.book_id+' unit '+unit.id,0);
    background(async()=>setVocabulary(book.book_id,unit.id,await loadVocabularyItems(book,unit)),'vocabulary revalidate');
    return cached;
  }
  const fresh=await timed('vocabulary '+book.book_id+' unit '+unit.id,()=>loadVocabularyItems(book,unit));
  setVocabulary(book.book_id,unit.id,fresh);
  return fresh;
}
async function loadAssignedBook(assignment){
  if(!assignment?.book_id)return null;
  const id=assignment.book_id;
  const metaPayload=await loadBookMeta(id);
  const books=arr(metaPayload?.books),units=arr(metaPayload?.units);
  const meta=books[0]||{},unit=resolveUnit(units,assignment);
  if(!unit)return null;
  const book=Object.assign({},assignment,{book_id:id,book_title:txt(assignment.book_title||assignment.title||'Vocabulary'),public_level:Number(meta.public_level)||null,internal_level_id:Number(meta.internal_level_id)||null});
  const items=await loadUnitVocabulary(book,unit);
  return{book,unit,units,items};
}
async function hydrateSecondaryBooks(list,activeBookId){
  const remaining=list.filter(item=>String(item?.book_id)!==String(activeBookId));
  if(!remaining.length)return;
  background(async()=>{
    const loaded=(await Promise.all(remaining.map(loadAssignedBook))).filter(Boolean);
    if(!loaded.length)return;
    const current=state.books.find(item=>String(item?.book?.book_id)===String(activeBookId));
    state.books=[...(current?[current]:[]),...loaded];
    state.activeIndex=0;
    renderBookPicker();
    renderFrontMenu();
  },'secondary books');
}
async function resolveAssignedBooks(authData){
  const className=txt(authData?.class);if(!className)throw new Error('No active class is assigned.');
  const a=await assignments(className);
  const list=(Array.isArray(a.assignments)&&a.assignments.length?a.assignments:(a.assignment?[a.assignment]:[])).filter(x=>x&&x.book_id);
  if(!list.length)throw new Error('No active book is assigned.');
  let wanted='';try{wanted=localStorage.getItem(ACTIVE_BOOK_KEY)||''}catch(_){}
  const fallback=a.assignment&&a.assignment.book_id;
  let activeAssignment=list.find(x=>String(x.book_id)===String(wanted||fallback));
  if(!activeAssignment)activeAssignment=list[0];
  const active=await loadAssignedBook(activeAssignment);
  if(!active)throw new Error('No assigned book has available vocabulary units.');
  return{books:[active],assignments:list,activeIndex:0,deferredAssignments:list};
}
function activateBook(index){
  const loaded=state.books[index];if(!loaded)return;
  state.activeIndex=index;state.book=loaded.book;state.unit=loaded.unit;state.units=arr(loaded.units);state.items=loaded.items;
  try{localStorage.setItem(ACTIVE_BOOK_KEY,state.book.book_id)}catch(_){}
  renderHome();
  renderFrontMenu();
}

async function selectUnit(id){
  const unit=state.units.find(u=>String(u.id)===String(id));
  if(!unit||String(unit.id)===String(state.unit?.id))return;
  startBtn.disabled=true;
  if(spellingPreviewBtn)spellingPreviewBtn.disabled=true;
  setStatus('단어를 불러오는 중...');
  try{
    const items=await loadUnitVocabulary(state.book,unit);
    state.unit=unit;
    state.items=items;
    const loaded=state.books[state.activeIndex];
    if(loaded){loaded.unit=unit;loaded.items=items}
    try{localStorage.setItem('willena-study-v2-unit:'+state.book.book_id,unit.id)}catch(_){}
    renderHome();
  }catch(error){
    console.error('[Vocab Study] unit switch',error);
    setStatus(error?.message||'단원을 불러오지 못했습니다.');
    renderHome();
  }
}
function renderUnits(){
  if(!unitStripEl||!currentUnitLabelEl)return;
  const units=arr(state.units);
  currentUnitLabelEl.textContent='현재 · Unit '+(state.unit?.unit_number||'—');
  unitStripEl.innerHTML=units.map(u=>
    '<button class="study-v2-unit'+(String(state.unit?.id)===String(u.id)?' is-current':'')+'" type="button" data-unit-id="'+escapeHtml(u.id)+'">Unit '+escapeHtml(u.unit_number)+(isGoldenUnit(u.id)?'<img class="vocab-unit-gold" src="/shared/svgs/golden-unit.svg" alt="Golden Unit">':'')+'</button>'
  ).join('');
  unitStripEl.querySelectorAll('[data-unit-id]').forEach(btn=>btn.addEventListener('click',()=>selectUnit(btn.dataset.unitId)));
}
function renderBookPicker(){
  if(!bookPickerEl||!bookChoicesEl)return;
  const list=arr(state.books);
  if(state.adminMode||list.length<2){
    bookPickerEl.hidden=true;
    bookChoicesEl.innerHTML='';
    return;
  }
  bookChoicesEl.innerHTML=list.map((loaded,i)=>{
    const title=txt(loaded?.book?.book_title||'Book');
    const active=i===state.activeIndex;
    return '<button class="vocab-book-choice'+(active?' is-active':'')+'" type="button" data-book-index="'+i+'">'+escapeHtml(title)+'</button>';
  }).join('');
  bookChoicesEl.querySelectorAll('[data-book-index]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const index=Number(btn.dataset.bookIndex);
      if(!Number.isInteger(index)||index===state.activeIndex)return;
      activateBook(index);
    });
  });
  bookPickerEl.hidden=false;
}

async function loadExplicitUnitVocabulary(unitId){
  const targets=await content('unit_vocab_targets?select=lexical_entry_id,source_kind,source_collection_id,priority&unit_id=eq.'+encodeURIComponent(unitId)+'&active=eq.true&order=priority.desc');
  const ids=unique(targets.map(row=>row.lexical_entry_id));if(!ids.length)return[];
  const rows=await content('lexical_entries?select=id,canonical_text,translation_ko,emoji&id=in.'+encodeURIComponent('('+ids.join(',')+')')+'&status=in.(review,published)');
  const by={};rows.forEach(r=>by[r.id]=r);
  return targets.map(target=>{
    const e=by[target.lexical_entry_id];if(!e)return null;
    const word=txt(e.canonical_text),ko=txt(e.translation_ko);
    return word&&ko?{
      id:e.id,
      occurrenceId:'unit-vocab-'+e.id,
      word,ko,
      emoji:e.emoji||null,
      source:'unit_vocab_target',
      sourceKind:txt(target.source_kind),
      sourceCollectionId:target.source_collection_id||null,
      priority:Number(target.priority)||0
    }:null;
  }).filter(Boolean);
}
async function loadSourceVocabulary(unitId){
  const occ=await content('source_content_occurrences?select=id,lexical_entry_id,source_text&unit_id=eq.'+encodeURIComponent(unitId)+'&occurrence_type=eq.lexical_entry&status=in.(review,published)');
  const ids=unique(occ.map(o=>o.lexical_entry_id));if(!ids.length)return[];
  const rows=await content('lexical_entries?select=id,canonical_text,translation_ko,emoji&id=in.'+encodeURIComponent('('+ids.join(',')+')')+'&status=in.(review,published)');
  const by={};rows.forEach(r=>by[r.id]=r);
  return occ.map(o=>{const e=by[o.lexical_entry_id];return e?{id:e.id,occurrenceId:o.id,word:txt(e.canonical_text||o.source_text),ko:txt(e.translation_ko),emoji:e.emoji||null,source:'source_content'}:null}).filter(x=>x&&x.word&&x.ko);
}
function legacyUnitNumbers(meta){
  const raw=txt(meta?.legacy?.unit);
  return [...raw.matchAll(/\d+/g)].map(m=>Number(m[0])).filter(Number.isFinite);
}
function isWordTestCollection(row){
  const name=txt(row?.name).toLowerCase();
  const languagePoint=txt(row?.metadata?.legacy?.language_point).toLowerCase();
  const unitNumbers=legacyUnitNumbers(row?.metadata);
  return name.includes('word test')||
    name.includes('wordtest')||
    languagePoint.includes('word test')||
    unitNumbers.length>1;
}
async function loadWordBuilderVocabulary(book,unit){
  const collections=await content('collections?select=id,name,unit_id,metadata&collection_type=eq.word_builder&book_id=eq.'+encodeURIComponent(book.book_id));
  const unitNumber=Number(unit.unit_number);
  const matched=collections.filter(row=>{
    if(isWordTestCollection(row))return false;
    return String(row.unit_id||'')===String(unit.id)||
      (!row.unit_id&&legacyUnitNumbers(row.metadata).includes(unitNumber));
  });
  const collectionIds=unique(matched.map(row=>row.id));if(!collectionIds.length)return[];
  const items=await content('collection_items?select=id,collection_id,content_id,settings&content_type=eq.lexical_entry&collection_id=in.'+encodeURIComponent('('+collectionIds.join(',')+')'));
  const lexIds=unique(items.map(row=>row.content_id));if(!lexIds.length)return[];
  const rows=await content('lexical_entries?select=id,canonical_text,translation_ko,emoji&id=in.'+encodeURIComponent('('+lexIds.join(',')+')')+'&status=in.(review,published)');
  const by={};rows.forEach(r=>by[r.id]=r);
  return items.map(item=>{
    const e=by[item.content_id];if(!e)return null;
    const settings=item.settings&&typeof item.settings==='object'?item.settings:{};
    const word=txt(e.canonical_text||settings.display_english);
    const ko=txt(e.translation_ko||settings.display_korean);
    return word&&ko?{
      id:e.id,
      occurrenceId:'wb-'+item.id,
      word,ko,
      displayWord:txt(settings.display_english),
      displayKo:txt(settings.display_korean),
      emoji:e.emoji||null,
      source:'word_builder'
    }:null;
  }).filter(Boolean);
}
function mergeVocabularyTargets(...groups){
  const map=new Map();
  groups.flat().forEach(item=>{
    if(!item?.id||!item?.word||!item?.ko)return;
    const key=txt(item.id);
    const existing=map.get(key);
    if(!existing||item.source==='source_content')map.set(key,item);
  });
  return [...map.values()];
}
function sourceVocabularyActivities(book,unit,items){
  const out=[],koPool=unique(items.map(x=>x.ko)),enPool=unique(items.map(x=>x.word));
  items.forEach(item=>{
    const koChoices=shuffle(unique([item.ko,...shuffle(koPool.filter(x=>x!==item.ko)).slice(0,3)]));
    if(koChoices.length>=2)out.push({
      id:'vocab-study-en-ko-'+item.occurrenceId,sourceType:'lexical_entry',sourceId:item.id,skill:'vocabulary',
      stimulus:{type:'text',prompt:(item.emoji?item.emoji+'  ':'')+item.word,context:'한국어 뜻을 고르세요.'},
      response:{type:'multiple_choice',choices:koChoices},answer:item.ko,
      metadata:{book_id:book.book_id,unit_id:unit.id,lexical_entry_id:item.id,canonical_lookup:item.word,translation_ko:item.ko,pair_form:'en_ko',pool_source:item.source||'lexical_entry'}
    });
    const enChoices=shuffle(unique([item.word,...shuffle(enPool.filter(x=>x!==item.word)).slice(0,3)]));
    if(enChoices.length>=2)out.push({
      id:'vocab-study-ko-en-'+item.occurrenceId,sourceType:'lexical_entry',sourceId:item.id,skill:'vocabulary',
      stimulus:{type:'text',prompt:item.ko,context:'알맞은 영어 표현을 고르세요.'},
      response:{type:'multiple_choice',choices:enChoices},answer:item.word,
      metadata:{book_id:book.book_id,unit_id:unit.id,lexical_entry_id:item.id,canonical_lookup:item.word,translation_ko:item.ko,pair_form:'ko_en',pool_source:item.source||'lexical_entry'}
    });
  });
  return out;
}
async function loadVocabularyItems(book,unit){
  const explicitRows=await loadExplicitUnitVocabulary(unit.id).catch(e=>{console.warn('[Vocab Study] explicit unit vocabulary unavailable',e);return[]});
  if(explicitRows.length)return sourceVocabularyActivities(book,unit,explicitRows);

  // Fallback for units that have not yet been backfilled into the explicit unit-vocab layer.
  const authoredPromise=window.WillenaStudyQuestionBank
    ?window.WillenaStudyQuestionBank.loadUnit(null,{bookId:book.book_id,unitId:unit.id,bookTitle:book.book_title,unitNumber:Number(unit.unit_number)}).catch(e=>{console.warn('[Vocab Study] authored bank unavailable',e);return[]})
    :Promise.resolve([]);
  const sourcePromise=loadSourceVocabulary(unit.id).catch(e=>{console.warn('[Vocab Study] source vocabulary unavailable',e);return[]});
  const wordBuilderPromise=loadWordBuilderVocabulary(book,unit).catch(e=>{console.warn('[Vocab Study] Word Builder vocabulary unavailable',e);return[]});
  const [authoredRows,sourceRows,wordBuilderRows]=await Promise.all([authoredPromise,sourcePromise,wordBuilderPromise]);
  const lexicalTargets=mergeVocabularyTargets(arr(sourceRows),arr(wordBuilderRows));
  if(lexicalTargets.length)return sourceVocabularyActivities(book,unit,lexicalTargets);
  return arr(authoredRows).filter(a=>a&&a.skill==='vocabulary');
}

function activityKey(item){
  const m=item?.metadata||{};
  return txt(m.lexical_entry_id||item?.sourceId||m.canonical_lookup||m.canonical_text||item?.id);
}
function activityWord(item){
  const m=item?.metadata||{};
  const canonical=txt(m.canonical_lookup||m.canonical_text);
  if(canonical)return canonical;
  const prompt=txt(item?.stimulus?.prompt).replace(/^\S+\s{2}/,'');
  return /[A-Za-z]/.test(prompt)?prompt:txt(item?.answer||prompt);
}
function buildSession(items,size=Infinity){
  const groups=new Map();
  shuffle(items).forEach(item=>{
    const key=activityKey(item);if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(item);
  });
  const keys=shuffle([...groups.keys()]),out=[];
  keys.forEach(key=>{if(out.length<size){const group=groups.get(key);if(group?.length)out.push(group.shift())}});
  if(out.length<size){
    const leftovers=shuffle([...groups.values()].flat());
    for(const item of leftovers){if(out.length>=size)break;out.push(item)}
  }
  return out;
}
function activityToQuestion(item){
  const choices=arr(item?.response?.choices).map(txt).filter(Boolean);
  const correct=txt(item?.answer);
  let correctIndex=choices.findIndex(x=>x===correct);
  if(correctIndex<0){choices.push(correct);correctIndex=choices.length-1}
  return{
    id:txt(item.id),form:'choice',prompt:txt(item?.stimulus?.prompt),context:{},
    choices,answer:[String(correctIndex+1)],input:{language:'mixed'},
    grading:{constraints:{}},metadata:item.metadata||{}
  };
}
function unitVocabularyWords(items){
  const map=new Map();
  arr(items).forEach(item=>{
    const m=item?.metadata||{};
    const prompt=txt(item?.stimulus?.prompt).replace(/^\S+\s{2}/,'');
    const answer=txt(item?.answer);
    let word=txt(m.canonical_lookup||m.canonical_text);
    let ko=txt(m.translation_ko);
    if(!word){
      if(/[A-Za-z]/.test(answer))word=answer;
      else if(/[A-Za-z]/.test(prompt))word=prompt;
    }
    if(!ko){
      if(answer&&!/[A-Za-z]/.test(answer))ko=answer;
      else if(prompt&&!/[A-Za-z]/.test(prompt))ko=prompt;
    }
    if(!word||!ko||!/[A-Za-z]/.test(word))return;
    const key=txt(m.lexical_entry_id||item?.sourceId)||(word.toLowerCase()+'|'+ko);
    if(!map.has(key))map.set(key,{id:key,word,ko});
  });
  return [...map.values()];
}
function openWordList(){
  const words=unitVocabularyWords(state.items);if(!words.length||!wordModalEl)return;
  wordModalMetaEl.textContent='Unit '+state.unit.unit_number+' · '+words.length+' words';
  wordModalListEl.innerHTML=words.map(w=>
    '<div class="vocab-word-row"><strong>'+escapeHtml(w.word)+'</strong><span>'+escapeHtml(w.ko)+'</span></div>'
  ).join('');
  wordModalEl.hidden=false;
  wordModalEl.setAttribute('aria-hidden','false');
  document.body.classList.add('vocab-modal-open');
  wordModalCloseBtn?.focus();
}
function closeWordList(){
  if(!wordModalEl)return;
  wordModalEl.hidden=true;
  wordModalEl.setAttribute('aria-hidden','true');
  document.body.classList.remove('vocab-modal-open');
  wordListOpenBtn?.focus();
}
function renderHome(){
  if(!state.book||!state.unit)return;
  renderBookPicker();
  renderUnits();
  bookTitleEl.textContent=state.book.book_title;
  unitTitleEl.textContent='Unit '+state.unit.unit_number+(state.unit.title?' · '+state.unit.title:'');
  const words=unitVocabularyWords(state.items);
  itemCountEl.textContent=words.length+' words';
  if(wordListOpenBtn)wordListOpenBtn.disabled=!state.items.length;
  startBtn.disabled=!state.items.length;
  if(spellingPreviewBtn)spellingPreviewBtn.disabled=!state.items.length;
  if(pronunciationStartBtn)pronunciationStartBtn.disabled=!speakingWords(state.items).length;
  setStatus(state.items.length?'준비됐어요.':'이 단원에는 사용할 수 있는 단어 문제가 없어요.');
  renderSkillProgress();
  renderMotivation();
  loadSkillProgress();
  loadMotivation(state.book.book_id);
}
function updateProgress(){
  const total=Math.max(1,state.queue.length),current=Math.min(state.index+1,total);
  progressEl.textContent=current+' / '+total;
  progressFill.style.width=(state.index/total*100)+'%';
}
function resetQuestionChrome(){
  state.checked=false;state.nextReadyAt=0;
  actionBtn.disabled=true;actionBtn.textContent='Check Answer';actionBtn.classList.remove('is-next');
  answerNote.hidden=true;answerNote.innerHTML='';
  instructionEl.hidden=false;
  bottomEl.hidden=false;questionStage.hidden=false;
}
function renderQuestion(){
  if(state.index>=state.queue.length)return finishSession();
  resetQuestionChrome();
  const item=state.queue[state.index],q=activityToQuestion(item);
  instructionEl.textContent=txt(item?.stimulus?.context)||'가장 알맞은 답을 고르세요.';
  root.innerHTML='<div class="question-card" id="vocabQuestionHost"></div>';
  const host=el('vocabQuestionHost');
  state.renderer=new QuestionRenderer(host).render(q,{onChange:(_,has)=>{if(!state.checked)actionBtn.disabled=!has}});
  state.questionStartedAt=Date.now();
  updateProgress();
  sessionMain.scrollTop=0;
}
function scheduleRetry(item){
  const key=activityKey(item),count=state.retryCounts.get(key)||0;
  if(count>=1)return;
  state.retryCounts.set(key,count+1);
  const retry=Object.assign({},item,{__vocabRetry:true});
  const insertAt=Math.min(state.queue.length,state.index+4);
  state.queue.splice(insertAt,0,retry);
}
function checkCurrent(){
  if(state.checked){
    if(Date.now()<state.nextReadyAt)return;
    state.index++;
    renderQuestion();
    return;
  }
  const item=state.queue[state.index],renderer=state.renderer;if(!item||!renderer)return;
  const response=renderer.getResponse();
  const selected=Array.isArray(response)?String(response[0]||''):String(response||'');
  if(!selected)return;
  const q=renderer.question,correctIndex=String(q.answer?.[0]||'');
  const correct=selected===correctIndex,correctText=q.choices[Number(correctIndex)-1]||txt(item.answer);
  const key=activityKey(item);
  state.outcomes.set(key,correct);
  if(!correct){state.reviewKeys.add(key);scheduleRetry(item)}
  const retryCount=item?.__vocabRetry?Math.max(1,Number(state.retryCounts.get(key)||1)):0;
  const selectedText=q.choices[Number(selected)-1]||selected;
  recordVocabAttempt({
    skill:'vocabulary',
    responseType:'multiple_choice',
    lexicalEntryId:item?.metadata?.lexical_entry_id||item?.sourceId,
    activityId:item?.id,
    prompt:item?.stimulus?.prompt,
    studentAnswer:selectedText,
    correctAnswer:correctText,
    correct,
    metadata:{
      pair_form:item?.metadata?.pair_form||null,
      retry:!!item?.__vocabRetry,
      vocab_mode:'quiz',
      recorded_from:'vocab-study-quiz'
    },
    retryCount,
    attemptNumber:retryCount+1,
    sessionSource:'student'
  });
  renderer.setDisabled(true);
  renderer.showFeedback({
    correct,
    correctAnswer:[correctText],
    message:correct?'정답입니다!':'정답을 확인해 보세요.'
  });
  state.checked=true;
  state.nextReadyAt=Date.now()+350;
  if(!correct){
    answerNote.hidden=false;
    answerNote.innerHTML='<strong>'+escapeHtml(activityWord(item))+'</strong> = '+escapeHtml(correctText);
  }
  actionBtn.disabled=false;
  actionBtn.classList.add('is-next');
  actionBtn.textContent=state.index>=state.queue.length-1?'Finish':'Next';
  updateProgress();
}
function speakingWords(items){
  return unitVocabularyWords(items).map(word=>{
    const speakingTarget=getSpellingTarget(word.word);
    return speakingTarget&&isSpeakableTarget(speakingTarget)?Object.assign({},word,{speakingTarget}):null;
  }).filter(Boolean);
}
async function openSpeakingSession({teacherWords=null}={}){
  let words;
  if(teacherWords&&teacherWords.length){
    words=shuffle(teacherWords.map(w=>{
      const speakingTarget=getSpellingTarget(w.word);
      return speakingTarget&&isSpeakableTarget(speakingTarget)?Object.assign({},w,{speakingTarget}):null;
    }).filter(Boolean));
  }else{
    await ensureProgressSnapshot();
    words=shuffle(nextSkillTargets(state.progressSnapshot,'speaking',speakingWords(state.items),item=>item?.id,'speaking'));
  }
  if(!words.length)return;
  state.spellingPractice=null;
  state.spellingTest=null;
  state.speakingSession={words,index:0,results:[],checked:false,initialTotal:words.length};
  startRewardSession('speaking');
  titleEl.textContent=state.activeTeacherAssignment?teacherTitle('speaking'):(state.book.book_title+' · Unit '+state.unit.unit_number+' · Speaking');
  sessionEl.hidden=false;
  document.body.classList.add('vocab-session-open');
  renderSpeakingQuestion();
}
function speakingQuestion(word,index){
  return{
    id:'vocab-speaking-'+index,
    form:'speaking',
    prompt:word.ko,
    context:{},
    answer:[word.speakingTarget||word.word],
    input:{language:'en'},
    grading:{constraints:{}}
  };
}
function renderSpeakingQuestion(){
  const session=state.speakingSession;
  if(!session||session.index>=session.words.length)return finishSpeakingSession();
  const word=session.words[session.index],current=session.index+1,total=session.words.length;
  session.checked=false;
  progressEl.textContent=current+' / '+total;
  progressFill.style.width=((current-1)/Math.max(1,total)*100)+'%';
  instructionEl.hidden=false;
  instructionEl.textContent='우리말을 보고 영어로 말해 보세요.';
  answerNote.hidden=true;
  bottomEl.hidden=false;
  actionBtn.disabled=true;
  actionBtn.textContent='Check Answer';
  actionBtn.classList.remove('is-next');
  root.innerHTML='<div class="question-card speaking-card" id="vocabQuestionHost"></div>';
  const host=el('vocabQuestionHost');
  state.renderer=new QuestionRenderer(host).render(speakingQuestion(word,session.index),{
    onChange:(_,has)=>{if(!session.checked)actionBtn.disabled=!has}
  });
  state.questionStartedAt=Date.now();
  sessionMain.scrollTop=0;
}
function checkSpeaking(){
  const session=state.speakingSession,renderer=state.renderer;
  if(!session||!renderer)return;
  if(session.checked){
    session.index++;
    renderSpeakingQuestion();
    return;
  }
  const word=session.words[session.index];
  const response=txt(renderer.getResponse());if(!response)return;
  const target=word.speakingTarget||word.word;
  const alternatives=renderer.getSpeechAlternatives?.()||[response];
  const match=matchSpeakingTarget(target,alternatives);
  const correct=!!match.correct;
  const retryCount=Math.max(0,Number(word.__vocabRetryCount)||0);
  session.results.push({
    lexicalEntryId:word.id||null,
    word:target,
    ko:word.ko,
    response,
    alternatives,
    correct,
    matchedBy:match.matchedBy
  });
  recordVocabAttempt({
    skill:'speaking',
    responseType:'speech',
    lexicalEntryId:word.id,
    activityId:'vocab-speaking-'+word.id,
    prompt:word.ko,
    studentAnswer:response,
    correctAnswer:target,
    correct,
    metadata:{
      stt_alternatives:alternatives,
      stt_match:match.matchedBy||null,
      vocab_mode:'speaking',
      recorded_from:'vocab-study-speaking'
    },
    retryCount,
    attemptNumber:retryCount+1,
    sessionSource:'student'
  });
  if(repeatUntilCorrect(correct))appendRetry(session.words,word);
  renderer.setDisabled(true);
  renderer.showFeedback({
    correct,
    correctAnswer:[target],
    message:correct?'정답입니다!':'다시 확인해 보세요.'
  });
  session.checked=true;
  actionBtn.disabled=false;
  actionBtn.classList.add('is-next');
  actionBtn.textContent=session.index>=session.words.length-1?'Finish':'Next';
}
async function finishSpeakingSession(){
  const session=state.speakingSession;
  const passed=uniquePassedCount(session?.results);
  const total=session?.initialTotal||0;
  const retries=wrongAttemptCount(session?.results);
  const reward=await completeRewardSession();
  progressEl.textContent='완료';
  progressFill.style.width='100%';
  instructionEl.hidden=true;
  answerNote.hidden=true;
  bottomEl.hidden=true;
  root.innerHTML=
    '<section class="vocab-finish">'+
      '<span class="eyebrow">SPEAKING COMPLETE</span>'+
      '<h2>'+passed+' / '+total+'</h2>'+
      '<p>틀린 단어는 맞힐 때까지 다시 말해 봤어요.</p>'+
      '<div class="vocab-finish-stats">'+
        '<div><strong>'+total+'</strong><span>PASSED</span></div>'+
        '<div><strong>'+retries+'</strong><span>RETRIES</span></div>'+
      '</div>'+
      rewardSummaryHtml(reward)+
      goldenAwardHtml()+
      '<div class="vocab-finish-actions"><button id="vocabSpeakingDone" class="vocab-done-btn" type="button">Finish</button></div>'+
    '</section>';
  el('vocabSpeakingDone')?.addEventListener('click',closeSession);
  sessionMain.scrollTop=0;
}

function spellingWords(items){
  return unitVocabularyWords(items).map(word=>{
    const spellingTarget=getSpellingTarget(word.word);
    return spellingTarget?Object.assign({},word,{spellingTarget}):null;
  }).filter(Boolean);
}
function spellingPreviewWords(items){
  return spellingWords(items);
}
function playPreviewWord(word){
  if(!('speechSynthesis' in window))return;
  try{
    speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(word);
    utterance.lang='en-US';
    speechSynthesis.speak(utterance);
  }catch(_){}
}
function createSpellingPractice(words){
  return{words,index:0,currentAttemptCount:0,attempts:[],results:[],initialTotal:words.length};
}
function classifySpellingResult(attempt){
  if(attempt.attemptCount>1)return'retry';
  if(attempt.supportLevel>0)return'supported';
  return'clean';
}
function recordSpellingAttempt(practice,word,renderer,correct){
  practice.currentAttemptCount+=1;
  const attempt={
    lexicalEntryId:word.id||null,
    word:word.spellingTarget||word.word,
    ko:word.ko,
    correct:!!correct,
    supportLevel:Number(renderer?.getSupportLevel?.()||0),
    attemptCount:practice.currentAttemptCount
  };
  practice.attempts.push(attempt);
  if(correct){
    const result=Object.assign({},attempt,{result:classifySpellingResult(attempt)});
    practice.results.push(result);
    practice.currentAttemptCount=0;
    return result;
  }
  return attempt;
}
function spellingSummary(practice){
  const counts={clean:0,supported:0,retry:0};
  arr(practice?.results).forEach(result=>{if(Object.prototype.hasOwnProperty.call(counts,result.result))counts[result.result]++});
  return counts;
}
function openSpellingMenu(){
  const words=spellingWords(state.items);if(!words.length)return;
  state.spellingPractice=null;
  state.renderer=null;
  titleEl.textContent=state.book.book_title+' · Unit '+state.unit.unit_number+' · Spelling';
  progressEl.textContent='';
  progressFill.style.width='0%';
  instructionEl.hidden=true;
  answerNote.hidden=true;
  bottomEl.hidden=true;
  questionStage.hidden=false;

  const total=Math.max(1,words.filter(w=>isUuid(w.id)).length);
  const coachPassed=Number(state.progressSnapshot?.spelling?.coach_passed_count)||0;
  const testPassed=Number(state.progressSnapshot?.spelling?.test_passed_count)||0;
  const coachPct=Math.max(0,Math.min(100,Math.round(coachPassed*100/total)));
  const testPct=Math.max(0,Math.min(100,Math.round(testPassed*100/total)));

  root.innerHTML=
    '<section class="spelling-mode-panel">'+
      '<div class="spelling-mode-grid">'+
        '<button id="vocabSpellingTrainer" class="spelling-mode-card" type="button">'+
          '<span class="vocab-skill-ring spelling-mode-ring" style="--skill-color:var(--pink);--progress:'+coachPct+'"><span>'+coachPct+'%</span></span>'+
          '<strong>철자 코치</strong>'+
        '</button>'+
        '<button id="vocabSpellingTest" class="spelling-mode-card" type="button">'+
          '<span class="vocab-skill-ring spelling-mode-ring" style="--skill-color:var(--pink);--progress:'+testPct+'"><span>'+testPct+'%</span></span>'+
          '<strong>철자 테스트</strong>'+
        '</button>'+
      '</div>'+
    '</section>';
  el('vocabSpellingTrainer')?.addEventListener('click',openSpellingPreview);
  el('vocabSpellingTest')?.addEventListener('click',openSpellingTest);
  sessionEl.hidden=false;
  document.body.classList.add('vocab-session-open');
  sessionMain.scrollTop=0;
}
function spellingTestWords(items){
  return shuffle(spellingWords(items));
}
async function openSpellingTest({teacherWords=null}={}){
  let words;
  if(teacherWords&&teacherWords.length){
    words=shuffle(teacherWords.map(w=>{
      const spellingTarget=getSpellingTarget(w.word);
      return spellingTarget?Object.assign({},w,{spellingTarget}):null;
    }).filter(Boolean));
  }else{
    await ensureProgressSnapshot();
    words=shuffle(nextSkillTargets(state.progressSnapshot,'spelling',spellingTestWords(state.items),item=>item?.id,'spelling_test'));
  }
  if(!words.length)return;
  state.spellingPractice=null;
  state.spellingTest={words,index:0,results:[],checked:false,initialTotal:words.length};
  startRewardSession('spelling_test');
  titleEl.textContent=state.activeTeacherAssignment?teacherTitle('spelling_test'):(state.book.book_title+' · Unit '+state.unit.unit_number+' · Spelling Test');
  instructionEl.hidden=false;
  instructionEl.textContent='우리말을 보고 영어 철자를 입력하세요.';
  answerNote.hidden=true;
  questionStage.hidden=false;
  bottomEl.hidden=false;
  sessionEl.hidden=false;
  document.body.classList.add('vocab-session-open');
  renderSpellingTestQuestion();
}
function spellingTestQuestion(word,index){
  return{
    id:'vocab-spelling-test-'+index,
    form:'write',
    prompt:word.ko,
    context:{},
    answer:[word.spellingTarget||word.word],
    input:{language:'en'},
    grading:{constraints:{}}
  };
}
function renderSpellingTestQuestion(){
  const test=state.spellingTest;
  if(!test||test.index>=test.words.length)return finishSpellingTest();
  const word=test.words[test.index],current=test.index+1,total=test.words.length;
  test.checked=false;
  progressEl.textContent=current+' / '+total;
  progressFill.style.width=((current-1)/Math.max(1,total)*100)+'%';
  instructionEl.hidden=false;
  instructionEl.textContent='우리말을 보고 영어 철자를 입력하세요.';
  answerNote.hidden=true;
  bottomEl.hidden=false;
  actionBtn.disabled=true;
  actionBtn.textContent='Check Answer';
  actionBtn.classList.remove('is-next');
  root.innerHTML='<div class="question-card spelling-test-card" id="vocabQuestionHost"></div>';
  const host=el('vocabQuestionHost');
  state.renderer=new QuestionRenderer(host).render(spellingTestQuestion(word,test.index),{
    onChange:(_,has)=>{if(!test.checked)actionBtn.disabled=!has}
  });
  state.questionStartedAt=Date.now();
  host.querySelector('[data-write]')?.focus();
  sessionMain.scrollTop=0;
}
function checkSpellingTest(){
  const test=state.spellingTest,renderer=state.renderer;
  if(!test||!renderer)return;
  if(test.checked){
    test.index++;
    renderSpellingTestQuestion();
    return;
  }
  const word=test.words[test.index];
  const response=txt(renderer.getResponse());
  if(!response)return;
  const target=word.spellingTarget||word.word;
  const correct=response.toLowerCase()===target.toLowerCase();
  const retryCount=Math.max(0,Number(word.__vocabRetryCount)||0);
  test.results.push({lexicalEntryId:word.id||null,word:target,ko:word.ko,response,correct});
  recordVocabAttempt({
    skill:'spelling',
    responseType:'write',
    lexicalEntryId:word.id,
    activityId:'vocab-spelling-test-'+word.id,
    prompt:word.ko,
    studentAnswer:response,
    correctAnswer:target,
    correct,
    metadata:{
      cold_test:true,
      vocab_mode:'spelling_test',
      recorded_from:'vocab-study-spelling-test'
    },
    retryCount,
    attemptNumber:retryCount+1,
    sessionSource:'student'
  });
  if(repeatUntilCorrect(correct))appendRetry(test.words,word);
  renderer.setDisabled(true);
  renderer.showFeedback({
    correct,
    correctAnswer:[target],
    message:correct?'정답입니다!':'정답을 확인해 보세요.'
  });
  test.checked=true;
  actionBtn.disabled=false;
  actionBtn.classList.add('is-next');
  actionBtn.textContent=test.index>=test.words.length-1?'Finish':'Next';
}
async function finishSpellingTest(){
  const test=state.spellingTest;
  const passed=uniquePassedCount(test?.results);
  const total=test?.initialTotal||0;
  const retries=wrongAttemptCount(test?.results);
  const reward=await completeRewardSession();
  progressEl.textContent='완료';
  progressFill.style.width='100%';
  instructionEl.hidden=true;
  answerNote.hidden=true;
  bottomEl.hidden=true;
  root.innerHTML=
    '<section class="vocab-finish">'+
      '<span class="eyebrow">SPELLING TEST COMPLETE</span>'+
      '<h2>'+passed+' / '+total+'</h2>'+
      '<p>모든 단어를 맞힐 때까지 다시 해봤어요.</p>'+
      '<div class="vocab-finish-stats">'+
        '<div><strong>'+total+'</strong><span>PASSED</span></div>'+
        '<div><strong>'+retries+'</strong><span>RETRIES</span></div>'+
      '</div>'+
      rewardSummaryHtml(reward)+
      goldenAwardHtml()+
      '<div class="vocab-finish-actions"><button id="vocabSpellingTestDone" class="vocab-done-btn" type="button">Finish</button></div>'+
    '</section>';
  el('vocabSpellingTestDone')?.addEventListener('click',closeSession);
  sessionMain.scrollTop=0;
}

async function openSpellingPreview(){
  await ensureProgressSnapshot();
  const words=nextSkillTargets(state.progressSnapshot,'spelling',spellingPreviewWords(state.items),item=>item?.id,'spelling_coach');if(!words.length)return;
  state.spellingPractice=createSpellingPractice(words);
  titleEl.textContent=state.book.book_title+' · Unit '+state.unit.unit_number+' · Spelling';
  progressEl.textContent='Practice';
  progressFill.style.width='0%';
  instructionEl.hidden=true;
  answerNote.hidden=true;
  bottomEl.hidden=true;
  questionStage.hidden=false;
  root.innerHTML=
    '<section class="practice-panel">'+
      '<div class="practice-toolbar">'+
        '<div><span class="eyebrow">SPELLING COACH</span><h2>단어를 보고 들어보세요</h2><small class="section-note">힌트를 쓴 단어는 마지막에 한 번 더 해요.</small></div>'+
      '</div>'+
      '<div class="lesson-word-grid">'+
        words.map((w,i)=>
          '<div class="lesson-word">'+
            '<button class="speak-mini" type="button" data-preview-word="'+i+'" aria-label="'+escapeHtml(w.spellingTarget||w.word)+' 듣기">▶</button>'+
            '<div><strong>'+escapeHtml(w.spellingTarget||w.word)+'</strong><span>'+escapeHtml(w.ko)+'</span></div>'+
          '</div>'
        ).join('')+
      '</div>'+
      '<div class="activity-actions"><button id="vocabStartSpelling" class="primary-button" type="button">Start Coach</button></div>'+
    '</section>';
  root.querySelectorAll('[data-preview-word]').forEach(btn=>btn.addEventListener('click',()=>{
    const w=words[Number(btn.dataset.previewWord)];if(w)playPreviewWord(w.spellingTarget||w.word);
  }));
  el('vocabStartSpelling')?.addEventListener('click',startSpellingPractice);
  sessionEl.hidden=false;
  document.body.classList.add('vocab-session-open');
  sessionMain.scrollTop=0;
}

function startSpellingPractice(){
  const practice=state.spellingPractice;
  if(!practice?.words?.length)return;
  startRewardSession('spelling_coach');
  practice.index=0;
  practice.currentAttemptCount=0;
  practice.attempts=[];
  practice.results=[];
  renderSpellingCoach();
}
function spellingCoachQuestion(word,index){
  return{
    id:'vocab-spelling-coach-'+index,
    form:'spelling_coach',
    prompt:word.ko,
    context:{target_en:word.spellingTarget||word.word,audio_text:word.spellingTarget||word.word},
    answer:[word.spellingTarget||word.word],
    hints:{scramble:true,chunks:true},
    input:{language:'en'},
    grading:{constraints:{}}
  };
}
function renderSpellingCoach(){
  const practice=state.spellingPractice;
  if(!practice||practice.index>=practice.words.length)return finishSpellingPractice();
  const word=practice.words[practice.index];
  const current=practice.index+1,total=practice.words.length;
  progressEl.textContent=current+' / '+total;
  progressFill.style.width=((current-1)/Math.max(1,total)*100)+'%';
  instructionEl.hidden=true;
  bottomEl.hidden=false;
  answerNote.hidden=true;
  actionBtn.disabled=true;
  actionBtn.textContent='Check Answer';
  actionBtn.classList.remove('is-next');
  root.innerHTML='<div class="question-card" id="vocabQuestionHost"></div>';
  const host=el('vocabQuestionHost');
  state.renderer=new QuestionRenderer(host).render(spellingCoachQuestion(word,practice.index),{
    onChange:(_,has)=>{actionBtn.disabled=!has}
  });
  state.questionStartedAt=Date.now();
  host.querySelector('[data-spelling-input]')?.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&state.renderer?.hasResponse()){e.preventDefault();state.pointTapOrigin=capturePointOrigin(e.currentTarget);checkSpellingCoach()}
  });
  sessionMain.scrollTop=0;
}
function checkSpellingCoach(){
  const practice=state.spellingPractice,renderer=state.renderer;
  if(!practice||!renderer)return;
  const word=practice.words[practice.index];
  const response=txt(renderer.getResponse());
  if(!response)return;
  const target=word.spellingTarget||word.word;
  const correct=response.toLowerCase()===target.toLowerCase();
  const result=recordSpellingAttempt(practice,word,renderer,correct);
  const supportLevel=Number(result?.supportLevel||0);
  const retryCount=Math.max(0,Number(word.__vocabRetryCount)||0)+Math.max(0,Number(result?.attemptCount||1)-1);
  const flow=coachAttempt({correct,supportLevel});
  recordVocabAttempt({
    skill:'spelling',
    responseType:'write',
    lexicalEntryId:word.id,
    activityId:'vocab-spelling-coach-'+word.id,
    prompt:word.ko,
    studentAnswer:response,
    correctAnswer:target,
    correct,
    metadata:{
      vocab_mode:'spelling_coach',
      assisted:flow.assisted,
      support_level:supportLevel,
      retry:retryCount>0,
      recorded_from:'vocab-study-spelling-coach'
    },
    hintsUsed:supportLevel,
    retryCount,
    attemptNumber:retryCount+1,
    sessionSource:'student'
  });
  if(!correct){
    renderer.showFeedback({correct:false,correctAnswer:[],message:'다시 해보세요.'});
    return;
  }
  if(flow.repeat)appendRetry(practice.words,word);
  renderer.setDisabled(true);
  renderer.showFeedback({
    correct:true,
    correctAnswer:[target],
    message:flow.repeat?'도움을 받았어요. 마지막에 한 번 더 해볼게요.':'정답입니다!'
  });
  actionBtn.disabled=true;
  setTimeout(()=>{practice.index++;renderSpellingCoach()},350);
}
async function finishSpellingPractice(){
  const practice=state.spellingPractice;
  const passedIds=new Set(arr(practice?.results).filter(r=>Number(r.supportLevel||0)===0).map(r=>txt(r.lexicalEntryId||r.word)).filter(Boolean));
  const supported=arr(practice?.results).filter(r=>Number(r.supportLevel||0)>0).length;
  const wrongs=arr(practice?.attempts).filter(r=>!r.correct).length;
  const total=practice?.initialTotal||0;
  const reward=state.rewardSession;
  if(reward){
    reward.completed=true;
    reward.stars=0;
    reward.percent=rewardPercent(reward);
  }
  progressEl.textContent='완료';
  progressFill.style.width='100%';
  bottomEl.hidden=true;
  root.innerHTML=
    '<section class="vocab-finish">'+
      '<span class="eyebrow">SPELLING COACH COMPLETE</span>'+
      '<h2>'+passedIds.size+' / '+total+'</h2>'+
      '<p>모든 단어를 도움 없이 한 번씩 완성했어요.</p>'+
      '<div class="vocab-finish-stats">'+
        '<div><strong>'+total+'</strong><span>PASSED</span></div>'+
        '<div><strong>'+supported+'</strong><span>HELPED</span></div>'+
        '<div><strong>'+wrongs+'</strong><span>RETRIES</span></div>'+
      '</div>'+
      rewardSummaryHtml(reward,{pointsOnly:true})+
      '<div class="vocab-finish-actions"><button id="vocabSpellingDone" class="vocab-done-btn" type="button">Finish</button></div>'+
    '</section>';
  el('vocabSpellingDone')?.addEventListener('click',closeSession);
}

function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function startSession(items=null,{teacher=false}={}){
  let source=items&&items.length?items:null;
  if(!source){
    await ensureProgressSnapshot();
    source=nextSkillTargets(state.progressSnapshot,'vocabulary',state.items,activityKey,'quiz');
  }
  if(!source.length)return;
  state.queue=buildSession(source);
  startRewardSession('quiz');
  state.index=0;state.outcomes=new Map();state.reviewKeys=new Set();state.retryCounts=new Map();
  titleEl.textContent=teacher?teacherTitle('quiz'):(state.book.book_title+' · Unit '+state.unit.unit_number);
  sessionEl.hidden=false;document.body.classList.add('vocab-session-open');
  renderQuestion();
}
function reviewSession(){
  const wanted=new Set(state.reviewKeys);
  const source=state.activeTeacherAssignment?state.activeTeacherItems:state.items;
  const reviewItems=source.filter(item=>wanted.has(activityKey(item)));
  if(!reviewItems.length)return closeSession();
  startSession(reviewItems);
}
async function finishSession(){
  const reward=await completeRewardSession();
  progressFill.style.width='100%';
  progressEl.textContent='완료';
  bottomEl.hidden=true;
  const studied=[...state.outcomes.keys()];
  const review=[...state.reviewKeys];
  const solid=Math.max(0,studied.length-review.length);
  const reviewWords=review.map(key=>{
    const item=state.items.find(x=>activityKey(x)===key);
    return item?activityWord(item):key;
  }).filter(Boolean);
  questionStage.hidden=false;
  instructionEl.hidden=true;
  instructionEl.textContent='';
  root.innerHTML=
    '<section class="vocab-finish">'+
      '<span class="eyebrow">SESSION COMPLETE</span>'+
      '<h2>잘했어요!</h2>'+
      '<p>이번 단어 학습이 끝났어요.</p>'+
      '<div class="vocab-finish-stats">'+
        '<div><strong>'+studied.length+'</strong><span>STUDIED</span></div>'+
        '<div><strong>'+solid+'</strong><span>SOLID</span></div>'+
        '<div><strong>'+review.length+'</strong><span>REVIEW</span></div>'+
      '</div>'+
      rewardSummaryHtml(reward)+
      goldenAwardHtml()+
      (reviewWords.length?'<div class="vocab-review-words"><strong>한 번 더 볼 단어</strong><br>'+reviewWords.map(escapeHtml).join(' · ')+'</div>':'')+
      '<div class="vocab-finish-actions">'+
        (reviewWords.length?'<button id="vocabReviewAgain" class="vocab-review-btn" type="button">Review '+reviewWords.length+'</button>':'')+
        '<button id="vocabDone" class="vocab-done-btn" type="button">Finish</button>'+
      '</div>'+
    '</section>';
  answerNote.hidden=true;
  el('vocabReviewAgain')?.addEventListener('click',reviewSession);
  el('vocabDone')?.addEventListener('click',closeSession);
  sessionMain.scrollTop=0;
}
async function closeSession(){
  const wasTeacher=!!state.activeTeacherAssignment;
  document.body.classList.remove('vocab-session-open');
  sessionEl.hidden=true;root.innerHTML='';answerNote.hidden=true;bottomEl.hidden=false;instructionEl.hidden=false;
  if(state.renderer?.setDisabled)state.renderer.setDisabled(true);

  if(wasTeacher&&state.pendingTeacherRecords.size){
    try{await Promise.allSettled([...state.pendingTeacherRecords])}catch(_){}
  }
  if(wasTeacher){
    try{await loadTeacherAssignments()}catch(error){console.warn('[Vocab Study] partial homework refresh failed',error)}
  }

  state.queue=[];state.index=0;state.checked=false;state.renderer=null;state.spellingPractice=null;state.spellingTest=null;state.speakingSession=null;state.rewardSession=null;state.pendingGoldenAward=null;state.activeTeacherAssignment=null;state.activeTeacherItems=[];
  try{window.scrollTo({top:0,behavior:'auto'})}catch(_){}
}
async function boot(){
  try{
    wireShellNavigation();
    if(frontWordTestCardEl)frontWordTestCardEl.hidden=true;
    let authData=null;
    if(window.WillenaVocabStudyAuthReady){
      authData=await window.WillenaVocabStudyAuthReady;
      if(!authData)return;
      markPerf('auth/whoami',Number(authData.auth_elapsed_ms)||0);
    }
    if(!window.WillenaStudyQuestionBank)throw new Error('Study question bank failed to load.');
    const params=await requireAdminMode();
    if(state.adminMode){
      await loadAdminCatalog(params.bookId);
      if(!params.bookId){
        setStatus('관리자 미리보기 · 교재를 선택하세요.');
        bookTitleEl.textContent='Admin preview';unitTitleEl.textContent='Choose a book above.';startBtn.disabled=true;return;
      }
    }
    if(state.adminMode){
      const resolved=await resolveAdminBookAndUnit(params);
      state.book=resolved.book;state.unit=resolved.unit;state.units=arr(resolved.units);state.items=await loadVocabularyItems(state.book,state.unit);
      renderHome();
      setMainScreen('book');
    }else{
      const resolved=await resolveAssignedBooks(authData);
      state.books=resolved.books;state.assignments=resolved.assignments;state.activeIndex=resolved.activeIndex;
      const active=state.books[state.activeIndex];
      state.book=active.book;state.unit=active.unit;state.units=arr(active.units);state.items=active.items;
      renderHome();
      renderFrontMenu();
      setMainScreen('home');
      hydrateSecondaryBooks(resolved.deferredAssignments,state.book.book_id);
      await loadTeacherAssignments();
      renderFrontMenu();
    }
    startBtn.addEventListener('click',()=>startSession());
    spellingPreviewBtn?.addEventListener('click',openSpellingMenu);
    pronunciationStartBtn?.addEventListener('click',openSpeakingSession);
    wordListOpenBtn?.addEventListener('click',openWordList);
    wordModalCloseBtn?.addEventListener('click',closeWordList);
    wordModalEl?.addEventListener('click',e=>{if(e.target===wordModalEl)closeWordList()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!wordModalEl?.hidden)closeWordList()});
    closeBtn.addEventListener('click',closeSession);
    actionBtn.addEventListener('pointerdown',event=>{
      if(Number.isFinite(event.clientX)&&Number.isFinite(event.clientY)){
        state.pointTapOrigin={x:event.clientX,y:event.clientY};
      }
    });
    actionBtn.addEventListener('click',event=>{
      if(!state.pointTapOrigin&&Number.isFinite(event.clientX)&&Number.isFinite(event.clientY)&&(event.clientX||event.clientY)){
        state.pointTapOrigin={x:event.clientX,y:event.clientY};
      }
      state.speakingSession?checkSpeaking():state.spellingTest?checkSpellingTest():state.spellingPractice?checkSpellingCoach():checkCurrent();
    });
    window.addEventListener('willena:vocab-snapshot-updated',event=>{
      const detail=event?.detail||{};
      if(String(detail.book_id)!==String(state.book?.book_id)||String(detail.unit_id)!==String(state.unit?.id))return;
      state.progressSnapshot=detail.data||null;
      renderSkillProgress();
    });
    reportStartupPerf();
    window.WillenaVocabStudy={version:'0.062',getState:()=>state,start:startSession,openSpellingMenu,openSpellingPreview,openSpellingTest,openSpeakingSession,close:closeSession};
  }catch(error){
    console.error('[Vocab Study] boot',error);
    if(frontWordTestCardEl)frontWordTestCardEl.hidden=true;
    setMainScreen('home');
    setStatus(error?.message||'불러오지 못했습니다. 새로고침해 주세요.');
    bookTitleEl.textContent='Could not load vocabulary';unitTitleEl.textContent='Please try again.';startBtn.disabled=true;if(spellingPreviewBtn)spellingPreviewBtn.disabled=true;
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
