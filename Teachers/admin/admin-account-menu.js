(()=>{
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
    .admin-app-switch{display:flex;align-items:center;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:3px;gap:2px;white-space:nowrap}.admin-app-switch a{display:block;text-decoration:none;color:#dce3e7;padding:6px 11px;border-radius:999px;font-size:.68rem;font-weight:700;line-height:1}.admin-app-switch a.active{background:#fff;color:#343343;box-shadow:0 2px 7px rgba(0,0,0,.12)}.admin-app-switch a:not(.active):hover{color:#fff;background:rgba(255,255,255,.08)}
    .admin-teacher-actions .burger-menu{position:relative!important;top:auto!important;right:auto!important;left:auto!important;bottom:auto!important;z-index:100!important;display:flex!important;align-items:stretch!important;gap:0!important;border-radius:14px!important;background:#fff!important;box-shadow:none!important;border:1px solid rgba(255,255,255,.16)!important;overflow:visible!important;margin:0!important}
    .admin-teacher-actions .burger-user-label{display:flex!important;height:40px!important;padding:0 13px!important;border:0!important;border-radius:14px 0 0 14px!important;background:#fff!important;color:#37434d!important;box-shadow:none!important;font-size:.72rem!important}
    .admin-teacher-actions .hw-notif-wrap,.admin-teacher-actions .burger-dropdown-wrap{display:flex!important;margin:0!important}
    .admin-teacher-actions .hw-notif-btn,.admin-teacher-actions .burger-btn{width:40px!important;height:40px!important;margin:0!important;border-radius:0!important;background:#4fb9c8!important;color:#fff!important;box-shadow:none!important;border:0!important}
    .admin-teacher-actions .hw-notif-btn{border-left:1px solid rgba(255,255,255,.28)!important}.admin-teacher-actions .burger-btn{border-left:1px solid rgba(255,255,255,.28)!important;border-radius:0 14px 14px 0!important}.admin-teacher-actions .hw-notif-btn:hover,.admin-teacher-actions .burger-btn:hover{background:#3aa9b8!important}.admin-teacher-actions .burger-dropdown{top:calc(100% + 7px)!important;right:0!important}
    .admin-bottom-lang{margin:120px auto 18px!important;width:max-content!important;opacity:.58!important;order:99}.admin-bottom-lang:hover{opacity:1!important}
    @media(max-width:720px){
      .admin-teacher-topbar{height:62px;padding:0 10px;gap:8px}.admin-teacher-brand{min-width:auto}.admin-teacher-brand img{height:32px}.admin-teacher-brand div{display:none}.admin-teacher-switch-host{justify-content:center;flex:1}.admin-teacher-actions{min-width:auto}.admin-app-switch{display:flex}.admin-app-switch a{padding:6px 8px;font-size:.62rem}
      .admin-teacher-actions .burger-user-label{display:none!important}.admin-teacher-actions .hw-notif-btn,.admin-teacher-actions .burger-btn{width:34px!important;height:34px!important}.admin-teacher-actions .hw-notif-btn{border-radius:14px 0 0 14px!important}.admin-teacher-actions .burger-btn{border-radius:0 14px 14px 0!important}.admin-teacher-actions .burger-menu{border-radius:14px!important}
      .app{padding-top:62px;display:block!important}.side{display:none!important}.main{padding:14px 10px 82px!important}.main>.top{align-items:flex-start!important;flex-wrap:wrap!important}.admin-bottom-lang{margin:140px auto 90px!important}.admin-teacher-actions .burger-dropdown{position:fixed!important;right:10px!important;top:68px!important;width:min(270px,calc(100vw - 20px))!important}
    }
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
    const app=document.querySelector('.app'),side=document.querySelector('.side'),oldTop=document.querySelector('.main>.top'),main=document.querySelector('.main');
    if(!app||!side||!oldTop||!main||document.querySelector('.admin-teacher-topbar'))return null;
    const header=document.createElement('header');header.className='admin-teacher-topbar';
    header.innerHTML='<div class="admin-teacher-brand"><img src="/Assets/Images/Logo.png" alt="Willena"><div><b>Willena</b><small>Admin workspace</small></div></div><div class="admin-teacher-switch-host" id="adminTeacherSwitchHost"></div><div class="admin-teacher-actions" id="adminTeacherActions"></div>';
    document.body.insertBefore(header,app);
    document.querySelectorAll('.side .nav button').forEach(btn=>{const key=btn.dataset.page;if(!icons[key])return;const label=(btn.textContent||'').replace(/^[^A-Za-z가-힣]+/,'').trim();btn.innerHTML=`<span class="admin-nav-icon">${icons[key]}</span><span class="admin-nav-label">${label}</span>`});
    if(!document.getElementById('adminRailToggle')){const b=document.createElement('button');b.type='button';b.id='adminRailToggle';b.className='admin-rail-toggle';b.setAttribute('aria-label','Expand sidebar');b.innerHTML='<span>›</span>';b.onclick=()=>{const open=app.classList.toggle('admin-sidebar-expanded');b.setAttribute('aria-label',open?'Collapse sidebar':'Expand sidebar')};side.prepend(b)}
    const lang=oldTop.querySelector('.lang');if(lang){lang.classList.add('admin-bottom-lang');main.appendChild(lang)}
    return header;
  }
  function clearIdentity(){try{['user_name','username','name','user_id','userId','student_id','profile_id','id','selectedEmojiAvatar','avatar','sb_access_token','sb_refresh_token'].forEach(k=>{localStorage.removeItem(k);sessionStorage.removeItem(k)});window.WillenaAPI?.clearLocalTokens?.();window.WillenaAPI?.clearAdminStudentCache?.()}catch{}}
  async function logout(){clearIdentity();try{await (window.WillenaAPI?.fetch||fetch)('/.netlify/functions/supabase_auth?action=logout',{method:'POST',credentials:'include'})}catch{}try{window.dispatchEvent(new Event('auth:changed'))}catch{}location.href='/Teachers/login.html?redirect='+encodeURIComponent('/Teachers/admin/')}
  async function mountSharedBurger(){
    const host=document.getElementById('adminTeacherActions');if(!host||host.querySelector('.burger-menu'))return;
    try{
      if(!document.getElementById('burger-menu-template')){const r=await fetch('/components/burger-menu.html?v=20260330d');const w=document.createElement('div');w.innerHTML=await r.text();if(w.firstElementChild)document.body.appendChild(w.firstElementChild)}
      const mod=await import('/components/burger-menu.js?v=20260829-adminshell1');
      mod.insertBurgerMenu('#adminTeacherActions');
      const menu=host.querySelector('.burger-dropdown');
      if(menu&&!menu.querySelector('[data-admin-curriculum]')){
        const curriculum=document.createElement('a');curriculum.href='/Teachers/tools/curriculum-editor/books';curriculum.dataset.adminCurriculum='1';curriculum.textContent='Curriculum Database';menu.insertBefore(curriculum,menu.firstChild||null);
        const adminHome=document.createElement('a');adminHome.href='/Teachers/admin/';adminHome.textContent='Admin Dashboard';menu.insertBefore(adminHome,menu.firstChild||null);
        const logoutBtn=document.createElement('a');logoutBtn.href='#';logoutBtn.textContent='Log out / switch account';logoutBtn.onclick=e=>{e.preventDefault();logout()};menu.appendChild(logoutBtn);
      }
    }catch(e){console.warn('[Admin shell] Shared burger failed',e)}
  }
  function mount(){
    buildShell();
    const oldTop=document.querySelector('.main>.top');if(!oldTop)return;
    prefetchTeacher();
    const switchHost=document.getElementById('adminTeacherSwitchHost')||oldTop;
    if(!document.getElementById('adminAppSwitch')){const sw=document.createElement('div');sw.className='admin-app-switch';sw.id='adminAppSwitch';sw.setAttribute('aria-label','Teacher and admin apps');sw.innerHTML='<a id="teacherSwitchLink" href="/Teachers/dashboard-v2/">Teacher</a><a class="active" href="/Teachers/admin/">Admin</a>';switchHost.appendChild(sw);sw.querySelector('#teacherSwitchLink')?.addEventListener('pointerenter',prefetchTeacher,{once:true})}
    mountSharedBurger();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
