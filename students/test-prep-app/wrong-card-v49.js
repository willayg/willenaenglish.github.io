(function(){
'use strict';
const REVIEW_EDGE='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-review-v48';
const REVIEW_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
let busy=false;
function token(){return window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||''}
function due(x){return x?.due_now===true||!x?.next_review_at||new Date(x.next_review_at).getTime()<=Date.now()}
function mount(){return document.getElementById('tpWrongCardMount')}
function installStyles(){
 if(document.getElementById('tpWrong49nStyles'))return;
 const s=document.createElement('style');s.id='tpWrong49nStyles';s.textContent=`
 #tpWrongCardMount{margin-bottom:46px!important}
 .tp49-wrong-card{width:100%;box-sizing:border-box;border:0;border-radius:26px;background:linear-gradient(135deg,#ff5b98 0%,#f23879 100%);padding:25px 28px 24px;display:block;text-align:center;box-shadow:0 16px 38px rgba(242,56,121,.23);font-family:Poppins,'Noto Sans KR',system-ui,sans-serif;color:#fff;cursor:pointer;overflow:hidden;position:relative}
 .tp49-wrong-card:active{transform:translateY(1px)}.tp49-wrong-card:disabled{cursor:default}
 .tp49-wrong-copy{display:block;text-align:center}.tp49-wrong-copy b{display:block;font-size:32px;line-height:1.05;font-weight:800;color:#fff}
 .tp49-wrong-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;margin-top:18px;border-top:1px solid rgba(255,255,255,.27);padding-top:17px}
 .tp49-wrong-stat{min-width:0;padding:0 16px;text-align:center;border-right:1px solid rgba(255,255,255,.24)}.tp49-wrong-stat:first-child{padding-left:0}.tp49-wrong-stat:last-child{border-right:0;padding-right:0}
 .tp49-wrong-stat strong{display:block;color:#fff;font-size:28px;line-height:1;font-weight:800}.tp49-wrong-stat small{display:block;color:rgba(255,255,255,.84);font-size:11px;line-height:1.35;font-weight:700;margin-top:7px;white-space:normal}
 .tp49-wrong-loading{opacity:.82}.tp49-wrong-error{background:linear-gradient(135deg,#d95d77,#bd415d)}
 @media(max-width:600px){#tpWrongCardMount{margin-bottom:38px!important}.tp49-wrong-card{padding:21px 19px 20px}.tp49-wrong-copy b{font-size:28px}.tp49-wrong-stats{padding-top:15px;margin-top:16px}.tp49-wrong-stat{padding:0 9px}.tp49-wrong-stat strong{font-size:25px}.tp49-wrong-stat small{font-size:10px}}
 `;document.head.appendChild(s);
}
function statsHtml(now,later,total){return`<span class="tp49-wrong-stats"><span class="tp49-wrong-stat"><strong>${now}</strong><small>지금 할 문제</small></span><span class="tp49-wrong-stat"><strong>${later}</strong><small>나중에 할 문제</small></span><span class="tp49-wrong-stat"><strong>${total}</strong><small>총 남은 문제</small></span></span>`}
async function load(){
 const t=token();if(!t)throw new Error('로그인이 필요합니다.');
 const r=await fetch(REVIEW_EDGE,{headers:{Authorization:`Bearer ${t}`,apikey:REVIEW_KEY},cache:'no-store'});
 const d=await r.json().catch(()=>({}));if(!r.ok||d.success===false)throw new Error(d.error||'오답을 불러오지 못했습니다.');
 const seen=new Set();return(d.reviews||[]).filter(x=>{const k=`${x.plan_id}::${x.question_id}`;if(seen.has(k))return false;seen.add(k);return true});
}
function loadingCard(){return`<button class="tp49-wrong-card tp49-wrong-loading" type="button" disabled><span class="tp49-wrong-copy"><b>오답</b></span>${statsHtml('—','—','—')}</button>`}
function card(rows){
 const ready=rows.filter(due).length,later=rows.length-ready,total=rows.length;
 return`<button class="tp49-wrong-card" type="button" data-tp49-open ${total?'':'disabled'}><span class="tp49-wrong-copy"><b>오답</b></span>${statsHtml(ready,later,total)}</button>`;
}
function errorCard(){return`<button class="tp49-wrong-card tp49-wrong-error" type="button" data-tp49-retry><span class="tp49-wrong-copy"><b>오답</b></span>${statsHtml('—','—','—')}</button>`}
function openReview(){const nav=window.WillenaTestPrepNavigation;if(nav?.toWrong)return nav.toWrong();return window.WillenaReviewV49?.show?.()}
function bind(){const m=mount();if(!m)return;m.querySelector('[data-tp49-open]')?.addEventListener('click',openReview);m.querySelector('[data-tp49-retry]')?.addEventListener('click',refresh)}
async function refresh(){
 const m=mount();if(!m||busy)return;installStyles();busy=true;m.innerHTML=loadingCard();
 try{const rows=await load();const live=mount();if(!live)return;live.innerHTML=card(rows);bind()}
 catch(e){const live=mount();if(live){live.innerHTML=errorCard();bind()}}
 finally{busy=false}
}
function schedule(){if((history.state?.tp||'home')!=='home')return;queueMicrotask(refresh)}
window.addEventListener('testprep:home-rendered',schedule);
window.addEventListener('testprep:student-state-refresh',()=>setTimeout(schedule,20));
window.addEventListener('testprep:review-finished',()=>setTimeout(schedule,20));
window.addEventListener('pageshow',()=>setTimeout(schedule,50));
setInterval(()=>{if((history.state?.tp||'home')==='home')refresh()},60000);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(schedule,80),{once:true});else setTimeout(schedule,80);
window.WillenaWrongCardV49={refresh,load};
console.log('[REV49n] larger centered wrong-answer title with no subtitle');
})();