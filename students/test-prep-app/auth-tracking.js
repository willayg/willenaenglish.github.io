(function(){
  'use strict';
  const EDGE='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-student';
  const API_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
  const LOGIN='/students/signin.html?next='+encodeURIComponent('/students/test-prep-app/');
  const authPath=(action)=>`/.netlify/functions/supabase_auth?action=${encodeURIComponent(action)}&_=${Date.now()}`;
  const routedFetch=(url,opts={})=>window.WillenaAPI?.fetch?window.WillenaAPI.fetch(url,{credentials:'include',cache:'no-store',...opts}):fetch(url,{credentials:'include',cache:'no-store',...opts});
  const localToken=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
  const state={user:null,plans:[],plan:null,lesson:null,session:null,sessionSection:null,blocked:true};

  function goLogin(){ location.replace(LOGIN); }

  async function refreshToken(){
    try{
      const r=await routedFetch(authPath('refresh'));
      const d=await r.json().catch(()=>({}));
      if(r.ok&&d?.success&&d.access_token){
        window.WillenaAPI?.setLocalTokens?.(d.access_token,d.refresh_token||'');
        return d.access_token;
      }
    }catch(_){ }
    return '';
  }

  async function ensureToken(forceRefresh=false){
    if(forceRefresh) return refreshToken();
    let token=localToken();
    if(token) return token;
    token=await refreshToken();
    return token;
  }

  async function edge(action,opts={}){
    const token=await ensureToken();
    if(!token) throw new Error('AUTH_REQUIRED');
    const headers={...(opts.headers||{}),Authorization:`Bearer ${token}`,apikey:API_KEY};
    const r=await fetch(`${EDGE}?action=${encodeURIComponent(action)}`,{...opts,headers,cache:'no-store',credentials:'omit'});
    const text=await r.text(); let d={};
    try{d=JSON.parse(text)}catch{throw new Error(`Invalid API response (${r.status})`)}
    if(r.status===401) throw new Error('AUTH_REQUIRED');
    if(!r.ok||d.success===false) throw new Error(d.error||`Request failed (${r.status})`);
    return d;
  }

  const ready=(async()=>{
    try{
      // A local access token by itself is not enough. Test Prep must be backed by
      // the current student browser session, otherwise stale tokens can open the app.
      const who=await routedFetch(authPath('whoami'));
      const wd=await who.json().catch(()=>({}));
      if(!who.ok||!wd?.success||!wd?.user_id){ goLogin(); return false; }

      // Re-sync the access token from the authenticated browser session before
      // asking the Test Prep student API who this user is.
      const sessionToken=await ensureToken(true);
      if(!sessionToken){ goLogin(); return false; }

      const d=await edge('me');
      if(!d?.user){ goLogin(); return false; }

      state.user=d.user;
      state.plans=Array.isArray(d.plans)?d.plans:[];
      state.blocked=false;
      return true;
    }catch(e){
      if(e?.message==='AUTH_REQUIRED'){ goLogin(); return false; }
      console.error('[test-prep-app] auth init failed',e);
      document.body.innerHTML='<div style="font-family:system-ui;padding:40px;text-align:center">시험 대비 정보를 불러오지 못했습니다.<br><small>'+String(e?.message||e)+'</small></div>';
      return false;
    }
  })();

  function setActivePlan(plan,lesson){
    if(state.session) completeSession(0,0,[]);
    state.plan=plan||null;
    state.lesson=lesson||null;
    state.session=null;
    state.sessionSection=null;
  }
  async function ensureSession(practiceType){
    await ready;
    if(!state.user||!state.plan) return null;
    const p=String(practiceType||'reading').toLowerCase();
    if(state.session&&state.sessionSection===p) return state.session;
    if(state.session&&state.sessionSection!==p) await completeSession(0,0,[]);
    const d=await edge('start_session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan_id:state.plan.id,practice_type:p,unit_key:state.lesson||null})});
    state.session=d.session||null; state.sessionSection=p; return state.session;
  }
  async function recordAttempt(payload){
    try{
      const s=await ensureSession(payload?.practice_type); if(!s) return;
      await edge('attempt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:s.id,question_id:payload.question_id,selected_answer:payload.selected_answer,correct_answer:payload.correct_answer,is_correct:!!payload.is_correct,metadata:{source_question_number:payload.source_question_number,question_type:payload.question_type,source_label:payload.source_label,lesson:state.lesson,plan_id:state.plan?.id}})});
    }catch(e){console.warn('[test-prep-app] attempt save failed',e)}
  }
  async function completeSession(correctCount,questionCount,wrongIds){
    const s=state.session; if(!s) return;
    state.session=null; state.sessionSection=null;
    try{await edge('complete_session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:s.id,correct_count:Number(correctCount)||0,question_count:Number(questionCount)||0,wrong_ids:Array.isArray(wrongIds)?wrongIds:[]})})}catch(e){console.warn('[test-prep-app] session completion failed',e)}
  }
  window.WillenaTestPrepAuth={ready,state,edge,setActivePlan,recordAttempt,completeSession,ensureSession};
})();
