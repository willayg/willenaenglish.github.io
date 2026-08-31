(function(){
'use strict';
const API='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-teacher-insights';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cache=new Map();
let loading=false;

function token(){return window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||''}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null}
function pct(v){const n=num(v);return n==null?null:Math.max(0,Math.min(100,n))}
function nearestInt(v){return Math.round(Number(v)||0)}
function getRowStats(row){
  const exam=row.closest('.na-exam');
  const gid=exam?.dataset.group||'';
  const sid=row.dataset.student||'';
  const title=$('.na-exam-title',exam)?.textContent?.trim()||'현재 시험';
  const book=$('.na-exam-book',exam)?.textContent?.trim()||'';
  const name=$('.na-member-name',row)?.textContent?.trim()||row.dataset.name||'Student';
  const className=$('.na-member-sub',row)?.textContent?.trim()||'';
  const status=$('.na-member-status',row)?.textContent?.trim()||'';
  const raw=row.__naesinStats||{};
  const attempts=num(raw.attempts??raw.questions);
  const accuracy=pct(raw.accuracy);
  const correct=num(raw.correct) ?? (attempts!=null&&accuracy!=null?nearestInt(attempts*accuracy/100):null);
  const wrongAttempts=num(raw.wrong_attempts??raw.incorrect) ?? (attempts!=null&&correct!=null?Math.max(0,attempts-correct):null);
  const unresolved=num(raw.unresolved_wrong??raw.wrong??raw.current_wrong);
  return {gid,sid,title,book,name,className,status,attempts,accuracy,correct,wrongAttempts,unresolved,row};
}

async function fetchDetail(row){
  const item=getRowStats(row); if(!item.sid||!item.gid)return null;
  const key=`${item.gid}:${item.sid}`;
  if(cache.has(key))return cache.get(key);
  const t=token(); if(!t)return null;
  const q=new URLSearchParams({action:'student_detail',student_id:item.sid,group_id:item.gid});
  try{
    const r=await fetch(`${API}?${q}`,{headers:{Authorization:`Bearer ${t}`,apikey:KEY},credentials:'omit',cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.success===false)throw new Error(j.error||`학생 분석 ${r.status}`);
    const s=j.summary||{};
    const stats={attempts:num(s.attempts),accuracy:pct(s.accuracy),correct:num(s.correct),unresolved_wrong:num(s.unresolved_wrong)};
    stats.wrong_attempts=stats.attempts!=null&&stats.correct!=null?Math.max(0,stats.attempts-stats.correct):null;
    row.__naesinStats=stats; cache.set(key,stats); return stats;
  }catch(e){console.warn('[naesin all-student stats]',item.name,e);return null}
}

async function loadVisibleStats(){
  if(loading)return; loading=true;
  const rows=$$('#naFreshGroups .na-member').filter(r=>r.dataset.student);
  render(true);
  let index=0;
  const worker=async()=>{while(index<rows.length){const row=rows[index++];await fetchDetail(row);render(true)}};
  await Promise.all(Array.from({length:Math.min(4,rows.length)},worker));
  loading=false; render(false);
}

function injectStyles(){if($('#naStudentStatsStyles'))return;const s=document.createElement('style');s.id='naStudentStatsStyles';s.textContent=`
.na-view-switch{display:flex;gap:8px;align-items:center;margin:0 0 16px;flex-wrap:wrap}.na-view-switch button{border:1px solid #dbe4ea;background:#fff;border-radius:999px;padding:9px 15px;font:600 13px/1.1 Poppins,sans-serif;color:#51616d;cursor:pointer}.na-view-switch button.on{background:#17313d;color:#fff;border-color:#17313d}.na-all-students{display:none}.na-all-students.on{display:block}.na-groups.na-hidden-by-student-view{display:none!important}.na-student-stats-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;margin:0 0 12px}.na-student-stats-head h2{margin:0;font-size:18px}.na-student-stats-head p{margin:3px 0 0;color:#7b8b95;font-size:12px}.na-student-stats-count{font-size:12px;font-weight:700;color:#647681;background:#eef3f5;border-radius:999px;padding:6px 10px}.na-student-stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}.na-student-stat-card{appearance:none;text-align:left;width:100%;border:1px solid #dfe7eb;background:#fff;border-radius:16px;padding:15px;cursor:pointer;color:inherit;box-shadow:0 2px 8px rgba(24,49,61,.045);transition:transform .14s ease,border-color .14s ease,box-shadow .14s ease}.na-student-stat-card:hover{transform:translateY(-1px);border-color:#b8cbd4;box-shadow:0 5px 14px rgba(24,49,61,.08)}.na-student-stat-card:focus-visible{outline:3px solid rgba(41,184,201,.25);outline-offset:2px}.na-student-card-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.na-student-card-name{font-weight:700;font-size:16px}.na-student-card-class{font-size:11px;color:#80909a;margin-top:2px}.na-student-card-status{font-size:10px;font-weight:700;background:#f1f5f6;color:#60727c;border-radius:999px;padding:5px 8px;white-space:nowrap}.na-student-card-test{margin-top:10px;font-size:11px;color:#778892;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.na-student-card-test b{color:#4a5e69}.na-quick-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:12px}.na-quick-stat{min-width:0;background:#f7f9fa;border-radius:11px;padding:8px 5px;text-align:center}.na-quick-stat b{display:block;font-size:16px;line-height:1.1;color:#263f4b}.na-quick-stat span{display:block;font-size:9px;color:#8a99a2;margin-top:4px}.na-quick-stat.wrong b{color:#d64a70}.na-ratio{margin-top:10px;display:flex;align-items:center;gap:8px}.na-ratio-track{height:7px;flex:1;border-radius:999px;background:#f1dce4;overflow:hidden}.na-ratio-track span{display:block;height:100%;background:#62c7ba}.na-ratio-label{font-size:10px;font-weight:700;color:#6d7f89;white-space:nowrap}.na-stat-empty{padding:25px;text-align:center;border:1px dashed #ccd9df;border-radius:14px;color:#7b8b95;background:#fff}.na-stats-loading{font-size:11px;color:#84939b;margin-left:8px}@media(max-width:640px){.na-student-stats-grid{grid-template-columns:1fr}.na-quick-stats{gap:5px}.na-quick-stat{padding:8px 3px}.na-view-switch{margin-top:2px}}
`;document.head.appendChild(s)}

function mount(){
  const groups=$('#naFreshGroups'); if(!groups)return false;
  injectStyles();
  if(!$('#naStudentViewSwitch')){
    const sw=document.createElement('div');sw.className='na-view-switch';sw.id='naStudentViewSwitch';sw.innerHTML='<button type="button" class="on" data-na-mode="groups">현재 수업</button><button type="button" data-na-mode="students">전체 내신 학생</button>';
    groups.parentNode.insertBefore(sw,groups);
    const all=document.createElement('div');all.id='naAllStudents';all.className='na-all-students';all.innerHTML='<div class="na-student-stats-head"><div><h2>전체 내신 학생</h2><p>현재 내신을 진행 중인 학생의 빠른 현황 <span class="na-stats-loading" id="naStatsLoading"></span></p></div><span class="na-student-stats-count" id="naStudentStatsCount">0명</span></div><div class="na-student-stats-grid" id="naStudentStatsGrid"><div class="na-stat-empty">학생 정보를 불러오는 중…</div></div>';
    groups.insertAdjacentElement('afterend',all);
    $$('#naStudentViewSwitch [data-na-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.naMode)));
  }
  render(); return true;
}

function setMode(mode){
  const studentsMode=mode==='students';
  $$('#naStudentViewSwitch [data-na-mode]').forEach(b=>b.classList.toggle('on',b.dataset.naMode===mode));
  $('#naFreshGroups')?.classList.toggle('na-hidden-by-student-view',studentsMode);
  $('#naAllStudents')?.classList.toggle('on',studentsMode);
  if(studentsMode){render();loadVisibleStats()}
}

function render(isLoading=loading){
  const grid=$('#naStudentStatsGrid'); if(!grid)return;
  const rows=$$('#naFreshGroups .na-member');
  const items=rows.map(getRowStats).filter(x=>x.sid);
  $('#naStudentStatsCount').textContent=`${items.length}명`;
  const loadingEl=$('#naStatsLoading'); if(loadingEl)loadingEl.textContent=isLoading?'· 통계 불러오는 중…':'';
  if(!items.length){grid.innerHTML='<div class="na-stat-empty">현재 내신을 진행 중인 학생이 없습니다.</div>';return}
  grid.innerHTML=items.map((s,i)=>{
    const attempts=s.attempts,correct=s.correct??(attempts!=null&&s.accuracy!=null?nearestInt(attempts*s.accuracy/100):null),wrong=s.wrongAttempts??(attempts!=null&&correct!=null?Math.max(0,attempts-correct):null);
    const rightPct=attempts>0&&correct!=null?Math.round(correct/attempts*100):0;
    return `<button type="button" class="na-student-stat-card" data-na-card="${i}"><div class="na-student-card-top"><div><div class="na-student-card-name">${esc(s.name)}</div><div class="na-student-card-class">${esc(s.className)}</div></div><span class="na-student-card-status">${esc(s.status||'진행 중')}</span></div><div class="na-student-card-test"><b>${esc(s.title)}</b>${s.book?' · '+esc(s.book):''}</div><div class="na-quick-stats"><div class="na-quick-stat"><b>${attempts==null?'…':esc(attempts)}</b><span>시도</span></div><div class="na-quick-stat wrong"><b>${s.unresolved==null?'…':esc(s.unresolved)}</b><span>현재 오답</span></div><div class="na-quick-stat"><b>${correct==null?'…':esc(correct)}</b><span>정답</span></div><div class="na-quick-stat wrong"><b>${wrong==null?'…':esc(wrong)}</b><span>오답 시도</span></div></div><div class="na-ratio"><div class="na-ratio-track"><span style="width:${rightPct}%"></span></div><div class="na-ratio-label">${s.accuracy==null?'통계 대기':esc(Math.round(s.accuracy))+'% 정답'}</div></div></button>`
  }).join('');
  $$('[data-na-card]',grid).forEach((b,i)=>b.addEventListener('click',()=>items[i]?.row?.click()));
}

function observe(){const box=$('#naFreshGroups');if(!box)return;let t;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(()=>{render();if($('#naAllStudents')?.classList.contains('on'))loadVisibleStats()},120)}).observe(box,{childList:true,subtree:true});}
function init(){if(!mount()){setTimeout(init,120);return}observe();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();