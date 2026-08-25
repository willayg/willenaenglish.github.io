(function(){
'use strict';
const api=(action,opts={})=>{
  const path=`/.netlify/functions/test_prep_api?action=${encodeURIComponent(action)}`;
  if(window.WillenaAPI?.fetch) return window.WillenaAPI.fetch(path,{credentials:'include',cache:'no-store',...opts});
  return fetch(path,{credentials:'include',cache:'no-store',...opts});
};
const today=()=>new Date().toISOString().slice(0,10);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=v=>v?new Date(v).toLocaleDateString('ko-KR'):'—';
let students=[],roster=[];

function injectStyles(){
  if(document.getElementById('naesinStyles')) return;
  const st=document.createElement('style'); st.id='naesinStyles'; st.textContent=`
  #naesin-content{padding:0 0 30px} #naesin-content .na-wrap{display:grid;grid-template-columns:minmax(310px,390px) 1fr;gap:16px;padding:16px;min-height:620px}
  #naesin-content .na-card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:16px;min-width:0}
  #naesin-content .na-title{font-size:1.05rem;font-weight:700;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:8px}
  #naesin-content .na-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px} #naesin-content label{font-size:.78rem;font-weight:600;color:#64748b;display:block;margin-bottom:5px}
  #naesin-content input,#naesin-content select{width:100%;border:1px solid #dbe0e7;border-radius:9px;padding:9px 10px;background:#fff;font:inherit}
  #naesin-content .na-full{grid-column:1/-1}.na-practice{display:flex;gap:7px;flex-wrap:wrap}.na-chip{display:flex;align-items:center;gap:5px;border:1px solid #dbe0e7;border-radius:999px;padding:7px 9px;font-size:.8rem}.na-chip input{width:auto}
  #naesin-content .na-students{border:1px solid #e5e7eb;border-radius:10px;max-height:250px;overflow:auto;margin-top:8px}.na-student{display:flex;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid #f0f1f3;font-size:.82rem}.na-student:last-child{border:0}.na-student input{width:auto}.na-muted{color:#94a3b8;font-size:.75rem}
  #naesin-content .na-actions{display:flex;gap:8px;margin-top:12px}.na-primary{border:0;border-radius:10px;background:#19777e;color:white;font-weight:700;padding:10px 14px;cursor:pointer}.na-secondary{border:1px solid #dbe0e7;border-radius:10px;background:#fff;padding:9px 12px;cursor:pointer}.na-status{font-size:.8rem;margin-top:8px;min-height:18px}.na-status.err{color:#b91c1c}.na-status.ok{color:#047857}
  .na-table-wrap{overflow:auto}.na-table{width:100%;border-collapse:collapse;font-size:.8rem}.na-table th,.na-table td{padding:9px 8px;border-bottom:1px solid #edf0f3;text-align:left;white-space:nowrap}.na-table th{color:#64748b;font-weight:700;background:#fafafa;position:sticky;top:0}.na-table .num{text-align:right}.na-pill{display:inline-block;padding:4px 7px;border-radius:999px;background:#f1f5f9;font-size:.72rem}.na-risk{color:#b91c1c;font-weight:700}.na-good{color:#047857;font-weight:700}.na-rowbtn{border:0;background:#f1f5f9;border-radius:8px;padding:6px 8px;cursor:pointer}
  @media(max-width:900px){#naesin-content .na-wrap{grid-template-columns:1fr}.na-students{max-height:200px}}
  `; document.head.appendChild(st);
}
function makePanel(){
  if(document.getElementById('naesin-content')) return;
  injectStyles();
  const main=document.querySelector('main'); if(!main) return;
  const panel=document.createElement('div'); panel.className='tab-content'; panel.id='naesin-content';
  panel.innerHTML=`<div class="na-wrap">
    <section class="na-card">
      <div class="na-title"><span>내신 설정</span><span class="na-muted">학생별 시험 대비</span></div>
      <form id="naForm">
        <div class="na-grid">
          <div class="na-full"><label>교재</label><select id="naBook"><option value="middle1_donga_yoon">중1 동아 윤정미</option></select></div>
          <div><label>단원</label><select id="naUnit"><option value="Lesson 1">Lesson 1</option></select></div>
          <div><label>목표 문제 수</label><input id="naTarget" type="number" min="1" max="500" value="30"></div>
          <div><label>시작일</label><input id="naStart" type="date" value="${today()}"></div>
          <div><label>시험일</label><input id="naExam" type="date"></div>
          <div class="na-full"><label>시험 이름 (선택)</label><input id="naExamName" placeholder="예: 2학기 중간고사"></div>
          <div class="na-full"><label>연습 유형</label><div class="na-practice">
            <label class="na-chip"><input type="checkbox" name="naPractice" value="communication" checked> Communication</label>
            <label class="na-chip"><input type="checkbox" name="naPractice" value="grammar" checked> Grammar</label>
            <label class="na-chip"><input type="checkbox" name="naPractice" value="reading" checked> Reading</label>
          </div></div>
          <div class="na-full"><label>학생 선택</label><div style="display:flex;gap:7px"><input id="naSearch" type="search" placeholder="이름 / 반 검색"><select id="naClassFilter" style="max-width:140px"><option value="">전체 반</option></select></div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin:7px 0 0"><span id="naSelectedCount" class="na-muted">0명 선택</span><button type="button" class="na-secondary" id="naSelectVisible">보이는 학생 전체 선택</button></div>
            <div class="na-students" id="naStudentList"><div class="na-student na-muted">학생을 불러오는 중...</div></div>
          </div>
        </div>
        <div class="na-actions"><button class="na-primary" type="submit">내신 계획 만들기</button><button class="na-secondary" id="naRefresh" type="button">새로고침</button></div>
        <div id="naStatus" class="na-status"></div>
      </form>
    </section>
    <section class="na-card">
      <div class="na-title"><span>내신 학생 진행 상황</span><span id="naRosterCount" class="na-muted"></span></div>
      <div class="na-table-wrap"><table class="na-table"><thead><tr><th>학생</th><th>반</th><th>교재 / 단원</th><th>시험일</th><th class="num">진도</th><th class="num">정확도</th><th>최근 학습</th><th>상태</th><th></th></tr></thead><tbody id="naRosterBody"><tr><td colspan="9" class="na-muted">불러오는 중...</td></tr></tbody></table></div>
    </section>
  </div>`;
  main.appendChild(panel);
}
function addTab(){
  const tabs=document.querySelector('.nav-tabs'); if(!tabs||document.querySelector('[data-tab="naesin"]')) return;
  const a=document.createElement('a'); a.href='#'; a.className='nav-tab'; a.dataset.tab='naesin'; a.textContent='내신'; tabs.appendChild(a);
  a.addEventListener('click',e=>{e.preventDefault();document.querySelectorAll('.nav-tab').forEach(x=>x.classList.toggle('active',x===a));document.querySelectorAll('main > .tab-content').forEach(x=>x.classList.toggle('active',x.id==='naesin-content'));loadAll();});
  tabs.querySelectorAll('.nav-tab:not([data-tab="naesin"])').forEach(x=>x.addEventListener('click',()=>document.getElementById('naesin-content')?.classList.remove('active')));
}
function setStatus(t,type=''){const el=document.getElementById('naStatus');if(!el)return;el.textContent=t;el.className='na-status '+type;}
function visibleStudents(){
  const q=(document.getElementById('naSearch')?.value||'').trim().toLowerCase(); const cls=document.getElementById('naClassFilter')?.value||'';
  return students.filter(s=>(!cls||s.class===cls)&&(!q||[s.name,s.korean_name,s.username,s.class,s.school].some(v=>String(v||'').toLowerCase().includes(q))));
}
function renderStudents(){
  const list=document.getElementById('naStudentList'); if(!list)return; const old=new Set([...list.querySelectorAll('input:checked')].map(x=>x.value)); const rows=visibleStudents();
  list.innerHTML=rows.length?rows.map(s=>`<label class="na-student"><input type="checkbox" value="${esc(s.id)}" ${old.has(s.id)?'checked':''}><span><strong>${esc(s.korean_name||s.name||s.username)}</strong> <span class="na-muted">${esc(s.name&&s.korean_name?s.name:'')}</span><br><span class="na-muted">${esc(s.class||'반 없음')}${s.school?' · '+esc(s.school):''}${s.grade?' · '+esc(s.grade):''}</span></span></label>`).join(''):'<div class="na-student na-muted">검색 결과가 없습니다.</div>';
  list.querySelectorAll('input').forEach(x=>x.addEventListener('change',updateSelected)); updateSelected();
}
function updateSelected(){const n=document.querySelectorAll('#naStudentList input:checked').length;const el=document.getElementById('naSelectedCount');if(el)el.textContent=`${n}명 선택`;}
async function loadStudents(){
  const r=await api('students'); const d=await r.json().catch(()=>({})); if(!r.ok||!d.success)throw Error(d.error||'학생 목록 실패'); students=d.students||[];
  const cls=[...new Set(students.map(s=>s.class).filter(Boolean))].sort(); const sel=document.getElementById('naClassFilter'); sel.innerHTML='<option value="">전체 반</option>'+cls.map(c=>`<option>${esc(c)}</option>`).join(''); renderStudents();
}
function statusFor(row){const a=row.stats?.accuracy,p=row.stats?.progress,last=row.stats?.last_study;if(p>=100&&a>=80)return '<span class="na-good">완료</span>';if(a!=null&&a<65)return '<span class="na-risk">도움 필요</span>';if(!last)return '<span class="na-risk">미시작</span>';return '<span>진행 중</span>';}
function renderRoster(){
  const body=document.getElementById('naRosterBody'); if(!body)return; document.getElementById('naRosterCount').textContent=`${roster.length}명`;
  body.innerHTML=roster.length?roster.map(r=>{const s=r.student||{},p=r.plan||{},st=r.stats||{};return `<tr><td><strong>${esc(s.korean_name||s.name||s.username||'학생')}</strong></td><td>${esc(s.class||'—')}</td><td>${esc(p.book_label)}<br><span class="na-muted">${esc((p.units||[]).join(', ')||'전체')}</span></td><td>${p.exam_date?esc(p.exam_date):'—'}</td><td class="num">${st.progress??0}%<br><span class="na-muted">${st.questions||0}/${p.question_target||30}</span></td><td class="num">${st.accuracy==null?'—':st.accuracy+'%'}</td><td>${st.last_study?fmtDate(st.last_study):'—'}</td><td>${statusFor(r)}</td><td><button class="na-rowbtn" data-stop="${esc(p.id)}">종료</button></td></tr>`}).join(''):'<tr><td colspan="9" class="na-muted">현재 내신 학생이 없습니다. 왼쪽에서 계획을 만들어 주세요.</td></tr>';
  body.querySelectorAll('[data-stop]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('이 학생의 현재 내신 계획을 종료할까요?'))return;await api('set_plan_active',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan_id:b.dataset.stop,active:false})});await loadRoster();}));
}
async function loadRoster(){const r=await api('teacher_roster');const d=await r.json().catch(()=>({}));if(!r.ok||!d.success)throw Error(d.error||'진행 상황 실패');roster=d.rows||[];renderRoster();}
async function loadAll(){try{setStatus('불러오는 중...');await Promise.all([loadStudents(),loadRoster()]);setStatus('');}catch(e){setStatus(e.message,'err');}}
async function submit(e){
  e.preventDefault(); const ids=[...document.querySelectorAll('#naStudentList input:checked')].map(x=>x.value); const practice=[...document.querySelectorAll('input[name="naPractice"]:checked')].map(x=>x.value); if(!ids.length)return setStatus('학생을 한 명 이상 선택하세요.','err');if(!practice.length)return setStatus('연습 유형을 한 개 이상 선택하세요.','err');
  const unit=document.getElementById('naUnit').value; const payload={student_ids:ids,book_key:document.getElementById('naBook').value,book_label:document.getElementById('naBook').selectedOptions[0].textContent,units:[unit],practice_types:practice,start_date:document.getElementById('naStart').value,exam_date:document.getElementById('naExam').value||null,exam_name:document.getElementById('naExamName').value.trim()||null,question_target:Number(document.getElementById('naTarget').value)||30};
  setStatus('저장 중...'); const r=await api('create_plans',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json().catch(()=>({}));if(!r.ok||!d.success)return setStatus(d.error||'저장 실패','err');setStatus(`${ids.length}명의 내신 계획을 만들었습니다.`,'ok');document.querySelectorAll('#naStudentList input:checked').forEach(x=>x.checked=false);updateSelected();await loadRoster();
}
function init(){makePanel();addTab();document.getElementById('naForm')?.addEventListener('submit',submit);document.getElementById('naRefresh')?.addEventListener('click',loadAll);document.getElementById('naSearch')?.addEventListener('input',renderStudents);document.getElementById('naClassFilter')?.addEventListener('change',renderStudents);document.getElementById('naSelectVisible')?.addEventListener('click',()=>{document.querySelectorAll('#naStudentList input').forEach(x=>x.checked=true);updateSelected();});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
