(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const state={classes:[],className:'',days:30,students:[],loadedKey:''};

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function apiPath(section,params={}){const q=new URLSearchParams({section,...params});return '/.netlify/functions/progress_summary?'+q.toString()}
  async function api(path){
    const resolved=window.WillenaAPI&&typeof window.WillenaAPI.getApiUrl==='function'?window.WillenaAPI.getApiUrl(path):path;
    const r=await fetch(resolved,{credentials:'include',cache:'no-store'});let j={};try{j=await r.json()}catch{}
    if(!r.ok||j?.success===false)throw new Error(j?.error||('Request failed ('+r.status+')'));return j;
  }
  // General Progress is read from the shared 내신-style Genius snapshot.
  // Existing Word Genius unit snapshots and Gold awards stay authoritative.
  const OPERATIONS='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/';
  const PUBLISHABLE='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
  async function snapshot(className,days){
    async function call(access){
      return fetch(OPERATIONS+'rpc/genius_teacher_snapshot_read_v1',{
        method:'POST',cache:'no-store',headers:{
          apikey:PUBLISHABLE,Authorization:'Bearer '+access,'Content-Type':'application/json'
        },
        body:JSON.stringify({p_app:'word',p_class:className||null,p_days:days,p_refresh_limit:60})
      });
    }
    let token=window.WillenaAPI?.getLocalAccessToken?.()||'';
    let response=await call(token);
    if(response.status===401||response.status===403){
      const refresh=await (window.WillenaAPI?.fetch
        ?window.WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=refresh')
        :fetch('/.netlify/functions/supabase_auth?action=refresh',{credentials:'include'}));
      const data=await refresh.json().catch(()=>({}));
      if(refresh.ok&&data.access_token){
        window.WillenaAPI?.setLocalTokens?.(data.access_token,data.refresh_token||'');
        token=data.access_token;response=await call(token);
      }
    }
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result.success!==true)throw Error(result.message||result.error||'Word Genius stats unavailable');
    return (result.students||[]).map(item=>{
      const skills=item.skills||{};
      const entries=['vocabulary','spelling','speaking'].map(skill=>{
        const count=Number(skills[skill]?.attempts)||0;
        const correct=Number(skills[skill]?.correct)||0;
        return {skill,attempts:count,correct,accuracy:count?100*correct/count:null};
      });
      return {...item,user_id:item.id,learning:{skills:entries},
        today:{questions:Number(item.today_attempts)||0}};
    });
  }
  function skillRow(student,name){
    const skills=student?.learning?.skills||[];
    const key=String(name).toLowerCase();
    return skills.find(s=>String(s.skill||'').toLowerCase()===key)||null;
  }
  function skillMetric(student,name,label,klass=''){
    const s=skillRow(student,name);
    const pct=s&&typeof s.accuracy==='number'?Math.max(0,Math.min(100,Number(s.accuracy))):null;
    const attempts=Number(s?.attempts||0);
    if(pct==null)return '<div class="vocab-skill-metric"><div class="vocab-skill-ring '+klass+'" style="--pct:0"><b>—</b></div><div class="vocab-skill-copy"><strong>'+label+'</strong><small>No evidence</small></div></div>';
    return '<div class="vocab-skill-metric"><div class="vocab-skill-ring '+klass+'" style="--pct:'+pct+'"><b>'+Math.round(pct)+'%</b></div><div class="vocab-skill-copy"><strong>'+label+'</strong><small>'+attempts+' attempts</small></div></div>';
  }
  function vocabAccuracy(student){
    const rows=['vocabulary','spelling','speaking'].map(k=>skillRow(student,k)).filter(Boolean).filter(s=>typeof s.accuracy==='number');
    if(!rows.length)return null;
    const total=rows.reduce((n,s)=>n+Number(s.attempts||0),0);
    if(!total)return Math.round(rows.reduce((n,s)=>n+Number(s.accuracy||0),0)/rows.length);
    return Math.round(rows.reduce((n,s)=>n+(Number(s.accuracy||0)*Number(s.attempts||0)),0)/total);
  }
  function filteredStudents(){
    const q=($('#vocabProgressSearch')?.value||'').trim().toLowerCase();
    return state.students.filter(s=>!q||String(s.name||'').toLowerCase().includes(q)||String(s.korean_name||'').toLowerCase().includes(q));
  }
  function render(){
    const list=$('#vocabProgressList'),summary=$('#vocabProgressSummary');if(!list)return;
    const rows=filteredStudents();
    const withEvidence=rows.filter(s=>vocabAccuracy(s)!=null);
    const avg=withEvidence.length?Math.round(withEvidence.reduce((n,s)=>n+vocabAccuracy(s),0)/withEvidence.length):null;
    const activeToday=rows.filter(s=>{
      const last=s?.last_activity?new Date(s.last_activity):null;
      if(!last||Number.isNaN(last.getTime()))return false;
      const now=new Date();
      return last.getFullYear()===now.getFullYear()&&last.getMonth()===now.getMonth()&&last.getDate()===now.getDate();
    }).length;
    if(summary)summary.innerHTML=
      '<div class="vocab-summary-card"><b>'+(avg==null?'—':avg+'%')+'</b><span>Word Genius avg.</span></div>'+
      '<div class="vocab-summary-card"><b>'+activeToday+'</b><span>studied today</span></div>'+
      '<div class="vocab-summary-card"><b>'+withEvidence.length+' / '+rows.length+'</b><span>with evidence</span></div>';
    if(!rows.length){list.innerHTML='<div class="empty">No students found.</div>';return}
    list.innerHTML=rows.map(s=>{
      const h=s.habits||{},acc=vocabAccuracy(s);
      const vocab=skillRow(s,'vocabulary'),spell=skillRow(s,'spelling'),speak=skillRow(s,'speaking');
      const todayCount=Number(s?.today?.questions||s?.today_attempts||0);
      const last=s?.last_activity?new Date(s.last_activity):null;
      const today=last&&!Number.isNaN(last.getTime())&&(()=>{
        const now=new Date();
        return last.getFullYear()===now.getFullYear()&&last.getMonth()===now.getMonth()&&last.getDate()===now.getDate();
      })();
      const cell=(row,label,klass='')=>{
        if(!row||typeof row.accuracy!=='number')return '<div class="vocab-matrix-stat empty"><strong>—</strong><small>'+label+'</small></div>';
        return '<div class="vocab-matrix-stat '+klass+'"><strong>'+Math.round(Number(row.accuracy))+'%</strong><small>'+esc(row.attempts||0)+' attempts</small></div>';
      };
      return '<div class="vocab-progress-row" data-student-id="'+esc(s.user_id)+'">'+
        '<div class="vocab-student"><button type="button" class="vocab-student-open"><span><b>'+esc(s.name||'Student')+'</b><small>'+esc(s.korean_name||'')+'</small></span><i>›</i></button></div>'+
        '<div class="vocab-matrix-stat overall '+(acc==null?'empty':'')+'"><strong>'+(acc==null?'—':acc+'%')+'</strong><small>recent Word Genius</small></div>'+
        cell(vocab,'Quiz')+
        cell(spell,'Spelling','spelling')+
        cell(speak,'Speaking','speaking')+
        '<div class="vocab-matrix-stat today '+(today?'is-today':'')+'"><strong>'+(today?(todayCount||'✓'):'—')+'</strong><small>'+(today?'today':'no activity')+'</small></div>'+
      '</div>';
    }).join('');
    $$('.vocab-progress-row',list).forEach(row=>row.addEventListener('click',()=>{if(typeof window.openStudent==='function')window.openStudent(row.dataset.studentId)}));
  }
  async function loadClasses(){
    if(state.classes.length)return;
    const data=await api(apiPath('teacher_classes'));
    state.classes=Array.isArray(data.classes)?data.classes:[];
    const sel=$('#vocabProgressClass');
    if(sel){
      sel.innerHTML='<option value="">All classes</option>'+state.classes.map(c=>'<option value="'+esc(c.name)+'">'+esc(c.name)+' ('+esc(c.student_count)+')</option>').join('');
      if(state.className)sel.value=state.className;
    }
  }
  async function load(force=false){
    const list=$('#vocabProgressList');if(!list)return;
    try{
      await loadClasses();
      state.className=$('#vocabProgressClass')?.value||'';
      state.days=Number($('#vocabProgressDays')?.value)||30;
      const key=state.className+'|'+state.days;
      if(!force&&state.loadedKey===key){render();return}
      list.innerHTML='<div class="empty">Loading Word Genius progress…</div>';
      state.students=await snapshot(state.className,state.days);
      state.loadedKey=key;render();
    }catch(e){list.innerHTML='<div class="empty">Could not load Word Genius progress: '+esc(e.message)+'</div>'}
  }
  function openTab(tab){
    $$('.vocab-hub-tab').forEach(b=>b.classList.toggle('active',b.dataset.vocabTab===tab));
    $$('.vocab-subview').forEach(v=>v.classList.toggle('active',v.dataset.vocabSubview===tab));
    if(tab==='general')load();
    if(tab==='assignments')window.dispatchEvent(new CustomEvent('vocab:assignments-open'));
  }
  function init(){
    $$('.vocab-hub-tab').forEach(b=>b.addEventListener('click',()=>openTab(b.dataset.vocabTab)));
    $('#vocabProgressClass')?.addEventListener('change',()=>load(true));
    $('#vocabProgressDays')?.addEventListener('change',()=>load(true));
    $('#vocabProgressRefresh')?.addEventListener('click',()=>load(true));
    $('#vocabProgressSearch')?.addEventListener('input',render);
    $$('[data-view="vocab"]').forEach(b=>b.addEventListener('click',()=>openTab('general')));
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();