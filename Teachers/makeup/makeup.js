import {mountTeacherHeader} from '/components/teacher-header/teacher-header.js?v=20261128-makeupembed2';
import {ensureTeacherSession,ensureAuthRefresh} from '/Teachers/auth-refresh.js?v=20261021-sessionfix1';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const embedded=document.documentElement.classList.contains('makeup-embedded');
const today=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const labels={pending:'미정',scheduled:'예약',completed:'완료',waived:'보강 불필요'};
const types={regular:'정규 보강',key_points:'키포인트',self_study:'자습 대체'};
const S={students:[],teachers:[],records:[],status:'open',cls:'',selected:new Set(),pickClass:'',editing:null,editStatus:'pending',editType:'regular',editTeacher:'',busy:false,loading:false};
const msg=(id,t='')=>$(id).textContent=t;
const person=s=>[s.name||s.student_name,s.korean_name].filter((v,i,a)=>v&&a.indexOf(v)===i).join(' · ');
async function api(action,body){
 const send=async()=>{const headers={};try{const token=localStorage.getItem('sb_access_token');if(token&&token.includes('.'))headers.Authorization='Bearer '+token}catch{}if(body!==undefined)headers['Content-Type']='application/json';
 const r=await fetch('/api/makeup?'+new URLSearchParams({action}),{method:body===undefined?'GET':'POST',credentials:'include',cache:'no-store',headers,body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json().catch(()=>({error:'Server unavailable'}));return {r,data}};
 let {r,data}=await send();if(r.status===401){await ensureTeacherSession();({r,data}=await send())}if(!r.ok){const e=Error(data.error||'Request failed');e.status=r.status;throw e}return data;
}
function tab(key,text,active,attr='status'){return '<button type="button" data-'+attr+'="'+esc(key)+'" aria-pressed="'+(key===active)+'">'+esc(text)+'</button>'}
function render(){
 const all=S.records,counts=Object.fromEntries(Object.keys(labels).map(k=>[k,all.filter(r=>r.status===k).length]));
 $('#summary').innerHTML=Object.keys(labels).map(k=>'<button type="button" data-status="'+k+'" aria-pressed="'+(S.status===k)+'"><span>'+labels[k]+'</span><strong>'+counts[k]+'</strong></button>').join('');
 $('#statusTabs').innerHTML=[['open','미완료'],['pending','미정'],['scheduled','예약'],['completed','완료'],['waived','보강 불필요'],['all','전체']].map(([k,l])=>tab(k,l,S.status)).join('');
 const classes=[...new Set([...S.students.map(s=>s.class),...all.map(r=>r.class_name)].filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 $('#classes').innerHTML=tab('','전체 반',S.cls,'class')+classes.map(c=>tab(c,c,S.cls,'class')).join('');
 $$('[data-status]').forEach(b=>b.onclick=()=>{S.status=b.dataset.status;render()});$$('[data-class]').forEach(b=>b.onclick=()=>{S.cls=b.dataset.class;render()});
 const q=$('#search').value.trim().toLowerCase();
 const rows=all.filter(r=>(S.status==='all'||(S.status==='open'?['pending','scheduled'].includes(r.status):r.status===S.status))&&(!S.cls||r.class_name===S.cls)&&(!q||[r.student_name,r.korean_name,r.class_name].some(v=>String(v||'').toLowerCase().includes(q))));
 rows.sort((a,b)=>{if(a.status==='scheduled'&&b.status==='scheduled')return (a.makeup_date+a.makeup_time).localeCompare(b.makeup_date+b.makeup_time);return b.missed_date.localeCompare(a.missed_date)});
 $('#records').innerHTML=rows.length?'<div class="tableWrap"><table><thead><tr><th>학생</th><th>반</th><th>결석일</th><th>보강 일시</th><th>보강 유형</th><th>담당 교사</th><th>상태</th><th>결석 사유 / 메모</th><th>관리</th></tr></thead><tbody>'+rows.map(r=>'<tr><td><strong>'+esc(r.student_name)+'</strong><small>'+esc(r.korean_name===r.student_name?'':r.korean_name)+'</small></td><td>'+esc(r.class_name)+'</td><td>'+esc(r.missed_date)+'</td><td>'+esc(r.makeup_date?r.makeup_date+' '+r.makeup_time.slice(0,5):'—')+'</td><td>'+esc(types[r.makeup_type]||types.regular)+'</td><td>'+esc(person(S.teachers.find(t=>t.id===r.teacher_id)||{})||'—')+'</td><td><span class="state '+r.status+'">'+labels[r.status]+'</span></td><td class="note">'+esc([r.absence_reason,r.notes].filter(Boolean).join('\n')||'—')+'</td><td><div class="rowActions"><button type="button" class="secondary" data-edit="'+r.id+'">'+(r.status==='pending'?'예약':'수정')+'</button>'+(r.status==='scheduled'&&r.makeup_date<=today()?'<button type="button" data-complete="'+r.id+'">완료</button>':'')+'</div></td></tr>').join('')+'</tbody></table></div>':'<div class="empty">표시할 보강 기록이 없습니다.</div>';
 $$('[data-edit]').forEach(b=>b.onclick=()=>open(S.records.find(r=>r.id===b.dataset.edit)));
 $$('[data-complete]').forEach(b=>b.onclick=()=>complete(S.records.find(r=>r.id===b.dataset.complete),b));
}
async function load(){if(S.loading||S.busy)return;S.loading=true;$('#refresh').disabled=true;msg('#message','불러오는 중…');try{const data=await api('list');S.students=data.students||[];S.teachers=data.teachers||[];S.records=data.records||[];render();msg('#message')}catch(e){msg('#message',e.message);throw e}finally{S.loading=false;$('#refresh').disabled=false}}
function visibleStudents(){
 const q=$('#studentSearch').value.trim().toLowerCase();
 return S.students.filter(s=>s.class&&(!S.pickClass||s.class===S.pickClass)&&(!q||[s.name,s.korean_name,s.class].some(v=>String(v||'').toLowerCase().includes(q)))).sort((a,b)=>person(a).localeCompare(person(b)));
}
function renderSelected(){
 const chosen=S.students.filter(s=>S.selected.has(s.id));
 $('#selected').textContent=chosen.length?chosen.length+'명 선택됨':'학생을 선택하세요.';
 $('#selectedStudents').innerHTML=chosen.map(s=>'<button type="button" data-remove-student="'+esc(s.id)+'">'+esc(s.name||s.korean_name)+' · '+esc(s.class)+' <span aria-hidden="true">×</span></button>').join('');
 $$('[data-remove-student]').forEach(b=>b.onclick=()=>{S.selected.delete(b.dataset.removeStudent);renderStudents()});
 $('#save').textContent=chosen.length?chosen.length+'명 저장':'저장';$('#save').disabled=S.busy||!chosen.length;
}
function priorAbsence(s){return S.records.find(r=>r.student_id===s.id&&r.class_name===s.class&&r.missed_date===$('#missed').value)}
function selectable(s){const old=priorAbsence(s);return !old||(old.status==='pending'&&S.editStatus==='scheduled')}
function renderStudents(){
 for(const s of S.students)if(S.selected.has(s.id)&&!selectable(s))S.selected.delete(s.id);
 const classes=[...new Set(S.students.map(s=>s.class).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 $('#pickClasses').innerHTML=tab('','전체 반',S.pickClass,'pick-class')+classes.map(c=>tab(c,c,S.pickClass,'pick-class')).join('');
 $$('[data-pick-class]').forEach(b=>b.onclick=()=>{S.pickClass=b.dataset.pickClass;renderStudents()});
 const rows=visibleStudents(),eligible=rows.filter(selectable),all=eligible.length>0&&eligible.every(s=>S.selected.has(s.id));
 $('#pickCount').textContent=rows.length+'명';
 $('#selectClass').disabled=!eligible.length;
 $('#selectClass').textContent=all?'전체 선택 해제':S.pickClass&&!$('#studentSearch').value.trim()?S.pickClass+' 전체 선택':'표시된 학생 모두 선택';
 $('#students').innerHTML=rows.length?rows.map(s=>{
 const picked=S.selected.has(s.id),old=priorAbsence(s),allowed=selectable(s);
 return '<button type="button" data-student="'+esc(s.id)+'" aria-pressed="'+picked+'" '+(!allowed?'disabled':'')+'><span><span class="student-check" aria-hidden="true">'+(picked?'✓':'')+'</span>'+esc(person(s))+'</span><small>'+esc(old?(old.status==='pending'&&allowed?'미정 · 예약 가능':'등록됨 · '+labels[old.status]):s.class)+'</small></button>'
 }).join(''):'<div class="empty">학생이 없습니다.</div>';
 $$('[data-student]').forEach(b=>b.onclick=()=>{const id=b.dataset.student;if(S.selected.has(id))S.selected.delete(id);else S.selected.add(id);renderStudents()});
 renderSelected();
}
function editType(type){S.editType=type;$('#editTypes').innerHTML=Object.keys(types).map(k=>tab(k,types[k],type,'edit-type')).join('');$$('[data-edit-type]').forEach(b=>b.onclick=()=>editType(b.dataset.editType))}
function editTeacher(id){S.editTeacher=id||'';const options=[['','미정'],...S.teachers.map(t=>[t.id,person(t)])];if(id&&!options.some(([v])=>v===id))options.push([id,'이전 담당 교사']);$('#teacherButtons').innerHTML=options.map(([v,l])=>tab(v,l,S.editTeacher,'edit-teacher')).join('');$$('[data-edit-teacher]').forEach(b=>b.onclick=()=>editTeacher(b.dataset.editTeacher))}
function editStatus(status){S.editStatus=status;const choices=S.editing?Object.keys(labels):['pending','scheduled'];$('#editStatuses').innerHTML=choices.map(k=>tab(k,labels[k],status,'edit-status')).join('');$$('[data-edit-status]').forEach(b=>b.onclick=()=>{editStatus(b.dataset.editStatus);if(!S.editing)renderStudents()});const has=['scheduled','completed'].includes(status);$('#schedule').hidden=!has;$('#makeupDate').required=has;$('#makeupTime').required=has;$('#makeupDate').min=$('#missed').value;$('#makeupDate').max=status==='completed'?today():''}
function open(record=null,booking=false){
 S.editing=record;S.selected.clear();S.pickClass=S.cls||'';$('#editorTitle').textContent=record?'보강 수정':booking?'보강 예약':'결석 등록';$('#pick').hidden=!!record;$('#selectedStudents').hidden=!!record;$('#studentSearch').value='';$('#selected').textContent=record?person(record)+' · '+record.class_name:'';
 $('#missed').disabled=!!record;$('#missed').max=today();$('#missed').value=record?.missed_date||today();$('#makeupDate').value=record?.makeup_date|| (booking?today():'');$('#makeupTime').value=record?.makeup_time?.slice(0,5)||'';$('#notes').value=record?.notes||'';$('#reason').value=record?.absence_reason||'';
 editTeacher(record?.teacher_id||'');
 editType(record?.makeup_type||'regular');editStatus(record?.status||(booking?'scheduled':'pending'));msg('#editMessage');$('#editor').classList.toggle('editing-single',!!record);if(!record)renderStudents();else{$('#save').textContent='저장';$('#save').disabled=false}$('#editor').showModal();
}
function setRecord(r){if(!r)throw Error('Save returned no record');const i=S.records.findIndex(x=>x.id===r.id);if(i<0)S.records.push(r);else S.records[i]=r;render()}
async function complete(r,b){if(S.busy||!r)return;S.busy=true;b.disabled=true;msg('#message');try{const data=await api('update',{id:r.id,updated_at:r.updated_at,status:'completed',makeup_date:r.makeup_date,makeup_time:r.makeup_time,notes:r.notes,makeup_type:r.makeup_type,teacher_id:r.teacher_id,absence_reason:r.absence_reason});setRecord(data.record)}catch(e){msg('#message',e.message)}finally{S.busy=false;b.disabled=false}}
$('#form').onsubmit=async e=>{
 e.preventDefault();if(S.busy)return;const r=S.editing;
 if(!r&&!S.selected.size){msg('#editMessage','학생을 선택하세요.');return}
 if(S.selected.size>150){msg('#editMessage','한 번에 최대 150명을 선택할 수 있습니다.');return}
 const b={status:S.editStatus,makeup_type:S.editType,teacher_id:S.editTeacher||null,absence_reason:$('#reason').value,makeup_date:$('#makeupDate').value,makeup_time:$('#makeupTime').value,notes:$('#notes').value,...(r?{id:r.id,updated_at:r.updated_at}:{student_ids:[...S.selected],missed_date:$('#missed').value})};
 S.busy=true;$('#save').disabled=true;$('#form').classList.add('saving');msg('#editMessage');
 try{const data=await api(r?'update':'create-batch',b);
  const records=r?[data.record]:data.records;if(!Array.isArray(records)||records.length!==(r?1:b.student_ids.length)||records.some(x=>!x))throw Error('저장 결과를 확인할 수 없습니다.');
  for(const rec of records){const i=S.records.findIndex(x=>x.id===rec.id);if(i<0)S.records.push(rec);else S.records[i]=rec}S.status=b.status==='scheduled'?'scheduled':b.status==='pending'?'pending':b.status;S.cls='';$('#search').value='';render();$('#editor').close();
 }catch(e){msg('#editMessage',e.message)}finally{S.busy=false;$('#form').classList.remove('saving');$('#save').disabled=!S.editing&&!S.selected.size}
};
$('#clearSelected').onclick=()=>{S.selected.clear();renderStudents()};
$('#selectClass').onclick=()=>{const rows=visibleStudents().filter(selectable),all=rows.every(s=>S.selected.has(s.id));for(const s of rows){if(all)S.selected.delete(s.id);else S.selected.add(s.id)}renderStudents()};
$('#book').onclick=()=>open(null,true);
$('#missed').onchange=()=>{editStatus(S.editStatus);if(!S.editing)renderStudents()};$('#studentSearch').oninput=renderStudents;$('#search').oninput=render;$('#add').onclick=()=>open();$('#refresh').onclick=()=>load().catch(()=>{});$('#close').onclick=$('#cancel').onclick=()=>{if(!S.busy)$('#editor').close()};$('#editor').addEventListener('cancel',e=>{if(S.busy)e.preventDefault()});
async function boot(){try{$('#retryBoot').hidden=true;const who=await ensureTeacherSession();if(!who?.success){if(who?.temporary)throw Error('Could not verify staff login');if(embedded){throw Error('Staff session expired. Sign in again in the main dashboard, then retry.')}location.replace('/Teachers/login.html?redirect=%2FTeachers%2Fmakeup%2F');return}ensureAuthRefresh();if(!embedded)await mountTeacherHeader({target:'#teacher-header',mode:'dashboard',activeApp:'library'});await load();$('#boot').hidden=true;$('#app').hidden=false}catch(e){$('#boot').firstChild.nodeValue=e.message+' ';$('#retryBoot').hidden=false}}
if(embedded)window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==window.parent||e.data?.type!=='willena:makeup:activate')return;if(!$('#app').hidden&&!$('#editor').open&&!S.busy)load().catch(()=>{})});
$('#retryBoot').onclick=boot;document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('#app').hidden&&!$('#editor').open)load().catch(()=>{})});boot();
