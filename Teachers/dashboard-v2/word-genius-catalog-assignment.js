/* Live catalog assignments for Word Genius; additive to Word Builder. */
(()=>{'use strict';
const HOST='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let books=[],units=[],selected=[],busy=false,previewReady=false,previewRevision=0,cacheEpoch=0,masteryRevision=0;
let roster=[],rosterReady=false,rosterError='',rosterRevision=0,studentSearch='',pickerInitialized=false;
const selectedStudentIds=new Set();
const targetCache=new Map(),targetLoads=new Map();
async function content(path){
 const r=await fetch(HOST+'/rest/v1/'+path,{headers:{apikey:KEY,Authorization:'Bearer '+KEY},cache:'no-store'});
 if(!r.ok)throw Error('Content database: '+r.status);return r.json();
}
async function homework(payload){
 const uri='/.netlify/functions/homework_api?action=create_assignment';
 const url=window.WillenaAPI?.getApiUrl?.(uri)||uri;
 const r=await fetch(url,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const data=await r.json().catch(()=>({}));if(!r.ok||!data.success)throw Error(data.error||'Assignment could not be saved');return data;
}
function root(){return document.querySelector('#uaAppBody')}
function panel(){return document.querySelector('#uaCatalog')}
async function mount(){
 if(!root()||!document.querySelector('#uaAppBody .ua-catalog-host'))return;
 if(panel())return;
 const div=document.createElement('section');div.id='uaCatalog';div.className='ua-catalog';
 div.innerHTML='<div class="ua-section-heading"><div><div class="ua-eyebrow">CONTENT DATABASE</div><h3>Assign mission from a book</h3></div><button type="button" class="control" id="uaReloadBooks">↻ Refresh books</button></div><form id="uaCatalogForm"><div class="ua-catalog-fields"><label>Class<select id="uaClass" class="control" required><option value="">Choose class…</option></select></label><label>Book<select id="uaBook" class="control" required><option value="">Loading books…</option></select></label><label>Due date<input id="uaDue" class="control" type="date" required></label></div><fieldset class="ua-recipient-scope"><legend>Assign to</legend><div class="ua-recipient-choices"><label><input type="radio" name="uaTargetScope" value="class" checked> Whole class</label><label><input type="radio" name="uaTargetScope" value="students"> Choose students</label></div><div id="uaRecipientSummary" class="ua-recipient-summary" aria-live="polite">Choose a class.</div><div id="uaStudentPicker" class="ua-student-picker" hidden><div class="ua-student-picker-tools"><input type="search" id="uaStudentSearch" class="control" placeholder="Search students…" aria-label="Search class students"><button type="button" class="control" id="uaStudentsAll">Select all</button><button type="button" class="control" id="uaStudentsClear">Clear</button></div><div class="ua-student-picker-list" id="uaStudentList" aria-live="polite">Choose a class first.</div></div></fieldset><div class="ua-catalog-units"><strong>Units</strong><div id="uaUnitList">Select a book first.</div></div><div class="ua-catalog-preview" id="uaWordsPreview"><div class="ua-preview-heading"><div><strong>Selected words preview</strong><small id="uaPreviewSummary" aria-live="polite">Choose units to see their words.</small></div><button type="button" class="control ua-preview-toggle" id="uaPreviewToggle" aria-controls="uaPreviewBody" aria-expanded="true">Hide preview</button></div><div class="ua-preview-body" id="uaPreviewBody"><p class="ua-preview-empty">Select one or more units above to see the exact vocabulary before assigning it.</p></div></div><div class="ua-catalog-modes"><strong>Practice modes</strong><label><input type="checkbox" name="uaMode" value="quiz" checked> Quiz</label><span class="ua-spelling-choice"><strong>Spelling homework (choose one)</strong><label><input type="radio" name="uaSpellingMode" value="none"> No spelling homework</label><label><input type="radio" name="uaSpellingMode" value="spelling_test" checked> Spelling Test</label><label><input type="radio" name="uaSpellingMode" value="spelling_coach"> Spelling Coach</label></span><label><input type="checkbox" name="uaMode" value="speaking" checked> Speaking</label></div><label class="ua-fresh-session"><input type="checkbox" id="uaFreshSession"> <span><strong>Fresh Session</strong><small>Require new answers after assignment. Existing mastery stays unchanged.</small></span></label><section class="ua-mastery-preview" id="uaMasteryPreview"><strong>Class progress before assigning</strong><div id="uaMasteryRows">Choose a class, book and units.</div></section><div class="ua-catalog-footer"><span id="uaCount">Choose units to preview vocabulary.</span><button type="submit" class="control ua-primary" id="uaCreate" disabled>Assign Mission →</button></div><p id="uaCatalogMessage" role="status" aria-live="polite"></p></form>';
 root().querySelector('.ua-catalog-host').appendChild(div);
 const due=div.querySelector('#uaDue');const d=new Date(Date.now()+7*86400000);due.value=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 div.querySelector('#uaReloadBooks').onclick=loadBooks;
 div.querySelector('#uaBook').onchange=()=>{void loadUnits()};
 div.querySelector('#uaClass').addEventListener('change',()=>{void loadStudentRoster();void renderMasteryPreview()});
 div.querySelectorAll('input[name="uaTargetScope"]').forEach(i=>i.addEventListener('change',()=>{if(i.checked&&i.value==='students'&&rosterReady&&!pickerInitialized){roster.forEach(st=>selectedStudentIds.add(st.id));pickerInitialized=true;}renderRecipientPicker();}));
 div.querySelector('#uaStudentSearch').addEventListener('input',e=>{studentSearch=e.target.value.toLowerCase().trim();renderRecipientPicker()});
 div.querySelector('#uaStudentsAll').addEventListener('click',()=>{if(!rosterReady)return;roster.forEach(st=>selectedStudentIds.add(st.id));pickerInitialized=true;renderRecipientPicker()});
 div.querySelector('#uaStudentsClear').addEventListener('click',()=>{selectedStudentIds.clear();pickerInitialized=true;renderRecipientPicker()});
 div.querySelector('#uaStudentList').addEventListener('change',e=>{if(!e.target.matches('input[data-ua-student]'))return;const id=e.target.value;if(!roster.some(st=>st.id===id))return;e.target.checked?selectedStudentIds.add(id):selectedStudentIds.delete(id);updateRecipientUI();});
 div.querySelectorAll('input[name="uaMode"],input[name="uaSpellingMode"]').forEach(i=>i.addEventListener('change',()=>{void renderMasteryPreview()}));
 div.querySelector('#uaPreviewToggle').addEventListener('click',()=>{
  const body=div.querySelector('#uaPreviewBody'),toggle=div.querySelector('#uaPreviewToggle');
  body.hidden=!body.hidden;toggle.setAttribute('aria-expanded',String(!body.hidden));toggle.textContent=body.hidden?'Show preview':'Hide preview';
 });
 div.querySelector('#uaCatalogForm').addEventListener('submit',submit);
 await Promise.all([loadBooks(),loadClasses()]);
 window.WillenaGeniusBooks?.bind({classSelect:div.querySelector('#uaClass'),bookSelect:div.querySelector('#uaBook'),books:()=>books,onChange:()=>{units=[];selected=[];renderUnits()}});
}
function message(t){const el=panel()?.querySelector('#uaCatalogMessage');if(el)el.textContent=t}

function recipientMode(){return panel()?.querySelector('input[name="uaTargetScope"]:checked')?.value||'class'}
function updateRecipientUI(){
 const p=panel();if(!p)return;
 const cls=p.querySelector('#uaClass')?.value||'',chosen=recipientMode()==='students';
 const count=selectedStudentIds.size;
 const summary=p.querySelector('#uaRecipientSummary'),button=p.querySelector('#uaCreate');
 p.querySelector('#uaStudentPicker').hidden=!chosen;
 summary.textContent=!cls?'Choose a class.':chosen
  ?!rosterReady?(rosterError?'Student list unavailable':'Loading students…'):count+' of '+roster.length+' students selected'
  :rosterReady?'Whole class · '+roster.length+' students':'Whole class';
 button.textContent=chosen?'Assign to '+count+' student'+(count===1?'':'s')+' →':'Assign Mission →';
 button.disabled=busy||!previewReady||!cls||(chosen&&(!rosterReady||count===0));
}
function renderRecipientPicker(){
 const p=panel();if(!p)return;
 const list=p.querySelector('#uaStudentList'),cls=p.querySelector('#uaClass')?.value||'';
 if(!cls)list.textContent='Choose a class first.';
 else if(rosterError)list.innerHTML='<span class="ua-roster-error">Could not load students: '+esc(rosterError)+'</span> <button type="button" class="control" id="uaStudentsRetry">Retry</button>';
 else if(!rosterReady)list.textContent='Loading class students…';
 else if(!roster.length)list.textContent='No students found in this class.';
 else {
  const visible=roster.filter(st=>st.label.toLowerCase().includes(studentSearch)||st.korean.toLowerCase().includes(studentSearch));
  list.innerHTML=visible.length?visible.map(st=>'<label class="ua-student-choice"><input type="checkbox" data-ua-student value="'+esc(st.id)+'"'+(selectedStudentIds.has(st.id)?' checked':'')+'><span><strong>'+esc(st.label)+'</strong>'+(st.korean&&st.korean!==st.label?'<small>'+esc(st.korean)+'</small>':'')+'</span></label>').join(''):'No matching students.';
 }
 p.querySelector('#uaStudentsRetry')?.addEventListener('click',()=>{void loadStudentRoster()});
 updateRecipientUI();
}
async function loadStudentRoster(){
 const p=panel();if(!p)return;
 const cls=p.querySelector('#uaClass').value,revision=++rosterRevision;
 roster=[];rosterReady=false;rosterError='';studentSearch='';pickerInitialized=false;selectedStudentIds.clear();
 p.querySelector('#uaStudentSearch').value='';
 renderRecipientPicker();
 if(!cls)return;
 try{
  const route='/.netlify/functions/progress_summary?'+new URLSearchParams({section:'teacher_class_insights',class:cls,days:'30'});
  const response=await (window.WillenaAPI?.fetch?window.WillenaAPI.fetch(route,{credentials:'include',cache:'no-store'}):fetch(window.WillenaAPI?.getApiUrl?.(route)||route,{credentials:'include',cache:'no-store'}));
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.success===false||!Array.isArray(data.students))throw Error(data.error||'Student roster unavailable ('+response.status+')');
  if(revision!==rosterRevision||panel()!==p||p.querySelector('#uaClass').value!==cls)return;
  const byId=new Map();
  for(const student of data.students){
   const id=String(student.user_id||student.id||student.student_id||'').trim();
   if(!id)continue;
   byId.set(id,{id,label:String(student.name||student.korean_name||student.username||'Student'),korean:String(student.korean_name||'')});
  }
  roster=[...byId.values()].sort((a,b)=>a.label.localeCompare(b.label,'en',{sensitivity:'base'}));
  rosterReady=true;
  if(recipientMode()==='students'&&!pickerInitialized){roster.forEach(st=>selectedStudentIds.add(st.id));pickerInitialized=true;}
 }catch(error){if(revision!==rosterRevision)return;rosterError=error.message||'Student roster unavailable';}
 if(revision===rosterRevision)renderRecipientPicker();
}

async function loadBooks(){
 const select=panel()?.querySelector('#uaBook');if(!select)return;
 const before=select.value;
 cacheEpoch++;targetCache.clear();targetLoads.clear();previewRevision++;previewReady=false;
 try{books=await content('content_books?select=id,title,status,public_level&status=in.(review,published)&order=title.asc&limit=1000');select.innerHTML='<option value="">Choose a book…</option>'+books.map(b=>'<option value="'+esc(b.id)+'">'+esc(b.title)+'</option>').join('');if(books.some(b=>b.id===before)){select.value=before;await loadUnits({preserveSelection:true})}else{units=[];selected=[];renderUnits()}}catch(e){message(e.message)}
}
async function loadClasses(){
 const sel=panel()?.querySelector('#uaClass');if(!sel)return;
 // The admin list endpoint can return a partial class list. Merge it with
 // the canonical active-class roster so active classes are never omitted.
 // Keep API-provided names as well, so newly added classes still appear.
 const activeRoster=['Berkeley','Boston','Brown','Cambridge','Chicago','Hawaii','Manchester','MIT','New York','Oxford','Pre-Harvard','Princeton','Stanford','Sydney','Test','Yale'];
 const names=new Map(activeRoster.map(name=>[name.toLowerCase(),name]));
 const add=(name)=>{
  const value=String(name||'').trim();
  if(value)names.set(value.toLowerCase(),value);
 };
 try{
  const url=window.WillenaAPI?.getApiUrl?.('/.netlify/functions/admin_classes?action=list')||'/.netlify/functions/admin_classes?action=list';
  const res=await (window.WillenaAPI?.fetch?window.WillenaAPI.fetch('/.netlify/functions/admin_classes?action=list'):fetch(url,{credentials:'include'}));
  if(!res.ok)throw Error('Class list request failed ('+res.status+')');
  const data=await res.json();
  (Array.isArray(data.classes)?data.classes:[]).filter(c=>!c.status||c.status==='active').forEach(c=>add(c.name||c.display_name));
 }catch(e){console.warn('[Word Genius] Class list endpoint unavailable; using active roster:',e)}
 // Also retain classes visible in the shared assignment filter.
 const old=document.querySelector('#assignmentClassFilter');
 [...(old?.options||[])].forEach(o=>add(o.value));
 const selected=sel.value;
 const classes=[...names.values()].sort((a,b)=>a.localeCompare(b,'en',{sensitivity:'base'}));
 sel.replaceChildren(new Option('Choose class…',''),...classes.map(name=>new Option(name,name)));
 if(classes.includes(selected))sel.value=selected;
}
async function loadUnits({preserveSelection=false}={}){
 const bookId=panel()?.querySelector('#uaBook')?.value;
 const previous=preserveSelection?new Set(selected):null;
 selected=[];units=[];renderUnits();if(!bookId)return;
 try{
  const loaded=await content('content_units?select=id,unit_number,title&book_id=eq.'+encodeURIComponent(bookId)+'&status=in.(review,published)&order=unit_number.asc&limit=1000');
  if(panel()?.querySelector('#uaBook')?.value!==bookId)return;
  units=loaded;
  if(previous)selected=units.filter(u=>previous.has(u.id)).map(u=>u.id);
  renderUnits();
 }catch(e){message(e.message)}
}
function renderUnits(){
 const box=panel()?.querySelector('#uaUnitList');if(!box)return;
 box.innerHTML=units.length?units.map(u=>'<label class="ua-unit-chip"><input type="checkbox" value="'+esc(u.id)+'" data-ua-unit'+(selected.includes(u.id)?' checked':'')+'><span>Unit '+esc(u.unit_number||'')+' · '+esc(u.title)+'</span></label>').join(''):'No units loaded.';
 box.querySelectorAll('input').forEach(i=>i.addEventListener('change',()=>{
  selected=[...box.querySelectorAll('input:checked')].map(n=>n.value);
  void renderPreview();
 }));
 void renderPreview();
}
async function fetchTargets(unitId){
 const rows=await content('unit_vocab_targets?select=lexical_entry_id&unit_id=eq.'+encodeURIComponent(unitId)+'&active=eq.true&order=priority.desc&limit=1000');
 const ids=[...new Set(rows.map(t=>t.lexical_entry_id))];if(!ids.length)return[];
 const entries=await content('lexical_entries?select=id,canonical_text,translation_ko&id=in.'+encodeURIComponent('('+ids.join(',')+')')+'&status=in.(review,published)&limit=1000');
 const by=new Map(entries.map(x=>[x.id,x]));
 return ids.map((id,index)=>{const e=by.get(id);return e?.canonical_text&&e?.translation_ko?{lexical_entry_id:id,english:e.canonical_text,korean:e.translation_ko,position:index}:null}).filter(Boolean);
}
async function getTargets(unitId){
 if(targetCache.has(unitId))return targetCache.get(unitId);
 if(targetLoads.has(unitId))return targetLoads.get(unitId);
 const epoch=cacheEpoch;
 const task=fetchTargets(unitId);
 targetLoads.set(unitId,task);
 try{
  const targets=await task;
  if(epoch===cacheEpoch)targetCache.set(unitId,targets);
  return targets;
 }finally{if(targetLoads.get(unitId)===task)targetLoads.delete(unitId)}
}
async function renderPreview(){
 const p=panel();if(!p)return;
 const summary=p.querySelector('#uaPreviewSummary'),body=p.querySelector('#uaPreviewBody');
 const count=p.querySelector('#uaCount'),create=p.querySelector('#uaCreate');
 const revision=++previewRevision;
 ++masteryRevision;
 const chosen=units.filter(u=>selected.includes(u.id));
 previewReady=false;create.disabled=true;
 if(!chosen.length){
  const rows=p.querySelector('#uaMasteryRows');if(rows)rows.textContent='Choose a class, book and units.';
  summary.textContent='Choose units to see their words.';
  count.textContent='Choose units to preview vocabulary.';
  body.innerHTML='<p class="ua-preview-empty">Select one or more units above to see the exact vocabulary before assigning it.</p>';
  return;
 }
 summary.textContent='Loading words from the content database…';
 count.textContent=chosen.length+' unit'+(chosen.length===1?'':'s')+' selected · loading vocabulary…';
 body.innerHTML='<p class="ua-preview-empty">Loading selected unit vocabulary…</p>';
 try{
  const groups=await Promise.all(chosen.map(async unit=>({unit,targets:await getTargets(unit.id)})));
  if(revision!==previewRevision)return;
  const missing=groups.filter(group=>!group.targets.length);
  if(missing.length)throw Error('No assignable words in '+missing.map(g=>'Unit '+g.unit.unit_number).join(', ')+'. Check the content database.');
  const total=groups.reduce((sum,g)=>sum+g.targets.length,0);
  summary.textContent=total+' word'+(total===1?'':'s')+' in '+groups.length+' selected unit'+(groups.length===1?'':'s');
  count.textContent=groups.length+' unit'+(groups.length===1?'':'s')+' · '+total+' word'+(total===1?'':'s')+' ready to assign';
  body.innerHTML=groups.map(({unit,targets})=>
   '<section class="ua-preview-unit">'+
    '<div class="ua-preview-unit-head"><strong>Unit '+esc(unit.unit_number)+' · '+esc(unit.title||'')+'</strong><span>'+targets.length+' word'+(targets.length===1?'':'s')+'</span></div>'+
    '<ol class="ua-preview-word-list">'+targets.map(word=>
     '<li><span class="ua-preview-en">'+esc(word.english)+'</span><span class="ua-preview-ko">'+esc(word.korean)+'</span></li>'
    ).join('')+'</ol>'+
   '</section>'
  ).join('');
  previewReady=true;updateRecipientUI();
  void renderMasteryPreview(groups);
 }catch(e){
  if(revision!==previewRevision)return;
  summary.textContent='Word preview unavailable';
  count.textContent=chosen.length+' unit(s) selected · words could not be verified';
  body.innerHTML='<p class="ua-preview-error">'+esc(e.message)+' <button type="button" class="control" id="uaRetryPreview">Retry preview</button></p>';
  p.querySelector('#uaRetryPreview')?.addEventListener('click',()=>{
   cacheEpoch++;targetCache.clear();targetLoads.clear();void renderPreview();
  });
 }
}

const spellingStyle=document.createElement('style');spellingStyle.textContent='.ua-spelling-choice{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:8px 12px;border:1px solid #bfe7ed;border-radius:10px;background:#fff}.ua-spelling-choice strong{font-size:12px}.ua-spelling-choice input{accent-color:#ed70ad}';document.head.appendChild(spellingStyle);
const OP_HOST='https://fiieuiktlsivwfgyivai.supabase.co';
const OP_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const masteryStyle=document.createElement('style');
masteryStyle.textContent='.ua-fresh-session{display:flex;gap:9px;align-items:center;padding:12px;margin:12px 0;border:1px solid #f1bfd4;border-radius:10px;background:#fff}.ua-fresh-session input{accent-color:#e75d9e;width:19px;height:19px}.ua-fresh-session span{display:grid;gap:2px}.ua-fresh-session small{font-size:11px;color:#687380}.ua-mastery-preview{padding:12px;margin:12px 0;border:1px solid #bce5ee;border-radius:10px;background:white}.ua-mastery-preview>strong{display:block;margin-bottom:8px}.ua-mastery-rows{max-height:220px;overflow:auto;display:grid;gap:7px}.ua-mastery-row{display:grid;grid-template-columns:minmax(55px,1fr) 2fr 38px;gap:8px;align-items:center;font-size:12px}.ua-mastery-row span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ua-mastery-track{height:7px;background:#edf2f5;border-radius:20px;overflow:hidden}.ua-mastery-fill{height:100%;background:#ed70ad;border-radius:20px}.ua-mastery-row b{text-align:right;font-size:11px}';
document.head.appendChild(masteryStyle);

const recipientStyle=document.createElement('style');
recipientStyle.textContent=`
#uaCatalog .ua-recipient-scope{margin:16px 0 12px;padding:14px;border:1px solid #d8e7e8;border-radius:14px;min-width:0;background:#fff}
#uaCatalog .ua-recipient-scope legend{font-size:14px;font-weight:800;color:#395c64;padding:0 5px}
#uaCatalog .ua-recipient-choices{display:flex;flex-wrap:wrap;gap:10px}
#uaCatalog .ua-recipient-choices label{display:flex;align-items:center;gap:8px;cursor:pointer;background:#f7fafb;border:1px solid #e0eaeb;border-radius:10px;padding:10px 13px;font-size:13px;font-weight:650}
#uaCatalog .ua-recipient-choices input,#uaCatalog .ua-student-choice input{accent-color:#218e86;width:18px;height:18px;flex-shrink:0}
#uaCatalog .ua-recipient-summary{font-size:12px;color:#55767c;margin-top:10px;font-weight:650}
#uaCatalog .ua-student-picker{margin-top:12px}
#uaCatalog .ua-student-picker[hidden]{display:none}
#uaCatalog .ua-student-picker-tools{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px}
#uaCatalog #uaStudentSearch{min-width:145px;flex:1 1 180px}
#uaCatalog .ua-student-picker-tools button{min-height:40px}
#uaCatalog .ua-student-picker-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;max-height:270px;overflow-y:auto;padding:2px}
#uaCatalog .ua-student-choice{display:flex;gap:9px;align-items:center;border:1px solid #e3e9eb;border-radius:10px;background:#fbfdfd;padding:10px;cursor:pointer;min-width:0}
#uaCatalog .ua-student-choice:has(input:checked){border-color:#a0d7c6;background:#f2faf6}
#uaCatalog .ua-student-choice span{display:grid;gap:2px;min-width:0;overflow-wrap:anywhere}
#uaCatalog .ua-student-choice strong{font-size:13px;color:#344c55;font-weight:650}
#uaCatalog .ua-student-choice small{font-size:11px;color:#70838b}
#uaCatalog .ua-roster-error{font-size:12px;color:#aa4343}
@media(max-width:550px){#uaCatalog .ua-student-picker-list{grid-template-columns:1fr}}
`;
document.head.appendChild(recipientStyle);

async function classMastery(className,bookId,unitIds,lexicalIds,modes){
 const call=token=>fetch(OP_HOST+'/rest/v1/rpc/teacher_vocab_class_preview_v1',{method:'POST',cache:'no-store',headers:{apikey:OP_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({p_class:className,p_book_id:bookId,p_unit_ids:unitIds,p_lexical_entry_ids:lexicalIds,p_modes:modes})});
 let response=await call(window.WillenaAPI?.getLocalAccessToken?.()||'');
 if(response.status===401){
  const refresh=await (window.WillenaAPI?.fetch?window.WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=refresh'):fetch('/.netlify/functions/supabase_auth?action=refresh',{credentials:'include'}));
  const data=await refresh.json().catch(()=>({}));
  if(refresh.ok&&data.access_token){window.WillenaAPI?.setLocalTokens?.(data.access_token,data.refresh_token||'');response=await call(data.access_token)}
 }
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.success!==true)throw Error(data.message||data.error||'Class preview unavailable');
 return data;
}
async function renderMasteryPreview(groups=null){
 const p=panel(),body=p?.querySelector('#uaMasteryRows');if(!p||!body)return;
 const rev=++masteryRevision,className=p.querySelector('#uaClass')?.value||'',bookId=p.querySelector('#uaBook')?.value||'';
 const spelling=p.querySelector('input[name="uaSpellingMode"]:checked')?.value;
 const modes=[...p.querySelectorAll('input[name="uaMode"]:checked')].map(x=>x.value);
 if(spelling&&spelling!=='none')modes.push(spelling);
 const unitIds=selected.slice();
 if(!className||!bookId||!unitIds.length||!modes.length){body.textContent='Choose a class, book, units and modes.';return;}
 body.textContent='Loading class progress…';
 try{
  const chosen=groups||await Promise.all(unitIds.map(async id=>({targets:await getTargets(id)})));
  const ids=[...new Set(chosen.flatMap(g=>g.targets.map(t=>t.lexical_entry_id)))];
  if(!ids.length){if(rev===masteryRevision)body.textContent='No vocabulary in selection.';return;}
  const data=await classMastery(className,bookId,unitIds,ids,modes);
  if(rev!==masteryRevision)return;
  const students=Array.isArray(data.students)?data.students:[];
  body.innerHTML=students.length?'<div class="ua-mastery-rows">'+students.map(st=>{
   const pct=Math.max(0,Math.min(100,Number(st.percent)||0));
   return '<div class="ua-mastery-row"><span>'+esc(st.name||st.korean_name||'Student')+'</span><div class="ua-mastery-track"><div class="ua-mastery-fill" style="width:'+pct+'%"></div></div><b>'+pct+'%</b></div>';
  }).join('')+'</div>':'No students in class.';
 }catch(error){if(rev===masteryRevision)body.textContent='Preview unavailable: '+error.message;}
}
async function submit(ev){
 ev.preventDefault();if(busy)return;
 const p=panel(),bookId=p.querySelector('#uaBook').value,className=p.querySelector('#uaClass').value,day=p.querySelector('#uaDue').value;
 const spelling=p.querySelector('input[name="uaSpellingMode"]:checked')?.value;
 const modes=[...p.querySelectorAll('input[name="uaMode"]:checked')].map(x=>x.value);
 if(spelling&&spelling!=='none')modes.push(spelling);
 if(!bookId||!className||!day||!selected.length||!modes.length){message('Choose a book, units, class, due date and at least one mode.');return}
 if(!previewReady){message('Wait for the vocabulary preview to finish before assigning.');return}
 const recipientModeValue=recipientMode();
 const recipientIds=recipientModeValue==='students'?[...selectedStudentIds].filter(id=>roster.some(st=>st.id===id)):[];
 if(recipientModeValue==='students'&&(!rosterReady||recipientIds.length===0)){message('Choose at least one student before assigning.');return}
 busy=true;p.querySelector('#uaCreate').disabled=true;message('Checking selected units…');
 try{
  const book=books.find(b=>b.id===bookId),chosen=units.filter(u=>selected.includes(u.id));
  const prepared=[];
  for(const unit of chosen){const targets=await getTargets(unit.id);if(!targets.length)throw Error('Unit '+unit.unit_number+' has no available words. Nothing has been assigned.');prepared.push({unit,targets})}
  const groupId='wg-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
  const due_at=new Date(day+'T23:59:59').toISOString(),created=[];
  for(const {unit,targets} of prepared){
   const title=book.title+' · Unit '+unit.unit_number+(unit.title?' — '+unit.title:'');
   const payload={class:className,title,list_title:title,description:'Word Genius textbook vocabulary',source_type:'vocab_study',list_key:'vocab_catalog:'+bookId+':'+unit.id,list_meta:{source_app:'vocab_catalog',source_book_id:bookId,source_unit_ids:[unit.id],unit_id:unit.id,source_unit_id:unit.id,assignment_group_id:groupId,assignment_group_title:book.title+' · '+chosen.map(u=>'Unit '+u.unit_number).join(', '),required_modes:modes,coach_golden_enabled:modes.includes('spelling_coach'),fresh_session:!!p.querySelector('#uaFreshSession')?.checked,workload_mode:'all',...(recipientModeValue==='students'?{target_student_ids:recipientIds}:{})},due_at,goal_type:'clean_pass',goal_value:100,targets};
   try{const result=await homework(payload);created.push(result.assignment?.id)}catch(e){throw Error('Saved '+created.length+' of '+prepared.length+' unit assignments. Remaining units were not saved: '+e.message)}
  }
  message('Assigned '+created.length+' separate units to '+(recipientModeValue==='students'?recipientIds.length+' selected student'+(recipientIds.length===1?'':'s')+' in ':'the whole class · ')+className+'. Each unit has its own progress.');
  window.dispatchEvent(new CustomEvent('willena:assignment-created',{detail:{message:created.length+' Word Genius units · '+className}}));window.WillenaAssignmentsV1?.reload?.();
 }catch(e){message('Assignment issue: '+e.message)}finally{busy=false;updateRecipientUI()}
}

window.addEventListener('ua:word-mounted',()=>{void mount()});
})();
