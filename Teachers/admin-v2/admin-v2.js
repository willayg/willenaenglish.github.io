import { loadStudentRoster, replaceStudentRoster } from '/Teachers/shared/student-roster.js?v=20260917-p21';

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const ADMIN='/.netlify/functions/teacher_admin';
const state={students:[],filtered:[],selected:null};
let classesModulePromise=null;
let levelTestsPromise=null;

function loginUrl(){return `/Teachers/login.html?redirect=${encodeURIComponent(location.pathname+location.search)}`}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function displayName(s){return s.name||s.korean_name||s.username||'Student'}
function value(v){const s=String(v??'').trim();return s||'—'}
function classes(){return [...new Set(state.students.map(s=>s.class).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))}
function syncRoster(){replaceStudentRoster(state.students);buildFilters();applyFilters();if(state.selected){state.selected=state.students.find(s=>s.id===state.selected.id)||null;if(state.selected)renderDrawer();else closeStudent()}}

async function adminApi(action,body={}){
  const fn=window.WillenaAPI?.fetch||window.fetch.bind(window);
  const response=await fn(`${ADMIN}?action=${encodeURIComponent(action)}`,{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data?.success===false){const error=new Error(data?.error||`Request failed (${response.status})`);error.status=response.status;throw error}
  return data;
}

function toast(message,error=false){
  let el=$('#adminToast');if(!el){el=document.createElement('div');el.id='adminToast';el.className='admin-toast';document.body.appendChild(el)}
  el.textContent=message;el.classList.toggle('error',error);el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2600);
}
function modal(title,html,onSave,{saveLabel='Save',danger=false}={}){
  closeModal();const bg=document.createElement('div');bg.className='admin-modal-bg';bg.id='adminModalBg';bg.innerHTML=`<div class="admin-modal"><div class="admin-modal-head"><h2>${esc(title)}</h2><button type="button" data-close>×</button></div><div class="admin-modal-body">${html}<div class="admin-modal-error" id="adminModalError"></div></div><div class="admin-modal-foot"><button type="button" class="secondary" data-close>Cancel</button><button type="button" class="${danger?'danger':''}" id="adminModalSave">${esc(saveLabel)}</button></div></div>`;document.body.appendChild(bg);bg.addEventListener('click',e=>{if(e.target===bg||e.target.closest('[data-close]'))closeModal()});$('#adminModalSave').onclick=async()=>{const b=$('#adminModalSave');b.disabled=true;$('#adminModalError').textContent='';try{await onSave(bg);closeModal()}catch(e){$('#adminModalError').textContent=e.message;b.disabled=false}};setTimeout(()=>bg.querySelector('input,select')?.focus(),0)
}
function closeModal(){$('#adminModalBg')?.remove()}
function input(label,id,val='',type='text',extra=''){return `<label class="admin-form-field"><span>${esc(label)}</span><input id="${id}" type="${type}" value="${esc(val)}" ${extra}></label>`}
function selectField(label,id,options,current=''){return `<label class="admin-form-field"><span>${esc(label)}</span><select id="${id}">${options.map(([v,l])=>`<option value="${esc(v)}"${String(v)===String(current)?' selected':''}>${esc(l)}</option>`).join('')}</select></label>`}

function setView(view){$$('.view').forEach(section=>section.classList.toggle('active',section.id===`view-${view}`));$$('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===view))}
async function ensureClasses(){
  if(!classesModulePromise)classesModulePromise=import('./admin-v2-classes.js?v=1.07').then(mod=>mod.mountClasses());
  return classesModulePromise;
}
async function ensureLevelTests(){
  if(levelTestsPromise)return levelTestsPromise;
  levelTestsPromise=new Promise((resolve,reject)=>{
    if(window.__adminV2LevelTestsLoaded){$('#levelTestRefresh')?.click();resolve();return}
    const script=document.createElement('script');script.src='/Teachers/admin/admin-level-tests.js?v=20260917-adminv2-p4';script.async=true;
    script.onload=()=>{window.__adminV2LevelTestsLoaded=true;$('#levelTestRefresh')?.click();resolve()};
    script.onerror=()=>reject(new Error('Could not load Level Tests'));
    document.head.appendChild(script);
  });
  return levelTestsPromise;
}
function activateView(view){
  setView(view);
  if(view==='classes')ensureClasses().catch(error=>{$('#classGridV2').innerHTML=`<div class="empty">${esc(error.message)}</div>`});
  if(view==='level-tests')ensureLevelTests().catch(error=>{$('#levelTestRows').innerHTML=`<tr><td colspan="5" class="empty">${esc(error.message)}</td></tr>`});
}
function bindNavigation(){
  $$('[data-view]').forEach(button=>button.addEventListener('click',()=>activateView(button.dataset.view)));
  const layout=$('#adminLayout'),toggle=$('#railCollapseToggle');toggle?.addEventListener('click',()=>{const expanded=layout.classList.toggle('sidebar-expanded');toggle.setAttribute('aria-expanded',String(expanded));toggle.setAttribute('aria-label',expanded?'Collapse sidebar':'Expand sidebar')})
}
function buildFilters(){
  const classFilter=$('#classFilter'),gradeFilter=$('#gradeFilter');const currentClass=classFilter.value,currentGrade=gradeFilter.value;
  const cls=classes(),grades=[...new Set(state.students.map(s=>s.grade).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  classFilter.innerHTML='<option value="">All classes</option><option value="__none__">No class</option>'+cls.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  gradeFilter.innerHTML='<option value="">All grades</option>'+grades.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  if([...classFilter.options].some(o=>o.value===currentClass))classFilter.value=currentClass;if([...gradeFilter.options].some(o=>o.value===currentGrade))gradeFilter.value=currentGrade
}
function applyFilters(){
  const q=($('#studentSearch').value||'').trim().toLowerCase(),cls=$('#classFilter').value,grade=$('#gradeFilter').value;
  state.filtered=state.students.filter(s=>{const classOk=!cls||(cls==='__none__'?!s.class:s.class===cls),gradeOk=!grade||s.grade===grade,hay=[s.name,s.korean_name,s.username,s.class,s.grade,s.school].join(' ').toLowerCase();return classOk&&gradeOk&&(!q||hay.includes(q))});renderStudents()
}
function renderStudents(){
  const list=$('#studentList'),rows=state.filtered;$('#studentCount').textContent=`${rows.length} student${rows.length===1?'':'s'}`;$('#studentStatus').textContent=rows.length===state.students.length?`${state.students.length} total`:`${rows.length} of ${state.students.length}`;
  if(!rows.length){list.innerHTML='<div class="empty">No students found.</div>';return}
  list.innerHTML=rows.map(s=>`<div class="student-row" data-student-id="${esc(s.id)}"><div class="admin-student-main"><div class="student-name">${esc(displayName(s))}</div><div class="student-ko">${esc([s.korean_name,s.username].filter(Boolean).join(' · '))}</div></div><div><span class="admin-pill${s.approved?'':' pending'}">${esc(s.class||'No class')}</span></div><div class="admin-student-cell admin-student-grade"><b>${esc(s.grade||'—')}</b><span>Grade</span></div><div class="admin-student-cell admin-student-school"><b>${esc(s.school||'—')}</b><span>${s.approved?'Approved':'Approval pending'}</span></div></div>`).join('');
  $$('.student-row',list).forEach(row=>row.addEventListener('click',()=>openStudent(row.dataset.studentId)))
}
function field(label,v,full=false){return `<div class="admin-profile-field${full?' full':''}"><small>${esc(label)}</small><b>${esc(value(v))}</b></div>`}
function renderDrawer(){
  const s=state.selected;if(!s)return;$('#drawerName').textContent=displayName(s);$('#drawerMeta').textContent=[s.korean_name,s.username,s.class].filter(Boolean).join(' · ');
  $('#drawerBody').innerHTML=`<div class="detail"><h3>Student profile</h3><div class="admin-profile-grid">${field('English name',s.name)}${field('Korean name',s.korean_name)}${field('Username',s.username)}${field('Class',s.class||'No class')}${field('Grade',s.grade)}${field('School',s.school,true)}${field('Phone',s.phone,true)}${field('Account ID',s.id,true)}</div><div class="admin-drawer-actions"><button type="button" data-action="edit">Edit profile</button><button type="button" data-action="class">${s.class?'Move / remove class':'Assign class'}</button><button type="button" data-action="approve">${s.approved?'Unapprove':'Approve'}</button><button type="button" data-action="password">Reset password</button><button type="button" class="danger" data-action="delete">Delete student</button></div></div>`;
  $$('[data-action]',$('#drawerBody')).forEach(b=>b.onclick=()=>({edit:openEdit,class:openClass,approve:toggleApproved,password:openPassword,delete:openDelete}[b.dataset.action]?.()))
}
function openStudent(id){const s=state.students.find(x=>String(x.id)===String(id));if(!s)return;state.selected=s;renderDrawer();$('#studentDrawerBg').classList.add('open')}
function closeStudent(){state.selected=null;$('#studentDrawerBg').classList.remove('open')}

function openEdit(){const s=state.selected;if(!s)return;modal(`Edit ${displayName(s)}`,`<div class="admin-form-grid">${input('English name','mName',s.name)}${input('Korean name','mKorean',s.korean_name)}${input('Username','mUsername',s.username)}${input('Grade','mGrade',s.grade)}${input('School','mSchool',s.school)}${input('Phone','mPhone',s.phone)}</div>`,async()=>{const patch={name:$('#mName').value.trim(),korean_name:$('#mKorean').value.trim(),username:$('#mUsername').value.trim(),grade:$('#mGrade').value.trim()||null,school:$('#mSchool').value.trim()||null,phone:$('#mPhone').value.trim()||null};await adminApi('update_student',{user_id:s.id,...patch});Object.assign(s,{...patch,grade:patch.grade||'',school:patch.school||'',phone:patch.phone||''});syncRoster();toast('Student updated')})}
function openClass(){const s=state.selected;if(!s)return;const opts=[['','No class'],...classes().map(c=>[c,c])];modal(`${s.class?'Move':'Assign'} ${displayName(s)}`,selectField('Class','mClass',opts,s.class),async()=>{const next=$('#mClass').value;await adminApi('update_student',{user_id:s.id,class:next});s.class=next;syncRoster();toast(next?'Class updated':'Removed from class')},{saveLabel:'Save class'})}
async function toggleApproved(){const s=state.selected;if(!s)return;const next=!s.approved;try{await adminApi('set_approved',{user_id:s.id,approved:next});s.approved=next;syncRoster();toast(next?'Student approved':'Approval removed')}catch(e){toast(e.message,true)}}
function openPassword(){const s=state.selected;if(!s)return;modal(`Reset password · ${displayName(s)}`,`${input('New password','mPassword','','password','autocomplete="new-password"')}<p class="admin-form-note">Minimum 6 characters.</p>`,async()=>{const pass=$('#mPassword').value;if(pass.length<6)throw new Error('Password must be at least 6 characters');await adminApi('reset_password',{user_id:s.id,new_password:pass});toast('Password reset')},{saveLabel:'Reset password'})}
function openDelete(){const s=state.selected;if(!s)return;modal(`Delete ${displayName(s)}?`,`<p class="admin-danger-copy">This permanently deletes the student account. This is not the same as removing them from a class.</p><label class="admin-confirm"><input type="checkbox" id="mConfirmDelete"> I understand this deletes the account.</label>`,async()=>{if(!$('#mConfirmDelete').checked)throw new Error('Confirm permanent deletion first');await adminApi('delete_student',{user_id:s.id});state.students=state.students.filter(x=>x.id!==s.id);state.selected=null;replaceStudentRoster(state.students);buildFilters();applyFilters();closeStudent();toast('Student deleted')},{saveLabel:'Delete student',danger:true})}

function populateAddClass(){const select=$('#addClass');if(!select)return;const current=select.value;select.innerHTML='<option value="">No class</option>'+classes().map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');if([...select.options].some(o=>o.value===current))select.value=current}
function resetAddForm(){$('#addStudentForm')?.reset();$('#addStudentError').textContent='';populateAddClass()}
function openAdd(){closeStudent();resetAddForm();$('#addStudentDrawerBg').classList.add('open');setTimeout(()=>$('#addName')?.focus(),120)}
function closeAdd(){$('#addStudentDrawerBg').classList.remove('open');$('#addStudentError').textContent=''}
async function createStudentFromDrawer(event){
  event.preventDefault();const button=$('#createStudentButton');button.disabled=true;$('#addStudentError').textContent='';
  try{
    const username=$('#addUsername').value.trim().toLowerCase(),password=$('#addPassword').value;
    if(!username||!/^[a-z0-9._-]{3,40}$/.test(username))throw new Error('Enter a valid username of at least 3 characters');
    if(password.length<6)throw new Error('Password must be at least 6 characters');
    if(state.students.some(s=>s.username.toLowerCase()===username))throw new Error('That username is already in the roster');
    const body={name:$('#addName').value.trim(),korean_name:$('#addKorean').value.trim(),username,password,class:$('#addClass').value,grade:$('#addGrade').value.trim()||null,school:$('#addSchool').value.trim()||null,phone:$('#addPhone').value.trim()||null,approved:true};
    if(!body.name&&!body.korean_name)throw new Error('Enter an English or Korean name');
    const result=await adminApi('create_student',body);
    state.students.unshift({id:result.user_id,name:body.name,korean_name:body.korean_name,username,email:`${username}@stu.willena`,class:body.class,grade:body.grade||'',school:body.school||'',phone:body.phone||'',role:'student',approved:true});
    syncRoster();closeAdd();toast('Student created');
  }catch(error){$('#addStudentError').textContent=error.message}
  finally{button.disabled=false}
}

async function loadStudents(force=false){
  if(force){$('#studentStatus').textContent='Refreshing…';$('#studentList').innerHTML='<div class="empty">Refreshing students…</div>'}
  try{const roster=await loadStudentRoster({force,repairSession:true,onRefresh:fresh=>{state.students=fresh.students||[];buildFilters();applyFilters();populateAddClass()}});state.students=roster.students||[];buildFilters();applyFilters();populateAddClass()}
  catch(error){console.error('[Admin V2] roster/authorization failed',error);if(Number(error.status)===403){location.replace('/Teachers/dashboard-v2/');return}if(Number(error.status)===401){location.replace(loginUrl());return}$('#studentStatus').textContent='Could not load students';$('#studentList').innerHTML=`<div class="empty">${esc(error.message)}</div>`}
}
async function mountBurger(){try{if(!document.getElementById('burger-menu-template')){const response=await fetch('/components/burger-menu.html?v=20260917-r14-07',{cache:'force-cache'});const wrapper=document.createElement('div');wrapper.innerHTML=await response.text();if(wrapper.firstElementChild)document.body.appendChild(wrapper.firstElementChild)}const mod=await import('/components/burger-menu.js?v=20260917-r14-07');mod.insertBurgerMenu('#burger-menu-mount')}catch(error){console.warn('[Admin V2] shared burger menu failed',error)}}
function bindStudents(){
  $('#studentSearch').addEventListener('input',applyFilters);$('#classFilter').addEventListener('change',applyFilters);$('#gradeFilter').addEventListener('change',applyFilters);$('#studentRefresh').addEventListener('click',()=>loadStudents(true));$('#addStudent').addEventListener('click',openAdd);$('#closeStudentDrawer').addEventListener('click',closeStudent);$('#studentDrawerBg').addEventListener('click',e=>{if(e.target===$('#studentDrawerBg'))closeStudent()});$('#closeAddStudentDrawer').addEventListener('click',closeAdd);$('#cancelAddStudent').addEventListener('click',closeAdd);$('#addStudentDrawerBg').addEventListener('click',e=>{if(e.target===$('#addStudentDrawerBg'))closeAdd()});$('#addStudentForm').addEventListener('submit',createStudentFromDrawer);document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();closeStudent();closeAdd()}})
}
function boot(){bindNavigation();bindStudents();$('#adminV2Boot')?.classList.add('hidden');loadStudents(false);mountBurger()}
boot();
