/* Free Talking Genius: shared Teachers Dashboard mission workspace. Speaking only. */
(()=>{'use strict';
const OP='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/';
const OPKEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co/rest/v1/';
const CONTENTKEY='sb_publishable_G-FYhHfDL4OGdL892gY1Zg_epdbEeqO';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const state={books:null,classes:null,unitCache:new Map(),assignments:[],progress:new Map(),classFilter:'all',history:false,view:'progress',loading:false};
const isFT=a=>a.list_meta?.source_app==='free_talking_genius'||String(a.list_key||'').startsWith('free_talking:');
const token=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
async function refreshToken(){
 const f=window.WillenaAPI?.fetch||fetch;
 const response=await f('/.netlify/functions/supabase_auth?action=refresh',{credentials:'include'});
 const result=await response.json().catch(()=>({}));
 if(!response.ok||!result.access_token)throw Error('Teacher login expired');
 window.WillenaAPI?.setLocalTokens?.(result.access_token,result.refresh_token||'');
 return result.access_token;
}
async function db(path,body){
 const send=async t=>fetch(OP+path,{method:'POST',cache:'no-store',headers:{apikey:OPKEY,Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify(body)});
 let r=await send(token()||await refreshToken());
 if(r.status===401)r=await send(await refreshToken());
 const data=await r.json().catch(()=>null);
 if(!r.ok)throw Error(data?.message||data?.error||'Teacher progress request failed ('+r.status+')');
 return data;
}
async function catalog(path){
 const r=await fetch(CONTENT+path,{headers:{apikey:CONTENTKEY,Authorization:'Bearer '+CONTENTKEY},cache:'no-store'});
 if(!r.ok)throw Error('Textbook catalog unavailable ('+r.status+')');
 return r.json();
}
async function homework(action,body=null){
 const path='/.netlify/functions/homework_api?action='+action;
 const url=window.WillenaAPI?.getApiUrl?.(path)||path;
 const r=await fetch(url,{method:body?'POST':'GET',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json',...(token()?{Authorization:'Bearer '+token()}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const d=await r.json().catch(()=>({}));if(!r.ok||d.success!==true)throw Error(d.error||'Homework request failed');
 return d;
}
async function loadBase(){
 if(!state.classes){
  const data=await db('rpc/get_sentence_genius_teacher_classes',{});
  if(data?.success!==true||!Array.isArray(data.classes))throw Error('Teacher classes unavailable');
  state.classes=[...new Set(data.classes.map(x=>String(x.name||'').trim()).filter(Boolean))].sort();
 }
 if(!state.books){
  const all=await catalog('content_books?select=id,title,status,public_level&status=in.(published,review)&order=title.asc&limit=500');
  state.books=(Array.isArray(all)?all:[]).filter(x=>x.id);
 }
}
async function units(book){
 if(state.unitCache.has(book))return state.unitCache.get(book);
 const [unitRows,questions]=await Promise.all([
  catalog('content_units?select=id,title,unit_number&book_id=eq.'+encodeURIComponent(book)+'&status=in.(published,review)&order=unit_number.asc&limit=150'),
  catalog('free_talking_questions?select=unit_id,question_number&book_id=eq.'+encodeURIComponent(book)+'&is_published=eq.true&limit=1200')
 ]);
 const counts=new Map();for(const q of questions||[])counts.set(String(q.unit_id),(counts.get(String(q.unit_id))||0)+1);
 const supported=(unitRows||[]).map(u=>({...u,count:counts.get(String(u.id))||0})).filter(u=>u.count>=8);
 state.unitCache.set(book,supported);return supported;
}
const unitUrl=a=>'https://students.willenaenglish.com/students/free-talking-genius/?book='+encodeURIComponent(a.list_meta?.book_id||'')+'&unit='+encodeURIComponent(a.list_meta?.unit_number||'')+'&homework='+encodeURIComponent(a.id);
const fmtDate=s=>{if(!s)return '';const d=new Date(s);return Number.isNaN(+d)?'':d.toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'})};
const isCurrent=a=>a.active!==false&&a.status!=='ended'&&!a.ended_at&&(!a.due_at||new Date(a.due_at)>=new Date());
function stats(a){
 const p=state.progress.get(a.id);const students=p?.students||[];
 const avg=students.length?Math.round(students.reduce((sum,s)=>sum+Number(s.percent||0),0)/students.length):null;
 const completed=students.filter(x=>x.complete).length,notStarted=students.filter(x=>!x.passed).length;
 return {students,avg,completed,notStarted};
}
async function loadAssignments(){
 const d=await homework('list_assignments');
 state.assignments=(d.assignments||[]).filter(isFT);
 const data=await db('rpc/teacher_free_talking_mission_progress_v1',{p_assignment_id:null});
 state.progress=new Map((Array.isArray(data)?data:[]).map(x=>[String(x.assignment_id),x]));
}
function renderManage(host){
 if(!host)return;
 const cards=window.WillenaGeniusHomeworkCard;
 if(!cards){host.textContent='Shared Word Genius cards unavailable. Refresh the Teachers Dashboard.';return}
 let rows=state.assignments.filter(a=>state.history?!isCurrent(a):isCurrent(a));
 if(state.classFilter!=='all')rows=rows.filter(a=>a.class===state.classFilter);
 const classes=[...new Set(state.assignments.map(a=>a.class).filter(Boolean))].sort();
 host.innerHTML='<div class="gf-hw-toolbar"><div class="assignment-status-tabs">'+
  '<button class="assignment-status-tab'+(!state.history?' active':'')+'" type="button" data-ft-period="current">Current</button>'+
  '<button class="assignment-status-tab'+(state.history?' active':'')+'" type="button" data-ft-period="history">History</button></div>'+
  '<select class="control" id="ftTeacherClassFilter"><option value="all">All classes</option>'+classes.map(c=>'<option value="'+esc(c)+'"'+(state.classFilter===c?' selected':'')+'>'+esc(c)+'</option>').join('')+'</select>'+
  '<button type="button" class="control" data-ft-refresh>Refresh</button></div>'+
  '<div class="ua-genius-manage-list">'+(rows.length?cards.groupByDate(rows,a=>{
   const p=stats(a),body=cards.progressPanel({students:p.students,average:p.avg,completed:p.completed,notStarted:p.notStarted,label:'Speaking · 8 questions'});
   const actions='<div class="ua-actions">'+(state.history
    ?'<button class="control ua-primary" type="button" data-ft-restore="'+esc(a.id)+'">Restore to Current</button>'
    :'<button class="control" type="button" data-ft-end="'+esc(a.id)+'">End mission</button>')+'</div>';
   return cards.card({id:a.id,className:a.class,task:a.title,createdBy:a.created_by,teacher:a.teacher_name||'Teacher',dueAt:a.due_at,progressLabel:'Student progress',progressPercent:p.avg,body,action:actions,qrUrl:unitUrl(a)});
  }):'<div class="ua-empty">No '+(state.history?'previous':'current')+' Free Talking speaking missions.</div>')+'</div>';
 for(const a of rows){const p=stats(a);cards.updateRing(a.id,p.avg,host)}
 $$('[data-ft-period]',host).forEach(b=>b.onclick=()=>{state.history=b.dataset.ftPeriod==='history';renderManage(host)});
 $('#ftTeacherClassFilter',host).onchange=e=>{state.classFilter=e.target.value;renderManage(host)};
 $('[data-ft-refresh]',host).onclick=()=>void showManage(host,true);
 $$('[data-ft-end],[data-ft-restore]',host).forEach(b=>b.onclick=async()=>{
  const id=b.dataset.ftEnd||b.dataset.ftRestore,restoring=!!b.dataset.ftRestore;
  if(!restoring&&!confirm('End this mission? Students keep their speaking progress.'))return;
  b.disabled=true;
  try{
   const source=state.assignments.find(a=>a.id===id);
   const patch=restoring?{active:true,status:'active',ended_at:null}:{active:false,status:'ended',ended_at:new Date().toISOString()};
   if(restoring&&source?.due_at&&Date.parse(source.due_at)<Date.now()){
    const next=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
    const day=prompt('This mission is overdue. Choose a new due date (YYYY-MM-DD):',next);
    if(!day){b.disabled=false;return}
    const due=new Date(day+'T23:59:59+09:00');
    if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(day)||!Number.isFinite(+due)||due.getTime()<=Date.now())throw Error('Choose a valid future due date');
    patch.due_at=due.toISOString();
   }
   const t=token()||await refreshToken();
   const r=await fetch(OP+'homework_assignments?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{apikey:OPKEY,Authorization:'Bearer '+t,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(patch)});
   const data=await r.json().catch(()=>null);
   if(!r.ok||!Array.isArray(data)||data.length!==1)throw Error(data?.message||'Assignment update not confirmed');
   await showManage(host,true);
   window.UniversalAssignmentTracker?.loadOverview?.('my');
  }catch(e){alert('Mission could not be updated: '+e.message);b.disabled=false}
 });
 window.WillenaGeniusHomeworkCard.hydrateTeachers?.(host);
}
async function showManage(host,refresh=false){
 if(!host)return;
 host.innerHTML='<div class="ua-empty">Loading Free Talking speaking missions…</div>';
 try{if(refresh||!state.assignments.length)await loadAssignments();if(host.isConnected)renderManage(host)}
 catch(e){if(host.isConnected)host.innerHTML='<div class="ua-empty">Could not load missions: '+esc(e.message)+' <button class="control" data-retry-ft>Retry</button></div>';
  $('[data-retry-ft]',host)?.addEventListener('click',()=>void showManage(host,true))}
}
async function showCreate(host){
 if(!host)return;
 host.innerHTML='<div class="ua-empty">Loading assigned books…</div>';
 try{await loadBase()}catch(e){host.innerHTML='<div class="ua-empty">'+esc(e.message)+'</div>';return}
 if(!host.isConnected)return;
 host.innerHTML='<form id="ftTeacherAssignForm" class="ua-feature ua-genius-assign gb-form">'+
 '<h3>Assign Free Talking Genius Mission</h3>'+
 '<label>Class <select class="control" name="klass" required><option value="">Choose class</option>'+state.classes.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('')+'</select></label>'+
 '<label>Textbook <select class="control" name="book" required><option value="">Choose class first</option></select></label>'+
 '<p class="ua-note" id="ftTeacherBookNotice">Choose a class to see assigned textbooks.</p>'+
 '<div class="gb-select-head"><strong>Speaking units (8 published questions required)</strong><label><input type="checkbox" id="ftTeacherAllUnits"> All</label></div>'+
 '<div class="gb-chapter-list" id="ftTeacherUnits">Choose a textbook.</div>'+
 '<div class="gf-hw-form-grid"><label>Available from <input class="control" type="date" name="start" required></label>'+
 '<label>Due date <input class="control" type="date" name="due" required></label></div>'+
 '<label class="ua-fresh-session"><input type="checkbox" name="fresh"><span><strong>Fresh Session</strong><small>Default off: free practice and assigned missions share the same progress.</small></span></label>'+
 '<div class="gf-hw-pre-assignment"><div id="ftTeacherPrevious" aria-live="polite">Choose class, book and units to preview progress.</div></div>'+
 '<div class="gf-hw-footer"><button class="control ua-primary" type="submit" id="ftTeacherSubmit" disabled>Assign Mission</button><span id="ftTeacherNotice" role="status"></span></div></form>';
 const form=$('form',host),klass=form.elements.klass,book=form.elements.book,notice=$('#ftTeacherNotice',host),unitList=$('#ftTeacherUnits',host);
 const now=new Date(),next=new Date(now.valueOf()+7*86400000);
 const localDate=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
 form.elements.start.value=localDate(now);form.elements.due.value=localDate(next);
 let bookEpoch=0,unitsEpoch=0,previewEpoch=0;
 const checked=()=>$$('[data-ft-unit]:checked',unitList).map(x=>x.value);
 const status=()=>{$('#ftTeacherSubmit',host).disabled=!klass.value||!book.value||!checked().length||new Date(form.elements.due.value)<new Date(form.elements.start.value)};
 const preview=async()=>{
  const stamp=++previewEpoch,selected=checked(),box=$('#ftTeacherPrevious',host);
  status();if(!selected.length||!klass.value||!book.value){box.textContent='Select a class, book and units.';return}
  box.textContent='Checking existing speaking mastery…';
  try{
   const data=await db('rpc/teacher_free_talking_mission_progress_v1',{p_assignment_id:null});
   if(stamp!==previewEpoch)return;
   const matched=(Array.isArray(data)?data:[]).filter(x=>x.class===klass.value&&x.book_id===book.value&&selected.includes(x.unit_id));
   box.innerHTML=matched.length?'<strong>Previous missions for these units</strong>'+matched.map(x=>{
    const students=x.students||[],done=students.filter(s=>s.complete).length;
    return '<p>Unit '+esc((state.unitCache.get(book.value)||[]).find(u=>u.id===x.unit_id)?.unit_number||'')+' · '+done+'/'+students.length+' completed</p>';
   }).join(''):'<p>No previous assigned mission for these units. Existing free-practice mastery will still count.</p>';
  }catch(e){if(stamp===previewEpoch)box.textContent='Preview unavailable: '+e.message}
 };
 klass.addEventListener('change',async()=>{
  const stamp=++bookEpoch;book.replaceChildren(new Option('Loading assigned books…',''));unitList.textContent='Choose a textbook.';status();
  if(!klass.value)return;
  try{
   const ids=await db('rpc/teacher_assigned_books_for_class_v1',{p_class:klass.value});
   if(stamp!==bookEpoch)return;
   const assigned=new Set((Array.isArray(ids)?ids:[]).map(x=>String(x.id)));
   book.replaceChildren(new Option('Choose textbook',''));
   for(const b of state.books.filter(x=>assigned.has(String(x.id))))book.add(new Option(b.title,b.id));
   book.add(new Option('Other book — browse all textbooks','__other__'));
   $('#ftTeacherBookNotice',host).textContent='Assigned textbooks first. Other book opens the full catalog.';
  }catch(e){if(stamp===bookEpoch)$('#ftTeacherBookNotice',host).textContent=e.message}
 });
 book.addEventListener('change',async()=>{
  const stamp=++unitsEpoch;unitList.textContent='Loading published speaking questions…';status();
  if(book.value==='__other__'){
   book.replaceChildren(new Option('Choose textbook',''));
   for(const b of state.books)book.add(new Option(b.title,b.id));
   return;
  }
  if(!book.value){unitList.textContent='Choose a textbook.';return}
  try{
   const rows=await units(book.value);if(stamp!==unitsEpoch)return;
   unitList.innerHTML=rows.length?rows.map(u=>'<label class="gb-chapter"><input type="checkbox" data-ft-unit value="'+esc(u.id)+'"><span>Unit '+esc(u.unit_number)+' · '+esc(u.title||'')+' · '+u.count+' questions</span></label>').join(''):'<div class="ua-empty">No units with 8 published Free Talking questions yet.</div>';
   $$('[data-ft-unit]',unitList).forEach(x=>x.onchange=()=>void preview());
   status();
  }catch(e){if(stamp===unitsEpoch)unitList.textContent=e.message}
 });
 $('#ftTeacherAllUnits',host).onchange=e=>{$$('[data-ft-unit]',unitList).forEach(x=>x.checked=e.target.checked);void preview()};
 form.elements.start.addEventListener('change',status);form.elements.due.addEventListener('change',status);
 form.onsubmit=async e=>{
  e.preventDefault();if(state.loading)return;
  const selected=checked(),data=state.unitCache.get(book.value)||[];
  if(!klass.value||!book.value||!selected.length){notice.textContent='Choose class, textbook and units.';return}
  const starts=new Date(form.elements.start.value+'T00:00:00+09:00'),due=new Date(form.elements.due.value+'T23:59:59+09:00');
  if(!Number.isFinite(+starts)||!Number.isFinite(+due)||starts>due){notice.textContent='Check the assignment dates.';return}
  const chosen=data.filter(u=>selected.includes(u.id));
  if(chosen.length!==selected.length||chosen.some(u=>u.count<8)){notice.textContent='One or more units are not ready.';return}
  state.loading=true;const submit=$('#ftTeacherSubmit',host);submit.disabled=true;let done=0;
  try{
   const groupId='ft-'+Date.now().toString(36);
   for(const u of chosen){
    const title=(state.books.find(x=>x.id===book.value)?.title||'Free Talking')+' · Unit '+u.unit_number;
    const payload={class:klass.value,title,list_title:title,description:'Free Talking Genius · Speaking (8 questions)',list_key:'free_talking:'+book.value+':'+u.id,list_meta:{
      source_app:'free_talking_genius',source_type:'free_talking_genius',app:'free_talking_genius',
      book_id:book.value,unit_id:u.id,unit_number:u.unit_number,required_modes:['speaking'],
      question_count:8,pass_score:8,fresh_session:form.elements.fresh.checked,
      assignment_group_id:groupId,assignment_group_title:title
     },start_at:starts.toISOString(),due_at:due.toISOString(),goal_type:'completions',goal_value:8};
    await homework('create_assignment',payload);done++;
   }
   notice.textContent='Assigned '+done+' speaking unit'+(done===1?'':'s')+' to '+klass.value+'.';
   window.dispatchEvent(new CustomEvent('willena:assignment-created',{detail:{message:done+' Free Talking speaking missions · '+klass.value}}));
   window.WillenaAssignmentsV1?.reload?.();
   await loadAssignments();
  }catch(e){notice.textContent='Saved '+done+' of '+chosen.length+' units. '+e.message}
  finally{state.loading=false;status()}
 };
}
async function showWorkspace(host,sub='manage',refresh=false){
 if(!host)return;
 if(sub==='create')return showCreate(host);
 return showManage(host,refresh);
}
function mountDashboard(){
 const rail=$('.rail'),mobile=$('.mobile-tabs'),main=$('main');
 if(!main)return;
 const install=(parent,type)=>{
  if(!parent||$('[data-view="free-talking-genius"]',parent))return;
  const button=document.createElement('button');button.type='button';button.dataset.view='free-talking-genius';
  if(type==='rail'){button.className='nav';button.innerHTML='<span class="nav-icon">FT</span><span>Free Talking Genius</span>'}
  else{button.className='mobile-tab';button.innerHTML='<b>FT</b>Free Talking'}
  const target=$('[data-view="grammar-foundations"]',parent)||$('[data-view="sentence-genius"]',parent);
  parent.insertBefore(button,target||null);
  button.onclick=()=>openView();
 };
 install(rail,'rail');install(mobile,'mobile');
 if(!$('#view-free-talking-genius')){
  const view=document.createElement('section');view.id='view-free-talking-genius';view.className='view';
  view.innerHTML='<div class="page-head"><div><h1>Free Talking Genius</h1><div class="panel-sub">Speaking progress · 8-question missions</div></div></div>'+
   '<div class="vocab-hub-tabs"><button type="button" class="vocab-hub-tab active" data-ft-view="progress">General Progress</button><button type="button" class="vocab-hub-tab" data-ft-view="assignments">Assignments</button></div>'+
   '<div class="panel" id="ftTeacherPanel"></div>';
  main.appendChild(view);
  $$('[data-ft-view]',view).forEach(b=>b.onclick=()=>{state.view=b.dataset.ftView;void renderDashboard()});
 }
}
async function showGeneralProgress(host){
 if(!host)return;
 host.innerHTML='<div class="ua-empty">Loading Free Talking speaking activity…</div>';
 try{
  const [rows]=await Promise.all([
   db('rpc/teacher_free_talking_general_progress_v1',{}),
   loadBase()
  ]);
  if(!host.isConnected)return;
  const cards=window.WillenaGeniusHomeworkCard;
  if(!cards)throw Error('Shared Word Genius progress component unavailable');
  const items=Array.isArray(rows)?rows:[];
  const classes=[...new Set(items.map(x=>x.class).filter(Boolean))].sort();
  const selected=state.classFilter==='all'?items:items.filter(x=>x.class===state.classFilter);
  const groups=new Map();
  for(const row of selected){
   const key=[row.class,row.book_id,row.unit_id].join(':');
   if(!groups.has(key))groups.set(key,{class:row.class,book_id:row.book_id,unit_id:row.unit_id,
    unit_number:row.unit_number,students:[],created_at:row.last_activity,title:''});
   const group=groups.get(key);group.students.push(row);
   if(String(row.last_activity||'')>String(group.created_at||''))group.created_at=row.last_activity;
  }
  const output=[...groups.values()].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
  const bookTitles=new Map((state.books||[]).map(b=>[String(b.id),b.title]));
  host.innerHTML='<div class="gf-hw-toolbar">'+
   '<label>Class <select class="control" id="ftTeacherGeneralClass"><option value="all">All classes</option>'+classes.map(c=>'<option value="'+esc(c)+'"'+(state.classFilter===c?' selected':'')+'>'+esc(c)+'</option>').join('')+'</select></label>'+
   '<button type="button" class="control" data-ft-general-refresh>Refresh</button></div>'+
   '<p class="ua-note">All speaking practice, including free sessions · Passing score 8/10 · 8 questions per Golden Unit</p>'+
   '<div class="ua-genius-manage-list">'+(output.length?cards.groupByDate(output,g=>{
    const students=g.students||[];
    const average=Math.round(students.reduce((sum,x)=>sum+Number(x.percent||0),0)/students.length);
    const book=bookTitles.get(String(g.book_id))||'Textbook';
    return cards.card({id:[g.class,g.book_id,g.unit_id].join(':'),className:g.class,
     task:book+' · Unit '+g.unit_number,teacher:'Free Talking Genius',createdBy:'',
     dueAt:null,progressPercent:average,progressLabel:'Student speaking progress',
     body:cards.progressPanel({students,average,completed:students.filter(x=>x.complete).length,
      notStarted:students.filter(x=>!x.passed).length,label:'Speaking · 8 questions'})
    });
   }):'<div class="ua-empty">No Free Talking speaking attempts recorded'+(state.classFilter==='all'?'':' for this class')+'.</div>')+'</div>';
  for(const g of output){
   const average=Math.round(g.students.reduce((sum,x)=>sum+Number(x.percent||0),0)/g.students.length);
   cards.updateRing([g.class,g.book_id,g.unit_id].join(':'),average,host);
  }
  $('#ftTeacherGeneralClass',host)?.addEventListener('change',e=>{state.classFilter=e.target.value;void showGeneralProgress(host)});
  $('[data-ft-general-refresh]',host)?.addEventListener('click',()=>void showGeneralProgress(host));
 }catch(e){
  if(host.isConnected){host.innerHTML='<div class="ua-empty">Speaking activity unavailable: '+esc(e.message)+' <button type="button" class="control" data-ft-general-retry>Retry</button></div>';
   $('[data-ft-general-retry]',host)?.addEventListener('click',()=>void showGeneralProgress(host))}
 }
}
async function renderDashboard(){
 const view=$('#view-free-talking-genius'),host=$('#ftTeacherPanel');if(!view||!host)return;
 $$('[data-ft-view]',view).forEach(b=>b.classList.toggle('active',b.dataset.ftView===state.view));
 if(state.view==='progress'){
  host.innerHTML='<div class="panel-title">General Speaking Progress</div><div class="panel-sub">Student mastery from the main Free Talking app, including free practice.</div><div id="ftTeacherProgressContent"></div>';
  const panel=$('#ftTeacherProgressContent',host);
  await showGeneralProgress(panel);
 }else{
  host.innerHTML='<div class="ua-subtabs"><button class="ua-subtab active" data-ft-mode="manage" type="button">Manage Homework</button><button class="ua-subtab" data-ft-mode="create" type="button">Assign Mission</button></div><div id="ftTeacherAssignmentContent"></div>';
  const panel=$('#ftTeacherAssignmentContent',host);
  $$('[data-ft-mode]',host).forEach(b=>b.onclick=()=>{
   $$('[data-ft-mode]',host).forEach(x=>x.classList.toggle('active',x===b));
   void showWorkspace(panel,b.dataset.ftMode);
  });
  await showWorkspace(panel,'manage',true);
 }
}
function openView(){
 mountDashboard();
 const view=$('#view-free-talking-genius');if(!view)return;
 $$('.view').forEach(x=>x.classList.toggle('active',x===view));
 $$('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view==='free-talking-genius'));
 try{localStorage.setItem('willena.teacher.last-view','free-talking-genius')}catch{}
 void renderDashboard();
}
window.FreeTalkingGeniusTeacher={openView,mountDashboard,showWorkspace,refresh:()=>renderDashboard()};
window.addEventListener('ua:free-talking-mounted',event=>void showWorkspace($('#uaFreeTalkingHomework'),event.detail?.sub||'manage',true));
const boot=()=>mountDashboard();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();