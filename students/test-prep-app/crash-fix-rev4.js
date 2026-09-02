(function(){
'use strict';

const STATIONS=[
 {k:'vocabulary',label:'단어 학습'},
 {k:'vocab_test',label:'어휘 시험'},
 {k:'communication',label:'Communication'},
 {k:'grammar',label:'Grammar'},
 {k:'sentences',label:'본문외우기'},
 {k:'reading',label:'Reading'},
 {k:'constructed_response',label:'서술형'}
];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function scopeFor(plan){const lessons=plan?.group?.scope?.lessons;if(Array.isArray(lessons)&&lessons.length)return lessons.filter(x=>x?.lesson);return(plan?.units||[]).map(lesson=>({lesson,sections:plan.practice_types||[]}))}
function available(plan,l,st){const sections=new Set((l?.sections||[]).map(x=>String(x).toLowerCase())),strict=plan?.group?.scope?.scope_controls_v2===true;if(st.k==='sentences')return true;if(strict){if(st.k==='vocabulary'||st.k==='vocab_test')return sections.has('vocabulary');return sections.has(st.k)}return['vocabulary','vocab_test','sentences'].includes(st.k)||sections.has(st.k)}
function addBadge(){document.getElementById('tp-crash-fix-rev1')?.remove();document.getElementById('tp-crash-fix-rev2')?.remove();document.getElementById('tp-crash-fix-rev3')?.remove();if(document.getElementById('tp-crash-fix-rev4'))return;const b=document.createElement('div');b.id='tp-crash-fix-rev4';b.textContent='Crash Fix Rev4';Object.assign(b.style,{position:'fixed',right:'8px',bottom:'8px',zIndex:'2147483647',padding:'4px 8px',borderRadius:'999px',background:'rgba(20,20,24,.82)',color:'#fff',font:'600 11px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',boxShadow:'0 2px 8px rgba(0,0,0,.18)',pointerEvents:'none',opacity:'.88'});document.body.appendChild(b)}
function renderMinimal(planId,lesson){const home=document.getElementById('assignmentHome'),state=window.WillenaTestPrepAuth?.state,plan=state?.plans?.find(p=>String(p.id)===String(planId));if(!home||!plan)return;const l=scopeFor(plan).find(x=>String(x.lesson)===String(lesson));if(!l)return;const shown=STATIONS.filter(st=>available(plan,l,st));home.style.display='block';home.innerHTML=`<button type="button" class="tp-rev4-back" style="border:0;background:none;padding:10px 0;font:700 15px system-ui;color:#19777e">← 시험 대비</button><div style="padding:12px 0 8px"><h1 style="margin:0 0 6px;font:800 26px system-ui;color:#26383f">${esc(lesson)}</h1><p style="margin:0;color:#64748b;font:600 14px system-ui">${esc(plan.book_label||'')}</p></div><div style="display:grid;gap:10px;margin-top:14px">${shown.map(s=>`<button type="button" data-rev4-skill="${esc(s.k)}" style="display:block;width:100%;padding:16px;text-align:left;border:1px solid #dbe4e8;border-radius:14px;background:#fff;font:700 16px system-ui;color:#26383f">${esc(s.label)}</button>`).join('')}</div>`;home.querySelector('.tp-rev4-back').onclick=()=>{window.WillenaTestPrepNavigation?.toHome?.({replaceEntry:true})||window.WillenaTestPrepUX?.renderHome?.()};home.querySelectorAll('[data-rev4-skill]').forEach(btn=>btn.onclick=()=>window.WillenaTestPrepUX?.launchSkill?.(plan.id,lesson,btn.dataset.rev4Skill))}
function intercept(e){const card=e.target instanceof Element?e.target.closest('.tp-lesson-card'):null;if(!card)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();renderMinimal(card.dataset.lessonPlan,card.dataset.lesson)}
function boot(){addBadge();document.addEventListener('click',intercept,true);console.info('[Test Prep] Crash Fix Rev4 active: minimal lesson renderer interception enabled')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();