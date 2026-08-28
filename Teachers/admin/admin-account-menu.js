(()=>{
  const AUTH='/.netlify/functions/supabase_auth';
  const labels={
    en:{menu:'Account menu',home:'Admin home',curriculum:'Curriculum database',logout:'Log out / switch account'},
    ko:{menu:'계정 메뉴',home:'관리자 홈',curriculum:'커리큘럼 데이터베이스',logout:'로그아웃 / 계정 전환'}
  };
  const lang=()=>window.AdminI18n?.language==='ko'?'ko':'en';
  const t=k=>labels[lang()][k];
  const style=document.createElement('style');
  style.textContent=`
    .admin-teacher-topbar{height:64px;position:fixed;inset:0 0 auto 0;z-index:90;background:#37434d;color:#fff;border-bottom:2px solid #4fb9c8;display:flex;align-items:center;padding:0 18px;gap:12px}
    .admin-teacher-brand{display:flex;align-items:center;gap:9px;min-width:190px}.admin-teacher-brand img{height:34px;max-width:48px;object-fit:contain}.admin-teacher-brand b{display:block;font-size:.94rem}.admin-teacher-brand small{display:block;font-size:.58rem;opacity:.62}
    .admin-teacher-switch-host{flex:1;display:flex;justify-content:center;align-items:center;min-width:0}.admin-teacher-actions{min-width:190px;display:flex;align-items:center;justify-content:flex-end;gap:0}
    .app{padding-top:64px;grid-template-columns:70px minmax(0,1fr)!important;transition:grid-template-columns .18s ease}.app.admin-sidebar-expanded{grid-template-columns:190px minmax(0,1fr)!important}
    .side{height:calc(100vh - 64px)!important;top:64px!important;background:#eef1f5!important;color:#596171!important;padding:8px 8px 12px!important;border-right:1px solid #dfe4e8!important;gap:7px;overflow:hidden}
    .side>.brand,.side>.who{display:none!important}.side .nav{gap:7px!important}
    .side .nav button{min-height:52px;border:0!important;background:transparent!important;color:#596171!important;border-radius:11px!important;padding:8px!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:10px!important;white-space:nowrap!important;overflow:hidden!important;box-shadow:none!important}
    .side .nav button:hover{background:#f8fafb!important;color:#343343!important}.side .nav button.active{background:#fff!important;color:#343343!important;box-shadow:0 4px 14px rgba(24,32,48,.06)!important}
    .admin-nav-icon{flex:0 0 36px;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:#f8fbfc;color:#2b7f89}.side .nav button.active .admin-nav-icon{background:#dff5f7;color:#1f7480}.admin-nav-icon svg{width:23px;height:23px;display:block;stroke:currentColor;stroke-width:2.2;fill:none}.admin-nav-label{display:none;font-weight:700;font-size:.75rem}.app.admin-sidebar-expanded .side .nav button{justify-content:flex-start;padding:8px 11px!important}.app.admin-sidebar-expanded .admin-nav-label{display:inline}
    .admin-rail-toggle{width:40px;height:36px;border:0;background:#fff;color:#2b7f89;border-radius:9px;display:grid;place-items:center;cursor:pointer;margin:0 auto 3px;font-size:1rem;line-height:1;box-shadow:0 3px 10px rgba(24,32,48,.05)}.admin-rail-toggle:hover{background:#ebf9fb}.admin-rail-toggle span{display:block;transition:transform .18s ease}.app.admin-sidebar-expanded .admin-rail-toggle{margin-left:auto;margin-right:0}.app.admin-sidebar-expanded .admin-rail-toggle span{transform:rotate(180deg)}
    .main{padding:20px 28px 40px!important}.main>.top{margin:1px 0 16px!important;display:flex!important;align-items:center!important;gap:12px!important}.main>.top .badge-user{display:none!important}
    .admin-account-wrap{position:relative;display:flex;align-items:center}
    .admin-burger{width:40px;height:40px;border:0;border-radius:0 14px 14px 0;background:#4fb9c8;color:#fff;display:grid;place-items:center;padding:0;box-shadow:none}
    .admin-burger:hover,.admin-burger:focus{background:#3aa9b8;outline:none}
    .admin-burger span,.admin-burger span:before,.admin-burger span:after{display:block;width:18px;height:2px;background:currentColor;border-radius:2px;content:'';position:relative}.admin-burger span:before{position:absolute;top:-6px}.admin-burger span:after{position:absolute;top:6px}
    .admin-account-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:150;width:235px;background:#fff;border:1px solid var(--line,#e4e9ef);border-radius:15px;padding:7px;box-shadow:0 18px 48px rgba(24,35,52,.18);opacity:0;transform:translateY(-6px) scale(.98);pointer-events:none;transition:.16s ease}
    .admin-account-menu.open{opacity:1;transform:none;pointer-events:auto}.admin-account-menu a,.admin-account-menu button{width:100%;border:1px solid transparent;background:#fff;color:var(--teal,#19777e);border-radius:10px;padding:10px 11px;text-decoration:none;text-align:left;font-weight:700;display:flex;align-items:center;gap:9px}.admin-account-menu a:hover,.admin-account-menu button:hover,.admin-account-menu a:focus,.admin-account-menu button:focus{background:#f0f9f9;border-color:#d9eeee;outline:none}.admin-account-menu .danger{color:#a63333;border-top:1px solid #edf0f3;border-radius:0 0 10px 10px;margin-top:5px;padding-top:12px}
    .admin-app-switch{display:flex;align-items:center;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:3px;gap:2px;white-space:nowrap}.admin-app-switch a{display:block;text-decoration:none;color:#dce3e7;padding:6px 11px;border-radius:999px;font-size:.68rem;font-weight:700;line-height:1}.admin-app-switch a.active{background:#fff;color:#343343;box-shadow:0 2px 7px rgba(0,0,0,.12)}.admin-app-switch a:not(.active):hover{color:#fff;background:rgba(255,255,255,.08)}
    .admin-user-pill{display:flex;align-items:center;height:40px;padding:0 13px;border-radius:14px 0 0 14px;background:#fff;color:#37434d;font-size:.72rem;font-weight:700}.admin-account-wrap{margin-left:0}.admin-teacher-actions{border-radius:14px;background:#fff;overflow:visible}.admin-teacher-actions .admin-account-wrap{display:flex}.admin-teacher-actions .admin-burger{border-left:1px solid rgba(255,255,255,.28)}
    @media(max-width:720px){.admin-teacher-topbar{height:62px;padding:0 10px}.admin-teacher-brand{min-width:auto}.admin-teacher-brand div{display:none}.admin-teacher-switch-host{justify-content:flex-end}.admin-teacher-actions{min-width:auto}.admin-user-pill{display:none}.admin-app-switch{display:none}.app{padding-top:62px;display:block!important}.side{display:none!important}.main{padding:14px 10px 82px!important}.admin-account-menu{position:fixed;right:10px;top:68px;width:min(270px,calc(100vw - 20px))}.admin-burger{border-radius:14px}.main>.top{align-items:flex-start!important;flex-wrap:wrap!important}}
  `;
  document.head.appendChild(style);

  const icons={
    students:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/></svg>',
    classes:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v16M16 4v16M4 9h16M4 15h16"/></svg>',
    levelTests:'<svg viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    home:'<svg viewBox="0 0 24 24"><path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4z"/></svg>'
  };

  function prefetchTeacher(){if(document.getElementById('prefetchTeacherDashboard'))return;const l=document.createElement('link');l.id='prefetchTeacherDashboard';l.rel='prefetch';l.as='document';l.href='/Teachers/dashboard-v2/';document.head.appendChild(l)}
  function buildShell(){
    const app=document.querySelector('.app'),side=document.querySelector('.side'),oldTop=document.querySelector('.main>.top');
    if(!app||!side||!oldTop||document.querySelector('.admin-teacher-topbar'))return null;
    const header=document.createElement('header');header.className='admin-teacher-topbar';
    header.innerHTML='<div class="admin-teacher-brand"><img src="/Assets/Images/Logo.png" alt="Willena"><div><b>Willena</b><small>Admin workspace</small></div></div><div class="admin-teacher-switch-host" id="adminTeacherSwitchHost"></div><div class="admin-teacher-actions" id="adminTeacherActions"><span class="admin-user-pill" id="adminTopUser">Admin</span></div>';
    document.body.insertBefore(header,app);
    document.querySelectorAll('.side .nav button').forEach(btn=>{const key=btn.dataset.page;if(!icons[key])return;const label=(btn.textContent||'').replace(/^[^A-Za-z가-힣]+/,'').trim();btn.innerHTML=`<span class="admin-nav-icon">${icons[key]}</span><span class="admin-nav-label">${label}</span>`});
    if(!document.getElementById('adminRailToggle')){const b=document.createElement('button');b.type='button';b.id='adminRailToggle';b.className='admin-rail-toggle';b.setAttribute('aria-label','Expand sidebar');b.innerHTML='<span>›</span>';b.onclick=()=>{const open=app.classList.toggle('admin-sidebar-expanded');b.setAttribute('aria-label',open?'Collapse sidebar':'Expand sidebar')};side.prepend(b)}
    return header;
  }
  function clearIdentity(){try{['user_name','username','name','user_id','userId','student_id','profile_id','id','selectedEmojiAvatar','avatar','sb_access_token','sb_refresh_token'].forEach(k=>{localStorage.removeItem(k);sessionStorage.removeItem(k)});window.WillenaAPI?.clearLocalTokens?.();window.WillenaAPI?.clearAdminStudentCache?.()}catch{}}
  async function logout(){clearIdentity();try{await (window.WillenaAPI?.fetch||fetch)(AUTH+'?action=logout',{method:'POST',credentials:'include'})}catch{}try{window.dispatchEvent(new Event('auth:changed'))}catch{}location.href='/Teachers/login.html?redirect='+encodeURIComponent('/Teachers/admin/')}
  function mount(){
    const header=buildShell();
    const oldTop=document.querySelector('.main>.top');if(!oldTop||document.getElementById('adminAccountMenuWrap'))return;
    prefetchTeacher();
    const switchHost=document.getElementById('adminTeacherSwitchHost')||oldTop;
    if(!document.getElementById('adminAppSwitch')){const sw=document.createElement('div');sw.className='admin-app-switch';sw.id='adminAppSwitch';sw.setAttribute('aria-label','Teacher and admin apps');sw.innerHTML='<a id="teacherSwitchLink" href="/Teachers/dashboard-v2/">Teacher</a><a class="active" href="/Teachers/admin/">Admin</a>';switchHost.appendChild(sw);sw.querySelector('#teacherSwitchLink')?.addEventListener('pointerenter',prefetchTeacher,{once:true})}
    const wrap=document.createElement('div');wrap.className='admin-account-wrap';wrap.id='adminAccountMenuWrap';wrap.innerHTML=`<button class="admin-burger" id="adminBurger" aria-haspopup="menu" aria-expanded="false" aria-label="${t('menu')}"><span></span></button><div class="admin-account-menu" id="adminAccountMenu" role="menu"><a role="menuitem" href="/Teachers/index.html">⌂ <span data-menu-label="home">${t('home')}</span></a><a role="menuitem" href="/Teachers/tools/curriculum-editor/books">▦ <span data-menu-label="curriculum">${t('curriculum')}</span></a><button role="menuitem" class="danger" id="adminLogout">↪ <span data-menu-label="logout">${t('logout')}</span></button></div>`;
    (document.getElementById('adminTeacherActions')||oldTop).appendChild(wrap);
    const topUser=document.getElementById('adminTopUser'),adminName=document.getElementById('adminName');if(topUser&&adminName){const syncName=()=>topUser.textContent=(adminName.textContent||'Admin');syncName();new MutationObserver(syncName).observe(adminName,{childList:true,subtree:true,characterData:true})}
    const btn=wrap.querySelector('#adminBurger'),menu=wrap.querySelector('#adminAccountMenu');const setOpen=open=>{menu.classList.toggle('open',open);btn.setAttribute('aria-expanded',String(open));if(open)menu.querySelector('a,button')?.focus()};btn.onclick=e=>{e.stopPropagation();setOpen(!menu.classList.contains('open'))};wrap.querySelector('#adminLogout').onclick=logout;document.addEventListener('click',e=>{if(!wrap.contains(e.target))setOpen(false)});document.addEventListener('keydown',e=>{if(e.key==='Escape'){setOpen(false);btn.focus()}});document.addEventListener('willena-language-change',()=>{btn.setAttribute('aria-label',t('menu'));wrap.querySelector('[data-menu-label="home"]').textContent=t('home');wrap.querySelector('[data-menu-label="curriculum"]').textContent=t('curriculum');wrap.querySelector('[data-menu-label="logout"]').textContent=t('logout')});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
