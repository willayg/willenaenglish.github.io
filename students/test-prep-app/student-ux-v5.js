(function(){
'use strict';

const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const CONTENT_HEAD={apikey:CONTENT_KEY,Authorization:`Bearer ${CONTENT_KEY}`};
const TRACK='https://fiieuiktlsivwfgyivai.supabase.co';
const TRACK_KEY=['sb_publishable_','e-K50PquV9gHdfmefG6tmg_o-vVSl0e'].join('');
const STATIONS=[
 {k:'vocabulary',label:'단어 학습',desc:'카드 · 뜻 · 철자'},
 {k:'vocab_test',label:'어휘 시험',desc:'정의 · 시험형 어휘 문제'},
 {k:'communication',label:'Communication',desc:'핵심 대화 표현'},
 {k:'grammar',label:'Grammar',desc:'핵심 문법'},
 {k:'sentences',label:'본문외우기',desc:'본문 문장 완성'},
 {k:'reading',label:'Reading',desc:'본문 이해'},
 {k:'constructed_response',label:'서술형',desc:'영작 · 배열 · 대화 · 본문 해석'}
];
const LABEL=Object.fromEntries(STATIONS.map(x=>[x.k,x.label]));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s??'').trim().toLowerCase();
const clamp=n=>Math.max(0,Math.min(100,Math.round(Number(n)||0)));
const unitCache=new Map(), totalCache=new Map();
let started=false, homeHydration=0, lessonHydration=0;

function route(){return history.state?.tp?history.state:{tp:'home'}}
function sameRoute(a,b){return ['tp','planId','lesson','skill','returnTo'].every(k=>String(a?.[k]||'')===String(b?.[k]||''))}
function setRoute(next,{replace=false,render=true}={}){
 const state={...next};
 if(!state.tp)state.tp='home';
 if(replace||sameRoute(route(),state))history.replaceState(state,'',location.href);else history.pushState(state,'',location.href);
 if(render)renderRoute(state);
}
function normalizeRoute(){
 const s=route();
 if(s.tp==='practice'&&!window.WillenaAssignedTestPrep?.selection){
   const back=s.returnTo==='lesson'&&s.planId&&s.lesson?{tp:'lesson',planId:s.planId,lesson:s.lesson,skill:s.skill||null}:{tp:'home'};
   history.replaceState(back,'',location.href);
   return back;
 }
 return s;
}

function state(){return window.WillenaTestPrepAuth?.state||null}
function plans(){return state()?.plans||[]}
function findPlan(id){return plans().find(p=>String(p.id)===String(id))||null}
function scopeFor(plan){
 const ls=plan?.group?.scope?.lessons;
 if(Array.isArray(ls)&&ls.length)return ls.filter(x=>x?.lesson);
 return (plan?.units||[]).map(lesson=>({lesson,sections:plan.practice_types||[]}));
}
function activeTasks(plan){return(plan?.tasks||[]).filter(t=>t.active!==false&&!t.completed_at&&Number(t.progress?.remaining)>0)}
function taskFor(plan,lesson,practice){return activeTasks(plan).filter(t=>String(t.lesson)===String(lesson)&&norm(t.practice_type)===norm(practice)).sort((a,b)=>new Date(a.due_at||'2999-01-01')-new Date(b.due_at||'2999-01-01'))[0]||null}
function stationAvailable(plan,l,st){
 const sections=new Set((l?.sections||[]).map(norm));
 const strict=plan?.group?.scope?.scope_controls_v2===true;
 if(st.k==='sentences')return true;
 if(strict){if(st.k==='vocabulary'||st.k==='vocab_test')return sections.has('vocabulary');return sections.has(st.k)}
 return ['vocabulary','vocab_test','sentences'].includes(st.k)||sections.has(st.k)||!!taskFor(plan,l.lesson,st.k);
}
function skillRows(plan,l){return STATIONS.filter(st=>stationAvailable(plan,l,st)).map(st=>({...st,task:taskFor(plan,l.lesson,st.k)}))}
function planSchool(plan){return plan?.group?.school||state()?.user?.school||'학교 시험'}
function examLabel(plan){const g=plan?.group||{};return [g.term?`${g.term}학기`:'',g.exam_type==='final'?'기말고사':g.exam_type==='midterm'?'중간고사':plan?.exam_name].filter(Boolean).join(' · ')}
function dday(dateText){const m=String(dateText||'').match(/(\d{4})-(\d{2})-(\d{2})/);if(!m)return'';const now=new Date(),a=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()),b=Date.UTC(+m[1],+m[2]-1,+m[3]),d=Math.round((b-a)/86400000);return d===0?'D-DAY':d>0?`D-${d}`:`D+${Math.abs(d)}`}
function home(){return $('#assignmentHome')}
function quiz(){return $('#assignedQuizPane')}
function showHomeSurface(){const h=home(),q=quiz();if(q)q.style.display='none';if(h)h.style.display='block'}

async function contentGet(path){const r=await fetch(CONTENT+path,{headers:CONTENT_HEAD,cache:'no-store'});if(!r.ok)throw new Error(await r.text());return r.json()}
async function unitFor(plan,l){
 if(l?.unit_id)return String(l.unit_id);
 const key=`${plan?.book_key||plan?.book_label}::${l?.lesson}`;
 if(unitCache.has(key))return unitCache.get(key);
 const p=(async()=>{
   let books=[];
   if(plan?.book_key)books=await contentGet(`/rest/v1/content_books?select=id&source_key=eq.${encodeURIComponent(plan.book_key)}&limit=1`);
   if(!books[0])books=await contentGet(`/rest/v1/content_books?select=id&title=eq.${encodeURIComponent(plan?.book_label||'')}&limit=1`);
   if(!books[0])return'';
   let units=await contentGet(`/rest/v1/content_units?select=id&book_id=eq.${books[0].id}&title=eq.${encodeURIComponent(l?.lesson||'')}&limit=1`);
   if(!units[0]){const m=String(l?.lesson||'').match(/Lesson\s*(\d+)/i);if(m)units=await contentGet(`/rest/v1/content_units?select=id&book_id=eq.${books[0].id}&unit_number=eq.${m[1]}&limit=1`)}
   return String(units?.[0]?.id||'');
 })();
 unitCache.set(key,p);try{return await p}catch(e){unitCache.delete(key);throw e}
}
function countPassageSentences(body){let n=0;for(let line of String(body||'').split(/\n+/).map(x=>x.trim()).filter(Boolean)){if(/^(Situation\s+\d+|D-?\d+|D-Day)$/i.test(line))continue;line=line.replace(/^[A-Za-z][A-Za-z .'-]{0,24}:\s*/,'');const parts=line.match(/[^.!?]+[.!?]+(?:["'”’])?|[^.!?]+$/g)||[];n+=parts.map(x=>x.trim()).filter(x=>x&&/[A-Za-z]/.test(x)).length}return n}
async function totalFor(plan,l,practice){
 const key=`${plan?.id}::${l?.lesson}::${practice}`;if(totalCache.has(key))return totalCache.get(key);
 const p=(async()=>{
   const unitId=await unitFor(plan,l);if(!unitId)return 0;
   if(practice==='vocabulary'||practice==='vocab_test'){
     const rows=await contentGet(`/rest/v1/source_content_occurrences?select=lexical_entry_id&unit_id=eq.${unitId}&skill=eq.vocabulary&limit=10000`);
     return new Set((rows||[]).map(x=>String(x.lexical_entry_id||'')).filter(Boolean)).size;
   }
   if(practice==='sentences'){
     const rows=await contentGet(`/rest/v1/passages?select=body&status=eq.published&metadata-%3E%3Eunit_id=eq.${encodeURIComponent(unitId)}&limit=1000`);
     return(rows||[]).reduce((n,x)=>n+countPassageSentences(x.body),0);
   }
   const qs=await contentGet(`/rest/v1/test_prep_questions?select=id&unit_id=eq.${unitId}&student_usable=eq.true&replacement_needed=eq.false&section=eq.${encodeURIComponent(practice)}&limit=10000`);
   return(qs||[]).length;
 })();
 totalCache.set(key,p);try{return await p}catch(e){totalCache.delete(key);throw e}
}
async function cardStats(planId){
 const token=window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';if(!token)return[];
 const r=await fetch(`${TRACK}/rest/v1/rpc/test_prep_card_stats`,{method:'POST',headers:{apikey:TRACK_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({p_plan_id:String(planId)}),cache:'no-store'});
 if(!r.ok)throw new Error(await r.text());const x=await r.json();return Array.isArray(x)?x:[];
}
function statPayload(stat){const raw=stat?.attempted_question_ids;if(raw&&typeof raw==='object'&&!Array.isArray(raw))return{all:Array.isArray(raw.all)?raw.all:[],byPractice:raw.by_practice&&typeof raw.by_practice==='object'?raw.by_practice:{}};return{all:Array.isArray(raw)?raw:[],byPractice:{}}}
function installLessonMetricStyles(){
 if(document.getElementById('tp51gMetricStyles'))return;
 const s=document.createElement('style');s.id='tp51gMetricStyles';s.textContent=`
 .tp-stop{grid-template-columns:64px minmax(0,1fr) 180px!important}
 .tp-stop-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:center;padding-top:4px;min-width:0}
 .tp-skill-metric{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0}
 .tp-skill-metric+.tp-skill-metric{border-left:1px solid var(--tp-line);padding-left:12px}
 .tp-skill-metric b{display:block;font-size:25px;line-height:1;font-weight:800;letter-spacing:-.03em;white-space:nowrap}
 .tp-skill-metric small{display:block;margin-top:7px!important;font-size:11px!important;line-height:1.15!important;font-weight:800}
 .tp-skill-metric.tp-average b,.tp-skill-metric.tp-average small{color:var(--tp-cyan-dark)!important}
 .tp-skill-metric.tp-completion b,.tp-skill-metric.tp-completion small{color:var(--tp-pink)!important}
 @media(max-width:620px){.tp-stop{grid-template-columns:56px minmax(0,1fr) 154px!important;gap:10px!important}.tp-stop-metrics{gap:8px}.tp-skill-metric+.tp-skill-metric{padding-left:8px}.tp-skill-metric b{font-size:21px}.tp-skill-metric small{font-size:10px!important}}
 `;document.head.appendChild(s);
}

function taskShelf(allPlans){
 const all=(allPlans||[]).flatMap(p=>activeTasks(p).map(t=>({p,t}))).sort((a,b)=>new Date(a.t.due_at||'2999-01-01')-new Date(b.t.due_at||'2999-01-01'));
 if(!all.length)return'';
 return `<div class="tp-task-shelf">${all.slice(0,6).map(({p,t})=>`<button class="tp-task-chip" data-task-plan="${esc(p.id)}" data-task-lesson="${esc(t.lesson)}" data-task-skill="${esc(t.practice_type)}"><span class="arrow">→</span><span class="k">선생님 과제</span><b>${esc(t.title||`${t.lesson} ${LABEL[t.practice_type]||t.practice_type}`)}</b><small>${Number(t.progress?.remaining)||0}개 남음</small></button>`).join('')}</div>`;
}
function planCompact(plan){
 const dd=dday(plan?.exam_date),exam=examLabel(plan),book=plan?.book_label||'';
 return `<section class="tp-plan-compact" style="margin:0 0 18px;padding:16px 18px;border:1.5px solid var(--tp-line);border-radius:20px;background:var(--tp-card);box-shadow:var(--tp-shadow);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;color:var(--tp-ink)"><div style="min-width:0;flex:1 1 260px"><div style="font-size:20px;font-weight:800;line-height:1.15;letter-spacing:-.025em">${esc(planSchool(plan))}</div><div style="margin-top:5px;font-size:12px;font-weight:700;color:var(--tp-muted);line-height:1.45">${esc([exam,book].filter(Boolean).join(' · '))}</div></div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">${dd?`<span style="border:1.25px solid var(--tp-line);border-radius:999px;padding:8px 11px;background:#fff;font-size:11px;font-weight:800;white-space:nowrap">${esc(dd)}</span>`:''}${plan?.exam_date?`<span style="border:1.25px solid var(--tp-line);border-radius:999px;padding:8px 11px;background:#fff;color:var(--tp-pink);font-size:11px;font-weight:800;white-space:nowrap">${esc(plan.exam_date)}</span>`:''}<button class="tp-records" data-records="${esc(plan.id)}" style="padding:8px 11px;border-radius:999px;font-size:11px;white-space:nowrap">내 기록</button></div></section>`;
}
function planCompactShelf(allPlans){return (allPlans||[]).map(plan=>planCompact(plan)).join('')}
function lessonCard(plan,l){return `<button class="tp-lesson-card" data-lesson-plan="${esc(plan.id)}" data-lesson="${esc(l.lesson)}"><span class="tp-lesson-card-copy"><h3>${esc(l.lesson)}</h3><p class="tp-card-accuracy-label">정확도 불러오는 중</p><div class="tp-card-coverage"><div class="tp-card-coverage-meta"><span>문제 완료</span><b class="tp-card-coverage-count">—</b></div><div class="tp-card-coverage-track"><i></i></div></div></span><span class="tp-card-ring-wrap"><span class="tp-ring tp-card-accuracy-ring" style="--p:0%"><b>—</b></span><small class="tp-card-ring-label">정확도</small></span></button>`}
function wrongMount(){return '<div id="tpWrongCardMount" data-review-card-owner="rev49"></div>'}

async function hydrateHome(allPlans,run){
 await Promise.all((allPlans||[]).map(async plan=>{
   let stats=[];try{stats=await cardStats(plan.id)}catch(e){console.warn('[REV51] stats',e)}
   if(run!==homeHydration)return;
   const byLesson=new Map(stats.map(x=>[String(x.unit_key),x]));
   await Promise.all(scopeFor(plan).map(async l=>{
     const card=$(`.tp-lesson-card[data-lesson-plan="${CSS.escape(String(plan.id))}"][data-lesson="${CSS.escape(String(l.lesson))}"]`);if(!card||run!==homeHydration)return;
     const stat=byLesson.get(String(l.lesson))||null,count=Math.max(0,Number(stat?.recent_count)||0),acc=count&&stat?.recent_accuracy!=null?clamp(stat.recent_accuracy):null;
     const ring=$('.tp-card-accuracy-ring',card),rb=$('.tp-card-accuracy-ring b',card),label=$('.tp-card-accuracy-label',card);
     if(ring)ring.style.setProperty('--p',`${acc??0}%`);if(rb)rb.textContent=acc==null?'—':`${acc}%`;if(label)label.textContent=count?`최근 ${count}문제 정확도`:'아직 푼 문제가 없어요';
     const payload=statPayload(stat),by=payload.byPractice,skills=skillRows(plan,l);let done=0,total=0;
     await Promise.all(skills.map(async s=>{const t=await totalFor(plan,l,s.k);const u=Math.max(0,Number(by?.[s.k]?.unique_count)||0);total+=t;done+=t?Math.min(t,u):0}));
     if(run!==homeHydration||!card.isConnected)return;
     const c=$('.tp-card-coverage-count',card),bar=$('.tp-card-coverage-track i',card),coverage=total?clamp(done/total*100):0;
     if(c)c.textContent=`${done} / ${total}`;if(bar)bar.style.width=`${coverage}%`;
   }));
 }));
}

function renderHome(){
 if(route().tp==='practice')history.replaceState({tp:'home'},'',location.href);
 showHomeSurface();const h=home();if(!h)return;
 const all=plans();
 h.innerHTML=`${wrongMount()}${planCompactShelf(all)}${taskShelf(all)}${all.length?all.map(plan=>`<section class="tp-exam-section"><div class="tp-lessons">${scopeFor(plan).map(l=>lessonCard(plan,l)).join('')}</div></section>`).join(''):'<div class="tp-review-empty">지정된 시험 대비가 없습니다.</div>'}`;
 $$('[data-task-plan]',h).forEach(b=>b.onclick=()=>openPractice(b.dataset.taskPlan,b.dataset.taskLesson,b.dataset.taskSkill,'home'));
 $$('.tp-lesson-card',h).forEach(b=>b.onclick=()=>setRoute({tp:'lesson',planId:b.dataset.lessonPlan,lesson:b.dataset.lesson}));
 $$('[data-records]',h).forEach(b=>b.onclick=e=>{e.stopPropagation();openStats(b.dataset.records)});
 const run=++homeHydration;hydrateHome(all,run);window.dispatchEvent(new CustomEvent('testprep:home-rendered'));
}

async function hydrateLesson(plan,l,skills,run){
 let stats=[];try{stats=await cardStats(plan.id)}catch(e){console.warn('[REV51] lesson stats',e)}
 if(run!==lessonHydration)return;
 const stat=stats.find(x=>String(x.unit_key)===String(l.lesson))||null,by=statPayload(stat).byPractice;
 await Promise.all(skills.map(async s=>{
   const row=$(`.tp-stop[data-skill="${CSS.escape(String(s.k))}"]`);if(!row||run!==lessonHydration)return;
   const ps=by?.[s.k]||{},count=Math.max(0,Number(ps.recent_count)||0),acc=count&&ps.recent_accuracy!=null?clamp(ps.recent_accuracy):null,unique=Math.max(0,Number(ps.unique_count)||0);
   const avg=$('[data-skill-average]',row),completed=$('[data-skill-completion]',row),bar=$('.tp-mini i',row);
   if(avg)avg.textContent=acc==null?'—':`${acc}%`;
   try{const total=await totalFor(plan,l,s.k);if(run!==lessonHydration||!row.isConnected)return;const done=total?Math.min(total,unique):unique,coverage=total?clamp(done/total*100):0;if(completed)completed.textContent=total?`${done} / ${total}`:`${done}`;if(bar)bar.style.width=`${coverage}%`}catch(e){if(completed)completed.textContent=unique?`${unique}`:'—'}
 }));
}
function renderLesson(planId,lesson,focusSkill=null){
 const r=route();
 if(r.tp==='practice'){
   if(r.returnTo==='home'){history.replaceState({tp:'home'},'',location.href);renderHome();return}
   history.replaceState({tp:'lesson',planId:String(planId),lesson:String(lesson),skill:focusSkill||r.skill||null},'',location.href);
 }
 showHomeSurface();const h=home(),plan=findPlan(planId);if(!h||!plan){setRoute({tp:'home'},{replace:true});return}
 const l=scopeFor(plan).find(x=>String(x.lesson)===String(lesson));if(!l){setRoute({tp:'home'},{replace:true});return}
 const skills=skillRows(plan,l);installLessonMetricStyles();
 h.innerHTML=`<button class="tp-back" type="button">← 시험 대비</button><div class="tp-lesson-head"><div><h1>${esc(l.lesson)}</h1><p>${esc(plan.book_label||'')} · 학습 지도</p></div></div><div class="tp-subway">${skills.map((s,i)=>`<div class="tp-stop" data-skill="${esc(s.k)}"><div class="tp-station">${i+1}</div><div class="tp-stop-copy"><b>${esc(s.label)}</b><small>${esc(s.desc)}</small>${s.task?`<span class="tp-task-badge">선생님 과제 · ${Number(s.task.progress?.remaining)||0}개 남음</span>`:''}<div class="tp-mini"><i style="width:0"></i></div></div><div class="tp-stop-metrics"><span class="tp-skill-metric tp-average"><b data-skill-average>—</b><small>평균</small></span><span class="tp-skill-metric tp-completion"><b data-skill-completion>—</b><small>완료</small></span></div></div>`).join('')}</div>`;
 $('.tp-back',h).onclick=()=>setRoute({tp:'home'});
 $$('.tp-stop',h).forEach(row=>row.onclick=()=>openPractice(plan.id,l.lesson,row.dataset.skill,'lesson'));
 const run=++lessonHydration;hydrateLesson(plan,l,skills,run);
}

function showWrongCenter(){
 showHomeSurface();const h=home();if(!h)return;
 if(window.WillenaReviewV49?.show){window.WillenaReviewV49.show();return}
 h.innerHTML='<div class="tp-review-empty">오답 복습을 불러오는 중...</div>';
}

async function openPractice(planId,lesson,skill,returnTo='lesson'){
 setRoute({tp:'practice',planId:String(planId),lesson:String(lesson),skill:String(skill),returnTo},{render:false});
 try{await window.WillenaAssignedTestPrep?.startSelection?.(planId,lesson,skill)}catch(e){console.error('[REV51] practice start',e);setRoute(returnTo==='lesson'?{tp:'lesson',planId,lesson,skill}:{tp:'home'},{replace:true})}
}
function returnFromPractice(selection){
 const s=route(),planId=selection?.plan?.id||s.planId,lesson=selection?.lesson||s.lesson,skill=selection?.section||s.skill;
 const target=s.returnTo==='home'?{tp:'home'}:(planId&&lesson?{tp:'lesson',planId,lesson,skill}:{tp:'home'});
 setRoute(target,{replace:true});
}
function closePracticeSurface(){
 try{window.WillenaVocabPractice?.restore?.()}catch(_){}try{window.WillenaVocabTestPractice?.restore?.()}catch(_){}try{window.WillenaSentencePractice?.restore?.()}catch(_){}
 const q=quiz(),h=home();if(q)q.style.display='none';if(h)h.style.display='block';
}
function renderRoute(s=normalizeRoute()){
 if(s.tp==='practice')return;
 closePracticeSurface();
 if(s.tp==='lesson'&&s.planId&&s.lesson)return renderLesson(s.planId,s.lesson,s.skill||null);
 if(s.tp==='wrong')return showWrongCenter();
 return renderHome();
}

async function openStats(planId){
 const plan=findPlan(planId);if(!plan)return;
 let bg=$('#tpStatsBg');if(!bg){bg=document.createElement('div');bg.id='tpStatsBg';bg.className='tp-stats-bg';document.body.appendChild(bg)}
 bg.innerHTML='<div class="tp-stats-modal"><div class="tp-stats-head"><h3>내 시험 대비 기록</h3><button class="tp-stats-x">×</button></div><div class="tp-review-empty">불러오는 중...</div></div>';bg.classList.add('open');bg.onclick=e=>{if(e.target===bg)bg.classList.remove('open')};$('.tp-stats-x',bg).onclick=()=>bg.classList.remove('open');
 try{
   const stats=await cardStats(plan.id),rows=[];
   for(const l of scopeFor(plan)){const stat=stats.find(x=>String(x.unit_key)===String(l.lesson))||null,p=statPayload(stat).byPractice;let done=0,total=0;for(const s of skillRows(plan,l)){const t=await totalFor(plan,l,s.k),u=Math.max(0,Number(p?.[s.k]?.unique_count)||0);total+=t;done+=t?Math.min(t,u):0}rows.push({lesson:l.lesson,accuracy:stat?.recent_count?clamp(stat.recent_accuracy):null,count:Number(stat?.recent_count)||0,done,total})}
   const modal=$('.tp-stats-modal',bg);modal.innerHTML=`<div class="tp-stats-head"><h3>내 시험 대비 기록</h3><button class="tp-stats-x">×</button></div>${rows.map(r=>`<div class="tp-stat-row"><span>${esc(r.lesson)}</span><b>${r.accuracy==null?'—':`${r.accuracy}% 정확도`} · ${r.done}/${r.total} 완료</b></div>`).join('')}`;$('.tp-stats-x',bg).onclick=()=>bg.classList.remove('open');
 }catch(e){const body=$('.tp-review-empty',bg);if(body)body.textContent='기록을 불러오지 못했습니다.'}
}

function toHome({replaceEntry=false}={}){setRoute({tp:'home'},{replace:replaceEntry})}
function toWrong({replaceEntry=false}={}){setRoute({tp:'wrong'},{replace:replaceEntry})}
function back(){const s=route();if(s.tp==='lesson'||s.tp==='wrong')toHome({replaceEntry:true});else if(s.tp==='practice')returnFromPractice(window.WillenaAssignedTestPrep?.selection);else history.back()}
function start(){if(started)return;started=true;if(!history.state?.tp)history.replaceState({tp:'home'},'',location.href);window.addEventListener('popstate',()=>renderRoute(normalizeRoute()));window.addEventListener('testprep:student-state-refresh',()=>{const s=route();if(s.tp!=='practice')renderRoute(s)});renderRoute(normalizeRoute())}
function renderState(s){if(!started){start();return}renderRoute(s||normalizeRoute())}

window.WillenaTestPrepUX={start,renderHome,renderLesson,showWrongCenter,openPractice,returnFromPractice,renderRoute};
window.WillenaTestPrepNavigation={toHome,toWrong,back,renderState,get state(){return route()}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(state()?.user)start()},{once:true});else if(state()?.user)start();
console.log('[REV51g] lesson metrics show average and completion side by side');
})();