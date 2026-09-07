(function(){
'use strict';
const STATIONS=[
 {k:'vocabulary',label:'단어 학습',desc:'카드 · 뜻 · 철자'},
 {k:'vocab_test',label:'어휘 시험',desc:'정의 · 시험형 어휘 문제'},
 {k:'communication',label:'의사소통',desc:'핵심 대화 표현'},
 {k:'grammar',label:'문법',desc:'핵심 문법'},
 {k:'sentences',label:'본문외우기',desc:'본문 문장 완성'},
 {k:'reading',label:'독해',desc:'본문 이해'},
 {k:'constructed_response',label:'서술형',desc:'영작 · 배열 · 대화 · 본문 해석'}
];
const norm=s=>String(s||'').trim().toLowerCase();
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function state(){return window.WillenaTestPrepAuth&&window.WillenaTestPrepAuth.state}
function findPlan(id){return ((state()&&state().plans)||[]).find(p=>String(p.id)===String(id))||null}
function scopeFor(plan){const ls=plan&&plan.group&&plan.group.scope&&plan.group.scope.lessons;if(Array.isArray(ls)&&ls.length)return ls.filter(x=>x&&x.lesson);return ((plan&&plan.units)||[]).map(lesson=>({lesson:lesson,sections:plan.practice_types||[]}));}
function skillsFor(plan,l){
 const sections=new Set(((l&&l.sections)||[]).map(norm));
 const strict=!!(plan&&plan.group&&plan.group.scope&&plan.group.scope.scope_controls_v2===true);
 return STATIONS.filter(st=>{
   if(st.k==='sentences')return true;
   if(strict){if(st.k==='vocabulary'||st.k==='vocab_test')return sections.has('vocabulary');return sections.has(st.k)}
   return st.k==='vocabulary'||st.k==='vocab_test'||st.k==='sentences'||sections.has(st.k);
 });
}
function renderSafeLesson(planId,lesson){
 const plan=findPlan(planId);if(!plan)return false;
 const l=scopeFor(plan).find(x=>String(x.lesson)===String(lesson));if(!l)return false;
 const h=document.getElementById('assignmentHome');if(!h)return false;
 const q=document.getElementById('assignedQuizPane');if(q)q.style.display='none';h.style.display='block';
 const skills=skillsFor(plan,l);
 h.innerHTML='<button class="tp-back" type="button">← 시험 대비</button><div class="tp-lesson-head"><div><h1>'+esc(l.lesson)+'</h1><p>'+esc(plan.book_label||'')+' · 학습 지도</p></div></div><div class="tp-subway">'+skills.map((s,i)=>'<div class="tp-stop" data-safe-skill="'+esc(s.k)+'"><div class="tp-station">'+(i+1)+'</div><div class="tp-stop-copy"><b>'+esc(s.label)+'</b><small>'+esc(s.desc)+'</small></div><div class="tp-stop-pct"><span>›</span></div></div>').join('')+'</div>';
 const back=h.querySelector('.tp-back');if(back)back.onclick=()=>window.WillenaTestPrepNavigation&&window.WillenaTestPrepNavigation.toHome&&window.WillenaTestPrepNavigation.toHome({replaceEntry:true});
 h.querySelectorAll('[data-safe-skill]').forEach(row=>{row.onclick=()=>window.WillenaTestPrepUX&&window.WillenaTestPrepUX.openPractice&&window.WillenaTestPrepUX.openPractice(plan.id,l.lesson,row.dataset.safeSkill,'lesson');});
 try{history.pushState({tp:'lesson',planId:String(plan.id),lesson:String(l.lesson),safeFix3:true},'',location.href)}catch(_){ }
 return true;
}
document.addEventListener('click',function(e){
 const card=e.target&&e.target.closest&&e.target.closest('.tp-lesson-card');if(!card)return;
 const planId=card.dataset.lessonPlan,lesson=card.dataset.lesson;if(!planId||!lesson)return;
 e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();
 renderSafeLesson(planId,lesson);
},true);
const badge=document.createElement('div');badge.textContent='Fix3';badge.style.cssText='position:fixed;right:4px;bottom:4px;z-index:99999;font:600 8px/1 Arial,sans-serif;padding:2px 3px;border-radius:3px;background:rgba(0,0,0,.45);color:#fff;pointer-events:none;opacity:.65';document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(badge),{once:true});if(document.body)document.body.appendChild(badge);
console.log('[Test Prep] Fix3 safe lesson entry active');
})();