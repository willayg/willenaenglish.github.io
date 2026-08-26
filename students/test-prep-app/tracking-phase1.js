(function(){
  'use strict';

  let questionShownAt=performance.now();
  let currentQuestion=null;
  let patchedCheck=false;
  let patchedRecord=false;
  let customAttemptCount=0;

  function resetQuestionTimer(){ questionShownAt=performance.now(); }
  function hashUuid(input){
    const s=String(input||'');let a=2166136261,b=0x9e3779b9,c=0x85ebca6b,d=0xc2b2ae35;
    for(let i=0;i<s.length;i++){const x=s.charCodeAt(i);a=Math.imul(a^x,16777619);b=Math.imul(b+x,2246822519);c=Math.imul(c^x,3266489917);d=Math.imul(d+x,668265263)}
    const h=[a,b,c,d].map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');
    return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
  }
  function fmtMinutes(ms){const m=Math.round((Number(ms)||0)/60000);return m<1?'<1분':`${m}분`;}
  function labelPractice(k){return ({vocabulary:'Vocabulary',sentences:'Sentences',communication:'Communication',grammar:'Grammar',reading:'Reading'})[k]||k;}

  function patchRecordAttempt(){
    const auth=window.WillenaTestPrepAuth;
    if(!auth||patchedRecord||typeof auth.recordAttempt!=='function') return false;
    const original=auth.recordAttempt.bind(auth);
    auth.recordAttempt=function(payload){
      const q=currentQuestion;
      const elapsed=Math.max(0,Math.round(performance.now()-questionShownAt));
      const enriched={...(payload||{}),targets:Array.isArray(payload?.targets)?payload.targets:(Array.isArray(q?.targets)?q.targets:[]),question_type:payload?.question_type||q?.question_type||null,response_time_ms:payload?.response_time_ms||elapsed};
      const p=original(enriched);Promise.resolve(p).then(()=>scheduleRefresh()).catch(()=>{});return p;
    };
    patchedRecord=true;return true;
  }
  function patchCheck(){
    if(patchedCheck||typeof window.check!=='function') return false;
    const original=window.check;window.check=function(q){currentQuestion=q||currentQuestion;return original.apply(this,arguments)};patchedCheck=true;return true;
  }
  function watchQuestionCard(){
    const card=document.getElementById('card');if(!card)return;const observer=new MutationObserver(()=>{if(card.querySelector('.prompt')&&card.querySelector('.qnum'))resetQuestionTimer()});observer.observe(card,{childList:true,subtree:true});
  }

  async function persistCustom(type,detail){
    const auth=window.WillenaTestPrepAuth,sel=window.WillenaAssignedTestPrep?.selection;if(!auth||!sel?.plan)return;
    if(String(auth.state?.plan?.id||'')!==String(sel.plan.id)||String(auth.state?.lesson||'')!==String(sel.lesson)) auth.setActivePlan(sel.plan,sel.lesson);
    const questionId=type==='vocabulary'?detail.lexical_entry_id:hashUuid(`${sel.plan.id}|${sel.lesson}|${detail.passage_id||''}|${detail.sentence||''}`);
    await auth.recordAttempt({practice_type:type,question_id:questionId,selected_answer:type==='vocabulary'?(detail.input||detail.selected_answer||null):(detail.built_sentence||null),correct_answer:type==='vocabulary'?detail.canonical_text:detail.sentence,is_correct:!!detail.is_correct,question_type:type==='vocabulary'?`vocab_${detail.mode||'practice'}`:'sentence_unscramble',response_time_ms:Number(detail.response_time_ms)||null,targets:type==='vocabulary'?['vocabulary']:['reading_text','sentence_order'],metadata:{lesson:sel.lesson,book_label:sel.plan.book_label,lexical_entry_id:detail.lexical_entry_id||null,passage_id:detail.passage_id||null,passage_title:detail.passage_title||null,mode:detail.mode||null}});
    customAttemptCount++;if(customAttemptCount%2===0)scheduleRefresh();
  }

  let refreshTimer=null;
  function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(refreshStats,650);}
  async function refreshStats(){
    const auth=window.WillenaTestPrepAuth;if(!auth)return;try{await auth.ready;const d=await auth.edge('me');if(d?.plans){auth.state.plans=d.plans;renderStats(d.plans)}}catch(e){console.warn('[test-prep] stats refresh failed',e)}
  }
  function renderStats(plans){
    const home=document.getElementById('assignmentHome');if(!home||home.style.display==='none')return;
    if(!document.getElementById('tpTrackingStyle')){const st=document.createElement('style');st.id='tpTrackingStyle';st.textContent=`.tp-track{margin:12px 0 16px;padding:15px;border:1px solid #dce9eb;border-radius:17px;background:linear-gradient(135deg,#f8fcfc,#fff);}.tp-track-top{display:flex;justify-content:space-between;align-items:center;gap:10px}.tp-track-title{font-size:13px;font-weight:800;color:#315960}.tp-rec{font-size:12px;font-weight:800;color:#19777e}.tp-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:11px}.tp-metric{background:#fff;border:1px solid #e5edef;border-radius:12px;padding:9px;text-align:center}.tp-metric b{display:block;font-size:16px;color:#24343c}.tp-metric span{font-size:10px;color:#7a878e;font-weight:700}.tp-practice{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.tp-chip{font-size:10px;font-weight:750;padding:6px 8px;border-radius:999px;background:#edf8f9;color:#386269}.tp-warn{color:#cf477b!important}@media(max-width:540px){.tp-metrics{grid-template-columns:repeat(2,1fr)}}`;document.head.appendChild(st)}
    const cards=[...home.querySelectorAll('.exam-card')];cards.forEach((card,i)=>{const plan=plans[i];if(!plan)return;card.querySelector('.tp-track')?.remove();const s=plan.summary||plan.stats||{};const rec=s.recommendation||{};const box=document.createElement('div');box.className='tp-track';const chips=Object.entries(s.by_practice||{}).map(([k,v])=>`<span class="tp-chip">${labelPractice(k)} ${(v&&v.accuracy!=null)?v.accuracy+'%':'-'}</span>`).join('');box.innerHTML=`<div class="tp-track-top"><div class="tp-track-title">내 시험 대비 현황</div><div class="tp-rec ${s.unresolved_wrong?'tp-warn':''}">${rec.title||'시험 대비 시작하기'}</div></div><div class="tp-metrics"><div class="tp-metric"><b>${s.accuracy==null?'-':s.accuracy+'%'}</b><span>전체 정답률</span></div><div class="tp-metric"><b>${s.first_attempt_accuracy==null?'-':s.first_attempt_accuracy+'%'}</b><span>첫 시도</span></div><div class="tp-metric"><b class="${s.unresolved_wrong?'tp-warn':''}">${s.unresolved_wrong||0}</b><span>미해결 오답</span></div><div class="tp-metric"><b>${fmtMinutes(s.active_time_ms)}</b><span>학습 시간</span></div></div>${chips?`<div class="tp-practice">${chips}</div>`:''}<div style="margin-top:9px;font-size:11px;color:#73828a;font-weight:650">${rec.detail||''}</div>`;const book=card.querySelector('.book-name');if(book)book.after(box);else card.prepend(box)});
  }
  function observeHome(){const home=document.getElementById('assignmentHome');if(!home)return;const o=new MutationObserver(()=>renderStats(window.WillenaTestPrepAuth?.state?.plans||[]));o.observe(home,{childList:true,subtree:true});renderStats(window.WillenaTestPrepAuth?.state?.plans||[])}

  function bootstrap(){
    patchRecordAttempt();patchCheck();watchQuestionCard();observeHome();
    window.addEventListener('testprep:vocab-attempt',e=>persistCustom('vocabulary',e.detail||{}).catch(err=>console.warn('[test-prep] vocab tracking failed',err)));
    window.addEventListener('testprep:sentence-attempt',e=>persistCustom('sentences',e.detail||{}).catch(err=>console.warn('[test-prep] sentence tracking failed',err)));
    let tries=0;const timer=setInterval(()=>{patchRecordAttempt();patchCheck();if((patchedRecord&&patchedCheck)||++tries>80)clearInterval(timer)},50);
    setTimeout(refreshStats,900);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap,{once:true});else bootstrap();
})();
