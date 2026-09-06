(function(){
'use strict';
const IS_STAGING=/^staging\./i.test(location.hostname)||['localhost','127.0.0.1'].includes(location.hostname);
if(!IS_STAGING)return;
const REVIEW_EDGE='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-review-v48';
const REVIEW_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
let busy=false,last=[];
function token(){return window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||''}
function due(x){return x?.due_now===true||!x?.next_review_at||new Date(x.next_review_at).getTime()<=Date.now()}
function mount(){return document.getElementById('tpWrongCardMount')}
function installStyles(){if(document.getElementById('tpWrong49Styles'))return;const s=document.createElement('style');s.id='tpWrong49Styles';s.textContent=`
.tp49-wrong-card{width:100%;box-sizing:border-box;border:1.5px solid #b8e7e9;border-radius:24px;background:#fff;padding:24px 28px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:18px;text-align:left;box-shadow:0 12px 38px rgba(31,63,68,.06);font-family:Poppins,'Noto Sans KR',system-ui,sans-serif;color:#203039;cursor:pointer}.tp49-wrong-card:active{transform:translateY(1px)}.tp49-wrong-icon{width:58px;height:58px;border-radius:18px;background:#fff0f5;color:#f24a8c;display:grid;place-items:center;font-size:30px;font-weight:800}.tp49-wrong-copy b{display:block;font-size:22px;font-weight:800}.tp49-wrong-copy small{display:block;margin-top:7px;color:#7a8b90;font-size:13px;font-weight:600}.tp49-wrong-count{text-align:right}.tp49-wrong-count strong{display:block;color:#f23879;font-size:42px;line-height:1;font-weight:800}.tp49-wrong-count small{display:block;color:#7a8b90;font-size:11px;font-weight:700;margin-top:7px}.tp49-wrong-chips{grid-column:2/4;display:flex;gap:8px;flex-wrap:wrap}.tp49-wrong-chip{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;background:#f3f8f8;color:#61747b;font-size:11px;font-weight:800}.tp49-wrong-chip.ready{background:#eaf8f4;color:#19777e}.tp49-wrong-loading{opacity:.72;cursor:default}.tp49-wrong-error{border-color:#efc8c8}.tp49-wrong-error .tp49-wrong-copy small{color:#a14b4b}@media(max-width:600px){.tp49-wrong-card{padding:20px 18px;gap:14px;grid-template-columns:auto 1fr auto}.tp49-wrong-icon{width:52px;height:52px}.tp49-wrong-copy b{font-size:20px}.tp49-wrong-copy small{font-size:12px}.tp49-wrong-count strong{font-size:38px}.tp49-wrong-chips{grid-column:1/4}}
`;document.head.appendChild(s)}
async function load(){const t=token();if(!t)throw new Error('로그인이 필요합니다.');const r=await fetch(REVIEW_EDGE,{headers:{Authorization:`Bearer ${t}`,apikey:REVIEW_KEY},cache:'no-store'}),d=await r.json().catch(()=>({}));if(!r.ok||d.success===false)throw new Error(d.error||'오답을 불러오지 못했습니다.');const seen=new Set();return(d.reviews||[]).filter(x=>{const k=`${x.plan_id}::${x.question_id}`;if(seen.has(k))return false;seen.add(k);return true})}
function loadingCard(){return`<button class="tp49-wrong-card tp49-wrong-loading" type="button" disabled><span class="tp49-wrong-icon">↺</span><span class="tp49-wrong-copy"><b>오답 복습</b><small>오답을 확인하고 있어요…</small></span><span class="tp49-wrong-count"><strong>—</strong><small>개 남음</small></span></button>`}
function card(rows){const ready=rows.filter(due).length,later=rows.length-ready,total=rows.length;return`<button class="tp49-wrong-card" type="button" data-tp49-open ${total?'':'disabled'}><span class="tp49-wrong-icon">↺</span><span class="tp49-wrong-copy"><b>${total?'오답 복습':'오답 없음'}</b><small>${total?(ready?`지금 ${ready}개 복습할 수 있어요`:'다음 복습 시간을 기다리고 있어요'):'현재 남아 있는 오답이 없어요'}</small></span><span class="tp49-wrong-count"><strong>${total}</strong><small>개 남음</small></span>${total?`<span class="tp49-wrong-chips"><span class="tp49-wrong-chip ready">지금 ${ready}</span><span class="tp49-wrong-chip">대기 ${later}</span></span>`:''}</button>`}
function errorCard(msg){return`<button class="tp49-wrong-card tp49-wrong-error" type="button" data-tp49-retry><span class="tp49-wrong-icon">!</span><span class="tp49-wrong-copy"><b>오답 복습</b><small>${String(msg||'오답을 불러오지 못했습니다.')} · 눌러서 다시 시도</small></span><span class="tp49-wrong-count"><strong>—</strong><small>개 남음</small></span></button>`}
function openReview(){const nav=window.WillenaTestPrepNavigation;if(nav?.toWrong)return nav.toWrong();return window.WillenaReviewV49?.show?.()||window.WillenaReviewV48?.show?.()}
function bind(){const m=mount();if(!m)return;m.querySelector('[data-tp49-open]')?.addEventListener('click',openReview);m.querySelector('[data-tp49-retry]')?.addEventListener('click',refresh)}
async function refresh(){const m=mount();if(!m||busy)return;installStyles();busy=true;m.innerHTML=loadingCard();try{last=await load();const live=mount();if(!live)return;live.innerHTML=card(last);bind()}catch(e){const live=mount();if(live){live.innerHTML=errorCard(e?.message);bind()}}finally{busy=false}}
function schedule(){if((history.state?.tp||'home')!=='home')return;queueMicrotask(refresh)}
window.addEventListener('testprep:home-rendered',schedule);
window.addEventListener('testprep:student-state-refresh',()=>setTimeout(schedule,20));
window.addEventListener('testprep:review-finished',()=>setTimeout(schedule,20));
window.addEventListener('pageshow',()=>setTimeout(schedule,50));
setInterval(()=>{if((history.state?.tp||'home')==='home')refresh()},60000);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(schedule,80),{once:true});else setTimeout(schedule,80);
const badge=document.getElementById('tp-rev-badge');if(badge)badge.textContent='REV 49';
window.WillenaWrongCardV49={refresh,load};
console.log('[REV49] new wrong-answer card owns the home card; old tp-wrong-card markup is not used');
})();