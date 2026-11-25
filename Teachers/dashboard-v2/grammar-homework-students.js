/* Student-first view of Grammar Genius teacher homework; all figures come from saved stage progress. */
(()=>{'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
const dateText=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})};
const complete=r=>r.complete===true;
function group(rows){
 const map=new Map();
 for(const r of Array.isArray(rows)?rows:[]){
  if(!r.student_id||!r.assignment_id)continue;
  const key=String(r.student_id);
  if(!map.has(key))map.set(key,{id:key,name:r.name||'Student',koreanName:r.korean_name||'',className:r.class_name||'',items:[]});
  map.get(key).items.push(r);
 }
 return [...map.values()].map(st=>{
  st.items.sort((a,b)=>(complete(a)?1:0)-(complete(b)?1:0)||new Date(a.due_at)-new Date(b.due_at)||String(a.module_title).localeCompare(String(b.module_title)));
  st.done=st.items.filter(complete).length;
  st.total=st.items.length;
  st.percent=st.total?Math.round(100*st.done/st.total):0;
  st.due=st.items.filter(r=>!complete(r)).map(r=>r.due_at).filter(Boolean).sort()[0]||st.items.map(r=>r.due_at).filter(Boolean).sort()[0]||'';
  return st;
 }).sort((a,b)=>a.percent-b.percent||a.className.localeCompare(b.className)||String(a.koreanName||a.name).localeCompare(String(b.koreanName||b.name),'ko'));
}
function detail(st,history){
 const items=st.items;
 return '<div class="gf-hw-task-heading"><span>Assigned levels</span><span>'+st.done+' of '+st.total+' complete</span></div>'+
 items.map(r=>{
  const done=complete(r),percent=clamp(r.percent),attempts=Number(r.attempts)||0;
  const overdue=!history&&!done&&r.due_at&&new Date(r.due_at).getTime()<Date.now();
  const label=done?'Completed':overdue?'Overdue':attempts?'In progress':'Not started';
  const state=done?'gf-hw-task-done':overdue?'gf-hw-task-overdue':'';
  return '<div class="gf-hw-task '+state+'"><div class="gf-hw-task-titles"><strong>'+esc(r.module_title||'Grammar')+'</strong><span>'+esc(r.stage_title||'Level')+'</span><small>Due '+esc(dateText(r.due_at))+' · '+esc(r.requirement)+'% required</small></div><div class="gf-hw-task-score"><b>'+esc(label)+'</b><span>'+(attempts?'Best '+esc(r.best_score)+'/'+esc(r.total)+' · '+percent+'%':'No attempts')+'</span></div></div>';
 }).join('');
}
function card(st,expanded,history){
 const isOpen=st.id===expanded;
 const note=st.done===st.total?'All assigned work complete':(st.total-st.done)+' levels remaining';
 return '<article class="gf-hw-student-card'+(isOpen?' is-expanded':'')+'">'+
 '<button type="button" class="gf-hw-student-toggle" data-gf-student="'+esc(st.id)+'" aria-controls="gf-hw-student-detail-'+esc(st.id)+'" aria-expanded="'+isOpen+'">'+
 '<span class="gf-hw-student-main"><strong>'+esc(st.name)+'</strong><small>'+esc(st.koreanName)+(st.koreanName?' · ':'')+esc(st.className)+'</small><span class="gf-hw-student-note">'+esc(note)+'</span></span>'+
 '<span class="gf-hw-student-completion"><b>'+st.percent+'%</b><small>'+st.done+'/'+st.total+' complete</small></span>'+
 '<span class="gf-hw-student-chevron" aria-hidden="true">'+(isOpen?'⌃':'⌄')+'</span></button>'+
 '<div class="gf-hw-student-bar" role="progressbar" aria-label="'+esc(st.name)+' homework completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+st.percent+'"><i style="width:'+st.percent+'%"></i></div>'+
 (isOpen?'<div class="gf-hw-student-detail" id="gf-hw-student-detail-'+esc(st.id)+'">'+detail(st,history)+'</div>':'')+
 '</article>';
}
function render(rows,{expandedId='',className='',search='',history=false}={}){
 const groups=group(rows);
 const classes=[...new Set(groups.map(s=>s.className).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
 const filtered=groups.filter(s=>(!className||s.className===className)&&(!search||[s.name,s.koreanName,s.className].some(v=>String(v).toLowerCase().includes(search.toLowerCase()))));
 const done=filtered.reduce((sum,s)=>sum+s.done,0),total=filtered.reduce((sum,s)=>sum+s.total,0);
 const overall=total?Math.round(100*done/total):0;
 const fullyDone=filtered.filter(s=>s.done===s.total&&s.total>0).length;
 const stats='<div class="gf-hw-student-summary"><span><b>'+filtered.length+'</b> students</span><span><b>'+done+'/'+total+'</b> completed levels</span><span><b>'+fullyDone+'</b> all finished</span><span class="gf-hw-summary-percent"><b>'+overall+'%</b> overall completion</span></div>';
 const options='<option value="">All classes</option>'+classes.map(c=>'<option value="'+esc(c)+'"'+(c===className?' selected':'')+'>'+esc(c)+'</option>').join('');
 const filters='<div class="gf-hw-student-filters"><label><span>Class</span><select class="control" id="gfHwStudentClass">'+options+'</select></label><label><span>Find student</span><input class="control" id="gfHwStudentSearch" type="search" placeholder="Search names…" value="'+esc(search)+'"></label></div>';
 const list=filtered.length?filtered.map(st=>card(st,expandedId,history)).join(''):'<div class="gf-hw-empty-students">No students with '+(history?'past':'current')+' Grammar Genius homework match these filters.</div>';
 return stats+filters+'<div class="gf-hw-student-cards">'+list+'</div>';
}
window.WillenaGrammarHomeworkStudentCards={render,group};
})();