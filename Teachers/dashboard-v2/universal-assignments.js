/* Assignment workspace. Uses existing dashboard panels and Naesin assignment API. */
(()=>{'use strict';
const root=document.getElementById('universalAssignments');if(!root)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const apps=[{id:'my',label:'My',sub:'My homework',icon:'◎'},{id:'all',label:'All',sub:'All homework',icon:'▦'},{id:'calendar',label:'Calendar',sub:'Assignment dates',icon:'▦'},{id:'naesin',label:'내신',sub:'Exam practice',icon:'文'},{id:'word',label:'Word Genius',sub:'Vocabulary',icon:'Aa'},{id:'grammar',label:'Grammar Genius',sub:'Grammar mastery',icon:'G'},{id:'sentence',label:'Sentence Genius',sub:'Sentence speaking & building',icon:'S'},{id:'puzzles',label:'Puzzles',sub:'Word games',icon:'◇'},{id:'writing',label:'Writing Genius',sub:'Diaries & topic writing',icon:'✎'}];
const stateKey='willena.teachers.assignments.v2';
let saved={};try{saved=JSON.parse(sessionStorage.getItem(stateKey)||'{}')||{}}catch{}
let active=apps.some(a=>a.id===saved.active)?saved.active:'my',loading=false,groups=[];
const remember=()=>{try{sessionStorage.setItem(stateKey,JSON.stringify({active,subviews,scrollLeft:(root.querySelector('.ua-app-tabs')?.scrollLeft??Number(saved.scrollLeft)??0)}))}catch{}};
const subviews={my:'manage',all:'manage',calendar:'manage',naesin:'manage',word:'manage',grammar:'manage',sentence:'manage',puzzles:'manage',writing:'manage'};
Object.keys(subviews).forEach(k=>{if(saved.subviews?.[k]==='create'||saved.subviews?.[k]==='manage')subviews[k]=saved.subviews[k]});
let wordPanel=null,wordHome=null;
function restoreWordPanel(){if(wordPanel&&wordHome&&wordPanel.parentElement!==wordHome)wordHome.appendChild(wordPanel)}
function showWordPanel(body){const panel=document.querySelector('[data-vocab-subview="assignments"]');if(!panel){body.innerHTML='<div class="ua-empty">Word Genius tracking unavailable.</div>';return}if(!wordPanel){wordPanel=panel;wordHome=panel.parentElement}panel.classList.add('ua-mounted-word');panel.classList.add('active');body.appendChild(panel);window.dispatchEvent(new CustomEvent('vocab:assignments-open'))}


const newHomeworkApps={
 writing:{heading:'Assign writing homework',types:[['diary','Daily diary'],['topic','Topic writing'],['sentence','Sentence writing (textbook)']]},
 puzzles:{heading:'Assign puzzle homework',types:[['boggle','Boggle'],['wordsearch','Word Search'],['crossword','Crossword'],['mixmatch','Mix & Match']]}
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
 '<button class="control ua-primary" type="submit">Assign homework →</button><div id="uaNewHomeworkStatus" role="status"></div></form>';
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
    (chosen.length?'<div class="ua-genius-manage-list">'+chosen.map(a=>
     window.WillenaGeniusHomeworkCard.card({id:a.id,className:a.class,
     task:(a.list_meta?.kind==='sentence'?(a.list_meta?.unit_label||a.title):(a.title||'Homework')),
     dueAt:a.due_at,teacher:a.teacher_name||a.created_by_name||'',
     progressLabel:'Student progress',
     body:'<button type="button" class="control ua-assign" data-creative-progress="'+esc(a.id)+'">Load student results</button>'+
      '<div data-creative-results="'+esc(a.id)+'" aria-live="polite"></div>'})
    ).join('')+'</div>':'<div class="ua-empty">No '+label+' homework in this view.</div>')+'</div>';
   body.querySelector('#uaCreativeClass').value=classChoice;
   body.querySelector('#uaCreativeClass').onchange=e=>{classChoice=e.target.value;paint()};
   body.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{view=b.dataset.period;paint()});
   body.querySelector('#uaCreativeRefresh').onclick=()=>void creativeManage(app,body);
   attachProgress();
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
    host.innerHTML='<p><b>'+result.completed+' / '+result.students+'</b> completed</p>'+(result.student_rows||[]).map(st=>'<div class="ua-creative-student-row"><span>'+esc(st.name)+'</span><span>'+(st.completed?'✓ Completed':'Not completed')+'</span></div>').join('');
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

function groupRows(){return window.NaesinV2Data?.getCachedGroups?.()||[]}
function render(){
 restoreWordPanel();
 const strip=root.querySelector('.ua-app-tabs');
 const previousScroll=strip?strip.scrollLeft:(Number(saved.scrollLeft)||0);
 const selected=apps.find(a=>a.id===active),sub=subviews[active];
 root.innerHTML=
 '<div class="ua-app-tabs" role="tablist" aria-label="Assignment app">'+apps.map(a=>'<button type="button" role="tab" aria-selected="'+(active===a.id)+'" class="ua-app-tab'+(active===a.id?' active':'')+'" data-ua-tab="'+a.id+'"><span class="ua-app-icon" aria-hidden="true">'+a.icon+'</span><span class="ua-app-label"><b>'+a.label+'</b></span></button>').join('')+'</div>'+
 '<section class="ua-workspace" aria-label="'+selected.label+' assignments"><div class="ua-section-heading"><div><div class="ua-eyebrow">'+(['my','all','calendar'].includes(active)?'REVIEW HOMEWORK':'CREATE & MANAGE')+'</div><h3>'+selected.label+'</h3></div><span class="ua-section-count" id="uaStatus">'+(active==='naesin'?groups.length+' exam groups':active==='word'?'Word Genius homework':active==='grammar'?'Connected · Grammar Genius':active==='sentence'?'Connected · Sentence Genius':active==='writing'?'Writing homework':active==='puzzles'?'Puzzle homework':'Homework overview')+'</span></div>'+
 (['my','all','calendar'].includes(active)?'':'<div class="ua-subtabs" role="tablist" aria-label="Homework workflow"><button type="button" role="tab" data-ua-sub="manage" class="ua-subtab'+(sub==='manage'?' active':'')+'" aria-selected="'+(sub==='manage')+'">Manage Homework</button><button type="button" role="tab" data-ua-sub="create" class="ua-subtab'+(sub==='create'?' active':'')+'" aria-selected="'+(sub==='create')+'">Assign Homework</button></div>')+
 '<div class="ua-app-body" id="uaAppBody"></div></section>';
 const nextStrip=root.querySelector('.ua-app-tabs');if(nextStrip){nextStrip.scrollLeft=previousScroll;nextStrip.addEventListener('scroll',()=>{try{const value=JSON.parse(sessionStorage.getItem(stateKey)||'{}');value.scrollLeft=nextStrip.scrollLeft;sessionStorage.setItem(stateKey,JSON.stringify(value))}catch{}},{passive:true})}
 root.querySelectorAll('[data-ua-tab]').forEach(b=>b.addEventListener('click',()=>{const next=b.dataset.uaTab;if(!['my','all','calendar'].includes(next))subviews[next]=subviews[active];active=next;remember();render()}));
 root.querySelectorAll('[data-ua-sub]').forEach(b=>b.addEventListener('click',()=>{subviews[active]=b.dataset.uaSub;remember();render()}));
 const body=root.querySelector('#uaAppBody');
 if(active==='calendar'){body.innerHTML='<div id="uaCalendar">Loading calendar…</div>';window.UniversalAssignmentTracker?.loadCalendar?.();return}
 if(active==='my'||active==='all'){
   body.innerHTML='<div id="uaOverview" aria-live="polite">Loading cross-app homework…</div>';
   window.UniversalAssignmentTracker?.loadOverview?.(active);
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
 if(active==='grammar'){
   body.innerHTML='<div id="uaGrammarHomework"></div>';
   window.dispatchEvent(new CustomEvent('ua:grammar-mounted',{detail:{sub}}));
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
window.UniversalAssignments={refresh,openTab:id=>{if(apps.some(a=>a.id===id)){active=id;remember();render()}}};
document.querySelectorAll('[data-view="vocab"]').forEach(el=>el.addEventListener('click',restoreWordPanel));
groups=groupRows();render();void refresh();
})();