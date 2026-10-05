(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
function boot(){
  const modal=$('#settingsModal'),avatar=$('.header .avatar'),open=$('#openSettings'),close=$('#closeSettings');
  if(!modal||!avatar||!close)return;
  const show=()=>{modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open')};
  const hide=()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open')};
  avatar.addEventListener('click',show);
  open?.addEventListener('click',show);
  close.addEventListener('click',hide);
  modal.addEventListener('click',e=>{if(e.target===modal)hide()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});
  $('#profileEditBtn')?.addEventListener('click',()=>{location.href='/students/profile.html'});
  $('#logoutBig')?.addEventListener('click',async()=>{
    try{
      sessionStorage.removeItem('missionModalShownV3');
      window.WillenaAPI?.clearLocalTokens?.();
      await window.WillenaAPI?.fetch('/.netlify/functions/supabase_auth?action=logout',{method:'POST'});
    }catch{}
    location.href='/students/login.html?next=%2Fstudents%2Fdashboard';
  });
  // Dashboard/Profile use this shared menu instead of <student-header>, so start the
  // same homework mission router here as well.
  setTimeout(()=>{
    import('/students/components/homework-mission.js?v=20261005-shared1')
      .then(mod=>mod.showHomeworkMission())
      .catch(err=>console.debug('[shared-header-menu] homework mission unavailable',err));
  },0);
  const lang=$('#languageSelect');
  if(lang&&window.StudentLang){lang.value=StudentLang.getLang()==='ko'?'ko':'en';lang.addEventListener('change',()=>StudentLang.setLang(lang.value))}
  const dark=$('#darkToggle');
  if(dark){
    const current=document.documentElement.dataset.dashboardTheme;
    dark.checked=current==='dark'||current==='cyberpunk'||document.documentElement.classList.contains('dark');
    dark.addEventListener('change',()=>{if(window.WillenaDashboardTheme)WillenaDashboardTheme.apply(dark.checked?'dark':'white');else window.StudentTheme?.toggle()});
  }
  const motion=$('#motionToggle');
  if(motion){motion.checked=!document.body.classList.contains('no-motion');motion.addEventListener('change',()=>document.body.classList.toggle('no-motion',!motion.checked))}
  const music=$('#musicToggle');
  if(music){try{music.checked=localStorage.getItem('wa.audio.music.enabled')==='1'}catch{}music.addEventListener('change',()=>{try{localStorage.setItem('wa.audio.music.enabled',music.checked?'1':'0');window.dispatchEvent(new CustomEvent('wa:audio-settings-changed',{detail:{music:music.checked}}))}catch{}})}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();