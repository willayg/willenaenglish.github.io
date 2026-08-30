(function(){
'use strict';
const KEY='tp_mastery_help_snooze_until';
const FOUR_DAYS=4*24*60*60*1000;
const $=(s,r=document)=>r.querySelector(s);
function addStyle(){if($('#tpMasteryHelpStyle'))return;const s=document.createElement('style');s.id='tpMasteryHelpStyle';s.textContent=`
.tp-mastery-help-btn{display:inline-grid;place-items:center;width:30px;height:30px;border:1px solid #d5dfe2;border-radius:50%;background:#fff;color:#547078;font-weight:900;font-size:15px;cursor:pointer;margin-left:8px;vertical-align:middle}
.tp-mastery-help-bg{position:fixed;inset:0;z-index:12000;background:rgba(22,33,38,.42);display:flex;align-items:center;justify-content:center;padding:20px}
.tp-mastery-help{width:min(420px,100%);background:#fff;border-radius:20px;padding:22px;box-shadow:0 18px 60px rgba(0,0,0,.18);font-family:inherit}
.tp-mastery-help h3{margin:0 0 10px;color:#26383f;font-size:21px}
.tp-mastery-help p{margin:0;color:#5f737a;font-size:15px;line-height:1.65;font-weight:600}
.tp-mastery-help strong{color:#19777e}
.tp-mastery-help-actions{display:grid;gap:8px;margin-top:18px}
.tp-mastery-help-actions button{border:0;border-radius:13px;padding:12px 14px;font-weight:800;font-size:14px;cursor:pointer}
.tp-mastery-help-ok{background:#19777e;color:#fff}.tp-mastery-help-snooze{background:#eef4f5;color:#526970}
`;document.head.appendChild(s)}
function snoozed(){const until=Number(localStorage.getItem(KEY)||0);return Number.isFinite(until)&&until>Date.now()}
function close(){document.querySelector('.tp-mastery-help-bg')?.remove()}
function open(){close();addStyle();const bg=document.createElement('div');bg.className='tp-mastery-help-bg';bg.innerHTML=`<div class="tp-mastery-help" role="dialog" aria-modal="true" aria-labelledby="tpMasteryHelpTitle"><h3 id="tpMasteryHelpTitle">숙련도 안내</h3><p>AI가 틀린 문제를 기억하고 다시 연습시켜 줘요.<br>틀렸던 문제는 한 번만 다시 맞히는 것이 아니라, <strong>여러 번 정확히 맞혀야 완전히 익힌 것으로 인정돼요.</strong></p><div class="tp-mastery-help-actions"><button type="button" class="tp-mastery-help-ok">확인</button><button type="button" class="tp-mastery-help-snooze">4일 동안 보지 않기</button></div></div>`;document.body.appendChild(bg);bg.querySelector('.tp-mastery-help-ok').onclick=close;bg.querySelector('.tp-mastery-help-snooze').onclick=()=>{localStorage.setItem(KEY,String(Date.now()+FOUR_DAYS));close()};bg.addEventListener('click',e=>{if(e.target===bg)close()});}
function addHelpButton(){const head=$('#assignmentHome .tp-lesson-head');if(!head||head.querySelector('.tp-mastery-help-btn'))return;const btn=document.createElement('button');btn.type='button';btn.className='tp-mastery-help-btn';btn.textContent='?';btn.setAttribute('aria-label','숙련도 안내');btn.onclick=e=>{e.stopPropagation();open()};const title=head.querySelector('h1');if(title)title.insertAdjacentElement('afterend',btn);else head.appendChild(btn)}
function maybeAuto(){if(window.__tpMasteryHelpShown||snoozed())return;const home=$('#assignmentHome');if(!home||!home.offsetParent)return;window.__tpMasteryHelpShown=true;setTimeout(open,250)}
function tick(){addHelpButton();maybeAuto()}
function boot(){addStyle();tick();setInterval(tick,500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.WillenaMasteryHelp={open};
})();