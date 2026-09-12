(function(){
'use strict';

const LABELS={
  vocabulary:'단어 학습',
  vocab_test:'어휘 문제',
  grammar:'문법',
  sentences:'본문',
  communication:'의사소통',
  reading:'독해',
  constructed_response:'서술형'
};
const ORDER=['vocabulary','vocab_test','grammar','sentences','communication','reading','constructed_response'];
let current={studentId:null,planId:null,groupId:null,data:null,tab:'summary'};

const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const maybePct=v=>v==null?'—':`${Math.round(Number(v)||0)}%`;
const examType=v=>v==='final'?'기말고사':'중간고사';
const nameOf=s=>s?.korean_name||s?.name||s?.username||'Student';
function fmtDate(v){if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}

function mount(){
  if(q('#na2DetailBg'))return;
  const bg=document.createElement('div');
  bg.className='na2-detail-bg';
  bg.id='na2DetailBg';
  bg.innerHTML=`<section class="na2-detail-modal" role="dialog" aria-modal="true" aria-labelledby="na2DetailName">
    <header class="na2-detail-head">
      <div class="na2-detail-title"><h2 id="na2DetailName">학생</h2><p id="na2DetailMeta"></p></div>
      <button class="na2-detail-close" id="na2DetailClose" type="button" aria-label="닫기">×</button>
    </header>
    <nav class="na2-detail-tabs" id="na2DetailTabs">
      <button type="button" data-tab="summary" class="active">요약</button>
      <button type="button" data-tab="wrong">오답</button>
      <button type="button" data-tab="activity">활동</button>
      <button type="button" data-tab="lessons">레슨 진도</button>
      <button type="button" data-tab="grammar">문법 패턴</button>
    </nav>
    <div class="na2-detail-body" id="na2DetailBody"><div class="na2-detail-loading">불러오는 중…</div></div>
  </section>`;
  document.body.appendChild(bg);
  q('#na2DetailClose').onclick=close;
  bg.addEventListener('click',e=>{if(e.target===bg)close()});
  q('#na2DetailTabs').addEventListener('click',e=>{
    const b=e.target.closest('[data-tab]');if(!b)return;
    setTab(b.dataset.tab);
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&bg.classList.contains('open'))close()});
}

function openBg(){mount();q('#na2DetailBg').classList.add('open');document.body.classList.add('na2-modal-open')}
function close(){q('#na2DetailBg')?.classList.remove('open');document.body.classList.remove('na2-modal-open')}

function setHeader(data){
  const student=data?.student||{},group=data?.group||{},stats=data?.stats||{};
  q('#na2DetailName').textContent=nameOf(student);
  const parts=[group.school,group.term?`${group.term}학기 ${examType(group.exam_type)}`:null,group.book_label||stats.book_label].filter(Boolean);
  q('#na2DetailMeta').textContent=parts.join(' · ');
}

function metricCard(value,label,sub=''){
  return `<div class="na2-kpi"><strong>${esc(value)}</strong><span>${esc(label)}</span>${sub?`<small>${esc(sub)}</small>`:''}</div>`;
}

function skillRows(skills){
  const map=new Map((Array.isArray(skills)?skills:[]).map(x=>[x.practice_type,x]));
  return ORDER.map(key=>{
    const s=map.get(key)||{};
    return `<div class="na2-skill-row">
      <div class="na2-skill-name">${esc(LABELS[key]||key)}</div>
      <div class="na2-skill-metric"><strong>${esc(maybePct(s.recent_accuracy))}</strong><small>최근 ${n(s.recent_count)}문항</small></div>
      <div class="na2-skill-metric all"><strong>${esc(maybePct(s.unique_accuracy))}</strong><small>전체 ${n(s.unique_count)}문항</small></div>
      <div class="na2-skill-progress"><span style="width:${Math.max(0,Math.min(100,s.total?Math.round(n(s.completed)/n(s.total)*100):0))}%"></span><small>${n(s.completed)} / ${n(s.total)}</small></div>
    </div>`;
  }).join('');
}

function lessonRows(lessons){
  if(!Array.isArray(lessons)||!lessons.length)return '<div class="na2-detail-empty">레슨 데이터가 없습니다.</div>';
  return lessons.map(l=>`<div class="na2-lesson-summary">
    <div><strong>${esc(l.lesson||'Lesson')}</strong><small>${n(l.completed)} / ${n(l.total)} 완료</small></div>
    <div><b>${esc(maybePct(l.recent_accuracy))}</b><small>최근 ${n(l.recent_count)}문항</small></div>
    <div><b>${esc(maybePct(l.unique_accuracy))}</b><small>전체</small></div>
  </div>`).join('');
}

function renderSummary(){
  const d=current.data||{},stats=d.stats||{},s=stats.summary||{},review=stats.review||{},activity=d.activity||{};
  q('#na2DetailBody').innerHTML=`
    <div class="na2-kpi-grid">
      ${metricCard(maybePct(s.recent150_accuracy),'최근 150',`${n(s.recent150_count)}문항`)}
      ${metricCard(maybePct(s.unique_accuracy),'전체 정확도',`${n(s.unique_count)}문항`)}
      ${metricCard(n(review.wrong_now),'현재 오답')}
      ${metricCard(n(activity.active_days),'최근 10일 학습일',`${n(activity.total_attempts)}회 시도`)}
    </div>
    <section class="na2-detail-section">
      <div class="na2-section-head"><h3>영역별 정확도</h3><span>최근 50 / 전체</span></div>
      <div class="na2-skill-list">${skillRows(stats.skills)}</div>
    </section>
    <section class="na2-detail-section">
      <div class="na2-section-head"><h3>레슨</h3><span>최근 / 전체</span></div>
      <div class="na2-lesson-list">${lessonRows(stats.lessons)}</div>
    </section>
    <div class="na2-last-activity">마지막 학습 <strong>${esc(fmtDate(s.last_activity))}</strong></div>`;
}

function activityChart(days){
  const rows=Array.isArray(days)?days:[];
  if(!rows.length)return '<div class="na2-detail-empty">활동 데이터가 없습니다.</div>';
  const vals=rows.map(x=>n(x.attempts)),max=Math.max(1,...vals),w=760,h=210,left=34,right=18,top=24,bottom=50;
  const pw=w-left-right,ph=h-top-bottom;
  const pts=vals.map((v,i)=>({x:left+(rows.length===1?0:pw*i/(rows.length-1)),y:top+ph-(v/max)*ph,v}));
  const line=pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const labels=rows.map((r,i)=>{const d=new Date(`${r.date}T00:00:00`),txt=Number.isNaN(d.getTime())?String(r.date):d.toLocaleDateString('en-US',{weekday:'short',month:'numeric',day:'numeric'});return `<text x="${pts[i].x}" y="${h-14}" text-anchor="middle">${esc(txt)}</text>`}).join('');
  const dots=pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="4"></circle>${p.v?`<text class="value" x="${p.x}" y="${Math.max(14,p.y-10)}" text-anchor="middle">${p.v}</text>`:''}`).join('');
  return `<div class="na2-chart-wrap"><svg class="na2-activity-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="최근 10일 학습 활동"><line class="axis" x1="${left}" y1="${top+ph}" x2="${w-right}" y2="${top+ph}"></line><polyline points="${line}"></polyline>${dots}${labels}</svg></div>`;
}

function renderActivity(){
  const a=current.data?.activity||{};
  q('#na2DetailBody').innerHTML=`
    <div class="na2-activity-kpis">
      ${metricCard(n(a.total_attempts),'최근 10일 시도')}
      ${metricCard(n(a.active_days),'학습한 날')}
    </div>
    <section class="na2-detail-section">
      <div class="na2-section-head"><h3>최근 10일 활동</h3><span>시도 수</span></div>
      ${activityChart(a.days)}
    </section>`;
}

function renderPlaceholder(tab){
  const copy={wrong:['오답','P7에서 현재 오답과 프린트 기능을 연결합니다.'],lessons:['레슨 진도','P6에서 레슨 링과 학습 여정을 연결합니다.'],grammar:['문법 패턴','P8에서 문법 패턴별 통계를 연결합니다.']}[tab]||['준비 중',''];
  q('#na2DetailBody').innerHTML=`<div class="na2-tab-placeholder"><strong>${copy[0]}</strong><span>${copy[1]}</span></div>`;
}

function setTab(tab){
  current.tab=tab||'summary';
  qa('#na2DetailTabs [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===current.tab));
  if(!current.data)return;
  if(current.tab==='summary')renderSummary();
  else if(current.tab==='activity')renderActivity();
  else renderPlaceholder(current.tab);
}

async function open(studentId,planId,groupId){
  current={studentId,planId,groupId,data:null,tab:'summary'};
  openBg();
  q('#na2DetailName').textContent='학생';
  q('#na2DetailMeta').textContent='불러오는 중…';
  qa('#na2DetailTabs [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab==='summary'));
  q('#na2DetailBody').innerHTML='<div class="na2-detail-loading">학생 통계를 불러오는 중…</div>';
  try{
    const data=await window.NaesinV2Data?.loadStudentOverview?.(planId);
    if(String(current.planId)!==String(planId))return;
    current.data=data;
    setHeader(data);
    renderSummary();
  }catch(e){
    if(String(current.planId)!==String(planId))return;
    q('#na2DetailBody').innerHTML=`<div class="na2-detail-error"><b>학생 정보를 불러오지 못했습니다.</b><span>${esc(e.message||'Unknown error')}</span><button type="button" id="na2DetailRetry">다시 시도</button></div>`;
    q('#na2DetailRetry')?.addEventListener('click',()=>{window.NaesinV2Data?.invalidateStudentOverview?.(planId);open(studentId,planId,groupId)});
  }
}

window.NaesinV2StudentDetail={open,close,version:'p5-overview-1'};
})();
