(function(){
'use strict';
const KEY='tp_mastery_help_snooze_until';
const FOUR_DAYS=4*24*60*60*1000;
const $=(s,r=document)=>r.querySelector(s);
function addStyle(){if($('#tpMasteryHelpStyle'))return;const s=document.createElement('style');s.id='tpMasteryHelpStyle';s.textContent=`
.tp-lesson-head{position:relative}
.tp-mastery-help-btn{position:absolute;top:0;right:0;display:inline-grid;place-items:center;width:32px;height:32px;border:1px solid #9fdfe5;border-radius:50%;background:#fff;color:#19777e;font-weight:900;font-size:16px;cursor:pointer;z-index:2}
.tp-mastery-help-bg{position:fixed;inset:0;z-index:12000;background:rgba(22,33,38,.42);display:flex;align-items:center;justify-content:center;padding:20px}
.tp-mastery-help{width:min(420px,100%);background:#fff;border:2px solid #9fdfe5;border-radius:20px;padding:24px 22px;box-shadow:0 18px 60px rgba(0,0,0,.18);font-family:inherit;text-align:center}
.tp-mastery-help h3{margin:0 0 12px;color:#26383f;font-size:21px;text-align:center}
.tp-mastery-help p{margin:0;color:#5f737a;font-size:15px;line-height:1.75;font-weight:650;text-align:center}
.tp-mastery-help-actions{display:grid;gap:8px;margin-top:20px}
.tp-mastery-help-actions button{border-radius:13px;padding:12px 14px;font-weight:800;font-size:14px;cursor:pointer;background:#fff}
.tp-mastery-help-ok{border:2px solid #70d8e0;color:#e05a8a}.tp-mastery-help-snooze{border:0;background:#eef4f5!important;color:#526970}
`;document.head.appendChild(s)}
function snoozed(){const until=Number(localStorage.getItem(KEY)||0);return Number.isFinite(until)&&until>Date.now()}
function close(){document.querySelector('.tp-mastery-help-bg')?.remove()}
function open(){close();addStyle();const bg=document.createElement('div');bg.className='tp-mastery-help-bg';bg.innerHTML=`<div class="tp-mastery-help" role="dialog" aria-modal="true" aria-labelledby="tpMasteryHelpTitle"><h3 id="tpMasteryHelpTitle">숙련도 안내</h3><p>AI윌리가 오답을 기억하고, 다시 문제를 낼 거예요!<br>오답까지 모두 맞춰야만 완전히 익힌것으로 인정해요.<br>오답률 0%를 향하여 화이팅!</p><div class="tp-mastery-help-actions"><button type="button" class="tp-mastery-help-ok">확인</button><button type="button" class="tp-mastery-help-snooze">4일 동안 보지 않기</button></div></div>`;document.body.appendChild(bg);bg.querySelector('.tp-mastery-help-ok').onclick=close;bg.querySelector('.tp-mastery-help-snooze').onclick=()=>{localStorage.setItem(KEY,String(Date.now()+FOUR_DAYS));close()};bg.addEventListener('click',e=>{if(e.target===bg)close()});}
function addHelpButton(){const head=$('#assignmentHome .tp-lesson-head');if(!head||head.querySelector('.tp-mastery-help-btn'))return;const btn=document.createElement('button');btn.type='button';btn.className='tp-mastery-help-btn';btn.textContent='?';btn.setAttribute('aria-label','숙련도 안내');btn.onclick=e=>{e.stopPropagation();open()};head.appendChild(btn)}
function maybeAuto(){if(window.__tpMasteryHelpShown||snoozed())return;const home=$('#assignmentHome');if(!home||!home.offsetParent)return;window.__tpMasteryHelpShown=true;setTimeout(open,250)}
function tick(){addHelpButton();maybeAuto()}
function boot(){addStyle();tick();setInterval(tick,500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.WillenaMasteryHelp={open};
})();