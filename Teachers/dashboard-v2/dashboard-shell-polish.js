(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
function inject(){if($('#dashboardShellPolish'))return;const s=document.createElement('style');s.id='dashboardShellPolish';s.textContent=`
:root{--shell:#37434d!important;--cyan:#4fb9c8!important}

/* compact, quieter page heads */
#view-students .page-head,#view-classes .page-head,#view-naesin .na-fresh-head{align-items:center!important;margin-bottom:16px!important;gap:14px!important}
#view-students .page-head h1,#view-classes .page-head h1,#view-naesin .na-fresh-head h1{font-size:1.48rem!important;line-height:1.15!important;letter-spacing:-.02em!important}
#view-students .page-head p,#view-classes .page-head p,#view-naesin .na-fresh-head p{display:none!important}
#view-students .filters,#view-classes .filters{margin-left:auto!important}
#view-naesin .na-add{margin-left:auto!important;background:#fff!important;color:#287b85!important;border:2px solid #4fb9c8!important;border-radius:12px!important;padding:10px 14px!important;font-size:.78rem!important;font-weight:700!important;box-shadow:none!important;white-space:nowrap!important}
#view-naesin .na-add:hover{background:#ebf9fb!important}

/* Charcoal Cyan command bar */
.topbar{height:64px!important;background:#37434d!important;border-bottom:2px solid #4fb9c8!important;padding:0 18px!important;gap:12px!important}
.topbar .brand{min-width:190px!important;gap:9px!important}
.topbar .brand img{height:34px!important;max-width:48px!important;object-fit:contain!important}
.topbar .brand b{font-size:.94rem!important}
.topbar .brand small{font-size:.58rem!important;opacity:.62!important}
.topbar .teacher-name{display:none!important}
.topbar>.title{display:flex!important;align-items:center!important;justify-content:center!important;min-width:0!important}
.top-actions{min-width:190px!important;gap:7px!important}
.teacher-app-switch{display:flex;align-items:center;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:3px;gap:2px;white-space:nowrap;box-shadow:none}
.teacher-app-switch a{display:block;text-decoration:none;color:#dce3e7;padding:6px 11px;border-radius:999px;font-size:.68rem;font-weight:700;line-height:1}
.teacher-app-switch a.active{background:#fff;color:#343343;box-shadow:0 2px 7px rgba(0,0,0,.12)}
.teacher-app-switch a:not(.active):hover{color:#fff;background:rgba(255,255,255,.08)}

/* compact light collapsible sidebar */
.layout{width:100%!important;margin:0!important;padding:0!important;grid-template-columns:70px minmax(0,1fr)!important;gap:0!important;transition:grid-template-columns .18s ease!important;min-height:calc(100vh - 64px)!important}
.layout.sidebar-expanded{grid-template-columns:190px minmax(0,1fr)!important}
.rail{background:#eef1f5!important;color:#596171!important;border-radius:0!important;margin:0!important;height:calc(100vh - 64px)!important;top:64px!important;padding:8px 8px 12px!important;overflow:hidden!important;box-shadow:none!important;border-right:1px solid #dfe4e8!important;gap:7px!important;transition:width .18s ease,padding .18s ease!important}
.workspace{padding:20px 28px 32px!important}
.rail .nav{justify-content:center!important;padding:10px 8px!important;white-space:nowrap!important;overflow:hidden!important;color:#596171!important;border-radius:11px!important;gap:10px!important}
.rail .nav:hover{background:#f8fafb!important;color:#343343!important}
.rail .nav.active{background:#fff!important;color:#343343!important;box-shadow:0 4px 14px rgba(24,32,48,.06)!important}
.rail .nav>span:last-child{display:none!important}
.layout.sidebar-expanded .rail .nav{justify-content:flex-start!important;padding:10px 11px!important}
.layout.sidebar-expanded .rail .nav>span:last-child{display:inline!important}
.rail .nav-icon{flex:0 0 30px!important;width:30px!important;height:30px!important;border-radius:9px!important;background:rgba(255,255,255,.72)!important;color:#4fb9c8!important}
.rail .nav.active .nav-icon{background:#ebf9fb!important;color:#4fb9c8!important}
.rail-note{display:none!important}
.rail-spacer{flex:1!important}
.rail-collapse-toggle{border:0;background:#fff;color:#4fb9c8;width:36px;height:32px;border-radius:9px;display:grid;place-items:center;cursor:pointer;margin:0 auto 3px;font-size:1rem;line-height:1;box-shadow:0 3px 10px rgba(24,32,48,.05);transition:.18s}
.layout.sidebar-expanded .rail-collapse-toggle{margin-left:auto;margin-right:0}
.rail-collapse-toggle:hover{background:#ebf9fb}
.rail-collapse-toggle span{display:block;transition:transform .18s ease}
.layout.sidebar-expanded .rail-collapse-toggle span{transform:rotate(180deg)}

/* burger component sits inside command bar */
.top-actions #burger-menu-mount{display:flex!important;align-items:center!important;position:relative!important}
.top-actions #burger-menu-mount .burger-menu{position:relative!important;top:auto!important;right:auto!important;left:auto!important;bottom:auto!important;z-index:40!important;box-shadow:none!important;margin:0!important}
.top-actions #burger-menu-mount .burger-dropdown{top:calc(100% + 7px)!important;right:0!important}
.top-actions #burger-menu-mount .burger-user-label{box-shadow:none!important;border-radius:10px!important;height:34px!important;padding:0 10px!important;font-size:.68rem!important}
.top-actions #burger-menu-mount .burger-btn,.top-actions #burger-menu-mount .hw-notif-btn{width:34px!important;height:34px!important;border-radius:10px!important;background:#4fb9c8!important;color:#fff!important}

@media(max-width:1100px){#view-students .page-head,#view-classes .page-head{align-items:flex-start!important;flex-wrap:wrap!important}#view-students .filters,#view-classes .filters{margin-left:0!important;width:100%!important}.teacher-app-switch a{padding:6px 9px!important;font-size:.65rem!important}.workspace{padding:18px 20px 28px!important}}
@media(max-width:700px){.topbar{height:62px!important;padding:0 10px!important}.topbar .brand{min-width:auto!important}.topbar .brand img{height:32px!important}.topbar .brand div{display:none!important}.top-actions{min-width:auto!important}.teacher-app-switch{padding:3px!important}.teacher-app-switch a{padding:6px 8px!important;font-size:.62rem!important}.top-actions #burger-menu-mount .burger-user-label{display:none!important}.top-actions #burger-menu-mount .burger-btn,.top-actions #burger-menu-mount .hw-notif-btn{width:34px!important;height:34px!important}.layout{display:block!important;min-height:calc(100vh - 62px)!important}.rail{display:none!important}.workspace{padding:14px 10px 75px!important}#view-students .page-head h1,#view-classes .page-head h1,#view-naesin .na-fresh-head h1{font-size:1.34rem!important}#view-naesin .na-add{font-size:.72rem!important;padding:9px 12px!important}}
`;document.head.appendChild(s)}
function tidy(){const add=$('#naFreshCreate');if(add&&add.textContent.trim()!=='+ 시험 추가')add.textContent='+ 시험 추가';const note=$('.rail-note');if(note)note.remove()}
function mountSwitch(){const host=$('.topbar>.title');if(!host)return;let sw=$('#teacherAppSwitch');if(!sw){sw=document.createElement('div');sw.className='teacher-app-switch';sw.id='teacherAppSwitch';sw.setAttribute('aria-label','Teacher and admin apps');sw.innerHTML='<a class="active" href="/Teachers/dashboard-v2/">Teacher</a><a href="/Teachers/admin/">Admin</a>'}if(sw.parentElement!==host){host.replaceChildren(sw)}}
function mountRailToggle(){const rail=$('.rail'),layout=$('.layout');if(!rail||!layout||$('#railCollapseToggle'))return;const b=document.createElement('button');b.type='button';b.className='rail-collapse-toggle';b.id='railCollapseToggle';b.setAttribute('aria-label','Expand sidebar');b.setAttribute('aria-expanded','false');b.innerHTML='<span>›</span>';b.onclick=()=>{const open=layout.classList.toggle('sidebar-expanded');b.setAttribute('aria-expanded',String(open));b.setAttribute('aria-label',open?'Collapse sidebar':'Expand sidebar')};rail.prepend(b)}
let raf=0;function scan(){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{inject();tidy();mountSwitch();mountRailToggle()})}
function boot(){scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();