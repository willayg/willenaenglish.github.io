/* Dashboard mission basket: student-scoped assignments across Willena apps. */
(()=>{
'use strict';
const SUPA='https://fiieuiktlsivwfgyivai.supabase.co';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const state={items:[],tab:'active',collapsed:true,archives:new Set(),errors:[],appFilter:null};
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
 const body=await r.text();return body?JSON.parse(body):null;
}
function item(id,app,title,link,created,done=false,detail=''){
 return {id:String(id),app,title:String(title||'과제'),link,created:String(created||''),done:!!done,detail,dueAt:null,teacherId:null,teacherName:''};
}
async function standardHomework(){
 const r=await api('/.netlify/functions/homework_api?action=list_assignments&mode=student&_='+Date.now());
 if(!r.ok)throw Error('Shared homework unavailable');
 const d=await r.json();if(!d.success)throw Error('Shared homework unavailable');
 // One RLS-scoped read for all active Grammar Books assignments.
 const grammarRows=(d.assignments||[]).filter(a=>a.source_type==='grammar_books');
 let grammarProof=[];
 if(grammarRows.length){
  try{
   const ids=grammarRows.map(a=>a.id).filter(Boolean);
   grammarProof=await authed(SUPA+'/rest/v1/grammar_book_homework_completions?select=assignment_id,mode,correct_count&assignment_id=in.('+ids.map(encodeURIComponent).join(',')+')&limit=1000');
  }catch(error){console.warn('[mission basket] Grammar Books homework progress unavailable',error)}
 }
 const entries=await Promise.all((d.assignments||[]).map(async a=>{
  const source=String(a.list_meta?.creative_type||a.list_meta?.source_type||a.source_type||a.list_meta?.app||'').toLowerCase().trim();
  // Sentence Genius has its own live feed below. Never misroute its rows to Arcade.
  if(source==='sentence_genius')return null;
  let app,url;
  if(source==='writing_genius'){app='Writing Genius';url='/students/writing-genius/?homework='+encodeURIComponent(a.id)}
  else if(source==='puzzles'){app='Puzzles';url='/students/wordsearch/?homework='+encodeURIComponent(a.id)+'&mode='+encodeURIComponent(a.list_meta?.kind||'')}
  else if(source==='grammar_books'){
    app='Grammar Genius Books';
    const chapter=Number(a.list_meta?.chapter)||1;
    url='/students/grammar-books/?book='+encodeURIComponent(a.list_meta?.source_book_id||'1e3a2112-07be-45e2-a8fc-ce20011e0e57')+'&unit='+chapter+'&homework='+encodeURIComponent(a.id);
  }
  else if(source==='free_talking_genius'){
    app='Free Talking Genius';
    url='/students/free-talking-genius/?book='+encodeURIComponent(a.list_meta?.book_id||'')+'&unit='+encodeURIComponent(a.list_meta?.unit_number||'')+'&homework='+encodeURIComponent(a.id);
  }
  else if(source==='vocab_study'){app='Word Genius';url='/students/vocab-study/?open=wordtest&assignment_id='+encodeURIComponent(a.id)}
  else if(['wordlist','english_arcade','arcade','saved_game','grammar','phonics'].includes(source)){
    app='English Arcade';url='/Games/english_arcade/index.html?openHomework=1';
  }else{
    console.warn('[mission basket] Unrecognised homework source, omitting unsafe link:',source,a.id);
    return null;
  }
  const entry=item('standard:'+a.id,app,a.title||a.list_title||'숙제',url,a.created_at||a.assigned_at||a.due_at,false,a.due_at?'기한 '+new Date(a.due_at).toLocaleDateString('ko-KR'):'');
  entry.teacherId=a.created_by||null;
  entry.teacherName=a.teacher_name||'';entry.dueAt=a.due_at||null;
  if(app==='Grammar Genius Books'){
   const required=Array.isArray(a.list_meta?.required_modes)?a.list_meta.required_modes:[];
   const evidence=grammarProof.filter(p=>String(p.assignment_id)===String(a.id));
   const count=required.reduce((sum,mode)=>sum+Math.min(8,Math.max(0,Number(evidence.find(p=>p.mode===mode)?.correct_count)||0)),0);
   const total=required.length*8;
   entry.progress=total?Math.round(100*count/total):0;
   entry.done=total>0&&count===total;
   entry.detail=count+'/'+total+' questions';
  }
  if(app==='Writing Genius'||app==='Puzzles'){
    entry.progress=Number(a.creative_progress?.percent)||0;
    entry.done=a.creative_progress?.completed===true;
    // RLS-scoped read of the current student's own submitted work.
    // This also works before the optional Cloudflare worker progress endpoint deploys.
    if(!entry.done){
      const kind=String(a.list_meta?.kind||'');
      const query=app==='Writing Genius'&&kind==='sentence'
        ?'writing_genius_sentence_sessions?select=id&assignment_id=eq.'+encodeURIComponent(a.id)+'&status=eq.completed&limit=1'
        :app==='Writing Genius'
        ?'writing_genius_entries?select=id&kind=eq.'+encodeURIComponent(kind)+'&status=eq.submitted&prompt_key=eq.'+encodeURIComponent('homework-'+a.id)+'&limit=1'
        :'puzzle_homework_completions?select=assignment_id&assignment_id=eq.'+encodeURIComponent(a.id)+'&limit=1';
      try{
        const evidence=await authed(SUPA+'/rest/v1/'+query);
        if(Array.isArray(evidence)&&evidence.length){entry.done=true;entry.progress=100}
      }catch(error){entry.detail='진행 상황 확인 중';console.warn('[mission basket] Creative homework evidence unavailable',a.id,error)}
    }
  }
  if(app==='Free Talking Genius'){
   // Use the real scored speaking attempts. Student RLS restricts these
   // reads to their own records; no new assessment/progress table.
   try{
    const bookId=String(a.list_meta?.book_id||''),unitId=String(a.list_meta?.unit_id||'');
    if(!bookId||!unitId)throw Error('Mission is missing its unit');
    const sessions=await authed(SUPA+'/rest/v1/free_talking_sessions?select=id&book_id=eq.'+encodeURIComponent(bookId)+'&unit_id=eq.'+encodeURIComponent(unitId)+'&mode=eq.speaking&limit=150');
    const ids=(sessions||[]).map(x=>x.id);
    const attempts=ids.length?await authed(SUPA+'/rest/v1/free_talking_attempts?select=question_id,score_total_v2,grammar_points,quality_points,rubric_v2,created_at&session_id=in.('+ids.map(encodeURIComponent).join(',')+')&limit=1200'):[];
    const fresh=a.list_meta?.fresh_session===true,created=Date.parse(a.start_at||a.created_at||'');
    const passed=new Set((attempts||[]).filter(x=>
      (!fresh||!Number.isFinite(created)||Date.parse(x.created_at)>=created)&&
      Number(x.score_total_v2??Math.round((Number(x.grammar_points||0)+Number(x.quality_points||0))*2.5))>=8&&
      (x.rubric_v2?.pass_score===8?x.rubric_v2?.passed===true:x.rubric_v2?.passed!==false)
    ).map(x=>x.question_id));
    entry.progress=Math.round(Math.min(8,passed.size)*12.5);
    entry.done=passed.size>=8;entry.detail=Math.min(8,passed.size)+'/8 speaking questions';
   }catch(e){console.warn('[mission basket] Free Talking progress unavailable',a.id,e);entry.detail='Speaking progress unavailable'}
  }
  if(app==='Word Genius'){
   try{
    const response=await api('/.netlify/functions/homework_api?action=vocab_assignment_progress&assignment_id='+encodeURIComponent(a.id)+'&_='+Date.now());
    if(!response.ok)throw Error('Word progress unavailable');
    const row=await response.json();if(!row.success)throw Error('Word progress unavailable');
    const student=(row.students||[])[0]||{},assignment=row.assignment||{},modes=assignment.required_modes||a.required_modes||[];
    const meta=a.list_meta||{},split=meta.workload_mode==='split';
    let clean=0,total=0,allComplete=modes.length>0;
    for(const mode of modes){
     const raw=student.modes?.[mode]||{};
     const expected=split?(meta.mode_target_ids?.[mode]||[]).length:Number(raw.total)||0;
     const passed=Math.min(expected,Math.max(0,Number(raw.clean)||0));
     clean+=passed;total+=expected;allComplete=allComplete&&expected>0&&passed>=expected;
    }
    entry.progress=total>0?Math.round(100*clean/total):0;entry.done=allComplete;
   }catch(error){console.warn('[mission basket] Word progress unavailable',a.id,error)}
  }
  return entry;
 }));
 return entries.filter(Boolean);
}
// Independent, RLS-scoped Textbooks feed. A delayed or failed shared
// homework worker must not suppress this student's grammar assignments.
async function grammarBookHomework(){
 const now=new Date().toISOString();
 const assignments=await authed(SUPA+'/rest/v1/homework_assignments?select=id,title,list_meta,created_at,created_by,due_at,source_type&source_type=eq.grammar_books&active=eq.true&status=eq.active&start_at=lte.'+encodeURIComponent(now)+'&order=created_at.desc&limit=200');
 if(!Array.isArray(assignments)||!assignments.length)return [];
 const ids=assignments.map(a=>a.id).filter(Boolean);
 let evidence=[];
 try{
  evidence=await authed(SUPA+'/rest/v1/grammar_book_homework_completions?select=assignment_id,mode,correct_count&assignment_id=in.('+ids.map(encodeURIComponent).join(',')+')&limit=1500');
 }catch(error){console.warn('[mission basket] Textbook homework evidence unavailable',error)}
 let userId='';
 try{const auth=await token();const claims=JSON.parse(atob(auth.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));userId=String(claims.sub||'');}catch{}
 return assignments.filter(a=>{
  const targets=a.list_meta?.target_student_ids;
  return !Array.isArray(targets)||!targets.length||targets.map(String).includes(userId);
 }).map(a=>{
  const meta=a.list_meta||{},required=Array.isArray(meta.required_modes)?meta.required_modes:[];
  const answers=(evidence||[]).filter(p=>p.assignment_id===a.id);
  const finished=required.reduce((sum,mode)=>sum+Math.min(8,Math.max(0,Number(answers.find(p=>p.mode===mode)?.correct_count)||0)),0);
  const total=required.length*8;
  const chapter=Number(meta.chapter)||1;
  const link='/students/grammar-books/?book='+encodeURIComponent(meta.source_book_id||'1e3a2112-07be-45e2-a8fc-ce20011e0e57')+'&unit='+chapter+'&homework='+encodeURIComponent(a.id);
  const mission=item('standard:'+a.id,'Grammar Genius Books',a.title||'Grammar homework',link,a.created_at||a.due_at,total>0&&finished===total,finished+'/'+total+' questions');
  mission.teacherId=a.created_by||null;mission.dueAt=a.due_at||null;mission.progress=total?Math.round(100*finished/total):0;
  return mission;
 });
}
async function sentences(){
 const d=await authed(SUPA+'/rest/v1/rpc/sg_homework_student_v3',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 return (d.assignments||[]).map(a=>{
  const query=new URLSearchParams();if(a.book_id)query.set('book',a.book_id);if(a.unit_id)query.set('unit',a.unit_id);if(a.id)query.set('homework',a.id);
  const entry=item('sentence:'+a.id,'Sentence Genius',a.title||a.unit_title||'문장 숙제','/students/sentence-genius/'+(query.size?'?'+query:''),a.created_at||a.assigned_at||a.due_at,Number(a.total)>0&&Number(a.done)>=Number(a.total));
  entry.teacherId=a.created_by||null;entry.teacherName=a.teacher_name||'';
  entry.dueAt=a.due_at||null;entry.progress=Number(a.total)>0?Math.min(100,Math.round(100*(Number(a.done)||0)/Number(a.total))):0;
  return entry;
 });
}
async function grammar(){
 const rows=await authed(SUPA+'/rest/v1/grammar_foundation_homework?select=id,module_title,stage_title,module_id,stage_id,completion_percent,due_at,created_by&active=eq.true&order=due_at.desc&limit=300');
 return (Array.isArray(rows)?rows:[]).map(a=>{
  const entry=item('grammar:'+a.id,'Grammar Genius',(a.module_title||'Grammar')+' · '+(a.stage_title||'Stage'),'/students/grammar-foundations/?homework='+encodeURIComponent(a.id),a.created_at||a.due_at,false,'목표 '+(a.completion_percent||80)+'%');
  entry.teacherId=a.created_by||null;entry.dueAt=a.due_at||null;return entry;
 });
}
async function naesin(){
 const d=await authed(SUPA+'/functions/v1/test-prep-student-rev47e?action=me');
 const plans=Array.isArray(d.plans)?d.plans:[];
 let archived=[];
 try{const a=await authed(SUPA+'/functions/v1/test-prep-student-rev47e?action=homework_archives');archived=a.archives||[]}catch{}
 const archivedIds=new Set(archived.map(a=>String(a.task_id)));
 // Existing task completion flags are used only for the explicitly designated Test-class account A.
 // No quiz scores or answers are fabricated; ordinary student mastery still requires real attempts.
 let testCompleted=new Set();
 try{
  const rows=await authed(SUPA+'/rest/v1/test_prep_tasks?select=id,completed_at&student_id=eq.5ff64b5e-85dc-4f3b-8438-1ae75084a0f4&completed_at=not.is.null&limit=30');
  if(Array.isArray(rows))testCompleted=new Set(rows.map(row=>String(row.id)));
 }catch{}

 return plans.flatMap(p=>(p.tasks||[]).filter(t=>t.active!==false).map(t=>{
  const progress=t.progress||{},done=progress.gold===true||progress.complete===true||testCompleted.has(String(t.id));
  const x=item('naesin:'+t.id,'내신 명중',t.title||t.lesson||'내신 과제','/students/test-prep-v2/?homework='+encodeURIComponent(t.id),t.created_at||t.due_at,done,p.book_label||'');
  x.archived=archivedIds.has(String(t.id));x.teacherId=t.created_by||null;x.teacherName=t.teacher_name||'';x.dueAt=t.due_at||null;return x;
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
function archiveStorageKey(){
 try{
  const t=window.WillenaAPI?.getLocalAccessToken?.();
  if(!t)return null;
  const payload=JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
  return payload?.sub?'willena-mission-medals:'+String(payload.sub):null;
 }catch{return null}
}
function restoreLocalMedals(){
 const key=archiveStorageKey();if(!key)return;
 try{const ids=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(ids))state.archives=new Set(ids.filter(v=>typeof v==='string'))}catch{}
}
function saveLocalMedal(id,entry){
 const key=archiveStorageKey();if(!key)return;
 try{
  const stored=JSON.parse(localStorage.getItem(key)||'[]');
  const ids=new Set(Array.isArray(stored)?stored:[]);ids.add(id);
  localStorage.setItem(key,JSON.stringify([...ids]));
  if(entry){const recordKey=key+':details';const old=JSON.parse(localStorage.getItem(recordKey)||'{}');old[id]={id,app:entry.app,title:entry.title,link:entry.link,created:entry.created,done:true,archived:true};localStorage.setItem(recordKey,JSON.stringify(old))}
 }catch(e){console.warn('[mission basket] local medal save unavailable',e)}
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
function progressMeter(entry){
 const percent=entry.done?100:Number.isFinite(entry.progress)?Math.max(0,Math.min(100,entry.progress)):null;
 if(percent===null)return '';
 return '<span class="dm-progress-ring" style="--dm-pct:'+percent+'" role="progressbar" aria-label="숙제 진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+percent+'"><span>'+percent+'%</span></span>';
}
function missionPastDue(x){
 if(x.done||x.archived||state.archives.has(x.id)||!x.dueAt)return false;
 const due=new Date(x.dueAt);
 if(!Number.isFinite(due.getTime()))return false;
 const day=d=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day};
 return day(due)<day(new Date());
}
function render(){
 const host=state.host;if(!host)return;
 const savedKey=archiveStorageKey();
 if(savedKey){try{const details=JSON.parse(localStorage.getItem(savedKey+':details')||'{}');for(const [id,item] of Object.entries(details)){if(state.archives.has(id)&&!state.items.some(x=>x.id===id))state.items.push({...item,archived:true,done:true})}}catch(e){console.warn('[mission basket] medal restoration',e)}}
 const visible=state.appFilter?state.items.filter(x=>x.app===state.appFilter):state.items;
 const unarchived=visible.filter(x=>!state.archives.has(x.id)&&!x.archived);
 const overdue=unarchived.filter(missionPastDue);
 const open=unarchived.filter(x=>!missionPastDue(x));
 const archive=visible.filter(x=>state.archives.has(x.id)||x.archived);
 const displayed=state.tab==='archive'?archive:state.tab==='overdue'?overdue:open;
 const pending=open.filter(x=>!x.done).length;
 host.innerHTML='<div class="dm-head"><button class="dm-toggle" aria-expanded="'+(!state.collapsed)+'" type="button"><svg viewBox="0 0 48 48" width="35" height="35" aria-hidden="true"><path d="M8 19h32v20a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V19Z" fill="#DBF6F3" stroke="#16848C" stroke-width="2.5"/><path d="M6 14h36v7H6v-7Z" fill="#8BDFD7" stroke="#16848C" stroke-width="2.5"/><path d="m24 25 2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7L24 25Z" fill="#EAB84B" stroke="#BA8D2D" stroke-width="1.2"/></svg><strong>미션 바구니</strong><span class="dm-count'+(pending>0?' dm-count-pending':'')+'">'+pending+'개 남음</span><span class="dm-arrow">'+(state.collapsed?'▸':'▾')+'</span></button></div>'+
 (state.collapsed?'':'<div class="dm-body"><div class="dm-tabs"><button type="button" data-tab="active" aria-pressed="'+(state.tab==='active')+'">진행 중 <span>'+open.length+'</span></button><button type="button" data-tab="overdue" aria-pressed="'+(state.tab==='overdue')+'">기한 지남 <span>'+overdue.length+'</span></button><button type="button" data-tab="archive" aria-pressed="'+(state.tab==='archive')+'">미션 메달 <span>'+archive.length+'</span></button></div><div class="dm-items">'+(displayed.length?displayed.map(x=>state.tab==='archive'?
 '<a class="dm-medal" data-medal-id="'+esc(x.id)+'" href="'+esc(x.link)+'" aria-label="'+esc(x.app+' '+x.title)+'"><span class="dm-medal-svg">'+medalSvg+'</span><strong>'+esc(x.title)+'</strong><small>'+esc(x.app)+'</small></a>':
 '<a class="dm-item '+(x.done?'dm-done':'')+'" data-mission-id="'+esc(x.id)+'" href="'+esc(x.link)+'"><span class="dm-app">'+esc(x.app)+(x.done?' · ★ GOLD':'')+'</span><strong>'+esc(x.title)+'</strong>'+(x.detail?'<small>'+esc(x.detail)+'</small>':'')+(!x.done&&x.teacherName?'<small class="dm-teacher">'+esc(firstTeacherName(x.teacherName))+' Teacher</small>':'')+progressMeter(x)+'<span class="dm-action">'+(x.done?'✓':'→')+'</span></a>').join(''):'<p class="dm-empty">'+(state.tab==='archive'?'아직 모은 메달이 없어요.':state.tab==='overdue'?'기한이 지난 미완료 미션이 없어요.':'현재 미션이 없어요.')+'</p>')+'</div></div>');
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
  state.archives.add(x.id);x.archived=true;saveLocalMedal(x.id,x);
  void recordCompletedActivity(x.id,'homework');
  try{
   const key=archiveStorageKey();
   if(key){
    const calendar=JSON.parse(localStorage.getItem(key+':completion-days')||'{}');
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
    calendar[x.id]=parts.year+'-'+parts.month+'-'+parts.day;
    localStorage.setItem(key+':completion-days',JSON.stringify(calendar));
   }
   void (window.WillenaAchievements?.invalidateGold?.()||window.WillenaAchievements?.refresh?.());
  }catch(e){console.warn('[streak] completion day save failed',e)}
  render();
  const medalTab=state.host?.querySelector('[data-tab="archive"]');
  if(medalTab&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){medalTab.classList.remove('dm-tab-grow');void medalTab.offsetWidth;medalTab.classList.add('dm-tab-grow');medalTab.addEventListener('animationend',()=>medalTab.classList.remove('dm-tab-grow'),{once:true})}
 }));
 host.querySelectorAll('[data-medal-id]').forEach(button=>button.addEventListener('click',()=>celebrate(button,false)));

}
async function mount(host,options={}){
 if(!host||host.dataset.missionMounted==='true')return;
 if(!document.getElementById('willenaMissionBasketStyles')){const link=document.createElement('link');link.id='willenaMissionBasketStyles';link.rel='stylesheet';link.href='/students/dashboard-v2/mission-basket.css?v=20261106-pink-count-pulse1';document.head.appendChild(link)}
 state.host=host;state.appFilter=options.app||null;host.dataset.missionMounted='true';host.classList.add('dashboard-mission-basket');host.setAttribute('aria-label','미션 바구니');
 state.collapsed=true;
 restoreLocalMedals();
 host.innerHTML='<div class="dm-loading">미션을 확인하고 있어요…</div>';
 const results=await Promise.allSettled([standardHomework().then(rows=>state.appFilter?rows.filter(row=>row.app===state.appFilter):rows),state.appFilter&&state.appFilter!=='Grammar Genius Books'?Promise.resolve([]):grammarBookHomework(),state.appFilter&&state.appFilter!=='Sentence Genius'?Promise.resolve([]):sentences(),state.appFilter&&state.appFilter!=='Grammar Genius'?Promise.resolve([]):grammar(),state.appFilter&&state.appFilter!=='내신 명중'?Promise.resolve([]):naesin()]);
 for(const result of results){if(result.status==='fulfilled')state.items.push(...result.value);else state.errors.push(String(result.reason))}
 const unique=new Map(state.items.map(x=>[x.id,x]));
 state.items=[...unique.values()].sort((a,b)=>(Date.parse(b.created)||0)-(Date.parse(a.created)||0));
 await resolveTeacherNames();
 render();
 if(state.errors.length)console.warn('[dashboard missions] Some feeds unavailable:',state.errors);
}
let refreshing=false;
async function refresh(){
 if(refreshing||!state.host)return;
 refreshing=true;
 try{
  const tasks=[
   standardHomework().then(rows=>state.appFilter?rows.filter(row=>row.app===state.appFilter):rows),
   state.appFilter&&state.appFilter!=='Grammar Genius Books'?Promise.resolve([]):grammarBookHomework(),
   state.appFilter&&state.appFilter!=='Sentence Genius'?Promise.resolve([]):sentences(),
   state.appFilter&&state.appFilter!=='Grammar Genius'?Promise.resolve([]):grammar(),
   state.appFilter&&state.appFilter!=='내신 명중'?Promise.resolve([]):naesin()
  ];
  const results=await Promise.allSettled(tasks);
  const kept=new Map(state.items.map(x=>[x.id,x]));
  const prefixes=['standard:','standard:','sentence:','grammar:','naesin:'];
  results.forEach((result,index)=>{
   if(result.status!=='fulfilled')return;
   if(index===0){
    // Shared feed owns all normal assignments but not independently verified
    // Textbooks until its textbook data is confirmed.
    for(const [id,row] of kept)if(id.startsWith('standard:')&&row.app!=='Grammar Genius Books')kept.delete(id);
   }else if(index===1){
    for(const [id,row] of kept)if(id.startsWith('standard:')&&row.app==='Grammar Genius Books')kept.delete(id);
   }else{
    for(const id of kept.keys())if(id.startsWith(prefixes[index]))kept.delete(id);
   }
   for(const row of result.value)kept.set(row.id,row);
  });
  state.items=[...kept.values()].sort((a,b)=>(Date.parse(b.created)||0)-(Date.parse(a.created)||0));
  restoreLocalMedals();
  await resolveTeacherNames();render();
 }finally{refreshing=false}
}
window.addEventListener('pageshow',event=>{if(event.persisted)refresh()});
window.addEventListener('focus',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
async function getAchievementMissions(){
 const results=await Promise.allSettled([standardHomework(),sentences(),naesin()]);
 const rows=results.flatMap(r=>r.status==='fulfilled'?r.value:[]);
 const unique=new Map(rows.map(x=>[x.id,{id:x.id,done:x.done===true||x.archived===true,created:x.created||''}]));
 // Archived medals are genuine completed homework. They may disappear from
 // active assignment feeds; keep them in the achievement count.
 const key=archiveStorageKey();
 if(key){
   try{
     const ids=JSON.parse(localStorage.getItem(key)||'[]');
     if(Array.isArray(ids))for(const id of ids){
       if(typeof id!=='string'||! /^(standard|sentence|grammar|naesin):/.test(id))continue;
       const previous=unique.get(id);
       unique.set(id,{id,done:true,created:previous?.created||''});
     }
   }catch(e){console.warn('[achievements] medal archive unavailable',e)}
 }
 return [...unique.values()];
}
async function getWritingGoldUnits(){
 const rows=await authed(SUPA+'/rest/v1/rpc/wg_sentence_unit_rewards_v1',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 return (Array.isArray(rows)?rows:[]).filter(row=>row.golden===true).map(row=>'writing:'+String(row.book_id)+'|'+String(row.unit_id));
}
async function recordCompletedActivity(id,source='genius'){
 if(!id)return;
 const key=String(id).slice(0,160), app=String(source).slice(0,60);
 try{
  const access=await token();
  const who=JSON.parse(atob(access.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub;
  if(!who)throw Error('No authenticated student');
  await authed(SUPA+'/rest/v1/student_completed_activity_events?on_conflict=student_id,source,activity_key',{
   method:'POST',headers:{'Content-Type':'application/json','Prefer':'resolution=ignore-duplicates,return=representation'},
   body:JSON.stringify({student_id:who,source:app,activity_key:key})
  });
  try{await refreshStreakSnapshot()}catch(snapshotError){console.warn('[streak] snapshot update unavailable',snapshotError)}
  void (window.WillenaAchievements?.invalidateGold?.()||window.WillenaAchievements?.refresh?.());
 }catch(e){console.warn('[streak] completed activity save failed',e)}
}
async function getGoldSnapshot(){
 const rows=await authed(SUPA+'/rest/v1/student_achievement_snapshots?select=gold_word,gold_sentence,gold_writing,gold_homework,total_gold,gold_updated_at&limit=1');
 const row=Array.isArray(rows)?rows[0]:null;
 if(!row?.gold_updated_at||Date.now()-Date.parse(row.gold_updated_at)>600000)return null;
 return {word:Number(row.gold_word)||0,sentence:Number(row.gold_sentence)||0,writing:Number(row.gold_writing)||0,homework:Number(row.gold_homework)||0,total:Number(row.total_gold)||0};
}
async function saveGoldSnapshot(values){
 return authed(SUPA+'/rest/v1/rpc/cache_student_gold_snapshot',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({p_word:values.word,p_sentence:values.sentence,p_writing:values.writing,p_homework:values.homework})
 });
}
async function getStreakSnapshot(){
 const rows=await authed(SUPA+'/rest/v1/student_achievement_snapshots?select=current_streak,best_streak,last_completed_day,streak_updated_at&limit=1');
 if(Array.isArray(rows)&&rows[0]){
  const row=rows[0];
  if(!row.streak_updated_at||Date.now()-Date.parse(row.streak_updated_at)>120000)return null;
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  const today=parts.year+'-'+parts.month+'-'+parts.day;
  const yesterday=new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10);
  const current=(row.last_completed_day===today||row.last_completed_day===yesterday)?Number(row.current_streak)||0:0;
  return {current,best:Number(row.best_streak)||0,last:row.last_completed_day};
 }
 return null;
}
async function refreshStreakSnapshot(){
 const rows=await authed(SUPA+'/rest/v1/rpc/refresh_student_streak_snapshot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_student:JSON.parse(atob((await token()).split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub})});
 if(!Array.isArray(rows)||!rows[0])throw Error('Streak snapshot refresh unavailable');
 return {current:Number(rows[0].current_streak)||0,best:Number(rows[0].best_streak)||0,last:rows[0].last_completed_day};
}
async function getCompletedActivityDays(){
 // Read only the authenticated student's completed sessions. No attempts,
 // started sessions or uncollected assignments may count as completed work.
 const requests=[
  SUPA+'/rest/v1/writing_genius_sentence_sessions?select=completed_at&status=eq.completed&completed_at=not.is.null&order=completed_at.desc&limit=1000',
  SUPA+'/rest/v1/daily_study_sessions?select=completed_at&status=eq.completed&completed_at=not.is.null&order=completed_at.desc&limit=1000',
  SUPA+'/rest/v1/progress_sessions?select=ended_at,summary&ended_at=not.is.null&summary->>completed=eq.true&order=ended_at.desc&limit=1000',
  SUPA+'/rest/v1/student_completed_activity_events?select=completed_at&order=completed_at.desc&limit=1000'
 ];
 const settled=await Promise.allSettled(requests.map(url=>authed(url)));
 const dates=new Set();
 // Homework counts on its recorded completion date, not its assignment date.
 // Store the day of medal collection for future collections where source feeds
 // do not provide a completed timestamp.
 try{
  const key=archiveStorageKey();
  if(key){
   const calendar=JSON.parse(localStorage.getItem(key+':completion-days')||'{}');
   for(const date of Object.values(calendar))if(/^\d{4}-\d{2}-\d{2}$/.test(String(date)))dates.add(date);
  }
 }catch(e){console.warn('[streak] homework completion dates unavailable',e)}

 let successful=0;
 settled.forEach((r,i)=>{
  if(r.status!=='fulfilled'){console.warn('[streak] completed activity source unavailable',i,r.reason);return;}
  successful++;
  for(const x of Array.isArray(r.value)?r.value:[]){
   const timestamp=x.completed_at||x.ended_at;
   if(!timestamp)continue;
   const date=new Date(timestamp);
   if(Number.isNaN(+date))continue;
   const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(p=>[p.type,p.value]));
   dates.add(parts.year+'-'+parts.month+'-'+parts.day);
  }
 });
 if(!successful)throw Error('No completed session sources readable');
 return [...dates];
}
async function getGrammarBookProgress(){
 const rows=await authed(SUPA+'/rest/v1/student_grammar_book_chapter_progress?select=chapter_number,mode,best_correct,last_correct,attempts,completed_at,mastered_question_ids&book_key=eq.grammar_ten_2&order=chapter_number.asc');
 return Array.isArray(rows)?rows:[];
}
async function recordGrammarBookRound(chapter,mode,correct,masteredIds){
 if(!Array.isArray(masteredIds))throw Error('Question-level mastery is required');
 return authed(SUPA+'/rest/v1/rpc/record_grammar_book_chapter_round_v2',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({p_chapter:chapter,p_mode:mode,p_correct:correct,p_mastered_ids:masteredIds})
 });
}
window.WillenaMissionBasket={mount,refresh,getAchievementMissions,getWritingGoldUnits,getCompletedActivityDays,recordCompletedActivity,getStreakSnapshot,refreshStreakSnapshot,getGoldSnapshot,saveGoldSnapshot,getGrammarBookProgress,recordGrammarBookRound};
// Any student app may mount this shared widget on a chosen container.

})();