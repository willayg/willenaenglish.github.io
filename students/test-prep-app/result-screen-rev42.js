(function(){
'use strict';

const $=(s,r=document)=>r.querySelector(s);
const isStaging=/^staging\./i.test(location.hostname)||['localhost','127.0.0.1'].includes(location.hostname)||new URLSearchParams(location.search).has('rev42test');
let active=false,current=null,originalComplete=null,saving=false,patched=false;

function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function delay(ms){return new Promise(r=>setTimeout(r,ms))}
function snapshotSelection(){
 const s=window.WillenaAssignedTestPrep?.selection;
 if(!s?.plan||!s?.lesson)return null;
 return {plan:s.plan,lesson:s.lesson,section:s.section,unitId:s.unitId,bookId:s.bookId,reviewMode:!!s.reviewMode,reviewIds:Array.isArray(s.reviewIds)?[...s.reviewIds]:[]};
}
function installStyles(){
 if($('#tpRev42Styles'))return;
 const s=document.createElement('style');
 s.id='tpRev42Styles';
 s.textContent=`
 .app.tp-rev42-result-active #assignmentHome,
 .app.tp-rev42-result-active #assignedQuizPane{display:none!important}
 #tpRev42Result{display:none;width:min(760px,calc(100% - 24px));margin:24px auto 36px;font-family:Poppins,system-ui,sans-serif}
 .app.tp-rev42-result-active #tpRev42Result{display:block!important}
 .tp42-card{background:#fff;border:1px solid rgba(25,119,126,.16);border-radius:26px;padding:34px 28px 28px;box-shadow:0 18px 50px rgba(31,63,68,.10);text-align:center}
 .tp42-kicker{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#19777e;margin-bottom:8px}
 .tp42-score{font-size:58px;line-height:1;font-weight:800;color:#203039;margin:4px 0 12px}
 .tp42-title{font-size:22px;line-height:1.35;font-weight:800;color:#203039;margin:0 0 8px}
 .tp42-sub{font-size:14px;line-height:1.55;color:#607078;margin:0 auto 20px;max-width:520px}
 .tp42-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:480px;margin:0 auto 22px}
 .tp42-stat{background:#f6f9f9;border-radius:15px;padding:12px 8px}
 .tp42-stat strong{display:block;font-size:19px;color:#203039}.tp42-stat span{display:block;margin-top:2px;font-size:11px;font-weight:700;color:#7b8b90}
 .tp42-status{min-height:20px;margin:2px 0 16px;font-size:12px;font-weight:700;color:#6f8085}
 .tp42-status.ok{color:#19777e}.tp42-status.bad{color:#a54646}
 .tp42-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:10px}
 .tp42-actions button{border:0;border-radius:14px;padding:13px 18px;font:800 13px/1 Poppins,system-ui,sans-serif;cursor:pointer}
 .tp42-actions button:disabled{opacity:.42;cursor:default}
 .tp42-primary{background:#19777e;color:#fff}.tp42-secondary{background:#eaf2f2;color:#19777e}.tp42-ghost{background:#f2f4f5;color:#56666b}
 #tpRev42AutoFinish{position:fixed;right:10px;bottom:42px;z-index:2147483647;border:0;border-radius:999px;padding:7px 11px;background:#8c3f8f;color:#fff;font:800 10px/1 Poppins,system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.18);cursor:pointer}
 #tpRev42AutoFinish:disabled{opacity:.55;cursor:default}
 @media(max-width:560px){.tp42-card{padding:28px 18px 22px}.tp42-score{font-size:48px}.tp42-stats{gap:7px}.tp42-actions{flex-direction:column}.tp42-actions button{width:100%}}
 `;
 document.head.appendChild(s);
}
function ensureSurface(){
 installStyles();
 let el=$('#tpRev42Result');
 if(el)return el;
 const app=$('.app');if(!app)return null;
 el=document.createElement('section');el.id='tpRev42Result';el.setAttribute('aria-live','polite');app.appendChild(el);return el;
}
function setStatus(text,kind=''){
 const el=$('#tp42Status');if(!el)return;el.textContent=text||'';el.className='tp42-status'+(kind?' '+kind:'');
}
function setActionsEnabled(on){document.querySelectorAll('#tpRev42Result [data-tp42-action]').forEach(b=>b.disabled=!on)}
function hideResult(){
 active=false;saving=false;
 $('.app')?.classList.remove('tp-rev42-result-active');
 const el=$('#tpRev42Result');if(el)el.innerHTML='';
}
async function restart(opts={}){
 const c=current,sel=c?.selection;if(!sel?.plan?.id||!sel.lesson)return;
 hideResult();
 try{await window.WillenaAssignedTestPrep?.startSelection?.(sel.plan.id,sel.lesson,sel.section,opts)}catch(e){console.error('[REV42] restart failed',e)}
}
function leaveResult(){
 const sel=current?.selection;
 hideResult();
 const back=$('#assignedBackRow .back-assign');
 if(back){back.click();return}
 if(sel?.plan?.id&&sel.lesson&&window.WillenaTestPrepUX?.renderLesson){window.WillenaTestPrepUX.renderLesson(sel.plan.id,sel.lesson,sel.section);return}
 window.WillenaTestPrepUX?.renderHome?.();
}
function renderResult(){
 const el=ensureSurface();if(!el||!current)return;
 const total=current.total,correct=current.correct,wrong=current.wrongIds.length,pct=total?Math.round(correct/total*100):0;
 const title=pct>=90?'정말 잘했어요!':pct>=70?'좋아요! 거의 다 왔어요.':'틀린 문제를 한 번 더 보면 좋아요.';
 el.innerHTML=`<div class="tp42-card">
   <div class="tp42-kicker">Session complete</div>
   <div class="tp42-score">${pct}%</div>
   <h2 class="tp42-title">${title}</h2>
   <p class="tp42-sub">${esc(current.selection?.lesson||'')} ${current.selection?.section?`· ${esc(String(current.selection.section))}`:''}</p>
   <div class="tp42-stats">
    <div class="tp42-stat"><strong>${correct}</strong><span>정답</span></div>
    <div class="tp42-stat"><strong>${Math.max(0,total-correct)}</strong><span>오답</span></div>
    <div class="tp42-stat"><strong>${total}</strong><span>문제</span></div>
   </div>
   <div class="tp42-status" id="tp42Status">기록 저장 중...</div>
   <div class="tp42-actions">
    ${wrong?'<button class="tp42-primary" data-tp42-action="retry" disabled>오답 다시 풀기</button>':''}
    <button class="tp42-secondary" data-tp42-action="again" disabled>새 문제 세트</button>
    <button class="tp42-ghost" data-tp42-action="lesson" disabled>Lesson으로 돌아가기</button>
    <button class="tp42-secondary" data-tp42-retry-save hidden>저장 다시 시도</button>
   </div>
  </div>`;
 el.querySelector('[data-tp42-action="retry"]')?.addEventListener('click',()=>restart({reviewMode:true,reviewIds:[...current.wrongIds]}));
 el.querySelector('[data-tp42-action="again"]')?.addEventListener('click',()=>restart({}));
 el.querySelector('[data-tp42-action="lesson"]')?.addEventListener('click',leaveResult);
 el.querySelector('[data-tp42-retry-save]')?.addEventListener('click',retrySave);
}
function showResult(correctCount,questionCount,wrongIds){
 const total=Math.max(0,Number(questionCount)||0),correct=Math.max(0,Number(correctCount)||0);
 if(!total)return;
 current={correct:Math.min(correct,total),total,wrongIds:Array.isArray(wrongIds)?wrongIds.map(String):[],selection:snapshotSelection(),args:[correctCount,questionCount,Array.isArray(wrongIds)?[...wrongIds]:[]]};
 active=true;saving=true;
 ensureSurface();
 $('.app')?.classList.add('tp-rev42-result-active');
 renderResult();
}
function finishSave(result){
 if(!active)return;
 saving=false;
 const retry=$('#tpRev42Result [data-tp42-retry-save]');
 if(result){setStatus('기록 저장 완료','ok');setActionsEnabled(true);if(retry)retry.hidden=true}
 else{setStatus('기록 저장에 실패했습니다. 다시 시도해 주세요.','bad');setActionsEnabled(false);if(retry)retry.hidden=false}
}
function settleSave(p){Promise.resolve(p).then(finishSave).catch(e=>{console.error('[REV42] session save failed',e);finishSave(null)})}
function retrySave(){
 if(!current||!originalComplete||saving)return;
 const b=$('#tpRev42Result [data-tp42-retry-save]');if(b)b.hidden=true;
 saving=true;setStatus('기록 다시 저장 중...');
 let p;try{p=originalComplete(...current.args)}catch(e){finishSave(null);return}
 settleSave(p);
}
function patchAuth(){
 if(patched)return true;
 const auth=window.WillenaTestPrepAuth;if(!auth?.completeSession)return false;
 if(auth.__rev42ResultOwner){patched=true;return true}
 originalComplete=auth.completeSession.bind(auth);
 auth.completeSession=function(correctCount,questionCount,wrongIds){
  const hadSession=!!auth.state?.session,shouldShow=hadSession&&(Number(questionCount)||0)>0;
  if(shouldShow)showResult(correctCount,questionCount,wrongIds);
  let p;try{p=originalComplete(correctCount,questionCount,wrongIds)}catch(e){if(shouldShow)finishSave(null);throw e}
  if(shouldShow)settleSave(p);
  return p;
 };
 auth.__rev42ResultOwner=true;patched=true;
 return true;
}
async function autoFinish(){
 const button=$('#tpRev42AutoFinish');if(!button)return;
 if(active)return;
 const regular=window.WillenaTestPrepQuestionEngine;
 if(!regular?.currentQuestion){alert('먼저 Grammar, Reading 또는 Communication 활동을 시작하세요.');return}
 button.disabled=true;const old=button.textContent;button.textContent='AUTO...';
 try{
  for(let i=0;i<80&&!active;i++){
   const c=$('#card');if(!c)break;
   if(c.querySelector('.result,.tp-review-result')){await delay(100);continue}
   const choice=c.querySelector('.choice');const check=c.querySelector('#check');
   if(choice&&check){
    if(!c.querySelector('.choice.selected'))choice.click();
    await delay(25);
    const first=c.querySelector('#check');if(first&&!first.disabled)first.click();
    await delay(75);
    const next=c.querySelector('#check');if(next&&!next.disabled)next.click();
    await delay(90);continue;
   }
   const skip=c.querySelector('#tpSkipQuestion');if(skip){skip.click();await delay(120);continue}
   await delay(100);
  }
  if(!active)alert('AUTO FINISH는 현재 일반 객관식 활동에서만 사용할 수 있습니다.');
 }finally{button.disabled=false;button.textContent=old}
}
function installAutoFinish(){
 if(!isStaging||$('#tpRev42AutoFinish'))return;
 const b=document.createElement('button');b.id='tpRev42AutoFinish';b.type='button';b.textContent='REV42 · AUTO FINISH';b.addEventListener('click',autoFinish);document.body.appendChild(b);
}
function boot(){
 ensureSurface();installAutoFinish();
 if(!patchAuth()){let n=0;const t=setInterval(()=>{if(patchAuth()||++n>200)clearInterval(t)},25)}
 window.addEventListener('popstate',()=>{if(active)hideResult()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();