(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let enginePatched=false,uxPatched=false,lastPlanId='',lastLesson='';

function normalizeLegacyScopes(){
 for(const plan of window.WillenaTestPrepAuth?.state?.plans||[]){
  const scope=plan?.group?.scope;
  if(!scope||scope.scope_controls_v2===true)continue;
  for(const row of scope.lessons||[]){
   if(!Array.isArray(row.sections))row.sections=[];
   if(!row.sections.map(x=>String(x).toLowerCase()).includes('vocabulary'))row.sections.push('vocabulary');
  }
 }
}
function lessonScope(plan,lesson){const rows=plan?.group?.scope?.lessons||[];return rows.find(x=>String(x.lesson)===String(lesson))||null}
function currentPlan(planId){return window.WillenaTestPrepAuth?.state?.plans?.find(p=>String(p.id)===String(planId))||null}
function strictScope(plan){return plan?.group?.scope?.scope_controls_v2===true}

function patchEngine(){
 if(enginePatched)return true;
 const api=window.WillenaTestPrepQuestionEngine;
 if(!api?.loadSection||!window.WillenaSeosulEngine)return false;
 const original=api.loadSection.bind(api);
 api.loadSection=async function(name){
  const k=String(name||'').toLowerCase();
  if(k==='constructed_response'||k==='seosul'){
   const sel=window.WillenaAssignedTestPrep?.selection;
   return window.WillenaSeosulEngine.start({unitId:sel?.unitId,lesson:sel?.lesson,plan:sel?.plan});
  }
  return original(name);
 };
 enginePatched=true;
 return true;
}

function stationHtml(stat={}){
 const done=Math.max(0,Number(stat.unique)||0),acc=Math.max(0,Math.min(100,Number(stat.accuracy)||0));
 return `<div class="tp-stop" data-skill="constructed_response"><div class="tp-station">7</div><div class="tp-stop-copy"><b>서술형</b><small>영작 · 배열 · 대화 · 본문 해석</small><div class="tp-mini"><i style="width:${acc}%"></i></div></div><div class="tp-stop-pct">${done?Math.round(acc)+'%':'0%'}<small>${done?done+'문제':''}</small></div></div>`;
}
function removeStation(subway,skill){$(`.tp-stop[data-skill="${skill}"]`,subway)?.remove()}
function renumber(subway){
 $$('.tp-stop',subway).forEach((el,i)=>{const n=$('.tp-station',el);if(n&&!el.classList.contains('done'))n.textContent=String(i+1)});
}
function applyLessonScope(planId,lesson){
 normalizeLegacyScopes();
 const plan=currentPlan(planId);if(!plan)return;
 const subway=$('#assignmentHome .tp-subway');if(!subway)return;
 const row=lessonScope(plan,lesson);if(!row)return;
 const sections=new Set((row.sections||[]).map(x=>String(x).toLowerCase()));
 const strict=strictScope(plan);
 if(!strict)return;

 // Vocabulary is one teacher-facing switch. It controls both vocab learning and vocab test.
 if(!sections.has('vocabulary')){
  removeStation(subway,'vocabulary');
  removeStation(subway,'vocab_test');
 }

 // 본문외우기 is deliberately independent of exam-question scope and remains available.
 for(const skill of ['communication','grammar','reading']){
  if(!sections.has(skill))removeStation(subway,skill);
 }

 const wantSeosul=sections.has('constructed_response');
 let seosul=$('.tp-stop[data-skill="constructed_response"]',subway);
 if(wantSeosul&&!seosul){
  const stat=plan.summary?.by_lesson_practice?.[`${lesson}||constructed_response`]||{};
  subway.insertAdjacentHTML('beforeend',stationHtml(stat));
  seosul=$('.tp-stop[data-skill="constructed_response"]',subway);
  seosul?.addEventListener('click',()=>window.WillenaTestPrepUX?.launchSkill?.(plan.id,lesson,'constructed_response'));
 }else if(!wantSeosul&&seosul){
  seosul.remove();
 }
 renumber(subway);
}
function inferCurrentLesson(){
 const hs=history.state||{};
 if(hs.tp==='lesson'&&hs.planId&&hs.lesson)return{planId:String(hs.planId),lesson:String(hs.lesson)};
 const h=$('#assignmentHome .tp-lesson-head h1')?.textContent?.trim();
 if(!h)return null;
 const plan=(window.WillenaTestPrepAuth?.state?.plans||[]).find(p=>(p.group?.scope?.lessons||[]).some(x=>String(x.lesson)===h));
 return plan?{planId:String(plan.id),lesson:h}:null;
}
function applyCurrent(){const cur=inferCurrentLesson();if(!cur)return;lastPlanId=cur.planId;lastLesson=cur.lesson;applyLessonScope(cur.planId,cur.lesson)}

function patchUX(){
 if(uxPatched)return true;
 const ux=window.WillenaTestPrepUX;
 if(!ux?.renderLesson)return false;
 const original=ux.renderLesson.bind(ux);
 ux.renderLesson=function(planId,lesson,focusSkill){
  normalizeLegacyScopes();
  const r=original(planId,lesson,focusSkill);
  lastPlanId=String(planId);lastLesson=String(lesson);
  queueMicrotask(()=>applyLessonScope(planId,lesson));
  setTimeout(()=>applyLessonScope(planId,lesson),30);
  return r;
 };
 uxPatched=true;
 return true;
}
function polishContext(){const c=$('#assignedBackRow .quiz-context');if(c&&/constructed_response/i.test(c.textContent))c.textContent=c.textContent.replace(/constructed_response/ig,'서술형')}
function boot(){
 normalizeLegacyScopes();
 window.addEventListener('testprep:student-state-refresh',()=>{normalizeLegacyScopes();setTimeout(applyCurrent,0)});
 const mo=new MutationObserver(()=>{polishContext();if($('#assignmentHome .tp-subway'))queueMicrotask(applyCurrent)});
 mo.observe(document.body,{childList:true,subtree:true,characterData:true});
 let n=0;const t=setInterval(()=>{normalizeLegacyScopes();patchEngine();patchUX();if(lastPlanId&&lastLesson)applyLessonScope(lastPlanId,lastLesson);if(enginePatched&&uxPatched&&++n>20)clearInterval(t);else if(++n>180)clearInterval(t)},50);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();