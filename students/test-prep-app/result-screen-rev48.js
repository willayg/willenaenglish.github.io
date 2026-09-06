(function(){
'use strict';

const $=(s,r=document)=>r.querySelector(s);
const LABEL={vocab_test:'어휘 시험',communication:'Communication',grammar:'Grammar',sentences:'본문외우기',reading:'Reading',constructed_response:'서술형',seosul:'서술형'};
const OWNED=new Set(Object.keys(LABEL));
let active=false,current=null,originalComplete=null,saving=false,patched=false;

function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]))}
function selection(){return window.WillenaAssignedTestPrep?.selection||null}
function snapshotSelection(){const s=selection();if(!s?.plan||!s?.lesson)return null;return{plan:s.plan,lesson:s.lesson,section:String(s.section||'').toLowerCase(),unitId:s.unitId,bookId:s.bookId,reviewMode:!!s.reviewMode,reviewIds:Array.isArray(s.reviewIds)?[...s.reviewIds]:[]}}
function ownsSelection(s=snapshotSelection()){return!!s&&OWNED.has(String(s.section||'').toLowerCase())}
function review48Active(){return window.__WillenaReviewV48Active===true}

function installStyles(){
 if($('#tpResult48Styles'))return;const s=document.createElement('style');s.id='tpResult48Styles';s.textContent=`
 .app.tp-result48-active #assignmentHome,.app.tp-result48-active #assignedQuizPane{display:none!important}
 #tpResult48{display:none;width:min(760px,calc(100% - 24px));margin:24px auto 36px;font-family:Poppins,system-ui,sans-serif}
 .app.tp-result48-active #tpResult48{display:block!important}
 .tp48r-card{background:#fff;border:1px solid rgba(25,119,126,.16);border-radius:26px;padding:34px 28px 28px;box-shadow:0 18px 50px rgba(31,63,68,.10);text-align:center}
 .tp48r-kicker{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#19777e;margin-bottom:8px}.tp48r-score{font-size:58px;line-height:1;font-weight:800;color:#203039;margin:4px 0 12px}.tp48r-title{font-size:22px;line-height:1.35;font-weight:800;color:#203039;margin:0 0 8px}.tp48r-sub{font-size:14px;line-height:1.55;color:#607078;margin:0 auto 20px;max-width:520px}
 .tp48r-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:480px;margin:0 auto 22px}.tp48r-stat{background:#f6f9f9;border-radius:15px;padding:12px 8px}.tp48r-stat strong{display:block;font-size:19px;color:#203039}.tp48r-stat span{display:block;margin-top:2px;font-size:11px;font-weight:700;color:#7b8b90}.tp48r-status{min-height:20px;margin:2px 0 16px;font-size:12px;font-weight:700;color:#6f8085}.tp48r-status.ok{color:#19777e}.tp48r-status.bad{color:#a54646}.tp48r-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:10px}.tp48r-actions button{border:0;border-radius:14px;padding:13px 18px;font:800 13px/1 Poppins,system-ui,sans-serif;cursor:pointer}.tp48r-actions button:disabled{opacity:.42;cursor:default}.tp48r-primary{background:#19777e;color:#fff}.tp48r-secondary{background:#eaf2f2;color:#19777e}.tp48r-ghost{background:#f2f4f5;color:#56666b}
 @media(max-width:560px){.tp48r-card{padding:28px 18px 22px}.tp48r-score{font-size:48px}.tp48r-stats{gap:7px}.tp48r-actions{flex-direction:column}.tp48r-actions button{width:100%}}
 `;document.head.appendChild(s)
}
function ensureSurface(){installStyles();let el=$('#tpResult48');if(el)return el;const app=$('.app');if(!app)return null;el=document.createElement('section');el.id='tpResult48';el.setAttribute('aria-live','polite');app.appendChild(el);return el}
function setStatus(text,kind=''){const el=$('#tp48rStatus');if(!el)return;el.textContent=text||'';el.className='tp48r-status'+(kind?' '+kind:'')}
function setActionsEnabled(on){document.querySelectorAll('#tpResult48 [data-tp48r-action]').forEach(b=>b.disabled=!on)}
function hideResult(){active=false;saving=false;$('.app')?.classList.remove('tp-result48-active');const el=$('#tpResult48');if(el)el.innerHTML=''}
async function restart(){const sel=current?.selection;if(!sel?.plan?.id||!sel.lesson)return;hideResult();try{await window.WillenaAssignedTestPrep?.startSelection?.(sel.plan.id,sel.lesson,sel.section,{})}catch(e){console.error('[RESULT48] restart failed',e)}}
function openReview(){hideResult();if(window.WillenaReviewV48?.show)window.WillenaReviewV48.show();else window.WillenaTestPrepUX?.showWrongCenter?.()}
function leaveResult(){const sel=current?.selection;hideResult();const back=$('#assignedBackRow .back-assign');if(back){back.click();return}if(sel?.plan?.id&&sel.lesson&&window.WillenaTestPrepUX?.renderLesson){window.WillenaTestPrepUX.renderLesson(sel.plan.id,sel.lesson,sel.section);return}window.WillenaTestPrepUX?.renderHome?.()}
function renderResult(){
 const el=ensureSurface();if(!el||!current)return;const total=current.total,correct=current.correct,wrong=current.wrongIds.length,pct=total?Math.round(correct/total*100):0,skill=LABEL[current.selection?.section]||current.selection?.section||'',title=pct>=90?'정말 잘했어요!':pct>=70?'좋아요! 거의 다 왔어요.':'틀린 문제를 한 번 더 보면 좋아요.';
 const retry=wrong?'<button class="tp48r-primary" data-tp48r-action="retry" disabled>오답 복습하기</button>':'';
 el.innerHTML=`<div class="tp48r-card"><div class="tp48r-kicker">Session complete</div><div class="tp48r-score">${pct}%</div><h2 class="tp48r-title">${title}</h2><p class="tp48r-sub">${esc(current.selection?.lesson||'')} ${skill?`· ${esc(skill)}`:''}</p><div class="tp48r-stats"><div class="tp48r-stat"><strong>${correct}</strong><span>정답</span></div><div class="tp48r-stat"><strong>${Math.max(0,total-correct)}</strong><span>오답</span></div><div class="tp48r-stat"><strong>${total}</strong><span>문제</span></div></div><div class="tp48r-status" id="tp48rStatus">기록 저장 중...</div><div class="tp48r-actions">${retry}<button class="tp48r-secondary" data-tp48r-action="again" disabled>새 문제 세트</button><button class="tp48r-ghost" data-tp48r-action="lesson" disabled>Lesson으로 돌아가기</button><button class="tp48r-secondary" data-tp48r-retry-save hidden>저장 다시 시도</button></div></div>`;
 el.querySelector('[data-tp48r-action="retry"]')?.addEventListener('click',openReview);el.querySelector('[data-tp48r-action="again"]')?.addEventListener('click',restart);el.querySelector('[data-tp48r-action="lesson"]')?.addEventListener('click',leaveResult);el.querySelector('[data-tp48r-retry-save]')?.addEventListener('click',retrySave)
}
function showResult(correctCount,questionCount,wrongIds,snap=snapshotSelection()){const total=Math.max(0,Number(questionCount)||0),correct=Math.max(0,Number(correctCount)||0);if(!total||!ownsSelection(snap)||review48Active())return false;current={correct:Math.min(correct,total),total,wrongIds:Array.isArray(wrongIds)?wrongIds.map(String):[],selection:snap,args:[correctCount,questionCount,Array.isArray(wrongIds)?[...wrongIds]:[]]};active=true;saving=true;ensureSurface();$('.app')?.classList.add('tp-result48-active');renderResult();return true}
function finishSave(result){if(!active)return;saving=false;const retry=$('#tpResult48 [data-tp48r-retry-save]');if(result){setStatus('기록 저장 완료','ok');setActionsEnabled(true);if(retry)retry.hidden=true}else{setStatus('기록 저장에 실패했습니다. 다시 시도해 주세요.','bad');setActionsEnabled(false);if(retry)retry.hidden=false}}
function settleSave(p){Promise.resolve(p).then(finishSave).catch(e=>{console.error('[RESULT48] session save failed',e);finishSave(null)})}
function retrySave(){if(!current||!originalComplete||saving)return;const b=$('#tpResult48 [data-tp48r-retry-save]');if(b)b.hidden=true;saving=true;setStatus('기록 다시 저장 중...');let p;try{p=originalComplete(...current.args)}catch(e){finishSave(null);return}settleSave(p)}
function patchAuth(){
 if(patched)return true;const auth=window.WillenaTestPrepAuth;if(!auth?.completeSession)return false;originalComplete=auth.completeSession.bind(auth);
 auth.completeSession=function(correctCount,questionCount,wrongIds){const snap=snapshotSelection(),hadSession=!!auth.state?.session,shouldShow=!review48Active()&&hadSession&&(Number(questionCount)||0)>0&&ownsSelection(snap);if(shouldShow)showResult(correctCount,questionCount,wrongIds,snap);let p;try{p=originalComplete(correctCount,questionCount,wrongIds)}catch(e){if(shouldShow)finishSave(null);throw e}if(shouldShow)settleSave(p);return p};
 auth.__result48Owner=true;patched=true;return true
}
function boot(){ensureSurface();if(!patchAuth()){let n=0;const t=setInterval(()=>{if(patchAuth()||++n>200)clearInterval(t)},25)}window.addEventListener('popstate',()=>{if(active)hideResult()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
console.log('[RESULT48] normal-study result owner active; all wrong-answer review routes to standalone REV48');
})();
