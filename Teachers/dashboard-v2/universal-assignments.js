/* Assignment workspace. Uses existing dashboard panels and Naesin assignment API. */
(()=>{'use strict';
const root=document.getElementById('universalAssignments');if(!root)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const apps=[{id:'classes',label:'All Classes',sub:'Curriculum homework planner',icon:'▦'},{id:'my',label:'My',sub:'My homework',icon:'◎'},{id:'all',label:'All',sub:'All homework',icon:'▦'},{id:'calendar',label:'Calendar',sub:'Assignment dates',icon:'▦'},{id:'naesin',label:'내신',sub:'Exam practice',icon:'文'},{id:'word',label:'Word Genius',sub:'Vocabulary',icon:'Aa'},{id:'sentence',label:'Sentence Genius',sub:'Sentence speaking & building',icon:'S'},{id:'free-talking',label:'Free Talking Genius',sub:'Speaking missions',icon:'FT'},{id:'grammar',label:'Grammar Genius',sub:'Grammar mastery',icon:'G'},{id:'writing',label:'Writing Genius',sub:'Diaries & topic writing',icon:'✎'},{id:'puzzles',label:'Puzzles',sub:'Word games',icon:'◇'}];

// In-app completion inbox: deduplicated by assignment and immutable student ID.
// A first snapshot establishes a baseline so old homework does not flood alerts.
const notificationKey='willena:teacher-homework-notices:v1';
let notificationState={baseline:false,known:[],unread:[],items:[]};
try{notificationState={...notificationState,...JSON.parse(localStorage.getItem(notificationKey)||'{}')}}catch{}
let notificationPanelOpen=false;
function persistNotifications(){try{localStorage.setItem(notificationKey,JSON.stringify(notificationState))}catch{}}
function renderNotifications(){
 const count=notificationState.unread.length;
 const nav=document.querySelector('.rail [data-view="assignments"]');
 if(nav){
  nav.style.position='relative';
  let dot=nav.querySelector('.ua-notification-dot');
  if(!dot){dot=document.createElement('span');dot.className='ua-notification-dot';dot.style.cssText='position:absolute;top:5px;right:5px;background:#d93646;color:white;border:2px solid white;border-radius:999px;min-width:18px;height:18px;padding:0 3px;font:bold 10px/14px system-ui;display:grid;place-items:center;';nav.append(dot)}
  dot.textContent=count>99?'99+':String(count);dot.hidden=count===0;dot.style.display=count?'grid':'none';
 }
 const heading=root.querySelector('.ua-section-heading');
 if(!heading)return;
 let button=heading.querySelector('#uaNotificationsButton');
 if(!button){
  button=document.createElement('button');button.type='button';button.id='uaNotificationsButton';button.className='control';
  button.style.cssText='position:relative;display:inline-flex;align-items:center;gap:8px;border-radius:15px;margin-left:auto';
  button.onclick=()=>{
   notificationPanelOpen=!notificationPanelOpen;
   if(notificationPanelOpen){notificationState.unread=[];persistNotifications()}
   renderNotifications();
  };
  heading.append(button);
 }
 button.innerHTML='Notifications '+(count?'<span style="background:#d93646;color:#fff;padding:2px 7px;border-radius:20px;font-weight:750">'+count+'</span>':'');
 button.setAttribute('aria-expanded',String(notificationPanelOpen));
 let panel=root.querySelector('#uaNotificationsPanel');
 if(!notificationPanelOpen){panel?.remove();return}
 if(!panel){panel=document.createElement('section');panel.id='uaNotificationsPanel';panel.setAttribute('aria-label','Recent homework completions');panel.style.cssText='padding:16px;margin:12px 0;border:1px solid #dce9eb;border-radius:16px;background:#fff';heading.after(panel)}
 const items=(notificationState.items||[]).slice(-25).reverse();
 panel.innerHTML='<strong>Recent completed homework</strong><p style="color:#71848b;margin:6px 0 12px">New completions are marked read when opened.</p>'+
 (items.length?items.map(item=>'<div style="padding:9px 0;border-top:1px solid #edf1f3"><b>'+esc(item.app||'Homework')+'</b> · '+esc(item.className||'Class')+'<div>'+esc(item.studentName||item.studentId||'Student')+' · '+esc(item.assignment||'Mission')+'</div></div>').join(''):'<p>No newly recorded completions yet.</p>');
}
window.addEventListener('willena:homework-completion-snapshot',event=>{
 const entries=event.detail?.completions||[];
 const known=new Set(notificationState.known||[]);
 if(!notificationState.baseline){
  notificationState.known=[...new Set(entries.map(item=>item.key))];notificationState.baseline=true;
 }else{
  const fresh=entries.filter(item=>item.key&&!known.has(item.key));
  notificationState.unread=[...new Set([...(notificationState.unread||[]),...fresh.map(item=>item.key)])];
  notificationState.items=[...(notificationState.items||[]),...fresh].slice(-100);
  notificationState.known=[...new Set([...known,...entries.map(item=>item.key)])].slice(-30000);
 }
 persistNotifications();renderNotifications();
});

const stateKey='willena.teachers.assignments.v2';
let saved={};try{saved=JSON.parse(sessionStorage.getItem(stateKey)||'{}')||{}}catch{}
let active=apps.some(a=>a.id===saved.active)?saved.active:'classes',loading=false,groups=[];
const remember=()=>{try{sessionStorage.setItem(stateKey,JSON.stringify({active,subviews,scrollLeft:(root.querySelector('.ua-app-tabs')?.scrollLeft??Number(saved.scrollLeft)??0)}))}catch{}};
const subviews={classes:'manage',my:'manage',all:'manage',calendar:'manage',naesin:'manage',word:'manage',grammar:'manage','free-talking':'manage',sentence:'manage',puzzles:'manage',writing:'manage'};
Object.keys(subviews).forEach(k=>{if(saved.subviews?.[k]==='create'||saved.subviews?.[k]==='manage')subviews[k]=saved.subviews[k]});
let wordPanel=null,wordHome=null;
function restoreWordPanel(){if(wordPanel&&wordHome&&wordPanel.parentElement!==wordHome)wordHome.appendChild(wordPanel)}
function showWordPanel(body){const panel=document.querySelector('[data-vocab-subview="assignments"]');if(!panel){body.innerHTML='<div class="ua-empty">Word Genius tracking unavailable.</div>';return}if(!wordPanel){wordPanel=panel;wordHome=panel.parentElement}panel.classList.add('ua-mounted-word');panel.classList.add('active');body.appendChild(panel);window.dispatchEvent(new CustomEvent('vocab:assignments-open'))}


const newHomeworkApps={
 writing:{heading:'Assign Writing Mission',types:[['diary','Daily diary'],['topic','Topic writing'],['sentence','Sentence writing (textbook)']]},
 puzzles:{heading:'Assign Puzzle Mission',types:[['boggle','Boggle'],['wordsearch','Word Search'],['crossword','Crossword'],['mixmatch','Mix & Match']]}
};
function homeworkForm(app,body){
 const spec=newHomeworkApps[app];
 const select=document.getElementById('classSelect');
 const classes=[...new Set([...[...(select?.options||[])].map(o=>o.value).filter(Boolean),'Test'])];
 body.innerHTML='<form id="uaNewHomework" class="ua-feature ua-genius-assign">'+
 '<h3>'+spec.heading+'</h3>'+ '<label>Class <select class="control" name="class" required><option value="">Choose class</option>'+classes.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('')+'</select></label>'+
 '<label>Homework type <select class="control" name="kind">'+spec.types.map(x=>'<option value="'+x[0]+'">'+x[1]+'</option>').join('')+'</select></label>'+
 '<label>Title <input class="control" name="title" required maxlength="120" placeholder="Homework title"></label>'+
 (app==='writing'?'<div id="uaSentenceBookFields" hidden><label>Textbook <select class="control" name="book"><option value="">Choose textbook</option></select></label><label>Unit <select class="control" name="unit"><option value="">Choose unit</option></select></label><p id="uaSentenceBookStatus" class="ua-note"></p></div>':'')+
 (app==='writing'?'<label>Writing instructions / topic <textarea class="control" name="prompt" rows="4" maxlength="1500" placeholder="What should students write about?"></textarea></label>':'')+
 '<label>Due date <input class="control" name="due" type="date" required></label>'+ 
 '<label>Repeat <select class="control" name="repeat"><option value="none">One time</option><option value="daily">Every day</option><option value="weekly">Every week</option></select></label>'+
 '<div><div id="uaClassProgressReport" aria-live="polite"></div></div>'+
 '<button class="control ua-primary" type="submit">Assign Mission →</button><div id="uaNewHomeworkStatus" role="status"></div></form>';
 const form=body.querySelector('form'),date=form.elements.due;
 if(app==='writing'){
  const fields=body.querySelector('#uaSentenceBookFields'),message=body.querySelector('#uaSentenceBookStatus');
  const OP='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/';
  const OPKEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
  const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co/rest/v1/';
  const CONTENTKEY='sb_publishable_G-FYhHfDL4OGdL892gY1Zg_epdbEeqO';
  async function records(url,key){
   const auth=key===OPKEY?(window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||key):key;
   const response=await fetch(url,{headers:{apikey:key,Authorization:'Bearer '+auth},cache:'no-store'});
   if(!response.ok)throw Error('Could not load textbook data ('+response.status+')');
   const result=await response.json();return Array.isArray(result)?result:[];
  }
  const populate=(node,items,label)=>{node.replaceChildren(new Option(label,''));items.forEach(x=>node.add(new Option(x.title||x.book_title||x.name||x.id,x.id||x.book_id)))};
  let loadId=0;
  async function loadClassBooks(){
   const stamp=++loadId;
   if(fields.hidden)return;
   message.textContent='Loading assigned textbooks…';
   populate(form.elements.book,[],'Choose textbook');populate(form.elements.unit,[],'Choose unit');
   try{
    const chosen=form.elements['class'].value;
    if(!chosen){message.textContent='Choose a class first.';return}
    const token=window.WillenaAPI?.getLocalAccessToken?.();
    if(!token)throw Error('Teacher login unavailable');
    const response=await fetch(OP+'rpc/teacher_assigned_books_for_class_v1',{method:'POST',headers:{apikey:OPKEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({p_class:chosen}),cache:'no-store'});
    if(!response.ok)throw Error('Class textbooks unavailable ('+response.status+')');
    const list=(await response.json()).map(book=>({book_id:book.id,book_title:book.title}));
    if(stamp!==loadId)return;
    const unique=[...new Map(list.map(x=>[x.book_id,x])).values()];
    populate(form.elements.book,unique,'Choose textbook');form.elements.book.add(new Option('Other book — all textbooks','__other__'));message.textContent=unique.length?'Assigned textbooks shown first.':'Use Other book to browse all textbooks.';
   }catch(e){if(stamp===loadId)message.textContent=e.message}
  }
  async function loadBookUnits(){
   const stamp=++loadId;
   populate(form.elements.unit,[],'Choose unit');
   if(!form.elements.book.value)return;
   message.textContent='Loading textbook units…';
   try{
    const units=await records(CONTENT+'content_units?select=id,title,unit_number&book_id=eq.'+encodeURIComponent(form.elements.book.value)+'&status=in.(published,review)&order=unit_number.asc',CONTENTKEY);
    if(stamp!==loadId)return;
    populate(form.elements.unit,units.map(x=>({...x,title:'Unit '+x.unit_number+' · '+(x.title||'')})),'Choose unit');
    message.textContent=units.length?'Select the unit students should practise.':'No available units in this textbook.';
   }catch(e){if(stamp===loadId)message.textContent=e.message}
  }
  form.elements.kind.addEventListener('change',()=>{fields.hidden=form.elements.kind.value!=='sentence';if(!fields.hidden)void loadClassBooks()});
  form.elements['class'].addEventListener('change',()=>{if(!fields.hidden)void loadClassBooks()});
  form.elements.book.addEventListener('change',async()=>{
   if(form.elements.book.value==='__other__'){
    message.textContent='Loading all textbooks…';
    try{
     const books=await records(CONTENT+'content_books?select=id,title&status=in.(published,review)&order=title.asc&limit=1000',CONTENTKEY);
     populate(form.elements.book,books,'Choose any textbook');
     message.textContent='Full textbook catalogue';
    }catch(e){message.textContent=e.message}
    return;
   }
   void loadBookUnits();
  });
 }

 const tomorrow=new Date(Date.now()+86400000);date.value=tomorrow.getFullYear()+'-'+String(tomorrow.getMonth()+1).padStart(2,'0')+'-'+String(tomorrow.getDate()).padStart(2,'0');
 let progressStamp=0,progressTimer=null;
 function scheduleClassProgress(){
  const stamp=++progressStamp;clearTimeout(progressTimer);
  const host=form.querySelector('#uaClassProgressReport');
  const klass=form.elements['class'].value,kind=form.elements.kind.value;
  if(!klass||(app==='writing'&&kind==='sentence'&&(!form.elements.book.value||!form.elements.unit.value))){host.replaceChildren();return}
  host.textContent='Loading class progress…';
  progressTimer=setTimeout(()=>void showClassProgress(stamp),250);
 }
 form.elements['class'].addEventListener('change',scheduleClassProgress);
 form.elements.kind.addEventListener('change',scheduleClassProgress);
 if(app==='writing'){
  form.elements.book.addEventListener('change',scheduleClassProgress);
  form.elements.unit.addEventListener('change',scheduleClassProgress);
 }
 async function showClassProgress(stamp){
  const host=form.querySelector('#uaClassProgressReport');
  const klass=form.elements['class'].value,kind=form.elements.kind.value;
  if(!klass||(app==='writing'&&kind==='sentence'&&(!form.elements.book.value||!form.elements.unit.value))){host.replaceChildren();return}
  host.textContent='Checking previous class assignments…';
  try{
   const route='/.netlify/functions/homework_api?action=list_assignments';
   const response=await (window.WillenaAPI?.fetch?window.WillenaAPI.fetch(route,{credentials:'include'}):fetch(route,{credentials:'include'}));
   const data=await response.json();if(!response.ok||!data.success)throw Error('Assignment records unavailable');
   const candidates=(data.assignments||[]).filter(a=>
     a.class===klass&&a.list_meta?.creative_type===(app==='writing'?'writing_genius':'puzzles')&&a.list_meta?.kind===kind&&
     (app!=='writing'||kind!=='sentence'||(String(a.list_meta?.book_id)===form.elements.book.value&&String(a.list_meta?.unit_id)===form.elements.unit.value))
   ).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
   const latest=candidates[0],rows=[];
   if(latest){
    const endpoint=app==='puzzles'?'teacher_puzzle_homework_progress_v1':kind==='sentence'?'teacher_writing_sentence_homework_progress_v1':'teacher_creative_writing_progress_v1';
    const token=window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
    if(!token)throw Error('Teacher sign-in required');
    const res=await fetch('https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/'+endpoint,{
      method:'POST',headers:{apikey:'sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e',Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});
    if(!res.ok)throw Error('Previous progress unavailable ('+res.status+')');
    const all=await res.json(),result=(Array.isArray(all)?all:[]).find(a=>String(a.id)===String(latest.id));
    for(const st of result?.student_rows||[]){
      const pct=kind==='sentence'?Number(st.progress_percent):st.completed===true?100:0;
      rows.push({name:st.name||st.korean_name,percent:Number.isFinite(pct)?pct:null});
    }
   }
   if(stamp!==progressStamp||!host.isConnected)return;
   window.WillenaGeniusHomeworkCard?.classReadiness(host,rows,
     'Previous '+(app==='writing'?'Writing Genius':'Puzzles')+' homework completion for this class and activity; not a prediction.');
  }catch(error){if(stamp===progressStamp)host.textContent='Previous class progress unavailable: '+error.message}
 }
 form.onsubmit=async e=>{
  e.preventDefault();
  const button=form.querySelector('button[type="submit"]'),status=form.querySelector('#uaNewHomeworkStatus');
  button.disabled=true;status.textContent='Assigning…';
  try{
   const cls=form.elements['class'].value,kind=form.elements.kind.value,title=form.elements.title.value.trim(),prompt=app==='writing'?form.elements.prompt.value.trim():'';
   if(!cls||!title||!date.value)throw Error('Select a class, title and due date.');
   const due=new Date(date.value+'T23:59:59+09:00').toISOString();
   if(app==='writing'&&kind==='sentence'&&(!form.elements.book.value||!form.elements.unit.value))throw Error('Choose a textbook and unit.');
   const meta={source_type:'wordlist',creative_type:app==='writing'?'writing_genius':'puzzles',kind,app:app==='writing'?'writing_genius':'puzzles',prompt_text:prompt,required_count:1};
   if(app==='writing'&&kind==='sentence'){
    meta.book_id=form.elements.book.value;meta.unit_id=form.elements.unit.value;
    meta.book_title=form.elements.book.selectedOptions[0]?.textContent||'Textbook';
    meta.unit_label=form.elements.unit.selectedOptions[0]?.textContent||'Unit';
   }
   const payload={class:cls,title,description:prompt||null,list_key:(app==='writing'?'writing_genius:':'puzzles:')+kind,list_title:title,list_meta:meta,due_at:due,goal_type:'completions',goal_value:1};
   const url=window.WillenaAPI?.getApiUrl?.('/.netlify/functions/homework_api?action=create_assignment')||'/.netlify/functions/homework_api?action=create_assignment';
   const response=await fetch(url,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const result=await response.json().catch(()=>({}));
   if(!response.ok||!result.success)throw Error(result.error||'Homework could not be created');
   if(form.elements.repeat.value!=='none'){
    const assignmentId=result.assignment_id||result.id||result.assignment?.id;
    if(!assignmentId)throw Error('Homework created, but the API did not return an assignment ID for repeating it.');
    const token=window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
    if(!token)throw Error('Homework created, but teacher login must be refreshed to configure recurrence.');
    const meResp=await fetch('https://fiieuiktlsivwfgyivai.supabase.co/auth/v1/user',{headers:{apikey:'sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e',Authorization:'Bearer '+token}});
    const me=meResp.ok?await meResp.json():null;
    if(!me?.id)throw Error('Homework created; unable to verify teacher identity to save recurrence.');
    const interval=form.elements.repeat.value==='daily'?1:7;
    const nextDue=new Date(new Date(due).getTime()+interval*86400000).toISOString();
    const scheduleResp=await fetch('https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/homework_recurring_schedules',{
     method:'POST',headers:{apikey:'sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e',Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=minimal'},
     body:JSON.stringify({source_assignment_id:assignmentId,created_by:me.id,cadence:form.elements.repeat.value,interval_days:interval,next_due_at:nextDue})
    });
    if(!scheduleResp.ok)throw Error('Homework created, but the recurring schedule could not be saved: '+(await scheduleResp.text()).slice(0,180));
   }
   status.textContent=form.elements.repeat.value==='none'?'Homework created. Check student progress under Manage Homework.':'Homework created and repeating schedule saved.';
   window.dispatchEvent(new CustomEvent('willena:assignment-created',{detail:{message:title+' · '+cls}}));
   form.reset();date.value=tomorrow.getFullYear()+'-'+String(tomorrow.getMonth()+1).padStart(2,'0')+'-'+String(tomorrow.getDate()).padStart(2,'0');
  }catch(error){status.textContent=error.message}finally{button.disabled=false}
 };
}


async function creativeManage(app,body){
 const label=app==='writing'?'Writing Genius':'Puzzles';
 body.innerHTML='<div class="ua-empty">Loading '+label+' homework…</div>';
 const route=(action,extra='')=>'/.netlify/functions/homework_api?action='+action+extra;
 const get=async(url,options={})=>{
  const resolved=window.WillenaAPI?.getApiUrl?.(url)||url;
  const response=await fetch(resolved,{credentials:'include',cache:'no-store',...options});
  const value=await response.json().catch(()=>({}));
  if(!response.ok||!value.success)throw Error(value.error||'Homework unavailable');
  return value;
 };
 try{
  const data=await get(route('list_assignments'));
  if(!body.isConnected)return;
  const rows=(data.assignments||[]).filter(a=>(a.list_meta?.creative_type||a.list_meta?.source_type)===(app==='writing'?'writing_genius':'puzzles'));
  const activeRows=rows.filter(a=>a.active!==false&&!a.ended_at);
  let view='current',classChoice='all';
  const paint=()=>{
   const chosen=rows.filter(a=>(classChoice==='all'||a.class===classChoice)&&(view==='history'?(a.active===false||!!a.ended_at):(a.active!==false&&!a.ended_at)));
   const classes=[...new Set(rows.map(a=>a.class).filter(Boolean))].sort();
   body.innerHTML='<div class="ua-genius-manage"><h3>Assignments</h3><p>'+label+' homework progress</p>'+
    '<div class="ua-genius-manage-toolbar"><select class="control" id="uaCreativeClass"><option value="all">All classes</option>'+classes.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('')+'</select>'+
    '<div class="ua-genius-current-history"><button type="button" data-period="current" class="'+(view==='current'?'active':'')+'">Current</button><button type="button" data-period="history" class="'+(view==='history'?'active':'')+'">History</button></div>'+
    '<button type="button" class="control" id="uaCreativeRefresh">Refresh</button></div>'+
    (chosen.length?'<div class="ua-genius-manage-list">'+window.WillenaGeniusHomeworkCard.groupByDate(chosen,a=>
     window.WillenaGeniusHomeworkCard.card({id:a.id,className:a.class,qrUrl:'https://students.willenaenglish.com'+(app==='writing'?'/students/writing-genius/?homework='+encodeURIComponent(a.id):'/students/wordsearch/?homework='+encodeURIComponent(a.id)+'&mode='+encodeURIComponent(a.list_meta?.kind||'boggle')),
     task:(a.list_meta?.kind==='sentence'?(a.list_meta?.unit_label||a.title):(a.title||'Homework')),
     dueAt:a.due_at,teacher:a.teacher_name||a.created_by_name||'',createdBy:a.created_by,
     progressLabel:'Student progress',
     body:'<button type="button" class="control ua-assign ghc-load-action" data-creative-progress="'+esc(a.id)+'" hidden>Load student results</button>'+
      '<div data-creative-results="'+esc(a.id)+'" aria-live="polite"></div>'})
    )+'</div>':'<div class="ua-empty">No '+label+' homework in this view.</div>')+'</div>';
   body.querySelector('#uaCreativeClass').value=classChoice;
   body.querySelector('#uaCreativeClass').onchange=e=>{classChoice=e.target.value;paint()};
   body.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{view=b.dataset.period;paint()});
   body.querySelector('#uaCreativeRefresh').onclick=()=>void creativeManage(app,body);
   attachProgress();
   void window.WillenaGeniusHomeworkCard?.hydrateTeachers(body);
   // Reuse real submission/completion records for each visible class ring.
   void (async()=>{
    const token=window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
    if(!token)return;
    const endpoints=app==='writing'?['teacher_creative_writing_progress_v1','teacher_writing_sentence_homework_progress_v1']:['teacher_puzzle_homework_progress_v1'];
    const results=await Promise.allSettled(endpoints.map(async endpoint=>{
     const response=await fetch('https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/'+endpoint,{
      method:'POST',headers:{apikey:'sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e',Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});
     if(!response.ok)throw Error('Progress unavailable');
     return response.json();
    }));
    const progress=new Map();
    results.forEach(result=>{if(result.status==='fulfilled'&&Array.isArray(result.value))result.value.forEach(x=>progress.set(String(x.id),x))});
    for(const item of chosen){
     const stat=progress.get(String(item.id));
     window.WillenaGeniusHomeworkCard?.updateRing(item.id,stat&&Number(stat.students)>0?(item.list_key==='writing_genius:sentence'?Number(stat.progress_percent||0):100*Number(stat.completed||0)/Number(stat.students)):null,body);
    }
   })();

  };
  const attachProgress=()=>{body.querySelectorAll('[data-creative-progress]').forEach(button=>button.addEventListener('click',async()=>{
   const host=body.querySelector('[data-creative-results="'+button.dataset.creativeProgress+'"]');
   if(!host)return;host.textContent='Checking submitted work…';
   try{
    const token=window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
    const record=rows.find(x=>x.id===button.dataset.creativeProgress);
    const endpoint=app==='writing'?(record?.list_key==='writing_genius:sentence'?'teacher_writing_sentence_homework_progress_v1':'teacher_creative_writing_progress_v1'):'teacher_puzzle_homework_progress_v1';
    const response=await fetch('https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/'+endpoint,{method:'POST',headers:{apikey:'sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e',Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});
    if(!response.ok)throw Error('Progress unavailable');
    const matches=await response.json(),result=matches.find(x=>x.id===button.dataset.creativeProgress);
    if(!result){host.textContent='No linked student progress yet.';return}
    const isSentence=record?.list_key==='writing_genius:sentence';
    const writingStage=st=>({not_started:'Not started',started:'Draft opened',writing:'Writing draft',reviewed:'AI review done',speaking_done:'Speaking recorded',completed:'Completed'})[st.stage]||(st.completed?'Completed':'Not started');
    host.innerHTML=isSentence?'<p><b>'+Number(result.progress_percent||0)+'%</b> progress · '+Number(result.checked||0)+'/'+Number(result.total_questions||0)+' questions checked</p>'+(result.student_rows||[]).map(st=>'<div class="ua-creative-student-row"><span>'+esc(st.name)+'</span><span>'+Number(st.checked||0)+'/'+Number(st.total||0)+' · '+Number(st.progress_percent||0)+'%</span></div>').join(''):'<p><b>'+result.completed+' / '+result.students+'</b> completed</p>'+(result.student_rows||[]).map(st=>{
      const body=String(st.draft_body||'').trim();
      const preview=body&&!st.completed?'<details style="margin:4px 0 12px;padding:8px 12px;border:1px solid #cde6e8;border-radius:10px"><summary style="cursor:pointer;color:#25838b">View saved draft'+(st.draft_title?' · '+esc(st.draft_title):'')+'</summary><p style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(body)+'</p></details>':'';
      return '<div class="ua-creative-student-row"><span>'+esc(st.name)+'</span><span>'+esc(writingStage(st))+'</span></div>'+preview;
    }).join('');
   }catch(e){host.textContent=e.message}
  }))};
  paint();
  // Recurrences are independent templates, so pausing one never deletes earlier homework.
  const token=window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
  if(token){
   try{
    const base='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/homework_recurring_schedules';
    const headers={apikey:'sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e',Authorization:'Bearer '+token};
    const res=await fetch(base+'?select=id,source_assignment_id,cadence,active,next_due_at&order=created_at.desc',{headers,cache:'no-store'});
    if(res.ok){
     const templates=await res.json(), ids=new Set(rows.map(x=>x.id));
     const relevant=templates.filter(x=>ids.has(x.source_assignment_id));
     if(relevant.length){
      const section=document.createElement('section');section.className='ua-feature';
      section.innerHTML='<h4>Recurring homework ('+relevant.length+')</h4>'+
       relevant.map(item=>'<div class="ua-actions" style="margin:10px 0;gap:12px"><span>'+esc(rows.find(x=>x.id===item.source_assignment_id)?.title||'Homework')+' · '+esc(item.cadence)+' · '+esc(new Date(item.next_due_at).toLocaleDateString('ko-KR'))+'</span><button type="button" class="control" data-repeat-toggle="'+esc(item.id)+'">'+(item.active?'Pause':'Resume')+'</button></div>').join('');
      body.prepend(section);
      section.querySelectorAll('[data-repeat-toggle]').forEach(button=>button.addEventListener('click',async()=>{
       const item=relevant.find(x=>x.id===button.dataset.repeatToggle);if(!item)return;
       button.disabled=true;
       try{
        const resp=await fetch(base+'?id=eq.'+encodeURIComponent(item.id),{method:'PATCH',headers:{...headers,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({active:!item.active})});
        if(!resp.ok)throw Error('Could not update schedule');
        item.active=!item.active;button.textContent=item.active?'Pause':'Resume';
       }catch(e){alert(e.message)}finally{button.disabled=false}
      }));
     }
    }
   }catch(e){console.warn('Recurring homework controls unavailable',e)}
  }
 }catch(e){if(body.isConnected)body.innerHTML='<div class="ua-empty">'+esc(e.message)+'</div>'}
}

const overviewMountedHosts=new WeakSet();
function activate(){
 // The workspace is built while its dashboard view is hidden on initial load.
 // Start the My/All fetch on first visibility, without waiting for a second tab click.
 if(!root.closest('.view')?.classList.contains('active'))return;
 if(active==='classes'){window.dispatchEvent(new CustomEvent('willena:curriculum-mount',{detail:{target:'assignments'}}));return;}
 if(active!=='my'&&active!=='all')return;
 const host=root.querySelector('#uaOverview');
 if(!host||overviewMountedHosts.has(host))return;
 overviewMountedHosts.add(host);
 const requested=active;
 const ready=(attempt=0)=>{
  if(!host.isConnected||active!==requested)return;
  if(window.UniversalAssignmentTracker?.loadOverview){
   void window.UniversalAssignmentTracker.loadOverview(requested);
  }else if(attempt<80){
   setTimeout(()=>ready(attempt+1),150);
  }else{
   overviewMountedHosts.delete(host);
   host.textContent='Assignment tracker unavailable. Please refresh the dashboard.';
  }
 };
 ready();
}
function groupRows(){return window.NaesinV2Data?.getCachedGroups?.()||[]}
function render(){
 restoreWordPanel();
 const strip=root.querySelector('.ua-app-tabs');
 const previousScroll=strip?strip.scrollLeft:(Number(saved.scrollLeft)||0);
 const selected=apps.find(a=>a.id===active),sub=subviews[active];
 root.innerHTML=
 '<div class="ua-app-tabs" role="tablist" aria-label="Assignment app">'+apps.map(a=>'<button type="button" role="tab" aria-selected="'+(active===a.id)+'" class="ua-app-tab'+(active===a.id?' active':'')+'" data-ua-tab="'+a.id+'"><span class="ua-app-icon" aria-hidden="true">'+a.icon+'</span><span class="ua-app-label"><b>'+a.label+'</b></span></button>').join('')+'</div>'+
 '<section class="ua-workspace" aria-label="'+selected.label+' assignments"><div class="ua-section-heading"><div><div class="ua-eyebrow">'+(['my','all','calendar','classes'].includes(active)?'REVIEW HOMEWORK':'CREATE & MANAGE')+'</div><h3>'+selected.label+'</h3></div><span class="ua-section-count" id="uaStatus">'+(active==='classes'?'Curriculum progress':active==='naesin'?groups.length+' exam groups':active==='word'?'Word Genius homework':active==='free-talking'?'Connected · Free Talking Genius':active==='grammar'?'Connected · Grammar Genius':active==='sentence'?'Connected · Sentence Genius':active==='writing'?'Writing homework':active==='puzzles'?'Puzzle homework':'Homework overview')+'</span></div>'+
 (['my','all','calendar','classes'].includes(active)?'':'<div class="ua-subtabs" role="tablist" aria-label="Homework workflow"><button type="button" role="tab" data-ua-sub="manage" class="ua-subtab'+(sub==='manage'?' active':'')+'" aria-selected="'+(sub==='manage')+'">Manage Homework</button><button type="button" role="tab" data-ua-sub="create" class="ua-subtab'+(sub==='create'?' active':'')+'" aria-selected="'+(sub==='create')+'">Assign Mission</button></div>')+
 '<div class="ua-app-body" id="uaAppBody"></div></section>';
 const nextStrip=root.querySelector('.ua-app-tabs');if(nextStrip){nextStrip.scrollLeft=previousScroll;nextStrip.addEventListener('scroll',()=>{try{const value=JSON.parse(sessionStorage.getItem(stateKey)||'{}');value.scrollLeft=nextStrip.scrollLeft;sessionStorage.setItem(stateKey,JSON.stringify(value))}catch{}},{passive:true})}
 root.querySelectorAll('[data-ua-tab]').forEach(b=>b.addEventListener('click',()=>{const next=b.dataset.uaTab;if(!['my','all','calendar','classes'].includes(next))subviews[next]=subviews[active];active=next;remember();render()}));
 root.querySelectorAll('[data-ua-sub]').forEach(b=>b.addEventListener('click',()=>{subviews[active]=b.dataset.uaSub;remember();render()}));
 renderNotifications();
 const body=root.querySelector('#uaAppBody');
 if(active==='classes'){
  body.innerHTML='<div id="assignmentClassGrid" class="curriculum-root"><div class="empty">Loading class curriculum…</div></div>';
  window.dispatchEvent(new CustomEvent('willena:curriculum-mount',{detail:{target:'assignments'}}));
  return;
 }
 if(active==='calendar'){body.innerHTML='<div id="uaCalendar">Loading calendar…</div>';window.UniversalAssignmentTracker?.loadCalendar?.();return}
 if(active==='my'||active==='all'){
   body.innerHTML='<div id="uaOverview" aria-live="polite">Loading cross-app homework…</div>';
   activate();
   return;
 }
 if(active==='naesin'&&sub==='manage'){body.innerHTML='<div id="uaProgress" aria-live="polite">Loading homework results…</div>';window.UniversalAssignmentTracker?.load?.();return}
 if(active==='naesin'){
  body.innerHTML='<div class="ua-actions"><p>Choose an exam group to open its assignment settings.</p><button type="button" class="control ua-outline" id="uaRefresh">'+(loading?'Refreshing…':'↻ Refresh groups')+'</button></div>'+
  (groups.length?'<div class="ua-grid">'+groups.map(item=>{const g=item.group||item;const lessons=(g.scope?.lessons||[]).map(l=>l.lesson).filter(Boolean).join(', ');return '<article class="ua-card"><div class="ua-card-top"><span class="ua-card-kicker">EXAM GROUP</span><span class="ua-card-dot" aria-hidden="true"></span></div><strong>'+esc(g.school||'내신')+'</strong><div class="ua-card-sub">'+esc(g.book_label||g.title||'Exam practice')+'</div><small>'+esc(lessons||'Choose questions and assign practice')+'</small><button type="button" class="control ua-assign" data-ua-group="'+esc(g.id)+'">Assign practice <span aria-hidden="true">→</span></button></article>'}).join('')+'</div>':'<div class="ua-empty"><div class="ua-empty-icon">▤</div><b>No exam groups loaded</b><p>Refresh to load your existing 내신 groups.</p></div>');
  body.querySelector('#uaRefresh')?.addEventListener('click',refresh);
  body.querySelectorAll('[data-ua-group]').forEach(b=>b.addEventListener('click',()=>{if(!window.NaesinV2Assignment?.open){alert('내신 assignment module is unavailable.');return}window.NaesinV2Assignment.open(b.dataset.uaGroup)}));return;
 }
 if(active==='word'){
 if(sub==='manage'){showWordPanel(body)}
 else{body.innerHTML='<div class="ua-word-actions"><div><h4>Assign Word Genius homework</h4><p>Choose database books and units or use Word Builder.</p></div><a class="control ua-primary" href="/Teachers/tools/wordtest/wordtest2.html">Open Word Builder →</a></div><div class="ua-catalog-host"></div>';window.dispatchEvent(new CustomEvent('ua:word-mounted'))}
 return;
 }
 if(active==='free-talking'){
   body.innerHTML='<div id="uaFreeTalkingHomework"></div>';
   window.dispatchEvent(new CustomEvent('ua:free-talking-mounted',{detail:{sub}}));
   return;
 }
 if(active==='grammar'){
   body.innerHTML='<div id="uaGrammarHomework"></div>';
   window.dispatchEvent(new CustomEvent('ua:grammar-mounted',{detail:{sub,fromCurriculum:curriculumLaunchApp==='grammar'}}));
   return;
 }
 if(active==='writing'){
   if(sub==='create'){homeworkForm('writing',body);return}
   void creativeManage('writing',body);return;

 }
 if(active==='sentence'){
   body.innerHTML='<div id="uaSentenceHomework"></div>';
   window.dispatchEvent(new CustomEvent('ua:sentence-mounted',{detail:{sub}}));
   return;
 }
 if(active==='puzzles'){if(sub==='create')homeworkForm('puzzles',body);else void creativeManage('puzzles',body);return}
 const desc=sub==='manage'?'Homework tracking is not connected for this app yet.':active==='grammar'?'Grammar step assignment creation is not connected yet.':'Puzzle assignment creation is not connected yet.';
 body.innerHTML='<div class="ua-feature ua-unavailable"><div class="ua-feature-symbol">'+(active==='grammar'?'G':'◇')+'</div><div class="ua-feature-copy"><span class="ua-coming-label">Assignment integration pending</span><h4>'+selected.label+' assignments</h4><p>'+desc+' The assignment connection is not built yet; existing student progress is unaffected.</p></div></div>';
}
async function refresh(){
 if(loading)return;loading=true;try{await window.NaesinV2Data?.loadGroups?.();groups=groupRows()}catch(e){console.warn('Assignments load unavailable',e)}finally{loading=false;if(active==='naesin')render()}
}
// Contextual launcher for Class Curriculum. Never submits a mission: it only
// selects existing class/book/unit controls in the canonical creation workspace.
let curriculumLaunchId=0,curriculumLaunchCleanup=null,curriculumLaunchApp=null;
function openCurriculumCreate(context){
 const map={word:'word',sentence:'sentence',grammar:'grammar',speaking:'free-talking',talking:'free-talking',freeconversation:'free-talking',writing:'writing',puzzles:'puzzles'};
 const app=map[context?.skill];
 if(!app||!context?.className||!context?.bookId||!context?.unitId)return false;
 if(curriculumLaunchCleanup)curriculumLaunchCleanup();
 curriculumLaunchApp=app;
 active=app;subviews[app]='create';remember();render();
 const id=++curriculumLaunchId,scope=root,started=Date.now();
 const target={className:String(context.className),bookId:String(context.bookId),unitId:String(context.unitId),unitNumber:Number(context.unitNumber),bookTitle:String(context.bookTitle||'')};
 const forms={
  word:{class:'#uaClass',book:'#uaBook',unit:'[data-ua-unit]'},
  sentence:{class:'#sgtClass',book:'#sgtBook',unit:'[data-sg-unit]'},
  grammar:{class:'#gbHwForm select[name="klass"]',book:'#gbHwForm select[name="book"]',unit:'[data-chapter]'},
  'free-talking':{class:'#ftTeacherAssignForm select[name="klass"]',book:'#ftTeacherAssignForm select[name="book"]',unit:'[data-ft-unit]'},
  writing:{class:'#uaNewHomework select[name="class"]',book:'#uaNewHomework select[name="book"]',unit:'#uaNewHomework select[name="unit"]'},
  puzzles:{class:'#uaNewHomework select[name="class"]',book:null,unit:null}
 };
 const config=forms[app];let stage=app==='writing'?'kind':'class',finished=false;
 const desiredTalkMode=context.skill==='freeconversation'?'conversation':context.skill==='talking'||context.skill==='speaking'?'speaking':null;
 const optionReady=(el,value)=>el&&[...el.options].some(o=>o.value===value&&!o.disabled);
 const choose=(el,value)=>{el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}))};
 const notice=(message)=>{
  const host=scope.querySelector('#uaAppBody');if(!host)return;
  let el=host.querySelector('#uaCurriculumContextNotice');
  if(!el){el=document.createElement('p');el.id='uaCurriculumContextNotice';el.className='ua-note';el.setAttribute('role','status');host.prepend(el)}
  el.textContent=message;
 };
 let observer,timer;
 const cleanup=()=>{observer?.disconnect();clearTimeout(timer);if(curriculumLaunchCleanup===cleanup){curriculumLaunchCleanup=null;curriculumLaunchApp=null}};
 curriculumLaunchCleanup=cleanup;
 const apply=()=>{
  if(finished||id!==curriculumLaunchId)return cleanup();
  if(stage==='kind'){
   const kind=scope.querySelector('#uaNewHomework select[name="kind"]');
   if(!kind)return;
   if(optionReady(kind,'sentence'))choose(kind,'sentence');
   stage='class';
  }
  if(stage==='class'){
   if(desiredTalkMode){const modeSelect=scope.querySelector('#ftTeacherAssignForm select[name="mission_mode"]');if(modeSelect&&modeSelect.value!==desiredTalkMode)choose(modeSelect,desiredTalkMode)}
   const el=scope.querySelector(config.class);
   if(!optionReady(el,target.className))return;
   choose(el,target.className);stage=config.book?'book':'done';queueMicrotask(apply);
   if(stage==='done'){finished=true;notice('Selected class '+target.className+'. Choose the puzzle game and its content before assigning.');cleanup();}
   return;
  }
  if(stage==='book'){
   const el=scope.querySelector(config.book);
   if(!optionReady(el,target.bookId))return;
   choose(el,target.bookId);stage='unit';queueMicrotask(apply);
   return;
  }
  if(stage==='unit'){
   const nodes=[...scope.querySelectorAll(config.unit)];
   if(!nodes.length)return;
   if(app==='writing'){
    const el=nodes[0];
    if(!optionReady(el,target.unitId))return;
    choose(el,target.unitId);
   }else{
    const el=nodes.find(x=>
      String(x.value||x.dataset.sgUnit||'')===target.unitId ||
      (app==='grammar'&&Number(x.dataset.chapter)===target.unitNumber));
    if(!el)return;
    el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));
   }
   stage='done';
  }
  if(stage==='done'){
   finished=true;
   notice('Selected: '+target.className+' · '+(target.bookTitle||'Textbook')+' · Unit '+target.unitNumber+'. Review the options and due date before assigning.');
   cleanup();
  }
 };
 observer=new MutationObserver(()=>apply());
 observer.observe(scope,{subtree:true,childList:true});
 timer=setTimeout(()=>{
  if(finished||id!==curriculumLaunchId)return;
  notice('Could not automatically select the '+(stage==='class'?'class':stage==='book'?'textbook':'unit')+'. Please choose it manually; no mission was created.');
  cleanup();
 },20000);
 apply();
 return true;
}
window.UniversalAssignments={refresh,activate,openCreate:openCurriculumCreate,openTab:id=>{if(apps.some(a=>a.id===id)){if(curriculumLaunchCleanup)curriculumLaunchCleanup();active=id;remember();render()}}};
document.querySelectorAll('[data-view="vocab"]').forEach(el=>el.addEventListener('click',restoreWordPanel));
groups=groupRows();render();void refresh();renderNotifications();
})();