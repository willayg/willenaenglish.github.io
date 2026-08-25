(function(){
'use strict';

const GROUP_API='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-teacher';
const GROUP_API_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const STUDENT_API='/.netlify/functions/teacher_admin?action=list_students';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STD_SCHOOLS=['은행중학교','소래중학교','대흥중학교','은계중학교','신천중학교','매화중학교','시흥중학교','장곡중학교','응곡중학교','군서중학교','배곧중학교','배곧라온중학교'];
const BOOKS=[{
  key:'middle1_donga_yoon',
  label:'중1 동아 윤정미',
  lessons:[
    {title:'Lesson 1',sections:['communication','grammar','reading']},
    {title:'Lesson 2',sections:['communication','grammar','reading']},
    {title:'Lesson 3',sections:['grammar']},
    {title:'Lesson 4',sections:['communication','grammar','reading']}
  ]
}];
let students=[],groups=[],selected=new Set(),pickerDraft=new Set(),step=1,editId=null,externals=[];

async function routedFetch(path,opts={}){
  if(window.WillenaAPI?.fetch) return window.WillenaAPI.fetch(path,{credentials:'include',cache:'no-store',...opts});
  return fetch(path,{credentials:'include',cache:'no-store',...opts});
}
async function jsonResponse(res,label='요청'){
  const text=await res.text();
  let data;
  try{data=JSON.parse(text)}catch{
    const preview=(text||'').trim().slice(0,80);
    throw new Error(`${label}: JSON 대신 HTML/텍스트 응답 (${preview||'empty'})`);
  }
  if(!res.ok||data?.success===false) throw new Error(data?.error||`${label} 실패 (${res.status})`);
  return data;
}
async function groupApi(action,opts={}){
  const token=window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
  if(!token) throw new Error('로그인이 필요합니다.');
  const headers={...(opts.headers||{}),Authorization:`Bearer ${token}`,apikey:GROUP_API_KEY};
  const res=await fetch(`${GROUP_API}?action=${encodeURIComponent(action)}`,{...opts,headers,credentials:'omit',cache:'no-store'});
  return jsonResponse(res,'내신 API');
}
async function postGroup(action,body){return groupApi(action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}

function addStyles(){
  if(document.getElementById('naesin-flow-styles'))return;
  const s=document.createElement('style');s.id='naesin-flow-styles';s.textContent=`
  #view-naesin .na-empty{background:#fff;border:1px solid var(--line);border-radius:22px;box-shadow:var(--shadow);padding:46px 22px;text-align:center;color:var(--muted)}
  #view-naesin .na-empty h3{color:var(--ink);margin:0 0 7px}.na-top-btn{border:0;background:var(--shell);color:#fff;border-radius:12px;padding:11px 15px;font-weight:700;cursor:pointer}
  #view-naesin .na-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}.na-test-card{background:#fff;border:1px solid var(--line);border-radius:20px;box-shadow:var(--shadow);padding:16px}.na-test-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.na-test-title{font-weight:700;font-size:.96rem}.na-test-sub{font-size:.69rem;color:var(--muted);margin-top:4px}.na-test-date{font-size:.67rem;background:#f3f4f7;border-radius:999px;padding:5px 8px;white-space:nowrap}.na-test-meta{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.na-badge{font-size:.64rem;font-weight:700;background:#eef9fb;color:#287b85;border-radius:999px;padding:5px 8px}.na-badge.gray{background:#f1f2f5;color:#6b7180}.na-card-actions{display:flex;gap:7px;margin-top:13px}.na-edit{border:1px solid var(--line);background:#fff;border-radius:10px;padding:8px 11px;font-weight:700;cursor:pointer}.na-track{border:0;background:var(--shell);color:#fff;border-radius:10px;padding:8px 11px;font-weight:700;cursor:pointer}.na-members{display:none;margin-top:12px;border-top:1px solid #f0f1f4;padding-top:10px}.na-test-card.open .na-members{display:block}.na-member{display:grid;grid-template-columns:1fr 65px 65px;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #f4f5f7;font-size:.72rem}.na-member small{display:block;color:var(--muted);font-size:.62rem;margin-top:2px}
  #naWizardBg{position:fixed;inset:0;background:rgba(26,27,36,.46);z-index:100;display:none;align-items:center;justify-content:center;padding:16px}#naWizardBg.open{display:flex}.na-modal{width:min(760px,96vw);max-height:92vh;background:#fff;border-radius:23px;box-shadow:0 24px 70px rgba(0,0,0,.2);overflow:hidden;position:relative}.na-modal-head{padding:18px 20px 14px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between}.na-modal-head h2{margin:0;font-size:1.08rem}.na-x{border:0;background:#f1f2f5;width:36px;height:36px;border-radius:10px;cursor:pointer}.na-progress{display:flex;gap:7px;padding:15px 20px 0}.na-progress i{flex:1;height:6px;border-radius:99px;background:#e7e9ee}.na-progress i.on{background:var(--shell)}.na-modal-body{padding:22px;overflow:auto;max-height:68vh}.na-step{display:none}.na-step.active{display:block}.na-step h3{font-size:1.24rem;margin:0 0 5px}.na-desc{margin:0 0 20px;color:var(--muted);font-size:.72rem}.na-field{margin-bottom:16px}.na-label{display:block;font-size:.66rem;font-weight:700;color:#666c77;margin-bottom:7px}.na-input{width:100%;padding:11px 12px;border:1px solid #dfe2e7;border-radius:11px;background:#fff;color:var(--ink)}
  .na-choice-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.na-choice{border:1px solid #dfe2e7;background:#fff;padding:14px;border-radius:13px;font-weight:700;cursor:pointer}.na-choice.on{border-color:var(--cyan);background:#eef9fb;color:#287b85}.na-modal-foot{border-top:1px solid var(--line);padding:14px 20px;display:flex;justify-content:space-between}.na-primary{border:0;background:var(--shell);color:#fff;border-radius:11px;padding:10px 14px;font-weight:700;cursor:pointer}.na-secondary{border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:11px;padding:10px 13px;font-weight:700;cursor:pointer}.na-cyan{border:1px solid #b9e1e7;background:#eef9fb;color:#287b85;border-radius:11px;padding:10px 13px;font-weight:700;cursor:pointer}.na-primary:disabled{opacity:.45;cursor:not-allowed}
  .na-student-summary{border:1px dashed #cfd3da;border-radius:15px;padding:19px;text-align:center}.na-selected-count{font-size:1.6rem;font-weight:700}.na-selected-list{display:flex;gap:7px;flex-wrap:wrap;justify-content:center;margin-top:11px}.na-student-chip{background:#f0f2f5;border-radius:999px;padding:7px 10px;font-size:.68rem}.na-picker{position:absolute;inset:0;background:#fff;display:none;flex-direction:column;z-index:3}.na-picker.open{display:flex}.na-picker-head{padding:17px 20px;border-bottom:1px solid var(--line);display:flex;gap:10px;align-items:center}.na-picker-head h3{margin:0;flex:1}.na-picker-search{padding:14px 20px;border-bottom:1px solid var(--line)}.na-results{padding:10px 20px;overflow:auto;flex:1}.na-student-row{display:flex;align-items:center;justify-content:space-between;padding:11px 12px;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:7px;cursor:pointer}.na-student-row.on{border-color:var(--cyan);background:#eef9fb}.na-student-row small{display:block;color:var(--muted);font-size:.64rem;margin-top:2px}.na-en-name{font-size:.7rem;color:var(--muted);margin-left:6px;font-weight:500}.na-check{width:23px;height:23px;border:2px solid #c9ccd3;border-radius:7px;display:grid;place-items:center}.na-student-row.on .na-check{background:var(--cyan);border-color:var(--cyan);color:#fff}.na-picker-foot{border-top:1px solid var(--line);padding:14px 20px;display:flex;justify-content:space-between;align-items:center}
  .na-book-card{border:2px solid var(--cyan);background:#eef9fb;border-radius:15px;padding:17px}.na-book-card b{font-size:.94rem}.na-book-card small{display:block;color:#5e6d72;margin-top:4px}.na-lesson{border:1px solid var(--line);border-radius:14px;margin-bottom:10px;overflow:hidden;cursor:pointer;transition:.15s}.na-lesson:hover{border-color:#c8dfe3;background:#fcffff}.na-lesson.all-on{border-color:var(--cyan);box-shadow:0 0 0 1px rgba(88,195,210,.12)}.na-lesson-head{padding:12px 14px;background:#fafafa;font-weight:700;display:flex;justify-content:space-between;align-items:center}.na-lesson.all-on .na-lesson-head{background:#f2fbfc}.na-lesson-body{padding:12px 14px;display:flex;gap:8px;flex-wrap:wrap}.na-scope-chip{border:1px solid #dfe2e7;border-radius:999px;padding:7px 10px;background:#fff;cursor:pointer}.na-scope-chip.on{background:#eef9fb;border-color:var(--cyan);color:#287b85}.na-external{border:1px solid var(--line);border-radius:14px;overflow:hidden;margin-top:12px}.na-external-head{padding:12px 14px;background:#fafafa;display:flex;align-items:center;justify-content:space-between;gap:10px}.na-external-list{padding:12px 14px;display:grid;gap:8px}.na-ext-item{border:1px solid #e4e6eb;border-radius:12px;padding:11px 12px;display:flex;align-items:center;gap:9px}.na-ext-item input{flex:1;min-width:0}.na-icon-btn{border:1px solid var(--line);background:#fff;border-radius:9px;padding:8px 9px;cursor:pointer}.na-add-ext{border:1px dashed #bfc4cc;background:#fafbfc;border-radius:11px;padding:10px 12px;width:100%;font-weight:700;cursor:pointer}.na-review{border:1px solid var(--line);border-radius:15px;overflow:hidden}.na-review-row{display:grid;grid-template-columns:110px 1fr;gap:12px;padding:11px 13px;border-bottom:1px solid #eee}.na-review-row:last-child{border-bottom:0}.na-review-row span{color:var(--muted);font-size:.68rem}.na-status{font-size:.68rem;color:#9c3c43;margin-top:10px;min-height:18px}
  @media(max-width:980px){#view-naesin .na-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:700px){#view-naesin .na-grid{grid-template-columns:1fr}.na-modal-body{padding:17px}.na-review-row{grid-template-columns:85px 1fr}.na-member{grid-template-columns:1fr 55px 55px}}
  `;document.head.appendChild(s);
}

function wizardHTML(){return `<div class="na-modal"><div class="na-modal-head"><h2 id="naModalTitle">새 시험 대비</h2><button class="na-x" id="naClose">✕</button></div><div class="na-progress">${[1,2,3,4,5].map(i=>`<i data-p="${i}"></i>`).join('')}</div><div class="na-modal-body">
<section class="na-step" data-step="1"><h3>시험 정보</h3><p class="na-desc">학생들이 준비할 학교 시험을 선택하세요.</p><div class="na-field"><label class="na-label">학교</label><select class="na-input" id="naSchool"></select></div><div class="na-field"><label class="na-label">학기</label><div class="na-choice-grid" id="naTerms"><button class="na-choice" data-value="1">1학기</button><button class="na-choice" data-value="2">2학기</button></div></div><div class="na-field"><label class="na-label">시험</label><div class="na-choice-grid" id="naExamTypes"><button class="na-choice" data-value="midterm">중간고사</button><button class="na-choice" data-value="final">기말고사</button></div></div><div class="na-field"><label class="na-label">종료일</label><input class="na-input" id="naEnd" type="date"></div></section>
<section class="na-step" data-step="2"><h3>학생 선택</h3><p class="na-desc">이 시험을 준비할 학생들을 추가하세요.</p><div class="na-student-summary"><div class="na-selected-count" id="naSelectedCount">0명</div><div class="na-desc" style="margin:2px 0 0">선택됨</div><div class="na-selected-list" id="naSelectedList"></div><button class="na-cyan" style="margin-top:16px" id="naAddStudents">+ 학생 추가</button></div></section>
<section class="na-step" data-step="3"><h3>교재 선택</h3><p class="na-desc">이 시험 대비 그룹에서 사용할 교재를 하나 선택하세요.</p><div class="na-field"><label class="na-label">교재</label><select class="na-input" id="naBook">${BOOKS.map(b=>`<option value="${b.key}">${b.label}</option>`).join('')}</select></div><div class="na-book-card"><b id="naBookTitle">중1 동아 윤정미</b><small>선택된 모든 학생에게 이 교재가 연결됩니다.</small></div></section>
<section class="na-step" data-step="4"><h3>시험 범위</h3><p class="na-desc">시험에 포함되는 Lesson과 영역을 선택하고 외부지문을 추가하세요.</p><div id="naLessonList"></div><div class="na-external"><div class="na-external-head"><div><b>외부지문</b><div class="na-desc" style="margin:3px 0 0">학교 프린트나 추가 Reading 범위</div></div><button class="na-cyan" id="naAddExternal">+ 추가</button></div><div class="na-external-list" id="naExternalList"></div></div></section>
<section class="na-step" data-step="5"><h3>확인</h3><p class="na-desc">저장 후에도 같은 화면에서 언제든 수정할 수 있습니다.</p><div class="na-review"><div class="na-review-row"><span>시험</span><b id="rvTest"></b></div><div class="na-review-row"><span>종료일</span><b id="rvDate"></b></div><div class="na-review-row"><span>학생</span><b id="rvStudents"></b></div><div class="na-review-row"><span>교재</span><b id="rvBook"></b></div><div class="na-review-row"><span>범위</span><b id="rvScope"></b></div><div class="na-review-row"><span>외부지문</span><b id="rvExternal"></b></div></div></section><div class="na-status" id="naWizardStatus"></div></div><div class="na-modal-foot"><button class="na-secondary" id="naBack">이전</button><button class="na-primary" id="naNext">다음</button></div>
<div class="na-picker" id="naPicker"><div class="na-picker-head"><h3>학생 추가</h3><button class="na-x" id="naPickerClose">✕</button></div><div class="na-picker-search"><input class="na-input" id="naStudentSearch" placeholder="영문 이름 또는 한글 이름 검색"></div><div class="na-results" id="naStudentResults"></div><div class="na-picker-foot"><span id="naPickerCount">0명 선택</span><button class="na-primary" id="naPickerDone">선택 완료</button></div></div></div>`}

function ensureUI(){
  addStyles();
  const rail=document.querySelector('.rail'),apps=rail?.querySelector('[data-view="apps"]');
  if(rail&&!rail.querySelector('[data-view="naesin"]')){const b=document.createElement('button');b.className='nav';b.dataset.view='naesin';b.innerHTML='<span class="nav-icon">✎</span><span>내신</span>';rail.insertBefore(b,apps||rail.querySelector('.rail-spacer'))}
  const mobile=document.querySelector('.mobile-tabs');
  if(mobile&&!mobile.querySelector('[data-view="naesin"]')){const b=document.createElement('button');b.className='mobile-tab';b.dataset.view='naesin';b.innerHTML='<span>✎</span><span>내신</span>';mobile.insertBefore(b,mobile.lastElementChild||null)}
  const ws=document.querySelector('.workspace');
  if(ws&&!document.getElementById('view-naesin')){const sec=document.createElement('section');sec.className='view';sec.id='view-naesin';sec.innerHTML=`<div class="page-head"><div><h1>내신</h1><p>학교 시험 대비 그룹을 만들고 학생별 진행 상황과 오답을 추적합니다.</p></div><div class="filters"><button class="na-top-btn" id="naCreate">+ 시험 대비 추가</button></div></div><div id="naGroups"><div class="na-empty">Loading…</div></div>`;ws.appendChild(sec)}
  if(!document.getElementById('naWizardBg')){const bg=document.createElement('div');bg.id='naWizardBg';bg.innerHTML=wizardHTML();document.body.appendChild(bg);bg.addEventListener('click',e=>{if(e.target===bg)closeWizard()})}
}

function bindNavigation(){document.querySelectorAll('[data-view]').forEach(btn=>{if(btn.dataset.naBound)return;btn.dataset.naBound='1';btn.addEventListener('click',()=>{const v=btn.dataset.view;document.querySelectorAll('.nav,.mobile-tab').forEach(x=>x.classList.toggle('active',x.dataset.view===v));document.querySelectorAll('.workspace>.view').forEach(x=>x.classList.toggle('active',x.id===`view-${v}`));if(v==='naesin')loadGroups()})})}
function bind(){document.getElementById('naCreate')?.addEventListener('click',()=>openWizard());document.getElementById('naClose')?.addEventListener('click',closeWizard);document.getElementById('naBack')?.addEventListener('click',()=>{if(step>1){step--;renderStep()}});document.getElementById('naNext')?.addEventListener('click',nextStep);bindChoice('naTerms');bindChoice('naExamTypes');document.getElementById('naAddStudents')?.addEventListener('click',openPicker);document.getElementById('naPickerClose')?.addEventListener('click',()=>document.getElementById('naPicker').classList.remove('open'));document.getElementById('naPickerDone')?.addEventListener('click',confirmPicker);document.getElementById('naStudentSearch')?.addEventListener('input',renderPicker);document.getElementById('naBook')?.addEventListener('change',()=>{syncBookCard();renderLessons()});document.getElementById('naAddExternal')?.addEventListener('click',addExternal)}
function bindChoice(id){document.getElementById(id)?.querySelectorAll('.na-choice').forEach(b=>b.addEventListener('click',()=>{b.parentElement.querySelectorAll('.na-choice').forEach(x=>x.classList.remove('on'));b.classList.add('on')}))}
function choose(id,val){document.getElementById(id)?.querySelectorAll('.na-choice').forEach(x=>x.classList.toggle('on',String(x.dataset.value)===String(val)))}
function value(id){return document.querySelector(`#${id} .na-choice.on`)?.dataset.value||''}
function nameOf(s){return s.korean_name||s.name||s.username||'Student'}
function schoolOptions(){const derived=students.map(s=>s.school).filter(Boolean);return[...new Set([...STD_SCHOOLS,...derived])].sort((a,b)=>a.localeCompare(b,'ko')).concat(['기타 학교'])}
function populateSchools(selectedSchool){const el=document.getElementById('naSchool');if(!el)return;el.innerHTML=schoolOptions().map(s=>`<option ${s===selectedSchool?'selected':''}>${esc(s)}</option>`).join('')}
function book(){return BOOKS.find(b=>b.key===document.getElementById('naBook')?.value)||BOOKS[0]}
function syncBookCard(){const b=book();const t=document.getElementById('naBookTitle');if(t)t.textContent=b.label}

function openWizard(groupId=null){
  editId=groupId;step=1;selected=new Set();externals=[];populateSchools();choose('naTerms',2);choose('naExamTypes','midterm');document.getElementById('naEnd').value='';document.getElementById('naBook').value=BOOKS[0].key;
  let savedScope=[];
  if(groupId){const item=groups.find(x=>x.group.id===groupId);if(item){const g=item.group;populateSchools(g.school);choose('naTerms',g.term);choose('naExamTypes',g.exam_type);document.getElementById('naEnd').value=g.end_date||'';document.getElementById('naBook').value=g.book_key||BOOKS[0].key;selected=new Set(item.members.map(m=>m.student.id));externals=(g.scope?.external_passages||[]).map((x,i)=>({id:x.id||String(Date.now()+i),name:x.name||`외부지문 ${i+1}`}));savedScope=g.scope?.lessons||[];document.getElementById('naModalTitle').textContent='시험 대비 수정'}}else document.getElementById('naModalTitle').textContent='새 시험 대비';
  syncBookCard();renderLessons(savedScope);renderSelected();renderExternal();document.getElementById('naWizardBg').classList.add('open');renderStep();
}
function closeWizard(){document.getElementById('naWizardBg').classList.remove('open');document.getElementById('naPicker').classList.remove('open')}
function renderStep(){document.querySelectorAll('.na-step').forEach(x=>x.classList.toggle('active',Number(x.dataset.step)===step));document.querySelectorAll('.na-progress i').forEach(x=>x.classList.toggle('on',Number(x.dataset.p)<=step));const back=document.getElementById('naBack'),next=document.getElementById('naNext');back.style.visibility=step===1?'hidden':'visible';next.textContent=step===5?(editId?'변경사항 저장':'시험 대비 저장'):'다음';document.getElementById('naWizardStatus').textContent='';if(step===5)renderReview()}
function validateStep(){if(step===1&&!value('naTerms'))return'학기를 선택하세요.';if(step===1&&!value('naExamTypes'))return'시험을 선택하세요.';if(step===1&&!document.getElementById('naEnd').value)return'종료일을 선택하세요.';if(step===2&&!selected.size)return'학생을 한 명 이상 선택하세요.';return''}
async function nextStep(){const msg=validateStep();if(msg){document.getElementById('naWizardStatus').textContent=msg;return}if(step<5){step++;renderStep();return}await saveGroup()}

function openPicker(){pickerDraft=new Set(selected);document.getElementById('naStudentSearch').value='';renderPicker();document.getElementById('naPicker').classList.add('open')}
function renderPicker(){const q=(document.getElementById('naStudentSearch')?.value||'').trim().toLowerCase();const school=document.getElementById('naSchool')?.value||'';const rows=students.filter(s=>{const hay=[s.name,s.korean_name,s.username,s.class,s.school].filter(Boolean).join(' ').toLowerCase();return !q||hay.includes(q)});const el=document.getElementById('naStudentResults');el.innerHTML=rows.length?rows.map(s=>`<div class="na-student-row ${pickerDraft.has(s.id)?'on':''}" data-id="${esc(s.id)}"><div><b>${esc(s.korean_name||s.name||s.username||'Student')}</b>${s.name&&s.korean_name?`<span class="na-en-name">${esc(s.name)}</span>`:''}<small>${esc(s.class||'반 없음')}${s.school?` · ${esc(s.school)}`:''}${s.school===school?' · 현재 학교':''}</small></div><div class="na-check">${pickerDraft.has(s.id)?'✓':''}</div></div>`).join(''):'<div class="empty">검색 결과가 없습니다.</div>';el.querySelectorAll('.na-student-row').forEach(r=>r.addEventListener('click',()=>{const id=r.dataset.id;pickerDraft.has(id)?pickerDraft.delete(id):pickerDraft.add(id);renderPicker()}));document.getElementById('naPickerCount').textContent=`${pickerDraft.size}명 선택`}
function confirmPicker(){selected=new Set(pickerDraft);renderSelected();document.getElementById('naPicker').classList.remove('open')}
function renderSelected(){const arr=students.filter(s=>selected.has(s.id));document.getElementById('naSelectedCount').textContent=`${arr.length}명`;document.getElementById('naSelectedList').innerHTML=arr.map(s=>`<span class="na-student-chip">${esc(nameOf(s))}</span>`).join('')}

function updateLessonCard(row){
  const chips=[...row.querySelectorAll('.na-scope-chip')];
  const allOn=chips.length>0&&chips.every(x=>x.classList.contains('on'));
  row.classList.toggle('all-on',allOn);
  const hint=row.querySelector('.na-lesson-head .na-desc');
  if(hint)hint.textContent=allOn?'전체 선택됨':'카드를 눌러 전체 선택';
}
function renderLessons(saved=[]){
  const b=book();
  const savedMap=new Map((saved||[]).map(x=>[x.lesson,new Set((x.sections||[]).map(s=>String(s).toLowerCase()))]));
  const labels={communication:'Communication',grammar:'Grammar',reading:'Reading'};
  const el=document.getElementById('naLessonList');
  el.innerHTML=b.lessons.map((lesson,idx)=>{
    const chosen=savedMap.has(lesson.title)?savedMap.get(lesson.title):new Set(idx===0?lesson.sections:[]);
    return `<div class="na-lesson" data-lesson="${esc(lesson.title)}"><div class="na-lesson-head"><span>${esc(lesson.title)}</span><span class="na-desc" style="margin:0">카드를 눌러 전체 선택</span></div><div class="na-lesson-body">${lesson.sections.map(v=>`<button class="na-scope-chip ${chosen.has(v)?'on':''}" data-section="${v}">${labels[v]||v}</button>`).join('')}</div></div>`;
  }).join('');
  el.querySelectorAll('.na-lesson').forEach(row=>{
    updateLessonCard(row);
    row.addEventListener('click',e=>{
      if(e.target.closest('.na-scope-chip'))return;
      const chips=[...row.querySelectorAll('.na-scope-chip')];
      const allOn=chips.length>0&&chips.every(x=>x.classList.contains('on'));
      chips.forEach(x=>x.classList.toggle('on',!allOn));
      updateLessonCard(row);
    });
    row.querySelectorAll('.na-scope-chip').forEach(x=>x.addEventListener('click',e=>{
      e.stopPropagation();
      x.classList.toggle('on');
      updateLessonCard(row);
    }));
  });
}
function scopeData(){const lessons=[...document.querySelectorAll('#naLessonList .na-lesson')].map(row=>({lesson:row.dataset.lesson,sections:[...row.querySelectorAll('.na-scope-chip.on')].map(x=>x.dataset.section)})).filter(x=>x.sections.length);return{lessons,external_passages:externals.map(x=>({id:x.id,name:x.name||'외부지문'}))}}
function addExternal(){externals.push({id:(crypto.randomUUID?.()||String(Date.now()+Math.random())),name:`외부지문 ${externals.length+1}`});renderExternal()}
function renderExternal(){const list=document.getElementById('naExternalList');if(!list)return;list.innerHTML=externals.map((x,i)=>`<div class="na-ext-item"><input class="na-input" value="${esc(x.name)}" aria-label="외부지문 이름"><button class="na-icon-btn" title="삭제">✕</button></div>`).join('')+`<button class="na-add-ext" id="naAddExternalWide">+ 외부지문 추가</button>`;list.querySelectorAll('.na-ext-item').forEach((row,i)=>{row.querySelector('input').addEventListener('input',e=>externals[i].name=e.target.value);row.querySelector('button').addEventListener('click',()=>{externals.splice(i,1);renderExternal()})});document.getElementById('naAddExternalWide')?.addEventListener('click',addExternal)}
function renderReview(){const term=value('naTerms'),type=value('naExamTypes'),school=document.getElementById('naSchool').value,b=book(),scope=scopeData();document.getElementById('rvTest').textContent=`${school} · ${term}학기 · ${type==='final'?'기말고사':'중간고사'}`;document.getElementById('rvDate').textContent=document.getElementById('naEnd').value||'—';document.getElementById('rvStudents').textContent=`${selected.size}명`;document.getElementById('rvBook').textContent=b.label;document.getElementById('rvScope').textContent=scope.lessons.length?scope.lessons.map(x=>`${x.lesson} (${x.sections.map(s=>s[0].toUpperCase()+s.slice(1)).join(', ')})`).join(' · '):'선택 없음';document.getElementById('rvExternal').textContent=externals.length?externals.map(x=>x.name).join(', '):'없음'}
async function saveGroup(){const status=document.getElementById('naWizardStatus'),btn=document.getElementById('naNext');btn.disabled=true;status.textContent='저장 중…';const b=book(),payload={group_id:editId||undefined,school:document.getElementById('naSchool').value,term:Number(value('naTerms')),exam_type:value('naExamTypes'),end_date:document.getElementById('naEnd').value,book_key:b.key,book_label:b.label,student_ids:[...selected],scope:scopeData()};try{await postGroup(editId?'update_group':'create_group',payload);closeWizard();await loadGroups()}catch(e){status.textContent=e.message||'저장하지 못했습니다.'}finally{btn.disabled=false}}

function renderGroups(){const el=document.getElementById('naGroups');if(!groups.length){el.innerHTML=`<div class="na-empty"><h3>아직 등록된 시험 대비가 없습니다.</h3><p>학교 시험을 만들고 학생과 교재, 범위를 연결하세요.</p><button class="na-top-btn" id="naEmptyCreate">+ 첫 시험 대비 추가</button></div>`;document.getElementById('naEmptyCreate')?.addEventListener('click',()=>openWizard());return}el.innerHTML=`<div class="na-grid">${groups.map(item=>{const g=item.group,scope=g.scope||{},lessons=(scope.lessons||[]).map(x=>x.lesson).join(', ')||'범위 미설정',ext=(scope.external_passages||[]).length;const accs=item.members.map(m=>m.stats.accuracy).filter(x=>x!=null),avg=accs.length?Math.round(accs.reduce((a,b)=>a+b,0)/accs.length):null;return`<article class="na-test-card" data-id="${g.id}"><div class="na-test-top"><div><div class="na-test-title">${esc(g.school)} · ${g.term}학기 · ${g.exam_type==='final'?'기말고사':'중간고사'}</div><div class="na-test-sub">${esc(g.book_label)}</div></div><span class="na-test-date">${esc(g.end_date||'날짜 없음')}</span></div><div class="na-test-meta"><span class="na-badge">${item.members.length}명</span><span class="na-badge gray">${esc(lessons)}${ext?` · 외부지문 ${ext}`:''}</span>${avg!=null?`<span class="na-badge gray">평균 ${avg}%</span>`:''}</div><div class="na-card-actions"><button class="na-edit" data-edit="${g.id}">수정</button><button class="na-track" data-track="${g.id}">학생 보기</button></div><div class="na-members">${item.members.length?item.members.map(m=>`<div class="na-member"><div><b>${esc(nameOf(m.student))}</b><small>${esc(m.student.class||'')}${m.student.school?` · ${esc(m.student.school)}`:''}</small></div><div>${m.stats.questions||0}문제</div><div>${m.stats.accuracy==null?'—':m.stats.accuracy+'%'}</div></div>`).join(''):'<div class="na-desc">학생 없음</div>'}</div></article>`}).join('')}</div>`;el.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();openWizard(b.dataset.edit)}));el.querySelectorAll('[data-track]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const card=b.closest('.na-test-card');card.classList.toggle('open');b.textContent=card.classList.contains('open')?'닫기':'학생 보기'}))}

async function loadStudents(){try{const r=await routedFetch(STUDENT_API);const d=await jsonResponse(r,'학생 목록');students=Array.isArray(d.students)?d.students.filter(s=>s.approved!==false):[];console.info(`[naesin] loaded ${students.length} students`)}catch(e){students=[];console.error('[naesin] students',e)}}
async function loadGroups(){const el=document.getElementById('naGroups');if(el)el.classList.add('loading');try{const d=await groupApi('teacher_groups');groups=d.groups||[];renderGroups()}catch(e){if(el)el.innerHTML=`<div class="na-empty"><h3>시험 대비를 불러오지 못했습니다.</h3><p>${esc(e.message)}</p></div>`}finally{el?.classList.remove('loading')}}

async function init(){ensureUI();bindNavigation();bind();await loadStudents();populateSchools();await loadGroups()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
