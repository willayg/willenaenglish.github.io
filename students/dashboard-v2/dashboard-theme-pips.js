(()=>{
'use strict';
const STORAGE_KEY='willena-dashboard-theme';
const THEMES=['cyan','sunbeam','pink','dark','cyberpunk'];
function applyTheme(name,{save=true}={}){
  const chosen=THEMES.includes(name)?name:'cyan';
  const root=document.documentElement;
  root.dataset.dashboardTheme=chosen;
  document.querySelectorAll('.dashboard-theme-pip[data-theme]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.theme===chosen)));
  const darkToggle=document.getElementById('darkToggle');
  if(darkToggle)darkToggle.checked=chosen==='dark'||chosen==='cyberpunk';
  if(save){try{localStorage.setItem(STORAGE_KEY,chosen)}catch{}}
}
function addThemePips(){
  const header=document.querySelector('.header');
  if(!header||document.getElementById('dashboardThemeDock'))return;
  const dock=document.createElement('div');
  dock.id='dashboardThemeDock';
  dock.className='dashboard-theme-dock';
  dock.setAttribute('role','group');
  dock.setAttribute('aria-label','Dashboard theme');
  dock.innerHTML=[['cyan','Cyan'],['sunbeam','Sunbeam'],['pink','Pink'],['dark','Dark'],['cyberpunk','Cyberpunk']].map(([theme,label])=>`<button type="button" class="dashboard-theme-pip" data-theme="${theme}" aria-label="${label} theme" title="${label}" aria-pressed="false"></button>`).join('');
  dock.addEventListener('click',event=>{const button=event.target.closest('.dashboard-theme-pip[data-theme]');if(button)applyTheme(button.dataset.theme)});
  header.appendChild(dock);
}
function boot(){
  addThemePips();
  let saved='cyan';
  try{saved=localStorage.getItem(STORAGE_KEY)||'cyan'}catch{}
  applyTheme(saved,{save:false});
  const darkToggle=document.getElementById('darkToggle');
  darkToggle?.addEventListener('change',()=>applyTheme(darkToggle.checked?'dark':'cyan'));
}
window.WillenaDashboardTheme={apply:applyTheme};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
