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
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_HOST='gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const norm=s=>String(s||'').trim().toLowerCase();
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=n=>Math.max(0,Math.min(100,Math.round(Number(n)||0)));
const summaryCache=new Map();
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
function summaryKey(plan,l){return String(plan.id)+'::'+String(l.lesson)}
function setDiagnostic(text,stateName){
 const el=document.getElementById('tpLessonDataDiagnostic');if(!el)return;
 el.textContent=text;
 el.dataset.state=stateName||'';
 el.style.background=stateName==='ok'?'#e7f7ef':stateName==='error'?'#fdebec':'#eef3f5';
 el.style.color=stateName==='ok'?'#176b45':stateName==='error'?'#a32732':'#40545d';
}
async function cardStats(planId){
 const token=(window.WillenaAPI&&window.WillenaAPI.getLocalAccessToken&&window.WillenaAPI.getLocalAccessToken())||localStorage.getItem('sb_access_token')||'';
 if(!token)return[];
 const r=await fetch(TRACK+'/rest/v1/rpc/test_prep_card_stats',{method:'POST',headers:{apikey:TRACK_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({p_plan_id:String(planId)}),cache:'no-store'});
 if(!r.ok)throw new Error(await r.text());
 const x=await r.json();return Array.isArray(x)?x:[];
}
async function contentSummary(plan,l){
 const key=summaryKey(plan,l);if(summaryCache.has(key))return summaryCache.get(key);
 const p=(async()=>{
   const r=await fetch(CONTENT+'/rest/v1/rpc/test_prep_lesson_content_summary',{method:'POST',headers:{apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_book_key:plan.book_key||null,p_book_label:plan.book_label||null,p_lesson:l.lesson||null,p_unit_id:l.unit_id?String(l.unit_id):null}),cache:'no-store'});
   if(!r.ok)throw new Error(await r.text());
   const x=await r.json();return x&&typeof x==='object'?x:{};
 })();
 summaryCache.set(key,p);try{return await p}catch(e){summaryCache.delete(key);throw e}
}
function ensureLiteStyles(){
 if(document.getElementById('tpFix4LiteStyles'))return;
 const s=document.createElement('style');s.id='tpFix4LiteStyles';s.textContent='\
.tp-fix4-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-items:center;min-width:142px;transform:translateX(-24px)}.tp-fix4-metric{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0}.tp-fix4-metric+.tp-fix4-metric{border-left:1px solid var(--tp-line);padding-left:10px}.tp-fix4-metric b{font-size:21px;line-height:1;font-weight:800;letter-spacing:-.035em;white-space:nowrap}.tp-fix4-metric small{margin-top:6px;font-size:10px;font-weight:800}.tp-fix4-completion b,.tp-fix4-completion small{color:var(--tp-cyan-dark,#19777e)}.tp-fix4-average b,.tp-fix4-average small{color:var(--tp-pink,#d65a88)}.tp-lesson-data-diagnostic{display:inline-flex;align-items:center;margin-top:10px;padding:5px 9px;border-radius:999px;font:800 10px/1.2 Poppins,sans-serif;letter-spacing:.01em;background:#eef3f5;color:#40545d}.tp-stop .tp-mini,.tp-stop-pct{display:none!important}@media(max-width:620px){.tp-fix4-metrics{min-width:118px;gap:6px;transform:translateX(-16px)}.tp-fix4-metric+.tp-fix4-metric{padding-left:6px}.tp-fix4-metric b{font-size:18px}.tp-fix4-metric small{font-size:9px}.tp-lesson-data-diagnostic{font-size:9px}}';document.head.appendChild(s);
}
function paintLiteMetrics(l,skills,totals,stats){
 const stat=(stats||[]).find(x=>String(x.unit_key)===String(l.lesson))||null,by=statPayload(stat);
 skills.forEach(s=>{
   const row=document.querySelector('.tp-stop[data-safe-skill="'+CSS.escape(String(s.k))+'"]');if(!row)return;
   const ps=by[s.k]||{},count=Math.max(0,Number(ps.recent_count)||0),acc=count&&ps.recent_accuracy!=null?clamp(ps.recent_accuracy):null,done=Math.max(0,Number(ps.unique_count)||0),total=Math.max(0,Number((totals||{})[s.k])||0);
   const c=row.querySelector('[data-fix4-completion]'),a=row.querySelector('[data-fix4-average]');
   if(c)c.textContent=total?(stats?Math.min(done,total)+' / '+total:'— / '+total):(done?String(done):'—');
   if(a)a.textContent=acc==null?'—':acc+'%';
 });
}
async function hydrateLiteStats(plan,l,skills){
 let totals={};
 const cached=summaryCache.has(summaryKey(plan,l));
 const started=performance&&performance.now?performance.now():Date.now();
 setDiagnostic(cached?'Totals: SUPABASE RPC · cached':'Totals: SUPABASE RPC · loading…','loading');
 try{
   totals=await contentSummary(plan,l);
   const ended=performance&&performance.now?performance.now():Date.now();
   const ms=Math.max(0,Math.round(ended-started));
   setDiagnostic(cached?'Totals: SUPABASE RPC · cached':'Totals: SUPABASE RPC · '+ms+' ms','ok');
   paintLiteMetrics(l,skills,totals,null);
   console.log('[REV52u] lesson totals source: SUPABASE RPC',{lesson:l.lesson,ms:ms,cached:cached,totals:totals});
 }catch(e){
   setDiagnostic('Totals: SUPABASE RPC · FAILED','error');
   console.warn('[REV52u] Supabase lesson summary failed',e);
   return;
 }
 try{
   const stats=await Promise.race([
     cardStats(plan.id),
     new Promise(resolve=>setTimeout(()=>resolve([]),1800))
   ]);
   paintLiteMetrics(l,skills,totals,stats);
 }catch(e){
   console.warn('[REV52u] tracking stats unavailable; keeping content totals',e);
 }
}
function renderSafeLesson(planId,lesson,opts){
 opts=opts||{};
 const plan=findPlan(planId);if(!plan)return false;
 const l=scopeFor(plan).find(x=>String(x.lesson)===String(lesson));if(!l)return false;
 const h=document.getElementById('assignmentHome');if(!h)return false;
 const q=document.getElementById('assignedQuizPane');if(q)q.style.display='none';h.style.display='block';
 ensureLiteStyles();
 const skills=skillsFor(plan,l);
 h.innerHTML='<button class="tp-back" type="button">← 시험 대비</button><div class="tp-lesson-head"><div><h1>'+esc(l.lesson)+'</h1><p>'+esc(plan.book_label||'')+' · 학습 지도</p><span id="tpLessonDataDiagnostic" class="tp-lesson-data-diagnostic">Totals: SUPABASE RPC · waiting</span></div></div><div class="tp-subway">'+skills.map((s,i)=>'<div class="tp-stop" data-safe-skill="'+esc(s.k)+'"><div class="tp-station">'+(i+1)+'</div><div class="tp-stop-copy"><b>'+esc(s.label)+'</b><small>'+esc(s.desc)+'</small></div><div class="tp-fix4-metrics"><span class="tp-fix4-metric tp-fix4-completion"><b data-fix4-completion>—</b><small>완료</small></span><span class="tp-fix4-metric tp-fix4-average"><b data-fix4-average>—</b><small>평균</small></span></div></div>').join('')+'</div>';
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
const nativeFetch=window.fetch.bind(window);
window.fetch=function(input,init){
 try{
   const u=typeof input==='string'?input:(input&&input.url)||'';
   if(history.state&&history.state.tp==='lesson'&&u.indexOf(CONTENT_HOST)!==-1&&u.indexOf('/rpc/test_prep_lesson_content_summary')===-1){return Promise.resolve(new Response('[]',{status:200,headers:{'Content-Type':'application/json'}}));}
 }catch(_){ }
 return nativeFetch(input,init);
};
document.addEventListener('click',function(e){
 const card=e.target&&e.target.closest&&e.target.closest('.tp-lesson-card');if(!card)return;
 const planId=card.dataset.lessonPlan,lesson=card.dataset.lesson;if(!planId||!lesson)return;
 e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();renderSafeLesson(planId,lesson);
},true);
function cleanupPractice(){
 try{window.WillenaVocabPractice&&window.WillenaVocabPractice.restore&&window.WillenaVocabPractice.restore()}catch(_){}
 try{window.WillenaVocabTestPractice&&window.WillenaVocabTestPractice.restore&&window.WillenaVocabTestPractice.restore()}catch(_){}
 try{window.WillenaSentencePractice&&window.WillenaSentencePractice.restore&&window.WillenaSentencePractice.restore()}catch(_){}
}
function installReturnHooks(){
 const ux=window.WillenaTestPrepUX,nav=window.WillenaTestPrepNavigation;if(!ux||!nav)return false;
 if(!ux.__fix4OriginalReturn&&ux.returnFromPractice){ux.__fix4OriginalReturn=ux.returnFromPractice;ux.returnFromPractice=function(selection){const s=history.state||{},planId=(selection&&selection.plan&&selection.plan.id)||s.planId,lesson=(selection&&selection.lesson)||s.lesson;cleanupPractice();if(s.tp==='practice'){history.back();return;}if(planId&&lesson){renderSafeLesson(planId,lesson,{replace:true});return;}return ux.__fix4OriginalReturn(selection);};}
 if(!nav.__fix4OriginalBack&&nav.back){nav.__fix4OriginalBack=nav.back;nav.back=function(){const s=history.state||{};if(s.tp==='practice'){cleanupPractice();history.back();return;}return nav.__fix4OriginalBack();};}
 return true;
}
if(!installReturnHooks()){const t=setInterval(()=>{if(installReturnHooks())clearInterval(t)},100);setTimeout(()=>clearInterval(t),5000);}
window.addEventListener('popstate',function(){setTimeout(function(){const s=history.state||{};if(s.tp==='lesson'&&s.planId&&s.lesson)renderSafeLesson(s.planId,s.lesson,{replace:true});},0);});
console.log('[Test Prep] REV52u Supabase totals hydrate independently of tracking stats');
})();