/* Assignment workspace. Uses existing dashboard panels and Naesin assignment API. */
(()=>{'use strict';
const root=document.getElementById('universalAssignments');if(!root)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const apps=[{id:'my',label:'My',sub:'My homework',icon:'◎'},{id:'all',label:'All',sub:'All homework',icon:'▦'},{id:'naesin',label:'내신',sub:'Exam practice',icon:'文'},{id:'word',label:'Word Genius',sub:'Vocabulary',icon:'Aa'},{id:'grammar',label:'Grammar Genius',sub:'Grammar mastery',icon:'G'},{id:'sentence',label:'Sentence Genius',sub:'Sentence speaking & building',icon:'S'},{id:'puzzles',label:'Puzzles',sub:'Word games',icon:'◇'},{id:'writing',label:'Writing Genius',sub:'Diaries & topic writing',icon:'✎'}];
const stateKey='willena.teachers.assignments.v2';
let saved={};try{saved=JSON.parse(sessionStorage.getItem(stateKey)||'{}')||{}}catch{}
let active=apps.some(a=>a.id===saved.active)?saved.active:'my',loading=false,groups=[];
const remember=()=>{try{sessionStorage.setItem(stateKey,JSON.stringify({active,subviews}))}catch{}};
const subviews={my:'manage',all:'manage',naesin:'manage',word:'manage',grammar:'manage',sentence:'manage',puzzles:'manage',writing:'manage'};
Object.keys(subviews).forEach(k=>{if(saved.subviews?.[k]==='create'||saved.subviews?.[k]==='manage')subviews[k]=saved.subviews[k]});
let wordPanel=null,wordHome=null;
function restoreWordPanel(){if(wordPanel&&wordHome&&wordPanel.parentElement!==wordHome)wordHome.appendChild(wordPanel)}
function showWordPanel(body){const panel=document.querySelector('[data-vocab-subview="assignments"]');if(!panel){body.innerHTML='<div class="ua-empty">Word Genius tracking unavailable.</div>';return}if(!wordPanel){wordPanel=panel;wordHome=panel.parentElement}panel.classList.add('ua-mounted-word');panel.classList.add('active');body.appendChild(panel);window.dispatchEvent(new CustomEvent('vocab:assignments-open'))}


const newHomeworkApps={
 writing:{heading:'Assign writing homework',types:[['diary','Daily diary'],['topic','Topic writing']]},
 puzzles:{heading:'Assign puzzle homework',types:[['boggle','Boggle'],['wordsearch','Word Search'],['crossword','Crossword'],['mixmatch','Mix & Match']]}
};
function homeworkForm(app,body){
 const spec=newHomeworkApps[app];
 const select=document.getElementById('classSelect');
 const classes=[...new Set([...select?.options||[]].map(o=>o.value).filter(Boolean))];
 body.innerHTML='<form id="uaNewHomework" class="ua-feature" style="display:grid;gap:12px;max-width:580px;margin:12px auto;padding:24px">'+
 '<h4>'+spec.heading+'</h4><label>Class <select class="control" name="class" required><option value="">Choose class</option>'+classes.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('')+'</select></label>'+
 '<label>Homework type <select class="control" name="kind">'+spec.types.map(x=>'<option value="'+x[0]+'">'+x[1]+'</option>').join('')+'</select></label>'+
 '<label>Title <input class="control" name="title" required maxlength="120" placeholder="Homework title"></label>'+
 (app==='writing'?'<label>Writing instructions / topic <textarea class="control" name="prompt" rows="4" maxlength="1500" placeholder="What should students write about?"></textarea></label>':'')+
 '<label>Due date <input class="control" name="due" type="date" required></label>'+
 '<button class="control ua-primary" type="submit">Assign homework →</button><div id="uaNewHomeworkStatus" role="status"></div></form>';
 const form=body.querySelector('form'),date=form.elements.due;
 const tomorrow=new Date(Date.now()+86400000);date.value=tomorrow.getFullYear()+'-'+String(tomorrow.getMonth()+1).padStart(2,'0')+'-'+String(tomorrow.getDate()).padStart(2,'0');
 form.onsubmit=async e=>{
  e.preventDefault();
  const button=form.querySelector('button[type="submit"]'),status=form.querySelector('#uaNewHomeworkStatus');
  button.disabled=true;status.textContent='Assigning…';
  try{
   const cls=form.elements['class'].value,kind=form.elements.kind.value,title=form.elements.title.value.trim(),prompt=app==='writing'?form.elements.prompt.value.trim():'';
   if(!cls||!title||!date.value)throw Error('Select a class, title and due date.');
   const due=new Date(date.value+'T23:59:59+09:00').toISOString();
   const meta={source_type:app==='writing'?'writing_genius':'puzzles',kind,app:app==='writing'?'writing_genius':'puzzles',prompt_text:prompt,required_count:1};
   const payload={class:cls,title,description:prompt||null,list_key:(app==='writing'?'writing_genius:':'puzzles:')+kind,list_title:title,list_meta:meta,due_at:due,goal_type:'completions',goal_value:1};
   const url=window.WillenaAPI?.getApiUrl?.('/.netlify/functions/homework_api?action=create_assignment')||'/.netlify/functions/homework_api?action=create_assignment';
   const response=await fetch(url,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const result=await response.json().catch(()=>({}));
   if(!response.ok||!result.success)throw Error(result.error||'Homework could not be created');
   status.textContent='Homework created. Student completion tracking for this type is not connected yet.';
   form.reset();date.value=tomorrow.getFullYear()+'-'+String(tomorrow.getMonth()+1).padStart(2,'0')+'-'+String(tomorrow.getDate()).padStart(2,'0');
  }catch(error){status.textContent=error.message}finally{button.disabled=false}
 };
}

function groupRows(){return window.NaesinV2Data?.getCachedGroups?.()||[]}
function render(){
 restoreWordPanel();
 const selected=apps.find(a=>a.id===active),sub=subviews[active];
 root.innerHTML=
 '<div class="ua-app-tabs" role="tablist" aria-label="Assignment app">'+apps.map(a=>'<button type="button" role="tab" aria-selected="'+(active===a.id)+'" class="ua-app-tab'+(active===a.id?' active':'')+'" data-ua-tab="'+a.id+'"><span class="ua-app-icon" aria-hidden="true">'+a.icon+'</span><span class="ua-app-label"><b>'+a.label+'</b></span></button>').join('')+'</div>'+
 '<section class="ua-workspace" aria-label="'+selected.label+' assignments"><div class="ua-section-heading"><div><div class="ua-eyebrow">CREATE & MANAGE</div><h3>'+selected.label+'</h3></div><span class="ua-section-count" id="uaStatus">'+(active==='naesin'?groups.length+' exam groups':active==='word'?'Word Genius homework':active==='grammar'?'Connected · Grammar Genius':active==='sentence'?'Connected · Sentence Genius':'Not yet connected')+'</span></div><div class="ua-subtabs" role="tablist" aria-label="Homework workflow"><button type="button" role="tab" data-ua-sub="manage" class="ua-subtab'+(sub==='manage'?' active':'')+'" aria-selected="'+(sub==='manage')+'">Manage Homework</button><button type="button" role="tab" data-ua-sub="create" class="ua-subtab'+(sub==='create'?' active':'')+'" aria-selected="'+(sub==='create')+'">Assign Homework</button></div><div class="ua-app-body" id="uaAppBody"></div></section>';
 root.querySelectorAll('[data-ua-tab]').forEach(b=>b.addEventListener('click',()=>{const next=b.dataset.uaTab;subviews[next]=subviews[active];active=next;remember();render()}));
 root.querySelectorAll('[data-ua-sub]').forEach(b=>b.addEventListener('click',()=>{subviews[active]=b.dataset.uaSub;remember();render()}));
 const body=root.querySelector('#uaAppBody');
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
 if(sub==='manage'){body.innerHTML='<div class="ua-word-actions"><div><h4>Manage Word Genius homework</h4><p>Current assignments, history and student progress.</p></div></div>';showWordPanel(body)}
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
   body.innerHTML='<div class="ua-feature"><div class="ua-feature-symbol">✎</div><div class="ua-feature-copy"><h4>Writing Genius · Diaries & topic writing</h4><p>Read student writing and teacher feedback in Writing Genius. Homework assignment creation is not connected yet.</p><button type="button" class="control ua-primary" id="uaOpenWriting">Open Writing Genius →</button></div></div>';
   body.querySelector('#uaOpenWriting')?.addEventListener('click',()=>{window.WritingGeniusTeacher?.openView?.()});
   return;
 }
 if(active==='sentence'){
   body.innerHTML='<div id="uaSentenceHomework"></div>';
   window.dispatchEvent(new CustomEvent('ua:sentence-mounted',{detail:{sub}}));
   return;
 }
 if(active==='puzzles'&&sub==='create'){homeworkForm('puzzles',body);return}
 const desc=sub==='manage'?'Homework tracking is not connected for this app yet.':active==='grammar'?'Grammar step assignment creation is not connected yet.':'Puzzle assignment creation is not connected yet.';
 body.innerHTML='<div class="ua-feature ua-unavailable"><div class="ua-feature-symbol">'+(active==='grammar'?'G':'◇')+'</div><div class="ua-feature-copy"><span class="ua-coming-label">Assignment integration pending</span><h4>'+selected.label+' assignments</h4><p>'+desc+' The assignment connection is not built yet; existing student progress is unaffected.</p></div></div>';
}
async function refresh(){
 if(loading)return;loading=true;try{await window.NaesinV2Data?.loadGroups?.();groups=groupRows()}catch(e){console.warn('Assignments load unavailable',e)}finally{loading=false;render()}
}
window.UniversalAssignments={refresh,openTab:id=>{if(apps.some(a=>a.id===id)){active=id;remember();render()}}};
document.querySelectorAll('[data-view="vocab"]').forEach(el=>el.addEventListener('click',restoreWordPanel));
groups=groupRows();render();void refresh();
})();