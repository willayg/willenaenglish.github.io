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
const TRACK='https://fiieuiktlsivwfgyivai.supabase.co';
const TRACK_KEY=['sb_publishable_','e-K50PquV9gHdfmefG6tmg_o-vVSl0e'].join('');
const CONTENT_HOST='gxwfsqxyuufqtitspfqg.supabase.co';
const norm=s=>String(s||'').trim().toLowerCase();
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=n=>Math.max(0,Math.min(100,Math.round(Number(n)||0)));
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
function statPayload(stat){const raw=stat&&stat.attempted_question_ids;if(raw&&typeof raw==='object'&&!Array.isArray(raw))return raw.by_practice&&typeof raw.by_practice==='object'?raw.by_practice:{};return {};}
async function cardStats(planId){
 const token=(window.WillenaAPI&&window.WillenaAPI.getLocalAccessToken&&window.WillenaAPI.getLocalAccessToken())||localStorage.getItem('sb_access_token')||'';
 if(!token)return[];
 const r=await fetch(TRACK+'/rest/v1/rpc/test_prep_card_stats',{method:'POST',headers:{apikey:TRACK_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({p_plan_id:String(planId)}),cache:'no-store'});
 if(!r.ok)throw new Error(await r.text());
 const x=await r.json();return Array.isArray(x)?x:[];
}
function ensureLiteStyles(){
 if(document.getElementById('tpFix4LiteStyles'))return;
 const s=document.createElement('style');s.id='tpFix4LiteStyles';s.textContent='\n.tp-fix4-metrics{display:grid;grid-template-columns:repeat(2,minmax(54px,1fr));gap:8px;align-items:center;min-width:128px}.tp-fix4-metric{display:flex;flex-direction:column;align-items:center;justify-content:center}.tp-fix4-metric b{font-size:18px;line-height:1;font-weight:800}.tp-fix4-metric small{margin-top:5px;font-size:9px;font-weight:800}.tp-fix4-completion b,.tp-fix4-completion small{color:var(--tp-cyan-dark,#19777e)}.tp-fix4-average b,.tp-fix4-average small{color:var(--tp-pink,#d65a88)}.tp-stop .tp-mini,.tp-stop-pct{display:none!important}@media(max-width:620px){.tp-fix4-metrics{min-width:112px;gap:6px}.tp-fix4-metric b{font-size:16px}.tp-fix4-metric small{font-size:8px}}';document.head.appendChild(s);
}
async function hydrateLiteStats(plan,l,skills){
 let stats=[];try{stats=await cardStats(plan.id)}catch(e){console.warn('[Fix4] stats',e);return;}
 const stat=stats.find(x=>String(x.unit_key)===String(l.lesson))||null,by=statPayload(stat);
 skills.forEach(s=>{
   const row=document.querySelector('.tp-stop[data-safe-skill="'+CSS.escape(String(s.k))+'"]');if(!row)return;
   const ps=by[s.k]||{},count=Math.max(0,Number(ps.recent_count)||0),acc=count&&ps.recent_accuracy!=null?clamp(ps.recent_accuracy):null,done=Math.max(0,Number(ps.unique_count)||0);
   const c=row.querySelector('[data-fix4-completion]'),a=row.querySelector('[data-fix4-average]');
   if(c)c.textContent=done?String(done):'—';if(a)a.textContent=acc==null?'—':acc+'%';
 });
}
function renderSafeLesson(planId,lesson,opts){
 opts=opts||{};
 const plan=findPlan(planId);if(!plan)return false;
 const l=scopeFor(plan).find(x=>String(x.lesson)===String(lesson));if(!l)return false;
 const h=document.getElementById('assignmentHome');if(!h)return false;
 const q=document.getElementById('assignedQuizPane');if(q)q.style.display='none';h.style.display='block';
 ensureLiteStyles();
 const skills=skillsFor(plan,l);
 h.innerHTML='<button class="tp-back" type="button">← 시험 대비</button><div class="tp-lesson-head"><div><h1>'+esc(l.lesson)+'</h1><p>'+esc(plan.book_label||'')+' · 학습 지도</p></div></div><div class="tp-subway">'+skills.map((s,i)=>'<div class="tp-stop" data-safe-skill="'+esc(s.k)+'"><div class="tp-station">'+(i+1)+'</div><div class="tp-stop-copy"><b>'+esc(s.label)+'</b><small>'+esc(s.desc)+'</small></div><div class="tp-fix4-metrics"><span class="tp-fix4-metric tp-fix4-completion"><b data-fix4-completion>—</b><small>완료</small></span><span class="tp-fix4-metric tp-fix4-average"><b data-fix4-average>—</b><small>평균</small></span></div></div>').join('')+'</div>';
 const back=h.querySelector('.tp-back');if(back)back.onclick=()=>window.WillenaTestPrepNavigation&&window.WillenaTestPrepNavigation.toHome&&window.WillenaTestPrepNavigation.toHome({replaceEntry:true});
 h.querySelectorAll('[data-safe-skill]').forEach(row=>{row.onclick=()=>window.WillenaTestPrepUX&&window.WillenaTestPrepUX.openPractice&&window.WillenaTestPrepUX.openPractice(plan.id,l.lesson,row.dataset.safeSkill,'lesson');});
 try{
   const route={tp:'lesson',planId:String(plan.id),lesson:String(l.lesson),safeFix4:true};
   if(opts.replace)history.replaceState(route,'',location.href);else if(!history.state||history.state.tp!=='lesson'||String(history.state.planId)!==String(plan.id)||String(history.state.lesson)!==String(l.lesson))history.pushState(route,'',location.href);else history.replaceState(route,'',location.href);
 }catch(_){ }
 hydrateLiteStats(plan,l,skills);
 return true;
}

window.WillenaLessonSafeFix4={renderSafeLesson};

/* Prevent the original lesson hydrator from downloading large curriculum result sets on old devices. Practice requests are untouched. */
const nativeFetch=window.fetch.bind(window);
window.fetch=function(input,init){
 try{
   const u=typeof input==='string'?input:(input&&input.url)||'';
   if(history.state&&history.state.tp==='lesson'&&u.indexOf(CONTENT_HOST)!==-1){return Promise.resolve(new Response('[]',{status:200,headers:{'Content-Type':'application/json'}}));}
 }catch(_){ }
 return nativeFetch(input,init);
};

/* Initial lesson-card entry. */
document.addEventListener('click',function(e){
 const card=e.target&&e.target.closest&&e.target.closest('.tp-lesson-card');if(!card)return;
 const planId=card.dataset.lessonPlan,lesson=card.dataset.lesson;if(!planId||!lesson)return;
 e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();
 renderSafeLesson(planId,lesson);
},true);

function cleanupPractice(){
 try{window.WillenaVocabPractice&&window.WillenaVocabPractice.restore&&window.WillenaVocabPractice.restore()}catch(_){}
 try{window.WillenaVocabTestPractice&&window.WillenaVocabTestPractice.restore&&window.WillenaVocabTestPractice.restore()}catch(_){}
 try{window.WillenaSentencePractice&&window.WillenaSentencePractice.restore&&window.WillenaSentencePractice.restore()}catch(_){}
}

/* Consume the real browser history entry when leaving practice. Do not replace practice with another lesson entry. */
function installReturnHooks(){
 const ux=window.WillenaTestPrepUX,nav=window.WillenaTestPrepNavigation;if(!ux||!nav)return false;
 if(!ux.__fix4OriginalReturn&&ux.returnFromPractice){ux.__fix4OriginalReturn=ux.returnFromPractice;ux.returnFromPractice=function(selection){const s=history.state||{},planId=(selection&&selection.plan&&selection.plan.id)||s.planId,lesson=(selection&&selection.lesson)||s.lesson;cleanupPractice();if(s.tp==='practice'){history.back();return;}if(planId&&lesson){renderSafeLesson(planId,lesson,{replace:true});return;}return ux.__fix4OriginalReturn(selection);};}
 if(!nav.__fix4OriginalBack&&nav.back){nav.__fix4OriginalBack=nav.back;nav.back=function(){const s=history.state||{};if(s.tp==='practice'){cleanupPractice();history.back();return;}return nav.__fix4OriginalBack();};}
 return true;
}
if(!installReturnHooks()){const t=setInterval(()=>{if(installReturnHooks())clearInterval(t)},100);setTimeout(()=>clearInterval(t),5000);}

/* Fallback only. The pre-navigation guard now intercepts lesson popstate before the original heavy renderer. */
window.addEventListener('popstate',function(){setTimeout(function(){const s=history.state||{};if(s.tp==='lesson'&&s.planId&&s.lesson)renderSafeLesson(s.planId,s.lesson,{replace:true});},0);});

const badge=document.createElement('div');badge.textContent='Fix4';badge.style.cssText='position:fixed;right:4px;bottom:4px;z-index:99999;font:600 8px/1 Arial,sans-serif;padding:2px 3px;border-radius:3px;background:rgba(0,0,0,.45);color:#fff;pointer-events:none;opacity:.65';document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(badge),{once:true});if(document.body)document.body.appendChild(badge);
console.log('[Test Prep] Fix4 persistent lightweight lesson route active');
})();