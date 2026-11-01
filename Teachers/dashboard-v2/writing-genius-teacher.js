/* Writing Genius staff reader. Intentional: reading submitted work, not AI grading. */
(()=>{
'use strict';
const BASE='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/writing_genius_teacher_submissions_v1';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const $=(sel,root=document)=>root.querySelector(sel);
const $$=(sel,root=document)=>[...root.querySelectorAll(sel)];
const kindName={sentence:'Free sentences',diary:'Daily diary',topic:'Topic writing'};
const state={rows:[],sessions:[],classes:[],activeId:null,activeSessionId:null,tab:'submissions',loaded:false,loading:false};
const formatDate=s=>s?new Date(s).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric'}):'—';
function make(tag,className,text){
 const node=document.createElement(tag);if(className)node.className=className;
 if(text!==undefined)node.textContent=text;return node;
}
function mount(){
 if($('#view-writing-genius'))return;
 const workspace=$('.workspace');if(!workspace)return;
 const view=make('section','view');view.id='view-writing-genius';
 view.innerHTML='<div class="page-head"><div><h1>Writing Genius</h1><div class="panel-sub">Student writing submissions</div></div></div>'+
  '<div class="wg-t-tabs" role="tablist" aria-label="Writing Genius teacher views"><button type="button" class="wg-t-tab is-active" data-wg-tab="submissions">Writing Submissions</button><button type="button" class="wg-t-tab" data-wg-tab="practice">Sentence Practice</button></div>'+
  '<div class="wg-t-filter"><select class="control" id="wgTeacherClass" aria-label="Class"><option value="">All classes</option></select>'+
  '<select class="control" id="wgTeacherKind" aria-label="Writing type"><option value="">All writing</option><option value="sentence">Sentences</option><option value="diary">Diaries</option><option value="topic">Topics</option></select>'+
  '<input class="control search" id="wgTeacherSearch" type="search" placeholder="Search student or title…" aria-label="Search submissions">'+
  '<button type="button" class="control" id="wgTeacherRefresh">Refresh</button></div>'+
  '<div class="wg-t-grid"><section class="panel wg-t-list-panel" aria-label="Writing submissions">'+
  '<div class="panel-head"><div class="panel-title">Submitted writing</div><span id="wgTeacherCount" class="count-pill">0</span></div>'+
  '<div id="wgTeacherList" class="wg-t-list"><p class="wg-t-empty">Select Writing Genius to load submissions.</p></div></section>'+
  '<article class="panel wg-t-reader" aria-label="Selected writing"><div id="wgTeacherDetail" class="wg-t-empty">Choose a student writing submission to read it.</div></article></div>';
 workspace.append(view);
 $('.wg-t-tab',view).forEach(b=>b.onclick=()=>{state.tab=b.dataset.wgTab;state.activeId=null;state.activeSessionId=null;$('.wg-t-tab',view).forEach(x=>x.classList.toggle('is-active',x===b));$('#wgTeacherKind').hidden=state.tab==='practice';render()});
 $('#wgTeacherClass').onchange=()=>void load();
 $('#wgTeacherKind').onchange=render;
 $('#wgTeacherSearch').oninput=render;
 $('#wgTeacherRefresh').onclick=()=>void load();
}
function addNav(){
 const rail=$('.rail');
 if(rail&&!rail.querySelector('[data-view="writing-genius"]')){
  const b=make('button','nav');
  b.type='button';b.dataset.view='writing-genius';
  b.innerHTML='<span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11a3 3 0 0 1 3 3v13H7a2 2 0 0 1-2-2V4Z"/><path d="M9 10h6M9 14h4M18 3l3 3"/></svg></span><span>Writing Genius</span>';
  rail.insertBefore(b,rail.querySelector('[data-view="apps"]')||rail.querySelector('.rail-spacer'));
  b.onclick=()=>openView();
 }
 const mobile=$('.mobile-tabs');
 if(mobile&&!mobile.querySelector('[data-view="writing-genius"]')){
  const b=make('button','mobile-tab');b.type='button';b.dataset.view='writing-genius';
  b.innerHTML='<b>W</b>Writing Genius';
  mobile.insertBefore(b,mobile.querySelector('[data-view="apps"]')||null);
  b.onclick=()=>openView();
 }
}
function show(){
 const view=$('#view-writing-genius');
 if(!view)return;
 $$('.view').forEach(node=>node.classList.toggle('active',node===view));
 $$('[data-view]').forEach(node=>node.classList.toggle('active',node.dataset.view==='writing-genius'));
}
async function token(force=false){
 let t=!force?window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'':'';
 if(t)return t;
 const endpoint='/.netlify/functions/supabase_auth?action=refresh&_='+Date.now();
 const response=await(window.WillenaAPI?.fetch?
  window.WillenaAPI.fetch(endpoint,{credentials:'include',cache:'no-store'}):
  fetch(endpoint,{credentials:'include',cache:'no-store'}));
 const body=await response.json().catch(()=>({}));
 if(!response.ok||!body.access_token)throw Error('Teacher login expired');
 window.WillenaAPI?.setLocalTokens?.(body.access_token,body.refresh_token||'');
 return body.access_token;
}
async function api(cls,endpoint=BASE){
 const call=t=>fetch(endpoint,{method:'POST',cache:'no-store',headers:{
   apikey:KEY,Authorization:'Bearer '+t,'Content-Type':'application/json'},
   body:JSON.stringify({p_class:cls||null})});
 let response=await call(await token());
 if(response.status===401)response=await call(await token(true));
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.success!==true)throw Error(data.message||data.error||'Writing Genius unavailable');
 return data;
}
async function load(){
 if(state.loading)return;state.loading=true;
 const list=$('#wgTeacherList');
 if(list)list.replaceChildren(make('p','wg-t-empty','Loading submissions…'));
 try{
  const cls=$('#wgTeacherClass')?.value||'';
  const [data,practice]=await Promise.all([api(cls),api(cls,'https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/writing_genius_teacher_sentence_sessions_v1')]);
  state.sessions=Array.isArray(practice.entries)?practice.entries:[];
  state.rows=Array.isArray(data.entries)?data.entries:[];
  state.classes=Array.isArray(data.classes)?data.classes:[];
  state.loaded=true;
  const select=$('#wgTeacherClass'),selected=select.value;
  select.replaceChildren();
  const all=make('option','','All classes');all.value='';select.append(all);
  for(const name of state.classes){const o=make('option','',name);o.value=name;select.append(o)}
  select.value=state.classes.includes(selected)?selected:'';
  render();
 }catch(e){
  state.loaded=false;
  if(list)list.replaceChildren(make('p','wg-t-empty','Could not load submissions: '+e.message));
 }finally{state.loading=false}
}
function reviewLines(entry){
 const feedback=entry.ai_feedback;
 const changes=Array.isArray(feedback?.improvements)?feedback.improvements:[];
 const original=String(entry.body||'');
 let corrected=original;
 for(const x of changes){
  const before=String(x.original||'').trim(),after=String(x.better||'').trim();
  if(!before||!after)continue;
  const index=corrected.indexOf(before);
  if(index>=0)corrected=corrected.slice(0,index)+after+corrected.slice(index+before.length);
 }
 return {corrected,changes};
}
function render(){
 if(state.tab==='practice'){renderPractice();return}
 const container=$('#wgTeacherList'),count=$('#wgTeacherCount');if(!container)return;
 const q=($('#wgTeacherSearch')?.value||'').trim().toLowerCase();
 const kind=$('#wgTeacherKind')?.value||'';
 const rows=state.rows.filter(e=>(!kind||e.kind===kind)&&(!q||[e.name,e.korean_name,e.title,e.class_name,e.body].some(v=>String(v||'').toLowerCase().includes(q))))
  .sort((a,b)=>new Date(b.submitted_at||0)-new Date(a.submitted_at||0));
 container.replaceChildren();count.textContent=String(rows.length);
 if(!rows.length){container.append(make('p','wg-t-empty',state.loaded?'No matching submitted writing.':'No writing loaded.'));detail();return}
 let previousDate='';
 const dateLabel=timestamp=>timestamp?new Date(timestamp).toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Seoul'}):'Unknown date';
 for(const e of rows){
  const date=dateLabel(e.submitted_at);
  if(date!==previousDate){const group=make('h3','wg-t-date-heading',date);container.append(group);previousDate=date}
  const b=make('button','wg-t-item wg-t-submission-card'+(e.id===state.activeId?' is-selected':''));b.type='button';
  b.dataset.entryId=e.id;
  const header=make('span','wg-t-card-head');
  header.append(make('strong','wg-t-item-name',e.korean_name||e.name||'Student'),make('span','wg-t-card-time',e.submitted_at?new Date(e.submitted_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'Asia/Seoul'}):''));
  b.append(header,make('strong','wg-t-card-title',e.title||kindName[e.kind]||'Writing'));
  b.append(make('span','wg-t-item-meta',[(e.class_name||''),(kindName[e.kind]||e.kind)].filter(Boolean).join(' · ')));
  b.append(make('small','wg-t-card-excerpt',String(e.body||'').replace(/\s+/g,' ').slice(0,115)));
  b.onclick=()=>{state.activeId=e.id;render();if(window.matchMedia('(max-width:850px)').matches)$('#wgTeacherDetail')?.scrollIntoView({behavior:'smooth',block:'start'})};
  container.append(b);
 }
 if(!rows.some(e=>e.id===state.activeId))state.activeId=rows[0].id;
 detail(rows.find(e=>e.id===state.activeId));
 for(const b of container.querySelectorAll('[data-entry-id]'))b.classList.toggle('is-selected',b.dataset.entryId===state.activeId);
}
function detail(entry){
 const host=$('#wgTeacherDetail');if(!host)return;host.replaceChildren();
 if(!entry){host.append(make('div','wg-t-empty','Choose submitted writing to read it.'));return}
 const head=make('div','wg-t-detail-head');
 head.append(make('span','wg-t-tag',kindName[entry.kind]||entry.kind));
 head.append(make('h2','',entry.title||kindName[entry.kind]));
 head.append(make('p','',(entry.korean_name||entry.name||'Student')+' · '+(entry.class_name||'')+' · '+formatDate(entry.submitted_at)));
 host.append(head);
 if(entry.prompt_text)host.append(make('div','wg-t-prompt',entry.prompt_text));
 const section=(title,body,cls)=>{const wrapper=make('section','wg-t-version');wrapper.append(make('h3','wg-t-version-title',title),make('div','wg-t-paper '+(cls||''),body));host.append(wrapper)};
 section('Original · 학생이 쓴 글',entry.body||'');
 if(entry.ai_feedback){
  const {corrected,changes}=reviewLines(entry);
  section('AI Willi · Corrected version',corrected,'wg-t-corrected');
  if(changes.some(x=>x.clarified_better)){
   const alternatives=make('section','wg-t-version');
   alternatives.append(make('h3','wg-t-version-title','Clarified alternatives'));
   changes.forEach((x,i)=>{if(!x.clarified_better)return;const card=make('div','wg-t-alternative');card.append(make('small','', 'Sentence '+(i+1)),make('p','',x.clarified_better));alternatives.append(card)});
   host.append(alternatives);
  }
  if(!changes.length)host.append(make('p','wg-t-note','AI Willi suggested no corrections.'));
  else host.append(make('p','wg-t-note','AI suggestions shown; the student’s final choices are not yet stored centrally.'));
 }else host.append(make('p','wg-t-note','No saved AI correction is available for this submission.'));
}
function renderPractice(){
 const container=$('#wgTeacherList'),count=$('#wgTeacherCount');if(!container)return;
 const query=($('#wgTeacherSearch')?.value||'').trim().toLowerCase();
 const rows=state.sessions.filter(e=>!query||[e.name,e.korean_name,e.class_name,e.book_title,e.unit_id].some(x=>String(x||'').toLowerCase().includes(query)))
  .sort((a,b)=>new Date(b.activity_at||0)-new Date(a.activity_at||0));
 container.replaceChildren();count.textContent=String(rows.length);
 if(!rows.length){container.append(make('p','wg-t-empty','No sentence practice yet.'));detailPractice();return}
 let lastDate='';
 for(const e of rows){
  const date=new Date(e.activity_at).toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Seoul'});
  if(date!==lastDate){container.append(make('h3','wg-t-date-heading',date));lastDate=date}
  const responses=Array.isArray(e.responses)?e.responses:[];
  const total=Array.isArray(e.questions)?e.questions.length:0;
  const completed=responses.filter(x=>x?.feedback?.grade==='correct').length;
  const b=make('button','wg-t-item wg-t-submission-card'+(e.id===state.activeSessionId?' is-selected':''));b.type='button';
  b.append(make('strong','wg-t-item-name',e.korean_name||e.name||'Student'),make('strong','wg-t-card-title',(e.book_title||e.book_id||'Book')+' · '+(e.unit_id||'Unit')));
  b.append(make('span','wg-t-item-meta',[e.class_name,e.status,completed+' / '+total+' correct'].filter(Boolean).join(' · ')));
  b.onclick=()=>{state.activeSessionId=e.id;renderPractice();if(window.matchMedia('(max-width:850px)').matches)$('#wgTeacherDetail')?.scrollIntoView({behavior:'smooth',block:'start'})};
  container.append(b);
 }
 if(!rows.some(e=>e.id===state.activeSessionId))state.activeSessionId=rows[0].id;
 detailPractice(rows.find(e=>e.id===state.activeSessionId));
}
function detailPractice(entry){
 const host=$('#wgTeacherDetail');if(!host)return;host.replaceChildren();
 if(!entry){host.append(make('div','wg-t-empty','Choose a sentence practice session.'));return}
 const head=make('div','wg-t-detail-head');
 head.append(make('span','wg-t-tag',entry.status||'Practice'),make('h2','',(entry.book_title||entry.book_id||'Book')+' · '+(entry.unit_id||'Unit')));
 head.append(make('p','',(entry.korean_name||entry.name||'Student')+' · '+(entry.class_name||'')+' · '+formatDate(entry.activity_at)));
 host.append(head);
 const questions=Array.isArray(entry.questions)?entry.questions:[],responses=Array.isArray(entry.responses)?entry.responses:[];
 if(!questions.length){host.append(make('p','wg-t-empty','No questions saved for this session.'));return}
 questions.forEach((q,i)=>{
  const result=responses[i]||{},feedback=result.feedback||{};
  const card=make('section','wg-t-version wg-t-practice-question');
  card.append(make('h3','wg-t-version-title','Sentence '+(i+1)+' · '+(feedback.grade||'Not checked')));
  const target=q?.target||q?.sentence||q?.english||q?.answer||'';
  if(target)card.append(make('p','wg-t-prompt','Target: '+String(target)));
  const answer=result.checked_text||result.answer||result.answer_text||'';
  card.append(make('div','wg-t-paper',answer?String(answer):'No answer recorded'));
  if(feedback.corrected_sentence||feedback.better)card.append(make('p','wg-t-note','AI suggestion: '+(feedback.corrected_sentence||feedback.better)));
  host.append(card);
 });
}
function openView(){show();if(!state.loaded)void load()}
function boot(){
 const css=make('link');css.rel='stylesheet';css.href='./writing-genius-teacher.css?v=20261101-practice1';
 document.head.append(css);mount();addNav();
}
window.WritingGeniusTeacher={openView,refresh:load};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();