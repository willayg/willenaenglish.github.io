
/* Biweekly reports for Admin V2, teachers branch. Private parent-facing data: admin only. */
(() => {
 'use strict';
 const ROOT='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/';
 const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
 const $=s=>document.querySelector(s);
 const state={loaded:false,busy:false,runs:[],run:null,rows:[],selected:null};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const n=v=>Number(v)||0;
 const pct=(correct,total)=>total>0?Math.round(100*n(correct)/n(total)):null;
 const formatNum=v=>n(v).toLocaleString('en-US');
 function localDate(d){const a=new Date(d+'T12:00:00');return isNaN(a)?'':a.toISOString().slice(0,10)}
 function shiftDay(d,days){const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+days);return [x.getFullYear(),String(x.getMonth()+1).padStart(2,'0'),String(x.getDate()).padStart(2,'0')].join('-')}
 function todayKorea(){const x=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());return x}
 function formatDate(d){return d?d.replace(/-/g,'. '):''}
 function note(s){return String(s?.teacher_note||'').trim()}
 function total(s){const m=s.metrics||{};return n(m.study?.attempts)+n(m.arcade?.attempts)+n(m.test_prep?.attempts)+n(m.grammar?.stages)+n(m.writing?.checks)}
 function setStatus(msg,bad=false){const e=$('#bwStatus');if(!e)return;e.textContent=msg;e.classList.toggle('error',bad)}
 function setBusy(v){state.busy=v;['#bwGenerate','#bwReload','#bwPublish'].forEach(sel=>{const el=$(sel);if(el)el.disabled=v||((sel==='#bwPublish')&&(!state.run||state.run.status!=='draft'))})}
 function token(){return window.WillenaAPI?.getLocalAccessToken?.()||''}
 async function refreshAuth(){
   const api=window.WillenaAPI?.fetch||((url,opts)=>fetch(url,{...opts,credentials:'include'}));
   const r=await api('/.netlify/functions/supabase_auth?action=refresh',{credentials:'include',cache:'no-store'});
   const d=await r.json().catch(()=>({}));
   if(!r.ok||!d?.access_token)throw Error('Your admin login has expired. Please sign in again.');
   window.WillenaAPI?.setLocalTokens?.(d.access_token,d.refresh_token||'');return d.access_token;
 }
 async function req(path,body){
   const run=(access)=>fetch(ROOT+path,{method:body===undefined?'GET':'POST',cache:'no-store',headers:{apikey:KEY,Authorization:'Bearer '+access,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
   let access=token();if(!access)access=await refreshAuth();
   let r=await run(access);if(r.status===401){access=await refreshAuth();r=await run(access)}
   const response=await r.json().catch(()=>null);
   if(!r.ok)throw Error(response?.message||response?.error||'Reporting service unavailable ('+r.status+').');
   return response;
 }
 function setPeriod(){
   const start=$('#bwStart').value;
   $('#bwEnd').value=start?shiftDay(start,13):'';
 }
 function updatePicker(){
   const picker=$('#bwRunPicker'),selected=state.run?.id||'';
   picker.innerHTML='<option value="">Select report period</option>'+state.runs.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.period_start)+' to '+esc(x.period_end)+(x.status==='published'?' · published':' · draft')+'</option>').join('');
   picker.value=selected;
 }
 async function loadRuns(){
   state.runs=await req('biweekly_report_runs?select=id,period_start,period_end,status,generated_at,published_at&order=period_start.desc&limit=40');
   updatePicker();
 }
 async function loadRun(id){
   if(!id){state.run=null;state.rows=[];render();return}
   const run=state.runs.find(r=>r.id===id);
   if(!run)throw Error('Report period no longer available');
   state.run=run;
   const qs=new URLSearchParams({select:'id,run_id,student_id,class_name,student_name,korean_name,metrics,teacher_note,created_at',run_id:'eq.'+id,order:'class_name.asc,student_name.asc',limit:'300'});
   state.rows=await req('biweekly_report_student_snapshots?'+qs.toString());
   $('#bwStart').value=run.period_start;setPeriod();updatePicker();render();
 }
 function metricCard(value,label){return '<div class="bw-stat"><b>'+value+'</b><span>'+label+'</span></div>'}
 function render(){
   const run=state.run,rows=state.rows,withActivity=rows.filter(s=>n(s.metrics?.activity_days)>0).length;
   const withNote=rows.filter(s=>note(s)).length;
   $('#bwStats').innerHTML=run?metricCard(rows.length,'Students in snapshot')+metricCard(withActivity,'Students with activity')+metricCard(rows.length-withActivity,'No activity recorded')+metricCard(withNote,'Teacher notes saved'):'';
   $('#bwRunState').textContent=run?(run.status==='published'?'Published / locked':'Draft / editable'):'Not generated';
   $('#bwPublish').disabled=state.busy||!run||run.status!=='draft';
   const classes=[...new Set(rows.map(r=>r.class_name||'Unassigned'))].sort();
   const filter=$('#bwClass'),old=filter.value;
   filter.innerHTML='<option value="">All classes</option>'+classes.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');
   filter.value=classes.includes(old)?old:'';
   renderList();
 }
 function renderList(){
   const list=$('#bwStudentList'),q=$('#bwSearch').value.trim().toLowerCase(),cls=$('#bwClass').value;
   const entries=state.rows.filter(s=>(!cls||s.class_name===cls)&&(!q||[s.student_name,s.korean_name,s.class_name].join(' ').toLowerCase().includes(q)));
   if(!state.run){list.innerHTML='<div class="bw-empty">Choose a saved period or generate a new 14-day report to see students.</div>';return}
   if(!entries.length){list.innerHTML='<div class="bw-empty">No students match your filters.</div>';return}
   list.innerHTML=entries.map(s=>{const days=n(s.metrics?.activity_days),count=total(s),label=days?days+' active days':'No activity';
     return '<button type="button" class="bw-student" data-bw-id="'+esc(s.id)+'" aria-label="Open '+esc(s.student_name)+' biweekly report">'+
     '<div><b>'+esc(s.student_name||'Student')+'</b><small>'+esc(s.korean_name||'')+'</small></div>'+
     '<div class="bw-details"><span class="bw-pill">'+esc(s.class_name||'No class')+'</span></div>'+
     '<div><span class="bw-pill '+(days?'':'warn')+'">'+esc(label)+'</span></div>'+
     '<div class="bw-right">'+(count?formatNum(count)+' activity records':'No records')+'</div></button>';
   }).join('');
 }
 function buildFocus(s){
   const m=s.metrics||{},skills=m.skills||{};
   const scored=[['vocabulary','어휘'],['spelling','철자'],['sentence_unscramble','문장 배열'],['sentence_coach','문장 교정'],['sentence_speaking','문장 말하기']]
      .map(([id,label])=>({label,total:n(skills[id]?.first_attempts),correct:n(skills[id]?.first_corrects??skills[id]?.first_correct)}))
      .filter(v=>v.total>=10).sort((a,b)=>(a.correct/a.total)-(b.correct/b.total));
   if(scored.length)return scored[0].label+' 활동을 다음 2주 동안 집중적으로 복습해 보세요.';
   if(n(m.activity_days)===0)return '이번 기간에 기록된 디지털 학습 활동이 없습니다. 수업 참여 및 학습 진행 상황은 담당 선생님께 확인해 주세요.';
   return '다음 2주에도 꾸준한 학습을 이어가고, 틀린 문제를 다시 확인하는 연습을 해 보세요.';
 }
 function reportMarkup(s){
   const m=s.metrics||{},days=n(m.activity_days),study=m.study||{},skills=m.skills||{},arc=m.arcade||{},gr=m.grammar||{},w=m.writing||{},tp=m.test_prep||{};
   const skillOrder=[['vocabulary','Vocabulary'],['spelling','Spelling'],['speaking','Speaking tasks'],['sentence_unscramble','Sentence order'],['sentence_coach','Sentence coach'],['sentence_speaking','Sentence speaking']];
   const skillsHtml=skillOrder.map(([key,label])=>{
     const x=skills[key];if(!x||!n(x.attempts))return '';
     const denominator=n(x.first_attempts)>0?n(x.first_attempts):n(x.attempts);
     const success=n(x.first_attempts)>0?n(x.first_correct):n(x.correct);
     const accuracy=denominator>=10?pct(success,denominator):null;
     return '<div class="bw-skill-row"><span class="bw-skill-label">'+label+'</span><span class="bw-track"><span style="width:'+(accuracy??0)+'%"></span></span><span class="bw-skill-value">'+(accuracy===null?'—':accuracy+'%')+'</span></div>';
   }).filter(Boolean).join('');
   const lowSample=Object.values(skills).some(x=>n(x.attempts)>0&&(n(x.first_attempts)||n(x.attempts))<10);
   const canStudy=n(study.attempts)>0;
   const accuracy=n(study.first_attempts)>=20?pct(study.first_correct,study.first_attempts):null;
   const evidence=[n(arc.attempts)?'Word Arcade '+formatNum(arc.attempts):'',n(study.attempts)?'Study '+formatNum(study.attempts):'',n(tp.attempts)?'Test Prep '+formatNum(tp.attempts):''].filter(Boolean).join(' · ');
   const teacher=note(s);
   return '<div class="bw-ribbon"><div class="bw-logo">W I L L E N A</div><h2>Digital & AI Learning Report</h2><p>14 DAYS OF LEARNING · 성장 기록</p></div>'+
   '<div class="bw-person"><div><b>'+esc(s.student_name||'Student')+'</b><small>'+esc(s.korean_name||'')+' · '+esc(s.class_name||'')+'</small></div>'+
   '<div class="bw-meta-chip">'+esc(formatDate(state.run.period_start))+' – '+esc(formatDate(state.run.period_end))+'</div></div>'+
   '<div class="bw-report-content"><div class="bw-card-heading">Your learning in numbers</div>'+
   '<div class="bw-metric-grid"><div class="bw-metric"><b>'+days+'<small>/14</small></b><span>학습 참여일</span></div>'+
   '<div class="bw-metric"><b>'+formatNum(study.attempts||arc.attempts||0)+'</b><span>'+(canStudy?'교재 학습 응답':'Arcade 학습 응답')+'</span></div>'+
   '<div class="bw-metric"><b>'+(accuracy===null?'—':accuracy+'%')+'</b><span>교재 첫 응답 정확도</span></div></div>'+
   '<div class="bw-skills"><div class="bw-card-heading">Learning skills</div>'+(skillsHtml||'<div class="bw-evidence-notice">이 기간에 영역별 학습 데이터가 충분하지 않습니다.</div>')+'</div>'+
   '<div class="bw-secondary-row">'+
     '<div class="bw-secondary"><b>'+formatNum(arc.attempts)+'</b><span>English Arcade 응답</span></div>'+
     '<div class="bw-secondary"><b>'+formatNum(gr.stages)+'</b><span>Grammar Genius 단계 활동</span></div>'+
     '<div class="bw-secondary"><b>'+formatNum(w.checks)+'</b><span>AI Writing 검사 횟수</span></div>'+
     '<div class="bw-secondary"><b>'+formatNum(tp.attempts)+'</b><span>내신 연습 응답</span></div></div>'+
   '<div class="bw-evidence-notice">'+(lowSample?'일부 영역은 응답 수가 적어 정확도를 표시하지 않았습니다. ':'')+
     '학습 응답에는 재시도가 포함될 수 있습니다. 말하기 활동 결과는 앱 과제 정답 여부이며 구술 능력 평가가 아닙니다. 앱별 응답 수는 중복 가능성이 있어 합산하지 않습니다.'+
   '</div>'+
   '<div class="bw-comment-box"><strong>'+(teacher?'TEACHER’S NOTE':'NEXT LEARNING FOCUS')+'</strong><p>'+esc(teacher||buildFocus(s))+'</p></div>'+
   '</div><div class="bw-report-footer"><span>WILLENA · Native English Academy<br>꾸준한 학습의 기록이 성장의 출발점입니다.</span><span>'+esc(evidence||'No eligible digital activity recorded')+'<br>Generated from verified learning records</span></div>';
 }
 function openDrawer(id){
   const s=state.rows.find(x=>x.id===id);if(!s)return;state.selected=s;
   $('#bwDrawerTitle').textContent=s.student_name||'Student';
   $('#bwDrawerMeta').textContent=(s.class_name||'')+' · '+formatDate(state.run.period_start)+' – '+formatDate(state.run.period_end);
   $('#bwNote').value=s.teacher_note||'';
   $('#bwNote').disabled=state.run.status!=='draft';
   $('#bwSaveNote').disabled=state.run.status!=='draft';
   $('#bwNoteState').textContent=state.run.status==='published'?'Published report is locked.':'';
   updatePreview();
   $('#bwDrawerBg').classList.add('open');$('#bwDrawerBg').setAttribute('aria-hidden','false');
   $('#bwClose').focus();
   ensureCanvas().catch(()=>{});
 }
 function updatePreview(){if(state.selected)$('#bwReportCard').innerHTML=reportMarkup(state.selected)}
 function closeDrawer(){$('#bwDrawerBg').classList.remove('open');$('#bwDrawerBg').setAttribute('aria-hidden','true');state.selected=null}
 async function saveNote(){
   if(!state.selected||state.run?.status!=='draft')return;
   const button=$('#bwSaveNote');button.disabled=true;$('#bwNoteState').textContent='Saving…';
   try{
     await req('rpc/biweekly_report_save_note',{p_snapshot_id:state.selected.id,p_note:$('#bwNote').value});
     state.selected.teacher_note=$('#bwNote').value;
     $('#bwNoteState').textContent='Saved';updatePreview();renderList();
   }catch(e){$('#bwNoteState').textContent=e.message}
   finally{button.disabled=false}
 }
 function message(s){
   const m=s.metrics||{},stud=m.study||{},w=m.writing||{},scores=Object.entries(m.skills||{})
     .filter(([k,v])=>['vocabulary','spelling','sentence_unscramble','sentence_coach'].includes(k)&&n(v.attempts)>=10)
     .map(([k,v])=>{const q=n(v.first_attempts)||n(v.attempts),c=n(v.first_attempts)?n(v.first_correct):n(v.correct);return k+' '+pct(c,q)+'%';});
   return ['[WILLENA · 2주간 디지털 & AI 학습 리포트]',
     (s.student_name||'')+' ('+(s.class_name||'')+')',
     state.run.period_start+' ~ '+state.run.period_end,
     '학습 참여: '+n(m.activity_days)+'/14일',
     '교재 학습 응답: '+formatNum(stud.attempts),
     'English Arcade 응답: '+formatNum(m.arcade?.attempts),
     scores.length?'영역별 연습 정확도: '+scores.join(' · '):'영역별 연습 정확도: 충분한 데이터 없음',
     n(w.checks)?'AI Writing 피드백: '+formatNum(w.checks)+'회':'AI Writing 피드백: 해당 기간 기록 없음',
     '다음 목표: '+(note(s)||buildFocus(s)),
     '※ 연습 정확도는 수행한 앱 활동의 결과이며 전체 영어실력 점수는 아닙니다.'].join('\n');
 }
 async function copyMessage(){
   if(!state.selected)return;
   const text=message(state.selected);
   try{await navigator.clipboard.writeText(text);hint('Parent message copied. Paste into your app.')}
   catch(e){const box=document.createElement('textarea');box.value=text;document.body.appendChild(box);box.select();document.execCommand('copy');box.remove();hint('Message copied.')}
 }
 function hint(t){$('#bwCopyHint').textContent=t}
 let canvasLoading=null;
 function ensureCanvas(){
   if(typeof window.html2canvas==='function')return Promise.resolve();
   if(!canvasLoading)canvasLoading=new Promise((res,rej)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';script.onload=()=>res();script.onerror=()=>rej(new Error('Image renderer could not load. Use Copy Message.'));document.head.appendChild(script)});
   return canvasLoading;
 }
 async function imageBlob(){
   await ensureCanvas();
   const elem=$('#bwReportCard');
   if(!elem||!elem.innerHTML)throw Error('Open a report first');
   const canvas=await window.html2canvas(elem,{backgroundColor:'#ffffff',scale:2,useCORS:true,logging:false,scrollY:-window.scrollY});
   return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG creation failed')),'image/png'));
 }
 function downloadBlob(blob){
   const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='WILLENA_Biweekly_'+(state.selected?.student_name||'Student').replace(/[^a-zA-Z0-9_-]/g,'_')+'_'+state.run.period_start+'.png';
   document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
 }
 async function copyImage(){
   if(!state.selected)return;
   const b=$('#bwCopyImage');b.disabled=true;hint('Preparing high-resolution image…');
   try{
     if(navigator.clipboard?.write&&typeof ClipboardItem!=='undefined'){
       // Pass a Promise to ClipboardItem to preserve browser transient activation during rendering.
       const pending=imageBlob();
       await navigator.clipboard.write([new ClipboardItem({'image/png':pending})]);
       hint('Image copied! Open your parent messaging app and paste (Ctrl+V).');
     }else{
       const blob=await imageBlob();downloadBlob(blob);hint('Image clipboard is unsupported here; the PNG was downloaded instead.');
     }
   }catch(err){hint('Image copy unavailable: '+err.message+' · Try Download PNG or Copy Message.')}
   finally{b.disabled=false}
 }
 async function downloadImage(){
   if(!state.selected)return;const b=$('#bwDownloadImage');b.disabled=true;hint('Creating PNG…');
   try{downloadBlob(await imageBlob());hint('PNG downloaded. Attach it in your message app.')}
   catch(err){hint(err.message)}finally{b.disabled=false}
 }
 async function generate(){
   if(state.busy)return;
   const start=$('#bwStart').value,end=$('#bwEnd').value;
   if(!start||!end){setStatus('Select the first day of a 14-day period.',true);return}
   if(end>=todayKorea()){setStatus('The 14-day period must be complete.',true);return}
   setBusy(true);setStatus('Generating reports from real learning records…');
   try{
     const result=await req('rpc/biweekly_report_generate',{p_period_start:start,p_period_end:end});
     await loadRuns();
     await loadRun(result.run_id);
     setStatus((result.existing?'Loaded existing snapshot. ':'Snapshot created. ')+result.count+' student reports ready. Select a student to preview.');
   }catch(err){setStatus(err.message,true)}finally{setBusy(false)}
 }
 async function publish(){
   if(!state.run||state.run.status!=='draft'||state.busy)return;
   if(!window.confirm('Publish and lock this reporting period? Teacher notes can no longer be edited after publishing.'))return;
   setBusy(true);
   try{
     await req('rpc/biweekly_report_publish',{p_run_id:state.run.id});
     const selected=state.run.id;await loadRuns();await loadRun(selected);
     if(state.selected)closeDrawer();
     setStatus('Published and locked. Reports can still be copied, downloaded and printed.');
   }catch(err){setStatus(err.message,true)}finally{setBusy(false)}
 }
 async function init(){
   if(state.loaded)return;state.loaded=true;
   const korea=todayKorea();$('#bwStart').value=shiftDay(korea,-14);setPeriod();
   setStatus('Loading reporting periods…');
   try{await loadRuns();if(state.runs.length)await loadRun(state.runs[0].id);else render();
     setStatus(state.run?'Loaded '+state.run.period_start+' – '+state.run.period_end+'.':'No previous reports. Choose a 14-day period and generate.');
   }catch(e){setStatus(e.message,true)}
 }
 function setup(){
   document.querySelectorAll('[data-view="biweekly"]').forEach(btn=>btn.addEventListener('click',init));
   $('#bwReload').addEventListener('click',async()=>{try{setStatus('Refreshing…');const id=state.run?.id;await loadRuns();if(id)await loadRun(id);setStatus('Reports refreshed.')}catch(e){setStatus(e.message,true)}});
   $('#bwRunPicker').addEventListener('change',async e=>{try{await loadRun(e.target.value);setStatus(state.run?'Selected reporting period.':'Choose a period.')}catch(err){setStatus(err.message,true)}});
   $('#bwStart').addEventListener('change',setPeriod);
   $('#bwGenerate').addEventListener('click',generate);
   $('#bwPublish').addEventListener('click',publish);
   $('#bwSearch').addEventListener('input',renderList);
   $('#bwClass').addEventListener('change',renderList);
   $('#bwStudentList').addEventListener('click',e=>{const b=e.target.closest('[data-bw-id]');if(b)openDrawer(b.dataset.bwId)});
   $('#bwClose').addEventListener('click',closeDrawer);
   $('#bwDrawerBg').addEventListener('click',e=>{if(e.target===$('#bwDrawerBg'))closeDrawer()});
   document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#bwDrawerBg').classList.contains('open'))closeDrawer()});
   $('#bwSaveNote').addEventListener('click',saveNote);
   $('#bwCopyMessage').addEventListener('click',copyMessage);
   $('#bwCopyImage').addEventListener('click',copyImage);
   $('#bwDownloadImage').addEventListener('click',downloadImage);
   $('#bwPrint').addEventListener('click',()=>{if(state.selected)window.print()});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
