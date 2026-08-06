(()=>{
  const translations={
    en:{
      appTitle:'Willena Admin',studentOperations:'Student operations',administrator:'Administrator',
      students:'Students',classes:'Classes',home:'Home',
      studentsTitle:'Students',studentsSub:'Live student profiles and class management.',
      classesTitle:'Classes',classesSub:'15 canonical classes with live rosters.',
      homeTitle:'Home',homeSub:'Quick updates will come later.',
      optimisticNotice:'Changes appear immediately and save quietly in the background. You will only be notified if something fails.',
      classNotice:'Class counts update immediately while changes save in the background.',
      homeEmpty:'Home updates will be designed later.',searchStudents:'Search students',refresh:'Refresh',
      allClasses:'All classes',noClass:'No class',allGrades:'All grades',noGrade:'No grade',
      shown:'shown',studentCount:'students',noClassCount:'no class',loadingStudents:'Loading students…',checkingAccess:'Checking admin access…',noStudents:'No students found.',
      approved:'Approved',approvalPending:'Approval pending',edit:'Edit',move:'Move',assign:'Assign',remove:'Remove',viewRoster:'View roster',
      editStudent:'Edit student',englishName:'English name',koreanName:'Korean name',username:'Username',grade:'Grade',school:'School',phone:'Phone',cancel:'Cancel',saveChanges:'Save changes',
      moveStudent:'Move student',currentClass:'Current class',moveTo:'Move to',moveStudentButton:'Move student',removeFromClass:'Remove from class',
      removeExplanation:'The account and records remain. Only the current class is cleared.',removeButton:'Remove from class',
      chooseDifferent:'Choose a different class.',waitChanges:'Please wait for current changes to finish.',
      saveFailed:'Could not save student changes',moveFailed:'Could not move student',removeFailed:'Could not remove student',undoFailed:'Could not undo',
      removedFrom:'{name} removed from {class}',undo:'Undo',
      profile:'Student profile',account:'Account',learningActivity:'Learning activity',actions:'Actions',
      activityEmpty:'Level-test results, homework activity and game progress are not connected to this view yet. This section is reserved for the next data phase.',
      status:'Status',role:'Role',accountId:'Account ID',editProfile:'Edit profile',moveClass:'Move class',assignClass:'Assign class',closeDetails:'Close student details',openInfo:'Open student information',student:'Student'
    },
    ko:{
      appTitle:'윌레나 관리자',studentOperations:'학생 관리',administrator:'관리자',
      students:'학생',classes:'반 관리',home:'홈',
      studentsTitle:'학생 관리',studentsSub:'학생 정보와 반 배정을 관리합니다.',
      classesTitle:'반 관리',classesSub:'15개 반의 현재 학생 명단입니다.',
      homeTitle:'홈',homeSub:'빠른 현황과 일정 기능은 추후 추가됩니다.',
      optimisticNotice:'변경 내용은 화면에 즉시 반영되고 백그라운드에서 저장됩니다. 문제가 생긴 경우에만 알려드립니다.',
      classNotice:'학생 이동은 즉시 반영되며 백그라운드에서 저장됩니다.',
      homeEmpty:'홈 화면은 추후 구성할 예정입니다.',searchStudents:'학생 검색',refresh:'새로고침',
      allClasses:'전체 반',noClass:'미배정',allGrades:'전체 학년',noGrade:'학년 미입력',
      shown:'명 표시',studentCount:'명',noClassCount:'명 미배정',loadingStudents:'학생 정보를 불러오는 중…',checkingAccess:'관리자 권한 확인 중…',noStudents:'검색 결과가 없습니다.',
      approved:'승인됨',approvalPending:'승인 대기',edit:'수정',move:'이동',assign:'배정',remove:'제외',viewRoster:'학생 명단 보기',
      editStudent:'학생 정보 수정',englishName:'영어 이름',koreanName:'한국 이름',username:'아이디',grade:'학년',school:'학교',phone:'전화번호',cancel:'취소',saveChanges:'저장',
      moveStudent:'반 이동',currentClass:'현재 반',moveTo:'이동할 반',moveStudentButton:'반 이동',removeFromClass:'반에서 제외',
      removeExplanation:'학생 계정과 학습 기록은 유지되며 현재 반 배정만 해제됩니다.',removeButton:'반에서 제외',
      chooseDifferent:'현재 반과 다른 반을 선택해 주세요.',waitChanges:'현재 변경 사항이 저장될 때까지 잠시 기다려 주세요.',
      saveFailed:'학생 정보를 저장하지 못했습니다',moveFailed:'학생을 이동하지 못했습니다',removeFailed:'학생을 반에서 제외하지 못했습니다',undoFailed:'실행 취소에 실패했습니다',
      removedFrom:'{name} 학생을 {class} 반에서 제외했습니다',undo:'실행 취소',
      profile:'학생 정보',account:'계정 정보',learningActivity:'학습 활동',actions:'관리',
      activityEmpty:'레벨 테스트, 숙제 활동, 게임 진도는 아직 이 화면에 연결되지 않았습니다. 다음 데이터 단계에서 추가할 예정입니다.',
      status:'상태',role:'권한',accountId:'계정 ID',editProfile:'정보 수정',moveClass:'반 이동',assignClass:'반 배정',closeDetails:'학생 정보 닫기',openInfo:'학생 정보 열기',student:'학생'
    }
  };

  const saved=localStorage.getItem('willenaAdminLanguage');
  let language=saved==='en'||saved==='ko'?saved:'ko';
  const t=(key,vars={})=>{
    let text=(translations[language]&&translations[language][key])||translations.en[key]||key;
    Object.entries(vars).forEach(([k,v])=>text=text.replaceAll(`{${k}}`,String(v)));
    return text;
  };
  window.AdminI18n={t,get language(){return language},setLanguage,translations};

  function setText(selector,key){const el=document.querySelector(selector);if(el)el.textContent=t(key)}
  function applyStatic(){
    document.documentElement.lang=language;
    document.title=t('appTitle');
    const brand=document.querySelector('.brand div');
    if(brand){const b=brand.querySelector('b'),s=brand.querySelector('small');if(b)b.textContent=t('appTitle');if(s)s.textContent=t('studentOperations')}
    document.querySelectorAll('[data-page="students"]').forEach(el=>el.textContent=`◎ ${t('students')}`);
    document.querySelectorAll('[data-page="classes"]').forEach(el=>el.textContent=`▦ ${t('classes')}`);
    document.querySelectorAll('[data-page="home"]').forEach(el=>el.textContent=`⌂ ${t('home')}`);
    const who=document.querySelector('.who small');if(who)who.textContent=t('administrator');
    const notices=document.querySelectorAll('.notice');if(notices[0])notices[0].textContent=t('optimisticNotice');if(notices[1])notices[1].textContent=t('classNotice');
    const homeEmpty=document.querySelector('#home .empty');if(homeEmpty)homeEmpty.textContent=t('homeEmpty');
    const search=document.getElementById('searchBox');if(search)search.placeholder=t('searchStudents');
    setText('#refreshBtn','refresh');
    const summary=document.querySelectorAll('.summary span');
    if(summary[0])summary[0].lastChild.textContent=` ${t('shown')}`;
    if(summary[1])summary[1].lastChild.textContent=` ${t('studentCount')}`;
    if(summary[2])summary[2].lastChild.textContent=` ${t('noClassCount')}`;
    setText('#editModal .modal-head h3','editStudent');
    const editLabels=document.querySelectorAll('#editModal label');
    ['englishName','koreanName','username','grade','school','phone'].forEach((k,i)=>{if(editLabels[i])editLabels[i].textContent=t(k)});
    const editButtons=document.querySelectorAll('#editModal .modal-foot button');if(editButtons[0])editButtons[0].textContent=t('cancel');if(editButtons[1])editButtons[1].textContent=t('saveChanges');
    setText('#moveModal .modal-head h3','moveStudent');
    const moveLabels=document.querySelectorAll('#moveModal label');if(moveLabels[0])moveLabels[0].textContent=t('currentClass');if(moveLabels[1])moveLabels[1].textContent=t('moveTo');
    const moveButtons=document.querySelectorAll('#moveModal .modal-foot button');if(moveButtons[0])moveButtons[0].textContent=t('cancel');if(moveButtons[1])moveButtons[1].textContent=t('moveStudentButton');
    setText('#removeModal .modal-head h3','removeFromClass');
    const removeInfo=document.querySelector('#removeModal .mut');if(removeInfo)removeInfo.textContent=t('removeExplanation');
    const removeButtons=document.querySelectorAll('#removeModal .modal-foot button');if(removeButtons[0])removeButtons[0].textContent=t('cancel');if(removeButtons[1])removeButtons[1].textContent=t('removeButton');
    document.querySelectorAll('.lang button').forEach((btn,i)=>{const code=i===0?'en':'ko';btn.dataset.lang=code;btn.classList.toggle('active',code===language);btn.onclick=()=>setLanguage(code)});
    if(typeof setPage==='function')setPage(currentPage||'students');
    if(typeof buildFilters==='function'&&Array.isArray(students))buildFilters();
    if(typeof apply==='function'&&Array.isArray(students))apply();
    if(typeof renderClasses==='function'&&Array.isArray(students))renderClasses();
    const loading=document.getElementById('loadingText');if(loading&&document.getElementById('loading')?.style.display!=='none')loading.textContent=t('checkingAccess');
    document.dispatchEvent(new CustomEvent('willena-language-change',{detail:{language}}));
  }
  function setLanguage(next){if(next!=='en'&&next!=='ko')return;language=next;localStorage.setItem('willenaAdminLanguage',next);applyStatic()}

  window.buildFilters=function(){
    const classFilter=document.getElementById('classFilter'),gradeFilter=document.getElementById('gradeFilter'),moveTarget=document.getElementById('moveTarget');
    const oldClass=classFilter?.value||'',oldGrade=gradeFilter?.value||'';
    if(classFilter)classFilter.innerHTML=`<option value="">${t('allClasses')}</option><option value="__none__">${t('noClass')}</option>`+canonical.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    const grades=[...new Set(students.map(s=>s.grade).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));
    if(gradeFilter)gradeFilter.innerHTML=`<option value="">${t('allGrades')}</option>`+grades.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('');
    if(moveTarget)moveTarget.innerHTML=canonical.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    if(classFilter&&[...classFilter.options].some(o=>o.value===oldClass))classFilter.value=oldClass;
    if(gradeFilter&&[...gradeFilter.options].some(o=>o.value===oldGrade))gradeFilter.value=oldGrade;
  };

  window.renderStudents=function(){
    const list=document.getElementById('studentList');
    if(!filtered.length){list.innerHTML=`<div class="card empty">${t('noStudents')}</div>`;return}
    list.innerHTML=filtered.map(s=>{const n=nameOf(s),p=pending.has(String(s.id))?' pending':'';return`<div class="card student${p}" data-row-id="${esc(s.id)}"><div class="person"><div class="ava">${esc(n[0].toUpperCase())}</div><div><b>${esc(n)}</b><div class="mut">${esc(s.korean_name||'')} ${s.username?'· '+esc(s.username):''}</div></div></div><div class="mobile-hide"><span class="pill">${esc(s.class||t('noClass'))}</span><div class="mut">${esc(s.grade||t('noGrade'))}</div></div><div class="optional"><b>${esc(s.school||'')}</b><div class="mut">${s.approved!==false?t('approved'):t('approvalPending')}</div></div><div class="actions-inline"><button class="link" data-edit="${esc(s.id)}">${t('edit')}</button><button class="link" data-move="${esc(s.id)}">${s.class?t('move'):t('assign')}</button>${s.class?`<button class="link danger" data-remove="${esc(s.id)}">${t('remove')}</button>`:''}</div></div>`}).join('');
    document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=e=>{e.stopPropagation();openEdit(b.dataset.edit)});
    document.querySelectorAll('[data-move]').forEach(b=>b.onclick=e=>{e.stopPropagation();openMove(b.dataset.move)});
    document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=e=>{e.stopPropagation();openRemove(b.dataset.remove)});
  };

  window.renderClasses=function(){
    const counts=Object.fromEntries(canonical.map(c=>[c,0]));students.forEach(s=>{if(counts[s.class]!==undefined)counts[s.class]++});
    document.getElementById('classGrid').innerHTML=canonical.map(c=>`<div class="card class-card"><h3>${c}</h3><div class="count">${counts[c]}</div><div class="mut">${t('studentCount')}</div><button data-view-class="${c}">${t('viewRoster')}</button></div>`).join('');
    document.querySelectorAll('[data-view-class]').forEach(b=>b.onclick=()=>{document.getElementById('classFilter').value=b.dataset.viewClass;apply();setPage('students')});
  };

  window.setPage=function(p){
    currentPage=p;document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));document.getElementById(p).classList.add('active');document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===p));
    const m={students:[t('studentsTitle'),t('studentsSub')],classes:[t('classesTitle'),t('classesSub')],home:[t('homeTitle'),t('homeSub')]}[p];document.getElementById('pageTitle').textContent=m[0];document.getElementById('pageSub').textContent=m[1];
  };

  window.load=async function(){
    if(pending.size){showToast(t('waitChanges'),{error:true});return}
    document.getElementById('studentList').innerHTML=`<div class="card empty">${t('loadingStudents')}</div>`;
    const pc=document.getElementById('classFilter').value,pg=document.getElementById('gradeFilter').value,d=await api(`${API_ADMIN}?action=list_students`);students=(d.students||[]).filter(s=>s.role==='student').map(s=>({...s,class:normClass(s.class)}));buildFilters();if([...document.getElementById('classFilter').options].some(o=>o.value===pc))document.getElementById('classFilter').value=pc;if([...document.getElementById('gradeFilter').options].some(o=>o.value===pg))document.getElementById('gradeFilter').value=pg;apply();renderClasses();refreshCounts();
  };

  document.getElementById('saveEdit').onclick=()=>{if(!selected)return;const id=selected.id,before=snapshot(selected),patch={name:document.getElementById('editName').value.trim(),korean_name:document.getElementById('editKorean').value.trim(),username:document.getElementById('editUsername').value.trim(),grade:document.getElementById('editGrade').value.trim()||null,school:document.getElementById('editSchool').value.trim()||null,phone:document.getElementById('editPhone').value.trim()||null};document.getElementById('editModal').classList.remove('show');updateLocal(id,patch);saveBackground(id,{user_id:id,...patch},()=>updateLocal(id,before),t('saveFailed'))};
  document.getElementById('confirmMove').onclick=()=>{if(!selected)return;const id=selected.id,target=document.getElementById('moveTarget').value,oldClass=selected.class;if(!target||target===oldClass){document.getElementById('moveMsg').textContent=t('chooseDifferent');return}document.getElementById('moveModal').classList.remove('show');updateLocal(id,{class:target});saveBackground(id,{user_id:id,class:target},()=>updateLocal(id,{class:oldClass}),t('moveFailed'))};
  document.getElementById('confirmRemove').onclick=async()=>{if(!selected||!selected.class)return;const id=selected.id,oldClass=selected.class,student=snapshot(selected),row=document.querySelector(`[data-row-id="${CSS.escape(String(id))}"]`);document.getElementById('removeModal').classList.remove('show');if(row){row.classList.add('removing');await new Promise(r=>setTimeout(r,160))}updateLocal(id,{class:''});const request=saveBackground(id,{user_id:id,class:''},()=>updateLocal(id,{class:oldClass}),t('removeFailed'));undoState={id,oldClass,request};showToast(t('removedFrom',{name:nameOf(student),class:oldClass}),{action:t('undo'),onAction:undoRemove})};

  const studentList=document.getElementById('studentList');
  const backdrop=document.createElement('div');backdrop.className='drawer-backdrop';backdrop.id='studentDrawerBackdrop';
  const drawer=document.createElement('aside');drawer.className='student-drawer';drawer.id='studentDrawer';drawer.setAttribute('aria-hidden','true');
  document.body.append(backdrop,drawer);
  let openStudentId=null;
  const value=v=>String(v??'').trim()||'—';
  const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const field=(label,v,extra='')=>`<div class="detail ${extra}"><label>${safe(label)}</label><div>${safe(value(v))}</div></div>`;
  function renderDrawer(){
    if(!openStudentId)return;const s=findStudent(openStudentId);if(!s){closeDrawer();return}const display=nameOf(s),approved=s.approved!==false;
    drawer.innerHTML=`<div class="drawer-head"><div class="drawer-avatar">${safe((display[0]||'S').toUpperCase())}</div><div class="drawer-title"><h2>${safe(display)}</h2><p>${safe([s.korean_name,s.username].filter(Boolean).join(' · '))}</p></div><button class="drawer-close" id="drawerClose" aria-label="${safe(t('closeDetails'))}">×</button></div><div class="drawer-body"><section class="drawer-section"><h3>${t('profile')}</h3><div class="detail-grid">${field(t('englishName'),s.name)}${field(t('koreanName'),s.korean_name)}${field(t('currentClass'),s.class||t('noClass'))}${field(t('grade'),s.grade)}${field(t('school'),s.school,'full')}${field(t('phone'),s.phone,'full')}</div></section><section class="drawer-section"><h3>${t('account')}</h3><div class="detail-grid">${field(t('username'),s.username)}<div class="detail"><label>${t('status')}</label><div class="${approved?'status-good':'status-warn'}">${approved?t('approved'):t('approvalPending')}</div></div>${field(t('role'),s.role||'student')}<div class="detail full"><label>${t('accountId')}</label><div class="drawer-id">${safe(value(s.id))}</div></div></div></section><section class="drawer-section"><h3>${t('learningActivity')}</h3><div class="drawer-empty">${t('activityEmpty')}</div></section><section class="drawer-section"><h3>${t('actions')}</h3><div class="drawer-actions"><button id="drawerEdit">${t('editProfile')}</button><button id="drawerMove">${s.class?t('moveClass'):t('assignClass')}</button>${s.class?`<button class="danger" id="drawerRemove">${t('removeFromClass')}</button>`:''}</div></section></div>`;
    document.getElementById('drawerClose').onclick=closeDrawer;document.getElementById('drawerEdit').onclick=()=>{const id=openStudentId;closeDrawer();openEdit(id)};document.getElementById('drawerMove').onclick=()=>{const id=openStudentId;closeDrawer();openMove(id)};const rem=document.getElementById('drawerRemove');if(rem)rem.onclick=()=>{const id=openStudentId;closeDrawer();openRemove(id)};
  }
  function openDrawer(id){if(!findStudent(id))return;openStudentId=id;renderDrawer();backdrop.classList.add('show');drawer.classList.add('show');drawer.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
  function closeDrawer(){backdrop.classList.remove('show');drawer.classList.remove('show');drawer.setAttribute('aria-hidden','true');document.body.style.overflow='';openStudentId=null}
  studentList.addEventListener('click',e=>{if(e.target.closest('button,a,input,select'))return;const row=e.target.closest('[data-row-id]');if(row)openDrawer(row.dataset.rowId)});
  studentList.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){const row=e.target.closest('[data-row-id]');if(row){e.preventDefault();openDrawer(row.dataset.rowId)}}});
  new MutationObserver(()=>{document.querySelectorAll('.student[data-row-id]').forEach(row=>{row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('aria-label',t('openInfo'))});if(openStudentId)renderDrawer()}).observe(studentList,{childList:true,subtree:true});
  backdrop.onclick=closeDrawer;document.addEventListener('keydown',e=>{if(e.key==='Escape'&&openStudentId)closeDrawer()});document.addEventListener('willena-language-change',()=>{if(openStudentId)renderDrawer()});

  applyStatic();
})();