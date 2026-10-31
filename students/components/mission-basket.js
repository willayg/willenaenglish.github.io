/* Dashboard mission basket: student-scoped assignments across Willena apps. */
(()=>{
'use strict';
const SUPA='https://fiieuiktlsivwfgyivai.supabase.co';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const state={items:[],tab:'active',collapsed:true,archives:new Set(),errors:[]};
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
 return {id:String(id),app,title:String(title||'과제'),link,created:String(created||''),done:!!done,detail,teacherId:null,teacherName:''};
}
async function standardHomework(){
 const r=await api('/.netlify/functions/homework_api?action=list_assignments&mode=student&_='+Date.now());
 if(!r.ok)throw Error('Shared homework unavailable');
 const d=await r.json();if(!d.success)throw Error('Shared homework unavailable');
 return (d.assignments||[]).flatMap(a=>{
  const source=String(a.source_type||a.list_meta?.source_type||a.list_meta?.app||'').toLowerCase().trim();
  // Sentence Genius has its own live feed below. Never misroute its rows to Arcade.
  if(source==='sentence_genius')return [];
  let app,url;
  if(source==='vocab_study'){app='Word Genius';url='/students/vocab-study/?open=wordtest'}
  else if(['wordlist','english_arcade','arcade','saved_game','grammar','phonics'].includes(source)){
    app='English Arcade';url='/Games/english_arcade/index.html?openHomework=1';
  }else{
    console.warn('[mission basket] Unrecognised homework source, omitting unsafe link:',source,a.id);
    return [];
  }
  const entry=item('standard:'+a.id,app,a.title||a.list_title||'숙제',url,a.created_at||a.assigned_at||a.due_at,false,a.due_at?'기한 '+new Date(a.due_at).toLocaleDateString('ko-KR'):'');
  entry.teacherId=a.created_by||null;
  entry.teacherName=a.teacher_name||'';
  return [entry];
 });
}
async function sentences(){
 const d=await authed(SUPA+'/rest/v1/rpc/sg_homework_student_v2',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 return (d.assignments||[]).map(a=>{
  const query=new URLSearchParams();if(a.book_id)query.set('book',a.book_id);if(a.unit_id)query.set('unit',a.unit_id);
  const entry=item('sentence:'+a.id,'Sentence Genius',a.title||a.unit_title||'문장 숙제','/students/sentence-genius/'+(query.size?'?'+query:''),a.created_at||a.assigned_at||a.due_at,Number(a.total)>0&&Number(a.done)>=Number(a.total));
  entry.teacherId=a.created_by||null;entry.teacherName=a.teacher_name||'';
  return entry;
 });
}
async function grammar(){
 const rows=await authed(SUPA+'/rest/v1/grammar_foundation_homework?select=id,module_title,stage_title,module_id,stage_id,completion_percent,due_at,created_by&active=eq.true&order=due_at.desc&limit=300');
 return (Array.isArray(rows)?rows:[]).map(a=>{
  const entry=item('grammar:'+a.id,'Grammar Genius',(a.module_title||'Grammar')+' · '+(a.stage_title||'Stage'),'/students/grammar-foundations/',a.created_at||a.due_at,false,'목표 '+(a.completion_percent||80)+'%');
  entry.teacherId=a.created_by||null;return entry;
 });
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
  x.archived=archivedIds.has(String(t.id));x.teacherId=t.created_by||null;x.teacherName=t.teacher_name||'';return x;
 }));
}
const medalSvg='<svg viewBox="0 0 96 108" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="mbGold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff7b9"/><stop offset=".48" stop-color="#f8cb4b"/><stop offset="1" stop-color="#b97811"/></linearGradient></defs><path d="M26 4h18l18 36-16 11L26 4Z" fill="#f67eaf" stroke="#db4c89" stroke-width="2"/><path d="M70 4H52L35 40l16 11L70 4Z" fill="#7bdae3" stroke="#32b4c3" stroke-width="2"/><circle cx="48" cy="66" r="34" fill="#d9981a" stroke="#a86b12" stroke-width="3"/><circle cx="48" cy="66" r="28" fill="url(#mbGold)" stroke="#fff5ae" stroke-width="2"/><path d="m48 46 6.5 13.4 14.8 2.1-10.7 10.3 2.5 14.6L48 79.5l-13.1 6.9 2.5-14.6-10.7-10.3 14.8-2.1L48 46Z" fill="#fff7d6" stroke="#bb8419" stroke-width="1.5" stroke-linejoin="round"/></svg>';
async function resolveTeacherNames(){
 const ids=[...new Set(state.items.filter(x=>!x.done&&x.teacherId).map(x=>String(x.teacherId)))];
 if(!ids.length)return;
 try{
  const url=SUPA+'/rest/v1/profiles?select=id,name&'+'id=in.('+ids.map(encodeURIComponent).join(',')+')';
  const profiles=await authed(url);
  if(!Array.isArray(profiles))return;
  const names=new Map(profiles.map(p=>[String(p.id),String(p.name||'').trim()]));
  for(const entry of state.items)if(!entry.done&&entry.teacherId&&names.has(String(entry.teacherId)))entry.teacherName=names.get(String(entry.teacherId));
 }catch(err){console.warn('[mission basket] Teacher names unavailable',err)}
}
function firstTeacherName(name){const first=String(name||'').trim().split(/\s+/)[0]||'';return first==='Will'?'William':first}

async function celebrate(element,collect){
 if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 const rect=element.getBoundingClientRect();
 const burst=document.createElement('div');burst.className='dm-gold-particles';burst.setAttribute('aria-hidden','true');
 burst.style.left=(rect.left+rect.width/2)+'px';burst.style.top=(rect.top+rect.height/2)+'px';
 for(let i=0;i<16;i++){const spark=document.createElement('span');spark.textContent=i%4===0?'★':'✦';spark.style.setProperty('--a',i*22.5+'deg');burst.appendChild(spark)}
 document.body.appendChild(burst);
 element.classList.add(collect?'dm-gold-collect':'dm-medal-shine');
 await new Promise(resolve=>setTimeout(resolve,collect?640:470));
 burst.remove();element.classList.remove('dm-gold-collect','dm-medal-shine');
}
function render(){
 const host=state.host;if(!host)return;
 const open=state.items.filter(x=>!state.archives.has(x.id)&&!x.archived);
 const archive=state.items.filter(x=>state.archives.has(x.id)||x.archived);
 const displayed=state.tab==='archive'?archive:open;
 const pending=open.filter(x=>!x.done).length;
 host.innerHTML='<div class="dm-head"><button class="dm-toggle" aria-expanded="'+(!state.collapsed)+'" type="button"><svg viewBox="0 0 48 48" width="35" height="35" aria-hidden="true"><path d="M8 19h32v20a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V19Z" fill="#DBF6F3" stroke="#16848C" stroke-width="2.5"/><path d="M6 14h36v7H6v-7Z" fill="#8BDFD7" stroke="#16848C" stroke-width="2.5"/><path d="m24 25 2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7L24 25Z" fill="#EAB84B" stroke="#BA8D2D" stroke-width="1.2"/></svg><strong>미션함</strong><span class="dm-count">'+pending+'개 남음</span><span class="dm-arrow">'+(state.collapsed?'▸':'▾')+'</span></button></div>'+
 (state.collapsed?'':'<div class="dm-body"><div class="dm-tabs"><button type="button" data-tab="active" aria-pressed="'+(state.tab==='active')+'">진행 중 <span>'+open.length+'</span></button><button type="button" data-tab="archive" aria-pressed="'+(state.tab==='archive')+'">보관함 <span>'+archive.length+'</span></button></div><div class="dm-items">'+(displayed.length?displayed.map(x=>state.tab==='archive'?
 '<a class="dm-medal" href="'+esc(x.link)+'" aria-label="'+esc(x.app+' '+x.title)+'"><span class="dm-medal-svg">'+medalSvg+'</span><strong>'+esc(x.title)+'</strong><small>'+esc(x.app)+'</small></a>':
 '<a class="dm-item '+(x.done?'dm-done':'')+'" href="'+esc(x.link)+'"><span class="dm-app">'+esc(x.app)+(x.done?' · ★ GOLD':'')+'</span><strong>'+esc(x.title)+'</strong>'+(x.detail?'<small>'+esc(x.detail)+'</small>':'')+(!x.done&&x.teacherName?'<small class="dm-teacher">'+esc(firstTeacherName(x.teacherName))+' Teacher</small>':'')+'<span class="dm-action">'+(x.done?'✓':'→')+'</span></a>').join(''):'<p class="dm-empty">'+(state.tab==='archive'?'보관한 미션이 없어요.':'현재 미션이 없어요.')+'</p>')+'</div></div>');
 host.querySelector('.dm-toggle')?.addEventListener('click',()=>{state.collapsed=!state.collapsed;try{sessionStorage.setItem('dashboard-mission-collapsed',state.collapsed?'1':'0')}catch{}render()});
 host.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.tab;render()}));
 host.querySelectorAll('[data-mission-id]').forEach(card=>card.addEventListener('click',async event=>{
  const x=state.items.find(v=>v.id===card.dataset.missionId);
  if(!x?.done)return;
  event.preventDefault();
  if(card.dataset.collecting)return;
  card.dataset.collecting='1';
  if(x.id.startsWith('naesin:')){
   try{
    const result=await authed(SUPA+'/functions/v1/test-prep-student-rev47e?action=archive_homework',{
     method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task_id:x.id.slice(7)})
    });
    if(!result.success)throw Error('Archive failed');
   }catch(e){delete card.dataset.collecting;console.warn('[mission basket] archive failed',e);alert('보관할 수 없습니다. 다시 시도해 주세요.');return}
  }
  await celebrate(card,true);
  state.archives.add(x.id);x.archived=true;render();
 }));
 host.querySelectorAll('[data-medal-id]').forEach(button=>button.addEventListener('click',()=>celebrate(button,false)));

}
async function mount(host){
 if(!host||host.dataset.missionMounted==='true')return;
 if(!document.getElementById('willenaMissionBasketStyles')){const link=document.createElement('link');link.id='willenaMissionBasketStyles';link.rel='stylesheet';link.href='/students/dashboard-v2/mission-basket.css?v=20261031-medals5';document.head.appendChild(link)}
 state.host=host;host.dataset.missionMounted='true';host.classList.add('dashboard-mission-basket');host.setAttribute('aria-label','미션함');
 state.collapsed=true;
 host.innerHTML='<div class="dm-loading">미션을 확인하고 있어요…</div>';
 const results=await Promise.allSettled([standardHomework(),sentences(),grammar(),naesin()]);
 for(const result of results){if(result.status==='fulfilled')state.items.push(...result.value);else state.errors.push(String(result.reason))}
 const unique=new Map(state.items.map(x=>[x.id,x]));
 state.items=[...unique.values()].sort((a,b)=>(Date.parse(b.created)||0)-(Date.parse(a.created)||0));
 await resolveTeacherNames();
 render();
 if(state.errors.length)console.warn('[dashboard missions] Some feeds unavailable:',state.errors);
}
window.WillenaMissionBasket={mount};
// Any student app may mount this shared widget on a chosen container.

})();