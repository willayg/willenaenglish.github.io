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
    .admin-account-wrap{position:relative;display:flex;align-items:center}
    .admin-burger{width:43px;height:43px;border:1px solid var(--line,#e4e9ef);border-radius:50%;background:#fff;color:var(--teal,#19777e);display:grid;place-items:center;padding:0;box-shadow:0 4px 14px rgba(24,35,52,.06)}
    .admin-burger:hover,.admin-burger:focus{background:#eef8f8;outline:2px solid #93cbcf;outline-offset:2px}
    .admin-burger span,.admin-burger span:before,.admin-burger span:after{display:block;width:18px;height:2px;background:currentColor;border-radius:2px;content:'';position:relative}
    .admin-burger span:before{position:absolute;top:-6px}.admin-burger span:after{position:absolute;top:6px}
    .admin-account-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:150;width:235px;background:#fff;border:1px solid var(--line,#e4e9ef);border-radius:15px;padding:7px;box-shadow:0 18px 48px rgba(24,35,52,.18);opacity:0;transform:translateY(-6px) scale(.98);pointer-events:none;transition:.16s ease}
    .admin-account-menu.open{opacity:1;transform:none;pointer-events:auto}
    .admin-account-menu a,.admin-account-menu button{width:100%;border:1px solid transparent;background:#fff;color:var(--teal,#19777e);border-radius:10px;padding:10px 11px;text-decoration:none;text-align:left;font-weight:700;display:flex;align-items:center;gap:9px}
    .admin-account-menu a:hover,.admin-account-menu button:hover,.admin-account-menu a:focus,.admin-account-menu button:focus{background:#f0f9f9;border-color:#d9eeee;outline:none}
    .admin-account-menu .danger{color:#a63333;border-top:1px solid #edf0f3;border-radius:0 0 10px 10px;margin-top:5px;padding-top:12px}
    @media(max-width:720px){.admin-account-menu{position:fixed;right:13px;top:68px;width:min(270px,calc(100vw - 26px))}}
  `;
  document.head.appendChild(style);

  function clearIdentity(){
    try{
      ['user_name','username','name','user_id','userId','student_id','profile_id','id','selectedEmojiAvatar','avatar','sb_access_token','sb_refresh_token'].forEach(k=>{localStorage.removeItem(k);sessionStorage.removeItem(k)});
      window.WillenaAPI?.clearLocalTokens?.();
    }catch{}
  }
  async function logout(){
    clearIdentity();
    try{await (window.WillenaAPI?.fetch||fetch)(AUTH+'?action=logout',{method:'POST',credentials:'include'});}catch{}
    try{window.dispatchEvent(new Event('auth:changed'));}catch{}
    location.href='/Teachers/login.html?redirect='+encodeURIComponent('/Teachers/admin/');
  }
  function mount(){
    const top=document.querySelector('.top');
    if(!top||document.getElementById('adminAccountMenuWrap'))return;
    const wrap=document.createElement('div');
    wrap.className='admin-account-wrap';wrap.id='adminAccountMenuWrap';
    wrap.innerHTML=`<button class="admin-burger" id="adminBurger" aria-haspopup="menu" aria-expanded="false" aria-label="${t('menu')}"><span></span></button><div class="admin-account-menu" id="adminAccountMenu" role="menu"><a role="menuitem" href="/Teachers/index.html">⌂ <span data-menu-label="home">${t('home')}</span></a><a role="menuitem" href="/Teachers/tools/curriculum-editor/books">▦ <span data-menu-label="curriculum">${t('curriculum')}</span></a><button role="menuitem" class="danger" id="adminLogout">↪ <span data-menu-label="logout">${t('logout')}</span></button></div>`;
    top.appendChild(wrap);
    const btn=wrap.querySelector('#adminBurger'),menu=wrap.querySelector('#adminAccountMenu');
    const setOpen=open=>{menu.classList.toggle('open',open);btn.setAttribute('aria-expanded',String(open));if(open)menu.querySelector('a,button')?.focus()};
    btn.onclick=e=>{e.stopPropagation();setOpen(!menu.classList.contains('open'))};
    wrap.querySelector('#adminLogout').onclick=logout;
    document.addEventListener('click',e=>{if(!wrap.contains(e.target))setOpen(false)});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){setOpen(false);btn.focus()}});
    document.addEventListener('willena-language-change',()=>{
      btn.setAttribute('aria-label',t('menu'));
      wrap.querySelector('[data-menu-label="home"]').textContent=t('home');
      wrap.querySelector('[data-menu-label="curriculum"]').textContent=t('curriculum');
      wrap.querySelector('[data-menu-label="logout"]').textContent=t('logout');
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
