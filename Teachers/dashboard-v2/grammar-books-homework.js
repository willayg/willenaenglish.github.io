/* Grammar Genius · Book homework. Reuses the canonical Assignments and Genius homework cards.
   Grammar Foundations is preserved in its own subtab. */
(()=>{'use strict';
const OP='https://fiieuiktlsivwfgyivai.supabase.co';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const EDGE=OP+'/functions/v1/grammar-foundations-teacher-v1';
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co/rest/v1/';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const ACTIVE_BOOK_ID='1e3a2112-07be-45e2-a8fc-ce20011e0e57';
const CHAPTERS=['현재시제','과거시제','진행시제, 미래시제','조동사','명사','형용사, 부사','to부정사, 동명사','전치사','접속사','문장의 형태','의문사 의문문, 명령문, 감탄문'];
const MODES=[['choose','빈칸 선택'],['check','문장 판단'],['hunt','오류 찾기']];
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const store={path:'books',sub:'manage',classNames:null,students:[],books:null,bookId:'',bookClasses:new Map(),assignments:[],completions:[],loading:false,history:false,expanded:new Set()};
const root=()=>$('#uaGrammarHomework'),panel=()=>$('#gfBooksHomework');
const authToken=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
async function refreshToken(){const response=await (window.WillenaAPI?.fetch?window.WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=refresh'):fetch('/.netlify/functions/supabase_auth?action=refresh',{credentials:'include'}));const data=await response.json();if(!data.access_token)throw Error('Please sign in again');window.WillenaAPI?.setLocalTokens?.(data.access_token,data.refresh_token||'');return data.access_token}
async function request(url,options={}){
 const send=t=>fetch(url,{...options,cache:'no-store',headers:{apikey:KEY,Authorization:'Bearer '+t,...options.headers}});
 let res=await send(authToken()||await refreshToken());
 if(res.status===401)res=await send(await refreshToken());
 const data=await res.json().catch(()=>null);
 if(!res.ok)throw Error(data?.message||data?.error||'Request failed ('+res.status+')');
 return data;
}
const api=(path,opts={})=>request(OP+'/rest/v1/'+path,opts);
const table=(q='',opts={})=>api('homework_assignments'+q,opts);
const notice=(s,err=false)=>{const n=$('#gbHwNotice');if(n){n.textContent=s;n.classList.toggle('gf-hw-error',err)}};
function teacherId(){try{return JSON.parse(atob(authToken().split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub}catch{return''}}
async function loadStudents(){
 if(store.classNames)return;
 // The authoritative class roster is classes + class_enrollments, not the
 // older Grammar Foundations activity feed (which can omit real classes).
 const classes=await api('classes?select=id,name,status&status=eq.active&order=sort_order.asc&limit=200');
 store.classNames=[...new Set([...(classes||[]).map(x=>x.name).filter(Boolean),'Test'])];
 try{
  const enrollments=await api('class_enrollments?select=student_id,class_id,status&status=eq.active&limit=2000');
  const ids=[...new Set((enrollments||[]).map(e=>e.student_id).filter(Boolean))];
  let profiles=[];
  if(ids.length)profiles=await api('profiles?select=id,name,korean_name&role=eq.student&id=in.('+ids.join(',')+')&limit=2000');
  const names=new Map((classes||[]).map(x=>[String(x.id),x.name]));
  const members=new Map((profiles||[]).map(p=>[String(p.id),p]));
  store.students=(enrollments||[]).flatMap(e=>{
   const person=members.get(String(e.student_id)),name=names.get(String(e.class_id));
   return person&&name?[{...person,class:name}]:[];
  });
 }catch(error){console.warn('[Grammar book homework] enrolled student progress may be incomplete',error);store.students=[];}
}
async function loadBooks(){
 if(store.books)return store.books;
 const headers={apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY};
 const response=await fetch(CONTENT+'content_books?select=id,title,metadata&status=eq.published&metadata->>subject=eq.grammar&order=title.asc&limit=150',{headers,cache:'no-store'});
 if(!response.ok)throw Error('Published grammar book catalog unavailable ('+response.status+')');
 const rows=await response.json();
 const books=[];
 for(const row of Array.isArray(rows)?rows:[]){
  const id=String(row.id),supported=id===ACTIVE_BOOK_ID,units=[];
  if(supported){
   const r=await fetch(CONTENT+'content_units?select=unit_number,title,metadata&book_id=eq.'+encodeURIComponent(id)+'&status=eq.published&order=unit_number.asc&limit=200',{headers,cache:'no-store'});
   if(!r.ok)throw Error('Grammar units unavailable ('+r.status+')');
   const raw=await r.json(),grouped=new Map();
   for(const unit of Array.isArray(raw)?raw:[]){
    const chapter=Number(unit.metadata?.chapter_number);
    if(!Number.isInteger(chapter)||chapter<1||chapter>11)continue;
    if(!grouped.has(chapter))grouped.set(chapter,{number:chapter,title:String(unit.metadata?.chapter_title||'Unit '+chapter)});
   }
   units.push(...[...grouped.values()].sort((a,b)=>a.number-b.number));
  }
  // Other books appear in the picker automatically, but remain disabled
  // until their student game and completion writer support those units.
  books.push({id,title:String(row.title||'Grammar book'),bookKey:supported?'grammar_ten_2':'',playable:supported&&units.length===11,units});
 }
 store.books=books;
 // Book-to-class links are for helpful defaults only. Assignments still allow
 // any active class, including Test.
 try{
  const links=await api('class_book_assignments?select=class_id,book_id,status&status=eq.active&limit=1000');
  const classes=await api('classes?select=id,name&status=eq.active&limit=200');
  const names=new Map(classes.map(x=>[x.id,x.name]));
  store.bookClasses=new Map();
  for(const link of links){
   if(!store.bookClasses.has(link.book_id))store.bookClasses.set(link.book_id,[]);
   const name=names.get(link.class_id);
   if(name&&!store.bookClasses.get(link.book_id).includes(name))store.bookClasses.get(link.book_id).push(name);
  }
 }catch(error){console.warn('[Grammar book homework] class-book suggestions unavailable',error)}
 return books;
}
function selectedBook(){return (store.books||[]).find(b=>b.id===store.bookId)||null}
function bookOptions(selected=''){
 return (store.books||[]).map(b=>'<option value="'+esc(b.id)+'"'+(b.id===selected?' selected':'')+(b.playable?'':' disabled')+'>'+esc(b.title)+(b.playable?'':' · Not ready')+'</option>').join('');
}
function chapterChoices(selected=[]){
 const book=selectedBook();
 return (book?.units||[]).map(u=>'<label class="gb-chapter"><input type="checkbox" data-chapter="'+u.number+'"'+(selected.includes(u.number)?' checked':'')+'><span>Unit '+u.number+' · '+esc(u.title)+'</span></label>').join('');
}
function tabShell(){
 const outer=root();if(!outer)return;
 outer.innerHTML='<div class="gf-hw-view-tabs gb-book-tabs" role="tablist" aria-label="Grammar Genius homework paths">'+
 '<button type="button" class="gf-hw-view-tab'+(store.path==='books'?' active':'')+'" data-grammar-path="books">Book Grammar</button>'+
 '<button type="button" class="gf-hw-view-tab'+(store.path==='foundations'?' active':'')+'" data-grammar-path="foundations">Foundations</button></div>'+
 '<div id="gfBooksHomework"'+(store.path==='books'?'':' hidden')+'></div>'+
 '<div id="gfLegacyHomework"'+(store.path==='foundations'?'':' hidden')+'></div>';
 $$('.gb-book-tabs button',outer).forEach(b=>b.addEventListener('click',()=>{store.path=b.dataset.grammarPath;void show()}));
}
async function show(){
 if(!root())return;
 tabShell();
 if(store.path==='foundations'){window.dispatchEvent(new CustomEvent('ua:grammar-foundations-mounted',{detail:{sub:store.sub}}));return}
 if(store.sub==='create')await drawCreate();else await drawManage();
}
async function drawCreate(){
 await loadStudents();const el=panel();if(!el)return;
 const options=(store.classNames||[]).map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');
 el.innerHTML='<form class="gf-hw-form gb-form" id="gbHwForm">'+
 '<div class="gf-hw-form-grid"><label>Class<select class="control" name="klass" required><option value="">Choose class</option>'+options+'</select></label>'+
 '<label>Available from<input class="control" type="date" name="start" required></label>'+
 '<label>Due date<input class="control" type="date" name="due" required></label></div>'+
 '<div class="gf-hw-picker-top"><div><strong>Grammar Ten 완성 2</strong><small>Choose chapters and the activities students must finish.</small></div><span id="gbHwSelected">0 chapters</span></div>'+
 '<div class="gb-mode-row">'+MODES.map(([id,title])=>'<label><input type="checkbox" data-grammar-mode="'+id+'" checked> '+esc(title)+'</label>').join('')+'</div>'+
 '<div class="gb-select-head"><strong>Chapters</strong><label><input type="checkbox" id="gbSelectAll"> All</label></div>'+
 '<div class="gb-chapter-list">'+chapterChoices()+'</div>'+
 '<div class="gf-hw-footer"><button type="submit" class="control ua-primary" id="gbHwSubmit">Assign selected chapters</button><span id="gbHwNotice" role="status"></span></div></form>';
 const today=new Date(), due=new Date(today.valueOf()+7*86400000);
 const fmt=koreanDate;
 el.querySelector('[name=start]').value=fmt(today);el.querySelector('[name=due]').value=fmt(due);
 const count=()=>{const n=$$('[data-chapter]:checked',el).length;$('#gbHwSelected',el).textContent=n+' selected';$('#gbHwSubmit',el).disabled=!n;$('#gbHwSubmit',el).textContent=n?'Assign '+n+' chapter'+(n===1?'':'s'):'Select chapters'};
 $$('[data-chapter]',el).forEach(b=>b.addEventListener('change',count));
 $('#gbSelectAll',el).addEventListener('change',e=>{$$('[data-chapter]',el).forEach(b=>b.checked=e.target.checked);count()});
 $('#gbHwForm',el).addEventListener('submit',submit);count();
}
function koreanDate(value){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)).map(x=>[x.type,x.value]));
 return parts.year+'-'+parts.month+'-'+parts.day;
}
function isoDate(date,end=false){return new Date(date+(end?'T23:59:59+09:00':'T00:00:00+09:00')).toISOString()}
async function submit(e){
 e.preventDefault();if(store.loading)return;
 const f=e.currentTarget,klass=f.elements.klass.value,start=f.elements.start.value,due=f.elements.due.value;
 const chapters=$$('[data-chapter]:checked',f).map(e=>Number(e.dataset.chapter));
 const modes=$$('[data-grammar-mode]:checked',f).map(e=>e.dataset.grammarMode);
 if(!klass||!start||!due||!chapters.length||!modes.length){notice('Choose a class, dates, chapters and activities.',true);return}
 if(isoDate(due,true)<isoDate(start))return notice('Due date must be on or after the start date.',true);
 const creator=teacherId();if(!creator)return notice('Teacher login unavailable.',true);
 store.loading=true;$('#gbHwSubmit',f).disabled=true;notice('Assigning…');
 try{
  const rows=chapters.map(chapter=>({
   created_by:creator,class:klass,source_type:'grammar_books',
   title:'Grammar Ten 완성 2 · Unit '+chapter+' · '+CHAPTERS[chapter-1],
   list_key:'grammar_books:grammar_ten_2:chapter:'+chapter,
   list_title:'Grammar Ten 완성 2 · Unit '+chapter,
   list_meta:{app:'grammar_books',book_key:'grammar_ten_2',chapter,required_modes:modes,source_book_id:'1e3a2112-07be-45e2-a8fc-ce20011e0e57'},
   goal_type:'completed_modes',goal_value:modes.length,
   start_at:isoDate(start),due_at:isoDate(due,true),active:true,status:'active',
   allow_manual_complete:false
  }));
  const saved=await table('',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify(rows)});
  if(!Array.isArray(saved)||saved.length!==rows.length)throw Error('Server did not confirm every assignment; check Manage Homework before retrying.');
  window.dispatchEvent(new CustomEvent('willena:assignment-created',{detail:{message:rows.length+' Grammar book chapter'+(rows.length===1?'':'s')+' · '+klass}}));
  store.sub='manage';await drawManage();
 }catch(error){notice('Could not assign: '+error.message,true)}finally{store.loading=false;if($('#gbHwSubmit',f))$('#gbHwSubmit',f).disabled=false}
}
async function fetchRecords(){
 await loadStudents();
 const [assignments,completions]=await Promise.all([
  table('?source_type=eq.grammar_books&select=*&order=created_at.desc&limit=400'),
  api('grammar_book_homework_completions?select=assignment_id,student_id,mode,completed_at&limit=5000')
 ]);
 store.assignments=Array.isArray(assignments)?assignments:[];
 store.completions=Array.isArray(completions)?completions:[];
}
function peopleFor(a){
 const ids=Array.isArray(a.list_meta?.target_student_ids)?a.list_meta.target_student_ids:[];
 return store.students.filter(st=>st.class===a.class&&(!ids.length||ids.includes(st.id)));
}
function progressFor(a){
 const modes=a.list_meta?.required_modes||[],people=peopleFor(a),hit=new Set(store.completions.filter(c=>c.assignment_id===a.id).map(c=>c.student_id+':'+c.mode));
 const rows=people.map(student=>({student,modesCompleted:modes.filter(m=>hit.has(student.id+':'+m)),total:modes.length}));
 const done=rows.filter(r=>r.total&&r.modesCompleted.length===r.total).length;
 const pct=rows.length&&modes.length?Math.round(rows.reduce((sum,r)=>sum+100*r.modesCompleted.length/r.total,0)/rows.length):null;
 return {rows,pct,done,total:rows.length,modes};
}
function renderAssignment(a){
 const data=progressFor(a),shared=window.WillenaGeniusHomeworkCard;
 const modeNames=data.modes.map(m=>MODES.find(x=>x[0]===m)?.[1]||m).join(' · ');
 const rowHtml=data.rows.length?data.rows.map(({student,modesCompleted,total})=>
  '<div class="gf-hw-student"><span>'+esc(student.korean_name||student.name||'Student')+'</span>'+
  '<span>'+modesCompleted.length+'/'+total+' activities</span><strong class="'+(modesCompleted.length===total?'gf-hw-done':'')+'">'+Math.round(modesCompleted.length/total*100)+'%</strong></div>').join(''):'<div class="gf-hw-loading">No students in the selected class or roster unavailable.</div>';
 const buttons='<div class="gb-manage-actions">'+(store.history?'':'<button type="button" data-gb-edit="'+esc(a.id)+'">Edit</button><button type="button" data-gb-delete="'+esc(a.id)+'" aria-label="End assignment">×</button>')+'</div>';
 const body='<div class="gf-hw-progress-summary">'+data.done+'/'+data.total+' completed · '+esc(modeNames)+'</div><div class="gf-hw-students">'+rowHtml+'</div>'+buttons;
 return shared.card({id:a.id,className:a.class,task:a.title,dueAt:a.due_at,createdBy:a.created_by,progressLabel:'Student progress',body});
}
async function drawManage(){
 const el=panel();if(!el)return;el.innerHTML='<div class="gf-hw-loading">Loading book assignments…</div>';
 try{await fetchRecords();if(panel()!==el)return;
 const rows=store.assignments.filter(a=>store.history?a.active===false||a.status!=='active':a.active!==false&&a.status==='active');
 el.innerHTML='<div class="gf-hw-toolbar"><div class="assignment-status-tabs"><button type="button" data-gb-stage="current" class="assignment-status-tab'+(!store.history?' active':'')+'">Current</button><button type="button" data-gb-stage="history" class="assignment-status-tab'+(store.history?' active':'')+'">History</button></div><button class="control" id="gbHwRefresh">Refresh</button></div>'+
 (rows.length?'<div class="ua-genius-manage-list">'+rows.map(renderAssignment).join('')+'</div>':'<div class="gf-hw-loading">No '+(store.history?'previous':'current')+' book assignments.</div>')+
 '<div id="gbHwNotice" role="status"></div>';
 $$('[data-gb-stage]',el).forEach(b=>b.onclick=()=>{store.history=b.dataset.gbStage==='history';void drawManage()});
 $('#gbHwRefresh',el).onclick=()=>drawManage();
 const shared=window.WillenaGeniusHomeworkCard;
 if(shared){for(const a of rows)shared.updateRing(a.id,progressFor(a).pct,el);void shared.hydrateTeachers(el)}
 $$('[data-gb-edit]',el).forEach(b=>b.onclick=()=>editAssignment(b.dataset.gbEdit));
 $$('[data-gb-delete]',el).forEach(b=>b.onclick=()=>endAssignment(b.dataset.gbDelete));
 }catch(error){el.innerHTML='<div class="gf-hw-error">Book homework unavailable: '+esc(error.message)+'</div>'}
}
async function endAssignment(id){
 const a=store.assignments.find(x=>x.id===id);if(!a)return;
 if(!confirm('End this grammar homework? Student results will be preserved.'))return;
 try{await table('?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:false,status:'ended',ended_at:new Date().toISOString()})});await drawManage()}
 catch(error){notice('Could not end assignment: '+error.message,true)}
}
function editAssignment(id){
 const a=store.assignments.find(x=>x.id===id),host=panel();if(!a||!host)return;
 const dates=v=>v?koreanDate(v):'';
 const modal=document.createElement('dialog');modal.className='gb-edit-modal';
 modal.innerHTML='<form method="dialog" class="gf-hw-form"><h3>Edit book homework</h3><label>Class<select class="control" name="klass">'+(store.classNames||[]).map(v=>'<option value="'+esc(v)+'"'+(v===a.class?' selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label>'+
 '<label>Chapter<select class="control" name="chapter">'+CHAPTERS.map((v,i)=>'<option value="'+(i+1)+'"'+(i+1===Number(a.list_meta?.chapter)?' selected':'')+'>Unit '+(i+1)+' · '+esc(v)+'</option>').join('')+'</select></label>'+
 '<label>Available from<input class="control" type="date" name="start" value="'+esc(dates(a.start_at))+'"></label>'+
 '<label>Due date<input class="control" type="date" name="due" value="'+esc(dates(a.due_at))+'"></label>'+
 '<div class="gb-mode-row">'+MODES.map(([m,t])=>'<label><input type="checkbox" data-gb-mode="'+m+'"'+((a.list_meta?.required_modes||[]).includes(m)?' checked':'')+'> '+esc(t)+'</label>').join('')+'</div>'+
 '<div class="gb-manage-actions"><button value="cancel" type="button" data-cancel>Cancel</button><button value="save" type="submit" class="ua-primary">Save</button></div><p role="status"></p></form>';
 host.append(modal);const form=modal.querySelector('form');
 form.querySelector('[data-cancel]').onclick=()=>modal.close();
 modal.addEventListener('close',()=>modal.remove(),{once:true});
 form.onsubmit=async e=>{
  e.preventDefault();const modes=$$('[data-gb-mode]:checked',modal).map(x=>x.dataset.gbMode),chapter=Number(form.elements.chapter.value);
  if(!modes.length){form.querySelector('p').textContent='Select at least one activity.';return}
  if(isoDate(form.elements.due.value,true)<isoDate(form.elements.start.value)){form.querySelector('p').textContent='Due date is before the start date.';return}
  const meta={...a.list_meta,chapter,required_modes:modes};
  try{
   await table('?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    class:form.elements.klass.value,title:'Grammar Ten 완성 2 · Unit '+chapter+' · '+CHAPTERS[chapter-1],
    list_key:'grammar_books:grammar_ten_2:chapter:'+chapter,list_title:'Grammar Ten 완성 2 · Unit '+chapter,
    start_at:isoDate(form.elements.start.value),due_at:isoDate(form.elements.due.value,true),
    goal_value:modes.length,list_meta:meta
   })});
   modal.close();await drawManage();
  }catch(error){form.querySelector('p').textContent=error.message}
 };
 modal.showModal();
}
window.addEventListener('ua:grammar-mounted',event=>{
 store.sub=event.detail?.sub==='create'?'create':'manage';void show();
});
})();
