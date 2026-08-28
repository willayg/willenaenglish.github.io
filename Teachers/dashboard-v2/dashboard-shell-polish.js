(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
function inject(){if($('#dashboardShellPolish'))return;const s=document.createElement('style');s.id='dashboardShellPolish';s.textContent=`
/* compact, quieter page heads */
#view-students .page-head,#view-classes .page-head,#view-naesin .na-fresh-head{align-items:center!important;margin-bottom:16px!important;gap:14px!important}
#view-students .page-head h1,#view-classes .page-head h1,#view-naesin .na-fresh-head h1{font-size:1.48rem!important;line-height:1.15!important;letter-spacing:-.02em!important}
#view-students .page-head p,#view-classes .page-head p,#view-naesin .na-fresh-head p{display:none!important}
#view-students .filters,#view-classes .filters{margin-left:auto!important}
#view-naesin .na-add{margin-left:auto!important;background:#fff!important;color:#287b85!important;border:2px solid #58c3d2!important;border-radius:12px!important;padding:10px 14px!important;font-size:.78rem!important;font-weight:700!important;box-shadow:none!important;white-space:nowrap!important}
#view-naesin .na-add:hover{background:#effafb!important}

/* one identity label only: keep the integrated burger user label */
.topbar .teacher-name{display:none!important}

/* replace dashboard title with teacher/admin switch */
.topbar>.title{display:flex!important;align-items:center!important;justify-content:center!important;min-width:0!important}
.teacher-app-switch{display:flex;align-items:center;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:4px;gap:2px;white-space:nowrap;box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
.teacher-app-switch a{display:block;text-decoration:none;color:#d7d8df;padding:7px 13px;border-radius:999px;font-size:.72rem;font-weight:700;line-height:1}
.teacher-app-switch a.active{background:#fff;color:#3b3a4b;box-shadow:0 2px 8px rgba(0,0,0,.12)}
.teacher-app-switch a:not(.active):hover{color:#fff;background:rgba(255,255,255,.09)}

/* sidebar sits flush against the left edge; no rounded floating card treatment */
.layout{width:100%!important;margin:0!important;padding-left:0!important}
.rail{border-radius:0!important}

/* burger component belongs to this header, not the viewport */
.top-actions #burger-menu-mount{display:flex!important;align-items:center!important;position:relative!important}
.top-actions #burger-menu-mount .burger-menu{position:relative!important;top:auto!important;right:auto!important;left:auto!important;bottom:auto!important;z-index:40!important;box-shadow:none!important;margin:0!important}
.top-actions #burger-menu-mount .burger-dropdown{top:calc(100% + 8px)!important;right:0!important}
.top-actions #burger-menu-mount .burger-user-label{box-shadow:none!important}
.top-actions #burger-menu-mount .burger-btn,.top-actions #burger-menu-mount .hw-notif-btn{height:42px!important}

@media(max-width:1100px){#view-students .page-head,#view-classes .page-head{align-items:flex-start!important;flex-wrap:wrap!important}#view-students .filters,#view-classes .filters{margin-left:0!important;width:100%!important}.teacher-app-switch a{padding:7px 10px!important;font-size:.68rem!important}}
@media(max-width:700px){#view-students .page-head h1,#view-classes .page-head h1,#view-naesin .na-fresh-head h1{font-size:1.34rem!important}#view-naesin .na-add{font-size:.72rem!important;padding:9px 12px!important}.teacher-app-switch{padding:3px!important}.teacher-app-switch a{padding:6px 8px!important;font-size:.62rem!important}.top-actions #burger-menu-mount .burger-user-label{display:none!important}.top-actions #burger-menu-mount .burger-btn,.top-actions #burger-menu-mount .hw-notif-btn{width:38px!important;height:36px!important}.layout{padding-left:10px!important}}
`;document.head.appendChild(s)}
function tidy(){const add=$('#naFreshCreate');if(add&&add.textContent.trim()!=='+ 시험 추가')add.textContent='+ 시험 추가'}
function mountSwitch(){const host=$('.topbar>.title');if(!host)return;let sw=$('#teacherAppSwitch');if(!sw){sw=document.createElement('div');sw.className='teacher-app-switch';sw.id='teacherAppSwitch';sw.setAttribute('aria-label','Teacher and admin apps');sw.innerHTML='<a class="active" href="/Teachers/dashboard-v2/">Teacher</a><a href="/Teachers/admin/">Admin</a>'}if(sw.parentElement!==host){host.replaceChildren(sw)}}
let raf=0;function scan(){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{inject();tidy();mountSwitch()})}
function boot(){scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();