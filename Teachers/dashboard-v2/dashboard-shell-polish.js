(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
function ensureCss(){if($('#dashboardV2Css'))return;const l=document.createElement('link');l.id='dashboardV2Css';l.rel='stylesheet';l.href='./dashboard-v2.css?v=20260828-command3';document.head.appendChild(l)}
function tidy(){
  const note=$('.rail-note');if(note)note.remove();
  const add=$('#naFreshCreate');if(add&&add.textContent.trim()!=='+ 시험 추가')add.textContent='+ 시험 추가';
  ['#view-students .page-head p','#view-classes .page-head p','#view-apps .page-head p','#view-naesin .na-fresh-head p'].forEach(s=>{const n=$(s);if(n)n.remove()});
  const status=$('#statusText');if(status&&/Cloudflare|teacher insights|Study V2 evidence/i.test(status.textContent||''))status.textContent='';
}
function mountSwitch(){const host=$('.topbar>.title');if(!host)return;let sw=$('#teacherAppSwitch');if(!sw){sw=document.createElement('div');sw.className='teacher-app-switch';sw.id='teacherAppSwitch';sw.setAttribute('aria-label','Teacher and admin apps');sw.innerHTML='<a class="active" href="/Teachers/dashboard-v2/">Teacher</a><a href="/Teachers/admin/">Admin</a>'}if(sw.parentElement!==host)host.replaceChildren(sw)}
function mountRailToggle(){const rail=$('.rail'),layout=$('.layout');if(!rail||!layout||$('#railCollapseToggle'))return;const b=document.createElement('button');b.type='button';b.className='rail-collapse-toggle';b.id='railCollapseToggle';b.setAttribute('aria-label','Expand sidebar');b.setAttribute('aria-expanded','false');b.innerHTML='<span>›</span>';b.onclick=()=>{const open=layout.classList.toggle('sidebar-expanded');b.setAttribute('aria-expanded',String(open));b.setAttribute('aria-label',open?'Collapse sidebar':'Expand sidebar')};rail.prepend(b)}
let raf=0;function scan(){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{ensureCss();tidy();mountSwitch();mountRailToggle()})}
function boot(){scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true,characterData:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();