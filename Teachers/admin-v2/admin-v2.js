import { loadStudentRoster } from '/Teachers/shared/student-roster.js?v=20260917-p2';

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const state={students:[],filtered:[],selected:null};

function loginUrl(){return `/Teachers/login.html?redirect=${encodeURIComponent(location.pathname+location.search)}`}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function displayName(s){return s.name||s.korean_name||s.username||'Student'}
function value(v){const s=String(v??'').trim();return s||'—'}

function setView(view){
  $$('.view').forEach(section=>section.classList.toggle('active',section.id===`view-${view}`));
  $$('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===view));
}

function bindNavigation(){
  $$('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
  const layout=$('#adminLayout'),toggle=$('#railCollapseToggle');
  toggle?.addEventListener('click',()=>{
    const expanded=layout.classList.toggle('sidebar-expanded');
    toggle.setAttribute('aria-expanded',String(expanded));
    toggle.setAttribute('aria-label',expanded?'Collapse sidebar':'Expand sidebar');
  });
}

function buildFilters(){
  const classFilter=$('#classFilter'),gradeFilter=$('#gradeFilter');
  const currentClass=classFilter.value,currentGrade=gradeFilter.value;
  const classes=[...new Set(state.students.map(s=>s.class).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const grades=[...new Set(state.students.map(s=>s.grade).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  classFilter.innerHTML='<option value="">All classes</option><option value="__none__">No class</option>'+classes.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  gradeFilter.innerHTML='<option value="">All grades</option>'+grades.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  if([...classFilter.options].some(o=>o.value===currentClass))classFilter.value=currentClass;
  if([...gradeFilter.options].some(o=>o.value===currentGrade))gradeFilter.value=currentGrade;
}

function applyFilters(){
  const q=($('#studentSearch').value||'').trim().toLowerCase();
  const cls=$('#classFilter').value,grade=$('#gradeFilter').value;
  state.filtered=state.students.filter(s=>{
    const classOk=!cls||(cls==='__none__'?!s.class:s.class===cls);
    const gradeOk=!grade||s.grade===grade;
    const hay=[s.name,s.korean_name,s.username,s.class,s.grade,s.school].join(' ').toLowerCase();
    return classOk&&gradeOk&&(!q||hay.includes(q));
  });
  renderStudents();
}

function renderStudents(){
  const list=$('#studentList'),rows=state.filtered;
  $('#studentCount').textContent=`${rows.length} student${rows.length===1?'':'s'}`;
  $('#studentStatus').textContent=rows.length===state.students.length?`${state.students.length} total`:`${rows.length} of ${state.students.length}`;
  if(!rows.length){list.innerHTML='<div class="empty">No students found.</div>';return}
  list.innerHTML=rows.map(s=>`<div class="student-row" data-student-id="${esc(s.id)}">
    <div class="admin-student-main"><div class="student-name">${esc(displayName(s))}</div><div class="student-ko">${esc([s.korean_name,s.username].filter(Boolean).join(' · '))}</div></div>
    <div><span class="admin-pill${s.approved?'':' pending'}">${esc(s.class||'No class')}</span></div>
    <div class="admin-student-cell admin-student-grade"><b>${esc(s.grade||'—')}</b><span>Grade</span></div>
    <div class="admin-student-cell admin-student-school"><b>${esc(s.school||'—')}</b><span>${s.approved?'Approved':'Approval pending'}</span></div>
  </div>`).join('');
  $$('.student-row',list).forEach(row=>row.addEventListener('click',()=>openStudent(row.dataset.studentId)));
}

function field(label,v,full=false){return `<div class="admin-profile-field${full?' full':''}"><small>${esc(label)}</small><b>${esc(value(v))}</b></div>`}
function openStudent(id){
  const s=state.students.find(x=>String(x.id)===String(id));if(!s)return;
  state.selected=s;
  $('#drawerName').textContent=displayName(s);
  $('#drawerMeta').textContent=[s.korean_name,s.username,s.class].filter(Boolean).join(' · ');
  $('#drawerBody').innerHTML=`<div class="detail"><h3>Student profile</h3><div class="admin-profile-grid">
    ${field('English name',s.name)}${field('Korean name',s.korean_name)}${field('Username',s.username)}${field('Class',s.class||'No class')}${field('Grade',s.grade)}${field('School',s.school,true)}${field('Phone',s.phone,true)}${field('Account ID',s.id,true)}
  </div><div class="admin-drawer-actions"><button type="button" disabled>Edit profile · P3</button><button type="button" disabled>Move class · P3</button></div></div>`;
  $('#studentDrawerBg').classList.add('open');
}
function closeStudent(){state.selected=null;$('#studentDrawerBg').classList.remove('open')}

async function loadStudents(force=false){
  $('#studentStatus').textContent='Loading…';
  if(force)$('#studentList').innerHTML='<div class="empty">Refreshing students…</div>';
  try{
    const roster=await loadStudentRoster({force,repairSession:true});
    state.students=roster.students||[];
    buildFilters();applyFilters();
  }catch(error){
    console.error('[Admin V2] roster/authorization failed',error);
    if(Number(error.status)===403){location.replace('/Teachers/dashboard-v2/');return}
    if(Number(error.status)===401){location.replace(loginUrl());return}
    $('#studentStatus').textContent='Could not load students';
    $('#studentList').innerHTML=`<div class="empty">${esc(error.message)}</div>`;
  }
}

async function mountBurger(){
  try{
    if(!document.getElementById('burger-menu-template')){
      const response=await fetch('/components/burger-menu.html?v=20260917-r14-07',{cache:'force-cache'});
      const wrapper=document.createElement('div');wrapper.innerHTML=await response.text();if(wrapper.firstElementChild)document.body.appendChild(wrapper.firstElementChild);
    }
    const mod=await import('/components/burger-menu.js?v=20260917-r14-07');
    mod.insertBurgerMenu('#burger-menu-mount');
  }catch(error){console.warn('[Admin V2] shared burger menu failed',error)}
}

function bindStudents(){
  $('#studentSearch').addEventListener('input',applyFilters);
  $('#classFilter').addEventListener('change',applyFilters);
  $('#gradeFilter').addEventListener('change',applyFilters);
  $('#studentRefresh').addEventListener('click',()=>loadStudents(true));
  $('#closeStudentDrawer').addEventListener('click',closeStudent);
  $('#studentDrawerBg').addEventListener('click',e=>{if(e.target===$('#studentDrawerBg'))closeStudent()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeStudent()});
}

function boot(){
  bindNavigation();bindStudents();
  // Shell is safe to show immediately; protected student data arrives only after
  // the admin-only roster endpoint authorizes the request.
  $('#adminV2Boot')?.classList.add('hidden');
  loadStudents(false);
  mountBurger();
}

boot();
