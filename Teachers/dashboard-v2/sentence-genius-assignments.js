// Sentence Genius is one app inside the universal Teachers -> Assignments workspace.
// No separate homework write table; use the established homework API.
import {loadTeacherBookCatalog,loadTeacherClasses,loadUnits,loadSentences}
  from '/students/sentence-genius/content.js?v=sg-homework-v5a';
const el=id=>document.getElementById(id);
const REQUIRED=['sentence_coach','sentence_unscramble','sentence_speaking'];
const MODES={coach:'Coach',unscramble:'Unscramble',speaking:'Speaking'};
const state={books:[],units:[],book:null,unit:null,items:[],generation:0,
  classes:[],assigning:false,progressGeneration:0};
function status(message){el('sgaStatus').textContent=message||''}
function option(select,rows,prompt,label){
  select.replaceChildren(new Option(prompt,''));
  for(const row of rows)select.append(new Option(label(row),String(row.id)));
}
async function api(url,{body=null}={}){
  const sender=window.WillenaAPI?.fetch?.bind(window.WillenaAPI)||fetch;
  const response=await sender(url,{method:body?'POST':'GET',credentials:'include',cache:'no-store',
    ...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.success!==true)throw Error(data.error||data.message||'Homework request failed ('+response.status+')');
  return data;
}
const metaOf=row=>{
  try{return typeof row.list_meta==='string'?JSON.parse(row.list_meta):row.list_meta||{}}
  catch{return{}}
};
function loadClassOptions(rows){
  const select=el('sgaClasses'),manage=el('sgaManageClass');
  const before=[...select.selectedOptions].map(x=>x.value);
  const selected=manage.value;
  select.replaceChildren();
  for(const x of rows){
    const option=new Option(x.display_name||x.name,String(x.name));
    option.selected=before.includes(option.value);
    select.append(option);
  }
  manage.replaceChildren(new Option('Choose a class',''));
  for(const x of rows)manage.append(new Option(x.display_name||x.name,String(x.name)));
  manage.value=rows.some(x=>x.name===selected)?selected:(rows[0]?.name||'');
}
async function loadClasses(){
  let rows=[];
  try{
    rows=(await loadTeacherClasses()).map(row=>({
      name:String(row.name||''),display_name:String(row.display_name||row.name||'')
    })).filter(x=>x.name);
  }catch(error){
    console.warn('[Sentence Genius assignments] teacher classes unavailable',error);
    const primary=el('classSelect');
    rows=[...(primary?.options||[])].filter(x=>x.value).map(x=>({name:x.value,display_name:x.text}));
  }
  rows=[...new Map(rows.map(x=>[x.name,x])).values()];
  if(!rows.length)throw Error('Teacher class catalog could not be loaded');
  state.classes=rows;loadClassOptions(rows);
  await refresh();
}
async function selectBook(id){
  const token=++state.generation;
  state.book=state.books.find(x=>String(x.id)===String(id))||null;
  state.unit=null;state.items=[];state.units=[];
  option(el('sgaUnit'),[],'Choose a unit',x=>x.title);
  el('sgaUnitPreview').textContent='Select a unit to see its sentence count.';
  if(!state.book)return;
  el('sgaUnitPreview').textContent='Loading units…';
  const units=await loadUnits(state.book.id);
  if(token!==state.generation)return;
  state.units=units;
  option(el('sgaUnit'),units,'Select a unit',x=>'Unit '+x.unit_number+(x.title?' · '+x.title:''));
  el('sgaUnitPreview').textContent=units.length+' units available.';
}
async function selectUnit(id){
  const token=++state.generation;
  state.unit=state.units.find(x=>String(x.id)===String(id))||null;
  state.items=[];el('sgaUnitPreview').textContent='Loading actual textbook sentences…';
  if(!state.book||!state.unit){el('sgaUnitPreview').textContent='Choose a textbook unit.';return}
  const sentences=await loadSentences(state.book.id,state.unit.id,state.unit);
  if(token!==state.generation)return;
  state.items=sentences;
  el('sgaUnitPreview').textContent=sentences.length+' sentences · Coach + Unscramble + Speaking · '+
    (sentences.length?'Ready to assign':'No English/Korean sentences available in this unit');
}
function unitPayload(cls,date){
  const book=state.book,unit=state.unit;
  return {
    class:cls,title:'Sentence Genius · '+book.title+' · Unit '+unit.unit_number,
    description:'Complete Coach, Unscramble and Speaking for every sentence.',
    list_key:'sentence-genius:'+book.id+':'+unit.id,
    list_title:'Sentence Genius',
    list_meta:{app:'sentence_genius',source_type:'sentence_genius',
      source_book_id:book.id,source_unit_id:unit.id,
      book_title:book.title,unit_number:unit.unit_number,
      sentence_count:state.items.length,
      sentence_ids:state.items.map(x=>x.id),
      required_skills:REQUIRED},
    due_at:date.toISOString(),goal_type:'completion',goal_value:1
  };
}
async function assign(){
  if(state.assigning)return;
  const classes=[...el('sgaClasses').selectedOptions].map(o=>o.value).filter(Boolean);
  const due=el('sgaDue').value;
  if(!classes.length||!state.book||!state.unit||!due)return status('Select classes, book, unit and due date.');
  if(!state.items.length)return status('This unit has no usable sentences to assign.');
  const date=new Date(due+'T23:59:00');
  if(!Number.isFinite(date.getTime())||date<=new Date())return status('Choose a future due date.');
  state.assigning=true;el('sgaAssign').disabled=true;
  const success=[],skipped=[],errors=[];
  for(const cls of classes){
    try{
      status('Creating Sentence Genius homework for '+cls+'…');
      const existing=await api('/.netlify/functions/homework_api?action=list_assignments&class='+encodeURIComponent(cls));
      const duplicate=(existing.assignments||[]).find(a=>{
        const m=metaOf(a);
        return a.active!==false&&!a.ended_at&&m.app==='sentence_genius'&&
          String(m.source_book_id)===String(state.book.id)&&
          String(m.source_unit_id)===String(state.unit.id);
      });
      if(duplicate){skipped.push(cls+' (already active)');continue}
      await api('/.netlify/functions/homework_api?action=create_assignment',
        {body:unitPayload(cls,date)});
      success.push(cls);
    }catch(error){errors.push(cls+': '+error.message)}
  }
  state.assigning=false;el('sgaAssign').disabled=false;
  status([
    success.length?'Assigned: '+success.join(', '):'No new assignments created.',
    skipped.length?'Already assigned: '+skipped.join(', '):'',
    errors.length?'Errors: '+errors.join('; '):''
  ].filter(Boolean).join(' · '));
  if(success.length){
    el('sgaManageClass').value=success[0];
    await refresh();
  }
}
function row(tag,className,text){
  const e=document.createElement(tag);if(className)e.className=className;
  if(text!==undefined)e.textContent=String(text);return e;
}
function progressCard(a,p){
  const card=row('article','sg-homework-card');
  const head=row('div','sg-homework-head');
  const main=row('div','');
  main.append(row('strong','',a.title||'Sentence Genius'));
  main.append(row('small','sg-help','Due '+new Date(a.due_at).toLocaleDateString('ko-KR')));
  const end=row('button','control sg-end','End');
  end.type='button';end.title='End this assignment for the class';
  end.onclick=async()=>{
    if(!confirm('End this Sentence Genius assignment for '+a.class+'?'))return;
    end.disabled=true;
    try{
      await api('/.netlify/functions/homework_api?action=end_assignment',
        {body:{id:a.id}});
      await refresh();
    }catch(error){end.disabled=false;status('Could not end assignment: '+error.message)}
  };
  head.append(main,end);card.append(head);
  const students=p?.progress||[];
  if(!students.length){card.append(row('p','sg-help','No students found for this class.'));return card}
  const completed=students.filter(x=>x.completion>=100).length;
  card.append(row('div','sg-homework-summary',
    completed+'/'+students.length+' completed · '+students.length+' students'));
  const roster=row('div','sg-homework-roster');
  const ordered=students.slice().sort((a,b)=>(a.completion||0)-(b.completion||0));
  for(const s of ordered){
    const item=row('div','sg-homework-student');
    const percent=Math.min(100,Math.max(0,Number(s.completion)||0));
    const top=row('div','sg-homework-student-head');
    top.append(row('strong','',s.name||s.korean_name||'Student'),row('span','',percent+'%'));
    const progress=row('div','sg-homework-track');
    const fill=row('div','sg-homework-fill');
    fill.style.width=percent+'%';progress.append(fill);
    const skills=row('small','sg-homework-skill-counts',
      (s.modes||[]).map(m=>(MODES[m.mode]||m.mode)+': '+m.passed+'/'+m.total).join(' · '));
    item.append(top,progress,skills);roster.append(item);
  }
  card.append(roster);return card;
}
async function refresh(){
  const token=++state.progressGeneration,root=el('sgaAssignments');
  const cls=el('sgaManageClass').value;
  root.replaceChildren();
  if(!cls){root.textContent='Select a class to view homework.';return}
  root.textContent='Loading assignments…';
  try{
    const all=await api('/.netlify/functions/homework_api?action=list_assignments&class='+encodeURIComponent(cls));
    const assignments=(all.assignments||[]).filter(a=>{
      const m=metaOf(a);
      return m.app==='sentence_genius'&&a.active!==false&&!a.ended_at
    });
    if(token!==state.progressGeneration)return;
    root.replaceChildren();
    if(!assignments.length){root.textContent='No active Sentence Genius assignments for '+cls+'.';return}
    const results=await Promise.all(assignments.map(async a=>{
      try{return{assignment:a,progress:await api('/.netlify/functions/homework_api?action=assignment_progress&assignment_id='+encodeURIComponent(a.id))}}
      catch(error){return{assignment:a,error:error.message}}
    }));
    if(token!==state.progressGeneration)return;
    for(const r of results){
      if(r.error){
        const card=row('article','sg-homework-card');
        card.append(row('strong','',r.assignment.title),row('p','sg-help','Progress unavailable: '+r.error));
        root.append(card);
      }else root.append(progressCard(r.assignment,r.progress));
    }
  }catch(error){if(token===state.progressGeneration)root.textContent='Homework unavailable: '+error.message}
}
async function boot(){
  el('sgaBook').onchange=()=>void selectBook(el('sgaBook').value).catch(e=>status(e.message));
  el('sgaUnit').onchange=()=>void selectUnit(el('sgaUnit').value).catch(e=>status(e.message));
  el('sgaAssign').onclick=()=>void assign();
  el('sgaRefresh').onclick=()=>void refresh();
  el('sgaManageClass').onchange=()=>void refresh();
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
  el('sgaDue').value=[tomorrow.getFullYear(),String(tomorrow.getMonth()+1).padStart(2,'0'),
    String(tomorrow.getDate()).padStart(2,'0')].join('-');
  const [catalogResult,classesResult]=await Promise.allSettled([
    loadTeacherBookCatalog(),loadClasses()
  ]);
  if(catalogResult.status==='fulfilled'){
    state.books=catalogResult.value;option(el('sgaBook'),state.books,
      'Select a textbook',x=>x.title);
  }else status('Book catalog failed: '+catalogResult.reason.message);
  if(classesResult.status==='rejected')status('Class list failed: '+classesResult.reason.message);
}
void boot().catch(error=>status('Assignments setup failed: '+error.message));
