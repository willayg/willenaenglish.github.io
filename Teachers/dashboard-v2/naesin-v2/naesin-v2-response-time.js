(function(){
'use strict';

const REST='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/student_response_time_snapshots';
const API_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const ORDER=['grammar','reading','vocab_test','communication','sentences','constructed_response'];
const LABELS={grammar:'문법',reading:'독해',vocab_test:'어휘 문제',communication:'의사소통',sentences:'본문',constructed_response:'서술형'};
let context={studentId:null,planId:null};
let installed=false;
const cache=new Map();
const htmlCache=new Map();

const q=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const sec=ms=>{const value=Number(ms);if(!Number.isFinite(value)||value<=0)return'—';const seconds=value/1000;return seconds<10?`${seconds.toFixed(1)}초`:`${Math.round(seconds)}초`};
const pct=v=>v==null?'—':`${Math.round(Number(v)||0)}%`;
const token=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
const cacheKey=()=>`${context.studentId||''}|${context.planId||''}`;

function styles(){
  if(q('#na2ResponseTimeStyles'))return;
  const s=document.createElement('style');
  s.id='na2ResponseTimeStyles';
  s.textContent=`
  .na2-response-time{margin:18px 0 0;padding:18px;border:1px solid rgba(31,71,78,.11);border-radius:18px;background:#fff}
  .na2-response-time-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
  .na2-response-time-head h3{margin:0;color:#203039;font-size:18px;line-height:1.25}
  .na2-response-time-head p{margin:5px 0 0;color:#718187;font-size:12px;line-height:1.45}
  .na2-response-scope{flex:0 0 auto;padding:5px 9px;border-radius:999px;background:#eaf6f6;color:#19777e;font-size:10px;font-weight:800}
  .na2-response-skills{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .na2-response-card{padding:15px 16px;border:1px solid rgba(31,71,78,.09);border-radius:15px;background:#f9fbfb}
  .na2-response-main{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
  .na2-response-main b{font-size:14px;color:#253f45}
  .na2-response-main strong{font-size:25px;line-height:1;color:#167780;white-space:nowrap}
  .na2-response-caption{margin-top:5px;color:#6f8085;font-size:11px;font-weight:700}
  .na2-response-split{display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;padding-top:10px;border-top:1px solid rgba(31,71,78,.08);font-size:11px;color:#65777c}
  .na2-response-split span b{color:#314e54}
  .na2-response-flags{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}
  .na2-response-flag{padding:4px 7px;border-radius:999px;background:#eef3f3;color:#607277;font-size:10px;font-weight:700}
  .na2-response-flag.fast{background:#eef7f5;color:#34776e}
  .na2-response-flag.slow{background:#f8f2eb;color:#8a6944}
  .na2-response-time-empty{padding:16px;text-align:center;color:#7a8a8f;font-size:12px}
  .na2-response-time-note{margin-top:12px;color:#87959a;font-size:10px;line-height:1.5}
  @media(max-width:680px){.na2-response-skills{grid-template-columns:1fr}.na2-response-card{padding:14px}.na2-response-main strong{font-size:23px}}
  `;
  document.head.appendChild(s);
}

async function refreshToken(){
  try{
    const base=window.WillenaAPI?.getApiUrl?.('/.netlify/functions/supabase_auth?action=refresh')||'/.netlify/functions/supabase_auth?action=refresh';
    const r=await fetch(`${base}${base.includes('?')?'&':'?'}_=${Date.now()}`,{credentials:'include',cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(r.ok&&d?.success&&d.access_token){window.WillenaAPI?.setLocalTokens?.(d.access_token,d.refresh_token||'');return d.access_token}
  }catch(_){}
  return'';
}
async function accessToken(){return token()||await refreshToken()}

async function fetchRows(studentId,planId,{force=false}={}){
  const key=`${studentId}|${planId||''}`;
  if(!force&&cache.has(key))return cache.get(key);
  let access=await accessToken();
  if(!access)throw new Error('AUTH_REQUIRED');
  const fields='plan_id,practice_type,median_response_ms,median_correct_ms,median_wrong_ms,fast_under_5s_pct,slow_over_60s_pct,idle_over_600s_count,valid_attempt_count,timed_attempt_count,updated_at';
  const params=new URLSearchParams({select:fields,student_id:`eq.${studentId}`});
  params.set('or',planId?`(plan_id.is.null,plan_id.eq.${planId})`:'(plan_id.is.null)');
  const run=t=>fetch(`${REST}?${params}`,{headers:{apikey:API_KEY,Authorization:`Bearer ${t}`},cache:'no-store',credentials:'omit'});
  let r=await run(access);
  if(r.status===401){access=await refreshToken();if(access)r=await run(access)}
  if(!r.ok)throw new Error(`응답 시간 데이터를 불러오지 못했습니다. (${r.status})`);
  const rows=await r.json();
  cache.set(key,Array.isArray(rows)?rows:[]);
  return cache.get(key);
}

function selectScope(rows,planId){
  const planRows=planId?rows.filter(r=>String(r.plan_id||'')===String(planId)):[];
  if(planRows.length)return{rows:planRows,label:'현재 시험 범위'};
  return{rows:rows.filter(r=>r.plan_id==null),label:'전체 기록'};
}

function timingHtml(rows,scopeLabel){
  const map=new Map(rows.map(r=>[r.practice_type==null?'__overall__':r.practice_type,r]));
  const skills=ORDER.map(key=>({key,row:map.get(key)})).filter(x=>x.row&&num(x.row.valid_attempt_count)>0);
  if(!skills.length)return `<section class="na2-response-time"><div class="na2-response-time-head"><div><h3>문제 풀이 속도</h3><p>각 영역에서 한 문제를 푸는 데 걸리는 보통 시간을 보여줍니다.</p></div><span class="na2-response-scope">${esc(scopeLabel)}</span></div><div class="na2-response-time-empty">아직 응답 시간 데이터가 없습니다.</div></section>`;
  const cards=skills.map(({key,row})=>{
    const count=num(row.valid_attempt_count),low=count<10;
    return `<article class="na2-response-card"><div class="na2-response-main"><b>${esc(LABELS[key]||key)}</b><strong>${esc(sec(row.median_response_ms))}</strong></div><div class="na2-response-caption">보통 응답 시간 · ${count}문항${low?' · 표본 적음':''}</div><div class="na2-response-split"><span>정답일 때 <b>${esc(sec(row.median_correct_ms))}</b></span><span>오답일 때 <b>${esc(sec(row.median_wrong_ms))}</b></span></div><div class="na2-response-flags"><span class="na2-response-flag fast">아주 빠른 답 &lt;5초 ${esc(pct(row.fast_under_5s_pct))}</span><span class="na2-response-flag slow">긴 고민 &gt;60초 ${esc(pct(row.slow_over_60s_pct))}</span></div></article>`;
  }).join('');
  return `<section class="na2-response-time"><div class="na2-response-time-head"><div><h3>문제 풀이 속도</h3><p><b>중앙값</b>을 사용합니다. 즉, 극단적으로 빠르거나 느린 몇 문제보다 학생의 ‘보통 속도’를 보여줍니다.</p></div><span class="na2-response-scope">${esc(scopeLabel)}</span></div><div class="na2-response-skills">${cards}</div><div class="na2-response-time-note">10분을 넘긴 기록은 보통 응답 시간 계산에서 제외합니다. 단어 학습 드릴은 예전 기록 방식이 달라 이 표에서는 제외했습니다.</div></section>`;
}

function ensureMount(){
  const body=q('#na2DetailBody'),active=q('#na2DetailTabs [data-tab="activity"].active');
  if(!body||!active)return null;
  let mount=q('#na2ResponseTimeMount',body);
  const chartSection=q('.na2-detail-section',body);
  if(!mount){mount=document.createElement('div');mount.id='na2ResponseTimeMount'}
  if(chartSection&&mount.previousElementSibling!==chartSection)chartSection.insertAdjacentElement('afterend',mount);
  else if(!chartSection&&!mount.isConnected)body.appendChild(mount);
  return mount;
}

async function render({force=false}={}){
  if(!context.studentId)return;
  const mount=ensureMount();
  if(!mount)return;
  const key=cacheKey();
  if(htmlCache.has(key))mount.innerHTML=htmlCache.get(key);
  else mount.innerHTML='<section class="na2-response-time"><div class="na2-response-time-empty">응답 속도를 불러오는 중…</div></section>';
  try{
    const rows=await fetchRows(context.studentId,context.planId,{force});
    if(!q('#na2DetailTabs [data-tab="activity"].active'))return;
    const liveMount=ensureMount();if(!liveMount)return;
    const scope=selectScope(rows,context.planId),html=timingHtml(scope.rows,scope.label);
    htmlCache.set(key,html);liveMount.innerHTML=html;
  }catch(e){const liveMount=ensureMount();if(liveMount&&!htmlCache.has(key))liveMount.innerHTML=`<section class="na2-response-time"><div class="na2-response-time-empty">${esc(e.message||'응답 시간 데이터를 불러오지 못했습니다.')}</div></section>`}
}

function install(){
  if(installed||!window.NaesinV2StudentDetail)return false;
  installed=true;styles();
  const api=window.NaesinV2StudentDetail,originalOpen=api.open,originalRefresh=api.refreshCurrent;
  api.open=function(studentId,planId,groupId){context={studentId,planId};return originalOpen.call(api,studentId,planId,groupId)};
  if(typeof originalRefresh==='function')api.refreshCurrent=async function(){
    const key=cacheKey(),saved=htmlCache.get(key)||'';
    const result=await originalRefresh.apply(api,arguments);
    if(q('#na2DetailTabs [data-tab="activity"].active')){
      const mount=ensureMount();if(mount&&saved)mount.innerHTML=saved;
      render({force:false});
    }
    return result;
  };
  document.addEventListener('click',e=>{const tab=e.target.closest?.('#na2DetailTabs [data-tab="activity"]');if(tab)setTimeout(()=>render(),0)});
  return true;
}

if(!install()){let tries=0;const timer=setInterval(()=>{if(install()||++tries>50)clearInterval(timer)},100)}
window.NaesinV2ResponseTime={render,clearCache:()=>{cache.clear();htmlCache.clear()},version:'1.1.0'};
})();