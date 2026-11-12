/* Teacher Utilities: read-only Free Talking evaluator replay. */
(()=>{
 'use strict';
 const root=document.getElementById('ftReplay');if(!root)return;
 const el=id=>root.querySelector('#'+id);
 const select=el('ftrSessions'),status=el('ftrStatus'),summary=el('ftrSummary'),detail=el('ftrDetail');
 const dateOptions=el('ftrDays'),refresh=el('ftrRefresh'),run=el('ftrRun'),filter=el('ftrFilter');
 let sessions=[],busy=false;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt','"':'&quot;',"'":'&#39;'}[c]));
 const when=s=>s?new Date(s).toLocaleString('en-GB',{timeZone:'Asia/Seoul',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
 const say=(s,isError=false)=>{status.textContent=s;status.dataset.error=isError?'yes':'no'};
 async function call(body){
  const r=await fetch('/api/teacher-free-talking-replay',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  let data;try{data=await r.json()}catch{throw Error('Replay service returned an invalid response ('+r.status+')')}
  if(!r.ok)throw Error(data.error||'Replay request failed ('+r.status+')');return data;
 }
 function renderList(){
  const needle=filter.value.trim().toLowerCase();
  const matched=sessions.filter(s=>[s.name,s.class_name,s.character,s.session_id].some(x=>String(x||'').toLowerCase().includes(needle)));
  const previous=select.value;select.replaceChildren();
  for(const s of matched){
   const option=document.createElement('option');option.value=s.session_id;
   option.textContent=when(s.last_at)+' · '+s.name+' ('+(s.class_name||'No class')+') · '+s.character+' · '+s.turns+' turns'+(s.reviewed?' · '+s.original_points+'/32':'');
   select.append(option)
  }
  if(matched.some(s=>s.session_id===previous))select.value=previous;
  run.disabled=busy||!matched.length;
  if(!matched.length)say('No recorded sessions match this filter.');
 }
 async function load(){
  if(busy)return;busy=true;refresh.disabled=true;run.disabled=true;say('Loading recorded conversations…');
  try{const data=await call({action:'list',days:Number(dateOptions.value)});sessions=data.sessions||[];renderList();say(sessions.length+' sessions loaded. Select one to replay. No student records will change.')}catch(e){say(e.message,true);sessions=[];renderList()}finally{busy=false;refresh.disabled=false;run.disabled=!select.value}
 }
 async function replay(){
  const sessionId=select.value;if(!sessionId||busy)return;
  busy=true;run.disabled=true;refresh.disabled=true;summary.hidden=true;detail.replaceChildren();say('Running one end-of-session evaluator on the saved transcript…');
  try{
   const d=await call({action:'replay',session_id:sessionId});
   const item=sessions.find(s=>s.session_id===sessionId);
   const change=d.qualifying+' / '+d.reviewed+' genuine contributions';
   summary.hidden=false;summary.innerHTML='<div class="ftr-summary-grid">'+
     '<div><small>Student</small><strong>'+esc(item?.name||'Student')+'</strong></div>'+
     '<div><small>Original score</small><strong>'+esc(d.original_points)+'/32</strong></div>'+
     '<div><small>Replay score</small><strong>'+esc(d.points)+'/32</strong></div>'+
     '<div><small>Would qualify</small><strong>'+esc(change)+'</strong></div></div>'+
     '<p class="ftr-feedback"><b>Proposed goodbye:</b> '+esc(d.feedback)+'</p>'+
     '<p class="ftr-warning">Preview only · The existing homework progress, stars and scores are unchanged.</p>';
   const table=document.createElement('div');table.className='ftr-turn-list';
   for(const s of d.scores){
    const row=document.createElement('article');row.className='ftr-turn';
    row.innerHTML='<div class="ftr-turn-top"><span>Answer '+s.turn+'</span><span class="'+(s.qualifies?'ftr-yes':'ftr-no')+'">'+(s.qualifies?'✓ Counts':'× Does not count')+'</span><span>'+s.points+'/4 points'+(s.old_points!==null?' · before '+s.old_points+'/4':'')+'</span></div>'+
      '<p class="ftr-quote">'+esc(s.student_text)+'</p><p class="ftr-reason">'+esc(s.reason)+'</p>';
    table.append(row)
   }
   detail.replaceChildren(table);say('Replay finished · '+esc(d.model)+' · read-only.');
  }catch(e){say(e.message,true)}finally{busy=false;run.disabled=!select.value;refresh.disabled=false}
 }
 refresh.addEventListener('click',load);run.addEventListener('click',replay);filter.addEventListener('input',renderList);
 dateOptions.addEventListener('change',load);
 window.WillenaEvaluatorReplay={activate:()=>{if(!sessions.length&&!busy)void load()}};
})();
