import { ensureTeacherSession } from '/Teachers/auth-refresh.js?v=20260917-adminv2-p1';

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const FN=name=>`/.netlify/functions/${name}`;

function loginUrl(){return `/Teachers/login.html?redirect=${encodeURIComponent(location.pathname+location.search)}`}

async function api(path,options={}){
  const fn=window.WillenaAPI?.fetch||window.fetch.bind(window);
  const response=await fn(path,{credentials:'include',cache:'no-store',...options});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data?.success===false)throw new Error(data?.error||`Request failed (${response.status})`);
  return data;
}

async function authorizeAdmin(){
  const session=await ensureTeacherSession();
  if(!session?.user_id){location.replace(loginUrl());return false}
  try{
    const data=await api(`${FN('supabase_auth')}?action=get_profile&user_id=${encodeURIComponent(session.user_id)}`);
    const profile=data.profile||data.student||data;
    const role=String(profile?.role||'').toLowerCase();
    if(role!=='admin'||profile?.approved===false){location.replace('/Teachers/dashboard-v2/');return false}
    const name=profile.name||profile.username||'Admin';
    $('#adminName').textContent=name;
    try{
      localStorage.setItem('userId',session.user_id);
      localStorage.setItem('userRole',role);
    }catch{}
    return true;
  }catch(error){
    console.error('[Admin V2] authorization failed',error);
    location.replace(loginUrl());
    return false;
  }
}

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

async function mountBurger(){
  try{
    if(!document.getElementById('burger-menu-template')){
      const response=await fetch('/components/burger-menu.html?v=20260917-r14-07',{cache:'force-cache'});
      const wrapper=document.createElement('div');
      wrapper.innerHTML=await response.text();
      if(wrapper.firstElementChild)document.body.appendChild(wrapper.firstElementChild);
    }
    const mod=await import('/components/burger-menu.js?v=20260917-r14-07');
    mod.insertBurgerMenu('#burger-menu-mount');
  }catch(error){
    console.warn('[Admin V2] shared burger menu failed',error);
  }
}

async function boot(){
  bindNavigation();
  const authorized=await authorizeAdmin();
  if(!authorized)return;
  $('#adminV2Boot').classList.add('hidden');
  // Shared account/notification component is non-blocking for the Admin shell.
  mountBurger();
}

boot();
