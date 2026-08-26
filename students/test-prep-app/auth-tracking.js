(function(){
  'use strict';
  const EDGE='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-student';
  const API_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
  const LOGIN='/students/signin.html?next='+encodeURIComponent('/students/test-prep-app/');
  const authPath=(action)=>`/.netlify/functions/supabase_auth?action=${encodeURIComponent(action)}&_=${Date.now()}`;
  const routedFetch=(url,opts={})=>window.WillenaAPI?.fetch?window.WillenaAPI.fetch(url,{credentials:'include',cache:'no-store',...opts}):fetch(url,{credentials:'include',cache:'no-store',...opts});
  const localToken=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
  const state={user:null,plans:[],plan:null,lesson:null,session:null,sessionSection:null,blocked:true};

  let activityStartedAt=0;
  let activeAccumulatedMs=0;
  let activeTickAt=0;

  function emitTracking(type,data){
    try{window.dispatchEvent(new CustomEvent('testprep:tracking',{detail:{type,at:new Date().toISOString(),...(data||{})}}))}catch(_){}
  }
  function isActive(){return !document.hidden&&document.hasFocus()}
  function flushActiveTime(){
    const now=performance.now();
    if(activeTickAt) activeAccumulatedMs+=Math.max(0,now-activeTickAt);
    activeTickAt=isActive()&&activityStartedAt?now:0;
  }
  function beginStudyActivity(){
    activityStartedAt=Date.now();
    activeAccumulatedMs=0;
    activeTickAt=isActive()?performance.now():0;
  }
  function getActiveTimeMs(){flushActiveTime();return Math.max(0,Math.round(activeAccumulatedMs))}
  function resetStudyActivity(){activityStartedAt=0;activeAccumulatedMs=0;activeTickAt=0}
  document.addEventListener('visibilitychange',flushActiveTime);
  window.addEventListener('focus',flushActiveTime);
  window.addEventListener('blur',flushActiveTime);

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
      const who=await routedFetch(authPath('whoami'));
      const wd=await who.json().catch(()=>({}));
      if(!who.ok||!wd?.success||!wd?.user_id){ goLogin(); return false; }
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
    resetStudyActivity();
  }
  async function ensureSession(practiceType){
    await ready;
    if(!state.user||!state.plan) return null;
    const p=String(practiceType||'reading').toLowerCase();
    if(state.session&&state.sessionSection===p) return state.session;
    if(state.session&&state.sessionSection!==p) await completeSession(0,0,[]);
    const d=await edge('start_session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan_id:state.plan.id,practice_type:p,unit_key:state.lesson||null})});
    state.session=d.session||null;
    state.sessionSection=p;
    if(!activityStartedAt) beginStudyActivity();
    emitTracking('session_started',{session_id:state.session?.id||null,plan_id:state.plan?.id||null,lesson:state.lesson,practice_type:p});
    return state.session;
  }
  async function recordAttempt(payload){
    try{
      const s=await ensureSession(payload?.practice_type); if(!s) return;
      const request={
        session_id:s.id,
        question_id:payload.question_id,
        selected_answer:payload.selected_answer,
        correct_answer:payload.correct_answer,
        is_correct:!!payload.is_correct,
        question_type:payload.question_type||null,
        targets:Array.isArray(payload.targets)?payload.targets:[],
        response_time_ms:Number(payload.response_time_ms)||0,
        metadata:{source_question_number:payload.source_question_number,question_type:payload.question_type,source_label:payload.source_label,lesson:state.lesson,plan_id:state.plan?.id}
      };
      const d=await edge('attempt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
      emitTracking('attempt_saved',{...request,attempt_id:d?.attempt?.id||null,attempt_number:d?.attempt?.attempt_number??null,is_retry:d?.attempt?.is_retry??null,corrected_previous:d?.attempt?.corrected_previous??null});
    }catch(e){console.warn('[test-prep-app] attempt save failed',e);emitTracking('attempt_error',{error:String(e?.message||e)})}
  }
  async function completeSession(correctCount,questionCount,wrongIds){
    const s=state.session; if(!s){resetStudyActivity();return;}
    const activeTimeMs=getActiveTimeMs();
    state.session=null;
    state.sessionSection=null;
    resetStudyActivity();
    try{
      const request={session_id:s.id,correct_count:Number(correctCount)||0,question_count:Number(questionCount)||0,wrong_ids:Array.isArray(wrongIds)?wrongIds:[],active_time_ms:activeTimeMs};
      const d=await edge('complete_session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
      emitTracking('session_completed',{...request,session:d?.session||null});
    }catch(e){console.warn('[test-prep-app] session completion failed',e);emitTracking('session_error',{error:String(e?.message||e)})}
  }
  window.WillenaTestPrepAuth={ready,state,edge,setActivePlan,recordAttempt,completeSession,ensureSession,beginStudyActivity,getActiveTimeMs};
})();
