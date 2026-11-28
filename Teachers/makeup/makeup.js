import {mountTeacherHeader} from '/components/teacher-header/teacher-header.js?v=20261128-sharedmakeup1';
import {ensureTeacherSession,ensureAuthRefresh} from '/Teachers/auth-refresh.js?v=20261021-sessionfix1';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const labels={pending:'미정',scheduled:'예약',completed:'완료',waived:'보강 불필요'};
const S={students:[],records:[],status:'open',cls:'',selected:null,editing:null,editStatus:'pending',busy:false,loading:false};
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
 $('#records').innerHTML=rows.length?'<div class="tableWrap"><table><thead><tr><th>학생</th><th>반</th><th>결석일</th><th>보강 일시</th><th>상태</th><th>메모</th><th>관리</th></tr></thead><tbody>'+rows.map(r=>'<tr><td><strong>'+esc(r.student_name)+'</strong><small>'+esc(r.korean_name===r.student_name?'':r.korean_name)+'</small></td><td>'+esc(r.class_name)+'</td><td>'+esc(r.missed_date)+'</td><td>'+esc(r.makeup_date?r.makeup_date+' '+r.makeup_time.slice(0,5):'—')+'</td><td><span class="state '+r.status+'">'+labels[r.status]+'</span></td><td class="note">'+esc(r.notes||'—')+'</td><td><div class="rowActions"><button type="button" class="secondary" data-edit="'+r.id+'">'+(r.status==='pending'?'예약':'수정')+'</button>'+(r.status==='scheduled'&&r.makeup_date<=today()?'<button type="button" data-complete="'+r.id+'">완료</button>':'')+'</div></td></tr>').join('')+'</tbody></table></div>':'<div class="empty">표시할 보강 기록이 없습니다.</div>';
 $$('[data-edit]').forEach(b=>b.onclick=()=>open(S.records.find(r=>r.id===b.dataset.edit)));
 $$('[data-complete]').forEach(b=>b.onclick=()=>complete(S.records.find(r=>r.id===b.dataset.complete),b));
}
async function load(){if(S.loading||S.busy)return;S.loading=true;$('#refresh').disabled=true;msg('#message','불러오는 중…');try{const data=await api('list');S.students=data.students||[];S.records=data.records||[];render();msg('#message')}catch(e){msg('#message',e.message);throw e}finally{S.loading=false;$('#refresh').disabled=false}}
function renderStudents(){
 const q=$('#studentSearch').value.trim().toLowerCase();const rows=S.students.filter(s=>s.class&&(!q||[s.name,s.korean_name,s.class].some(v=>String(v||'').toLowerCase().includes(q)))).sort((a,b)=>person(a).localeCompare(person(b))).slice(0,80);
 $('#students').innerHTML=rows.length?rows.map(s=>'<button type="button" data-student="'+esc(s.id)+'" aria-pressed="'+(S.selected?.id===s.id)+'"><span>'+esc(person(s))+'</span><small>'+esc(s.class)+'</small></button>').join(''):'<div class="empty">학생이 없습니다.</div>';
 $$('[data-student]').forEach(b=>b.onclick=()=>{S.selected=S.students.find(s=>s.id===b.dataset.student);$('#selected').textContent=person(S.selected)+' · '+S.selected.class;renderStudents()});
}
function editStatus(status){S.editStatus=status;$('#editStatuses').innerHTML=Object.keys(labels).map(k=>tab(k,labels[k],status,'edit-status')).join('');$$('[data-edit-status]').forEach(b=>b.onclick=()=>editStatus(b.dataset.editStatus));const has=['scheduled','completed'].includes(status);$('#schedule').hidden=!has;$('#makeupDate').required=has;$('#makeupTime').required=has;$('#makeupDate').min=$('#missed').value;$('#makeupDate').max=status==='completed'?today():''}
function open(record=null){S.editing=record;S.selected=null;$('#editorTitle').textContent=record?'보강 수정':'결석 등록';$('#pick').hidden=!!record;$('#studentSearch').value='';$('#selected').textContent=record?person(record)+' · '+record.class_name:'';$('#missed').disabled=!!record;$('#missed').max=today();$('#missed').value=record?.missed_date||today();$('#makeupDate').value=record?.makeup_date||'';$('#makeupTime').value=record?.makeup_time?.slice(0,5)||'';$('#notes').value=record?.notes||'';editStatus(record?.status||'pending');msg('#editMessage');if(!record)renderStudents();$('#editor').showModal()}
function setRecord(r){if(!r)throw Error('Save returned no record');const i=S.records.findIndex(x=>x.id===r.id);if(i<0)S.records.push(r);else S.records[i]=r;render()}
async function complete(r,b){if(S.busy||!r)return;S.busy=true;b.disabled=true;msg('#message');try{const data=await api('update',{id:r.id,updated_at:r.updated_at,status:'completed',makeup_date:r.makeup_date,makeup_time:r.makeup_time,notes:r.notes});setRecord(data.record)}catch(e){msg('#message',e.message)}finally{S.busy=false;b.disabled=false}}
$('#form').onsubmit=async e=>{e.preventDefault();if(S.busy)return;const r=S.editing;if(!r&&!S.selected){msg('#editMessage','학생을 선택하세요.');return}const b={status:S.editStatus,makeup_date:$('#makeupDate').value,makeup_time:$('#makeupTime').value,notes:$('#notes').value,...(r?{id:r.id,updated_at:r.updated_at}:{student_id:S.selected.id,missed_date:$('#missed').value})};S.busy=true;$('#save').disabled=true;msg('#editMessage');try{const data=await api(r?'update':'create',b);setRecord(data.record);$('#editor').close()}catch(e){msg('#editMessage',e.message)}finally{S.busy=false;$('#save').disabled=false}};
$('#missed').onchange=()=>editStatus(S.editStatus);$('#studentSearch').oninput=renderStudents;$('#search').oninput=render;$('#add').onclick=()=>open();$('#refresh').onclick=()=>load().catch(()=>{});$('#close').onclick=$('#cancel').onclick=()=>{if(!S.busy)$('#editor').close()};$('#editor').addEventListener('cancel',e=>{if(S.busy)e.preventDefault()});
async function boot(){try{$('#retryBoot').hidden=true;const who=await ensureTeacherSession();if(!who?.success){if(who?.temporary)throw Error('Could not verify staff login');location.replace('/Teachers/login.html?redirect=%2FTeachers%2Fmakeup%2F');return}ensureAuthRefresh();await mountTeacherHeader({target:'#teacher-header',mode:'dashboard',activeApp:'makeup'});await load();$('#boot').hidden=true;$('#app').hidden=false}catch(e){$('#boot').firstChild.nodeValue=e.message+' ';$('#retryBoot').hidden=false}}
$('#retryBoot').onclick=boot;document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('#app').hidden&&!$('#editor').open)load().catch(()=>{})});boot();
