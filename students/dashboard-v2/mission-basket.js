/* Dashboard mission basket: student-scoped assignments across Willena apps. */
(()=>{
'use strict';
const SUPA='https://fiieuiktlsivwfgyivai.supabase.co';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const state={items:[],tab:'active',collapsed:false,archives:new Set(),errors:[]};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const api=(url,options={})=>window.WillenaAPI?.fetch?window.WillenaAPI.fetch(url,{cache:'no-store',...options}):fetch(url,{credentials:'include',cache:'no-store',...options});
async function token(refresh=false){
 let t=!refresh&&window.WillenaAPI?.getLocalAccessToken?.();
 if(t)return t;
 const r=await api('/.netlify/functions/supabase_auth?action=refresh',{cache:'no-store'});
 if(!r.ok)throw Error('Login required');
 const j=await r.json();
 if(!j.access_token)throw Error('Login required');
 window.WillenaAPI?.setLocalTokens?.(j.access_token,j.refresh_token||'');
 return j.access_token;
}
async function authed(url,options={}){
 const call=async t=>fetch(url,{...options,cache:'no-store',credentials:'omit',headers:{apikey:KEY,Authorization:'Bearer '+t,...options.headers}});
 let r=await call(await token());
 if(r.status===401)r=await call(await token(true));
 if(!r.ok)throw Error('Assignments unavailable ('+r.status+')');
 return r.json();
}
function item(id,app,title,link,created,done=false,detail=''){
 return {id:String(id),app,title:String(title||'과제'),link,created:String(created||''),done:!!done,detail};
}
async function standardHomework(){
 const r=await api('/.netlify/functions/homework_api?action=list_assignments&mode=student&_='+Date.now());
 if(!r.ok)throw Error('Shared homework unavailable');
 const d=await r.json();if(!d.success)throw Error('Shared homework unavailable');
 return (d.assignments||[]).map(a=>{
  const source=String(a.source_type||a.list_meta?.source_type||'wordlist').toLowerCase();
  const app=source==='vocab_study'?'Word Genius':'English Arcade';
  const url=app==='Word Genius'?'/students/vocab-study/?open=wordtest':'/Games/english_arcade/index.html?openHomework=1';
  return item('standard:'+a.id,app,a.title||a.list_title||'숙제',url,a.created_at||a.assigned_at||a.due_at,false,a.due_at?'기한 '+new Date(a.due_at).toLocaleDateString('ko-KR'):'');
 });
}
async function sentences(){
 const d=await authed(SUPA+'/rest/v1/rpc/sg_homework_student_v2',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 return (d.assignments||[]).map(a=>{
  const query=new URLSearchParams();if(a.book_id)query.set('book',a.book_id);if(a.unit_id)query.set('unit',a.unit_id);
  return item('sentence:'+a.id,'Sentence Genius',a.title||a.unit_title||'문장 숙제','/students/sentence-genius/'+(query.size?'?'+query:''),a.created_at||a.assigned_at||a.due_at,Number(a.total)>0&&Number(a.done)>=Number(a.total));
 });
}
async function grammar(){
 const rows=await authed(SUPA+'/rest/v1/grammar_foundation_homework?select=id,module_title,stage_title,module_id,stage_id,completion_percent,due_at,created_at&active=eq.true&order=due_at.desc&limit=300');
 return (Array.isArray(rows)?rows:[]).map(a=>item('grammar:'+a.id,'Grammar Genius',(a.module_title||'Grammar')+' · '+(a.stage_title||'Stage'),'/students/grammar-foundations/',a.created_at||a.due_at,false,'목표 '+(a.completion_percent||80)+'%'));
}
async function naesin(){
 const d=await authed(SUPA+'/functions/v1/test-prep-student-rev47e?action=me');
 const plans=Array.isArray(d.plans)?d.plans:[];
 let archived=[];
 try{const a=await authed(SUPA+'/functions/v1/test-prep-student-rev47e?action=homework_archives');archived=a.archives||[]}catch{}
 const archivedIds=new Set(archived.map(a=>String(a.task_id)));
 return plans.flatMap(p=>(p.tasks||[]).filter(t=>t.active!==false).map(t=>{
  const progress=t.progress||{},done=progress.gold===true||progress.complete===true;
  const x=item('naesin:'+t.id,'내신 명중',t.title||t.lesson||'내신 과제','/students/test-prep-v2/',t.created_at||t.due_at,done,p.book_label||'');
  x.archived=archivedIds.has(String(t.id));return x;
 }));
}
function render(){
 const host=document.getElementById('dashboardMissionBasket');if(!host)return;
 const open=state.items.filter(x=>!state.archives.has(x.id)&&!x.archived);
 const archive=state.items.filter(x=>state.archives.has(x.id)||x.archived);
 const displayed=state.tab==='archive'?archive:open;
 const pending=open.filter(x=>!x.done).length;
 host.innerHTML='<div class="dm-head"><button class="dm-toggle" aria-expanded="'+(!state.collapsed)+'" type="button"><svg viewBox="0 0 48 48" width="35" height="35" aria-hidden="true"><path d="M8 19h32v20a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V19Z" fill="#DBF6F3" stroke="#16848C" stroke-width="2.5"/><path d="M6 14h36v7H6v-7Z" fill="#8BDFD7" stroke="#16848C" stroke-width="2.5"/><path d="m24 25 2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7L24 25Z" fill="#EAB84B" stroke="#BA8D2D" stroke-width="1.2"/></svg><strong>미션함</strong><span class="dm-count">'+pending+'개 남음</span><span class="dm-arrow">'+(state.collapsed?'▸':'▾')+'</span></button></div>'+
 (state.collapsed?'':'<div class="dm-body"><div class="dm-tabs"><button type="button" data-tab="active" aria-pressed="'+(state.tab==='active')+'">진행 중 <span>'+open.length+'</span></button><button type="button" data-tab="archive" aria-pressed="'+(state.tab==='archive')+'">보관함 <span>'+archive.length+'</span></button></div><div class="dm-items">'+(displayed.length?displayed.map(x=>'<a class="dm-item '+(x.done?'dm-done':'')+'" href="'+esc(x.link)+'"><span class="dm-app">'+esc(x.app)+(x.done?' · ★ GOLD':'')+'</span><strong>'+esc(x.title)+'</strong>'+(x.detail?'<small>'+esc(x.detail)+'</small>':'')+'<span class="dm-action">'+(x.done?'✓':'→')+'</span></a>').join(''):'<p class="dm-empty">'+(state.tab==='archive'?'보관한 미션이 없어요.':'현재 미션이 없어요.')+'</p>')+'</div></div>');
 host.querySelector('.dm-toggle')?.addEventListener('click',()=>{state.collapsed=!state.collapsed;try{sessionStorage.setItem('dashboard-mission-collapsed',state.collapsed?'1':'0')}catch{}render()});
 host.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.tab;render()}));
}
async function boot(){
 if(document.documentElement.classList.contains('leaderboard-only'))return;
 const header=document.querySelector('.header');if(!header||document.getElementById('dashboardMissionBasket'))return;
 const section=document.createElement('section');section.id='dashboardMissionBasket';section.className='dashboard-mission-basket';section.setAttribute('aria-label','미션함');
 header.insertAdjacentElement('afterend',section);
 try{state.collapsed=sessionStorage.getItem('dashboard-mission-collapsed')==='1'}catch{}
 section.innerHTML='<div class="dm-loading">미션을 확인하고 있어요…</div>';
 const results=await Promise.allSettled([standardHomework(),sentences(),grammar(),naesin()]);
 for(const result of results){if(result.status==='fulfilled')state.items.push(...result.value);else state.errors.push(String(result.reason))}
 const unique=new Map(state.items.map(x=>[x.id,x]));
 state.items=[...unique.values()].sort((a,b)=>(Date.parse(b.created)||0)-(Date.parse(a.created)||0));
 render();
 if(state.errors.length)console.warn('[dashboard missions] Some feeds unavailable:',state.errors);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();