(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const AUTH='/.netlify/functions/supabase_auth';
const UTILITIES_PIN_HASH='082c48954f6c56528dbc3cb0f313bfb6285e8db431cb492217831697ab319d76';
const UTILITIES_SESSION_KEY='willena_utilities_unlocked';
const TRACKING_URL='https://fiieuiktlsivwfgyivai.supabase.co';
const TRACKING_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
function installTestPrepRecentAccuracyBridge(){
  if(window.__WillenaTeacherRecentAccuracyBridge)return;
  window.__WillenaTeacherRecentAccuracyBridge=true;
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    const isDetail=url.includes('/functions/v1/test-prep-teacher-insights')&&url.includes('action=student_detail');
    const response=await nativeFetch(input,init);
    if(!isDetail||!response.ok)return response;
    try{
      const payload=await response.clone().json();
      const planId=payload?.exams?.[0]?.plan_id;
      const map=payload?.summary?.by_lesson_practice;
      if(!planId||!map)return response;
      let auth='';
      const h=init?.headers;
      if(h instanceof Headers)auth=h.get('Authorization')||'';
      else if(Array.isArray(h)){const hit=h.find(([k])=>String(k).toLowerCase()==='authorization');auth=hit?.[1]||'';}
      else if(h&&typeof h==='object')auth=h.Authorization||h.authorization||'';
      if(!auth)return response;
      const rr=await nativeFetch(`${TRACKING_URL}/rest/v1/rpc/test_prep_teacher_card_stats`,{
        method:'POST',
        headers:{Authorization:auth,apikey:TRACKING_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({p_plan_id:planId}),
        credentials:'omit',
        cache:'no-store'
      });
      if(!rr.ok)return response;
      const rows=await rr.json().catch(()=>[]);
      if(!Array.isArray(rows))return response;
      for(const row of rows){
        let byPractice=row?.attempted_question_ids?.by_practice;
        if(typeof byPractice==='string'){try{byPractice=JSON.parse(byPractice)}catch{byPractice=null}}
        if(!byPractice||typeof byPractice!=='object')continue;
        for(const [practice,stats] of Object.entries(byPractice)){
          const target=map[`${row.unit_key}||${practice}`];
          if(!target||!stats||typeof stats!=='object')continue;
          target.recent_accuracy=stats.recent_accuracy??null;
          target.recent_count=Number(stats.recent_count||0);
        }
      }
      const headers=new Headers(response.headers);headers.set('content-type','application/json');
      return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
    }catch(e){console.warn('[teacher recent accuracy] hydration failed',e);return response;}
  };
}
installTestPrepRecentAccuracyBridge();
function loadPolish(){if($('#dashboardV2Polish'))return;const l=document.createElement('link');l.id='dashboardV2Polish';l.rel='stylesheet';l.href='./dashboard-v2-polish.css?v='+Date.now();document.head.appendChild(l)}
function prefetchPage(href,id){if($('#'+id))return;const l=document.createElement('link');l.id=id;l.rel='prefetch';l.as='document';l.href=href;document.head.appendChild(l)}
async function warmAdmin(){prefetchPage('/Teachers/admin/','prefetchAdminDashboard');try{await window.WillenaAPI?.fetch?.('/.netlify/functions/teacher_admin?action=list_students',{credentials:'include'})}catch{}}
async function getRole(){try{const f=window.WillenaAPI?.fetch||fetch;const who=await f(AUTH+'?action=whoami',{credentials:'include',cache:'no-store'});const w=await who.json().catch(()=>({}));if(!who.ok||!w.user_id)return'';const rr=await f(AUTH+'?action=get_role&user_id='+encodeURIComponent(w.user_id),{credentials:'include',cache:'no-store'});const r=await rr.json().catch(()=>({}));return String(r.role||'').toLowerCase()}catch{return''}}
async function mountSwitch(){const host=$('.topbar>.title');if(!host||$('#teacherAppSwitch'))return;const role=await getRole();if(role!=='admin')return;const sw=document.createElement('div');sw.className='teacher-app-switch';sw.id='teacherAppSwitch';sw.setAttribute('aria-label','Teacher and admin apps');sw.innerHTML='<a class="active" href="/Teachers/dashboard-v2/">Teacher</a><a id="adminSwitchLink" href="/Teachers/admin/">Admin</a>';host.replaceChildren(sw);const admin=$('#adminSwitchLink');admin?.addEventListener('pointerenter',warmAdmin,{once:true});admin?.addEventListener('touchstart',warmAdmin,{once:true,passive:true});setTimeout(warmAdmin,250)}
function mountRailToggle(){const rail=$('.rail'),layout=$('.layout');if(!rail||!layout||$('#railCollapseToggle'))return;const b=document.createElement('button');b.type='button';b.className='rail-collapse-toggle';b.id='railCollapseToggle';b.setAttribute('aria-label','Expand sidebar');b.setAttribute('aria-expanded','false');b.innerHTML='<span>›</span>';b.onclick=()=>{const open=layout.classList.toggle('sidebar-expanded');b.setAttribute('aria-expanded',String(open));b.setAttribute('aria-label',open?'Collapse sidebar':'Expand sidebar')};rail.prepend(b)}
const icons={students:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/></svg>',classes:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v16M16 4v16M4 9h16M4 15h16"/></svg>',naesin:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 18.5 5.2 14 15.7 3.5a2.1 2.1 0 0 1 3 3L8.2 17 4 18.5Z"/><path d="m13.9 5.3 4.8 4.8M6.1 13.1l4.8 4.8"/></svg>',apps:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',utilities:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M7 4v6M4 17h16M17 14v6"/></svg>'};
function refreshRailIcons(){$$('.rail .nav').forEach(btn=>{const icon=$('.nav-icon',btn),svg=icons[btn.dataset.view];if(icon&&svg&&icon.dataset.svgReady!=='1'){icon.innerHTML=svg;icon.dataset.svgReady='1'}})}
function utilitiesUnlocked(){try{return sessionStorage.getItem(UTILITIES_SESSION_KEY)==='1'}catch{return false}}
function markUtilitiesUnlocked(){try{sessionStorage.setItem(UTILITIES_SESSION_KEY,'1')}catch{}}
async function hashPin(value){const bytes=new TextEncoder().encode(String(value||''));const digest=await crypto.subtle.digest('SHA-256',bytes);return[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function showUtilitiesGate(onSuccess){let bg=$('#utilitiesPinBg');if(!bg){bg=document.createElement('div');bg.id='utilitiesPinBg';bg.innerHTML='<div class="utilities-pin-modal" role="dialog" aria-modal="true"><button class="utilities-pin-close" type="button" aria-label="Close">×</button><h2>PRIME minister enter your pin.</h2><input id="utilitiesPinInput" type="password" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="PIN"><div id="utilitiesPinError" class="utilities-pin-error"></div><button id="utilitiesPinSubmit" class="utilities-pin-submit" type="button">Enter</button></div>';document.body.appendChild(bg);const st=document.createElement('style');st.id='utilitiesPinStyles';st.textContent='#utilitiesPinBg{position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.42);display:grid;place-items:center;padding:20px}.utilities-pin-modal{position:relative;width:min(360px,100%);background:#fff;border-radius:18px;padding:26px;box-shadow:0 24px 70px rgba(15,23,42,.25);text-align:center}.utilities-pin-modal h2{margin:4px 0 18px;font-size:20px}.utilities-pin-modal input{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #cbd5e1;border-radius:10px;font:inherit;text-align:center;letter-spacing:.18em}.utilities-pin-submit{width:100%;margin-top:12px;padding:11px 14px;border:0;border-radius:10px;background:#0f766e;color:#fff;font-weight:700;cursor:pointer}.utilities-pin-close{position:absolute;right:12px;top:10px;border:0;background:transparent;font-size:24px;cursor:pointer;color:#64748b}.utilities-pin-error{min-height:18px;margin-top:8px;color:#b91c1c;font-size:12px}';document.head.appendChild(st)}const input=$('#utilitiesPinInput',bg),error=$('#utilitiesPinError',bg),submit=$('#utilitiesPinSubmit',bg),close=$('.utilities-pin-close',bg);bg.style.display='grid';input.value='';error.textContent='';const check=async()=>{submit.disabled=true;try{if(await hashPin(input.value)===UTILITIES_PIN_HASH){bg.style.display='none';markUtilitiesUnlocked();onSuccess()}else{error.textContent='Wrong PIN';input.select()}}finally{submit.disabled=false}};submit.onclick=check;input.onkeydown=e=>{if(e.key==='Enter')check();if(e.key==='Escape')bg.style.display='none'};close.onclick=()=>bg.style.display='none';bg.onclick=e=>{if(e.target===bg)bg.style.display='none'};setTimeout(()=>input.focus(),0)}
function mountUtilities(){const rail=$('.rail'),main=$('.workspace');if(!rail||!main||$('#view-utilities'))return;const spacer=$('.rail-spacer',rail);const btn=document.createElement('button');btn.className='nav';btn.dataset.view='utilities';btn.innerHTML='<span class="nav-icon"></span><span>Utilities</span>';rail.insertBefore(btn,spacer||null);const view=document.createElement('section');view.className='view';view.id='view-utilities';view.innerHTML=`<div class="page-head"><div><h1>Utilities</h1></div></div><div class="app-grid utility-grid">
<a class="app-card utility-card" href="/qc/test-prep/"><span class="chip">QC</span><h3>내신 QC</h3><p>Test-prep question QC.</p></a>
<a class="app-card utility-card" href="/Teachers/tools/curriculum-editor/"><span class="chip">TOOL</span><h3>Curriculum Editor</h3><p>Edit curriculum content.</p></a>
<a class="app-card utility-card" href="/Teachers/tools/audio-manager/"><span class="chip">AUDIO</span><h3>Audio Audit</h3><p>Review and manage audio.</p></a>
<a class="app-card utility-card" href="/Teachers/tools/content-review/"><span class="chip">QC</span><h3>Content Review</h3><p>Review curriculum content.</p></a>
<a class="app-card utility-card" href="/Teachers/tools/control-room/"><span class="chip">ADMIN</span><h3>Control Room</h3><p>Teacher-side controls and checks.</p></a>
<a class="app-card utility-card" href="/Teachers/tools/book-quiz/"><span class="chip">TOOL</span><h3>Book Quiz</h3><p>Book quiz utility.</p></a>
</div>`;main.appendChild(view);const st=document.createElement('style');st.textContent='.utility-card{display:block;color:inherit;text-decoration:none;cursor:pointer}.utility-card:hover{transform:translateY(-1px)}';document.head.appendChild(st);const openView=()=>{$$('.view').forEach(x=>x.classList.toggle('active',x===view));$$('[data-view]').forEach(x=>x.classList.toggle('active',x===btn))};btn.onclick=()=>utilitiesUnlocked()?openView():showUtilitiesGate(openView);refreshRailIcons()}
function boot(){loadPolish();mountSwitch();mountRailToggle();mountUtilities();refreshRailIcons();const rail=$('.rail');if(rail)new MutationObserver(refreshRailIcons).observe(rail,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();