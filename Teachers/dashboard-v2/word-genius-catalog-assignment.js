/* Live catalog assignments for Word Genius; additive to Word Builder. */
(()=>{'use strict';
const HOST='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let books=[],units=[],selected=[],busy=false;
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
 div.innerHTML='<div class="ua-section-heading"><div><div class="ua-eyebrow">CONTENT DATABASE</div><h3>Assign from a book</h3></div><button type="button" class="control" id="uaReloadBooks">↻ Refresh books</button></div><form id="uaCatalogForm"><div class="ua-catalog-fields"><label>Book<select id="uaBook" class="control" required><option value="">Loading books…</option></select></label><label>Class<select id="uaClass" class="control" required><option value="">Choose class…</option></select></label><label>Due date<input id="uaDue" class="control" type="date" required></label></div><div class="ua-catalog-units"><strong>Units</strong><div id="uaUnitList">Select a book first.</div></div><div class="ua-catalog-modes"><strong>Practice modes</strong><label><input type="checkbox" name="uaMode" value="quiz" checked> Quiz</label><label><input type="checkbox" name="uaMode" value="spelling_test" checked> Spelling</label><label><input type="checkbox" name="uaMode" value="speaking" checked> Speaking</label></div><div class="ua-catalog-footer"><span id="uaCount">Choose units to preview vocabulary.</span><button type="submit" class="control ua-primary" id="uaCreate" disabled>Assign selected words →</button></div><p id="uaCatalogMessage" role="status" aria-live="polite"></p></form>';
 root().querySelector('.ua-catalog-host').appendChild(div);
 const due=div.querySelector('#uaDue');const d=new Date(Date.now()+7*86400000);due.value=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 div.querySelector('#uaReloadBooks').onclick=loadBooks;
 div.querySelector('#uaBook').onchange=loadUnits;
 div.querySelector('#uaCatalogForm').addEventListener('submit',submit);
 await Promise.all([loadBooks(),loadClasses()]);
}
function message(t){const el=panel()?.querySelector('#uaCatalogMessage');if(el)el.textContent=t}
async function loadBooks(){
 const select=panel()?.querySelector('#uaBook');if(!select)return;
 const before=select.value;
 try{books=await content('content_books?select=id,title,status&status=in.(review,published)&order=title.asc&limit=1000');select.innerHTML='<option value="">Choose a book…</option>'+books.map(b=>'<option value="'+esc(b.id)+'">'+esc(b.title)+'</option>').join('');if(books.some(b=>b.id===before)){select.value=before}else{units=[];selected=[];renderUnits()}}catch(e){message(e.message)}
}
async function loadClasses(){
 const sel=panel()?.querySelector('#uaClass');if(!sel)return;
 try{
 const url=window.WillenaAPI?.getApiUrl?.('/.netlify/functions/admin_classes?action=list')||'/.netlify/functions/admin_classes?action=list';
 const res=await (window.WillenaAPI?.fetch?window.WillenaAPI.fetch('/.netlify/functions/admin_classes?action=list'):fetch(url,{credentials:'include'}));const data=await res.json();
 let classes=Array.isArray(data.classes)?data.classes:[];
 if(!classes.length){const old=document.querySelector('#assignmentClassFilter');classes=[...(old?.options||[])].map(o=>({name:o.value})).filter(o=>o.name)}
 sel.innerHTML='<option value="">Choose class…</option>'+classes.map(c=>'<option value="'+esc(c.name||c.display_name)+'">'+esc(c.display_name||c.name)+'</option>').join('');
 }catch(e){const old=document.querySelector('#assignmentClassFilter');const classes=[...(old?.options||[])].map(o=>({name:o.value})).filter(o=>o.name);sel.innerHTML='<option value="">Choose class…</option>'+classes.map(c=>'<option value="'+esc(c.name)+'">'+esc(c.name)+'</option>').join('');if(!classes.length)message('Class list unavailable: '+e.message)}
}
async function loadUnits(){
 const bookId=panel()?.querySelector('#uaBook')?.value;selected=[];units=[];renderUnits();if(!bookId)return;
 try{units=await content('content_units?select=id,unit_number,title&book_id=eq.'+encodeURIComponent(bookId)+'&status=in.(review,published)&order=unit_number.asc&limit=1000');renderUnits()}catch(e){message(e.message)}
}
function renderUnits(){
 const box=panel()?.querySelector('#uaUnitList');if(!box)return;
 box.innerHTML=units.length?units.map(u=>'<label class="ua-unit-chip"><input type="checkbox" value="'+esc(u.id)+'" data-ua-unit><span>Unit '+esc(u.unit_number||'')+' · '+esc(u.title)+'</span></label>').join(''):'No units loaded.';
 box.querySelectorAll('input').forEach(i=>i.addEventListener('change',()=>{selected=[...box.querySelectorAll('input:checked')].map(n=>n.value);panel().querySelector('#uaCreate').disabled=!selected.length;panel().querySelector('#uaCount').textContent=selected.length+' unit(s) selected'}));
 const create=panel()?.querySelector('#uaCreate');if(create)create.disabled=true;
}
async function getTargets(unitId){
 const rows=await content('unit_vocab_targets?select=lexical_entry_id&unit_id=eq.'+encodeURIComponent(unitId)+'&active=eq.true&order=priority.desc&limit=1000');
 const ids=[...new Set(rows.map(t=>t.lexical_entry_id))];if(!ids.length)return[];
 const entries=await content('lexical_entries?select=id,canonical_text,translation_ko&id=in.'+encodeURIComponent('('+ids.join(',')+')')+'&status=in.(review,published)&limit=1000');
 const by=new Map(entries.map(x=>[x.id,x]));
 return ids.map((id,index)=>{const e=by.get(id);return e?.canonical_text&&e?.translation_ko?{lexical_entry_id:id,english:e.canonical_text,korean:e.translation_ko,position:index}:null}).filter(Boolean);
}
async function submit(ev){
 ev.preventDefault();if(busy)return;
 const p=panel(),bookId=p.querySelector('#uaBook').value,className=p.querySelector('#uaClass').value,day=p.querySelector('#uaDue').value,modes=[...p.querySelectorAll('input[name="uaMode"]:checked')].map(x=>x.value);
 if(!bookId||!className||!day||!selected.length||!modes.length){message('Choose a book, units, class, due date and at least one mode.');return}
 busy=true;p.querySelector('#uaCreate').disabled=true;message('Checking selected units…');
 try{
  const book=books.find(b=>b.id===bookId),chosen=units.filter(u=>selected.includes(u.id));
  const prepared=[];
  for(const unit of chosen){const targets=await getTargets(unit.id);if(!targets.length)throw Error('Unit '+unit.unit_number+' has no available words. Nothing has been assigned.');prepared.push({unit,targets})}
  const groupId='wg-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
  const due_at=new Date(day+'T23:59:59').toISOString(),created=[];
  for(const {unit,targets} of prepared){
   const title=book.title+' · Unit '+unit.unit_number+(unit.title?' — '+unit.title:'');
   const payload={class:className,title,list_title:title,description:'Word Genius textbook vocabulary',source_type:'vocab_study',list_key:'vocab_catalog:'+bookId+':'+unit.id,list_meta:{source_app:'vocab_catalog',source_book_id:bookId,source_unit_ids:[unit.id],unit_id:unit.id,source_unit_id:unit.id,assignment_group_id:groupId,assignment_group_title:book.title+' · '+chosen.map(u=>'Unit '+u.unit_number).join(', '),required_modes:modes,workload_mode:'all'},due_at,goal_type:'clean_pass',goal_value:100,targets};
   try{const result=await homework(payload);created.push(result.assignment?.id)}catch(e){throw Error('Saved '+created.length+' of '+prepared.length+' unit assignments. Remaining units were not saved: '+e.message)}
  }
  message('Assigned '+created.length+' separate units to '+className+'. Each unit has its own progress.');window.WillenaAssignmentsV1?.reload?.();
 }catch(e){message('Assignment issue: '+e.message)}finally{busy=false;p.querySelector('#uaCreate').disabled=false}
}

window.addEventListener('ua:word-mounted',()=>{void mount()});
})();
