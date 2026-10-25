/* Sentence Genius - teacher-grade simulator + unit homework, shared workspace. */
(()=>{'use strict';
const OP='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/';
const OPKEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const DB='https://gxwfsqxyuufqtitspfqg.supabase.co/rest/v1/';
const DBKEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const $=(selector,root=document)=>root.querySelector(selector);
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const state={books:null,classes:null,units:[],items:[],selected:[],bookId:'',unitId:'',managerMode:'manage',assignmentFilter:'current',assignments:[],progress:new Map(),revision:0};
const types={coach:'코치',unscramble:'문장 배열',speaking:'말하기'};
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const norm=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9' ]/g,' ').replace(/\s+/g,' ').trim();
const dateDefault=()=>{const d=new Date(Date.now()+7*86400000);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
function status(host,message){const node=$('[data-sg-status]',host);if(node)node.textContent=message||''}
async function catalog(path){const r=await fetch(DB+path,{headers:{apikey:DBKEY,Authorization:'Bearer '+DBKEY},cache:'no-store'});if(!r.ok)throw Error('Textbook data unavailable ('+r.status+')');return r.json()}
async function jwt(refresh=false){
 let token=window.WillenaAPI?.getLocalAccessToken?.()||'';
 if(token&&!refresh)return token;
 const url='/.netlify/functions/supabase_auth?action=refresh';
 const response=await (window.WillenaAPI?.fetch?window.WillenaAPI.fetch(url):fetch(url,{credentials:'include'}));
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.access_token)throw Error('Teacher login expired');
 window.WillenaAPI?.setLocalTokens?.(data.access_token,data.refresh_token||'');
 return data.access_token;
}
async function rpc(action,args={}){
 const call=token=>fetch(OP+'rpc/'+action,{method:'POST',cache:'no-store',
  headers:{apikey:OPKEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args)});
 let res=await call(await jwt());if(res.status===401)res=await call(await jwt(true));
 const data=await res.json().catch(()=>({}));
 if(!res.ok||data.success!==true)throw Error(data.message||data.error||'Homework service failed ('+res.status+')');
 return data;
}
async function books(){
 if(state.books)return state.books;
 state.books=await catalog('content_books?select=id,title&status=in.(review,published)&order=title.asc&limit=900');
 return state.books;
}
async function classes(){
 if(state.classes)return state.classes;
 const result=await rpc('get_sentence_genius_teacher_classes',{});
 state.classes=Array.isArray(result.classes)?result.classes:[];return state.classes;
}
async function units(bookId){
 if(!bookId)return[];
 return catalog('content_units?select=id,unit_number,title,metadata&status=in.(review,published)&book_id=eq.'+encodeURIComponent(bookId)+'&order=unit_number.asc&limit=300');
}
async function sentences(bookId,unitId){
 if(!bookId||!unitId)return[];
 const occ=await catalog('source_content_occurrences?select=id,sentence_id,page_number&status=in.(review,published)&sentence_id=not.is.null&book_id=eq.'+encodeURIComponent(bookId)+'&unit_id=eq.'+encodeURIComponent(unitId)+'&order=page_number.asc&limit=900');
 const ids=[...new Set(occ.map(x=>x.sentence_id).filter(x=>uuidPattern.test(x)))];
 if(!ids.length)return[];
 const sentences=[];
 for(let start=0;start<ids.length;start+=65){
  sentences.push(...await catalog('sentences?select=id,canonical_text,text,translation_ko,contraction_policy,status&status=in.(review,published)&id=in.('+ids.slice(start,start+65).join(',')+')&limit=100'));
 }
 const byId=new Map(sentences.map(x=>[x.id,x])),seen=new Set();
 // Match the student Sentence Genius eligible-sentence selection exactly.
 const linkedIds=new Set();
 for(let start=0;start<ids.length;start+=65){
  const links=await catalog('sentence_patterns?select=sentence_id&sentence_id=in.('+ids.slice(start,start+65).join(',')+')&limit=900');
  for(const link of links)linkedIds.add(link.sentence_id);
 }
 const linked=occ.filter(row=>linkedIds.has(row.sentence_id));
 const ordered=(linked.length>=3?linked:occ).slice().sort((a,b)=>
   Number(linkedIds.has(b.sentence_id))-Number(linkedIds.has(a.sentence_id)));
 const policies=await catalog('sentence_genius_policies?select=occurrence_id,grading_mode,required_pattern_id,policy_version,accepted_alternatives&status=eq.published&occurrence_id=in.('+occ.map(x=>x.id).join(',')+')&limit=900');
 const overrides=new Map(policies.map(p=>[p.occurrence_id,p]));
 return ordered.flatMap(o=>{
  const row=byId.get(o.sentence_id);
  const en=String(row?.canonical_text||row?.text||'').trim(),ko=String(row?.translation_ko||'').trim();
  if(!row||!en||!ko||en.split(/\s+/).length<2||!/[a-z]/i.test(en)||seen.has(row.id))return[];
  seen.add(row.id);
  const policy=overrides.get(o.id);
  return[{id:row.id,occurrenceId:o.id,en,ko,
   gradingContext:{mode:policy?.grading_mode||'flexible',
     policyVersion:policy?.policy_version||0,
     requiredPatternId:policy?.required_pattern_id||null,
     approvedAlternatives:policy?.accepted_alternatives||[],
     contractionPolicy:row.contraction_policy||'allow_equivalent'}}];
 });
}
const options=(rows,placeholder,field='title')=>'<option value="">'+escapeHtml(placeholder)+'</option>'+
 rows.map(r=>'<option value="'+escapeHtml(r.id)+'">'+escapeHtml(r[field]||r.name||'Untitled')+'</option>').join('');
const wrapper=(title,subtitle)=>'<div class="sgt-head"><h3>'+escapeHtml(title)+'</h3><p>'+escapeHtml(subtitle)+'</p></div>';
function teacherRoot(){return $('#sgTeacherWorkspace')}
function assignmentRoot(){return $('#uaSentenceHomework')}
// Keep statistics the entry screen. The grading lab mounts only when opened.
const teacherTabs=['stats','lab'];
function setTeacherTab(root,name){
 const tab=teacherTabs.includes(name)?name:'stats';
 root.querySelectorAll('[data-sgt-tab]').forEach(button=>{
  const selected=button.dataset.sgtTab===tab;
  button.classList.toggle('active',selected);
  button.setAttribute('aria-selected',String(selected));
  button.tabIndex=selected?0:-1;
 });
 root.querySelectorAll('[data-sgt-panel]').forEach(panel=>{
  panel.hidden=panel.dataset.sgtPanel!==tab;
 });
 if(tab==='lab'){
  const lab=$('#sgtLabPanel',root);
  if(lab&&!lab.dataset.initialized){
   lab.dataset.initialized='true';
   void mountGradingLab(root);
  }
 }
}
function statsShell(){
 return '<div class="sgt-stats-intro">'+wrapper('Sentence Genius · General Progress',
   'Real student results for 코치, 문장 배열 and 말하기. Recent accuracy includes retry attempts; unit mastery is verified separately.')+
   '<button type="button" class="control ua-primary" id="sgtStatsGoHomework">Manage Assignments</button></div>'+
   '<section id="sgtGeneralStats" aria-label="Sentence Genius student progress"></section>'+
   '<section class="sgt-class-dashboard" id="sgtClassDashboard">'+
   '<div class="sgt-head"><h3>Homework completion</h3><p>Assigned sentences and selected steps only; tracked separately from general practice.</p></div>'+
   '<div class="sgt-stats-filter"><label for="sgtProgressClass">Homework class</label>'+
   '<select id="sgtProgressClass" class="control"><option value="">Loading classes…</option></select>'+
   '<button type="button" class="control" id="sgtClassRefresh">↻ Refresh homework</button></div>'+
   '<div id="sgtClassProgress" class="sgt-progress-overview" aria-live="polite">Loading homework classes…</div></section>';
}
function gradingShell(){
 return wrapper('Grading Lab · Preview only',
   'Test the treatment of a textbook sentence. No student attempts, points, stars or progress are saved.')+
 '<div class="sgt-lab-note" role="note">A typed transcript tests answer grading, not microphone recognition or audio playback. Check real student behavior in the student app.</div>'+
 '<div class="sgt-fields"><label>Book<select id="sgtTestBook" class="control"></select></label>'+
 '<label>Unit<select id="sgtTestUnit" class="control"><option value="">Select book first</option></select></label>'+
 '<label>Sentence<select id="sgtTestSentence" class="control"><option value="">Select unit first</option></select></label></div>'+
 '<div class="sgt-target" id="sgtTestPrompt">Choose a textbook sentence to test.</div>'+
 '<div class="sgt-fields"><label class="sgt-wide">Student answer (typed transcript)'+
 '<input id="sgtTestAnswer" type="text" class="control" placeholder="Type a possible student answer"></label></div>'+
 '<div class="sgt-actions"><button type="button" class="control ua-primary" id="sgtTestCheck" disabled>Test Answer</button>'+
 '<button type="button" class="control" id="sgtLabGoHomework">Open Assignments</button></div>'+
 '<div class="sgt-result" id="sgtTestResult" role="status" aria-live="polite">Preview ready.</div>';
}
function openSentenceAssignments(){
 document.querySelector('[data-view="assignments"]')?.click();
 window.UniversalAssignments?.openTab?.('sentence');
}
async function teacherOpen(){
 const root=teacherRoot();if(!root)return;
 // Reopening Sentence Genius always leads with statistics instead of the lab.
 root.innerHTML='<div class="sgt-tab-list" role="tablist" aria-label="Sentence Genius sections">'+
 '<button type="button" class="sgt-tab active" data-sgt-tab="stats" role="tab" id="sgtTabStats" aria-controls="sgtStatsPanel" aria-selected="true">Statistics</button>'+
 '<button type="button" class="sgt-tab" data-sgt-tab="lab" role="tab" id="sgtTabLab" aria-controls="sgtLabPanel" aria-selected="false">Grading Lab</button></div>'+
 '<section id="sgtStatsPanel" role="tabpanel" aria-labelledby="sgtTabStats" data-sgt-panel="stats">'+statsShell()+'</section>'+
 '<section id="sgtLabPanel" role="tabpanel" aria-labelledby="sgtTabLab" data-sgt-panel="lab" hidden></section>';
 root.querySelectorAll('[data-sgt-tab]').forEach(button=>{
  button.onclick=()=>setTeacherTab(root,button.dataset.sgtTab);
  button.onkeydown=event=>{
   if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
   event.preventDefault();
   const target=button.dataset.sgtTab==='stats'?'lab':'stats';
   setTeacherTab(root,target);
   root.querySelector('[data-sgt-tab="'+target+'"]')?.focus();
  };
 });
 setTeacherTab(root,'stats');
 $('#sgtStatsGoHomework',root).onclick=openSentenceAssignments;
 void mountSentenceStatistics(root);
 const classEl=$('#sgtProgressClass',root);
 const loadHomework=()=>void loadClassSentenceProgress(root,classEl.value);
 classEl.onchange=loadHomework;
 $('#sgtClassRefresh',root).onclick=loadHomework;
 try{
  const list=await classes();
  if(!root.isConnected||!classEl.isConnected)return;
  classEl.innerHTML='<option value="">Select class</option>'+
   list.map(row=>'<option value="'+escapeHtml(row.name)+'">'+escapeHtml(row.display_name||row.name)+'</option>').join('');
  const current=document.querySelector('#classSelect')?.value||'';
  const initial=list.find(c=>c.name===current)?.name||list[0]?.name||'';
  classEl.value=initial;
  if(initial)loadHomework();
  else $('#sgtClassProgress',root).textContent='No active classes found.';
 }catch(error){
  if(root.isConnected)$('#sgtClassProgress',root).textContent='Homework classes unavailable: '+error.message;
 }
}
async function mountGradingLab(root){
 const lab=$('#sgtLabPanel',root);if(!lab||!lab.isConnected)return;
 lab.innerHTML=gradingShell();
 const bookEl=$('#sgtTestBook',lab),unitEl=$('#sgtTestUnit',lab),sentenceEl=$('#sgtTestSentence',lab),
  test=$('#sgtTestCheck',lab),prompt=$('#sgtTestPrompt',lab),out=$('#sgtTestResult',lab);
 $('#sgtLabGoHomework',lab).onclick=openSentenceAssignments;
 let items=[],bookRevision=0,sentenceRevision=0;
 const update=()=>{
  const item=items.find(row=>row.id===sentenceEl.value);
  prompt.textContent=item?item.ko+' · '+item.en:'Choose a textbook sentence to test.';
  test.disabled=!item;
 };
 const clearSentence=()=>{
  items=[];sentenceEl.innerHTML='<option value="">Select unit first</option>';
  $('#sgtTestAnswer',lab).value='';test.disabled=true;update();
 };
 bookEl.onchange=async()=>{
  const revision=++bookRevision;++sentenceRevision;clearSentence();
  unitEl.innerHTML='<option value="">Loading units…</option>';out.textContent='';
  if(!bookEl.value){unitEl.innerHTML='<option value="">Select book first</option>';return}
  try{
   const list=await units(bookEl.value);
   if(revision!==bookRevision||!bookEl.isConnected)return;
   unitEl.innerHTML=options(list,'Choose unit','unit_number');
  }catch(error){if(revision===bookRevision){unitEl.innerHTML='<option value="">Units unavailable</option>';out.textContent=error.message}}
 };
 unitEl.onchange=async()=>{
  const revision=++sentenceRevision;items=[];test.disabled=true;
  sentenceEl.innerHTML='<option value="">Loading sentences…</option>';
  out.textContent='';prompt.textContent='Loading textbook sentences…';
  if(!unitEl.value){clearSentence();return}
  try{
   const rows=await sentences(bookEl.value,unitEl.value);
   if(revision!==sentenceRevision||!sentenceEl.isConnected)return;
   items=rows;
   sentenceEl.innerHTML=options(rows,'Choose sentence','en');
   update();
   if(!rows.length)out.textContent='No eligible translated sentences in this unit.';
  }catch(error){if(revision===sentenceRevision){clearSentence();out.textContent=error.message}}
 };
 sentenceEl.onchange=()=>{out.textContent='';update()};
 test.onclick=async()=>{
  const item=items.find(row=>row.id===sentenceEl.value),answer=$('#sgtTestAnswer',lab).value.trim();
  if(!item||!answer){out.textContent='Choose a sentence and type an answer.';return}
  out.textContent='Checking with the Sentence Genius rules…';test.disabled=true;
  try{
   const result=await gradeTest(item,answer);
   if(!lab.isConnected)return;
   out.innerHTML='<strong>'+escapeHtml(result.label)+'</strong><p>'+
     escapeHtml(result.message||result.method||'')+'</p>'+
     '<small>Preview only · '+escapeHtml(result.method||'')+' · No student results saved</small>';
  }catch(error){out.textContent='Grading service unavailable: '+error.message}
  finally{if(test.isConnected)test.disabled=false}
 };
 try{
  bookEl.innerHTML='<option value="">Loading books…</option>';
  bookEl.innerHTML=options(await books(),'Choose textbook');
 }catch(error){bookEl.innerHTML='<option value="">Books unavailable</option>';out.textContent=error.message}
}

// General Progress mirrors Word Genius's performance matrix.
// Percentages here represent recent recorded answer accuracy, including retries.
// Drill-down mastery is calculated from independent correct saved sentence IDs.
async function mountSentenceStatistics(root){
 const host=$('#sgtGeneralStats',root);if(!host)return;
 host.innerHTML='<div class="sgt-stats-filter" aria-label="Statistics filters">'+
  '<label class="sgt-filter-field"><span>Class</span><select id="sgtStatsClass" class="control"><option value="">All classes</option></select></label>'+
  '<label class="sgt-filter-field"><span>Period</span><select id="sgtStatsDays" class="control">'+
    '<option value="30">Last 30 days</option><option value="14">Last 14 days</option>'+
    '<option value="60">Last 60 days</option><option value="90">Last 90 days</option></select></label>'+
  '<label class="sgt-filter-field sgt-filter-search"><span>Student</span><input id="sgtStatsSearch" class="control" type="search" placeholder="Search name…"></label>'+
  '<button type="button" class="control" id="sgtStatsRefresh">↻ Refresh</button></div>'+
  '<div class="sgt-matrix-summary" id="sgtStatsSummary" aria-live="polite"></div>'+
  '<div class="sgt-matrix"><div class="sgt-matrix-head" aria-hidden="true">'+
  '<span>Student</span><span>Overall</span><span>코치</span><span>문장 배열</span><span>말하기</span><span>Today</span></div>'+
  '<div id="sgtStatsRows" class="sgt-matrix-body"><div class="sgt-result">Loading student statistics…</div></div></div>'+
  '<p class="sgt-stats-footnote">Accuracy counts recorded answers, including retries, within the selected period. Unit mastery uses all-time independently correct sentences. Gold is confirmed only against the complete textbook unit.</p>';
 const classInput=$('#sgtStatsClass',host),daysInput=$('#sgtStatsDays',host),
  searchInput=$('#sgtStatsSearch',host),rowsHost=$('#sgtStatsRows',host),
  summary=$('#sgtStatsSummary',host);
 const view={students:[],expanded:'',generation:0,request:0,loading:false};
 const names=new Map(),unitInfo=new Map(),unitPromises=new Map(),eligiblePromises=new Map();
 const metric=(correct,attempts,kind,label)=>{
  const a=Number(attempts)||0,c=Number(correct)||0;
  return '<span class="sgt-matrix-metric '+kind+(a?'':' no-evidence')+'"><strong>'+
    (a?Math.round(100*c/a)+'%':'—')+'</strong><small>'+
    (a?a+' attempts':label)+'</small></span>';
 };
 const formatLast=value=>{
  if(!value)return 'Never';
  const d=new Date(value);return Number.isNaN(d.getTime())?'Unknown':
    d.toLocaleDateString('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'short',day:'numeric'});
 };
 const matched=()=>{const q=searchInput.value.trim().toLowerCase();
  return view.students.filter(p=>!q||[p.name,p.korean_name,p.class_name]
    .some(t=>String(t||'').toLowerCase().includes(q)));
 };
 function paint(){
  const people=matched(),active=people.filter(p=>Number(p.attempts)>0);
  const avg=active.length?Math.round(active.reduce((acc,p)=>acc+100*
    (Number(p.correct)||0)/Number(p.attempts),0)/active.length):null;
  const today=people.filter(p=>Number(p.today_attempts)>0).length;
  const units=people.reduce((n,p)=>n+(Number(p.units)||0),0);
  summary.innerHTML='<div class="sgt-summary-card"><b>'+(avg===null?'—':avg+'%')+
   '</b><span>Avg. answer accuracy</span></div>'+
   '<div class="sgt-summary-card"><b>'+today+'</b><span>Studied today</span></div>'+
   '<div class="sgt-summary-card"><b>'+active.length+' / '+people.length+
   '</b><span>Active in period</span></div>'+
   '<div class="sgt-summary-card"><b>'+units+'</b><span>Units with saved activity</span></div>';
  if(!people.length){rowsHost.innerHTML='<div class="sgt-matrix-empty">No students match this selection.</div>';return}
  rowsHost.innerHTML=people.map(p=>{
   const id=escapeHtml(String(p.id)),opened=view.expanded===String(p.id);
   return '<article class="sgt-matrix-entry">'+
    '<button type="button" class="sgt-matrix-row'+(opened?' is-selected':'')+
      '" data-sgt-student="'+id+'" aria-expanded="'+opened+'" aria-controls="sgtDetail-'+id+'">'+
     '<span class="sgt-matrix-student"><strong>'+escapeHtml(p.korean_name||p.name||'Student')+
      '</strong><small>'+escapeHtml(p.korean_name&&p.name?p.name+' · '+p.class_name:p.class_name||'')+'</small></span>'+
     metric(p.correct,p.attempts,'sgt-overall','No evidence')+
     metric(p.coach_correct,p.coach_attempts,'sgt-coach','No evidence')+
     metric(p.unscramble_correct,p.unscramble_attempts,'sgt-unscramble','No evidence')+
     metric(p.speaking_correct,p.speaking_attempts,'sgt-speaking','No evidence')+
     '<span class="sgt-matrix-today"><strong>'+(Number(p.today_attempts)||'—')+
     '</strong><small>'+(Number(p.today_attempts)?'attempts':'no activity')+'</small></span>'+
     '</button>'+
     '<div class="sgt-matrix-detail" id="sgtDetail-'+id+'"'+(opened?'':' hidden')+'>'+
      (opened?'<div class="sgt-matrix-empty">Loading textbook and unit mastery…</div>':'')+
     '</div></article>';
  }).join('');
  rowsHost.querySelectorAll('[data-sgt-student]').forEach(btn=>btn.onclick=()=>{
    const id=btn.dataset.sgtStudent;
    view.expanded=view.expanded===id?'':id;
    ++view.generation;paint();
    if(view.expanded){
     const selected=view.students.find(p=>String(p.id)===id);
     if(selected)void showStudentUnits(selected,view.generation);
    }
  });
 }
 async function unitCatalog(bookId){
  if(!unitPromises.has(bookId)){
   unitPromises.set(bookId,units(bookId).then(rows=>{
    for(const u of rows)unitInfo.set(String(u.id),u);
    return rows;
   }).catch(e=>{unitPromises.delete(bookId);throw e}));
  }
  return unitPromises.get(bookId);
 }
 async function eligibleFor(bookId,unitId){
  const k=bookId+'|'+unitId;
  if(!eligiblePromises.has(k)){
   eligiblePromises.set(k,sentences(bookId,unitId).catch(e=>{
    eligiblePromises.delete(k);throw e;
   }));
  }
  return eligiblePromises.get(k);
 }
 async function showStudentUnits(p,generation){
  const detail=$('#sgtDetail-'+String(p.id),host);
  if(!detail)return;
  const rows=Array.isArray(p.unit_list)?p.unit_list:[];
  if(!rows.length){
   detail.innerHTML='<p class="sgt-matrix-empty">No Sentence Genius units with saved activity yet.</p>';
   return;
  }
  const booksList=[...new Set(rows.map(r=>String(r.book_id)))];
  // Metadata does not affect the saved progress and must not block its display.
  try{
   const catalogBooks=await books();
   for(const b of catalogBooks)names.set(String(b.id),b.title);
  }catch(error){console.warn('[Sentence Genius] Book titles unavailable',error)}
  if(!detail.isConnected||generation!==view.generation)return;
  const bookGroups=new Map();
  rows.forEach((row,i)=>{
   const bookId=String(row.book_id);
   if(!bookGroups.has(bookId))bookGroups.set(bookId,[]);
   bookGroups.get(bookId).push({row,index:i});
  });
  detail.innerHTML='<div class="sgt-student-detail-head"><div><strong>'+
   escapeHtml(p.korean_name||p.name||'Student')+' · Unit mastery</strong>'+
   '<small>Saved independent passes · Across all time · Last recent activity '+escapeHtml(formatLast(p.last_activity))+
   '</small></div><span>'+rows.length+' units with activity</span></div>'+
   [...bookGroups.entries()].map(([bookId,entries])=>'<section class="sgt-book-detail">'+
   '<h4>'+escapeHtml(names.get(bookId)||'Book '+bookId.slice(0,8))+
   ' <small>'+entries.length+' units</small></h4>'+
   '<div class="sgt-unit-stack">'+entries.map(({row,index})=>'<div class="sgt-unit-item" data-sgt-unit-index="'+index+'">'+
    '<div class="sgt-unit-title"><strong>Unit · '+escapeHtml(String(row.unit_id).slice(0,8))+
    '</strong><span>Checking verified mastery…</span></div>'+
    '<div class="sgt-unit-quick">Saved passes: 코치 '+(Number(row.coach_passed)||0)+
    ' · 배열 '+(Number(row.unscramble_passed)||0)+' · 말하기 '+(Number(row.speaking_passed)||0)+'</div></div>').join('')+
    '</div></section>').join('');
  let cursor=0;
  const working=Array.from({length:Math.min(3,rows.length)},async()=>{
   while(cursor<rows.length){
    const idx=cursor++,row=rows[idx],bookId=String(row.book_id),unitId=String(row.unit_id);
    const holder=detail.querySelector('[data-sgt-unit-index="'+idx+'"]');
    if(!holder)return;
    try{
     const [source,mastery]=await Promise.all([
      eligibleFor(bookId,unitId),
      rpc('sg_teacher_unit_mastery_v1',{p_student_id:p.id,p_book_id:bookId,p_unit_id:unitId})
     ]);
     if(!detail.isConnected||generation!==view.generation)return;
     const eligibleIds=new Set(source.map(item=>String(item.id)));
     const total=eligibleIds.size,m=mastery.mastered||{};
     const counts={};
     for(const mode of ['coach','unscramble','speaking']){
      const records=Array.isArray(m[mode])?m[mode]:[];
      counts[mode]=new Set(records.map(String).filter(id=>eligibleIds.has(id))).size;
     }
     const all=['coach','unscramble','speaking'];
     const gold=total>0&&all.every(mode=>counts[mode]===total);
     const pct=total?Math.round(100*all.reduce((v,mode)=>v+counts[mode],0)/(total*3)):0;
     const unit=unitInfo.get(unitId);
     const unitTitle=unit?'Unit '+unit.unit_number+(unit.title?' · '+unit.title:''):'Unit '+unitId.slice(0,8);
     holder.innerHTML='<div class="sgt-unit-title"><strong>'+escapeHtml(unitTitle)+'</strong>'+
      '<span class="sgt-unit-status '+(gold?'is-gold':total&&pct?'is-working':'')+'">'+
       (gold?'★ Golden Unit':total?pct+'% mastered':'No eligible sentences')+'</span></div>'+
      (total?'<div class="sgt-unit-skills">'+
       all.map(mode=>{
        const label=types[mode],done=counts[mode];
        return '<div class="sgt-unit-skill"><span>'+label+'</span><b>'+done+' / '+total+'</b>'+
         '<div class="sgt-bar"><i style="width:'+Math.min(100,Math.round(done*100/total))+'%"></i></div></div>';
       }).join('')+'</div>':
       '<div class="sgt-unit-quick">No eligible translated sentences found for this unit.</div>');
    }catch(error){
     if(holder.isConnected&&generation===view.generation)
      holder.innerHTML='<strong>Unit '+escapeHtml(unitId.slice(0,8))+'</strong>'+
       '<div class="sgt-error">Could not verify Gold status: '+escapeHtml(error.message)+'</div>';
    }
   }
  });
  // Fetch unit labels once per book, independently of mastery calls.
  void Promise.allSettled(booksList.map(bookId=>unitCatalog(bookId))).then(()=>{
   if(!detail.isConnected||generation!==view.generation)return;
   rows.forEach((row,index)=>{
    const unit=unitInfo.get(String(row.unit_id)),slot=detail.querySelector('[data-sgt-unit-index="'+index+'"] .sgt-unit-title strong');
    if(unit&&slot)slot.textContent='Unit '+unit.unit_number+(unit.title?' · '+unit.title:'');
   });
  });
  await Promise.allSettled(working);
 }
 async function load(){
  const request=++view.request;view.expanded='';++view.generation;
  rowsHost.innerHTML='<div class="sgt-matrix-empty">Loading Sentence Genius performance…</div>';
  summary.innerHTML='';
  try{
   const result=await rpc('sg_teacher_statistics_v1',{
    p_class:classInput.value||null,p_days:Number(daysInput.value)||30
   });
   if(request!==view.request||!host.isConnected)return;
   view.students=Array.isArray(result.students)?result.students:[];
   paint();
  }catch(error){
   if(request!==view.request||!host.isConnected)return;
   rowsHost.innerHTML='<div class="sgt-error">Cannot load Sentence Genius statistics: '+escapeHtml(error.message)+'</div>';
  }
 }
 classInput.onchange=()=>void load();
 daysInput.onchange=()=>void load();
 searchInput.oninput=()=>{view.expanded='';++view.generation;paint()};
 $('#sgtStatsRefresh',host).onclick=()=>{
  unitPromises.clear();eligiblePromises.clear();names.clear();unitInfo.clear();
  void load();
 };
 try{
  const list=await classes();
  if(!host.isConnected)return;
  classInput.innerHTML='<option value="">All classes</option>'+list.map(c=>
   '<option value="'+escapeHtml(c.name)+'">'+escapeHtml(c.display_name||c.name)+'</option>').join('');
  await load();
 }catch(error){
  if(host.isConnected)rowsHost.innerHTML='<div class="sgt-error">Class list unavailable: '+escapeHtml(error.message)+'</div>';
 }
}

// Teacher overview uses the same secured homework progress RPC as Manage Homework.
let classProgressRequest=0;
async function loadClassSentenceProgress(root,className){
 const host=$('#sgtClassProgress',root),request=++classProgressRequest;
 if(!host)return;
 if(!className){host.textContent='Choose a class to view assigned unit progress.';return}
 host.textContent='Loading current Sentence Genius homework…';
 try{
  const response=await rpc('sg_homework_list_v1',{p_history:false});
  if(request!==classProgressRequest||!host.isConnected)return;
  const assignments=(response.assignments||[]).filter(a=>a.class_name===className&&a.active===true);
  if(!assignments.length){
   host.innerHTML='<p class="sgt-empty">No active Sentence Genius assignments for this class yet.</p>';
   return;
  }
  const results=await Promise.allSettled(assignments.map(a=>rpc('sg_homework_progress_v1',{p_id:a.id})));
  if(request!==classProgressRequest||!host.isConnected)return;
  const people=new Map(),failures=[];
  results.forEach((out,index)=>{
   const a=assignments[index];
   if(out.status==='rejected'){failures.push(a.title);return}
   for(const student of out.value.students||[]){
    const key=String(student.id);
    if(!people.has(key))people.set(key,{
      id:key,name:student.korean_name||student.name||'Student',done:0,total:0,
      coach:0,unscramble:0,speaking:0,assignments:[]
    });
    const row=people.get(key),done=Number(student.done)||0,total=Number(student.total)||0;
    row.done+=done;row.total+=total;
    row.coach+=Number(student.coach)||0;
    row.unscramble+=Number(student.unscramble)||0;
    row.speaking+=Number(student.speaking)||0;
    row.assignments.push({title:a.title,done,total,complete:total>0&&done===total});
   }
  });
  const students=[...people.values()].sort((a,b)=>
   (a.total?100*a.done/a.total:0)-(b.total?100*b.done/b.total:0));
  const activeCount=assignments.length-failures.length;
  const totalDone=students.reduce((sum,s)=>sum+s.done,0);
  const totalPossible=students.reduce((sum,s)=>sum+s.total,0);
  const completedHomework=students.reduce((count,s)=>count+s.assignments.filter(a=>a.complete).length,0);
  const summary='<div class="sgt-class-summary"><strong>'+activeCount+' assignments</strong>'+
   '<strong>'+students.length+' students</strong>'+ 
   '<strong>'+completedHomework+' homework items completed</strong>'+  
   '<strong>'+ (totalPossible?Math.round(100*totalDone/totalPossible):0)+'% overall completion</strong></div>';
  const cards=students.map(s=>{
   const percent=s.total?Math.min(100,Math.round(100*s.done/s.total)):0;
   return '<details class="sgt-progress-student"><summary><span><strong>'+escapeHtml(s.name)+'</strong>'+
    '<small>'+s.done+'/'+s.total+' steps completed · Coach '+s.coach+
    ' · Unscramble '+s.unscramble+' · Speaking '+s.speaking+'</small></span>'+
    '<span class="sgt-progress-percent">'+percent+'%</span></summary>'+
    '<div class="sgt-bar"><i style="width:'+percent+'%"></i></div>'+
    '<div class="sgt-progress-units">'+s.assignments.map(a=>'<div><span>'+escapeHtml(a.title)+
    '</span><b>'+a.done+'/'+a.total+(a.complete?' · ✓ Complete':'')+'</b></div>').join('')+'</div></details>';
  }).join('');
  host.innerHTML=summary+(cards||'<p class="sgt-empty">No students in this class.</p>')+
   (failures.length?'<p class="sgt-error">'+failures.length+' assignments could not load.</p>':'')+
   '<div class="sgt-actions"><button type="button" class="control ua-primary" id="sgtOpenManage">Manage Sentence Genius homework</button></div>';
  const manage=$('#sgtOpenManage',host);
  if(manage)manage.onclick=()=>{document.querySelector('[data-view="assignments"]')?.click();
    window.UniversalAssignments?.openTab?.('sentence')};
 }catch(error){if(request===classProgressRequest&&host.isConnected)host.textContent='Progress unavailable: '+error.message}
}

let sharedGrader=null;
async function graderRules(){
 if(!sharedGrader){
  sharedGrader=Promise.all([
   import('./sentence-genius-flexibility.js?v=20261025-sg-mirror1'),
   import('./sentence-genius-speech-match.js?v=20261025-sg-mirror1')
  ]).then(([flex,match])=>({flex,match}));
 }
 return sharedGrader;
}
async function gradeTest(item,response){
 const {flex,match}=await graderRules();
 const context=item.gradingContext||{};
 const known=match.matchSpeakingTarget(item.en,[response]);
 if(known.correct&&['exact','spacing','homophone'].includes(known.matchedBy))
   return{label:'Correct · 4/4',method:known.matchedBy,message:'Textbook answer'};
 const equivalence=flex.matchFlexibleSentence(item.en,[response],context);
 if(equivalence?.correct)return{label:'Correct · 4/4',method:equivalence.matchedBy,message:'Accepted alternative'};
 const partial=flex.detectAlmostRight(item.en,[response],context);
 if(partial)return{label:'Almost Right · 2/4',method:partial.matchedBy,message:'Small grammar mistake; retry for mastery'};
 if(!/[a-z]/i.test(response)||(/^(?:blah|um|uh)(?:\s+(?:blah|um|uh)){2,}$/i).test(response))
   return{label:'Unusable transcript',method:'Speech filter',message:'Try recording again'};
 if(context.mode==='exact_text')return{label:'Incorrect · retry',method:'Strict textbook policy',message:'Exact wording required'};
 const payload={model:'gpt-5.6-luna',reasoning_effort:'low',max_completion_tokens:320,
  response_format:{type:'json_object'},
  messages:[
   {role:'system',content:'You are AI Willi, a Korean ESL sentence grading adjudicator. Return valid JSON only: correct boolean, explanation_ko string, reason_code string. Accept natural English alternatives conveying the same intent, tense, polarity and who acts. Reject incomplete grammar, missing articles and wrong plural/verb forms. If a textbook grammar target is required, enforce it.'},
   {role:'user',content:JSON.stringify({question_type:'translation',prompt:item.ko,
      reference:item.en,response,grading_policy:context})}
  ]};
 const request=window.WillenaAPI?.fetch?window.WillenaAPI.fetch.bind(window.WillenaAPI):fetch;
 const result=await request('/.netlify/functions/openai_proxy',{method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({endpoint:'chat/completions',payload})});
 if(!result.ok)throw Error('AI HTTP '+result.status);
 const body=await result.json();
 const text=body?.data?.choices?.[0]?.message?.content||body?.result;
 if(!text)throw Error('Empty AI verdict');
 const data=JSON.parse(String(text).trim().replace(/^\x60{3}(?:json)?\s*/i,'').replace(/\s*\x60{3}$/,''));
 if(typeof data.correct!=='boolean')throw Error('Malformed AI verdict');
 return{label:data.correct?'Correct · 4/4':'Incorrect · retry',method:'AI Willi',
  message:data.explanation_ko||data.reason_code||''};
}
async function openAssignment(mode){
 state.managerMode=mode;
 const root=assignmentRoot();if(!root)return;
 root.innerHTML=mode==='create'?createShell():manageShell();
 if(mode==='create')await mountCreate(root);else await mountManage(root);
}
function createShell(){
 return wrapper('Assign Sentence Genius','Select a class, textbook and units. Every unit becomes its own homework item.')+
 '<form id="sgtAssignForm"><div class="sgt-fields"><label>Class<select class="control" id="sgtClass" required></select></label><label>Textbook<select class="control" id="sgtBook" required></select></label><label>Due date<input class="control" type="date" id="sgtDue" required></label></div>'+
 '<div class="sgt-target"><strong>Units</strong><div id="sgtUnits">Choose a textbook.</div></div>'+
 '<fieldset class="sgt-modes"><legend>Required steps</legend>'+
 Object.entries(types).map(([key,label])=>'<label><input type="checkbox" name="sgtMode" value="'+key+'" checked> '+label+'</label>').join('')+'</fieldset>'+
 '<div class="sgt-actions"><button type="submit" id="sgtCreate" class="control ua-primary">Assign selected units</button></div><div data-sg-status role="status"></div></form>';
}
async function mountCreate(root){
 const classEl=$('#sgtClass',root),bookEl=$('#sgtBook',root),unitHost=$('#sgtUnits',root);
 try{
  const [cls,b]=await Promise.all([classes(),books()]);
  classEl.innerHTML='<option value="">Choose a class</option>'+cls.map(c=>'<option value="'+escapeHtml(c.name)+'">'+escapeHtml(c.display_name||c.name)+'</option>').join('');
  bookEl.innerHTML=options(b,'Choose a textbook');$('#sgtDue',root).value=dateDefault();
  bookEl.onchange=async()=>{
   unitHost.textContent='Loading units…';
   try{
    const all=await units(bookEl.value);state.units=all;
    unitHost.innerHTML=all.length?all.map(u=>'<label class="sgt-unit"><input type="checkbox" data-sg-unit="'+escapeHtml(u.id)+'"><span>Unit '+escapeHtml(u.unit_number)+' · '+escapeHtml(u.title||'')+'</span></label>').join(''):'No published units for this textbook.';
   }catch(e){status(root,e.message)}
  };
  $('#sgtAssignForm',root).onsubmit=async ev=>{
   ev.preventDefault();const btn=$('#sgtCreate',root);
   const className=classEl.value,book=state.books.find(x=>x.id===bookEl.value),
    ids=[...root.querySelectorAll('[data-sg-unit]:checked')].map(x=>x.dataset.sgUnit),
    modes=[...root.querySelectorAll('[name="sgtMode"]:checked')].map(x=>x.value),
    day=$('#sgtDue',root).value;
   if(!className||!book||!ids.length||!modes.length||!day){status(root,'Choose a class, book, units, steps and due date.');return}
   btn.disabled=true;let saved=0;
   try{
    // Validate each unit against current published sentence content first.
    const payloads=[];
    for(const id of ids){
     const u=state.units.find(x=>x.id===id),rows=await sentences(book.id,id);
     const targets=rows.map(x=>x.id).filter(x=>uuidPattern.test(x));
     if(!targets.length)throw Error('Unit '+u.unit_number+' has no eligible translated sentences');
     payloads.push({p_class:className,p_book_id:book.id,p_book_title:book.title,p_unit_id:id,
      p_unit_label:'Unit '+u.unit_number,p_title:book.title+' · Unit '+u.unit_number,
      p_targets:targets,p_modes:modes,p_due_at:new Date(day+'T23:59:59+09:00').toISOString()});
    }
    for(const payload of payloads){await rpc('sg_homework_create_v1',payload);saved++}
    status(root,'Assigned '+saved+' unit'+(saved===1?'':'s')+' to '+className+'.');
   }catch(e){status(root,'Saved '+saved+' units. '+e.message)}
   finally{btn.disabled=false}
  };
 }catch(e){status(root,e.message)}
}
function manageShell(){
 return wrapper('Manage Sentence Genius','Student completion is based on saved independent full-credit mastery, not merely attempts.')+
 '<div class="sgt-actions"><button type="button" id="sgtRefresh" class="control">↻ Refresh</button>'+
 '<select id="sgtHistory" class="control"><option value="current">Current</option><option value="history">All / history</option></select></div>'+
 '<div data-sg-status role="status"></div><div id="sgtAssignments" class="sgt-assignment-list"></div>';
}
async function mountManage(root){
 $('#sgtRefresh',root).onclick=()=>void fetchManage(root);
 $('#sgtHistory',root).value=state.assignmentFilter;
 $('#sgtHistory',root).onchange=()=>{state.assignmentFilter=$('#sgtHistory',root).value;void fetchManage(root)};
 await fetchManage(root);
}
async function fetchManage(root){
 status(root,'Loading assignments…');
 try{
  const data=await rpc('sg_homework_list_v1',{p_history:state.assignmentFilter==='history'});
  if(!root.isConnected||state.managerMode!=='manage')return;
  state.assignments=data.assignments||[];renderManage(root);status(root,state.assignments.length+' assignments');
 }catch(e){status(root,e.message)}
}
function renderManage(root){
 const holder=$('#sgtAssignments',root);if(!holder)return;
 holder.innerHTML=state.assignments.length?state.assignments.map(a=>{
  const count=(a.target_sentence_ids||[]).length,modes=(a.required_modes||[]).map(m=>types[m]||m).join(' · ');
  return '<article class="sgt-assignment-card"><div><strong>'+escapeHtml(a.title)+'</strong><small>'+escapeHtml(a.class_name)+' · '+count+' sentences · '+escapeHtml(modes)+' · Due '+escapeHtml(String(a.due_at).slice(0,10))+'</small></div>'+
    '<div class="sgt-actions"><button class="control" type="button" data-sg-progress="'+escapeHtml(a.id)+'">Student progress</button>'+
    '<button class="control" type="button" data-sg-toggle="'+escapeHtml(a.id)+'" data-active="'+a.active+'">'+(a.active?'Cancel':'Reactivate')+'</button></div><div class="sgt-progress" id="sgtProgress-'+escapeHtml(a.id)+'" hidden></div></article>';
 }).join(''):'<div class="sgt-result">No Sentence Genius assignments found.</div>';
 holder.querySelectorAll('[data-sg-toggle]').forEach(b=>b.onclick=async()=>{
  b.disabled=true;try{
   await rpc('sg_homework_set_active_v1',{p_id:b.dataset.sgToggle,p_active:b.dataset.active!=='true'});
   await fetchManage(root);
  }catch(e){status(root,e.message);b.disabled=false}
 });
 holder.querySelectorAll('[data-sg-progress]').forEach(b=>b.onclick=async()=>{
  const box=document.getElementById('sgtProgress-'+b.dataset.sgProgress);
  if(!box)return;box.hidden=!box.hidden;if(box.hidden)return;
  box.textContent='Loading recorded completion…';
  try{const data=await rpc('sg_homework_progress_v1',{p_id:b.dataset.sgProgress});
   const rows=data.students||[];
   box.innerHTML=rows.length?rows.map(s=>'<div class="sgt-student"><div><strong>'+escapeHtml(s.korean_name||s.name||'Student')+'</strong><small>'+escapeHtml(s.done)+' / '+escapeHtml(s.total)+' mastered</small></div><div class="sgt-bar"><i style="width:'+Math.max(0,Math.min(100,Number(s.percent)||0))+'%"></i></div><b>'+Math.round(Number(s.percent)||0)+'%</b></div>').join(''):'No students enrolled in this class.';
  }catch(e){box.textContent=e.message}
 });
}
// Expose read-only assignment summaries for the existing student roster.
// One authoritative completion source: sg_homework_progress_v1.
async function rosterHomework(className){
 if(!className)return[];
 const response=await rpc('sg_homework_list_v1',{p_history:false});
 const selected=(response.assignments||[]).filter(a=>a.active===true&&a.class_name===className);
 let index=0;const collected=new Array(selected.length);
 await Promise.all(Array.from({length:Math.min(4,selected.length)},async()=>{
  while(index<selected.length){
   const i=index++,a=selected[i];
   try{
    const progress=await rpc('sg_homework_progress_v1',{p_id:a.id});
    collected[i]={
      assignment:{id:'sg-'+a.id,title:a.title,source_type:'sentence_genius',
        class:a.class_name,active:true,due_at:a.due_at,
        list_meta:{required_modes:a.required_modes||[],target_count:(a.target_sentence_ids||[]).length}},
      progress:{students:progress.students||[]},error:''
    };
   }catch(error){
    collected[i]={
      assignment:{id:'sg-'+a.id,title:a.title,source_type:'sentence_genius',
        class:a.class_name,active:true,due_at:a.due_at,
        list_meta:{required_modes:a.required_modes||[],target_count:(a.target_sentence_ids||[]).length}},
      progress:null,error:error.message
    };
   }
  }
 }));
 return collected.filter(Boolean);
}
window.SentenceGeniusTeacher={
 openTeacher:teacherOpen,
 mountHomework:mode=>void openAssignment(mode),
 rosterHomework
};
window.addEventListener('ua:sentence-mounted',event=>{void openAssignment(event.detail?.sub||'manage')});
})();