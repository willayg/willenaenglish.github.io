import {renderMockTestResults} from './mock-test-results.js?v=1.1.2';

const EDGE='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-mock-history-v1';
const API_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const savedSeeds=new Set();

function token(){return window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||''}
async function refreshToken(){
  try{
    const r=await (window.WillenaAPI?.fetch?window.WillenaAPI.fetch(`/.netlify/functions/supabase_auth?action=refresh&_=${Date.now()}`,{credentials:'include',cache:'no-store'}):fetch(`/.netlify/functions/supabase_auth?action=refresh&_=${Date.now()}`,{credentials:'include',cache:'no-store'}));
    const d=await r.json().catch(()=>({}));
    if(r.ok&&d?.success&&d.access_token){window.WillenaAPI?.setLocalTokens?.(d.access_token,d.refresh_token||'');return d.access_token}
  }catch(_){ }
  return'';
}
async function request(planId,{method='GET',body=null}={}){
  let access=token()||await refreshToken();
  if(!access)throw new Error('AUTH_REQUIRED');
  const run=a=>fetch(`${EDGE}?plan_id=${encodeURIComponent(planId)}`,{method,headers:{Authorization:`Bearer ${a}`,apikey:API_KEY,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',credentials:'omit'});
  let r=await run(access);
  if(r.status===401){access=await refreshToken();if(!access)throw new Error('AUTH_REQUIRED');r=await run(access)}
  const d=await r.json().catch(()=>({}));
  if(!r.ok||d.success===false)throw new Error(d.error||`Request failed (${r.status})`);
  return d;
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function dateLabel(value){
  const d=new Date(value);if(Number.isNaN(d.getTime()))return'';
  return d.toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
}
function ensureStyle(){
  if(document.querySelector('link[data-mock-history-style]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href='./mock-test-history.css?v=2.25.97';link.dataset.mockHistoryStyle='1';document.head.appendChild(link);
}
export async function saveMockTestSnapshot(planId,snapshot){
  if(!planId||!snapshot?.seed||savedSeeds.has(String(snapshot.seed)))return null;
  savedSeeds.add(String(snapshot.seed));
  try{return await request(planId,{method:'POST',body:{snapshot}})}catch(e){savedSeeds.delete(String(snapshot.seed));throw e}
}
export async function loadMockTestHistory(planId){const d=await request(planId);return Array.isArray(d.tests)?d.tests:[]}
export async function mountMockTestHistory({host,plan,onOpenHistory=()=>{}}={}){
  if(!host||!plan?.id)return;
  ensureStyle();
  const preflight=host.querySelector('.mock-preflight');if(!preflight)return;
  preflight.querySelector('[data-mock-history]')?.remove();
  const section=document.createElement('section');section.className='mock-history';section.dataset.mockHistory='1';section.innerHTML='<div class="mock-history-head"><div><span>지난 모의고사</span><h3>시험 기록</h3></div><small>불러오는 중...</small></div>';
  preflight.appendChild(section);
  try{
    const tests=await loadMockTestHistory(plan.id);
    if(!section.isConnected)return;
    if(!tests.length){section.innerHTML='<div class="mock-history-head"><div><span>지난 모의고사</span><h3>시험 기록</h3></div></div><div class="mock-history-empty">아직 완료한 모의고사가 없습니다.</div>';return}
    section.innerHTML=`<div class="mock-history-head"><div><span>지난 모의고사</span><h3>시험 기록</h3></div><small>${tests.length}회</small></div><div class="mock-history-list">${tests.map((t,i)=>`<button type="button" class="mock-history-row" data-history-index="${i}" ${t.reviewable?'':'disabled'}><span class="mock-history-date">${esc(dateLabel(t.submittedAt))}</span><strong>${Number(t.correct)||0} / ${Number(t.total)||0}</strong><b>${Number(t.pct)||0}%</b><span class="mock-history-action">${t.reviewable?'시험지 보기 →':'점수 기록만 있음'}</span></button>`).join('')}</div>`;
    section.querySelectorAll('[data-history-index]').forEach(btn=>btn.addEventListener('click',()=>{
      const test=tests[Number(btn.dataset.historyIndex)];if(!test?.reviewable||!test.snapshot)return;
      renderMockTestResults({host,snapshot:test.snapshot,plan,onBack:onOpenHistory});
      const sync=host.querySelector('[data-mock-sync]');if(sync)sync.textContent='저장된 모의고사 결과입니다.';
    }));
  }catch(e){
    console.warn('[mock-history] load failed',e);
    if(section.isConnected)section.innerHTML='<div class="mock-history-head"><div><span>지난 모의고사</span><h3>시험 기록</h3></div></div><div class="mock-history-empty">기록을 불러오지 못했습니다.</div>';
  }
}
