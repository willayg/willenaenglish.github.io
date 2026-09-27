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
      '<div class="vocab-summary-card"><b>'+(avg==null?'—':avg+'%')+'</b><span>class vocab</span></div>'+
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
        '<div class="vocab-matrix-stat overall '+(acc==null?'empty':'')+'"><strong>'+(acc==null?'—':acc+'%')+'</strong><small>recent vocab</small></div>'+
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
      list.innerHTML='<div class="empty">Loading vocabulary progress…</div>';
      if(state.className){
        const data=await api(apiPath('teacher_class_insights',{class:state.className,days:String(state.days)}));
        state.students=Array.isArray(data.students)?data.students:[];
      }else{
        const results=await Promise.all(state.classes.map(async c=>{
          try{const d=await api(apiPath('teacher_class_insights',{class:c.name,days:String(state.days)}));return d.students||[]}catch{return[]}
        }));
        const map=new Map();results.flat().forEach(s=>{if(s?.user_id&&!map.has(String(s.user_id)))map.set(String(s.user_id),s)});
        state.students=[...map.values()];
      }
      state.loadedKey=key;render();
    }catch(e){list.innerHTML='<div class="empty">Could not load vocabulary progress: '+esc(e.message)+'</div>'}
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