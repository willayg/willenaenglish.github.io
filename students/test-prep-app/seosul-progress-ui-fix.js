(function(){
'use strict';
const TOTAL=25;
const TRACKING='https://fiieuiktlsivwfgyivai.supabase.co';
const API_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const $=(s,r=document)=>r.querySelector(s);
function currentLesson(){return ($('#assignmentHome .tp-lesson-head h1')?.textContent||'').trim()}
function findPlan(lesson){const plans=window.WillenaTestPrepAuth?.state?.plans||[];return plans.find(p=>(p.group?.scope?.lessons||[]).some(x=>String(x.lesson)===String(lesson)))||plans.find(p=>(p.units||[]).map(String).includes(String(lesson)))||null}
function statFor(plan,lesson){return plan?.summary?.by_lesson_practice?.[`${lesson}||constructed_response`]||null}
function token(){return window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||''}
function isAuthoredId(id){return !!id&&!String(id).startsWith('seosul:')}
async function authoredState(plan,lesson){
 const t=token();if(!t||!plan?.id||!lesson)return null;
 const qs=new URLSearchParams({select:'question_id,unresolved',plan_id:`eq.${plan.id}`,unit_key:`eq.${lesson}`,practice_type:'eq.constructed_response'});
 try{
  const r=await fetch(`${TRACKING}/rest/v1/test_prep_question_state?${qs}`,{headers:{apikey:API_KEY,Authorization:`Bearer ${t}`},cache:'no-store'});
  if(!r.ok)return null;
  const rows=(await r.json()).filter(x=>isAuthoredId(x.question_id));
  const unique=new Set(rows.map(x=>String(x.question_id))).size;
  const unresolved=new Set(rows.filter(x=>x.unresolved===true).map(x=>String(x.question_id))).size;
  return{unique,unresolved};
 }catch(_){return null}
}
function addStyles(){
 if($('#seosulProgressClarityStyles'))return;
 const s=document.createElement('style');s.id='seosulProgressClarityStyles';s.textContent=`
 .tp-stop[data-skill="constructed_response"] .seosul-progress-detail{display:block;margin-top:4px;font-size:12px;line-height:1.45;color:#718087;font-weight:650}
 .tp-stop[data-skill="constructed_response"] .seosul-progress-detail strong{color:#d9517d;font-weight:800}
 .tp-seosul-mastery-explain{margin-top:16px;padding:14px 16px;border-radius:14px;background:#f2fbfb;border:1px solid #d5eeee;color:#566a70;font-size:13px;line-height:1.65}
 .tp-seosul-mastery-explain b{display:block;color:#167d84;font-size:14px;margin-bottom:3px}
 `;document.head.appendChild(s)
}
function ensureExplanation(){
 const subway=$('#assignmentHome .tp-subway');if(!subway||$('#assignmentHome .tp-seosul-mastery-explain'))return;
 const box=document.createElement('div');box.className='tp-seosul-mastery-explain';
 box.innerHTML='<b>숙련도는 무엇인가요?</b><span>전체 시험 범위를 얼마나 풀어 봤는지와 얼마나 안정적으로 맞히는지를 함께 보여 줘요. <strong>한 번 틀린 문제는 다시 맞혀서 복습 기준을 통과해야 완전히 익힌 것으로 인정돼요.</strong></span>';
 subway.insertAdjacentElement('afterend',box);
}
async function apply(){
 addStyles();
 const stop=$('#assignmentHome .tp-stop[data-skill="constructed_response"]');
 if(!stop)return;
 const lesson=currentLesson();if(!lesson)return;
 const plan=findPlan(lesson),stat=statFor(plan,lesson);if(!stat)return;
 const rawDone=Math.max(0,Number(stat.unique)||0),accuracy=Math.max(0,Math.min(100,Number(stat.accuracy)||0));
 const fallbackCoverage=Math.min(100,rawDone/TOTAL*100),mastery=Math.round(fallbackCoverage*accuracy/100);
 const pct=$('.tp-stop-pct',stop),bar=$('.tp-mini i',stop),station=$('.tp-station',stop);
 if(pct)pct.innerHTML=`${mastery}%<small class="seosul-progress-detail">숙련도</small>`;
 if(bar)bar.style.width=`${mastery}%`;
 if(stop.classList.contains('done')!==(mastery>=90))stop.classList.toggle('done',mastery>=90);
 if(station&&mastery>=90)station.textContent='✓';
 ensureExplanation();
 const state=await authoredState(plan,lesson);
 if(!state||!document.contains(stop))return;
 const experienced=Math.min(TOTAL,state.unique);
 const experienceText=experienced>=TOTAL?`${TOTAL}문제 모두 경험`:`${experienced}/${TOTAL}문제 경험`;
 const wrongText=state.unresolved>0?`현재 오답 <strong>${state.unresolved}개</strong> 남음`:'현재 오답 없음 ✓';
 if(pct)pct.innerHTML=`${mastery}%<small class="seosul-progress-detail">${wrongText}<br>${experienceText}</small>`;
}
function schedule(){setTimeout(apply,0);setTimeout(apply,150)}
function boot(){schedule();window.addEventListener('testprep:student-state-refresh',schedule);window.addEventListener('popstate',schedule);document.addEventListener('click',e=>{if(e.target.closest('[data-lesson-plan],.tp-back'))setTimeout(schedule,50)},true)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
