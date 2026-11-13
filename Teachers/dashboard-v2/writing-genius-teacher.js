/* Writing Genius staff reader. Intentional: reading submitted work, not AI grading. */
(()=>{
'use strict';
const BASE='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/writing_genius_teacher_submissions_v1';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const $=(sel,root=document)=>root.querySelector(sel);
const $$=(sel,root=document)=>[...root.querySelectorAll(sel)];
const kindName={sentence:'Free sentences',diary:'Daily diary',topic:'Topic writing'};
const state={rows:[],sessions:[],classes:[],activeId:null,activeSessionId:null,tab:'submissions',writingFilter:'submitted',reviewFilter:'needs',loaded:false,loading:false};

// This count is independent of the current filters and includes all active classes.
// A diary/topic remains pending until written teacher feedback is actually saved.
let badgeLoading=false;
function pendingFeedbackCount(entries){
 return (Array.isArray(entries)?entries:[]).filter(e=>e.status==='submitted'&&
  (e.kind==='diary'||e.kind==='topic')&&e.has_teacher_feedback!==true).length;
}
function updateFeedbackBadge(entries){
 const total=pendingFeedbackCount(entries);
 for(const nav of document.querySelectorAll('[data-view="writing-genius"]')){
  nav.style.position='relative';
  let badge=nav.querySelector('.wg-feedback-count');
  if(!badge){
   badge=make('span','wg-feedback-count');
   badge.setAttribute('aria-label','Writing submissions awaiting feedback');
   badge.style.cssText='position:absolute;top:3px;right:4px;z-index:3;box-sizing:border-box;min-width:19px;height:19px;flex:none;padding:0 4px;border:2px solid white;border-radius:999px;background:#d93646;color:#fff;font:700 11px/15px system-ui;text-align:center;white-space:nowrap;pointer-events:none;';
   const label=nav.querySelector('span:last-child');
   if(label)nav.insertBefore(badge,label);else nav.append(badge);
  }
  badge.textContent=total>99?'99+':String(total);
  badge.hidden=total===0;
  badge.style.display=total?'block':'none';
 }
}
async function refreshFeedbackBadge(){
 if(badgeLoading)return;
 badgeLoading=true;
 try{
  const data=await api(null);
  updateFeedbackBadge(data.entries);
 }catch(e){console.warn('[Writing Genius] Pending feedback count:',e.message)}
 finally{badgeLoading=false}
}
const formatDate=s=>s?new Date(s).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric'}):'—';
function make(tag,className,text){
 const node=document.createElement(tag);if(className)node.className=className;
 if(text!==undefined)node.textContent=text;return node;
}
function mount(){
 if($('#view-writing-genius'))return;
 const workspace=$('.workspace');if(!workspace)return;
 const view=make('section','view');view.id='view-writing-genius';
 view.innerHTML='<div class="page-head"><div><h1>Writing Genius</h1><div class="panel-sub">Submitted writing and saved drafts</div></div></div>'+
  '<div class="wg-t-tabs" role="tablist" aria-label="Writing Genius teacher views"><button type="button" class="wg-t-tab is-active" data-wg-tab="submissions">Writing Submissions</button><button type="button" class="wg-t-tab" data-wg-tab="practice">Sentence Practice</button></div>'+
  '<div class="wg-t-filter" id="wgTeacherWritingFilters"><label for="wgTeacherWritingStatus" style="font-size:13px;font-weight:600">Show</label><select class="control" id="wgTeacherWritingStatus" aria-label="Writing status"><option value="submitted">Submitted</option><option value="draft">Drafts</option><option value="all">All writing</option></select></div>'+
  '<div class="wg-t-filter" id="wgTeacherReviewFilters"><label for="wgTeacherReviewStatus" style="font-size:13px;font-weight:600">Feedback</label><select class="control" id="wgTeacherReviewStatus" aria-label="Teacher feedback status"><option value="needs">Needs feedback</option><option value="sent">Feedback sent</option><option value="all">All</option></select></div>'+
  '<div class="wg-t-filter"><select class="control" id="wgTeacherClass" aria-label="Class"><option value="">All classes</option></select>'+
  '<select class="control" id="wgTeacherKind" aria-label="Writing type"><option value="">All writing</option><option value="diary">Diaries</option><option value="topic">Topics</option></select>'+
  '<input class="control search" id="wgTeacherSearch" type="search" placeholder="Search student or title…" aria-label="Search submissions">'+
  '<button type="button" class="control" id="wgTeacherRefresh">Refresh</button></div>'+
  '<div class="wg-t-grid"><section class="panel wg-t-list-panel" aria-label="Writing submissions">'+
  '<div class="panel-head"><div class="panel-title">Submitted writing</div><span id="wgTeacherCount" class="count-pill">0</span></div>'+
  '<div id="wgTeacherList" class="wg-t-list"><p class="wg-t-empty">Select Writing Genius to load submissions.</p></div></section>'+
  '</div><div class="wg-t-modal" id="wgTeacherModal" hidden><div class="wg-t-modal-backdrop" data-wg-close></div><section class="wg-t-modal-dialog" role="dialog" aria-modal="true" aria-label="Student writing"><button type="button" class="wg-t-modal-close" id="wgTeacherModalClose" aria-label="Close">×</button><div id="wgTeacherDetail"></div></section></div>';
 workspace.append(view);
 $$('.wg-t-tab',view).forEach(b=>b.onclick=()=>{state.tab=b.dataset.wgTab;state.activeId=null;state.activeSessionId=null;closeDiaryModal();$$('.wg-t-tab',view).forEach(x=>x.classList.toggle('is-active',x===b));$('#wgTeacherKind').hidden=state.tab==='practice';$('#wgTeacherWritingFilters').hidden=state.tab==='practice';$('#wgTeacherReviewFilters').hidden=state.tab==='practice'||state.writingFilter!=='submitted';render()});
 $('#wgTeacherWritingStatus').onchange=e=>{state.writingFilter=e.target.value;$('#wgTeacherReviewFilters').hidden=state.writingFilter!=='submitted';render()};
 $('#wgTeacherReviewStatus').onchange=e=>{state.reviewFilter=e.target.value;render()};
 $('#wgTeacherClass').onchange=()=>void load();
 $('#wgTeacherKind').onchange=render;
 $('#wgTeacherSearch').oninput=render;
 $('#wgTeacherRefresh').onclick=()=>void load();
 $('#wgTeacherModalClose').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closeDiaryModal()});
 $('#wgTeacherModal').addEventListener('click',e=>{if(e.target.hasAttribute('data-wg-close'))closeDiaryModal()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDiaryModal()});
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
  if(!cls)updateFeedbackBadge(state.rows);else void refreshFeedbackBadge();
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
 const filter=state.writingFilter;
 const rows=state.rows.filter(e=>(filter==='all'||e.status===filter)&&(filter!=='submitted'||state.reviewFilter==='all'||(state.reviewFilter==='sent' ? e.has_teacher_feedback===true : e.has_teacher_feedback!==true))&&(!kind||e.kind===kind)&&(!q||[e.name,e.korean_name,e.title,e.class_name,e.body].some(v=>String(v||'').toLowerCase().includes(q))))
  .sort((a,b)=>new Date(b.activity_at||b.submitted_at||b.updated_at||0)-new Date(a.activity_at||a.submitted_at||a.updated_at||0));
 container.replaceChildren();count.textContent=String(rows.length);container.closest('.wg-t-list-panel')?.querySelector('.panel-title')?.replaceChildren(document.createTextNode(filter==='draft'?'Saved drafts':filter==='all'?'All writing':'Submitted writing'));
 if(!rows.length){container.append(make('p','wg-t-empty',state.loaded?'No matching writing in this view.':'No writing loaded.'));return}
 let previousDate='';
 const dateLabel=timestamp=>timestamp?new Date(timestamp).toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Seoul'}):'Unknown date';
 for(const e of rows){
  const date=dateLabel(e.activity_at||e.submitted_at||e.updated_at);
  if(date!==previousDate){const group=make('h3','wg-t-date-heading',date);container.append(group);previousDate=date}
  const b=make('button','wg-t-item wg-t-submission-card');b.type='button';b.dataset.entryId=e.id;
  b.append(make('strong','wg-t-item-name',e.korean_name||e.name||'Student'));
  const stages={started:'Draft opened',writing:'Writing draft',reviewed:'AI review done',speaking_done:'Speaking recorded',completed:'Completed'};
  b.append(make('span','wg-t-item-meta',(kindName[e.kind]||'Writing')+' · '+(stages[e.stage]||(e.status==='draft'?'Draft':'Completed'))));
  b.append(make('strong','wg-t-card-title',e.title||'Untitled'));
  if(e.status==='draft'&&e.draft_assessment){const tag=make('span','wg-t-feedback-badge is-needed',({half:'Half done',revise:'Needs corrections',good:'Ready for final steps'}[e.draft_assessment]||'Draft assessed')+(e.draft_finish_mission?' · Finish mission':''));b.append(tag)}
  if(e.status==='submitted'){
   const sent=e.has_teacher_feedback===true;
   const badge=make('span','wg-t-feedback-badge '+(sent?'is-sent':'is-needed'),sent?'✓ Feedback sent':'● Needs feedback');
   if(sent&&e.feedback_sent_at)badge.title='Saved '+new Date(e.feedback_sent_at).toLocaleString('en-US',{timeZone:'Asia/Seoul'});
   b.append(badge);
  }
  b.onclick=()=>{state.activeId=e.id;detail(e);const modal=$('#wgTeacherModal');modal.hidden=false;document.body.classList.add('wg-modal-open');$('#wgTeacherModalClose').focus()};
  container.append(b);
 }
 if(!rows.some(e=>e.id===state.activeId))state.activeId=rows[0].id;

}
function closeDiaryModal(){const modal=$('#wgTeacherModal');if(modal)modal.hidden=true;document.body.classList.remove('wg-modal-open')}
async function feedbackApi(entryId,feedback,bonus){const access=await token();const response=await fetch('https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/writing_genius_teacher_feedback_v1',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+access,'Content-Type':'application/json'},body:JSON.stringify({p_entry_id:entryId,...(feedback!==undefined?{p_text:feedback}:{}),...(bonus!==undefined?{p_bonus:bonus}:{})})});const result=await response.json();if(!response.ok)throw Error(result.message||result.error||'Could not save feedback');return result}
async function draftAssessmentApi(entryId,assessment,feedback,finishMission){
 const access=await token();
 const payload={p_entry_id:entryId};
 if(assessment!==undefined)Object.assign(payload,{p_assessment:assessment,p_feedback:feedback||'',p_finish_mission:Boolean(finishMission)});
 const endpoint='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/writing_genius_draft_assessment_v1';
 const call=t=>fetch(endpoint,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify(payload)});
 let response=await call(access);
 if(response.status===401)response=await call(await token(true));
 const result=await response.json().catch(()=>({}));
 if(!response.ok||result.success!==true)throw Error(result.message||result.error||'Could not save draft assessment');
 return result;
}
function draftAssessmentForm(entry,host){
 const form=make('section','wg-t-feedback wg-t-draft-assessment');
 form.append(make('h3','','Teacher assessment · 초안 평가'));
 const description=make('p','wg-t-note','This stays a draft. The student can continue editing; no completion points are awarded.');
 const status=make('select','control wg-t-assessment-status');
 [['half','Half done · 마무리 필요'],['revise','Needs corrections · 수정 필요'],['good','Good draft · final steps needed']].forEach(([value,label])=>{const o=make('option','',label);o.value=value;status.append(o)});
 status.setAttribute('aria-label','Draft assessment');
 const textarea=make('textarea','wg-t-feedback-input');textarea.placeholder='Write feedback for the student…';textarea.maxLength=1500;
 const missionLabel=make('label','wg-t-mission-label');
 const checkbox=make('input');checkbox.type='checkbox';checkbox.checked=true;
 missionLabel.append(checkbox,document.createTextNode(' Send mission to finish this draft'));
 const save=make('button','wg-t-save-feedback','Save assessment & send mission');save.type='button';
 const note=make('p','wg-t-feedback-note','Loading assessment…');
 const updateText=()=>{save.textContent=checkbox.checked?'Save assessment & send mission':'Save assessment'};
 checkbox.onchange=updateText;
 form.append(description,status,textarea,missionLabel,save,note);host.append(form);
 draftAssessmentApi(entry.id).then(result=>{
   if(result.assessment)status.value=result.assessment;
   textarea.value=result.feedback||'';
   checkbox.checked=Boolean(result.finish_mission);
   updateText();note.textContent=result.updated_at?'Assessment saved · '+formatDate(result.updated_at):'No assessment yet.';
 }).catch(e=>note.textContent=e.message);
 save.onclick=async()=>{
   save.disabled=true;note.textContent='Saving…';
   try{
    await draftAssessmentApi(entry.id,status.value,textarea.value,checkbox.checked);
    note.textContent='Assessment saved. '+(checkbox.checked?'Finish mission flagged for this draft.':'No finish mission requested.');
    entry.draft_assessment=status.value;entry.draft_finish_mission=checkbox.checked;
    render();
   }catch(e){note.textContent=e.message}finally{save.disabled=false}
 };
}
function detail(entry){
 const host=$('#wgTeacherDetail');if(!host)return;host.replaceChildren();
 if(!entry){host.append(make('div','wg-t-empty','Choose student writing to read it.'));return}
 const head=make('div','wg-t-detail-head');
 const stages={started:'Draft opened',writing:'Writing draft',reviewed:'AI review done',speaking_done:'Speaking recorded',completed:'Completed'};
 head.append(make('span','wg-t-tag',(kindName[entry.kind]||entry.kind)+' · '+(stages[entry.stage]||entry.status)));
 head.append(make('h2','',entry.title||kindName[entry.kind]));
 head.append(make('p','',(entry.korean_name||entry.name||'Student')+' · '+(entry.class_name||'')+' · '+formatDate(entry.activity_at||entry.submitted_at||entry.updated_at)));
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
 if(entry.status!=='submitted'){draftAssessmentForm(entry,host);return}
 const form=make('section','wg-t-feedback');form.append(make('h3','','Teacher feedback'));
 const textarea=make('textarea','wg-t-feedback-input');textarea.placeholder='Write a message to the student…';textarea.maxLength=1500;
 const label=make('label','wg-t-bonus-label','Extra points (0–50, cumulative)');
 const input=make('input','wg-t-bonus-input');input.type='number';input.min='0';input.max='50';input.step='5';input.value='0';
 const note=make('p','wg-t-feedback-note','Loading feedback…');
 const save=make('button','wg-t-save-feedback','Send feedback & award points');save.type='button';
 label.append(input);form.append(textarea,label,save,note);host.append(form);
 feedbackApi(entry.id).then(result=>{textarea.value=result.feedback||'';input.value=result.bonus_points||0;note.textContent=result.feedback?.trim()?'Feedback already sent'+(entry.feedback_sent_at?' · '+new Date(entry.feedback_sent_at).toLocaleString('en-US',{timeZone:'Asia/Seoul'}):'')+(result.bonus_points?' · '+result.bonus_points+' points':''):'No teacher feedback yet.'}).catch(e=>note.textContent=e.message);
 save.onclick=async()=>{const bonus=Number(input.value);if(!Number.isInteger(bonus)||bonus<0||bonus>50){note.textContent='Choose 0–50 points.';return}save.disabled=true;note.textContent='Saving…';try{const data=await feedbackApi(entry.id,textarea.value,bonus);note.textContent='Feedback sent!';entry.has_teacher_feedback=Boolean(String(data.feedback||'').trim());entry.feedback_sent_at=new Date().toISOString();render();void refreshFeedbackBadge();const splash=make('div','wg-t-sent-splash');splash.setAttribute('role','status');splash.innerHTML='<span class="wg-t-sent-check" aria-hidden="true">✓</span><strong>Feedback sent!</strong><span>학생에게 전달했어요.</span>';const dialog=$('.wg-t-modal-dialog');dialog?.append(splash);setTimeout(()=>{splash.remove();closeDiaryModal()},1200)}catch(e){note.textContent=e.message}finally{save.disabled=false}};
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
  const completed=responses.filter(x=>(x?.firstFeedback||x?.feedback)?.grade==='correct').length;
   const attempted=responses.filter(x=>x?.firstFeedback||x?.feedback).length;
   const attempts=responses.reduce((sum,x)=>sum+Math.max(0,Number(x?.attempts)||0),0);
  const b=make('button','wg-t-item wg-t-submission-card'+(e.id===state.activeSessionId?' is-selected':''));b.type='button';
  b.append(make('strong','wg-t-item-name',e.korean_name||e.name||'Student'),make('strong','wg-t-card-title',(e.book_title||e.book_id||'Book')+' · '+(e.unit_id||'Unit')));
  b.append(make('span','wg-t-item-meta',[e.class_name,e.assignment_id?'Homework':'Practice',e.status,attempted+' / '+total+' checked',completed+' correct',attempts+' attempts'].filter(Boolean).join(' · ')));
  b.onclick=()=>{state.activeSessionId=e.id;detailPractice(e);$('#wgTeacherModal').hidden=false;document.body.classList.add('wg-modal-open');$('#wgTeacherModalClose').focus()};
  container.append(b);
 }
 if(!rows.some(e=>e.id===state.activeSessionId))state.activeSessionId=rows[0].id;

}
function detailPractice(entry){
 const host=$('#wgTeacherDetail');if(!host)return;host.replaceChildren();
 if(!entry){host.append(make('div','wg-t-empty','Choose a sentence practice session.'));return}
 const head=make('div','wg-t-detail-head');
 head.append(make('span','wg-t-tag',entry.assignment_id?'Homework · '+(entry.status||'In progress'):(entry.status||'Practice')),make('h2','',(entry.book_title||entry.book_id||'Book')+' · '+(entry.unit_id||'Unit')));
 head.append(make('p','',(entry.korean_name||entry.name||'Student')+' · '+(entry.class_name||'')+' · '+formatDate(entry.activity_at)));
 host.append(head);
 const questions=Array.isArray(entry.questions)?entry.questions:[],responses=Array.isArray(entry.responses)?entry.responses:[];
 if(!questions.length){host.append(make('p','wg-t-empty','No questions saved for this session.'));return}
 questions.forEach((q,i)=>{
  const result=responses[i]||{},feedback=result.firstFeedback||result.feedback||{};
  const card=make('section','wg-t-version wg-t-practice-question');
  card.append(make('h3','wg-t-version-title','Sentence '+(i+1)+' · '+(feedback.grade||'Not checked')));
  const target=q?.model||q?.target||q?.sentence||q?.english||q?.answer||'';
  if(target)card.append(make('p','wg-t-prompt','Target: '+String(target)));
  const answer=result.revised||result.initial||result.draft||result.checked_text||result.answer||result.answer_text||'';
  card.append(make('div','wg-t-paper',answer?String(answer):'No answer recorded'));
  if(feedback.corrected_sentence||feedback.better)card.append(make('p','wg-t-note','AI suggestion: '+(feedback.corrected_sentence||feedback.better)));
  host.append(card);
 });
}
function openView(){try{localStorage.setItem('willena.teachers.activeView.v1','writing-genius')}catch{};show();if(!state.loaded)void load();else void refreshFeedbackBadge()}
function boot(){
 const css=make('link');css.rel='stylesheet';css.href='./writing-genius-teacher.css?v=20261107-feedback-status1';
 document.head.append(css);addNav();mount();void refreshFeedbackBadge();
}
window.WritingGeniusTeacher={openView,refresh:load,refreshFeedbackBadge};
window.addEventListener('focus',()=>void refreshFeedbackBadge());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshFeedbackBadge()});
setInterval(()=>{if(!document.hidden)void refreshFeedbackBadge()},60000);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();