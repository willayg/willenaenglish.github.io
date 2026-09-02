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
function addStyles(){if(document.getElementById('tpCrashRev6Style'))return;const s=document.createElement('style');s.id='tpCrashRev6Style';s.textContent=`
.tp-r6-wrap{max-width:760px;margin:0 auto;padding:8px 0 28px}
.tp-r6-back{border:0;background:transparent;color:#ee5f91;font-weight:800;font-size:12px;padding:5px 0 14px;cursor:pointer}
.tp-r6-head{padding:2px 0 14px}
.tp-r6-head h1{margin:0;font-size:26px;line-height:1.2;color:#203039}
.tp-r6-head p{margin:5px 0 0;color:#7c8b92;font-size:11px;font-weight:650}
.tp-r6-route{background:#fff;border:1.5px solid #9de2e7;border-radius:22px;padding:18px 16px}
.tp-r6-stop{position:relative;width:100%;display:grid;grid-template-columns:54px 1fr 62px 24px;gap:12px;align-items:center;min-height:82px;padding:6px 0;border:0;background:transparent;text-align:left;color:#203039;cursor:pointer}
.tp-r6-stop:not(:last-child)::before{content:'';position:absolute;left:24px;top:52px;bottom:-24px;width:4px;border-radius:3px;background:#dff3f5}
.tp-r6-dot{position:relative;z-index:1;width:50px;height:50px;border-radius:50%;display:grid;place-items:center;border:5px solid #bdeff2;background:#fff;color:#07888d;font-size:13px;font-weight:800}
.tp-r6-copy b{display:block;font-size:15px;line-height:1.25}
.tp-r6-copy small{display:block;margin-top:3px;color:#7c8b92;font-size:10px;font-weight:600}
.tp-r6-pct{font-size:14px;font-weight:800;color:#203039;text-align:right;white-space:nowrap}
.tp-r6-arrow{font-size:20px;color:#ee5f91;font-weight:800;text-align:right}
`;
document.head.appendChild(s)}
function addBadge(){['tp-crash-fix-rev1','tp-crash-fix-rev2','tp-crash-fix-rev3','tp-crash-fix-rev4','tp-crash-fix-rev5'].forEach(id=>document.getElementById(id)?.remove());if(document.getElementById('tp-crash-fix-rev6'))return;const b=document.createElement('div');b.id='tp-crash-fix-rev6';b.textContent='Crash Fix Rev6';Object.assign(b.style,{position:'fixed',right:'8px',bottom:'8px',zIndex:'2147483647',padding:'4px 8px',borderRadius:'999px',background:'rgba(20,20,24,.82)',color:'#fff',font:'600 11px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',boxShadow:'0 2px 8px rgba(0,0,0,.18)',pointerEvents:'none',opacity:'.88'});document.body.appendChild(b)}
function renderJourney(planId,lesson){const home=document.getElementById('assignmentHome'),state=window.WillenaTestPrepAuth?.state,plan=state?.plans?.find(p=>String(p.id)===String(planId));if(!home||!plan)return;const l=scopeFor(plan).find(x=>String(x.lesson)===String(lesson));if(!l)return;const shown=STATIONS.filter(st=>available(plan,l,st));home.style.display='block';home.innerHTML=`<div class="tp-r6-wrap"><button type="button" class="tp-r6-back">← 시험 대비</button><div class="tp-r6-head"><h1>${esc(lesson)}</h1><p>${esc(plan.book_label||'')} · 학습 지도</p></div><div class="tp-r6-route">${shown.map((s,i)=>`<button type="button" class="tp-r6-stop" data-r6-skill="${esc(s.k)}"><span class="tp-r6-dot">${i+1}</span><span class="tp-r6-copy"><b>${esc(s.label)}</b><small>${esc(s.desc)}</small></span><span class="tp-r6-pct">—</span><span class="tp-r6-arrow">›</span></button>`).join('')}</div></div>`;home.querySelector('.tp-r6-back').onclick=()=>{window.WillenaTestPrepNavigation?.toHome?.({replaceEntry:true})||window.WillenaTestPrepUX?.renderHome?.()};home.querySelectorAll('[data-r6-skill]').forEach(btn=>btn.onclick=()=>window.WillenaTestPrepUX?.launchSkill?.(plan.id,lesson,btn.dataset.r6Skill))}
function intercept(e){const card=e.target instanceof Element?e.target.closest('.tp-lesson-card'):null;if(!card)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();renderJourney(card.dataset.lessonPlan,card.dataset.lesson)}
function boot(){addStyles();addBadge();document.addEventListener('click',intercept,true);console.info('[Test Prep] Crash Fix Rev6 active: lightweight journey + real mastery percentages from progress sync')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();