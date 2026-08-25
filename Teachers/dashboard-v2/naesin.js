(function(){
'use strict';

const API_BASE='/.netlify/functions/test_prep_api';
const api=(action,opts={})=>{
  const url=`${API_BASE}?action=${encodeURIComponent(action)}`;
  if(window.WillenaAPI?.fetch) return window.WillenaAPI.fetch(url,{credentials:'include',cache:'no-store',...opts});
  return fetch(url,{credentials:'include',cache:'no-store',...opts});
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toISOString().slice(0,10);
const fmtDate=v=>v?new Date(v).toLocaleDateString('ko-KR'):'—';
let allStudents=[];
let roster=[];
let selectedIds=new Set();

function addStyles(){
  if(document.getElementById('naesin-v2-styles')) return;
  const st=document.createElement('style');
  st.id='naesin-v2-styles';
  st.textContent=`
  #view-naesin .naesin-layout{display:grid;grid-template-columns:minmax(320px,390px) minmax(0,1fr);gap:14px}
  #view-naesin .na-card{background:#fff;border:1px solid var(--line);border-radius:20px;box-shadow:var(--shadow);overflow:hidden}
  #view-naesin .na-card-head{padding:14px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:10px}
  #view-naesin .na-card-title{font-weight:700}.na-sub{font-size:.69rem;color:var(--muted)}
  #view-naesin .na-body{padding:15px}.na-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.na-full{grid-column:1/-1}
  #view-naesin label.na-label{display:block;font-size:.68rem;font-weight:700;color:var(--muted);margin-bottom:5px}
  #view-naesin .na-input{width:100%;min-height:41px;border:1px solid var(--line);border-radius:12px;padding:9px 11px;background:#fff;color:var(--ink)}
  #view-naesin .na-practice{display:flex;flex-wrap:wrap;gap:7px}.na-chip{display:flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:7px 9px;font-size:.72rem;font-weight:600;background:#fafafd}.na-chip input{margin:0}
  #view-naesin .na-student-tools{display:flex;gap:7px;margin-bottom:8px}.na-student-tools .na-input:first-child{flex:1}.na-student-tools select{max-width:125px}
  #view-naesin .na-selectline{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:7px 0}.na-linkbtn{border:0;background:transparent;color:var(--blue);font-weight:700;font-size:.68rem;cursor:pointer;padding:4px}
  #view-naesin .na-student-list{border:1px solid var(--line);border-radius:13px;max-height:270px;overflow:auto}.na-student-row{display:flex;align-items:center;gap:9px;padding:9px 10px;border-bottom:1px solid #f0f1f4;font-size:.75rem;cursor:pointer}.na-student-row:last-child{border-bottom:0}.na-student-row:hover{background:#fafafd}.na-student-row input{margin:0}.na-student-main{font-weight:600}.na-student-meta{font-size:.63rem;color:var(--muted);margin-top:2px}
  #view-naesin .na-actions{display:flex;gap:8px;margin-top:12px}.na-primary{border:0;background:var(--shell);color:#fff;border-radius:12px;padding:10px 13px;font-weight:700;cursor:pointer;flex:1}.na-secondary{border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:12px;padding:10px 12px;font-weight:600;cursor:pointer}.na-primary:disabled{opacity:.45;cursor:not-allowed}.na-status{min-height:18px;margin-top:8px;font-size:.68rem;color:var(--muted)}.na-status.ok{color:#28784d}.na-status.err{color:#9c3c43}
  #view-naesin .na-table-wrap{overflow:auto}.na-table{width:100%;border-collapse:collapse;font-size:.72rem}.na-table th,.na-table td{padding:11px 10px;border-bottom:1px solid #f0f1f4;text-align:left;white-space:nowrap}.na-table th{font-size:.64rem;color:var(--muted);font-weight:700;background:#fafafd;position:sticky;top:0}.na-table tr[data-plan]{cursor:pointer}.na-table tr[data-plan]:hover{background:#fafafd}.na-num{text-align:right!important}.na-progress{display:flex;align-items:center;gap:7px}.na-bar{width:70px;height:6px;background:#eceef3;border-radius:99px;overflow:hidden}.na-bar i{display:block;height:100%;background:var(--cyan)}.na-acc.good{color:#28784d;font-weight:700}.na-acc.warn{color:#a45f1b;font-weight:700}.na-acc.bad{color:#9c3c43;font-weight:700}.na-muted{color:var(--muted)}.na-pill{display:inline-flex;border-radius:999px;padding:4px 7px;font-size:.62rem;font-weight:700;background:#f0f1f4;color:#666c78}.na-pill.due{background:#fff6e8;color:#a45f1b}.na-pill.good{background:#edf9f2;color:#28784d}
  #naesinDetailBg{position:fixed;inset:0;background:rgba(30,30,42,.36);z-index:70;display:none;align-items:stretch;justify-content:flex-end}#naesinDetailBg.open{display:flex}#naesinDetail{width:min(620px,96vw);background:#f7f8fa;height:100%;overflow:auto}.na-detail-head{background:var(--shell);color:#fff;padding:18px 20px;display:flex;align-items:center;gap:12px;position:sticky;top:0}.na-detail-head strong{font-size:1.05rem}.na-detail-head small{display:block;opacity:.7;margin-top:2px}.na-detail-close{margin-left:auto;border:0;background:rgba(255,255,255,.12);color:#fff;width:38px;height:38px;border-radius:12px;cursor:pointer}.na-detail-body{padding:14px}.na-detail-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px}.na-detail-stat{background:#fff;border:1px solid var(--line);border-radius:16px;padding:13px}.na-detail-stat b{display:block;font-size:1.1rem}.na-detail-stat span{font-size:.64rem;color:var(--muted)}.na-detail-card{background:#fff;border:1px solid var(--line);border-radius:17px;padding:14px;margin-bottom:10px}.na-detail-card h3{font-size:.82rem;margin:0 0 10px}.na-detail-card p{font-size:.72rem;color:var(--muted);line-height:1.55;margin:5px 0}.na-end{border:1px solid #f0c9cd;background:#fff5f6;color:#9c3c43;border-radius:11px;padding:9px 11px;font-weight:700;cursor:pointer}
  @media(max-width:1000px){#view-naesin .naesin-layout{grid-template-columns:1fr}.na-student-list{max-height:210px}}
  @media(max-width:700px){#view-naesin .na-form-grid{grid-template-columns:1fr}.na-full{grid-column:1}.na-table th:nth-child(2),.na-table td:nth-child(2),.na-table th:nth-child(4),.na-table td:nth-child(4){display:none}.na-detail-grid{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(st);
}

function ensureUI(){
  addStyles();
  const rail=document.querySelector('.rail');
  const apps=rail?.querySelector('[data-view="apps"]');
  if(rail&&!rail.querySelector('[data-view="naesin"]')){
    const btn=document.createElement('button');
    btn.className='nav';btn.dataset.view='naesin';btn.innerHTML='<span class="nav-icon">✎</span><span>내신</span>';
    rail.insertBefore(btn,apps||rail.querySelector('.rail-spacer'));
  }
  const mobile=document.querySelector('.mobile-tabs');
  if(mobile&&!mobile.querySelector('[data-view="naesin"]')){
    const b=document.createElement('button');b.className='mobile-tab';b.dataset.view='naesin';b.innerHTML='<span>✎</span><span>내신</span>';mobile.insertBefore(b,mobile.lastElementChild||null);
  }
  const ws=document.querySelector('.workspace');
  if(ws&&!document.getElementById('view-naesin')){
    const sec=document.createElement('section');sec.className='view';sec.id='view-naesin';
    sec.innerHTML=`
      <div class="page-head"><div><h1>내신 관리</h1><p>시험 범위를 학생에게 배정하고 실제 문제 풀이 진행 상황을 추적합니다.</p></div><div class="filters"><button class="control" id="naesinRefresh">Refresh</button></div></div>
      <div class="naesin-layout">
        <div class="na-card"><div class="na-card-head"><div><div class="na-card-title">시험 대비 설정</div><div class="na-sub">학생 · 교재 · 범위 · 날짜 · 연습 유형</div></div></div>
          <div class="na-body"><form id="naesinForm"><div class="na-form-grid">
            <div class="na-full"><label class="na-label">교재</label><select class="na-input" id="naBook"><option value="middle1_donga_yoon">중1 동아 윤정미</option></select></div>
            <div><label class="na-label">단원</label><select class="na-input" id="naUnit"><option value="Lesson 1">Lesson 1</option></select></div>
            <div><label class="na-label">목표 문제 수</label><input class="na-input" id="naTarget" type="number" min="1" max="500" value="30"></div>
            <div><label class="na-label">시작일</label><input class="na-input" id="naStart" type="date" value="${today()}"></div>
            <div><label class="na-label">시험일</label><input class="na-input" id="naExam" type="date"></div>
            <div class="na-full"><label class="na-label">시험 이름</label><input class="na-input" id="naExamName" placeholder="예: 2학기 중간고사"></div>
            <div class="na-full"><label class="na-label">연습 유형</label><div class="na-practice">
              <label class="na-chip"><input type="checkbox" name="naPractice" value="communication" checked> Communication</label>
              <label class="na-chip"><input type="checkbox" name="naPractice" value="grammar" checked> Grammar</label>
              <label class="na-chip"><input type="checkbox" name="naPractice" value="reading" checked> Reading</label>
            </div></div>
            <div class="na-full"><label class="na-label">학생 선택</label><div class="na-student-tools"><input class="na-input" id="naSearch" type="search" placeholder="학생 이름 검색"><select class="na-input" id="naClass"><option value="">전체 반</option></select></div>
              <div class="na-selectline"><span class="na-sub" id="naSelected">0명 선택</span><div><button class="na-linkbtn" type="button" id="naSelectAll">보이는 학생 전체</button><button class="na-linkbtn" type="button" id="naClear">선택 해제</button></div></div>
              <div class="na-student-list" id="naStudentList"><div class="empty">학생을 불러오는 중…</div></div>
            </div>
          </div><div class="na-actions"><button class="na-primary" id="naAssign" type="submit">내신 계획 만들기</button><button class="na-secondary" id="naReset" type="button">초기화</button></div><div class="na-status" id="naStatus"></div></form></div>
        </div>
        <div class="na-card"><div class="na-card-head"><div><div class="na-card-title">내신 학생</div><div class="na-sub">활성 시험 대비 계획만 표시</div></div><span class="count-pill" id="naRosterCount">0 students</span></div>
          <div class="na-table-wrap"><table class="na-table"><thead><tr><th>학생</th><th>반</th><th>교재 / 범위</th><th>시험일</th><th class="na-num">진도</th><th class="na-num">정확도</th><th>최근 학습</th><th>상태</th></tr></thead><tbody id="naRoster"><tr><td colspan="8" class="empty">Loading…</td></tr></tbody></table></div>
        </div>
      </div>`;
    ws.appendChild(sec);
  }
  if(!document.getElementById('naesinDetailBg')){
    const bg=document.createElement('div');bg.id='naesinDetailBg';bg.innerHTML='<aside id="naesinDetail"></aside>';document.body.appendChild(bg);
    bg.addEventListener('click',e=>{if(e.target===bg)bg.classList.remove('open')});
  }
}

function bindNavigation(){
  document.querySelectorAll('[data-view]').forEach(btn=>{
    if(btn.dataset.naesinBound) return;btn.dataset.naesinBound='1';
    btn.addEventListener('click',()=>{
      const v=btn.dataset.view;
      document.querySelectorAll('.nav,.mobile-tab').forEach(x=>x.classList.toggle('active',x.dataset.view===v));
      document.querySelectorAll('.workspace > .view').forEach(x=>x.classList.toggle('active',x.id===`view-${v}`));
      if(v==='naesin') loadAll();
    });
  });
}
function setStatus(msg,type=''){const e=document.getElementById('naStatus');if(e){e.textContent=msg;e.className='na-status '+type}}
function currentVisible(){
  const q=(document.getElementById('naSearch')?.value||'').trim().toLowerCase();
  const cls=document.getElementById('naClass')?.value||'';
  return allStudents.filter(s=>(!cls||s.class===cls)&&(!q||[s.name,s.korean_name,s.username,s.class,s.school].some(v=>String(v||'').toLowerCase().includes(q))));
}
function renderStudents(){
  const el=document.getElementById('naStudentList');if(!el)return;
  const rows=currentVisible();
  el.innerHTML=rows.length?rows.map(s=>`<label class="na-student-row"><input type="checkbox" value="${esc(s.id)}" ${selectedIds.has(s.id)?'checked':''}><span><div class="na-student-main">${esc(s.korean_name||s.name||s.username||'Student')}${s.name&&s.korean_name?` <span class="na-muted">${esc(s.name)}</span>`:''}</div><div class="na-student-meta">${esc(s.class||'반 없음')}${s.school?` · ${esc(s.school)}`:''}${s.grade?` · ${esc(s.grade)}`:''}</div></span></label>`).join(''):'<div class="empty">검색 결과가 없습니다.</div>';
  el.querySelectorAll('input[type=checkbox]').forEach(cb=>cb.addEventListener('change',()=>{cb.checked?selectedIds.add(cb.value):selectedIds.delete(cb.value);updateSelected()}));
  updateSelected();
}
function updateSelected(){const e=document.getElementById('naSelected');if(e)e.textContent=`${selectedIds.size}명 선택`;const b=document.getElementById('naAssign');if(b)b.disabled=!selectedIds.size}
function fillClasses(){const e=document.getElementById('naClass');if(!e)return;const classes=[...new Set(allStudents.map(s=>s.class).filter(Boolean))].sort();e.innerHTML='<option value="">전체 반</option>'+classes.map(c=>`<option>${esc(c)}</option>`).join('')}
function statusFor(row){
  const p=row.plan||{},s=row.stats||{};if(!s.questions)return {text:'Not started',cls:''};
  if(s.progress>=100&&s.accuracy>=80)return{text:'On track',cls:'good'};
  if(s.accuracy!=null&&s.accuracy<65)return{text:'Needs attention',cls:'due'};
  if(p.exam_date){const d=Math.ceil((new Date(p.exam_date)-new Date())/86400000);if(d<=7&&s.progress<70)return{text:'Exam soon',cls:'due'}}
  return{text:'In progress',cls:''};
}
function renderRoster(){
  const body=document.getElementById('naRoster');if(!body)return;
  document.getElementById('naRosterCount').textContent=`${roster.length} students`;
  if(!roster.length){body.innerHTML='<tr><td colspan="8" class="empty">아직 활성 내신 학생이 없습니다.</td></tr>';return}
  body.innerHTML=roster.map((r,i)=>{const p=r.plan||{},s=r.stats||{},u=r.student||{},st=statusFor(r);const acc=s.accuracy==null?'—':`${s.accuracy}%`;const ac=s.accuracy==null?'':s.accuracy>=80?'good':s.accuracy>=65?'warn':'bad';return `<tr data-plan="${i}"><td><strong>${esc(u.korean_name||u.name||u.username||'Student')}</strong>${u.name&&u.korean_name?`<div class="na-sub">${esc(u.name)}</div>`:''}</td><td>${esc(u.class||'—')}</td><td>${esc(p.book_label||p.book_key||'—')}<div class="na-sub">${esc((p.units||[]).join(', ')||'전체')}</div></td><td>${fmtDate(p.exam_date)}</td><td class="na-num"><div class="na-progress"><div class="na-bar"><i style="width:${Math.max(0,Math.min(100,s.progress||0))}%"></i></div><b>${s.progress||0}%</b></div><div class="na-sub">${s.questions||0}/${p.question_target||30} questions</div></td><td class="na-num na-acc ${ac}">${acc}</td><td>${s.last_study?fmtDate(s.last_study):'—'}</td><td><span class="na-pill ${st.cls}">${st.text}</span></td></tr>`}).join('');
  body.querySelectorAll('tr[data-plan]').forEach(tr=>tr.addEventListener('click',()=>openDetail(roster[Number(tr.dataset.plan)])));
}
function openDetail(r){
  const p=r.plan||{},s=r.stats||{},u=r.student||{};const bg=document.getElementById('naesinDetailBg'),d=document.getElementById('naesinDetail');
  d.innerHTML=`<div class="na-detail-head"><div><strong>${esc(u.korean_name||u.name||u.username||'Student')}</strong><small>${esc(u.class||'')} ${u.school?`· ${esc(u.school)}`:''}</small></div><button class="na-detail-close" id="naDetailClose">×</button></div><div class="na-detail-body">
    <div class="na-detail-grid"><div class="na-detail-stat"><b>${s.progress||0}%</b><span>Progress</span></div><div class="na-detail-stat"><b>${s.accuracy==null?'—':s.accuracy+'%'}</b><span>Accuracy</span></div><div class="na-detail-stat"><b>${s.questions||0}</b><span>Questions</span></div></div>
    <div class="na-detail-card"><h3>시험 설정</h3><p><b>${esc(p.book_label||p.book_key||'—')}</b> · ${esc((p.units||[]).join(', ')||'전체')}</p><p>${esc(p.exam_name||'시험 이름 없음')} · 시험일 ${fmtDate(p.exam_date)}</p><p>연습: ${esc((p.practice_types||[]).join(' · '))}</p><p>목표: ${p.question_target||30}문제 · 시작일 ${fmtDate(p.start_date)}</p></div>
    <div class="na-detail-card"><h3>학습 상태</h3><p>완료 세션 ${s.completed_sessions||0} · 전체 세션 ${s.sessions||0}</p><p>정답 ${s.correct||0} / ${s.questions||0}</p><p>최근 학습 ${s.last_study?fmtDate(s.last_study):'아직 학습 없음'}</p></div>
    <button class="na-end" id="naEndPlan">이 내신 계획 종료</button>
  </div>`;
  bg.classList.add('open');document.getElementById('naDetailClose').onclick=()=>bg.classList.remove('open');document.getElementById('naEndPlan').onclick=async()=>{
    if(!confirm('이 학생의 내신 계획을 종료할까요?'))return;const res=await api('set_plan_active',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan_id:p.id,active:false})});if(res.ok){bg.classList.remove('open');loadRoster()}
  };
}

async function loadStudents(){
  const r=await api('students');const d=await r.json().catch(()=>({}));if(!r.ok||!d.success)throw new Error(d.error||'학생 목록을 불러오지 못했습니다.');allStudents=d.students||[];fillClasses();renderStudents();
}
async function loadRoster(){
  const r=await api('teacher_roster');const d=await r.json().catch(()=>({}));if(!r.ok||!d.success)throw new Error(d.error||'진행 상황을 불러오지 못했습니다.');roster=d.rows||[];renderRoster();
}
async function loadAll(){
  const status=document.getElementById('naStatus');if(status)status.textContent='불러오는 중…';
  try{await Promise.all([loadStudents(),loadRoster()]);setStatus('')}catch(e){setStatus(e.message||'불러오지 못했습니다.','err')}
}
function resetForm(){selectedIds.clear();document.getElementById('naesinForm')?.reset();const st=document.getElementById('naStart');if(st)st.value=today();renderStudents()}
function bindUI(){
  document.getElementById('naSearch')?.addEventListener('input',renderStudents);document.getElementById('naClass')?.addEventListener('change',renderStudents);
  document.getElementById('naSelectAll')?.addEventListener('click',()=>{currentVisible().forEach(s=>selectedIds.add(s.id));renderStudents()});
  document.getElementById('naClear')?.addEventListener('click',()=>{selectedIds.clear();renderStudents()});
  document.getElementById('naReset')?.addEventListener('click',resetForm);document.getElementById('naesinRefresh')?.addEventListener('click',loadAll);
  document.getElementById('naesinForm')?.addEventListener('submit',async e=>{
    e.preventDefault();const practice=[...document.querySelectorAll('input[name=naPractice]:checked')].map(x=>x.value);if(!selectedIds.size)return setStatus('학생을 선택해 주세요.','err');if(!practice.length)return setStatus('연습 유형을 하나 이상 선택해 주세요.','err');
    const b=document.getElementById('naAssign');b.disabled=true;setStatus('내신 계획을 만드는 중…');
    const payload={student_ids:[...selectedIds],book_key:document.getElementById('naBook').value,book_label:document.getElementById('naBook').selectedOptions[0].text,units:[document.getElementById('naUnit').value],practice_types:practice,start_date:document.getElementById('naStart').value||today(),exam_date:document.getElementById('naExam').value||null,exam_name:document.getElementById('naExamName').value.trim()||null,question_target:Number(document.getElementById('naTarget').value)||30};
    try{const r=await api('create_plans',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json().catch(()=>({}));if(!r.ok||!d.success)throw new Error(d.error||'계획을 만들지 못했습니다.');setStatus(`${d.plans?.length||selectedIds.size}명의 내신 계획을 만들었습니다.`,'ok');selectedIds.clear();renderStudents();await loadRoster()}catch(err){setStatus(err.message||'계획을 만들지 못했습니다.','err')}finally{updateSelected()}
  });
}

function init(){ensureUI();bindNavigation();bindUI();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
