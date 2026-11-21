/* Teachers Dashboard: one bell for MY assignments and MY unread completions.
 * Reuses the existing per-teacher review state. Opening this bell never marks
 * a completion reviewed; that happens in the existing assignment card. */
(() => {
 'use strict';
 if(!/^\/Teachers\/(?:index\.html)?\/?$/i.test(location.pathname))return;
 const $=(selector,root=document)=>root.querySelector(selector);
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const labels={word:'Word Genius',sentence:'Sentence Genius',grammar:'Grammar Genius',talking:'Free Talking',writing:'Writing Genius',puzzles:'Puzzles',naesin:'내신'};
 let root=null,bell=null,badge=null,panel=null,body=null;
 let opened=false,loading=false,missions=[],errors=[],lastLoadedAt=0,requestId=0;
 const reviewed=()=>window.WillenaHomeworkNotifications?.getOwnUnread?.()??null;
 const dt=value=>{
  if(!value)return'No due date';
  const d=new Date(value);
  return Number.isNaN(d.getTime())?'No due date':
   'Due '+d.toLocaleDateString('en-GB',{timeZone:'Asia/Seoul',month:'short',day:'numeric'});
 };
 const ownApp=mission=>{
  const meta=mission.list_meta||{};
  const source=String(meta.creative_type||meta.source_type||mission.source_type||'').toLowerCase();
  if(source.includes('writing'))return'Writing Genius';
  if(source.includes('puzzle'))return'Puzzles';
  if(source.includes('talking')||source.includes('conversation'))return'Free Talking';
  if(source.includes('grammar'))return'Grammar Genius';
  if(source.includes('sentence'))return'Sentence Genius';
  return'Word Genius';
 };
 const sources=[
  {table:'homework_assignments',fields:'id,title,class,source_type,list_meta,created_by,created_at,due_at,active,ended_at,status',
   map:r=>({id:r.id,app:ownApp(r),title:r.title||r.list_meta?.list_title||'Homework',cls:r.class||'',due:r.due_at,created:r.created_at,
     current:!r.ended_at&&!['ended','archived','closed','cancelled','completed','expired'].includes(String(r.status||'').toLowerCase())})},
  {table:'grammar_foundation_homework',fields:'id,module_title,stage_title,class_name,created_by,created_at,due_at,active,closed_at',
   map:r=>({id:r.id,app:'Grammar Genius',title:[r.module_title,r.stage_title].filter(Boolean).join(' · ')||'Grammar mission',cls:r.class_name||'',due:r.due_at,created:r.created_at,current:!r.closed_at})},
  {table:'sentence_genius_homework',fields:'id,title,book_title,class_name,created_by,created_at,due_at,active',
   map:r=>({id:r.id,app:'Sentence Genius',title:r.title||r.book_title||'Sentence mission',cls:r.class_name||'',due:r.due_at,created:r.created_at,current:true})},
  {table:'test_prep_tasks',fields:'id,title,lesson,practice_type,student_id,created_by,created_at,due_at,active',
   map:r=>({id:r.id,app:'내신',title:r.title||[r.lesson,r.practice_type].filter(Boolean).join(' · ')||'내신 practice',cls:r.lesson||'',due:r.due_at,created:r.created_at,current:true})}
 ];
 async function fetchMissions(force=false){
  if(loading)return;
  if(!force && Date.now()-lastLoadedAt<60_000)return;
  loading=true;errors=[];render();
  const myRequest=++requestId;
  try{
   const api=window.UniversalAssignmentTracker;
   if(!api?.notificationIdentity||!api?.notificationRequest)throw Error('Assignments have not loaded');
   const teacherId=await api.notificationIdentity();
   if(!teacherId)throw Error('Teacher login not ready');
   const jobs=sources.map(async source=>{
    const query=source.table+'?select='+encodeURIComponent(source.fields)
      +'&created_by=eq.'+encodeURIComponent(teacherId)
      +'&active=eq.true&order=created_at.desc&limit=120';
    const result=await api.notificationRequest(query);
    if(!Array.isArray(result))throw Error(source.table+' did not return a list');
    return result.filter(row=>String(row.created_by)===String(teacherId))
      .map(source.map).filter(row=>row.current);
   });
   const settled=await Promise.allSettled(jobs);
   if(myRequest!==requestId)return;
   missions=settled.filter(r=>r.status==='fulfilled').flatMap(r=>r.value)
     .sort((a,b)=>{
      const ad=a.due?Date.parse(a.due):Infinity,bd=b.due?Date.parse(b.due):Infinity;
      return ad-bd||Date.parse(b.created||0)-Date.parse(a.created||0);
     });
   errors=settled.filter(r=>r.status==='rejected').map(r=>String(r.reason?.message||r.reason||'Unknown error'));
   lastLoadedAt=errors.length?0:Date.now();
  }catch(error){
   if(myRequest!==requestId)return;
   errors=[String(error?.message||error||'Unable to load assignments')];
   lastLoadedAt=0;
  }finally{
   loading=false;
   render();
  }
 }
 function updateBadge(){
  if(!badge||!bell)return;
  const unread=reviewed();
  const n=Array.isArray(unread)?unread.length:0;
  badge.textContent=n>99?'99+':String(n);
  badge.style.display=n?'flex':'none';
  bell.title=n?n+' unread completion'+(n===1?'':'s')+' from your assignments':'My homework';
  bell.setAttribute('aria-label',bell.title);
 }
 function render(){
  if(!body)return;
  updateBadge();
  if(!opened)return;
  const unread=reviewed();
  const completions=Array.isArray(unread)?unread:[];
  const rows=[];
  rows.push('<div class="hw-my-title">Unread completions · '+completions.length+'</div>');
  if(unread===null)rows.push('<p class="hw-my-state">Checking unread completions…</p>');
  else if(!completions.length)rows.push('<p class="hw-my-state">No new completions from your assignments.</p>');
  else{
   for(const entry of completions.slice(0,12)){
    rows.push('<button type="button" class="hw-my-row" data-hw-my-open>'+
     '<span class="hw-my-icon" aria-hidden="true">✓</span><span class="hw-my-text"><b>'+esc(entry.studentName||'Student')+'</b>'+
     '<small>'+esc(entry.title||entry.app||'Homework')+' · '+esc(entry.className||'')+'</small></span>'+
     '<span class="hw-my-label">Review</span></button>');
   }
   if(completions.length>12)rows.push('<p class="hw-my-state">+'+(completions.length-12)+' more completions in My Missions.</p>');
  }
  rows.push('<div class="hw-my-title">My active assignments · '+missions.length+'</div>');
  if(loading)rows.push('<p class="hw-my-state">Loading your assignments…</p>');
  else if(!missions.length)rows.push('<p class="hw-my-state">No active assignments found for your account.</p>');
  else{
   for(const mission of missions.slice(0,14)){
    rows.push('<button type="button" class="hw-my-row" data-hw-my-open>'+
     '<span class="hw-my-dot" aria-hidden="true"></span><span class="hw-my-text"><b>'+esc(mission.title)+'</b>'+
     '<small>'+esc(mission.app)+(mission.cls?' · '+esc(mission.cls):'')+'</small></span>'+
     '<span class="hw-my-date">'+esc(dt(mission.due))+'</span></button>');
   }
   if(missions.length>14)rows.push('<p class="hw-my-state">+'+(missions.length-14)+' more assignments in My Missions.</p>');
  }
  if(errors.length)rows.push('<p class="hw-my-error">Some assignment sources could not load. Use Refresh to try again.</p>');
  body.innerHTML=rows.join('');
 }
 function close(){
  if(!opened)return;
  opened=false;panel.style.display='none';bell.setAttribute('aria-expanded','false');
 }
 function open(){
  opened=true;panel.style.display='block';bell.setAttribute('aria-expanded','true');
  render();void fetchMissions();
 }
 function openMyMissions(){
  close();
  const button=$('.rail .nav[data-view="assignments"]');
  button?.click();
  window.UniversalAssignments?.openTab?.('my');
 }
 function attach(){
  if(root)return;
  const button=$('#teacher-header .hw-notif-btn');
  if(!button)return;
  root=button.closest('.hw-notif-wrap');
  if(!root)return;
  bell=button;badge=$('.hw-notif-badge',root);panel=$('.hw-notif-panel',root);body=$('.hw-notif-body',root);
  if(!badge||!panel||!body){root=null;return;}
  panel.id='hwModernTeacherPanel';
  bell.setAttribute('aria-controls',panel.id);
  const heading=$('.hw-notif-header span',panel);
  if(heading)heading.textContent='My Homework';
  const link=$('.hw-notif-header-link',panel);
  if(link){link.href='/Teachers/?view=assignments';link.textContent='My Missions →';link.addEventListener('click',event=>{event.preventDefault();openMyMissions()});}
  const footer=$('.hw-notif-footer',panel);
  if(footer){
   footer.innerHTML='<button type="button" class="hw-notif-footer-btn" data-hw-my-open>Open My Missions</button>'+
    '<button type="button" class="hw-notif-footer-btn" data-hw-my-refresh>Refresh</button>';
  }
  bell.addEventListener('click',event=>{
   event.preventDefault();event.stopPropagation();
   if(opened)close();else open();
  });
  panel.addEventListener('click',event=>{
   const openLink=event.target.closest('[data-hw-my-open]');
   if(openLink){event.preventDefault();openMyMissions();return;}
   if(event.target.closest('[data-hw-my-refresh]')){
    event.preventDefault();lastLoadedAt=0;void fetchMissions(true);
    void window.WillenaHomeworkNotifications?.refresh?.();
   }
  });
  document.addEventListener('click',event=>{if(opened&&!root.contains(event.target))close()});
  document.addEventListener('keydown',event=>{if(opened&&event.key==='Escape')close()});
  updateBadge();
 }
 window.addEventListener('willena:teacher-header-ready',attach);
 window.addEventListener('willena:teacher-homework-unread-change',()=>{updateBadge();render()});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});
 else attach();
})();
