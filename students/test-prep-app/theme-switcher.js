(function(){
'use strict';

const STORAGE_KEY='willena-testprep-theme';
const THEMES={
  cyan:{'--tp-cyan':'#67d4da','--tp-cyan-dark':'#07888d','--tp-pink':'#ee5f91','--tp-ink':'#203039','--tp-muted':'#7c8b92','--tp-page':'#f3feff','--tp-card':'#ffffff','--tp-soft':'#e9fbfc','--tp-line':'#9de2e7','--tp-track':'#dff3f5','--tp-accent':'#15aab5','--tp-header-a':'#baf8fb','--tp-header-b':'#65e3eb','--tp-header-c':'#39c9d6','--tp-heading':'#064e57'},
  sunbeam:{'--tp-cyan':'#f0cc6d','--tp-cyan-dark':'#c58b00','--tp-pink':'#ef4e87','--tp-ink':'#40341d','--tp-muted':'#857a64','--tp-page':'#fffdf5','--tp-card':'#ffffff','--tp-soft':'#fff4c8','--tp-line':'#f0cc6d','--tp-track':'#f5eccd','--tp-accent':'#e6a400','--tp-header-a':'#ffe67b','--tp-header-b':'#ffc24c','--tp-header-c':'#ffb130','--tp-heading':'#4c3500'},
  pink:{'--tp-cyan':'#f5b8d2','--tp-cyan-dark':'#d54685','--tp-pink':'#d83b7b','--tp-ink':'#4a2c39','--tp-muted':'#8b7480','--tp-page':'#fff7fb','--tp-card':'#ffffff','--tp-soft':'#ffe8f2','--tp-line':'#f5b8d2','--tp-track':'#f8dfeb','--tp-accent':'#ed5c9d','--tp-header-a':'#ffd7e8','--tp-header-b':'#ff9fc8','--tp-header-c':'#f775ad','--tp-heading':'#7d2850'}
};

function applyTheme(name,save=true){
  const chosen=THEMES[name]?name:'cyan';
  Object.entries(THEMES[chosen]).forEach(([key,value])=>document.documentElement.style.setProperty(key,value));
  document.body.dataset.tpTheme=chosen;
  document.querySelectorAll('.tp-theme-pip').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.theme===chosen)));
  if(save){try{localStorage.setItem(STORAGE_KEY,chosen)}catch(_){}}
}

function syncDock(){
  const dock=document.getElementById('tpThemeDock');
  const home=document.getElementById('assignmentHome');
  const quiz=document.getElementById('assignedQuizPane');
  if(!dock||!home)return;
  const onHome=home.style.display!=='none'&&(!quiz||quiz.style.display==='none')&&!home.querySelector('.tp-lesson-head,.tp-wrong-page-head');
  dock.hidden=!onHome;
}

function addDock(){
  if(document.getElementById('tpThemeDock'))return;
  const dock=document.createElement('div');
  dock.id='tpThemeDock';
  dock.setAttribute('role','group');
  dock.setAttribute('aria-label','색상 테마');
  dock.innerHTML='<button type="button" class="tp-theme-pip" data-theme="cyan" aria-label="Cyan 테마" title="Cyan"></button><button type="button" class="tp-theme-pip" data-theme="sunbeam" aria-label="Sunbeam 테마" title="Sunbeam"></button><button type="button" class="tp-theme-pip" data-theme="pink" aria-label="Pink 테마" title="Pink"></button>';
  dock.addEventListener('click',e=>{const btn=e.target.closest('.tp-theme-pip');if(btn)applyTheme(btn.dataset.theme,true)});
  const home=document.getElementById('assignmentHome');
  if(home)home.insertAdjacentElement('afterend',dock);else document.querySelector('.app')?.appendChild(dock);
  syncDock();
}

function boot(){
  addDock();
  let saved='cyan';
  try{saved=localStorage.getItem(STORAGE_KEY)||'cyan'}catch(_){}
  applyTheme(saved,false);
  const app=document.querySelector('.app')||document.body;
  new MutationObserver(syncDock).observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});
  window.addEventListener('popstate',()=>setTimeout(syncDock,0));
  window.addEventListener('testprep:student-state-refresh',()=>setTimeout(syncDock,0));
}

window.WillenaTestPrepTheme={apply:applyTheme};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();