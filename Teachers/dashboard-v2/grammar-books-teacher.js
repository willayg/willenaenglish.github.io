/* Grammar Genius teacher Books view. Preserves the original Foundations student analytics. */
(()=>{'use strict';
const OP='https://fiieuiktlsivwfgyivai.supabase.co';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
let active='books',bookRows=[],progressMap=new Map(),loaded=false;
async function call(path,body=null){
 let token=window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
 if(!token)throw Error('Teacher sign-in required');
 const send=t=>fetch(OP+'/rest/v1/'+path,{method:body===null?'GET':'POST',cache:'no-store',headers:{apikey:KEY,Authorization:'Bearer '+t,...(body===null?{}:{'Content-Type':'application/json'})},...(body===null?{}:{body:JSON.stringify(body)})});
 let response=await send(token);
 if(response.status===401&&window.WillenaAPI?.fetch){
  const refreshed=await window.WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=refresh');
  const r=await refreshed.json().catch(()=>({}));
  if(r.access_token){window.WillenaAPI.setLocalTokens?.(r.access_token,r.refresh_token||'');response=await send(r.access_token)}
 }
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw Error(data?.message||'Grammar progress unavailable ('+response.status+')');
 return data;
}
function show(tab){
 active=tab;
 const books=$('#gfTeacherBooksPanel'),foundation=$('#gfTeacherFoundationsPanel');
 if(!books||!foundation)return;
 books.hidden=tab!=='books';foundation.hidden=tab!=='foundations';
 $$('[data-gf-teacher-path]').forEach(b=>{const yes=b.dataset.gfTeacherPath===tab;b.classList.toggle('active',yes);b.setAttribute('aria-selected',String(yes))});
 if(tab==='books'&&!loaded)void load();
}
function render(){
 const host=$('#gfTeacherBookList');if(!host)return;
 const selected=$('#gfTeacherBookClass')?.value||'';
 const rows=bookRows.filter(a=>!selected||a.class===selected);
 const cards=window.WillenaGeniusHomeworkCard;
 if(!cards){host.textContent='Shared homework cards unavailable';return}
 host.innerHTML=rows.length?'<div class="ua-genius-manage-list">'+rows.map(a=>{
  const x=progressMap.get(String(a.id));
  const detail=x?.student_rows?.length?x.student_rows.map(st=>'<div class="gf-hw-student"><span>'+esc(st.name||'Student')+'</span><span>'+esc(st.done??0)+'/'+esc(st.total??0)+' activities</span><strong class="'+(st.passed?'gf-hw-done':'')+'">'+(st.passed?'Complete':'In progress')+'</strong></div>').join(''):'<div class="gf-hw-loading">No recorded completion yet</div>';
  return cards.card({id:a.id,className:a.class,task:a.title,dueAt:a.due_at,createdBy:a.created_by,progressLabel:'Chapter homework',body:'<div class="gf-hw-progress-summary">'+esc(x?.passed??0)+'/'+esc(x?.students??0)+' complete</div><div class="gf-hw-students">'+detail+'</div>'});
 }).join('')+'</div>':'<div class="gf-hw-loading">No book homework for this class.</div>';
 for(const a of rows){const x=progressMap.get(String(a.id));cards.updateRing(a.id,x?.students?100*x.passed/x.students:null,host)}
 void cards.hydrateTeachers(host);
}
async function load(){
 const host=$('#gfTeacherBookList');if(!host)return;
 host.textContent='Loading book homework…';
 try{
  const [rows,progress]=await Promise.all([
   call('homework_assignments?select=id,title,class,created_by,due_at,active,status,source_type,created_at&source_type=eq.grammar_books&order=created_at.desc&limit=250'),
   call('rpc/teacher_grammar_book_homework_progress_v1',{})
  ]);
  bookRows=(rows||[]).filter(a=>a.active!==false&&a.status==='active');
  progressMap=new Map((Array.isArray(progress)?progress:[]).map(x=>[String(x.id),x]));
  loaded=true;
  const control=$('#gfTeacherBookClass'),before=control?.value||'';
  if(control){const cls=[...new Set(bookRows.map(a=>a.class).filter(Boolean))].sort();control.replaceChildren(new Option('All Classes',''),...cls.map(x=>new Option(x,x)));control.value=cls.includes(before)?before:''}
  render();
 }catch(e){host.innerHTML='<div class="gf-hw-error">Could not load Grammar book progress: '+esc(e.message)+'</div>'}
}
function assign(){
 const button=$('.rail [data-view="assignments"]')||$('.mobile-tabs [data-view="assignments"]');
 button?.click();
 window.UniversalAssignments?.openTab?.('grammar');
 const create=$('#universalAssignments [data-ua-sub="create"]');
 create?.click();
}
function boot(){
 const view=$('#view-grammar-foundations');if(!view||$('#gfTeacherBookTabs'))return;
 const old=[...view.children];
 const base=document.createElement('div');base.id='gfTeacherFoundationsPanel';
 old.forEach(n=>base.appendChild(n));
 const tabs=document.createElement('div');tabs.id='gfTeacherBookTabs';tabs.className='class-leaders-tabs';
 tabs.innerHTML='<button type="button" class="class-leaders-tab active" data-gf-teacher-path="books">Book Grammar</button><button type="button" class="class-leaders-tab" data-gf-teacher-path="foundations">Foundations</button>';
 const panel=document.createElement('div');panel.id='gfTeacherBooksPanel';
 panel.innerHTML='<div class="page-head"><div><h1>Grammar Genius Books</h1><div class="panel-sub">Assigned textbook chapters and class completion</div></div><div class="filters"><select class="control" id="gfTeacherBookClass"><option value="">All Classes</option></select><button class="control" id="gfTeacherBooksRefresh" type="button">Refresh</button><button class="control ua-primary" id="gfTeacherBooksAssign" type="button">Assign Homework</button></div></div><div id="gfTeacherBookList" class="panel" style="padding:14px"></div>';
 view.append(tabs,panel,base);
 $$('[data-gf-teacher-path]',tabs).forEach(b=>b.onclick=()=>show(b.dataset.gfTeacherPath));
 $('#gfTeacherBookClass').onchange=render;
 $('#gfTeacherBooksRefresh').onclick=()=>{loaded=false;void load()};
 $('#gfTeacherBooksAssign').onclick=assign;
 // Keep the old view operational; only render the book tab on first selection.
 base.hidden=true;
 const navButtons=$$('[data-view="grammar-foundations"]');
 navButtons.forEach(b=>b.addEventListener('click',()=>{if(active==='books'&&!loaded)void load()}));
 if(view.classList.contains('active'))void load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
