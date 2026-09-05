(function(){
'use strict';

const STATIONS=[
 {k:'vocabulary',label:'단어 학습',desc:'카드 · 뜻 · 철자'},
 {k:'vocab_test',label:'어휘 시험',desc:'정의 · 시험형 어휘 문제'},
 {k:'communication',label:'Communication',desc:'핵심 대화 표현'},
 {k:'grammar',label:'Grammar',desc:'핵심 문법'},
 {k:'sentences',label:'본문외우기',desc:'본문 문장 완성'},
 {k:'reading',label:'Reading',desc:'본문 이해'},
 {k:'constructed_response',label:'서술형',desc:'영작 · 배열 · 대화 · 본문 해석'}
];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function scopeFor(plan){const lessons=plan?.group?.scope?.lessons;if(Array.isArray(lessons)&&lessons.length)return lessons.filter(x=>x?.lesson);return(plan?.units||[]).map(lesson=>({lesson,sections:plan.practice_types||[]}))}
function available(plan,l,st){const sections=new Set((l?.sections||[]).map(x=>String(x).toLowerCase())),strict=plan?.group?.scope?.scope_controls_v2===true;if(st.k==='sentences')return true;if(strict){if(st.k==='vocabulary'||st.k==='vocab_test')return sections.has('vocabulary');return sections.has(st.k)}return['vocabulary','vocab_test','sentences'].includes(st.k)||sections.has(st.k)}
function addStyles(){if(document.getElementById('tpCrashRev7Style'))return;const s=document.createElement('style');s.id='tpCrashRev7Style';s.textContent=`
.tp-r7-wrap{max-width:760px;margin:0 auto;padding:8px 0 28px}
.tp-r7-back{border:0;background:transparent;color:#ee5f91;font-weight:800;font-size:12px;padding:5px 0 14px;cursor:pointer}
.tp-r7-head{padding:2px 0 14px}
.tp-r7-head h1{margin:0;font-size:26px;line-height:1.2;color:#203039}
.tp-r7-head p{margin:5px 0 0;color:#7c8b92;font-size:11px;font-weight:650}
.tp-r7-route{background:#fff;border:1.5px solid #9de2e7;border-radius:22px;padding:18px 16px}
.tp-r7-stop{position:relative;width:100%;display:grid;grid-template-columns:54px 1fr 62px 24px;gap:12px;align-items:center;min-height:92px;padding:7px 0;border:0;background:transparent;text-align:left;color:#203039;cursor:pointer}
.tp-r7-stop:not(:last-child)::before{content:'';position:absolute;left:24px;top:52px;bottom:-32px;width:4px;border-radius:3px;background:#dff3f5}
.tp-r7-dot{position:relative;z-index:1;width:50px;height:50px;border-radius:50%;display:grid;place-items:center;border:5px solid #bdeff2;background:#fff;color:#07888d;font-size:13px;font-weight:800}
.tp-r7-copy{min-width:0;width:100%}
.tp-r7-copy b{display:block;font-size:15px;line-height:1.25}
.tp-r7-copy small{display:block;margin-top:3px;color:#7c8b92;font-size:10px;font-weight:600}
.tp-r7-bar{display:block;width:100%;height:9px;background:#b9dfe3;border-radius:999px;overflow:hidden;margin-top:9px}
.tp-r7-bar i{display:block;height:100%;width:0;background:#07888d;border-radius:999px}
.tp-r7-pct{font-size:14px;font-weight:800;color:#203039;text-align:right;white-space:nowrap}
.tp-r7-arrow{font-size:20px;color:#ee5f91;font-weight:800;text-align:right}
@media (min-width:600px) and (max-width:1100px){
 .tp-r7-wrap{max-width:860px;padding-top:12px}
 .tp-r7-back{font-size:15px;padding-bottom:18px}
 .tp-r7-head{padding-bottom:18px}
 .tp-r7-head h1{font-size:32px}
 .tp-r7-head p{font-size:14px;margin-top:7px}
 .tp-r7-route{padding:22px 20px}
 .tp-r7-stop{grid-template-columns:64px 1fr 72px 30px;gap:15px;min-height:108px;padding:9px 0}
 .tp-r7-stop:not(:last-child)::before{left:29px;top:61px;bottom:-38px;width:5px}
 .tp-r7-dot{width:60px;height:60px;border-width:6px;font-size:16px}
 .tp-r7-copy b{font-size:19px;line-height:1.3}
 .tp-r7-copy small{font-size:13px;margin-top:5px}
 .tp-r7-pct{font-size:17px}
 .tp-r7-arrow{font-size:25px}
 .tp-r7-bar{height:10px;margin-top:11px}
}
`;
document.head.appendChild(s)}
function removeCrashBadges(){['tp-crash-fix-rev1','tp-crash-fix-rev2','tp-crash-fix-rev3','tp-crash-fix-rev4','tp-crash-fix-rev5','tp-crash-fix-rev6','tp-crash-fix-rev7','tp-crash-fix-rev8','tp-students-rev1','tp-students-rev2','tp-students-rev3','tp-students-rev4','tp-students-rev5'].forEach(id=>document.getElementById(id)?.remove())}
function renderJourney(planId,lesson){const home=document.getElementById('assignmentHome'),state=window.WillenaTestPrepAuth?.state,plan=state?.plans?.find(p=>String(p.id)===String(planId));if(!home||!plan)return;const l=scopeFor(plan).find(x=>String(x.lesson)===String(lesson));if(!l)return;const shown=STATIONS.filter(st=>available(plan,l,st));home.style.display='block';home.innerHTML=`<div class="tp-r7-wrap"><button type="button" class="tp-r7-back">← 시험 대비</button><div class="tp-r7-head"><h1>${esc(lesson)}</h1><p>${esc(plan.book_label||'')} · 학습 지도</p></div><div class="tp-r7-route">${shown.map((s,i)=>`<button type="button" class="tp-r7-stop" data-r7-skill="${esc(s.k)}"><span class="tp-r7-dot">${i+1}</span><span class="tp-r7-copy"><b>${esc(s.label)}</b><small>${esc(s.desc)}</small><span class="tp-r7-bar" aria-hidden="true"><i></i></span></span><span class="tp-r7-pct">—</span><span class="tp-r7-arrow">›</span></button>`).join('')}</div></div>`;requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'}));home.querySelector('.tp-r7-back').onclick=()=>{window.WillenaTestPrepNavigation?.toHome?.({replaceEntry:true})||window.WillenaTestPrepUX?.renderHome?.()};home.querySelectorAll('[data-r7-skill]').forEach(btn=>btn.onclick=()=>window.WillenaTestPrepUX?.launchSkill?.(plan.id,lesson,btn.dataset.r7Skill))}
function intercept(e){const card=e.target instanceof Element?e.target.closest('.tp-lesson-card'):null;if(!card)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();renderJourney(card.dataset.lessonPlan,card.dataset.lesson)}
function boot(){addStyles();removeCrashBadges();document.addEventListener('click',intercept,true);console.info('[Test Prep] Students Rev5 active')}
window.WillenaStudentsRev5={renderJourney};
window.WillenaStudentsRev4=window.WillenaStudentsRev5;
window.WillenaStudentsRev2=window.WillenaStudentsRev5;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();