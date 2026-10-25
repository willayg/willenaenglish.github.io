/* Writing Genius staff reader. Intentional: reading submitted work, not AI grading. */
(()=>{
'use strict';
const BASE='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/writing_genius_teacher_submissions_v1';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const $=(sel,root=document)=>root.querySelector(sel);
const $$=(sel,root=document)=>[...root.querySelectorAll(sel)];
const kindName={sentence:'Free sentences',diary:'Daily diary',topic:'Topic writing'};
const state={rows:[],classes:[],activeId:null,loaded:false,loading:false};
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
  '<div class="wg-t-filter"><select class="control" id="wgTeacherClass" aria-label="Class"><option value="">All classes</option></select>'+
  '<select class="control" id="wgTeacherKind" aria-label="Writing type"><option value="">All writing</option><option value="sentence">Sentences</option><option value="diary">Diaries</option><option value="topic">Topics</option></select>'+
  '<input class="control search" id="wgTeacherSearch" type="search" placeholder="Search student or title…" aria-label="Search submissions">'+
  '<button type="button" class="control" id="wgTeacherRefresh">Refresh</button></div>'+
  '<div class="wg-t-grid"><section class="panel wg-t-list-panel" aria-label="Writing submissions">'+
  '<div class="panel-head"><div class="panel-title">Submitted writing</div><span id="wgTeacherCount" class="count-pill">0</span></div>'+
  '<div id="wgTeacherList" class="wg-t-list"><p class="wg-t-empty">Select Writing Genius to load submissions.</p></div></section>'+
  '<article class="panel wg-t-reader" aria-label="Selected writing"><div id="wgTeacherDetail" class="wg-t-empty">Choose a student writing submission to read it.</div></article></div>';
 workspace.append(view);
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
async function api(cls){
 const call=t=>fetch(BASE,{method:'POST',cache:'no-store',headers:{
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
  const data=await api($('#wgTeacherClass')?.value||'');
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
function render(){
 const container=$('#wgTeacherList'),count=$('#wgTeacherCount');if(!container)return;
 const q=($('#wgTeacherSearch')?.value||'').trim().toLowerCase();
 const kind=$('#wgTeacherKind')?.value||'';
 const rows=state.rows.filter(e=>(!kind||e.kind===kind)&&
  (!q||[e.name,e.korean_name,e.title,e.class_name,e.body].some(v=>String(v||'').toLowerCase().includes(q))));
 container.replaceChildren();count.textContent=String(rows.length);
 if(!rows.length){
  container.append(make('p','wg-t-empty',state.loaded?'No matching submitted writing.':'No writing loaded.'));
  detail();return;
 }
 for(const e of rows){
  const b=make('button','wg-t-item'+(e.id===state.activeId?' is-selected':''));b.type='button';
  const top=make('span','wg-t-item-name',e.korean_name||e.name||'Student');
  const title=make('strong','',e.title||kindName[e.kind]||'Writing');
  const meta=make('span','wg-t-item-meta',(e.class_name||'')+' · '+(kindName[e.kind]||e.kind)+' · '+formatDate(e.submitted_at));
  const excerpt=make('small','',String(e.body||'').replace(/\s+/g,' ').slice(0,120));
  b.dataset.entryId=e.id;b.append(top,title,meta,excerpt);b.onclick=()=>{state.activeId=e.id;render()};
  container.append(b);
 }
 if(!rows.some(e=>e.id===state.activeId))state.activeId=rows[0].id;
 const chosen=rows.find(e=>e.id===state.activeId);
 detail(chosen);
 for(const b of container.children)b.classList.toggle('is-selected',b.dataset.entryId===chosen?.id);
}
function detail(entry){
 const host=$('#wgTeacherDetail');if(!host)return;host.replaceChildren();
 if(!entry){host.append(make('div','wg-t-empty','Choose submitted writing to read it.'));return}
 const heading=make('div','wg-t-detail-head');
 heading.append(make('span','wg-t-tag',kindName[entry.kind]||entry.kind));
 heading.append(make('h2','',entry.title||kindName[entry.kind]));
 heading.append(make('p','',(entry.korean_name||entry.name||'Student')+' · '+(entry.class_name||'')+' · '+formatDate(entry.submitted_at)));
 host.append(heading);
 if(entry.prompt_text)host.append(make('div','wg-t-prompt',entry.prompt_text));
 host.append(make('div','wg-t-paper',entry.body||''));
 host.append(make('p','wg-t-note','Submitted writing · Read-only'));
}
function openView(){show();if(!state.loaded)void load()}
function boot(){
 const css=make('link');css.rel='stylesheet';css.href='./writing-genius-teacher.css?v=20261025-v1';
 document.head.append(css);mount();addNav();
}
window.WritingGeniusTeacher={openView,refresh:load};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();