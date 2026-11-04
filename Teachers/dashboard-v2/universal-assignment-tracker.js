/* Live, read-only Naesin homework outcomes. Distinguishes completion from accuracy. */
(()=>{'use strict';
const expandedHomeworkGroups=new Set();
const expandedAssignmentDates=new Set();
let assignmentDatesInitialized=false;
const assignedDateKey=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'unknown':new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d).replace(/\//g,'-');};
const assignedDateLabel=key=>key==='unknown'?'Date unavailable':new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'}).format(new Date(key+'T12:00:00Z'));
const assignmentDateStyle=document.createElement('style');
assignmentDateStyle.textContent='.ua-date-groups{display:grid;gap:12px;margin:12px 0}.ua-date-card{background:#fff;border:1px solid #dce8eb;border-radius:12px;overflow:hidden}.ua-date-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:16px;text-align:left;padding:15px 18px;border:0;background:#f8fcfd;color:#234456;cursor:pointer}.ua-date-toggle:hover{background:#edf8fa}.ua-date-toggle>span:first-child{display:flex;flex-direction:column;gap:3px}.ua-date-toggle small{font-size:12px;color:#647d88;font-weight:400}.ua-date-chevron{font-size:19px;color:#367f8a}.ua-date-body[hidden]{display:none}.ua-date-body .ua-progress-table-wrap{margin:0;border-radius:0}';
assignmentDateStyle.textContent += '.ua-simple-date-divider{display:flex;align-items:center;gap:14px;font-size:14px;font-weight:700;color:#56717b;margin:24px 0 12px}.ua-simple-date-divider:after{content:"";height:1px;background:#cfdee3;flex:1}.ua-simple-date-divider:first-child{margin-top:8px}';
assignmentDateStyle.textContent += '.ua-group-top{display:flex;align-items:center;gap:8px}.ua-group-top>.ua-group-heading{flex:1;min-width:0}.ua-group-select{display:flex;align-items:center;padding:12px 0 12px 14px;cursor:pointer}.ua-group-select input{width:19px;height:19px;accent-color:#2a9eaa;cursor:pointer}';
const assignmentCardStyle=document.createElement('link');
assignmentCardStyle.rel='stylesheet';
assignmentCardStyle.href='/Teachers/dashboard-v2/genius-homework-card.css?v=20261104-shared-progress3';
document.head.appendChild(assignmentCardStyle);
assignmentDateStyle.textContent += '.ua-overview-genius-card{width:100%;margin:0;min-height:210px;overflow:hidden;position:relative;border:2.5px solid #e7a2c5;border-radius:17px;padding:17px 95px 17px 20px;background:#fff;box-sizing:border-box}.ua-overview-heading{display:flex;align-items:center;gap:10px;min-height:30px}.ua-overview-heading>.ghc-class{flex:1;min-width:0}.ua-overview-genius-card .ghc-task{margin-top:10px}.ua-overview-genius-card .ghc-teacher{margin-bottom:23px}.ua-overview-genius-card .ghc-ring{top:65px}.ua-overview-genius-card>.ghc-details{margin-right:-75px}.ua-overview-progress-toggle{font:inherit;font-size:14px;font-weight:750;color:#277e85;border:0;background:transparent;cursor:pointer;display:flex;justify-content:space-between;width:100%;padding:12px 0 0;text-align:left}.ua-overview-genius-card .ua-group-body{padding:14px 0 0;margin-right:-75px}.ua-overview-genius-card .ua-group-select{padding:0;flex:none}.ua-overview-genius-card .ghc-day{margin-left:auto}.ua-overview-genius-card .ua-homework-card{width:100%}@media(max-width:600px){.ua-overview-genius-card{padding:14px 82px 14px 15px;min-height:200px}.ua-overview-genius-card .ghc-ring{top:65px}.ua-overview-genius-card>.ghc-details,.ua-overview-genius-card .ua-group-body{margin-right:-67px}}';
assignmentDateStyle.textContent += '.ua-toolbar .ua-bulk-icon{display:inline-flex;align-items:center;justify-content:center;gap:5px;flex:0 0 auto;width:56px;height:46px;min-width:56px;min-height:46px;padding:7px;border-radius:12px;background:#fff;line-height:1;border:1.5px solid #a9d7dc;color:#26868f;cursor:pointer}.ua-toolbar .ua-bulk-delete{border-color:#e2b4c7;color:#b25b74}.ua-toolbar .ua-bulk-icon svg{flex:none}.ua-toolbar .ua-bulk-count{font-size:12px;font-weight:800;font-variant-numeric:tabular-nums}.ua-toolbar .ua-bulk-icon:disabled{opacity:.4;cursor:not-allowed}.ua-toolbar .ua-bulk-icon:focus-visible{outline:3px solid #2899a5;outline-offset:2px}';
assignmentDateStyle.textContent += '.ua-overview-filters{display:flex;flex-wrap:wrap;gap:10px;margin:15px 0 12px}.ua-overview-filters label{display:flex;flex:1 1 200px;min-width:0;flex-direction:column;gap:5px;font-size:12px;font-weight:750;color:#54737d}.ua-overview-filters select{width:100%;max-width:100%;background:#fff;box-sizing:border-box;min-height:42px}\n';
document.head.appendChild(assignmentDateStyle);
const ROOT='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>x?new Date(x).toLocaleDateString('ko-KR'):'—';
const dday=x=>{
 if(!x)return 'No deadline';
 const due=new Date(x);if(Number.isNaN(due.getTime()))return 'No deadline';
 const today=new Date();
 const day=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());
 const target=Date.UTC(due.getFullYear(),due.getMonth(),due.getDate());
 const offset=Math.round((target-day)/86400000);
 return offset===0?'D-Day':offset>0?'D-'+offset:'D+'+Math.abs(offset);
};
const id=x=>String(x||'');
function sharedHomeworkGroupStart({key,title,sub,label,average=null,checkbox='',overviewStyle=false,due='',teacher=''}) {
 if(overviewStyle){
  const valid=Number.isFinite(average);
  const pct=valid?Math.max(0,Math.min(100,average)):0;
  return '<div class="ua-group genius-homework-card ua-overview-genius-card" data-ua-group="'+esc(key)+'">'+
   '<div class="ua-overview-heading">'+checkbox+'<strong class="ghc-class">'+esc(title)+'</strong><span class="ghc-day">'+esc(due)+'</span></div>'+
   '<div class="ghc-task">'+esc(sub)+'</div>'+
   '<div class="ghc-teacher">'+esc(teacher)+'</div>'+
   '<div class="ghc-ring'+(valid?' has-data':'')+'" style="'+(valid?'--ghc-pct:'+pct+'%;':'')+'" role="img" aria-label="'+esc(valid?'Tracked homework progress '+pct+'%':'Progress not available')+'"><span>'+(valid?pct+'%':'—')+'</span></div>'+
   '<div class="ghc-details"><button type="button" class="ua-overview-progress-toggle" data-ua-group-toggle="'+esc(key)+'" aria-expanded="false"><span>Student progress</span><span class="ghc-chevron">▾</span></button></div>'+
   '<div class="ua-group-body" hidden>';
 }
 return '<div class="ua-group" data-ua-group="'+esc(key)+'"><div class="ua-group-top">'+checkbox+'<button type="button" class="ua-group-heading" data-ua-group-toggle="'+esc(key)+'" aria-expanded="false"><span><b>'+esc(title)+'</b><small>'+esc(sub)+'</small></span><strong>'+esc(label)+' ▾</strong></button></div>'+
 (average===null?'':'<div class="ua-group-meter" role="progressbar" aria-label="Tracked question completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+average+'"><i style="width:'+average+'%"></i></div>')+
 '<div class="ua-group-body" hidden>';
}
function attachHomeworkGroupToggles(host){
 host.querySelectorAll('[data-ua-group-toggle]').forEach(button=>{
  const key=button.dataset.uaGroupToggle,body=button.closest('.ua-group')?.querySelector('.ua-group-body');
  if(!body)return;
  body.hidden=!expandedHomeworkGroups.has(key);
  button.setAttribute('aria-expanded',String(!body.hidden));
  button.onclick=()=>{body.hidden=!body.hidden;button.setAttribute('aria-expanded',String(!body.hidden));if(body.hidden)expandedHomeworkGroups.delete(key);else expandedHomeworkGroups.add(key)};
 });
}

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
 if(['PATCH','DELETE','PUT'].includes(String(options.method||'GET').toUpperCase()) || (String(options.method||'GET').toUpperCase()==='POST'&&!path.startsWith('rpc/')))invalidateOverviewCache(true);
 return body;
}
async function teacherIdentity(){
 // Dashboard session restoration can finish shortly after the Assignments tab
 // first mounts. Retry verification briefly, but never bypass auth.
 for(let attempt=0;attempt<4;attempt++){
  const token=access();
  if(token){
   try{
    const response=await fetch('https://fiieuiktlsivwfgyivai.supabase.co/auth/v1/user',{headers:{apikey:KEY,Authorization:'Bearer '+token},cache:'no-store'});
    if(response.ok){
     const me=await response.json();
     if(me?.id)return id(me.id);
    }else if(response.status===401&&attempt===0){
     // The existing shared API client owns token refresh; use it when available.
     try{
      const refresh=await window.WillenaAPI?.fetch?.('/.netlify/functions/supabase_auth?action=refresh',{credentials:'include',cache:'no-store'});
      if(refresh?.ok){
       const data=await refresh.json();
       if(data?.access_token)window.WillenaAPI?.setLocalTokens?.(data.access_token,data.refresh_token||'');
      }
     }catch(_){}
    }else if(response.status!==401)throw Error('Could not verify current teacher');
   }catch(error){if(attempt===3)throw error}
  }
  if(attempt<3)await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
 }
 throw Error('Could not verify current teacher');
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
  groups.forEach(item=>(item.members||[]).forEach(m=>{const p=m.student||{};names.set(id(p.id||m.student_id),p.name||p.username||p.korean_name||'Student')}));
  const taskStudentIds=[...new Set(tasks.map(t=>id(t.student_id)).filter(Boolean))];
  for(let i=0;i<taskStudentIds.length;i+=150){
    try{
      const profiles=await get('profiles?select=id,name,username,korean_name&id=in.('+taskStudentIds.slice(i,i+150).join(',')+')');
      profiles.forEach(p=>names.set(id(p.id),p.name||p.username||p.korean_name||'Student'));
    }catch(error){console.warn('[내신 names] English name lookup unavailable',error);break}
  }
  all=tasks.map(t=>{
   const result=resultMap.get(id(t.id));
   const done=result?Number(result.done)||0:0,target=Math.max(1,Number(t.target_count)||10);
   return {...t,name:names.get(id(t.student_id))||id(t.student_id).slice(0,8),done,target,
    attempted:result?Number(result.attempted)||0:0,correct:result?Number(result.correct)||0:0,wrong:result?Number(result.wrong)||0:0,
    unresolved:result?Number(result.unresolved)||0:0,retries:result?Number(result.retries)||0:0,
    accuracy:result?.accuracy_percent??null,verified:!!result,complete:done>=target&&(Number(result?.unresolved)||0)===0};
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
 const byDate=new Map();rows.forEach(t=>{const key=assignedDateKey(t.created_at);if(!byDate.has(key))byDate.set(key,[]);byDate.get(key).push(t)});
 const dateGroups=[...byDate.entries()].sort((a,b)=>b[0].localeCompare(a[0]));
 if(!assignmentDatesInitialized&&dateGroups.length){expandedAssignmentDates.add(dateGroups[0][0]);assignmentDatesInitialized=true;}
 host.innerHTML='<div class="ua-scope-tabs" role="tablist" aria-label="Assignment ownership"><button type="button" role="tab" data-ua-scope="my" aria-selected="'+(scope==='my')+'" class="'+(scope==='my'?'active':'')+'">My</button><button type="button" role="tab" data-ua-scope="all" aria-selected="'+(scope==='all')+'" class="'+(scope==='all'?'active':'')+'">All</button></div><div class="ua-toolbar"><strong>내신 homework results</strong><select class="control" id="uaGroupFilter"><option value="">All exams</option>'+
 options.map(g=>'<option value="'+esc(g.id)+'" '+(id(g.id)===selected?'selected':'')+'>'+esc(g.school||'')+' · '+esc(g.book_label||'')+'</option>').join('')+
 '</select><button class="control" id="uaProgressRefresh">Refresh results</button></div>'+
 '<p class="ua-tracker-summary">'+rows.length+' assignments · '+completed+' completed · '+(scope==='my'?'Current teacher · active assignments':'All teachers · active and inactive assignments')+' · Completion is not a score</p>'+
 '<div class="ua-homework-cards">'+dateGroups.map(([date,items])=>{
   const studentMap=new Map();
   items.forEach(t=>{const studentKey=id(t.student_id)||'unknown:'+t.name;if(!studentMap.has(studentKey))studentMap.set(studentKey,{name:t.name,items:[]});studentMap.get(studentKey).items.push(t)});
   return '<section class="ua-naesin-date"><div class="ua-simple-date-divider"><span>'+esc(assignedDateLabel(date))+'</span></div>'+
    [...studentMap.entries()].sort((a,b)=>a[1].name.localeCompare(b[1].name,'ko')).map(([studentId,student])=>{
     const completedCount=student.items.filter(t=>t.complete).length;
     const percentage=Math.round(100*student.items.reduce((sum,t)=>sum+Math.min(1,t.done/t.target),0)/student.items.length);
     return sharedHomeworkGroupStart({key:'naesin:'+date+':'+studentId,title:student.name,sub:student.items.length+' assignments · '+completedCount+' completed',label:percentage+'% complete',average:percentage,overviewStyle:true,teacher:'내신 homework'})+
      student.items.map(t=>{
       const pct=Math.min(100,Math.round(t.done/t.target*100));
       return '<article class="ua-homework-card"><button class="ua-homework-detail" type="button" data-naesin-detail="'+esc(t.id)+'" aria-expanded="false"><span><b>'+esc(t.lesson||'Lesson')+'</b> · '+esc(t.practice_type||'Practice')+'</span><small>'+esc(teacherNames.get(id(t.created_by))||'Unknown')+' · '+esc(dday(t.due_at))+'</small><strong>'+t.done+'/'+t.target+' correct · '+pct+'% ▾</strong></button>'+
        '<div class="ua-homework-expanded" hidden><p>First-try accuracy: '+(t.verified&&t.done?esc(t.accuracy)+'%':'—')+' · Correct: '+t.correct+' · Wrong: '+t.wrong+' · 오답 remaining: '+t.unresolved+' · Retries: '+t.retries+'</p><div class="ua-track"><i style="width:'+pct+'%"></i></div></div></article>';
      }).join('')+'</div></div>';
    }).join('')+'</section>';
  }).join('')+'</div>'+(rows.length?'':'<p class="empty">No assignments found.</p>')+
 '<p class="ua-note">Completion counts distinct questions answered correctly, including successful retries. Accuracy records first attempts separately. 오답 remaining must reach zero to pass.</p>';
 attachHomeworkGroupToggles(host);
 host.querySelectorAll('[data-naesin-detail]').forEach(button=>button.onclick=()=>{
  const body=button.nextElementSibling;body.hidden=!body.hidden;button.setAttribute('aria-expanded',String(!body.hidden));
 });
 host.querySelectorAll('[data-ua-scope]').forEach(b=>b.onclick=()=>{scope=b.dataset.uaScope;render()});
 host.querySelector('#uaGroupFilter').onchange=e=>{selected=e.target.value;render()};
 host.querySelector('#uaProgressRefresh').onclick=load;
}
let overviewStage='active';
const overviewSelections=new Set();
const overviewFilters={my:{className:'',assignment:''},all:{className:'',assignment:''}};
const homeworkKey=row=>row._table+':'+row.id;
async function changeHomework(row){
 const table=row._table;
 if(!['homework_assignments','grammar_foundation_homework','sentence_genius_homework','test_prep_tasks'].includes(table))throw Error('This app does not support changes here yet');
 if(table==='homework_assignments'){
  const changed=await window.WillenaHomeworkSelection.cancelAssignment(table,row.id);
  row.isActive=false;row.active=false;Object.assign(row,changed);
  overviewSelections.delete(homeworkKey(row));return;
 }
 const update={active:false};
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
async function deleteHomework(row){
 const table=row._table;
 // Where hard deletes are unsupported by RLS, remove the assignment
 // from students' active workload without destroying attempt history.
 if(!['homework_assignments','grammar_foundation_homework','sentence_genius_homework','test_prep_tasks'].includes(table))throw Error('Unsupported homework type');
 if(table==='homework_assignments'||table==='test_prep_tasks'){
  const result=await get(table+'?id=eq.'+encodeURIComponent(row.id),{method:'DELETE',headers:{Prefer:'return=representation'}});
  if(!Array.isArray(result)||result.length!==1)throw Error('Could not delete assignment; check permissions');
  return;
 }
 const update={active:false};
 if(table==='grammar_foundation_homework')update.closed_at=new Date().toISOString();
 const updated=await get(table+'?id=eq.'+encodeURIComponent(row.id),{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(update)});
 if(!Array.isArray(updated)||updated.length!==1)throw Error('Could not remove assignment; check permissions');
}

const editDate=v=>{if(!v)return'';const d=new Date(v);if(!Number.isFinite(d.getTime()))return'';return new Date(d.getTime()+9*3600000).toISOString().slice(0,16)};
const fromEditDate=v=>v?new Date(v+':00+09:00').toISOString():null;
async function editHomework(row,teacher,afterSave){
 if(String(row.created_by)!==String(teacher))return;
 const table=row._table;
 const supported=['homework_assignments','grammar_foundation_homework','sentence_genius_homework','test_prep_tasks'];
 if(!supported.includes(table))return;
 const detailRows=await get(table+'?id=eq.'+encodeURIComponent(row.id)+'&select=*');
 const original=detailRows?.[0];if(!original)throw Error('Assignment not found.');
 const fieldClass=table==='homework_assignments'?'class':table==='test_prep_tasks'?null:'class_name';
 const dialog=document.createElement('dialog');
 dialog.className='ua-edit-modal';
 dialog.style.cssText='border:0;border-radius:24px;padding:0;width:min(94vw,560px);max-height:90vh;box-shadow:0 20px 60px #25394744;color:#313846';
 const backdropStyle=document.createElement('style');
 backdropStyle.textContent='.ua-edit-modal::backdrop{background:#182a38a8}.ua-edit-modal label{display:grid;gap:6px;font-weight:700;font-size:13px}.ua-edit-modal input,.ua-edit-modal textarea,.ua-edit-modal select{width:100%;min-width:0;padding:12px;border:1px solid #cbdadd;border-radius:12px;font:inherit;background:#fff;color:#293747;box-sizing:border-box}.ua-edit-modal form{display:grid;gap:14px;padding:24px}.ua-edit-modal menu{display:flex;justify-content:flex-end;gap:10px;margin:0;padding:10px 0 0}.ua-edit-modal button{cursor:pointer;border-radius:12px;padding:11px 15px;border:1px solid #afd1d5;background:#fff;font:inherit}.ua-edit-modal button[type=submit]{background:#e7f9fa;color:#247f88;font-weight:800}';
 const form=document.createElement('form');form.method='dialog';
 const title=document.createElement('h2');title.textContent='Edit assignment';title.style.margin='0';
 form.append(title);
 const add=(name,value,type='text',options=null)=>{
  const label=document.createElement('label');label.textContent=name;
  const node=options?document.createElement('select'):type==='textarea'?document.createElement('textarea'):document.createElement('input');
  if(node.tagName==='INPUT')node.type=type;
  if(options){options.forEach(x=>{const option=document.createElement('option');option.value=x;option.textContent=x;node.append(option)})}
  node.value=value??'';node.dataset.field=name;label.append(node);form.append(label);return node;
 };
 let classInput=null;
 if(fieldClass){
  const all=await get('classes?select=name&order=name.asc&limit=300').catch(()=>[]);
  const names=[...new Set([original[fieldClass],'Test',...all.map(x=>x.name)].filter(Boolean))];
  classInput=add('Class',original[fieldClass],'text',names);
 }else{
  const note=document.createElement('p');note.textContent='내신 homework is assigned to an individual student. Reassignment to a different class requires a new assignment.';note.style.fontSize='13px';form.append(note);
 }
 const titleInput=('title'in original)?add('Title',original.title):null;
 let contentInput=null;
 if(table==='homework_assignments')contentInput=add('Instructions / content',original.list_meta?.prompt_text||original.description||'','textarea');
 if(table==='grammar_foundation_homework'){
  const select=add('Completion requirement',String(original.completion_percent||80),'text',['80','100']);contentInput=select;
 }else if(table==='sentence_genius_homework'){
  const note=document.createElement('p');note.textContent='Sentence content stays linked to its original book and unit. Change the title, class or deadline here; assign a new task to change the sentence set.';note.style.fontSize='13px';form.append(note);
 }else if(table==='test_prep_tasks'){
  contentInput=add('Number of questions',String(original.target_count||10),'number');
 }
 const startInput=('start_at'in original)?add('Available from',editDate(original.start_at),'datetime-local'):null;
 const dueInput=add('Due date',editDate(original.due_at),'datetime-local');
 dueInput.required=true;
 const recurrenceTable=table==='homework_assignments'?'homework_recurring_schedules':'homework_recurring_app_schedules';
 const scheduleFilter=table==='homework_assignments'?'source_assignment_id=eq.'+encodeURIComponent(row.id):'source_table=eq.'+encodeURIComponent(table)+'&source_id=eq.'+encodeURIComponent(row.id);
 const scheduleRows=await get(recurrenceTable+'?select=*&'+scheduleFilter).catch(()=>[]);
 const currentSchedule=scheduleRows[0]||null;
 const repeatInput=add('Repeat',currentSchedule?(currentSchedule.active?currentSchedule.cadence:'paused'):'none','text',['none','daily','weekly','paused']);
 if(!currentSchedule)repeatInput.querySelector('option[value="paused"]')?.remove();
 const status=document.createElement('p');status.setAttribute('role','status');status.style.cssText='font-size:13px;color:#ad5151;margin:0';
 const menu=document.createElement('menu');const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.onclick=()=>dialog.close();const save=document.createElement('button');save.type='submit';save.textContent='Save changes';menu.append(cancel,save);form.append(status,menu);dialog.append(backdropStyle,form);document.body.append(dialog);
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  const due=fromEditDate(dueInput.value);const start=startInput?fromEditDate(startInput.value):null;
  if(!due||start&&new Date(start)>new Date(due)){status.textContent='Please check the availability and due dates.';return}
  const updates={due_at:due};
  if(classInput)updates[fieldClass]=classInput.value;
  if(titleInput)updates.title=titleInput.value.trim();
  if(startInput)updates.start_at=start;
  if(table==='homework_assignments'){
   updates.description=contentInput.value;
   updates.list_meta={...(original.list_meta||{}),prompt_text:contentInput.value};
   if(original.list_meta?.creative_type==='writing_genius'&&original.list_meta?.kind==='topic'&&!contentInput.value.trim()){status.textContent='Add a topic or writing instructions.';return}
  }else if(table==='grammar_foundation_homework')updates.completion_percent=Number(contentInput.value);
  else if(table==='test_prep_tasks')updates.target_count=Math.max(1,Math.min(500,Number(contentInput.value)||10));
  if(classInput&&!classInput.value){status.textContent='Select a class.';return}
  if(titleInput&&!updates.title){status.textContent='Enter a title.';return}
  save.disabled=true;status.textContent='Saving…';
  try{
   const changed=await get(table+'?id=eq.'+encodeURIComponent(row.id),{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(updates)});
   if(!Array.isArray(changed)||changed.length!==1)throw Error('Update was not saved. Check teacher permissions.');
   const repeat=repeatInput.value;
   if(repeat==='none'||repeat==='paused'){
    if(currentSchedule)await get(recurrenceTable+'?id=eq.'+encodeURIComponent(currentSchedule.id),{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({active:false})});
   }else{
    const days=repeat==='daily'?1:7;
    const nextDue=new Date(new Date(due).getTime()+days*86400000).toISOString();
    const fields={cadence:repeat,interval_days:days,next_due_at:nextDue,active:true};
    if(currentSchedule){
     await get(recurrenceTable+'?id=eq.'+encodeURIComponent(currentSchedule.id),{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(fields)});
    }else{
     const identity=await teacherIdentity();
     const template=table==='homework_assignments'?{source_assignment_id:row.id,created_by:identity}:{source_table:table,source_id:row.id,created_by:identity};
     await get(recurrenceTable,{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({...template,...fields})});
    }
   }
   Object.assign(row,changed[0]);dialog.close();afterSave();
  }catch(err){status.textContent=err.message;save.disabled=false}
 });
}
// Pass 1: shared 60-second read cache for the My/All assignment overview.
const overviewReadCache=new Map();
const OVERVIEW_CACHE_MS=60000;
const OVERVIEW_CACHE_MAX=32;
const overviewPerf={loads:0,cacheHits:0,cacheMisses:0,lastLoadMs:null,lastCompletedAt:null};
let overviewGeneration=0;
const ASSIGNMENT_INVALIDATION_KEY='willena:assignments:changed:v1';
function invalidateOverviewCache(broadcast=false){
 overviewReadCache.clear();
 overviewGeneration++;
 if(broadcast){
  try{localStorage.setItem(ASSIGNMENT_INVALIDATION_KEY,String(Date.now()));}catch(_){}
 }
}
window.addEventListener('storage',event=>{
 if(event.key===ASSIGNMENT_INVALIDATION_KEY)invalidateOverviewCache();
});
function overviewCachePrune(){
 const now=Date.now();
 for(const [key,item] of overviewReadCache)if(item.expires<=now)overviewReadCache.delete(key);
 while(overviewReadCache.size>=OVERVIEW_CACHE_MAX)overviewReadCache.delete(overviewReadCache.keys().next().value);
}
// Read-only, in-memory diagnostics. No student content or tokens are reported.
window.WillenaAssignmentPerformance=Object.freeze({getSummary:()=>({...overviewPerf,cacheEntries:overviewReadCache.size,ttlSeconds:OVERVIEW_CACHE_MS/1000})});
function overviewGet(path,options={}){
 const method=String(options.method||'GET').toUpperCase();
 // Only cache reads. Never cache a new write endpoint that may be added later.
 const isRead=method==='GET'||(method==='POST'&&/^rpc\/(teacher_homework_class_progress_v1|teacher_word_homework_class_progress_v1|teacher_creative_writing_progress_v1|teacher_writing_sentence_homework_progress_v1|teacher_puzzle_homework_progress_v1|test_prep_assignment_results_v1)$/.test(path));
 if(!isRead)return get(path,options);
 const token=access();
 if(!token)return get(path,options);
 const key=[token.split('.')[1]||token,method,path,options.body||''].join('|');
 const existing=overviewReadCache.get(key);
 if(existing&&existing.expires>Date.now()){overviewPerf.cacheHits++;return existing.promise;}
 overviewPerf.cacheMisses++;
 overviewCachePrune();
 const entry={expires:Date.now()+OVERVIEW_CACHE_MS,promise:get(path,options)};
 overviewReadCache.set(key,entry);
 entry.promise.catch(()=>{if(overviewReadCache.get(key)===entry)overviewReadCache.delete(key)});
 return entry.promise;
}
window.addEventListener('ua:assignments-changed',()=>invalidateOverviewCache(true));
window.addEventListener('willena:assignment-created',()=>invalidateOverviewCache(true));
async function loadOverview(scopeName='my',force=false){
 const host=document.querySelector('#uaOverview');if(!host)return;
 const loadStarted=performance.now();
 overviewPerf.loads++;
 if(force)invalidateOverviewCache();
 const generation=++overviewGeneration;
 host.textContent='Loading assignments across apps…';
 try{
  const teacher=await teacherIdentity();
  overviewSelections.clear();
  const sources=[
   {app:'Word Genius',table:'homework_assignments',select:'id,created_by,class,title,status,active,created_at,due_at,ended_at,list_key,list_meta,source_type',label:r=>r.title||r.class||'Vocabulary homework',isActive:r=>r.active!==false&&!['ended','archived','closed','completed','cancelled'].includes(r.status)},
   {app:'Grammar Genius',table:'grammar_foundation_homework',select:'id,created_by,class_name,module_title,stage_title,active,created_at,due_at,closed_at',label:r=>[r.module_title,r.stage_title].filter(Boolean).join(' · '),isActive:r=>r.active!==false},
   {app:'Sentence Genius',table:'sentence_genius_homework',select:'id,created_by,class_name,title,book_title,unit_label,active,created_at,due_at',label:r=>r.title||r.book_title||'Sentence homework',isActive:r=>r.active!==false},
   {app:'내신',table:'test_prep_tasks',select:'id,created_by,title,lesson,practice_type,active,created_at,due_at,completed_at,student_id,target_count',label:r=>r.title||[r.lesson,r.practice_type].filter(Boolean).join(' · '),isActive:r=>r.active!==false}
  ];
  const fetched=await Promise.allSettled(sources.map(async source=>{
   const rows=await overviewGet(source.table+'?select='+encodeURIComponent(source.select)+'&order=created_at.desc&limit=1000');
   return rows.map(row=>{
    let app=source.app;
    if(source.table==='homework_assignments'){
     const meta=row.list_meta&&typeof row.list_meta==='object'?row.list_meta:{};
     const kind=String(meta.creative_type||meta.app||'').toLowerCase();
     const key=String(row.list_key||'').toLowerCase();
     const sourceKind=String(row.source_type||'').toLowerCase();
     if(kind.includes('writing')||key.startsWith('writing_genius:'))app='Writing Genius';
     else if(kind.includes('puzzle')||key.startsWith('puzzles:'))app='Puzzles';
     else if(kind.includes('sentence')||sourceKind==='sentence_genius')app='Sentence Genius';
     else if(sourceKind==='grammar_books')app='Grammar Genius';
    }
    return {...row,_table:source.table,app,label:source.label(row),isActive:source.isActive(row)};
   });
  }));
  const errors=[],rows=[];
  fetched.forEach((result,index)=>{if(result.status==='fulfilled')rows.push(...result.value);else errors.push(sources[index].app+': '+result.reason.message)});
  // Resolve per-student assignments to the actual student profile and class.
  const studentIds=[...new Set(rows.map(r=>id(r.student_id)).filter(Boolean))];
  let students=new Map();
  if(studentIds.length)try{
   const profiles=await overviewGet('profiles?select=id,name,username,korean_name,class&id=in.('+studentIds.join(',')+')');
   students=new Map(profiles.map(p=>[id(p.id),p]));
  }catch(e){errors.push('Student names: '+e.message)}
  const creators=[...new Set(rows.map(r=>id(r.created_by)).filter(Boolean))];
  let authors=new Map();
  if(creators.length)try{
   const profiles=await overviewGet('profiles?select=id,name,username&id=in.('+creators.join(',')+')');
   authors=new Map(profiles.map(p=>[id(p.id),p.name||p.username||'Unknown']));
  }catch(e){errors.push('Teacher names: '+e.message)}
  // Fetch only progress families represented in the result set. Run in
  // controlled parallel batches so one slow RPC doesn't hold up every other RPC.
  const hasApp=app=>rows.some(row=>row.app===app);
  const hasWritingSentence=rows.some(row=>row.app==='Writing Genius'&&row.list_key==='writing_genius:sentence');
  const jobs=[
   {name:'Class progress',enabled:hasApp('Grammar Genius'),path:'rpc/teacher_homework_class_progress_v1',body:'{}'},
   {name:'Grammar book progress',enabled:rows.some(row=>row.source_type==='grammar_books'),path:'rpc/teacher_grammar_book_homework_progress_v1',body:'{}'},
   {name:'Word class activity',enabled:hasApp('Word Genius'),path:'rpc/teacher_word_homework_class_progress_v1',body:'{}'},
   {name:'Writing progress',enabled:rows.some(row=>row.app==='Writing Genius'&&row.list_key!=='writing_genius:sentence'),path:'rpc/teacher_creative_writing_progress_v1',body:'{}'},
   {name:'Sentence writing progress',enabled:hasWritingSentence,path:'rpc/teacher_writing_sentence_homework_progress_v1',body:'{}'},
   {name:'Puzzle progress',enabled:hasApp('Puzzles'),path:'rpc/teacher_puzzle_homework_progress_v1',body:'{}'},
   {name:'내신 progress',enabled:hasApp('내신'),path:'rpc/test_prep_assignment_results_v1',body:JSON.stringify({p_group_id:null})}
  ];
  const outputs=new Map();
  const enabled=jobs.filter(job=>job.enabled);
  let nextJob=0;
  await Promise.all(Array.from({length:Math.min(3,enabled.length)},async()=>{
   while(nextJob<enabled.length){
    const job=enabled[nextJob++];
    try{
     const result=await overviewGet(job.path,{method:'POST',headers:{'Content-Type':'application/json'},body:job.body});
     outputs.set(job.name,Array.isArray(result)?result:[]);
    }catch(error){errors.push(job.name+': '+error.message)}
   }
  }));
  const resultStudentIds=[...new Set([...outputs.values()].flatMap(records=>records.flatMap(record=>Array.isArray(record.student_rows)?record.student_rows.map(s=>id(s.student_id)):[])).filter(Boolean))];
  const missingIds=resultStudentIds.filter(studentId=>!students.has(studentId));
  if(missingIds.length){
    for(let i=0;i<missingIds.length;i+=150){
      try{
        const found=await overviewGet('profiles?select=id,name,username,korean_name,class&id=in.('+missingIds.slice(i,i+150).join(',')+')');
        found.forEach(profile=>students.set(id(profile.id),profile));
      }catch(error){errors.push('Student display names: '+error.message);break}
    }
  }
  const studentNames=students;
  const asMap=(name,key='id')=>new Map((outputs.get(name)||[]).map(item=>[id(item[key]),item]));
  const classProgress=asMap('Class progress');
  const grammarBookProgress=asMap('Grammar book progress');
  const wordClassProgress=asMap('Word class activity');
  const writingProgress=asMap('Writing progress');
  const writingSentenceProgress=asMap('Sentence writing progress');
  const puzzleProgress=asMap('Puzzle progress');
  const progress=asMap('내신 progress','task_id');
  if(generation!==overviewGeneration||!host.isConnected)return;
  function overviewStudentProgress(records,{kind='completion'}={}){
    if(!Array.isArray(records)||!records.length)return '';
    const rows=records.map(st=>{
      const person=studentNames.get(id(st.student_id));
      const name=esc(person?.name||person?.username||st.name||person?.korean_name||'Student');
      let percentage=null,note='';
      if(kind==='grammar'){
        const done=Number(st.done),total=Number(st.total);
        if(Number.isFinite(done)&&Number.isFinite(total)&&total>0){
          percentage=Math.max(0,Math.min(100,Math.round(100*done/total)));
        }else note=st.passed?'Passed':'Not passed';
      }else if(kind==='word'){
        note=(Number(st.solved)||0)+' correct / '+(Number(st.attempted)||0)+' attempted';
      }else if(kind==='writing-sentence'){
        const done=Number(st.checked),total=Number(st.total);
        if(Number.isFinite(done)&&Number.isFinite(total)&&total>0){
          percentage=Math.max(0,Math.min(100,Math.round(100*done/total)));
        }else note='No verified questions';
      }else{
        percentage=st.completed?100:0;
        note=st.completed?'Completed':'Not completed';
      }
      return '<div class="ghc-student-row"><span class="ghc-student-name">'+name+'</span>'+
       (percentage===null?'<span class="ghc-student-note">'+esc(note)+'</span>':
       '<span class="ghc-student-track" role="progressbar" aria-label="'+name+' progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+percentage+'"><i style="width:'+percentage+'%"></i></span>')+
       '<strong class="ghc-student-pct">'+(percentage===null?'—':percentage+'%')+'</strong></div>';
    }).join('');
    return '<div class="ghc-student-list">'+rows+'</div>';
  }
  function renderOverview(){
   const now=Date.now();
   const overdue=r=>r.due_at&&Date.parse(r.due_at)<now;
   const finished=r=>!r.isActive||overdue(r);
   const owned=rows.filter(r=>scopeName==='all'||id(r.created_by)===teacher);
   const active=owned.filter(r=>!finished(r));
   const complete=owned.filter(finished);
   const stageRows=overviewStage==='complete'?complete:active;
   const filter=overviewFilters[scopeName]||overviewFilters.my;
   const rowClass=row=>String(row._overviewClass||row.class||row.class_name||students.get(id(row.student_id))?.class||'').trim();
   const classOptions=[...new Set(stageRows.map(rowClass).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
   if(filter.className&&!classOptions.includes(filter.className))filter.className='';
   const byClass=stageRows.filter(row=>!filter.className||rowClass(row)===filter.className);
   const nameOf=row=>String(row.app||'Homework')+' · '+String(row.label||'Assignment');
   const assignmentOptions=[...new Set(byClass.map(nameOf))].sort((a,b)=>a.localeCompare(b));
   if(filter.assignment&&!assignmentOptions.includes(filter.assignment))filter.assignment='';
   const visible=byClass.filter(row=>!filter.assignment||nameOf(row)===filter.assignment)
    .sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
   // Group per-student homework by student and class-wide homework by class.
   // Only include verified question progress in aggregate percentages.
   const groupOf=row=>{
    const person=students.get(id(row.student_id));
    const day=assignedDateKey(row.created_at);
     return row.student_id
      ? {key:day+':student:'+id(row.student_id),title:person?(person.name||person.username||person.korean_name||'Student'):'Student name unavailable',sub:person?.class||'Student homework'}
      : {key:day+':class:'+String(row.class||row.class_name||'Unassigned'),title:String(row.class||row.class_name||'Unassigned class'),sub:'Class homework'};
   };
   const grouping=new Map();
   visible.forEach(row=>{const group=groupOf(row);if(!grouping.has(group.key))grouping.set(group.key,{...group,items:[]});grouping.get(group.key).items.push(row)});
   visible.splice(0,visible.length,...[...grouping.values()].flatMap(g=>g.items));
   const groups=[...grouping.values()];
   const groupByKey=new Map(groups.map(g=>[g.key,g]));
   const groupHeader=(g)=>{
    // Only completed homework or corrected-question evidence contributes to the aggregate.
    // Apps without validated completion data remain explicitly untracked.
    const fractions=g.items.map(row=>{
     const outcome=progress.get(id(row.id)),target=Number(row.target_count)||0;
     if(row.app==='내신'&&outcome&&target>0)return Math.min(1,(Number(outcome.done)||0)/target);
     if(row.app==='Grammar Genius'){
      const x=row.source_type==='grammar_books'?grammarBookProgress.get(id(row.id)):classProgress.get(id(row.id));
      if(!x||!(Number(x.students)>0))return null;
      if(row.source_type!=='grammar_books')return Number(x.passed)/Number(x.students);
      const studentRows=Array.isArray(x.student_rows)?x.student_rows:[];
      return studentRows.length?studentRows.reduce((sum,st)=>sum+(Number(st.total)>0?Math.min(Number(st.done)||0,Number(st.total))/Number(st.total):0),0)/studentRows.length:null;
     }
     if(row.app==='Writing Genius'){
      const x=row.list_key==='writing_genius:sentence'?writingSentenceProgress.get(id(row.id)):writingProgress.get(id(row.id));return x&&Number(x.students)>0?(row.list_key==='writing_genius:sentence'?Number(x.progress_percent||0)/100:Number(x.completed)/Number(x.students)):null;
     }
     if(row.app==='Puzzles'){
      const x=puzzleProgress.get(id(row.id));return x&&Number(x.students)>0?Number(x.completed)/Number(x.students):null;
     }
     return null;
    }).filter(x=>x!==null);
    const average=fractions.length?Math.round(100*fractions.reduce((a,b)=>a+b,0)/fractions.length):null;
    const label=average===null?'Progress not available':average+'% · '+fractions.length+'/'+g.items.length+' tracked';
     const eligible=g.items.filter(row=>id(row.created_by)===teacher);
     const selected=eligible.filter(row=>overviewSelections.has(homeworkKey(row))).length;
     const groupSelect=eligible.length?'<label class="ua-group-select"><input type="checkbox" data-ua-select-group="'+esc(g.key)+'" aria-label="Select all homework for '+esc(g.title)+'" '+(selected===eligible.length?'checked':'')+'></label>':'';
    const dueDates=g.items.map(row=>row.due_at).filter(Boolean).sort();
    const dueLabel=dueDates.length?(new Set(dueDates.map(x=>assignedDateKey(x))).size===1?dday(dueDates[0]):'Next '+dday(dueDates[0])):'';
    const teacherLabels=[...new Set(g.items.map(row=>authors.get(id(row.created_by))||'Unknown'))];
    return sharedHomeworkGroupStart({key:g.key,title:g.title,sub:g.items.length+' assignment'+(g.items.length===1?'':'s')+' · '+g.sub,label,average,checkbox:groupSelect,overviewStyle:true,due:dueLabel,teacher:teacherLabels.length===1?teacherLabels[0]+' Teacher':teacherLabels.length+' teachers'});
   };
   const selectable=visible.filter(r=>id(r.created_by)===teacher);
   const checked=selectable.filter(r=>overviewSelections.has(homeworkKey(r))).length;
   host.innerHTML='<div class="ua-scope-tabs" role="tablist" aria-label="Homework status"><button type="button" class="'+(overviewStage==='active'?'active':'')+'" data-ua-stage="active">Active ('+active.length+')</button><button type="button" class="'+(overviewStage==='complete'?'active':'')+'" data-ua-stage="complete">Complete ('+complete.length+')</button></div>'+
     '<div class="ua-overview-filters"><label>Class<select class="control" id="uaOverviewClassFilter" aria-label="Filter homework by class"><option value="">All classes</option>'+classOptions.map(name=>'<option value="'+esc(name)+'"'+(filter.className===name?' selected':'')+'>'+esc(name)+'</option>').join('')+'</select></label>'+
     '<label>Assignment<select class="control" id="uaOverviewAssignmentFilter" aria-label="Filter homework by assignment"><option value="">All assignments</option>'+assignmentOptions.map(name=>'<option value="'+esc(name)+'"'+(filter.assignment===name?' selected':'')+'>'+esc(name)+'</option>').join('')+'</select></label></div>'+
     '<div class="ua-toolbar"><strong>'+(scopeName==='my'?'My homework':'All teachers’ homework')+'</strong>'+
     '<label class="ua-bulk-select"><input type="checkbox" id="uaSelectAll" '+(selectable.length&&checked===selectable.length?'checked':'')+' '+(!selectable.length?'disabled':'')+'> Select all</label>'+
      (overviewStage==='active'?'<button type="button" class="control ua-bulk-icon ua-bulk-complete" id="uaCompleteSelected" title="Complete selected" aria-label="Complete '+checked+' selected assignments" '+(!checked?'disabled':'')+'>'+window.WillenaHomeworkSelection.icons.complete+'<span class="ua-bulk-count">'+checked+'</span></button>':'')+
     '<button type="button" class="control ua-bulk-icon ua-bulk-delete" id="uaDeleteSelected" title="Delete selected" aria-label="Delete '+checked+' selected assignments" '+(!checked?'disabled':'')+'>'+window.WillenaHomeworkSelection.icons.cancel+'<span class="ua-bulk-count">'+checked+'</span></button>'+ 
     '<button type="button" class="control" id="uaOverviewRefresh">Refresh</button></div>'+
     (errors.length?'<p class="ua-note" style="color:#b04b40">Some sources unavailable: '+esc(errors.join('; '))+'</p>':'')+
     '<p id="uaBulkStatus" class="ua-note" role="status" aria-live="polite" hidden></p>'+
     '<div class="ua-homework-cards">'+visible.map((row,i)=>{
      const thisGroup=groupOf(row),previous=i?groupOf(visible[i-1]):null;
      const open=!previous||previous.key!==thisGroup.key;
      const day=assignedDateKey(row.created_at);
       const priorDay=i?assignedDateKey(visible[i-1].created_at):null;
       const divider=day!==priorDay?'<div class="ua-simple-date-divider" role="heading" aria-level="4"><span>'+esc(assignedDateLabel(day))+'</span></div>':'';
       const prefix=(open&&i?'</div></div>':'')+divider+(open?groupHeader(groupByKey.get(thisGroup.key)):'');
      const result=progress.get(id(row.id));
      const done=result?Number(result.done)||0:0;
      const target=Number(row.target_count)||0;
      const pct=target?(done>=target&&(Number(result?.unresolved)||0)>0?99:Math.min(100,Math.round(done/target*100))):null;
      const grammarResult=row.source_type==='grammar_books'?grammarBookProgress.get(id(row.id)):classProgress.get(id(row.id));
      const verifiedGrammarRows=Array.isArray(grammarResult?.student_rows)?grammarResult.student_rows:[];
      const verifiedGrammarPct=verifiedGrammarRows.length&&row.source_type==='grammar_books'
       ?Math.round(verifiedGrammarRows.reduce((sum,st)=>sum+(Number(st.total)>0?100*Math.min(Number(st.done)||0,Number(st.total))/Number(st.total):0),0)/verifiedGrammarRows.length)
       :null;
      const visiblePct=row.app==='Grammar Genius'&&Number(grammarResult?.students)>0
       ?(row.source_type==='grammar_books'?verifiedGrammarPct:Math.round(100*Number(grammarResult.passed)/Number(grammarResult.students))):pct;
      const wordResult=row.app==='Word Genius'?wordClassProgress.get(id(row.id)):null;
      const writingResult=row.app==='Writing Genius'?(row.list_key==='writing_genius:sentence'?writingSentenceProgress.get(id(row.id)):writingProgress.get(id(row.id))):null;
      const puzzleResult=row.app==='Puzzles'?puzzleProgress.get(id(row.id)):null;
      const detail=result?'Correct '+done+'/'+target+' · Attempted '+(result.attempted??'—')+' · First-try accuracy '+(result.accuracy_percent??'—')+'% · 오답 remaining '+(result.unresolved??'—')
        :grammarResult?grammarResult.passed+'/'+grammarResult.students+' students passed'
        :wordResult?wordResult.started+'/'+wordResult.students+' students attempted (not a pass rate)'
        :writingResult?(row.list_key==='writing_genius:sentence'?Number(writingResult.checked||0)+'/'+Number(writingResult.total_questions||0)+' questions checked · '+Number(writingResult.progress_percent||0)+'%':writingResult.completed+'/'+writingResult.students+' submitted')
        :puzzleResult?puzzleResult.completed+'/'+puzzleResult.students+' completed puzzles'
        :'Completion data not available for this app';
      const status=!row.isActive?(row.status==='cancelled'?'Removed':'Closed'):overdue(row)?'Past due':'Active';
      const ownedByMe=id(row.created_by)===teacher;
      return prefix+'<article class="ua-homework-card" data-ua-card="'+i+'"><button type="button" class="ua-homework-detail" data-ua-detail="'+i+'" aria-expanded="false"><span><b>'+esc(row.app)+'</b> · '+esc(row.label||'Homework')+'</span><small>'+esc((()=>{const student=students.get(id(row.student_id));return student?[(student.name||student.username||student.korean_name),student.class||''].filter(Boolean).join(' · '):(row.class||row.class_name||'Student name unavailable');})())+' · '+esc(authors.get(id(row.created_by))||'Unknown')+' · '+esc(dday(row.due_at))+'</small><strong>'+esc(status)+(visiblePct===null?'':' · '+visiblePct+'%')+' ▾</strong></button>'+
        '<div class="ua-homework-expanded ghc-overview-expanded" id="uaExpanded'+i+'" hidden><p class="ghc-overview-detail">'+esc(detail)+'</p>'+
        (grammarResult?.student_rows?overviewStudentProgress(grammarResult.student_rows,{kind:'grammar'}):'')+
        (wordResult?.student_rows?overviewStudentProgress(wordResult.student_rows,{kind:'word'}):'')+
        (writingResult?.student_rows?overviewStudentProgress(writingResult.student_rows,{kind:row.list_key==='writing_genius:sentence'?'writing-sentence':'completion'}):'')+
        (puzzleResult?.student_rows?overviewStudentProgress(puzzleResult.student_rows,{kind:'completion'}):'')+'</div>'+
        (ownedByMe?'<div class="ua-delete-area"><button type="button" class="control" data-ua-edit="'+i+'" style="border:1px solid #afd1d5;color:#247f88;background:#fff;padding:6px 12px;font-size:12px">Edit</button></div>':'')+
        (ownedByMe?'<div class="ua-homework-actions"><label class="ua-homework-checkbox"><input type="checkbox" data-ua-select="'+i+'" aria-label="Select homework" '+(overviewSelections.has(homeworkKey(row))?'checked':'')+'></label>'+(overviewStage==='active'?'<button type="button" data-ua-complete="'+i+'" aria-label="Mark homework complete" title="Complete">✓</button>':'')+'</div>':'')+'</article>';
     }).join('')+(visible.length?'</div></div>':'')+'</div>'+(visible.length?'':'<p class="ua-empty">No homework in this section.</p>')+
     '<p class="ua-note">Past-due homework appears in Complete automatically. ✓ closes one assignment; check boxes and Complete selected close several. Student attempts and results remain preserved.</p>';
   attachHomeworkGroupToggles(host);
   host.querySelector('#uaOverviewClassFilter').onchange=event=>{filter.className=event.target.value;filter.assignment='';overviewSelections.clear();renderOverview()};
   host.querySelector('#uaOverviewAssignmentFilter').onchange=event=>{filter.assignment=event.target.value;overviewSelections.clear();renderOverview()};
   host.querySelector('#uaOverviewRefresh').onclick=()=>loadOverview(scopeName,true);
   host.querySelectorAll('[data-ua-stage]').forEach(button=>button.onclick=()=>{overviewStage=button.dataset.uaStage;overviewSelections.clear();renderOverview()});
   host.querySelectorAll('[data-ua-detail]').forEach(button=>button.onclick=()=>{
    const index=Number(button.dataset.uaDetail);
    const panel=host.querySelector('#uaExpanded'+index);
    if(!panel)return;
    panel.hidden=!panel.hidden;
    button.setAttribute('aria-expanded',String(!panel.hidden));
   });
      function updateSelectionUI(){
    const selectedCount=selectable.filter(r=>overviewSelections.has(homeworkKey(r))).length;
    const bulk=host.querySelector('#uaCompleteSelected');
    if(bulk){bulk.disabled=selectedCount===0;bulk.setAttribute('aria-label','Complete '+selectedCount+' selected assignments');const count=bulk.querySelector('.ua-bulk-count');if(count)count.textContent=selectedCount;}
    const deleteBulk=host.querySelector('#uaDeleteSelected');if(deleteBulk){deleteBulk.disabled=selectedCount===0;deleteBulk.setAttribute('aria-label','Delete '+selectedCount+' selected assignments');const count=deleteBulk.querySelector('.ua-bulk-count');if(count)count.textContent=selectedCount;}
    host.querySelectorAll('[data-ua-select-group]').forEach(box=>{
     const eligible=(groupByKey.get(box.dataset.uaSelectGroup)?.items||[]).filter(row=>id(row.created_by)===teacher);
     const count=eligible.filter(row=>overviewSelections.has(homeworkKey(row))).length;
     box.checked=eligible.length>0&&count===eligible.length;
     box.indeterminate=count>0&&count<eligible.length;
    });
    const allBox=host.querySelector('#uaSelectAll');
    if(allBox){allBox.checked=selectable.length>0&&selectedCount===selectable.length;allBox.indeterminate=selectedCount>0&&selectedCount<selectable.length;}
   }
   host.querySelectorAll('[data-ua-select-group]').forEach(box=>box.onchange=()=>{
     (groupByKey.get(box.dataset.uaSelectGroup)?.items||[]).filter(row=>id(row.created_by)===teacher).forEach(row=>{
      if(box.checked)overviewSelections.add(homeworkKey(row));else overviewSelections.delete(homeworkKey(row));
     });
     host.querySelectorAll('[data-ua-select]').forEach(child=>{
      child.checked=overviewSelections.has(homeworkKey(visible[Number(child.dataset.uaSelect)]));
     });
     updateSelectionUI();
    });
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
   host.querySelectorAll('[data-ua-edit]').forEach(button=>button.onclick=async()=>{
     const row=visible[Number(button.dataset.uaEdit)];if(!row)return;
     button.disabled=true;
     try{await editHomework(row,teacher,()=>renderOverview())}
     catch(err){const n=host.querySelector('#uaBulkStatus');n.hidden=false;n.textContent='Edit unavailable: '+err.message}
     finally{button.disabled=false}
   });
   const bulkDelete=host.querySelector('#uaDeleteSelected');
   if(bulkDelete)bulkDelete.onclick=async()=>{
     const chosen=selectable.filter(row=>overviewSelections.has(homeworkKey(row)));
     if(!chosen.length)return;
     if(!confirm('Delete/remove '+chosen.length+' selected assignment'+(chosen.length===1?'':'s')+'? This cannot be undone for deletable records.'))return;
     bulkDelete.disabled=true;
     let succeeded=0;const failed=[];
     for(const row of chosen){
       try{await deleteHomework(row);const index=rows.indexOf(row);if(index!==-1)rows.splice(index,1);overviewSelections.delete(homeworkKey(row));succeeded++}
       catch(e){failed.push((row.label||row.id)+': '+e.message)}
     }
     renderOverview();const status=host.querySelector('#uaBulkStatus');if(status){status.hidden=false;status.textContent=succeeded+' removed.'+(failed.length?' '+failed.length+' failed: '+failed.slice(0,2).join('; '):'')}
   };
   host.querySelectorAll('[data-ua-delete]').forEach(button=>button.onclick=async()=>{
    const row=visible[Number(button.dataset.uaDelete)];
    if(!row||id(row.created_by)!==teacher)return;
    const soft=['grammar_foundation_homework','sentence_genius_homework'].includes(row._table);
    const action=soft?'Remove':'Delete';
    if(!confirm(action+' "'+row.label+'" from '+(row.class||row.class_name||'this class')+'? '+(soft?'It will disappear from active homework; recorded work is retained.':'This cannot be undone.')))return;
    button.disabled=true;
    const status=host.querySelector('#uaBulkStatus');status.hidden=false;status.textContent=action+' in progress…';
    try{
      await deleteHomework(row);
      const index=rows.indexOf(row);if(index!==-1)rows.splice(index,1);
      overviewSelections.delete(homeworkKey(row));renderOverview();
      const msg=host.querySelector('#uaBulkStatus');if(msg){msg.hidden=false;msg.textContent=soft?'Assignment removed from active homework.':'Assignment deleted.'}
    }catch(error){button.disabled=false;status.textContent=action+' failed: '+error.message}
   });
   host.querySelectorAll('[data-ua-complete]').forEach(button=>button.onclick=()=>{
    const row=visible[Number(button.dataset.uaComplete)];
    completeRows([row]);
   });
   const bulk=host.querySelector('#uaCompleteSelected');
   if(bulk)bulk.onclick=()=>completeRows(selectable.filter(row=>overviewSelections.has(homeworkKey(row))));
  }
  renderOverview();
  overviewPerf.lastLoadMs=Math.round(performance.now()-loadStarted);
  overviewPerf.lastCompletedAt=new Date().toISOString();
 }catch(e){if(generation===overviewGeneration&&host.isConnected)host.innerHTML='<p class="ua-empty">Could not load homework: '+esc(e.message)+'</p>'}
}
async function loadCalendar(){
 const host=document.querySelector('#uaCalendar');if(!host)return;
 host.textContent='Loading assignment calendar…';
 const sources=[
  ['homework_assignments','id,title,class,due_at,created_by,list_key,list_meta'],
  ['grammar_foundation_homework','id,module_title,stage_title,class_name,due_at,created_by'],
  ['sentence_genius_homework','id,title,class_name,due_at,created_by'],
  ['test_prep_tasks','id,title,lesson,practice_type,student_id,due_at,created_by']
 ];
 let month=new Date();month.setDate(1);
 const entries=[],errors=[];
 const settled=await Promise.allSettled(sources.map(async ([table,fields])=>{
  const data=await get(table+'?select='+encodeURIComponent(fields)+'&due_at=not.is.null&order=due_at.asc&limit=1000');
  return data.map(x=>{
   let app=table==='test_prep_tasks'?'내신':table==='grammar_foundation_homework'?'Grammar Genius':table==='sentence_genius_homework'?'Sentence Genius':'Word Genius';
   if(table==='homework_assignments'){
    const tag=String(x.list_meta?.creative_type||x.list_meta?.app||x.list_key||'').toLowerCase();
    if(tag.includes('writing'))app='Writing Genius';else if(tag.includes('puzzle'))app='Puzzles';else if(tag.includes('sentence'))app='Sentence Genius';
   }
   return {...x,app,label:x.title||x.module_title||x.lesson||'Homework',className:x.class||x.class_name||'',at:x.due_at};
  });
 }));
 settled.forEach((r,i)=>{if(r.status==='fulfilled')entries.push(...r.value);else errors.push(sources[i][0])});
 const templates=[];
 for(const [table,foreignKey] of [['homework_recurring_schedules','source_assignment_id'],['homework_recurring_app_schedules','source_id']]){
  try{
   const list=await get(table+'?select=id,'+foreignKey+',next_due_at,interval_days,active&active=eq.true');
   for(const item of list){
    const source=entries.find(x=>id(x.id)===id(item[foreignKey]));
    if(source)templates.push({source,first:new Date(item.next_due_at),days:Number(item.interval_days)||7,id:item.id});
   }
  }catch(_){}
 }
 const dateKey=x=>{const d=new Date(x);return Number.isNaN(d.getTime())?'':d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
 const assignmentsForDate=key=>{
  const found=entries.filter(x=>dateKey(x.at)===key);
  const target=new Date(key+'T12:00:00');
  for(const rule of templates){
   const first=new Date(rule.first.getFullYear(),rule.first.getMonth(),rule.first.getDate(),12);
   const delta=Math.round((target-first)/86400000);
   if(delta>=0&&delta%(rule.days)===0){
    found.push({...rule.source,id:'repeat:'+rule.id+':'+key,at:key+'T23:59:59',label:rule.source.label+' ↻'});
   }
  }
  return found;
 };
 function renderCalendar(){
  const year=month.getFullYear(),m=month.getMonth(),days=new Date(year,m+1,0).getDate();
  const first=new Date(year,m,1).getDay();
  const today=dateKey(new Date());
  let cells='';
  for(let i=0;i<first;i++)cells+='<div class="ua-calendar-empty"></div>';
  for(let n=1;n<=days;n++){
   const key=year+'-'+String(m+1).padStart(2,'0')+'-'+String(n).padStart(2,'0');
   const matches=assignmentsForDate(key);
   cells+='<button type="button" class="ua-calendar-day'+(key===today?' is-today':'')+'" data-cal-date="'+key+'"><b>'+n+'</b>'+(matches.length?'<span>'+matches.length+' homework</span>':'')+'</button>';
  }
  host.innerHTML='<div class="ua-calendar-toolbar"><button class="control" type="button" id="calPrev">‹</button><strong>'+year+' · '+String(m+1).padStart(2,'0')+'</strong><button class="control" type="button" id="calNext">›</button><button class="control" type="button" id="calToday">Today</button></div>'+
   (errors.length?'<p class="ua-note">Some sources unavailable: '+esc(errors.join(', '))+'</p>':'')+
   '<div class="ua-calendar-grid">'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>'<div class="ua-calendar-weekday">'+d+'</div>').join('')+cells+'</div><div id="uaCalendarDay" class="ua-calendar-results"><p>Select a day to see its assignments.</p></div>';
  host.querySelector('#calPrev').onclick=()=>{month.setMonth(month.getMonth()-1);renderCalendar()};
  host.querySelector('#calNext').onclick=()=>{month.setMonth(month.getMonth()+1);renderCalendar()};
  host.querySelector('#calToday').onclick=()=>{month=new Date();month.setDate(1);renderCalendar()};
  host.querySelectorAll('[data-cal-date]').forEach(b=>b.onclick=()=>{
   host.querySelectorAll('[data-cal-date]').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');
   const matches=assignmentsForDate(b.dataset.calDate);
   host.querySelector('#uaCalendarDay').innerHTML='<h4>'+esc(b.dataset.calDate)+' · '+matches.length+' assignments</h4>'+
    (matches.length?matches.map(x=>'<article class="ua-calendar-item"><b>'+esc(x.app)+' · '+esc(x.label)+'</b><small>'+esc(x.className)+' · '+esc(dday(x.at))+'</small></article>').join(''):'<p>No assignments on this date.</p>');
  });
 }
 renderCalendar();
}
window.UniversalAssignmentTracker={load,loadOverview,loadCalendar};
})();