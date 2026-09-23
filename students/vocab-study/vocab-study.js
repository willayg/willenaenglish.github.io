import {QuestionRenderer} from '/shared/questions/question-renderer.js?v=20260924-universal1';

const SESSION_SIZE=12;
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
const startBtn=el('vocabStudyStart');
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

const state={
  book:null,unit:null,items:[],
  queue:[],index:0,checked:false,renderer:null,
  outcomes:new Map(),reviewKeys:new Set(),retryCounts:new Map(),
  adminMode:false,nextReadyAt:0
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

async function api(url,opts){
  const fn=window.WillenaAPI&&typeof window.WillenaAPI.fetch==='function'?window.WillenaAPI.fetch.bind(window.WillenaAPI):window.fetch.bind(window);
  const r=await fn(url,Object.assign({credentials:'include',cache:'no-store'},opts||{}));
  const d=await r.json().catch(()=>({}));
  if(!r.ok||(d&&d.success===false))throw new Error(d&&d.error||('Request failed ('+r.status+').'));
  return d;
}
async function profile(){return api('/.netlify/functions/progress_summary?section=my_progress&_='+Date.now())}
async function whoami(){return api('/.netlify/functions/supabase_auth?action=whoami&_='+Date.now())}
async function assignments(className){
  const r=await fetch(OP_URL+'/rest/v1/rpc/get_study_assignment_for_class',{
    method:'POST',headers:{apikey:OP_KEY,Authorization:'Bearer '+OP_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({p_class_name:className}),cache:'no-store'
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.success)throw new Error(d.error||'Could not load assigned books.');
  return d;
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
  return{book:{book_id:meta.id,book_title:txt(meta.title||'Vocabulary'),public_level:Number(meta.public_level)||null,internal_level_id:Number(meta.internal_level_id)||null},unit};
}
async function resolveBookAndUnit(){
  const me=await profile();const className=txt(me.class);if(!className)throw new Error('No active class is assigned.');
  const a=await assignments(className);
  const list=Array.isArray(a.assignments)&&a.assignments.length?a.assignments:(a.assignment?[a.assignment]:[]);
  if(!list.length)throw new Error('No active book is assigned.');
  let wanted='';try{wanted=localStorage.getItem(ACTIVE_BOOK_KEY)||''}catch(_){}
  const assignment=list.find(x=>String(x.book_id)===String(wanted))||a.assignment||list[0];
  const [books,units]=await Promise.all([
    content('content_books?select=id,public_level,internal_level_id&id=eq.'+encodeURIComponent(assignment.book_id)+'&status=in.(review,published)'),
    content('content_units?select=id,unit_number,title,metadata&book_id=eq.'+encodeURIComponent(assignment.book_id)+'&status=in.(review,published)&order=unit_number.asc')
  ]);
  const meta=books[0]||{},unit=resolveUnit(units,assignment);if(!unit)throw new Error('No unit is available for this book.');
  return{book:Object.assign({},assignment,{book_id:assignment.book_id,book_title:txt(assignment.book_title||assignment.title||'Vocabulary'),public_level:Number(meta.public_level)||null,internal_level_id:Number(meta.internal_level_id)||null}),unit};
}

async function loadSourceVocabulary(unitId){
  const occ=await content('source_content_occurrences?select=id,lexical_entry_id,source_text&unit_id=eq.'+encodeURIComponent(unitId)+'&occurrence_type=eq.lexical_entry&status=in.(review,published)');
  const ids=unique(occ.map(o=>o.lexical_entry_id));if(!ids.length)return[];
  const rows=await content('lexical_entries?select=id,canonical_text,translation_ko,emoji&id=in.'+encodeURIComponent('('+ids.join(',')+')')+'&status=in.(review,published)');
  const by={};rows.forEach(r=>by[r.id]=r);
  return occ.map(o=>{const e=by[o.lexical_entry_id];return e?{id:e.id,occurrenceId:o.id,word:txt(e.canonical_text||o.source_text),ko:txt(e.translation_ko),emoji:e.emoji||null}:null}).filter(x=>x&&x.word&&x.ko);
}
function sourceVocabularyActivities(book,unit,items){
  const out=[],koPool=unique(items.map(x=>x.ko)),enPool=unique(items.map(x=>x.word));
  items.forEach(item=>{
    const koChoices=shuffle(unique([item.ko,...shuffle(koPool.filter(x=>x!==item.ko)).slice(0,3)]));
    if(koChoices.length>=2)out.push({
      id:'vocab-study-en-ko-'+item.occurrenceId,sourceType:'lexical_entry',sourceId:item.id,skill:'vocabulary',
      stimulus:{type:'text',prompt:(item.emoji?item.emoji+'  ':'')+item.word,context:'한국어 뜻을 고르세요.'},
      response:{type:'multiple_choice',choices:koChoices},answer:item.ko,
      metadata:{book_id:book.book_id,unit_id:unit.id,canonical_lookup:item.word,translation_ko:item.ko,pair_form:'en_ko',pool_source:'source_content'}
    });
    const enChoices=shuffle(unique([item.word,...shuffle(enPool.filter(x=>x!==item.word)).slice(0,3)]));
    if(enChoices.length>=2)out.push({
      id:'vocab-study-ko-en-'+item.occurrenceId,sourceType:'lexical_entry',sourceId:item.id,skill:'vocabulary',
      stimulus:{type:'text',prompt:item.ko,context:'알맞은 영어 표현을 고르세요.'},
      response:{type:'multiple_choice',choices:enChoices},answer:item.word,
      metadata:{book_id:book.book_id,unit_id:unit.id,canonical_lookup:item.word,translation_ko:item.ko,pair_form:'ko_en',pool_source:'source_content'}
    });
  });
  return out;
}
async function loadVocabularyItems(book,unit){
  const authoredPromise=window.WillenaStudyQuestionBank
    ?window.WillenaStudyQuestionBank.loadUnit(null,{bookId:book.book_id,unitId:unit.id,bookTitle:book.book_title,unitNumber:Number(unit.unit_number)}).catch(e=>{console.warn('[Vocab Study] authored bank unavailable',e);return[]})
    :Promise.resolve([]);
  const sourcePromise=loadSourceVocabulary(unit.id).catch(e=>{console.warn('[Vocab Study] source vocabulary unavailable',e);return[]});
  const [authoredRows,sourceRows]=await Promise.all([authoredPromise,sourcePromise]);
  const authored=arr(authoredRows).filter(a=>a&&a.skill==='vocabulary');
  // Authored questions are the source of truth. Generated questions are fallback only.
  if(authored.length)return authored;
  return sourceVocabularyActivities(book,unit,arr(sourceRows));
}

function activityKey(item){
  const m=item?.metadata||{};
  return txt(m.canonical_lookup||m.canonical_text||m.lexical_entry_id||item?.sourceId||item?.id);
}
function activityWord(item){
  const m=item?.metadata||{};
  const canonical=txt(m.canonical_lookup||m.canonical_text);
  if(canonical)return canonical;
  const prompt=txt(item?.stimulus?.prompt).replace(/^\S+\s{2}/,'');
  return /[A-Za-z]/.test(prompt)?prompt:txt(item?.answer||prompt);
}
function buildSession(items,size=SESSION_SIZE){
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
function renderHome(){
  if(!state.book||!state.unit)return;
  bookTitleEl.textContent=state.book.book_title;
  unitTitleEl.textContent='Unit '+state.unit.unit_number+(state.unit.title?' · '+state.unit.title:'');
  const words=new Set(state.items.map(activityKey).filter(Boolean)).size;
  itemCountEl.textContent=(words||state.items.length)+' words';
  startBtn.disabled=!state.items.length;
  setStatus(state.items.length?'준비됐어요.':'이 단원에는 사용할 수 있는 단어 문제가 없어요.');
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
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function startSession(items=null){
  const source=items&&items.length?items:state.items;if(!source.length)return;
  state.queue=buildSession(source,Math.min(SESSION_SIZE,source.length));
  state.index=0;state.outcomes=new Map();state.reviewKeys=new Set();state.retryCounts=new Map();
  titleEl.textContent=state.book.book_title+' · Unit '+state.unit.unit_number;
  sessionEl.hidden=false;document.body.classList.add('vocab-session-open');
  renderQuestion();
}
function reviewSession(){
  const wanted=new Set(state.reviewKeys);
  const reviewItems=state.items.filter(item=>wanted.has(activityKey(item)));
  if(!reviewItems.length)return closeSession();
  startSession(reviewItems);
}
function finishSession(){
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
function closeSession(){
  document.body.classList.remove('vocab-session-open');
  sessionEl.hidden=true;root.innerHTML='';answerNote.hidden=true;bottomEl.hidden=false;
  state.queue=[];state.index=0;state.checked=false;state.renderer=null;
  try{window.scrollTo({top:0,behavior:'auto'})}catch(_){}
}
async function boot(){
  try{
    if(window.WillenaVocabStudyAuthReady){const ok=await window.WillenaVocabStudyAuthReady;if(!ok)return}
    if(!window.WillenaStudyQuestionBank)throw new Error('Study question bank failed to load.');
    const params=await requireAdminMode();
    if(state.adminMode){
      await loadAdminCatalog(params.bookId);
      if(!params.bookId){
        setStatus('관리자 미리보기 · 교재를 선택하세요.');
        bookTitleEl.textContent='Admin preview';unitTitleEl.textContent='Choose a book above.';startBtn.disabled=true;return;
      }
    }
    const resolved=state.adminMode?await resolveAdminBookAndUnit(params):await resolveBookAndUnit();
    state.book=resolved.book;state.unit=resolved.unit;state.items=await loadVocabularyItems(state.book,state.unit);
    renderHome();
    startBtn.addEventListener('click',()=>startSession());
    closeBtn.addEventListener('click',closeSession);
    actionBtn.addEventListener('click',checkCurrent);
    window.WillenaVocabStudy={version:'staging-flow1-20260924',getState:()=>state,start:startSession,close:closeSession};
  }catch(error){
    console.error('[Vocab Study] boot',error);
    setStatus(error?.message||'불러오지 못했습니다. 새로고침해 주세요.');
    bookTitleEl.textContent='Could not load vocabulary';unitTitleEl.textContent='Please try again.';startBtn.disabled=true;
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
