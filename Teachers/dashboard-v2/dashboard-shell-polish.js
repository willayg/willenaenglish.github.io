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
/* teacher/admin app switch */
.teacher-app-switch{display:flex;align-items:center;background:rgba(255,255,255,.11);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:3px;gap:2px;white-space:nowrap}
.teacher-app-switch a{display:block;text-decoration:none;color:#d7d8df;padding:6px 10px;border-radius:999px;font-size:.68rem;font-weight:700;line-height:1}
.teacher-app-switch a.active{background:#fff;color:#3b3a4b;box-shadow:0 2px 8px rgba(0,0,0,.12)}
.teacher-app-switch a:not(.active):hover{color:#fff;background:rgba(255,255,255,.09)}
@media(max-width:1100px){#view-students .page-head,#view-classes .page-head{align-items:flex-start!important;flex-wrap:wrap!important}#view-students .filters,#view-classes .filters{margin-left:0!important;width:100%!important}.teacher-app-switch a{padding:6px 8px!important;font-size:.64rem!important}}
@media(max-width:700px){#view-students .page-head h1,#view-classes .page-head h1,#view-naesin .na-fresh-head h1{font-size:1.34rem!important}.teacher-app-switch{display:none!important}#view-naesin .na-add{font-size:.72rem!important;padding:9px 12px!important}}
`;document.head.appendChild(s)}
function tidy(){const add=$('#naFreshCreate');if(add&&add.textContent.trim()!=='+ 시험 추가')add.textContent='+ 시험 추가'}
function mountSwitch(){const host=$('.top-actions');if(!host||$('#teacherAppSwitch'))return;const sw=document.createElement('div');sw.className='teacher-app-switch';sw.id='teacherAppSwitch';sw.setAttribute('aria-label','Teacher and admin apps');sw.innerHTML='<a class="active" href="/Teachers/dashboard-v2/">Teacher</a><a href="/Teachers/admin/">Admin</a>';host.insertBefore(sw,host.firstChild)}
let raf=0;function scan(){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{inject();tidy();mountSwitch()})}
function boot(){scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();