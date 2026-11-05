/* Grammar Genius · Book homework. Reuses the canonical Assignments and Genius homework cards.
   Grammar Foundations is preserved in its own subtab. */
(()=>{'use strict';
const OP='https://fiieuiktlsivwfgyivai.supabase.co';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const EDGE=OP+'/functions/v1/grammar-foundations-teacher-v1';
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co/rest/v1/';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const ACTIVE_BOOK_ID='1e3a2112-07be-45e2-a8fc-ce20011e0e57';
const MODES=[['choose','빈칸 선택'],['check','문장 판단'],['hunt','오류 찾기']];
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const store={path:'books',sub:'manage',classNames:null,students:[],books:null,bookId:'',bookClasses:new Map(),assignments:[],completions:[],progress:new Map(),loading:false,history:false,expanded:new Set()};
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
 // Reuse the existing teacher-authorized class/book RPC. Direct classes
 // table access is intentionally not granted to this browser session.
 const data=await api('rpc/get_sentence_genius_teacher_classes',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 if(data?.success!==true||!Array.isArray(data.classes))throw Error('Teacher class catalog unavailable');
 store.classNames=[...new Set(data.classes.map(row=>String(row.name||'').trim()).filter(Boolean))];
 store.bookClasses=new Map();
 for(const row of data.classes){
  for(const book of row.books||[]){
   if(book.status!=='active'||!book.book_id)continue;
   const key=String(book.book_id);
   if(!store.bookClasses.has(key))store.bookClasses.set(key,[]);
   store.bookClasses.get(key).push(String(row.name));
  }
 }
 // Student-level results are fetched through an existing authorized
 // teacher progress RPC, not profile/enrollment table grants.
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
 '<button type="button" class="gf-hw-view-tab'+(store.path==='books'?' active':'')+'" data-grammar-path="books">Textbooks</button>'+
 '<button type="button" class="gf-hw-view-tab'+(store.path==='foundations'?' active':'')+'" data-grammar-path="foundations">Foundations</button></div>'+
 '<div id="gfBooksHomework"'+(store.path==='books'?'':' hidden')+'></div>'+
 '<div id="gfLegacyHomework"'+(store.path==='foundations'?'':' hidden')+'></div>';
 $$('.gb-book-tabs button',outer).forEach(b=>b.addEventListener('click',()=>{store.path=b.dataset.grammarPath;void show()}));
}
async function show(){
 if(!root())return;
 tabShell();
 if(store.path==='foundations'){window.dispatchEvent(new CustomEvent('ua:grammar-foundations-mounted',{detail:{sub:store.sub}}));return}
 try{
  if(store.sub==='create')await drawCreate();else await drawManage();
 }catch(error){
  console.error('[Grammar Textbooks] panel unavailable',error);
  const el=panel();
  if(el)el.innerHTML='<div class="gf-hw-error">Textbook homework unavailable: '+esc(error.message)+'</div>';
 }
}
async function drawCreate(){
 await Promise.all([loadStudents(),loadBooks()]);
 const el=panel();if(!el)return;
 const classes=store.classNames||[];
 const options=classes.map(name=>'<option value="'+esc(name)+'">'+esc(name)+'</option>').join('');
 // Match Writing Genius: class → assigned textbooks → "Other book" → content.
 el.innerHTML='<form id="gbHwForm" class="ua-feature ua-genius-assign gb-form">'+
 '<h3>Assign Grammar Genius mission</h3>'+
 '<label>Class <select class="control" name="klass" required><option value="">Choose class</option>'+options+'</select></label>'+
 '<label>Textbook <select class="control" name="book" required><option value="">Choose class first</option></select></label>'+
 '<p class="ua-note" id="gbHwBookStatus" role="status">Choose a class to see its textbooks.</p>'+
 '<div id="gbHwBookContent" hidden>'+
 '<div class="gf-hw-picker-top"><strong id="gbHwBookTitle">Units</strong><span id="gbHwSelected">0 selected</span></div>'+
 '<div class="gb-select-head"><strong>Units</strong><label><input type="checkbox" id="gbSelectAll"> All</label></div>'+
 '<div class="gb-chapter-list" id="gbHwUnitList"></div>'+
 '<strong>Activities</strong><div class="gb-mode-row">'+MODES.map(([id,title])=>'<label><input type="checkbox" data-grammar-mode="'+id+'" checked> '+esc(title)+'</label>').join('')+'</div></div>'+
 '<div class="gf-hw-form-grid"><label>Available from<input class="control" type="date" name="start" required></label>'+
 '<label>Due date<input class="control" type="date" name="due" required></label></div>'+
 '<div class="gf-hw-pre-assignment"><div id="gbHwPreviewReport" aria-live="polite"></div></div>'+
 '<div class="gf-hw-footer"><button type="submit" class="control ua-primary" id="gbHwSubmit" disabled>Assign Mission →</button>'+
 '<span id="gbHwNotice" role="status"></span></div></form>';
 const form=$('#gbHwForm',el),bookSelect=form.elements.book,classSelect=form.elements.klass;
 const today=new Date(),due=new Date(today.valueOf()+7*86400000);
 form.elements.start.value=koreanDate(today);form.elements.due.value=koreanDate(due);
 const message=$('#gbHwBookStatus',el),unitList=$('#gbHwUnitList',el),content=$('#gbHwBookContent',el);
 let expanded=false;
 const count=()=>{
  const n=$$('[data-chapter]:checked',form).length;
  $('#gbHwSelected',el).textContent=n+' selected';
  $('#gbHwSubmit',el).disabled=!selectedBook()?.playable||!n||!classSelect.value;
 };
 const bindChapters=()=>$$('[data-chapter]',form).forEach(input=>input.addEventListener('change',()=>{count();scheduleClassPreview()}));
 let previewStamp=0,previewTimer=null;
 function scheduleClassPreview(){
  const stamp=++previewStamp;
  clearTimeout(previewTimer);
  const host=$('#gbHwPreviewReport',el);
  if(!classSelect.value||!selectedBook()?.playable||!$$('[data-chapter]:checked',form).length){host.replaceChildren();return}
  host.textContent='Loading class progress…';
  previewTimer=setTimeout(()=>void updateClassPreview(stamp),220);
 }
 function populateBooks(all=false){
  const selectedClass=classSelect.value;
  // store.bookClasses is keyed by book ID. Keep the exact assigned-books-first
  // workflow from the Writing Genius selector.
  const assigned=(store.books||[]).filter(b=>(store.bookClasses.get(b.id)||[]).includes(selectedClass));
  const list=all?(store.books||[]):assigned;
  bookSelect.replaceChildren(new Option(all?'Choose any textbook':'Choose textbook',''));
  for(const book of list){
   const opt=new Option(book.title+(book.playable?'':' · Not ready'),book.id);
   opt.disabled=!book.playable;
   bookSelect.add(opt);
  }
  if(!all)bookSelect.add(new Option('Other book — all textbooks','__other__'));
  message.textContent=all?'Full grammar textbook catalogue':assigned.length?'Assigned textbooks shown first.':'Use Other book to browse grammar textbooks.';
  store.bookId='';content.hidden=true;unitList.replaceChildren();count();scheduleClassPreview();
 }
 function selectBook(){
  store.bookId=bookSelect.value;
  const book=selectedBook();
  content.hidden=!book?.playable;
  unitList.innerHTML=book?.playable?chapterChoices():'';
  $('#gbHwBookTitle',el).textContent=book?.title||'Units';
  $('#gbSelectAll',el).checked=false;bindChapters();
  if(book&&!book.playable)message.textContent='This textbook does not yet have supported student exercises.';
  count();scheduleClassPreview();
 }
 classSelect.addEventListener('change',()=>{expanded=false;populateBooks()});
 bookSelect.addEventListener('change',()=>{
  if(bookSelect.value==='__other__'){expanded=true;populateBooks(true);return}
  selectBook();
 });
 async function updateClassPreview(stamp){
  const host=$('#gbHwPreviewReport',el);
  const klass=classSelect.value,bookId=bookSelect.value;
  const selected=$$('[data-chapter]:checked',form).map(x=>Number(x.dataset.chapter));
  if(!klass||!bookId||!selected.length){host.replaceChildren();return}
  host.textContent='Checking previous homework progress…';
  try{
   await fetchRecords();
   if(!host.isConnected||stamp!==previewStamp)return;
   const picked=new Map();
   store.assignments.filter(a=>a.class===klass&&String(a.list_meta?.source_book_id)===String(bookId)&&selected.includes(Number(a.list_meta?.chapter))).forEach(a=>{
    const chapter=Number(a.list_meta?.chapter);
    if(!picked.has(chapter))picked.set(chapter,a);
   });
   const byStudent=new Map();
   for(const a of picked.values())for(const r of progressFor(a).rows){
    const name=String(r.student?.name||'').trim();
    if(!name||!r.total)continue;
    const prev=byStudent.get(name)||{name,done:0,total:0};
    prev.done+=Math.min(r.total,r.done);prev.total+=r.total;byStudent.set(name,prev);
   }
   if(stamp!==previewStamp)return;
   window.WillenaGeniusHomeworkCard?.classReadiness(host,[...byStudent.values()].map(r=>({name:r.name,percent:100*r.done/r.total})),
    'Previous Grammar Genius homework results for selected units. New assignments start separately.');
  }catch(e){if(stamp===previewStamp)host.textContent='Previous progress unavailable: '+e.message}
 }
 $('#gbSelectAll',el).addEventListener('change',event=>{
  $$('[data-chapter]',form).forEach(input=>input.checked=event.target.checked);
  count();scheduleClassPreview();
 });
 form.addEventListener('submit',submit);
 populateBooks();
}
function koreanDate(value){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)).map(x=>[x.type,x.value]));
 return parts.year+'-'+parts.month+'-'+parts.day;
}
function isoDate(date,end=false){return new Date(date+(end?'T23:59:59+09:00':'T00:00:00+09:00')).toISOString()}
async function submit(e){
 e.preventDefault();if(store.loading)return;
 const f=e.currentTarget,klass=f.elements.klass.value,start=f.elements.start.value,due=f.elements.due.value;
 const book=(store.books||[]).find(b=>b.id===f.elements.book.value);
 const chapters=$$('[data-chapter]:checked',f).map(e=>Number(e.dataset.chapter));
 const modes=$$('[data-grammar-mode]:checked',f).map(e=>e.dataset.grammarMode);
 if(!book?.playable||!klass||!start||!due||!chapters.length||!modes.length){notice('Choose a playable book, class, dates, units and activities.',true);return}
 if(chapters.some(chapter=>!book.units.some(unit=>unit.number===chapter)))return notice('Invalid unit selection.',true);
 if(isoDate(due,true)<isoDate(start))return notice('Due date must be on or after the start date.',true);
 const creator=teacherId();if(!creator)return notice('Teacher login unavailable.',true);
 store.loading=true;$('#gbHwSubmit',f).disabled=true;notice('Assigning…');
 try{
  const rows=chapters.map(chapter=>({
   created_by:creator,class:klass,source_type:'grammar_books',
   title:book.title+' · Unit '+chapter+' · '+(book.units.find(u=>u.number===chapter)?.title||''),
   list_key:'grammar_books:'+book.bookKey+':chapter:'+chapter,
   list_title:book.title+' · Unit '+chapter,
   list_meta:{app:'grammar_books',book_key:book.bookKey,chapter,required_modes:modes,source_book_id:book.id,book_title:book.title},
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
 await Promise.all([loadStudents(),loadBooks()]);
 const [assignments,progress]=await Promise.all([
  table('?source_type=eq.grammar_books&select=*&order=created_at.desc&limit=400'),
  api('rpc/teacher_grammar_book_homework_progress_v1',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})
 ]);
 store.assignments=Array.isArray(assignments)?assignments:[];
 store.progress=new Map((Array.isArray(progress)?progress:[]).map(row=>[String(row.id),row]));

}
function progressFor(a){
 const data=store.progress.get(String(a.id));
 const rows=Array.isArray(data?.student_rows)?data.student_rows.map(st=>({
  student:{name:st.name||'Student'},
  done:Math.max(0,Number(st.done)||0),
  total:Math.max(0,Number(st.total)||0)
 })):[];
 const total=Number(data?.students)||0,done=Number(data?.passed)||0;
 // Calculate the ring from real per-student completion counters. Do not trust
 // a stale aggregate percentage; never infer progress from three assigned modes.
 const pct=rows.length?Math.round(rows.reduce((sum,r)=>sum+(r.total?Math.min(100,100*r.done/r.total):0),0)/rows.length):null;
 return {rows,pct,done,total,modes:a.list_meta?.required_modes||[]};
}
function renderAssignment(a){
 const data=progressFor(a),shared=window.WillenaGeniusHomeworkCard;
 const modeNames=data.modes.map(m=>MODES.find(x=>x[0]===m)?.[1]||m).join(' · ');
 const rowHtml=data.rows.length?data.rows.map(({student,done,total})=>{
  const pct=total?Math.max(0,Math.min(100,Math.round(100*done/total))):0;
  return '<div class="ghc-student-row"><span class="ghc-student-name">'+esc(student.korean_name||student.name||'Student')+'</span>'+
   '<span class="ghc-student-track" role="progressbar" aria-label="'+esc(student.name||'Student')+' progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct+'"><i style="width:'+pct+'%"></i></span>'+
   '<strong class="ghc-student-pct">'+pct+'%</strong></div>';
 }).join(''):'<div class="gf-hw-loading">No students in the selected class or roster unavailable.</div>';
 const buttons='<div class="gb-manage-actions">'+(store.history?'':'<button type="button" data-gb-edit="'+esc(a.id)+'">Edit</button>')+'</div>';
 const classPct=data.pct===null?'—':data.pct+'%';
 const body='<div class="ghc-progress-summary"><span>Class progress <b>'+classPct+'</b></span><span>'+data.done+'/'+data.total+' complete · '+(data.total-data.done)+' not complete</span></div>'+
  '<div class="ghc-progress-track"><i style="width:'+(data.pct||0)+'%"></i></div><div class="ghc-student-list">'+rowHtml+'</div>'+
  '<div class="ghc-progress-modes">'+esc(modeNames)+'</div>'+buttons;
 return shared.card({id:a.id,className:a.class,task:a.title,dueAt:a.due_at,createdBy:a.created_by,progressLabel:'Student progress',body,qrUrl:a.list_meta?.book_key==='grammar_ten_2'?'https://students.willenaenglish.com/students/grammar-books/?book='+encodeURIComponent(a.list_meta?.source_book_id||'grammar-ten-2-practice')+'&unit='+encodeURIComponent(a.list_meta?.chapter||1)+'&homework='+encodeURIComponent(a.id):''});
}
async function drawManage(){
 const el=panel();if(!el)return;el.innerHTML='<div class="gf-hw-loading">Loading book assignments…</div>';
 try{await fetchRecords();if(panel()!==el)return;
 const rows=store.assignments.filter(a=>store.history?a.active===false||a.status!=='active':a.active!==false&&a.status==='active');
 el.innerHTML='<div class="gf-hw-toolbar"><div class="assignment-status-tabs"><button type="button" data-gb-stage="current" class="assignment-status-tab'+(!store.history?' active':'')+'">Current</button><button type="button" data-gb-stage="history" class="assignment-status-tab'+(store.history?' active':'')+'">History</button></div><button class="control" id="gbHwRefresh">Refresh</button></div>'+
 (rows.length?'<div class="ua-genius-manage-list">'+window.WillenaGeniusHomeworkCard.groupByDate(rows,renderAssignment)+'</div>':'<div class="gf-hw-loading">No '+(store.history?'previous':'current')+' book assignments.</div>')+
 '<div id="gbHwNotice" role="status"></div>';
 $$('[data-gb-stage]',el).forEach(b=>b.onclick=()=>{store.history=b.dataset.gbStage==='history';void drawManage()});
 $('#gbHwRefresh',el).onclick=()=>drawManage();
 const shared=window.WillenaGeniusHomeworkCard;
 if(shared){for(const a of rows)shared.updateRing(a.id,progressFor(a).pct,el);void shared.hydrateTeachers(el)}
 $$('[data-gb-edit]',el).forEach(b=>b.onclick=()=>editAssignment(b.dataset.gbEdit));

 }catch(error){el.innerHTML='<div class="gf-hw-error">Book homework unavailable: '+esc(error.message)+'</div>'}
}
async function endAssignment(id){
 const a=store.assignments.find(x=>x.id===id);if(!a)return;
 if(!confirm('End this grammar homework? Student results will be preserved.'))return;
 try{await table('?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:false,status:'ended',ended_at:new Date().toISOString()})});await drawManage()}
 catch(error){notice('Could not end assignment: '+error.message,true)}
}
function editAssignment(id){
 const a=store.assignments.find(x=>x.id===id),host=panel();
 if(!a||!host)return;
 const dates=v=>v?koreanDate(v):'';
 const activeBookId=String(a.list_meta?.source_book_id||ACTIVE_BOOK_ID);
 const book=(store.books||[]).find(b=>b.id===activeBookId);
 const modal=document.createElement('dialog');modal.className='gb-edit-modal';
 modal.innerHTML='<form class="gf-hw-form"><h3>Edit book homework</h3>'+
 '<label>Class<select class="control" name="klass">'+(store.classNames||[]).map(v=>'<option value="'+esc(v)+'"'+(v===a.class?' selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label>'+
 '<label>Book<select class="control" name="book"><option value="">Choose book</option>'+bookOptions(activeBookId)+'</select></label>'+
 '<label>Unit<select class="control" name="chapter"></select></label>'+
 '<label>Available from<input class="control" type="date" name="start" value="'+esc(dates(a.start_at))+'"></label>'+
 '<label>Due date<input class="control" type="date" name="due" value="'+esc(dates(a.due_at))+'"></label>'+
 '<div class="gb-mode-row">'+MODES.map(([m,t])=>'<label><input type="checkbox" data-gb-mode="'+m+'"'+((a.list_meta?.required_modes||[]).includes(m)?' checked':'')+'> '+esc(t)+'</label>').join('')+'</div>'+
 '<div class="gb-manage-actions"><button type="button" data-cancel>Cancel</button><button type="submit" class="ua-primary">Save</button></div><p role="status"></p></form>';
 host.append(modal);const form=modal.querySelector('form');
 const refreshUnits=()=>{
  const selected=(store.books||[]).find(b=>b.id===form.elements.book.value);
  const previous=Number(form.elements.chapter.value)||Number(a.list_meta?.chapter);
  form.elements.chapter.innerHTML=(selected?.units||[]).map(u=>'<option value="'+u.number+'"'+(u.number===previous?' selected':'')+'>Unit '+u.number+' · '+esc(u.title)+'</option>').join('');
  form.querySelector('button[type=submit]').disabled=!selected?.playable;
 };
 form.elements.book.onchange=refreshUnits;
 refreshUnits();
 form.querySelector('[data-cancel]').onclick=()=>modal.close();
 modal.addEventListener('close',()=>modal.remove(),{once:true});
 form.onsubmit=async event=>{
  event.preventDefault();
  const book=(store.books||[]).find(b=>b.id===form.elements.book.value);
  const modes=$$('[data-gb-mode]:checked',modal).map(x=>x.dataset.gbMode);
  const chapter=Number(form.elements.chapter.value);
  if(!book?.playable||!book.units.some(u=>u.number===chapter)||!modes.length){
   form.querySelector('p').textContent='Choose a playable book, unit and at least one activity.';return;
  }
  if(isoDate(form.elements.due.value,true)<isoDate(form.elements.start.value)){
   form.querySelector('p').textContent='Due date is before the start date.';return;
  }
  const meta={...a.list_meta,source_book_id:book.id,book_title:book.title,book_key:book.bookKey,chapter,required_modes:modes};
  const save=form.querySelector('button[type=submit]');save.disabled=true;
  try{
   const title=book.title+' · Unit '+chapter+' · '+(book.units.find(u=>u.number===chapter)?.title||'');
   const patch={
    class:form.elements.klass.value,title,list_key:'grammar_books:'+book.bookKey+':chapter:'+chapter,
    list_title:book.title+' · Unit '+chapter,start_at:isoDate(form.elements.start.value),
    due_at:isoDate(form.elements.due.value,true),goal_value:modes.length,list_meta:meta
   };
   const result=await table('?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify(patch)});
   if(!Array.isArray(result)||result.length!==1)throw Error('Update not confirmed by server');
   modal.close();await drawManage();
  }catch(error){form.querySelector('p').textContent=error.message}
  finally{save.disabled=false}
 };
 modal.showModal();
}
window.addEventListener('ua:grammar-mounted',event=>{
 store.sub=event.detail?.sub==='create'?'create':'manage';void show();
});
})();
