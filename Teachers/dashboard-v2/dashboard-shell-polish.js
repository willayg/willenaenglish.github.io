(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
function mountSwitch(){
  const host=$('.topbar>.title');
  if(!host||$('#teacherAppSwitch'))return;
  const sw=document.createElement('div');
  sw.className='teacher-app-switch';
  sw.id='teacherAppSwitch';
  sw.setAttribute('aria-label','Teacher and admin apps');
  sw.innerHTML='<a class="active" href="/Teachers/dashboard-v2/">Teacher</a><a href="/Teachers/admin/">Admin</a>';
  host.replaceChildren(sw);
}
function mountRailToggle(){
  const rail=$('.rail'),layout=$('.layout');
  if(!rail||!layout||$('#railCollapseToggle'))return;
  const b=document.createElement('button');
  b.type='button';
  b.className='rail-collapse-toggle';
  b.id='railCollapseToggle';
  b.setAttribute('aria-label','Expand sidebar');
  b.setAttribute('aria-expanded','false');
  b.innerHTML='<span>›</span>';
  b.onclick=()=>{
    const open=layout.classList.toggle('sidebar-expanded');
    b.setAttribute('aria-expanded',String(open));
    b.setAttribute('aria-label',open?'Collapse sidebar':'Expand sidebar');
  };
  rail.prepend(b);
}
function boot(){mountSwitch();mountRailToggle()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();