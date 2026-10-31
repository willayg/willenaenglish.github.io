/* Live, read-only Naesin homework outcomes. Distinguishes completion from accuracy. */
(()=>{'use strict';
const ROOT='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>x?new Date(x).toLocaleDateString('ko-KR'):'—';
const id=x=>String(x||'');
let loading=false,selected='',all=[],scope='my',currentTeacherId='',teacherNames=new Map();
const access=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
async function get(path,options={}){
 let token=access();if(!token)throw Error('Teacher login required');
 const send=t=>fetch(ROOT+path,{...options,headers:{apikey:KEY,Authorization:'Bearer '+t,...(options.headers||{})},cache:'no-store',credentials:'omit'});
 let response=await send(token);
 if(response.status===401){
   try{const r=await (window.WillenaAPI?.fetch?window.WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=refresh',{credentials:'include',cache:'no-store'}):fetch('/.netlify/functions/supabase_auth?action=refresh',{credentials:'include',cache:'no-store'}));const d=await r.json();if(d?.access_token){window.WillenaAPI?.setLocalTokens?.(d.access_token,d.refresh_token||'');response=await send(d.access_token)}}catch(_){}
 }
 const body=await response.json().catch(()=>null);
 if(!response.ok)throw Error(body?.message||body?.error||'Request failed '+response.status);
 return body;
}
async function teacherIdentity(){
 const token=access();if(!token)throw Error('Teacher login required');
 const response=await fetch('https://fiieuiktlsivwfgyivai.supabase.co/auth/v1/user',{headers:{apikey:KEY,Authorization:'Bearer '+token},cache:'no-store'});
 if(!response.ok)throw Error('Could not verify current teacher');
 const me=await response.json();
 if(!me?.id)throw Error('Teacher identity unavailable');
 return id(me.id);
}
async function load(){
 if(loading)return;const host=document.querySelector('#uaProgress');if(!host)return;
 loading=true;host.textContent='Loading homework results…';
 try{
  let groups=window.NaesinV2Data?.getCachedGroups?.()||[];
  if(!groups.length){await window.NaesinV2Data?.loadGroups?.();groups=window.NaesinV2Data?.getCachedGroups?.()||[]}
  const ids=groups.map(x=>id((x.group||x).id)).filter(Boolean);
  if(!ids.length){host.textContent='No exam groups loaded. Refresh exams first.';return}
  currentTeacherId=await teacherIdentity();
  const tasks=await get('test_prep_tasks?select=id,created_at,created_by,group_id,plan_id,student_id,lesson,practice_type,title,target_count,due_at,active,completed_at&group_id=in.('+ids.join(',')+')&order=created_at.desc&limit=1000');
  const creators=[...new Set(tasks.map(t=>id(t.created_by)).filter(Boolean))];
  teacherNames=new Map();
  if(creators.length){
   try{
    const profiles=await get('profiles?select=id,name,username&id=in.('+creators.join(',')+')');
    profiles.forEach(p=>teacherNames.set(id(p.id),p.name||p.username||'Unknown teacher'));
   }catch(e){console.warn('Teacher names unavailable',e)}
  }
  const data=await get('rpc/test_prep_assignment_results_v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_group_id:null})});
  if(!Array.isArray(data))throw Error('Invalid assignment results response');
  const resultMap=new Map(data.map(r=>[id(r.task_id),r]));
  const names=new Map();
  groups.forEach(item=>(item.members||[]).forEach(m=>{const p=m.student||{};names.set(id(p.id||m.student_id),p.korean_name||p.name||p.username||'Student')}));
  all=tasks.map(t=>{
   const result=resultMap.get(id(t.id));
   const done=result?Number(result.done)||0:0,target=Math.max(1,Number(t.target_count)||10);
   return {...t,name:names.get(id(t.student_id))||id(t.student_id).slice(0,8),done,target,
    correct:result?Number(result.correct)||0:0,wrong:result?Number(result.wrong)||0:0,
    unresolved:result?Number(result.unresolved)||0:0,retries:result?Number(result.retries)||0:0,
    accuracy:result?.accuracy_percent??null,verified:!!result,complete:done>=target};
  });
  render();
 }catch(e){host.innerHTML='<p class="empty">Could not load assignment results: '+esc(e.message)+'</p>'}
 finally{loading=false}
}
function render(){
 const host=document.querySelector('#uaProgress');if(!host)return;
 const groups=window.NaesinV2Data?.getCachedGroups?.()||[],options=groups.map(x=>x.group||x);
 const rows=all.filter(t=>(scope==='all'||(t.active&&currentTeacherId&&id(t.created_by)===currentTeacherId))&&(!selected||id(t.group_id)===selected));
 const completed=rows.filter(t=>t.complete).length;
 host.innerHTML='<div class="ua-scope-tabs" role="tablist" aria-label="Assignment ownership"><button type="button" role="tab" data-ua-scope="my" aria-selected="'+(scope==='my')+'" class="'+(scope==='my'?'active':'')+'">My</button><button type="button" role="tab" data-ua-scope="all" aria-selected="'+(scope==='all')+'" class="'+(scope==='all'?'active':'')+'">All</button></div><div class="ua-toolbar"><strong>내신 homework results</strong><select class="control" id="uaGroupFilter"><option value="">All exams</option>'+
 options.map(g=>'<option value="'+esc(g.id)+'" '+(id(g.id)===selected?'selected':'')+'>'+esc(g.school||'')+' · '+esc(g.book_label||'')+'</option>').join('')+
 '</select><button class="control" id="uaProgressRefresh">Refresh results</button></div>'+
 '<p class="ua-tracker-summary">'+rows.length+' assignments · '+completed+' completed · '+(scope==='my'?'Current teacher · active assignments':'All teachers · active and inactive assignments')+' · Completion is not a score</p>'+
 '<div class="ua-progress-table-wrap"><table class="ua-progress-table"><thead><tr><th>Student</th><th>Assigned by</th><th>Lesson / Skill</th><th>Work completed</th><th>Accuracy</th><th>Correct</th><th>Wrong</th><th>오답 remaining</th><th>Retries</th><th>Due</th></tr></thead><tbody>'+
 rows.map(t=>'<tr><td>'+esc(t.name)+'</td><td>'+esc(teacherNames.get(id(t.created_by))||'Unknown')+'</td><td>'+esc(t.lesson)+'<small>'+esc(t.practice_type)+'</small></td><td><b>'+t.done+'/'+t.target+' questions</b><small>'+(t.complete?'완료':'진행 중')+'</small><div class="ua-track"><i style="width:'+Math.min(100,Math.round(t.done/t.target*100))+'%"></i></div></td><td class="ua-accuracy">'+(t.verified&&t.done?esc(t.accuracy)+'%':'—')+'</td><td>'+t.correct+'/'+t.done+'</td><td>'+t.wrong+'</td><td>'+t.unresolved+'</td><td>'+t.retries+'</td><td>'+esc(fmt(t.due_at))+'</td></tr>').join('')+
 '</tbody></table></div>'+(rows.length?'':'<p class="empty">No assignments found.</p>')+
 '<p class="ua-note">Work completed = distinct questions attempted after assignment creation. Accuracy = correct on the first answer to each question in this assignment (not completion %). Wrong = incorrect first answers; 오답 remaining = still unresolved. Reattempts are shown separately.</p>';
 host.querySelectorAll('[data-ua-scope]').forEach(b=>b.onclick=()=>{scope=b.dataset.uaScope;render()});
 host.querySelector('#uaGroupFilter').onchange=e=>{selected=e.target.value;render()};
 host.querySelector('#uaProgressRefresh').onclick=load;
}
let overviewStage='active';
const overviewSelections=new Set();
const homeworkKey=row=>row._table+':'+row.id;
async function changeHomework(row){
 const table=row._table;
 if(!['homework_assignments','grammar_foundation_homework','sentence_genius_homework','test_prep_tasks'].includes(table))throw Error('This app does not support changes here yet');
 const update={active:false};
 if(table==='homework_assignments'){update.status='completed';update.ended_at=new Date().toISOString();}
 if(table==='grammar_foundation_homework')update.closed_at=new Date().toISOString();
 if(table==='test_prep_tasks')update.completed_at=new Date().toISOString();
 const changed=await get(table+'?id=eq.'+encodeURIComponent(row.id),{
  method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(update)
 });
 if(!Array.isArray(changed)||changed.length!==1)throw Error('Assignment was not updated; check teacher permissions');
 row.isActive=false;
 row.active=false;
 Object.assign(row,changed[0]);
 overviewSelections.delete(homeworkKey(row));
}
async function loadOverview(scopeName='my'){
 const host=document.querySelector('#uaOverview');if(!host)return;
 host.textContent='Loading assignments across apps…';
 try{
  const teacher=await teacherIdentity();
  overviewSelections.clear();
  const sources=[
   {app:'Word Genius',table:'homework_assignments',select:'id,created_by,class,title,status,active,created_at,due_at,ended_at',label:r=>r.title||r.class||'Vocabulary homework',isActive:r=>r.active!==false&&r.status!=='closed'&&r.status!=='completed'&&r.status!=='cancelled'},
   {app:'Grammar Genius',table:'grammar_foundation_homework',select:'id,created_by,class_name,module_title,stage_title,active,created_at,due_at,closed_at',label:r=>[r.module_title,r.stage_title].filter(Boolean).join(' · '),isActive:r=>r.active!==false},
   {app:'Sentence Genius',table:'sentence_genius_homework',select:'id,created_by,class_name,title,book_title,unit_label,active,created_at,due_at',label:r=>r.title||r.book_title||'Sentence homework',isActive:r=>r.active!==false},
   {app:'내신',table:'test_prep_tasks',select:'id,created_by,title,lesson,practice_type,active,created_at,due_at,completed_at,student_id,target_count',label:r=>r.title||[r.lesson,r.practice_type].filter(Boolean).join(' · '),isActive:r=>r.active!==false}
  ];
  const fetched=await Promise.allSettled(sources.map(async source=>{
   const rows=await get(source.table+'?select='+encodeURIComponent(source.select)+'&order=created_at.desc&limit=1000');
   return rows.map(row=>({...row,_table:source.table,app:source.app,label:source.label(row),isActive:source.isActive(row)}));
  }));
  const errors=[],rows=[];
  fetched.forEach((result,index)=>{if(result.status==='fulfilled')rows.push(...result.value);else errors.push(sources[index].app+': '+result.reason.message)});
  // Resolve per-student assignments to the actual student profile and class.
  const studentIds=[...new Set(rows.map(r=>id(r.student_id)).filter(Boolean))];
  let students=new Map();
  if(studentIds.length)try{
   const profiles=await get('profiles?select=id,name,username,korean_name,class&id=in.('+studentIds.join(',')+')');
   students=new Map(profiles.map(p=>[id(p.id),p]));
  }catch(e){errors.push('Student names: '+e.message)}
  const creators=[...new Set(rows.map(r=>id(r.created_by)).filter(Boolean))];
  let authors=new Map();
  if(creators.length)try{
   const profiles=await get('profiles?select=id,name,username&id=in.('+creators.join(',')+')');
   authors=new Map(profiles.map(p=>[id(p.id),p.name||p.username||'Unknown']));
  }catch(e){errors.push('Teacher names: '+e.message)}
  const naesin=rows.filter(r=>r.app==='내신');
  let progress=new Map();
  if(naesin.length)try{
   const results=await get('rpc/test_prep_assignment_results_v1',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_group_id:null})
   });
   if(Array.isArray(results))progress=new Map(results.map(x=>[id(x.task_id),x]));
  }catch(e){errors.push('내신 progress: '+e.message)}
  function renderOverview(){
   const now=Date.now();
   const overdue=r=>r.due_at&&Date.parse(r.due_at)<now;
   const finished=r=>!r.isActive||overdue(r);
   const owned=rows.filter(r=>scopeName==='all'||id(r.created_by)===teacher);
   const active=owned.filter(r=>!finished(r));
   const complete=owned.filter(finished);
   const visible=(overviewStage==='complete'?complete:active)
    .sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
   const selectable=visible.filter(r=>id(r.created_by)===teacher);
   const checked=selectable.filter(r=>overviewSelections.has(homeworkKey(r))).length;
   host.innerHTML='<div class="ua-scope-tabs" role="tablist" aria-label="Homework status"><button type="button" class="'+(overviewStage==='active'?'active':'')+'" data-ua-stage="active">Active ('+active.length+')</button><button type="button" class="'+(overviewStage==='complete'?'active':'')+'" data-ua-stage="complete">Complete ('+complete.length+')</button></div>'+
     '<div class="ua-toolbar"><strong>'+(scopeName==='my'?'My homework':'All teachers’ homework')+'</strong>'+
     (overviewStage==='active'?'<label class="ua-bulk-select"><input type="checkbox" id="uaSelectAll" '+(selectable.length&&checked===selectable.length?'checked':'')+' '+(!selectable.length?'disabled':'')+'> Select all</label><button type="button" class="control ua-bulk-complete" id="uaCompleteSelected" '+(!checked?'disabled':'')+'>✓ Complete selected ('+checked+')</button>':'')+
     '<button type="button" class="control" id="uaOverviewRefresh">Refresh</button></div>'+
     (errors.length?'<p class="ua-note" style="color:#b04b40">Some sources unavailable: '+esc(errors.join('; '))+'</p>':'')+
     '<p id="uaBulkStatus" class="ua-note" role="status" aria-live="polite" hidden></p>'+
     '<div class="ua-homework-cards">'+visible.map((row,i)=>{
      const result=progress.get(id(row.id));
      const done=result?Number(result.done)||0:0;
      const target=Number(row.target_count)||0;
      const pct=target?Math.min(100,Math.round(done/target*100)):null;
      const detail=result?'Completed '+done+'/'+target+' questions · Accuracy '+(result.accuracy_percent??'—')+'%':'Progress not connected for this app';
      const status=!row.isActive?(row.status==='cancelled'?'Removed':'Closed'):overdue(row)?'Past due':'Active';
      const ownedByMe=id(row.created_by)===teacher;
      return '<article class="ua-homework-card" data-ua-card="'+i+'"><button type="button" class="ua-homework-detail" data-ua-detail="'+i+'" aria-expanded="false"><span><b>'+esc(row.app)+'</b> · '+esc(row.label||'Homework')+'</span><small>'+esc((()=>{const student=students.get(id(row.student_id));return student?[(student.name||student.username||student.korean_name),student.class||''].filter(Boolean).join(' · '):(row.class||row.class_name||'Student name unavailable');})())+' · '+esc(authors.get(id(row.created_by))||'Unknown')+' · '+esc(fmt(row.due_at))+'</small><strong>'+esc(status)+(pct===null?'':' · '+pct+'%')+' ▾</strong></button>'+
        '<div class="ua-homework-expanded" id="uaExpanded'+i+'" hidden>'+esc(detail)+'</div>'+
        (overviewStage==='active'&&ownedByMe?'<div class="ua-homework-actions"><label class="ua-homework-checkbox"><input type="checkbox" data-ua-select="'+i+'" aria-label="Select homework for bulk completion" '+(overviewSelections.has(homeworkKey(row))?'checked':'')+'></label><button type="button" data-ua-complete="'+i+'" aria-label="Mark homework complete" title="Complete">✓</button></div>':'')+'</article>';
     }).join('')+'</div>'+(visible.length?'':'<p class="ua-empty">No homework in this section.</p>')+
     '<p class="ua-note">Past-due homework appears in Complete automatically. ✓ closes one assignment; check boxes and Complete selected close several. Student attempts and results remain preserved.</p>';
   host.querySelector('#uaOverviewRefresh').onclick=()=>loadOverview(scopeName);
   host.querySelectorAll('[data-ua-stage]').forEach(button=>button.onclick=()=>{overviewStage=button.dataset.uaStage;overviewSelections.clear();renderOverview()});
   host.querySelectorAll('[data-ua-detail]').forEach(button=>button.onclick=()=>{
    const panel=host.querySelector('#uaExpanded'+button.dataset.uaDetail);
    panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));
   });
   function updateSelectionUI(){
    const selectedCount=selectable.filter(r=>overviewSelections.has(homeworkKey(r))).length;
    const bulk=host.querySelector('#uaCompleteSelected');
    if(bulk){bulk.disabled=selectedCount===0;bulk.textContent='✓ Complete selected ('+selectedCount+')';}
    const allBox=host.querySelector('#uaSelectAll');
    if(allBox){allBox.checked=selectable.length>0&&selectedCount===selectable.length;allBox.indeterminate=selectedCount>0&&selectedCount<selectable.length;}
   }
   host.querySelectorAll('[data-ua-select]').forEach(box=>box.onchange=()=>{
    const row=visible[Number(box.dataset.uaSelect)];
    if(box.checked)overviewSelections.add(homeworkKey(row));else overviewSelections.delete(homeworkKey(row));
    updateSelectionUI();
   });
   const selectAll=host.querySelector('#uaSelectAll');
   if(selectAll)selectAll.onchange=()=>{
    selectable.forEach(row=>{if(selectAll.checked)overviewSelections.add(homeworkKey(row));else overviewSelections.delete(homeworkKey(row))});
    host.querySelectorAll('[data-ua-select]').forEach(box=>box.checked=selectAll.checked);
    updateSelectionUI();
   };
   async function completeRows(items){
    if(!items.length)return;
    if(!confirm('Mark '+items.length+' homework assignment'+(items.length===1?'':'s')+' complete?'))return;
    const controls=host.querySelectorAll('[data-ua-complete],#uaCompleteSelected,[data-ua-select],#uaSelectAll');
    controls.forEach(el=>el.disabled=true);
    const notice=host.querySelector('#uaBulkStatus');notice.hidden=false;notice.textContent='Completing '+items.length+' assignments…';
    let success=0,failed=[];
    // Small parallel batches avoid overwhelming the REST API.
    for(let i=0;i<items.length;i+=5){
     const results=await Promise.allSettled(items.slice(i,i+5).map(changeHomework));
     results.forEach((r,j)=>{if(r.status==='fulfilled')success++;else failed.push(items[i+j].label+': '+r.reason.message)});
    }
    renderOverview();
    const status=host.querySelector('#uaBulkStatus');
    if(status){status.hidden=false;status.textContent=success+' completed.'+(failed.length?' '+failed.length+' failed: '+failed.slice(0,3).join('; '):'');}
   }
   host.querySelectorAll('[data-ua-complete]').forEach(button=>button.onclick=()=>{
    const row=visible[Number(button.dataset.uaComplete)];
    completeRows([row]);
   });
   const bulk=host.querySelector('#uaCompleteSelected');
   if(bulk)bulk.onclick=()=>completeRows(selectable.filter(row=>overviewSelections.has(homeworkKey(row))));
  }
  renderOverview();
 }catch(e){host.innerHTML='<p class="ua-empty">Could not load homework: '+esc(e.message)+'</p>'}
}
window.UniversalAssignmentTracker={load,loadOverview};
})();