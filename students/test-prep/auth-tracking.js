(function(){
  'use strict';
  // MVP TEST MODE: keep the page open to unsigned-in testers.
  // Authenticated students still attach to their plan and record progress.
  const OPEN_MVP_ACCESS=true;
  const apiPath=(action)=>`/.netlify/functions/test_prep_api?action=${encodeURIComponent(action)}`;
  const authPath=(action)=>`/.netlify/functions/supabase_auth?action=${encodeURIComponent(action)}&_=${Date.now()}`;
  const apiFetch=(url,opts={})=>{
    if(window.WillenaAPI&&typeof window.WillenaAPI.fetch==='function') return window.WillenaAPI.fetch(url,{credentials:'include',cache:'no-store',...opts});
    return fetch(url,{credentials:'include',cache:'no-store',...opts});
  };
  let state={user:null,plan:null,plans:[],session:null,sessionSection:null,blocked:false,openAccess:OPEN_MVP_ACCESS};

  async function whoami(){
    try{
      let r=await apiFetch(authPath('whoami'));
      if(r.ok) return r.json().catch(()=>null);
      const rr=await apiFetch(authPath('refresh'));
      const d=await rr.json().catch(()=>({}));
      if(rr.ok&&d?.success&&d?.access_token&&window.WillenaAPI?.setLocalTokens) window.WillenaAPI.setLocalTokens(d.access_token,'');
      r=await apiFetch(authPath('whoami'));
      if(r.ok) return r.json().catch(()=>null);
    }catch(_){ }
    return null;
  }
  function applyPlanUI(){
    if(!state.plan) return;
    const allowed=new Set((state.plan.practice_types||[]).map(x=>String(x).toLowerCase()));
    document.querySelectorAll('.tab[data-section]').forEach(btn=>{
      const ok=!allowed.size||allowed.has(String(btn.dataset.section).toLowerCase());
      btn.disabled=!ok;
      btn.style.opacity=ok?'':'0.38';
      btn.title=ok?'':'선생님이 지정하지 않은 연습입니다.';
    });
    const pill=document.querySelector('.pill');
    if(pill&&state.plan.book_label) pill.textContent=state.plan.book_label+(state.plan.units?.length?' · '+state.plan.units.join(', '):'');
  }
  const ready=(async()=>{
    const who=await whoami();
    if(!who?.success||!who?.user_id){
      // During MVP testing, unsigned-in users can use the app normally.
      return true;
    }
    try{
      const r=await apiFetch(apiPath('me'));
      const d=await r.json().catch(()=>({}));
      if(r.ok&&d.success){
        state.user=d.user||null;
        state.plans=d.plans||[];
        state.plan=state.plans[0]||null;
        if(state.plan){
          if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',applyPlanUI,{once:true}); else applyPlanUI();
        }
      }
    }catch(e){ console.warn('[test-prep] optional auth context unavailable',e); }
    return true;
  })();

  async function ensureSession(practiceType){
    await ready;
    // Public MVP testers are deliberately untracked. Tracking starts only when
    // there is a real authenticated student with an active exam-prep plan.
    if(!state.user||!state.plan) return null;
    const p=String(practiceType||'reading').toLowerCase();
    if(state.session&&state.sessionSection===p) return state.session;
    if(state.session&&state.sessionSection!==p) await completeSession(null,null,[]);
    const r=await apiFetch(apiPath('start_session'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan_id:state.plan.id,practice_type:p,unit_key:state.plan.units?.[0]||null})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.success){ console.warn('[test-prep] session start failed',d); return null; }
    state.session=d.session; state.sessionSection=p; return state.session;
  }
  async function recordAttempt(payload){
    try{
      const s=await ensureSession(payload?.practice_type);
      if(!s) return;
      const r=await apiFetch(apiPath('attempt'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        session_id:s.id,question_id:payload.question_id,selected_answer:payload.selected_answer,correct_answer:payload.correct_answer,is_correct:!!payload.is_correct,
        metadata:{source_question_number:payload.source_question_number,question_type:payload.question_type,source_label:payload.source_label}
      })});
      if(!r.ok) console.warn('[test-prep] attempt save failed',await r.text());
    }catch(e){console.warn('[test-prep] attempt save error',e)}
  }
  async function completeSession(correctCount,questionCount,wrongIds){
    const s=state.session; if(!s) return;
    state.session=null; state.sessionSection=null;
    try{
      const r=await apiFetch(apiPath('complete_session'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:s.id,correct_count:Number(correctCount)||0,question_count:Number(questionCount)||0,wrong_ids:Array.isArray(wrongIds)?wrongIds:[]})});
      if(!r.ok) console.warn('[test-prep] session completion failed',await r.text());
    }catch(e){console.warn('[test-prep] session completion error',e)}
  }
  window.WillenaTestPrepAuth={ready,state,recordAttempt,completeSession,ensureSession};
})();