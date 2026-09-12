(function(){
'use strict';

const VIEW='naesin-v2';
const REV='R8';
const ICON='./naesin-v2/naesin-v2-icon.svg';
const PRACTICES=[
  ['vocabulary','단어 학습'],
  ['vocab_test','어휘 문제'],
  ['grammar','문법'],
  ['sentences','본문'],
  ['communication','의사소통'],
  ['reading','독해'],
  ['constructed_response','서술형']
];

const state={groups:[],loading:false,loaded:false,error:null};
function q(s,r=document){return r.querySelector(s)}
function qa(s,r=document){return [...r.querySelectorAll(s)]}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function num(v){return Number.isFinite(Number(v))?Number(v):null}
function pct(v){const n=num(v);return n==null?'—':`${Math.round(n)}%`}
function examType(v){return v==='final'?'기말고사':'중간고사'}
function dday(date){
  if(!date)return '—';
  const end=new Date(`${String(date).slice(0,10)}T00:00:00`),now=new Date();
  now.setHours(0,0,0,0);
  const n=Math.ceil((end-now)/86400000);
  if(Number.isNaN(n))return '—';
  return n===0?'D-DAY':n>0?`D-${n}`:`D+${Math.abs(n)}`;
}
function formatDate(date){
  if(!date)return '—';
  const d=new Date(`${String(date).slice(0,10)}T00:00:00`);
  if(Number.isNaN(d.getTime()))return '—';
  return d.toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'});
}
function nameOf(s){return s?.korean_name||s?.name||s?.username||'Student'}
function groupOf(item){return item?.group||item||{}}

function show(){
  qa('.workspace>.view').forEach(v=>v.classList.toggle('active',v.id===`view-${VIEW}`));
  qa('.nav,.mobile-tab').forEach(b=>b.classList.toggle('active',b.dataset.view===VIEW));
  ensureLoaded();
}

function mountDesktopNav(){
  const rail=q('.rail');
  if(!rail||rail.querySelector(`[data-view="${VIEW}"]`))return;
  const spacer=q('.rail-spacer',rail);
  const btn=document.createElement('button');
  btn.className='nav';
  btn.dataset.view=VIEW;
  btn.innerHTML=`<span class="nav-icon na2-nav-icon"><img src="${ICON}" alt=""></span><span>내신 V2</span>`;
  btn.addEventListener('click',show);
  rail.insertBefore(btn,spacer||null);
}

function mountMobileNav(){
  const tabs=q('.mobile-tabs');
  if(!tabs||tabs.querySelector(`[data-view="${VIEW}"]`))return;
  const btn=document.createElement('button');
  btn.className='mobile-tab';
  btn.dataset.view=VIEW;
  btn.innerHTML=`<img class="na2-mobile-icon" src="${ICON}" alt="">내신 V2`;
  btn.addEventListener('click',show);
  const apps=q('[data-view="apps"]',tabs);
  tabs.insertBefore(btn,apps||null);
}

function mountView(){
  const ws=q('.workspace');
  if(!ws||q(`#view-${VIEW}`))return;
  const sec=document.createElement('section');
  sec.className='view na2-view';
  sec.id=`view-${VIEW}`;
  sec.innerHTML=`
    <div class="na2-shell">
      <div class="na2-head">
        <div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h1>내신 V2</h1><span style="display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;background:#eef8fa;color:#278d98;font-size:11px;font-weight:900;border:1px solid #bfe3e8">${REV}</span></div>
          <p>진행 중인 시험</p>
        </div>
        <button class="na2-add" id="na2Add" type="button">+ 시험 대비 추가</button>
      </div>
      <div class="na2-tests" id="na2Tests"><div class="na2-empty">불러오는 중…</div></div>
    </div>`;
  ws.appendChild(sec);
  q('#na2Add',sec)?.addEventListener('click',()=>window.NaesinV2Editor?.openCreate?.());
}

function renderLoading(){
  const box=q('#na2Tests');if(box)box.innerHTML='<div class="na2-empty">시험 정보를 불러오는 중…</div>';
}
function renderError(message){
  const box=q('#na2Tests');if(!box)return;
  box.innerHTML=`<div class="na2-empty"><b>내신 정보를 불러오지 못했습니다.</b><span>${esc(message||'Unknown error')}</span><button type="button" class="na2-retry">다시 불러오기</button></div>`;
  q('.na2-retry',box)?.addEventListener('click',()=>ensureLoaded({force:true}));
}
function renderEmpty(){
  const box=q('#na2Tests');if(!box)return;
  box.innerHTML=`<div class="na2-empty"><b>아직 진행 중인 시험이 없습니다.</b><span>시험 대비를 추가하면 여기에 학생 매트릭스가 표시됩니다.</span><button class="na2-add" type="button" data-empty-add>+ 시험 대비 추가</button></div>`;
  q('[data-empty-add]',box)?.addEventListener('click',()=>window.NaesinV2Editor?.openCreate?.());
}

function testShell(item){
  const g=groupOf(item);
  const memberCount=Array.isArray(item?.members)?item.members.length:null;
  const range=(g.scope?.lessons||[]).map(x=>x.lesson).filter(Boolean).join(' · ');
  return `<article class="na2-test" data-group-id="${esc(g.id)}">
    <header class="na2-test-head">
      <div class="na2-test-copy">
        <div class="na2-title-row"><h2>${esc(g.school||'학교')}</h2><span class="na2-dday">${esc(dday(g.end_date))}</span></div>
        <div class="na2-test-meta">
          <span>${esc(g.term||'')}학기 ${esc(examType(g.exam_type))}</span>
          <span>${esc(g.book_label||g.book_key||'교재 미설정')}</span>
          <span>${esc(formatDate(g.end_date))}</span>
          ${memberCount!=null?`<span>${memberCount}명</span>`:''}
        </div>
        ${range?`<div class="na2-range">${esc(range)}</div>`:''}
      </div>
      <div class="na2-menu-wrap">
        <button type="button" class="na2-more" data-more aria-label="시험 메뉴">•••</button>
        <div class="na2-menu" data-menu hidden>
          <button type="button" data-edit>수정</button>
          <button type="button" data-archive>보관</button>
        </div>
      </div>
    </header>
    <div class="na2-matrix-wrap">
      <table class="na2-matrix">
        <thead><tr><th>학생</th><th class="overall">전체 최근</th>${PRACTICES.map(([,label])=>`<th>${label}</th>`).join('')}</tr></thead>
        <tbody><tr class="na2-matrix-loading"><td colspan="9">학생 통계를 불러오는 중…</td></tr></tbody>
      </table>
    </div>
  </article>`;
}

function renderGroups(){
  const box=q('#na2Tests');if(!box)return;
  if(!state.groups.length){renderEmpty();return}
  box.innerHTML=state.groups.map(testShell).join('');
  qa('.na2-test',box).forEach(test=>{
    const id=test.dataset.groupId;
    const more=q('[data-more]',test),menu=q('[data-menu]',test);
    more?.addEventListener('click',e=>{e.stopPropagation();qa('.na2-menu',box).forEach(m=>{if(m!==menu)m.hidden=true});menu.hidden=!menu.hidden});
    q('[data-edit]',test)?.addEventListener('click',()=>{menu.hidden=true;window.NaesinV2Editor?.openEdit?.(id)});
    q('[data-archive]',test)?.addEventListener('click',()=>{menu.hidden=true;window.NaesinV2Editor?.archive?.(id)});
    loadMatrixInto(test,id);
  });
}

function skillMap(member){
  const map=new Map();
  (member?.skills||[]).forEach(s=>map.set(String(s.practice_type||''),s));
  return map;
}
function statCell(row){
  if(!row||!Number(row.recent_count))return '<td class="na2-stat empty"><strong>—</strong><small>0문항</small></td>';
  return `<td class="na2-stat"><strong>${esc(pct(row.recent_accuracy))}</strong><small>${esc(row.recent_count)}문항</small></td>`;
}
function studentRow(member){
  const skills=skillMap(member),s=member?.student||{},summary=member?.summary||{};
  return `<tr data-student-id="${esc(member.student_id||s.id||'')}" data-plan-id="${esc(member.plan_id||'')}">
    <td class="na2-student-cell"><button type="button" class="na2-student-btn" data-student><span>${esc(nameOf(s))}</span><i>›</i></button></td>
    <td class="na2-stat na2-overall"><strong>${esc(pct(summary.recent150_accuracy))}</strong><small>${esc(summary.recent150_count||0)}문항</small></td>
    ${PRACTICES.map(([k])=>statCell(skills.get(k))).join('')}
  </tr>`;
}

async function loadMatrixInto(test,groupId){
  const tbody=q('tbody',test);if(!tbody)return;
  try{
    const matrix=await window.NaesinV2Data?.loadGroupMatrix?.(groupId);
    const members=Array.isArray(matrix?.members)?matrix.members:[];
    tbody.innerHTML=members.length?members.map(studentRow).join(''):'<tr><td colspan="9" class="na2-no-students">학생이 없습니다.</td></tr>';
    qa('[data-student]',tbody).forEach(btn=>btn.addEventListener('click',()=>{
      const tr=btn.closest('tr');
      window.NaesinV2StudentDetail?.open?.(tr?.dataset.studentId,tr?.dataset.planId,groupId);
    }));
  }catch(e){
    tbody.innerHTML=`<tr><td colspan="9" class="na2-matrix-error">통계를 불러오지 못했습니다. <button type="button" data-retry-matrix>다시 시도</button></td></tr>`;
    q('[data-retry-matrix]',tbody)?.addEventListener('click',()=>{window.NaesinV2Data?.invalidateGroupMatrix?.(groupId);tbody.innerHTML='<tr class="na2-matrix-loading"><td colspan="9">학생 통계를 불러오는 중…</td></tr>';loadMatrixInto(test,groupId)});
  }
}

async function ensureLoaded({force=false}={}){
  if(state.loading)return;
  if(state.loaded&&!force)return;
  state.loading=true;state.error=null;renderLoading();
  try{
    state.groups=await window.NaesinV2Data?.loadGroups?.({force})||[];
    state.loaded=true;
    renderGroups();
  }catch(e){state.error=e;state.loaded=false;renderError(e.message)}
  finally{state.loading=false}
}

function mount(){
  mountDesktopNav();
  mountMobileNav();
  mountView();
  document.addEventListener('click',e=>{if(!e.target.closest('.na2-menu-wrap'))qa('.na2-menu').forEach(m=>m.hidden=true)});
  window.NaesinV2={show,mount,refresh:()=>ensureLoaded({force:true}),version:'r8'};
  console.info(`[Naesin V2] ${REV} mounted`);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
else mount();
})();
