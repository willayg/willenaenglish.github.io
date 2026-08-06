(()=>{
  const translations={
    ko:{
      'app.title':'윌레나 관리자','app.subtitle':'학생 관리','role.admin':'관리자',
      'nav.students':'학생','nav.classes':'반 관리','nav.home':'홈',
      'page.students.title':'학생','page.students.sub':'학생 정보와 반 배정을 관리합니다.',
      'page.classes.title':'반 관리','page.classes.sub':'15개 반의 학생 현황을 확인합니다.',
      'page.home.title':'홈','page.home.sub':'빠른 현황 기능은 추후 추가됩니다.',
      'notice.students':'변경 사항은 화면에 즉시 반영되고 백그라운드에서 저장됩니다. 문제가 생길 때만 알려드립니다.',
      'notice.classes':'반별 학생 수는 즉시 반영되고 변경 사항은 백그라운드에서 저장됩니다.',
      'home.empty':'홈 화면은 추후 업데이트됩니다.',
      'search.placeholder':'학생 검색','filter.allClasses':'전체 반','filter.noClass':'미배정','filter.allGrades':'전체 학년','button.refresh':'새로고침',
      'count.shown':'명 표시','count.students':'명 학생','count.noClass':'명 미배정',
      'loading.checking':'관리자 권한 확인 중…','loading.students':'학생 불러오는 중…','loading.list':'학생을 불러오는 중…',
      'empty.students':'검색 결과가 없습니다.','student.noClass':'미배정','student.noGrade':'학년 없음','student.approved':'승인됨','student.pendingApproval':'승인 대기',
      'button.edit':'수정','button.move':'반 이동','button.assign':'반 배정','button.remove':'반에서 제외','button.viewRoster':'명단 보기',
      'class.students':'명',
      'modal.edit.title':'학생 정보 수정','field.englishName':'영어 이름','field.koreanName':'한국 이름','field.username':'아이디','field.grade':'학년','field.school':'학교','field.phone':'전화번호',
      'button.cancel':'취소','button.save':'저장','modal.move.title':'학생 반 이동','field.currentClass':'현재 반','field.moveTo':'이동할 반','button.moveStudent':'이동',
      'modal.remove.title':'반에서 학생 제외','modal.remove.sentence':'{name} 학생을 {className} 반에서 제외합니다.','modal.remove.help':'계정과 학습 기록은 유지되며 현재 반 배정만 해제됩니다.',
      'error.wait':'현재 변경 사항이 저장될 때까지 잠시 기다려 주세요.','error.chooseDifferent':'다른 반을 선택해 주세요.',
      'error.save':'학생 정보를 저장하지 못했습니다','error.move':'학생을 이동하지 못했습니다','error.remove':'학생을 반에서 제외하지 못했습니다','error.undo':'실행 취소에 실패했습니다',
      'toast.removed':'{name} 학생을 {className} 반에서 제외했습니다.','button.undo':'실행 취소',
      'drawer.profile':'학생 정보','drawer.account':'계정','drawer.activity':'학습 활동','drawer.actions':'관리',
      'drawer.activityEmpty':'레벨 테스트 결과, 숙제 활동, 게임 진도는 아직 이 화면과 연결되지 않았습니다. 다음 데이터 단계에서 연결할 예정입니다.',
      'drawer.status':'상태','drawer.role':'역할','drawer.accountId':'계정 ID','drawer.edit':'정보 수정','drawer.move':'반 이동','drawer.assign':'반 배정','drawer.remove':'반에서 제외','drawer.close':'학생 정보 닫기',
      'value.none':'—'
    },
    en:{
      'app.title':'Willena Admin','app.subtitle':'Student operations','role.admin':'Administrator',
      'nav.students':'Students','nav.classes':'Classes','nav.home':'Home',
      'page.students.title':'Students','page.students.sub':'Live student profiles and class management.',
      'page.classes.title':'Classes','page.classes.sub':'15 canonical classes with live rosters.',
      'page.home.title':'Home','page.home.sub':'Quick updates will come later.',
      'notice.students':'Changes appear immediately and save quietly in the background. You will only be notified if something fails.',
      'notice.classes':'Class counts update immediately while changes save in the background.',
      'home.empty':'Home updates will be designed later.',
      'search.placeholder':'Search students','filter.allClasses':'All classes','filter.noClass':'No class','filter.allGrades':'All grades','button.refresh':'Refresh',
      'count.shown':'shown','count.students':'students','count.noClass':'no class',
      'loading.checking':'Checking admin access…','loading.students':'Loading students…','loading.list':'Loading students…',
      'empty.students':'No students found.','student.noClass':'No class','student.noGrade':'No grade','student.approved':'Approved','student.pendingApproval':'Approval pending',
      'button.edit':'Edit','button.move':'Move','button.assign':'Assign','button.remove':'Remove','button.viewRoster':'View roster','class.students':'students',
      'modal.edit.title':'Edit student','field.englishName':'English name','field.koreanName':'Korean name','field.username':'Username','field.grade':'Grade','field.school':'School','field.phone':'Phone',
      'button.cancel':'Cancel','button.save':'Save changes','modal.move.title':'Move student','field.currentClass':'Current class','field.moveTo':'Move to','button.moveStudent':'Move student',
      'modal.remove.title':'Remove from class','modal.remove.sentence':'{name} will be removed from {className}.','modal.remove.help':'The account and records remain. Only the current class is cleared.',
      'error.wait':'Please wait for current changes to finish.','error.chooseDifferent':'Choose a different class.',
      'error.save':'Could not save student changes','error.move':'Could not move student','error.remove':'Could not remove student','error.undo':'Could not undo',
      'toast.removed':'{name} removed from {className}','button.undo':'Undo',
      'drawer.profile':'Student profile','drawer.account':'Account','drawer.activity':'Learning activity','drawer.actions':'Actions',
      'drawer.activityEmpty':'Level-test results, homework activity and game progress are not connected to this view yet. This section is reserved for the next data phase.',
      'drawer.status':'Status','drawer.role':'Role','drawer.accountId':'Account ID','drawer.edit':'Edit profile','drawer.move':'Move class','drawer.assign':'Assign class','drawer.remove':'Remove from class','drawer.close':'Close student details','value.none':'—'
    }
  };

  let lang=localStorage.getItem('willenaAdminLanguage')||'ko';
  if(!translations[lang])lang='ko';
  const t=(key,vars={})=>{
    let text=(translations[lang]&&translations[lang][key])||translations.en[key]||key;
    return text.replace(/\{(\w+)\}/g,(_,name)=>vars[name]??'');
  };
  const setText=(selector,key)=>{const el=document.querySelector(selector);if(el)el.textContent=t(key)};

  function applyStatic(){
    document.documentElement.lang=lang;
    document.title=t('app.title');
    const brand=document.querySelector('.brand div');
    if(brand){const b=brand.querySelector('b'),s=brand.querySelector('small');if(b)b.textContent=t('app.title');if(s)s.textContent=t('app.subtitle')}
    document.querySelectorAll('[data-page="students"]').forEach(el=>el.textContent='◎ '+t('nav.students'));
    document.querySelectorAll('[data-page="classes"]').forEach(el=>el.textContent='▦ '+t('nav.classes'));
    document.querySelectorAll('[data-page="home"]').forEach(el=>el.textContent='⌂ '+t('nav.home'));
    const who=document.querySelector('.who small');if(who)who.textContent=t('role.admin');
    const notices=document.querySelectorAll('.notice');if(notices[0])notices[0].textContent=t('notice.students');if(notices[1])notices[1].textContent=t('notice.classes');
    const home=document.querySelector('#home .empty');if(home)home.textContent=t('home.empty');
    const search=document.getElementById('searchBox');if(search)search.placeholder=t('search.placeholder');
    setText('#refreshBtn','button.refresh');
    const sums=document.querySelectorAll('.summary span');if(sums[0])sums[0].lastChild.textContent=' '+t('count.shown');if(sums[1])sums[1].lastChild.textContent=' '+t('count.students');if(sums[2])sums[2].lastChild.textContent=' '+t('count.noClass');
    setText('#editModal .modal-head h3','modal.edit.title');
    const editLabels=document.querySelectorAll('#editModal label');['field.englishName','field.koreanName','field.username','field.grade','field.school','field.phone'].forEach((k,i)=>{if(editLabels[i])editLabels[i].textContent=t(k)});
    const editButtons=document.querySelectorAll('#editModal .modal-foot button');if(editButtons[0])editButtons[0].textContent=t('button.cancel');if(editButtons[1])editButtons[1].textContent=t('button.save');
    setText('#moveModal .modal-head h3','modal.move.title');
    const moveLabels=document.querySelectorAll('#moveModal label');if(moveLabels[0])moveLabels[0].textContent=t('field.currentClass');if(moveLabels[1])moveLabels[1].textContent=t('field.moveTo');
    const moveButtons=document.querySelectorAll('#moveModal .modal-foot button');if(moveButtons[0])moveButtons[0].textContent=t('button.cancel');if(moveButtons[1])moveButtons[1].textContent=t('button.moveStudent');
    setText('#removeModal .modal-head h3','modal.remove.title');
    const removeHelp=document.querySelector('#removeModal .modal-body .mut');if(removeHelp)removeHelp.textContent=t('modal.remove.help');
    const removeButtons=document.querySelectorAll('#removeModal .modal-foot button');if(removeButtons[0])removeButtons[0].textContent=t('button.cancel');if(removeButtons[1])removeButtons[1].textContent=t('button.remove');
    const langButtons=document.querySelectorAll('.lang button');
    langButtons.forEach((b,i)=>{const code=i===0?'en':'ko';b.dataset.lang=code;b.classList.toggle('active',code===lang);b.onclick=()=>setLanguage(code)});
    if(typeof setPage==='function')setPage(currentPage||'students');
    if(typeof buildFilters==='function')buildFilters();
    if(typeof apply==='function')apply();
    if(typeof renderClasses==='function')renderClasses();
    window.dispatchEvent(new CustomEvent('adminlanguagechange',{detail:{lang}}));
  }

  function setLanguage(next){if(!translations[next]||next===lang)return;lang=next;localStorage.setItem('willenaAdminLanguage',lang);applyStatic()}

  window.AdminI18n={t,setLanguage,getLanguage:()=>lang,translations};
  window.t=t;

  if(typeof buildFilters==='function'){
    buildFilters=function(){
      const cf=document.getElementById('classFilter'),gf=document.getElementById('gradeFilter'),mt=document.getElementById('moveTarget');
      const currentClass=cf?.value||'',currentGrade=gf?.value||'';
      if(cf)cf.innerHTML=`<option value="">${t('filter.allClasses')}</option><option value="__none__">${t('filter.noClass')}</option>`+canonical.map(c=>`<option>${c}</option>`).join('');
      const grades=[...new Set(students.map(s=>s.grade).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));
      if(gf)gf.innerHTML=`<option value="">${t('filter.allGrades')}</option>`+grades.map(g=>`<option>${esc(g)}</option>`).join('');
      if(mt)mt.innerHTML=canonical.map(c=>`<option>${c}</option>`).join('');
      if(cf&&[...cf.options].some(o=>o.value===currentClass))cf.value=currentClass;
      if(gf&&[...gf.options].some(o=>o.value===currentGrade))gf.value=currentGrade;
    };
  }

  if(typeof renderStudents==='function'){
    renderStudents=function(){
      const list=document.getElementById('studentList');
      if(!filtered.length){list.innerHTML=`<div class="card empty">${t('empty.students')}</div>`;return}
      list.innerHTML=filtered.map(s=>{const n=nameOf(s),p=pending.has(String(s.id))?' pending':'';return`<div class="card student${p}" data-row-id="${esc(s.id)}"><div class="person"><div class="ava">${esc(n[0].toUpperCase())}</div><div><b>${esc(n)}</b><div class="mut">${esc(s.korean_name||'')} ${s.username?'· '+esc(s.username):''}</div></div></div><div class="mobile-hide"><span class="pill">${esc(s.class||t('student.noClass'))}</span><div class="mut">${esc(s.grade||t('student.noGrade'))}</div></div><div class="optional"><b>${esc(s.school||'')}</b><div class="mut">${s.approved?t('student.approved'):t('student.pendingApproval')}</div></div><div class="actions-inline"><button class="link" data-edit="${esc(s.id)}">${t('button.edit')}</button><button class="link" data-move="${esc(s.id)}">${s.class?t('button.move'):t('button.assign')}</button>${s.class?`<button class="link danger" data-remove="${esc(s.id)}">${t('button.remove')}</button>`:''}</div></div>`}).join('');
      document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=e=>{e.stopPropagation();openEdit(b.dataset.edit)});
      document.querySelectorAll('[data-move]').forEach(b=>b.onclick=e=>{e.stopPropagation();openMove(b.dataset.move)});
      document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=e=>{e.stopPropagation();openRemove(b.dataset.remove)});
    };
  }

  if(typeof renderClasses==='function'){
    renderClasses=function(){const counts=Object.fromEntries(canonical.map(c=>[c,0]));students.forEach(s=>{if(counts[s.class]!==undefined)counts[s.class]++});document.getElementById('classGrid').innerHTML=canonical.map(c=>`<div class="card class-card"><h3>${c}</h3><div class="count">${counts[c]}</div><div class="mut">${t('class.students')}</div><button data-view-class="${c}">${t('button.viewRoster')}</button></div>`).join('');document.querySelectorAll('[data-view-class]').forEach(b=>b.onclick=()=>{document.getElementById('classFilter').value=b.dataset.viewClass;apply();setPage('students')})};
  }

  if(typeof setPage==='function'){
    setPage=function(p){currentPage=p;document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));document.getElementById(p).classList.add('active');document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===p));const keys={students:['page.students.title','page.students.sub'],classes:['page.classes.title','page.classes.sub'],home:['page.home.title','page.home.sub']}[p];document.getElementById('pageTitle').textContent=t(keys[0]);document.getElementById('pageSub').textContent=t(keys[1])};
  }

  if(typeof openMove==='function'){
    const originalOpenMove=openMove;openMove=function(id){originalOpenMove(id);const s=findStudent(id);if(s)document.getElementById('moveCurrent').value=s.class||t('student.noClass')};
  }
  if(typeof openRemove==='function'){
    const originalOpenRemove=openRemove;openRemove=function(id){originalOpenRemove(id);const s=findStudent(id);if(s){const p=document.querySelector('#removeModal .modal-body p:first-child');if(p)p.innerHTML=t('modal.remove.sentence',{name:`<b>${esc(nameOf(s))}</b>`,className:`<b>${esc(s.class)}</b>`})}};
  }

  setTimeout(applyStatic,0);
})();