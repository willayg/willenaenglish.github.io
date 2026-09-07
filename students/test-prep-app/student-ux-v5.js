(function(){
'use strict';

const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const TRACK='https://fiieuiktlsivwfgyivai.supabase.co';
const TRACK_KEY=['sb_publishable_','e-K50PquV9gHdfmefG6tmg_o-vVSl0e'].join('');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=n=>Math.max(0,Math.min(100,Math.round(Number(n)||0)));
let started=false,homeHydration=0;

function route(){return history.state?.tp?history.state:{tp:'home'}}
function state(){return window.WillenaTestPrepAuth?.state||null}
function plans(){return state()?.plans||[]}
function home(){return $('#assignmentHome')}
function quiz(){return $('#assignedQuizPane')}
function scopeFor(plan){
 const ls=plan?.group?.scope?.lessons;
 if(Array.isArray(ls)&&ls.length)return ls.filter(x=>x?.lesson);
 return (plan?.units||[]).map(lesson=>({lesson,sections:plan.practice_types||[]}));
}
function activeTasks(plan){return(plan?.tasks||[]).filter(t=>t.active!==false&&!t.completed_at&&Number(t.progress?.remaining)>0)}
function sameRoute(a,b){return ['tp','planId','lesson','skill','returnTo'].every(k=>String(a?.[k]||'')===String(b?.[k]||''))}
function setRoute(next,{replace=false,render=true}={}){
 const s={...next};if(!s.tp)s.tp='home';
 if(replace||sameRoute(route(),s))history.replaceState(s,'',location.href);else history.pushState(s,'',location.href);
 if(render)renderRoute(s);
}
function showHomeSurface(){const h=home(),q=quiz();if(q)q.style.display='none';if(h)h.style.display='block'}
function closePracticeSurface(){
 try{window.WillenaVocabPractice?.restore?.()}catch(_){}
 try{window.WillenaVocabTestPractice?.restore?.()}catch(_){}
 try{window.WillenaSentencePractice?.restore?.()}catch(_){}
 showHomeSurface();
}
async function cardStats(planId){
 const token=window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
 if(!token)return[];
 const r=await fetch(`${TRACK}/rest/v1/rpc/test_prep_card_stats`,{method:'POST',headers:{apikey:TRACK_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({p_plan_id:String(planId)}),cache:'no-store'});
 if(!r.ok)throw new Error(await r.text());
 const x=await r.json();return Array.isArray(x)?x:[];
}
function planSchool(plan){return plan?.group?.school||state()?.user?.school||'학교 시험'}
function examLabel(plan){const g=plan?.group||{};return [g.term?`${g.term}학기`:'',g.exam_type==='final'?'기말고사':g.exam_type==='midterm'?'중간고사':plan?.exam_name].filter(Boolean).join(' · ')}
function dday(dateText){const m=String(dateText||'').match(/(\d{4})-(\d{2})-(\d{2})/);if(!m)return'';const now=new Date(),a=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()),b=Date.UTC(+m[1],+m[2]-1,+m[3]),d=Math.round((b-a)/86400000);return d===0?'D-DAY':d>0?`D-${d}`:`D+${Math.abs(d)}`}
function wrongMount(){return '<div id="tpWrongCardMount" data-review-card-owner="rev49"></div>'}
function lessonCard(plan,l){return `<button class="tp-lesson-card" data-lesson-plan="${esc(plan.id)}" data-lesson="${esc(l.lesson)}"><span class="tp-lesson-card-copy"><h3>${esc(l.lesson)}</h3><p class="tp-card-accuracy-label">정확도 불러오는 중</p><div class="tp-card-coverage"><div class="tp-card-coverage-meta"><span>문제 완료</span><b class="tp-card-coverage-count">—</b></div><div class="tp-card-coverage-track"><i></i></div></div></span><span class="tp-card-ring-wrap"><span class="tp-ring tp-card-accuracy-ring" style="--p:0%"><b>—</b></span><small class="tp-card-ring-label">정확도</small></span></button>`}
function planCompact(plan){
 const dd=dday(plan?.exam_date),exam=examLabel(plan),book=plan?.book_label||'';
 return `<section class="tp-plan-compact" style="margin:0 0 18px;padding:16px 18px;border:1.5px solid var(--tp-line);border-radius:20px;background:var(--tp-card);box-shadow:var(--tp-shadow);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;color:var(--tp-ink)"><div style="min-width:0;flex:1 1 260px"><div style="font-size:20px;font-weight:800;line-height:1.15;letter-spacing:-.025em">${esc(planSchool(plan))}</div><div style="margin-top:5px;font-size:12px;font-weight:700;color:var(--tp-muted);line-height:1.45">${esc([exam,book].filter(Boolean).join(' · '))}</div></div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">${dd?`<span style="border:1.25px solid var(--tp-line);border-radius:999px;padding:8px 11px;background:#fff;font-size:11px;font-weight:800;white-space:nowrap">${esc(dd)}</span>`:''}${plan?.exam_date?`<span style="border:1.25px solid var(--tp-line);border-radius:999px;padding:8px 11px;background:#fff;color:var(--tp-pink);font-size:11px;font-weight:800;white-space:nowrap">${esc(plan.exam_date)}</span>`:''}</div></section>`;
}
function taskShelf(allPlans){
 const all=(allPlans||[]).flatMap(p=>activeTasks(p).map(t=>({p,t}))).sort((a,b)=>new Date(a.t.due_at||'2999-01-01')-new Date(b.t.due_at||'2999-01-01'));
 if(!all.length)return'';
 return `<div class="tp-task-shelf">${all.slice(0,6).map(({p,t})=>`<button class="tp-task-chip" data-task-plan="${esc(p.id)}" data-task-lesson="${esc(t.lesson)}" data-task-skill="${esc(t.practice_type)}"><span class="arrow">→</span><span class="k">선생님 과제</span><b>${esc(t.title||`${t.lesson} ${t.practice_type||''}`)}</b><small>${Number(t.progress?.remaining)||0}개 남음</small></button>`).join('')}</div>`;
}
async function hydrateHome(allPlans,run){
 await Promise.all((allPlans||[]).map(async plan=>{
   let stats=[];try{stats=await cardStats(plan.id)}catch(e){console.warn('[TP-LITE] home stats',e)}
   if(run!==homeHydration)return;
   for(const l of scopeFor(plan)){
     const card=$(`.tp-lesson-card[data-lesson-plan="${CSS.escape(String(plan.id))}"][data-lesson="${CSS.escape(String(l.lesson))}"]`);if(!card)continue;
     const stat=stats.find(x=>String(x.unit_key)===String(l.lesson))||null;
     const count=Math.max(0,Number(stat?.recent_count)||0),acc=count&&stat?.recent_accuracy!=null?clamp(stat.recent_accuracy):null;
     const ring=$('.tp-card-accuracy-ring',card),rb=$('.tp-card-accuracy-ring b',card),label=$('.tp-card-accuracy-label',card);
     if(ring)ring.style.setProperty('--p',`${acc??0}%`);if(rb)rb.textContent=acc==null?'—':`${acc}%`;if(label)label.textContent=count?`최근 ${count}문제 정확도`:'아직 푼 문제가 없어요';
     const c=$('.tp-card-coverage-count',card),bar=$('.tp-card-coverage-track i',card);if(c)c.textContent='—';if(bar)bar.style.width='0%';
   }
 }));
}
function renderHome(){
 showHomeSurface();const h=home();if(!h)return;
 const all=plans();
 h.innerHTML=`${wrongMount()}${all.map(plan=>planCompact(plan)).join('')}${taskShelf(all)}${all.length?all.map(plan=>`<section class="tp-exam-section"><div class="tp-lessons">${scopeFor(plan).map(l=>lessonCard(plan,l)).join('')}</div></section>`).join(''):'<div class="tp-review-empty">지정된 시험 대비가 없습니다.</div>'}`;
 $$('.tp-lesson-card',h).forEach(b=>b.onclick=()=>renderLesson(b.dataset.lessonPlan,b.dataset.lesson));
 $$('[data-task-plan]',h).forEach(b=>b.onclick=()=>openPractice(b.dataset.taskPlan,b.dataset.taskLesson,b.dataset.taskSkill,'home'));
 const run=++homeHydration;hydrateHome(all,run);window.dispatchEvent(new CustomEvent('testprep:home-rendered'));
}
function renderLesson(planId,lesson,focusSkill=null){
 const safe=window.WillenaLessonSafeFix4;
 if(safe?.renderSafeLesson)return safe.renderSafeLesson(planId,lesson,{replace:route().tp==='lesson'});
 history.replaceState({tp:'lesson',planId:String(planId),lesson:String(lesson),skill:focusSkill||null,safeFix4:true},'',location.href);
 const h=home();if(h){showHomeSurface();h.innerHTML='<div class="tp-shell-loading">Lesson을 불러오는 중...</div>'}
 return false;
}
function showWrongCenter(){showHomeSurface();if(window.WillenaReviewV49?.show){window.WillenaReviewV49.show();return}const h=home();if(h)h.innerHTML='<div class="tp-review-empty">오답 복습을 불러오는 중...</div>'}
async function openPractice(planId,lesson,skill,returnTo='lesson'){
 setRoute({tp:'practice',planId:String(planId),lesson:String(lesson),skill:String(skill),returnTo},{render:false});
 try{await window.WillenaAssignedTestPrep?.startSelection?.(planId,lesson,skill)}catch(e){console.error('[TP-LITE] practice start',e);setRoute(returnTo==='lesson'?{tp:'lesson',planId,lesson,skill,safeFix4:true}:{tp:'home'},{replace:true})}
}
function returnFromPractice(selection){
 const s=route(),planId=selection?.plan?.id||s.planId,lesson=selection?.lesson||s.lesson,skill=selection?.section||s.skill;
 if(s.returnTo==='home')return setRoute({tp:'home'},{replace:true});
 if(planId&&lesson){history.replaceState({tp:'lesson',planId:String(planId),lesson:String(lesson),skill:skill||null,safeFix4:true},'',location.href);return renderLesson(planId,lesson,skill)}
 setRoute({tp:'home'},{replace:true});
}
function renderRoute(s=route()){
 if(s.tp==='practice')return;
 closePracticeSurface();
 if(s.tp==='lesson'&&s.planId&&s.lesson)return renderLesson(s.planId,s.lesson,s.skill||null);
 if(s.tp==='wrong')return showWrongCenter();
 return renderHome();
}
function toHome({replaceEntry=false}={}){setRoute({tp:'home'},{replace:replaceEntry})}
function toWrong({replaceEntry=false}={}){setRoute({tp:'wrong'},{replace:replaceEntry})}
function back(){const s=route();if(s.tp==='lesson'||s.tp==='wrong')toHome({replaceEntry:true});else if(s.tp==='practice')returnFromPractice(window.WillenaAssignedTestPrep?.selection);else history.back()}
function start(){
 if(started)return;started=true;
 if(!history.state?.tp)history.replaceState({tp:'home'},'',location.href);
 window.addEventListener('popstate',()=>renderRoute(route()));
 window.addEventListener('testprep:student-state-refresh',()=>{const s=route();if(s.tp!=='practice')renderRoute(s)});
 renderRoute(route());
}
function renderState(s){if(!started){start();return}renderRoute(s||route())}

window.WillenaTestPrepUX={start,renderHome,renderLesson,showWrongCenter,openPractice,returnFromPractice,renderRoute};
window.WillenaTestPrepNavigation={toHome,toWrong,back,renderState,get state(){return route()}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(state()?.user)start()},{once:true});else if(state()?.user)start();
console.log('[Test Prep] TP-LITE: legacy lesson hydrator removed');
})();