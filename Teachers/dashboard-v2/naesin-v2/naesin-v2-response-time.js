(function(){
'use strict';

const REST='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/student_response_time_snapshots';
const API_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const ORDER=['grammar','reading','vocab_test','communication','sentences','constructed_response'];
const LABELS={grammar:'문법',reading:'독해',vocab_test:'어휘 문제',communication:'의사소통',sentences:'본문',constructed_response:'서술형'};
let context={studentId:null,planId:null};
let installed=false;
const cache=new Map();

const q=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const sec=ms=>{const value=Number(ms);if(!Number.isFinite(value)||value<=0)return'—';const seconds=value/1000;return seconds<10?`${seconds.toFixed(1)}초`:`${Math.round(seconds)}초`};
const pct=v=>v==null?'—':`${Math.round(Number(v)||0)}%`;
const token=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';

function styles(){
  if(q('#na2ResponseTimeStyles'))return;
  const s=document.createElement('style');
  s.id='na2ResponseTimeStyles';
  s.textContent=`
  .na2-response-time{margin:16px 0 18px;padding:18px;border:1px solid rgba(31,71,78,.12);border-radius:18px;background:linear-gradient(180deg,#fff,#f8fbfb)}
  .na2-response-time-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}
  .na2-response-time-head h3{margin:0;color:#203039;font-size:17px;line-height:1.25}
  .na2-response-time-head p{margin:5px 0 0;color:#708087;font-size:12px;line-height:1.4}
  .na2-response-scope{flex:0 0 auto;padding:5px 9px;border-radius:999px;background:#e9f5f5;color:#19777e;font-size:10px;font-weight:800}
  .na2-response-overall{display:flex;align-items:end;gap:10px;margin-bottom:14px;padding:13px 14px;border-radius:14px;background:#f1f7f7}
  .na2-response-overall strong{font-size:28px;line-height:1;color:#173f45}
  .na2-response-overall span{font-size:12px;font-weight:700;color:#607278}
  .na2-response-skills{display:grid;gap:8px}
  .na2-response-row{display:grid;grid-template-columns:minmax(90px,1fr) 86px minmax(180px,1.6fr) 96px;align-items:center;gap:12px;padding:11px 12px;border:1px solid rgba(31,71,78,.09);border-radius:13px;background:#fff}
  .na2-response-row .skill{font-size:13px;font-weight:800;color:#243d42}
  .na2-response-row .median{font-size:17px;font-weight:800;color:#19777e}
  .na2-response-row .split{font-size:11px;color:#65777c;line-height:1.45}
  .na2-response-row .sample{text-align:right;font-size:10px;color:#87969a}
  .na2-response-row .sample b{display:block;color:#586b70;font-size:11px}
  .na2-response-time-empty{padding:16px;text-align:center;color:#7a8a8f;font-size:12px}
  .na2-response-time-note{margin-top:10px;color:#839196;font-size:10px;line-height:1.45}
  @media(max-width:680px){.na2-response-row{grid-template-columns:1fr 72px;gap:6px 10px}.na2-response-row .split{grid-column:1/2}.na2-response-row .sample{grid-column:2/3;grid-row:1/3;align-self:center}}
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
  const overall=map.get('__overall__');
  const skills=ORDER.map(key=>({key,row:map.get(key)})).filter(x=>x.row&&num(x.row.valid_attempt_count)>0);
  if(!overall&&!skills.length)return `<section class="na2-response-time"><div class="na2-response-time-head"><div><h3>응답 속도</h3><p>학생이 문제를 읽고 답을 제출하기까지의 중앙값입니다.</p></div><span class="na2-response-scope">${esc(scopeLabel)}</span></div><div class="na2-response-time-empty">아직 응답 시간 데이터가 없습니다.</div></section>`;
  const overallHtml=overall&&num(overall.valid_attempt_count)>0?`<div class="na2-response-overall"><strong>${esc(sec(overall.median_response_ms))}</strong><span>전체 중앙값 · ${num(overall.valid_attempt_count)}문항</span></div>`:'';
  const skillHtml=skills.length?`<div class="na2-response-skills">${skills.map(({key,row})=>{const count=num(row.valid_attempt_count),low=count<5?'표본 적음':'';return `<div class="na2-response-row"><span class="skill">${esc(LABELS[key]||key)}</span><span class="median">${esc(sec(row.median_response_ms))}</span><span class="split">정답 ${esc(sec(row.median_correct_ms))} · 오답 ${esc(sec(row.median_wrong_ms))}<br>5초 미만 ${esc(pct(row.fast_under_5s_pct))} · 60초 초과 ${esc(pct(row.slow_over_60s_pct))}</span><span class="sample"><b>N=${count}</b>${esc(low)}</span></div>`}).join('')}</div>`:'<div class="na2-response-time-empty">영역별 응답 시간 표본이 아직 부족합니다.</div>';
  return `<section class="na2-response-time"><div class="na2-response-time-head"><div><h3>응답 속도</h3><p>평균이 아니라 중앙값입니다. 10분을 넘긴 기록은 중앙값에서 제외합니다.</p></div><span class="na2-response-scope">${esc(scopeLabel)}</span></div>${overallHtml}${skillHtml}<div class="na2-response-time-note">단어 학습(vocabulary) 드릴은 기존 기록 방식이 달라 현재 영역별 표에서 제외했습니다. 10분 초과 기록은 별도 idle/outlier로 보관됩니다.</div></section>`;
}

async function render({force=false}={}){
  if(!context.studentId)return;
  const body=q('#na2DetailBody'),active=q('#na2DetailTabs [data-tab="activity"].active');
  if(!body||!active)return;
  q('#na2ResponseTimeMount',body)?.remove();
  const mount=document.createElement('div');mount.id='na2ResponseTimeMount';
  const chartSection=q('.na2-detail-section',body);if(chartSection)body.insertBefore(mount,chartSection);else body.appendChild(mount);
  mount.innerHTML='<section class="na2-response-time"><div class="na2-response-time-empty">응답 속도를 불러오는 중…</div></section>';
  try{const rows=await fetchRows(context.studentId,context.planId,{force});if(!mount.isConnected||!q('#na2DetailTabs [data-tab="activity"].active'))return;const scope=selectScope(rows,context.planId);mount.innerHTML=timingHtml(scope.rows,scope.label)}catch(e){if(mount.isConnected)mount.innerHTML=`<section class="na2-response-time"><div class="na2-response-time-empty">${esc(e.message||'응답 시간 데이터를 불러오지 못했습니다.')}</div></section>`}
}

function install(){
  if(installed||!window.NaesinV2StudentDetail)return false;
  installed=true;styles();
  const api=window.NaesinV2StudentDetail,originalOpen=api.open,originalRefresh=api.refreshCurrent;
  api.open=function(studentId,planId,groupId){context={studentId,planId};return originalOpen.call(api,studentId,planId,groupId)};
  if(typeof originalRefresh==='function')api.refreshCurrent=async function(){const result=await originalRefresh.apply(api,arguments);if(q('#na2DetailTabs [data-tab="activity"].active'))setTimeout(()=>render({force:true}),0);return result};
  document.addEventListener('click',e=>{const tab=e.target.closest?.('#na2DetailTabs [data-tab="activity"]');if(tab)setTimeout(()=>render(),0)});
  return true;
}

if(!install()){let tries=0;const timer=setInterval(()=>{if(install()||++tries>50)clearInterval(timer)},100)}
window.NaesinV2ResponseTime={render,clearCache:()=>cache.clear(),version:'1.0.0'};
})();