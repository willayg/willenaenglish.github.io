(function(){
'use strict';
const TOTAL=25;
const $=(s,r=document)=>r.querySelector(s);
function currentLesson(){return ($('#assignmentHome .tp-lesson-head h1')?.textContent||'').trim()}
function findPlan(lesson){const plans=window.WillenaTestPrepAuth?.state?.plans||[];return plans.find(p=>(p.group?.scope?.lessons||[]).some(x=>String(x.lesson)===String(lesson)))||plans.find(p=>(p.units||[]).map(String).includes(String(lesson)))||null}
function statFor(plan,lesson){return plan?.summary?.by_lesson_practice?.[`${lesson}||constructed_response`]||null}
function apply(){
 const stop=$('#assignmentHome .tp-stop[data-skill="constructed_response"]');
 if(!stop)return;
 const lesson=currentLesson();if(!lesson)return;
 const plan=findPlan(lesson),stat=statFor(plan,lesson);if(!stat)return;
 const done=Math.max(0,Number(stat.unique)||0),accuracy=Math.max(0,Math.min(100,Number(stat.accuracy)||0));
 const coverage=Math.min(100,done/TOTAL*100),mastery=Math.round(coverage*accuracy/100);
 const pct=$('.tp-stop-pct',stop),bar=$('.tp-mini i',stop),station=$('.tp-station',stop);
 if(pct)pct.textContent=`${mastery}%`;
 if(bar)bar.style.width=`${mastery}%`;
 if(stop.classList.contains('done')!==(mastery>=90))stop.classList.toggle('done',mastery>=90);
 if(station&&mastery>=90)station.textContent='✓';
 const extra=$('#assignmentHome .tp-seosul-mastery-explain');if(extra)extra.remove();
}
function schedule(){setTimeout(apply,0);setTimeout(apply,120)}
function boot(){schedule();window.addEventListener('testprep:student-state-refresh',schedule);window.addEventListener('popstate',schedule);document.addEventListener('click',e=>{if(e.target.closest('[data-lesson-plan],.tp-back'))setTimeout(schedule,40)},true)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
