(()=>{
  const studentList=document.getElementById('studentList');
  if(!studentList)return;

  const backdrop=document.createElement('div');
  backdrop.className='drawer-backdrop';
  backdrop.id='studentDrawerBackdrop';
  const drawer=document.createElement('aside');
  drawer.className='student-drawer';
  drawer.id='studentDrawer';
  drawer.setAttribute('aria-hidden','true');
  drawer.innerHTML=`
    <div class="drawer-head">
      <div class="drawer-avatar" id="drawerAvatar">S</div>
      <div class="drawer-title"><h2 id="drawerName">Student</h2><p id="drawerSub"></p></div>
      <button class="drawer-close" id="drawerClose" aria-label="Close student details">×</button>
    </div>
    <div class="drawer-body">
      <section class="drawer-section">
        <h3>Student profile</h3>
        <div class="detail-grid" id="drawerProfile"></div>
      </section>
      <section class="drawer-section">
        <h3>Account</h3>
        <div class="detail-grid" id="drawerAccount"></div>
      </section>
      <section class="drawer-section">
        <h3>Learning activity</h3>
        <div class="drawer-empty">Level-test results, homework activity and game progress are not connected to this view yet. This section is reserved for the next data phase.</div>
      </section>
      <section class="drawer-section">
        <h3>Actions</h3>
        <div class="drawer-actions">
          <button id="drawerEdit">Edit profile</button>
          <button id="drawerMove">Move class</button>
          <button class="danger" id="drawerRemove">Remove from class</button>
        </div>
      </section>
    </div>`;
  document.body.append(backdrop,drawer);

  let openStudentId=null;
  const value=v=>String(v??'').trim()||'—';
  const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const field=(label,v,extra='')=>`<div class="detail ${extra}"><label>${safe(label)}</label><div>${safe(value(v))}</div></div>`;

  function getStudent(id){
    try{return typeof findStudent==='function'?findStudent(id):null}catch{return null}
  }
  function renderDrawer(){
    if(!openStudentId)return;
    const s=getStudent(openStudentId);
    if(!s){closeDrawer();return}
    const display=typeof nameOf==='function'?nameOf(s):(s.name||s.korean_name||s.username||'Student');
    document.getElementById('drawerAvatar').textContent=(display[0]||'S').toUpperCase();
    document.getElementById('drawerName').textContent=display;
    document.getElementById('drawerSub').textContent=[s.korean_name,s.username].filter(Boolean).join(' · ');
    document.getElementById('drawerProfile').innerHTML=[
      field('English name',s.name),field('Korean name',s.korean_name),
      field('Class',s.class||'No class'),field('Grade',s.grade),
      field('School',s.school,'full'),field('Phone',s.phone,'full')
    ].join('');
    const approved=s.approved!==false;
    document.getElementById('drawerAccount').innerHTML=[
      field('Username',s.username),
      `<div class="detail"><label>Status</label><div class="${approved?'status-good':'status-warn'}">${approved?'Approved':'Approval pending'}</div></div>`,
      field('Role',s.role||'student'),
      `<div class="detail full"><label>Account ID</label><div class="drawer-id">${safe(value(s.id))}</div></div>`
    ].join('');
    const remove=document.getElementById('drawerRemove');
    remove.style.display=s.class?'block':'none';
    document.getElementById('drawerMove').textContent=s.class?'Move class':'Assign class';
  }
  function openDrawer(id){
    if(!getStudent(id))return;
    openStudentId=id;
    renderDrawer();
    backdrop.classList.add('show');
    drawer.classList.add('show');
    drawer.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
  }
  function closeDrawer(){
    backdrop.classList.remove('show');
    drawer.classList.remove('show');
    drawer.setAttribute('aria-hidden','true');
    document.body.style.overflow='';
    openStudentId=null;
  }

  studentList.addEventListener('click',e=>{
    if(e.target.closest('button,a,input,select'))return;
    const row=e.target.closest('[data-row-id]');
    if(row)openDrawer(row.dataset.rowId);
  });
  studentList.addEventListener('keydown',e=>{
    if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){
      const row=e.target.closest('[data-row-id]');
      if(row){e.preventDefault();openDrawer(row.dataset.rowId)}
    }
  });
  const observer=new MutationObserver(()=>{
    document.querySelectorAll('.student[data-row-id]').forEach(row=>{
      row.tabIndex=0;
      row.setAttribute('role','button');
      row.setAttribute('aria-label','Open student information');
    });
    if(openStudentId)renderDrawer();
  });
  observer.observe(studentList,{childList:true,subtree:true});

  backdrop.onclick=closeDrawer;
  document.getElementById('drawerClose').onclick=closeDrawer;
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&openStudentId)closeDrawer()});
  document.getElementById('drawerEdit').onclick=()=>{const id=openStudentId;closeDrawer();if(id&&typeof openEdit==='function')openEdit(id)};
  document.getElementById('drawerMove').onclick=()=>{const id=openStudentId;closeDrawer();if(id&&typeof openMove==='function')openMove(id)};
  document.getElementById('drawerRemove').onclick=()=>{const id=openStudentId;closeDrawer();if(id&&typeof openRemove==='function')openRemove(id)};
})();