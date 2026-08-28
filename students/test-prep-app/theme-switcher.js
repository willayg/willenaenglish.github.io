(function(){
'use strict';

const STORAGE_KEY='willena-testprep-theme';
const THEMES={
  cyan:{
    label:'Cyan',
    vars:{
      '--tp-cyan':'#67d4da','--tp-cyan-dark':'#07888d','--tp-pink':'#ee5f91',
      '--tp-ink':'#203039','--tp-muted':'#7c8b92','--tp-page':'#f3feff','--tp-card':'#ffffff',
      '--tp-soft':'#e9fbfc','--tp-line':'#9de2e7','--tp-track':'#dff3f5','--tp-accent':'#15aab5',
      '--tp-header-a':'#baf8fb','--tp-header-b':'#65e3eb','--tp-header-c':'#39c9d6','--tp-heading':'#064e57'
    }
  },
  sunbeam:{
    label:'Sunbeam',
    vars:{
      '--tp-cyan':'#f0cc6d','--tp-cyan-dark':'#c58b00','--tp-pink':'#ef4e87',
      '--tp-ink':'#40341d','--tp-muted':'#857a64','--tp-page':'#fffdf5','--tp-card':'#ffffff',
      '--tp-soft':'#fff4c8','--tp-line':'#f0cc6d','--tp-track':'#f5eccd','--tp-accent':'#e6a400',
      '--tp-header-a':'#ffe67b','--tp-header-b':'#ffc24c','--tp-header-c':'#ffb130','--tp-heading':'#4c3500'
    }
  },
  pink:{
    label:'Pink',
    vars:{
      '--tp-cyan':'#f5b8d2','--tp-cyan-dark':'#d54685','--tp-pink':'#d83b7b',
      '--tp-ink':'#4a2c39','--tp-muted':'#8b7480','--tp-page':'#fff7fb','--tp-card':'#ffffff',
      '--tp-soft':'#ffe8f2','--tp-line':'#f5b8d2','--tp-track':'#f8dfeb','--tp-accent':'#ed5c9d',
      '--tp-header-a':'#ffd7e8','--tp-header-b':'#ff9fc8','--tp-header-c':'#f775ad','--tp-heading':'#7d2850'
    }
  }
};

function addStyles(){
  if(document.getElementById('tpThemeSwitcherStyles'))return;
  const style=document.createElement('style');
  style.id='tpThemeSwitcherStyles';
  style.textContent=`
    body{background:var(--tp-page)!important;transition:background .22s ease,color .22s ease}
    .app{max-width:1120px!important;padding-left:24px!important;padding-right:24px!important}
    #assignmentHome{max-width:1040px!important;padding-top:18px!important}

    #assignmentHome:before{
      content:'';display:block;height:118px;margin:0 0 28px;border-radius:26px;
      background:
        radial-gradient(circle at 82% 20%,rgba(255,255,255,.42) 0 58px,transparent 59px),
        linear-gradient(135deg,var(--tp-header-a),var(--tp-header-b) 52%,var(--tp-header-c));
      box-shadow:0 12px 28px rgba(50,110,120,.08);
    }
    body[data-tp-theme="sunbeam"] #assignmentHome:before{
      background:
        radial-gradient(circle at 85% 18%,rgba(255,255,255,.34) 0 64px,transparent 65px),
        linear-gradient(135deg,var(--tp-header-a),var(--tp-header-b) 58%,var(--tp-header-c));
    }
    body[data-tp-theme="pink"] #assignmentHome:before{
      background:
        radial-gradient(circle at 78% 22%,rgba(255,255,255,.44) 0 62px,transparent 63px),
        linear-gradient(135deg,var(--tp-header-a),var(--tp-header-b) 48%,var(--tp-header-c));
    }

    .tp-task-shelf{gap:12px!important;padding-bottom:16px!important}
    .tp-task-chip,.tp-wrong-card,.tp-lesson-card,.tp-subway,.tp-review-panel,.tp-review-result,.tp-stats-modal{
      background:var(--tp-card)!important;border-color:var(--tp-line)!important;
      box-shadow:0 12px 28px color-mix(in srgb,var(--tp-accent) 9%,transparent)!important;
    }
    .tp-task-chip{min-width:250px!important;border-width:1.5px!important;border-radius:18px!important;padding:14px 16px!important}
    .tp-task-chip .k,.tp-task-chip .arrow,.tp-book{color:var(--tp-cyan-dark)!important}
    .tp-task-chip b{font-size:14px!important}
    .tp-task-chip small{font-size:10px!important}

    .tp-wrong-card{border-width:1.5px!important;border-radius:22px!important;padding:20px 22px!important;margin-bottom:26px!important}
    .tp-wrong-icon{background:color-mix(in srgb,var(--tp-pink) 12%,white)!important;color:var(--tp-pink)!important}
    .tp-wrong-count{color:var(--tp-pink)!important;font-size:30px!important}
    .tp-wrong-copy b{font-size:17px!important}

    .tp-exam-section{margin-bottom:32px!important}
    .tp-exam-head h2{font-size:23px!important;color:var(--tp-ink)!important}
    .tp-exam-head p{font-size:11px!important}
    .tp-book{font-size:13px!important;margin-bottom:12px!important}
    .tp-exam-date{background:color-mix(in srgb,var(--tp-pink) 9%,white)!important;border-color:color-mix(in srgb,var(--tp-pink) 28%,white)!important;color:var(--tp-pink)!important}
    .tp-records,.tp-review-btn,.tp-stats-x{border-color:var(--tp-line)!important;color:var(--tp-cyan-dark)!important;background:#fff!important}

    .tp-lessons{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:15px!important}
    .tp-lesson-card{border-width:1.5px!important;border-radius:22px!important;min-height:138px!important;padding:19px!important;grid-template-columns:1fr 76px!important}
    .tp-lesson-card h3{font-size:17px!important}
    .tp-lesson-card p{font-size:10px!important}
    .tp-ring{width:72px!important;height:72px!important;background:conic-gradient(var(--tp-accent) var(--p),var(--tp-track) 0)!important}
    .tp-ring:after{background:var(--tp-card)!important}

    .tp-subway,.tp-review-panel{border-width:1.5px!important}
    .tp-review-start,.tp-review-next{background:var(--tp-cyan-dark)!important;color:#fff!important}
    .tp-mini i{background:var(--tp-accent)!important}
    .tp-station{color:var(--tp-cyan-dark)!important;border-color:color-mix(in srgb,var(--tp-accent) 38%,white)!important}
    .tp-stop.current .tp-station{background:var(--tp-cyan-dark)!important;color:#fff!important}

    .card{border-color:var(--tp-line)!important;box-shadow:0 12px 28px color-mix(in srgb,var(--tp-accent) 8%,transparent)!important}
    .engine-progress i{background:linear-gradient(90deg,var(--tp-header-b),var(--tp-cyan-dark))!important}
    .choice.selected{border-color:var(--tp-cyan-dark)!important;background:var(--tp-soft)!important}
    .context{border-color:color-mix(in srgb,var(--tp-line) 62%,white)!important;background:color-mix(in srgb,var(--tp-page) 60%,white)!important}
    .primary,.secondary,.flag,.modal{border-color:var(--tp-line)!important}
    .primary,.secondary{color:var(--tp-pink)!important}

    #tpThemeDock{
      position:fixed;left:50%;bottom:max(14px,env(safe-area-inset-bottom));transform:translateX(-50%);
      z-index:9998;display:flex;align-items:center;gap:10px;padding:8px 11px;background:rgba(255,255,255,.90);
      border:1px solid rgba(62,85,93,.12);border-radius:999px;box-shadow:0 8px 22px rgba(22,40,48,.14);
      backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)
    }
    .tp-theme-pip{width:18px;height:18px;border:0;border-radius:50%;padding:0;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08);transition:transform .16s ease,box-shadow .16s ease}
    .tp-theme-pip[data-theme="cyan"]{background:#39c9d6}
    .tp-theme-pip[data-theme="sunbeam"]{background:#ffc24c}
    .tp-theme-pip[data-theme="pink"]{background:#f775ad}
    .tp-theme-pip[aria-pressed="true"]{transform:scale(1.22);box-shadow:0 0 0 3px #fff,0 0 0 5px var(--tp-cyan-dark)}
    .tp-theme-pip:focus-visible{outline:3px solid var(--tp-cyan-dark);outline-offset:3px}

    @media(max-width:860px){
      .app{padding-left:16px!important;padding-right:16px!important}
      #assignmentHome:before{height:92px;margin-bottom:22px}
      .tp-lessons{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    }
    @media(max-width:620px){
      .app{padding-left:10px!important;padding-right:10px!important}
      #assignmentHome:before{height:72px;border-radius:20px;margin-bottom:18px}
      .tp-lessons{grid-template-columns:1fr!important}
      .tp-lesson-card{min-height:112px!important}
      #tpThemeDock{bottom:max(10px,env(safe-area-inset-bottom))}
    }
  `;
  document.head.appendChild(style);
}

function applyTheme(name,save=true){
  const theme=THEMES[name]||THEMES.cyan;
  const chosen=THEMES[name]?name:'cyan';
  Object.entries(theme.vars).forEach(([key,value])=>document.documentElement.style.setProperty(key,value));
  document.body.dataset.tpTheme=chosen;
  document.querySelectorAll('.tp-theme-pip').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.theme===chosen)));
  if(save){try{localStorage.setItem(STORAGE_KEY,chosen)}catch(_){}}
}

function addDock(){
  if(document.getElementById('tpThemeDock'))return;
  const dock=document.createElement('div');
  dock.id='tpThemeDock';
  dock.setAttribute('role','group');
  dock.setAttribute('aria-label','색상 테마');
  dock.innerHTML=`
    <button type="button" class="tp-theme-pip" data-theme="cyan" aria-label="Cyan 테마" title="Cyan"></button>
    <button type="button" class="tp-theme-pip" data-theme="sunbeam" aria-label="Sunbeam 테마" title="Sunbeam"></button>
    <button type="button" class="tp-theme-pip" data-theme="pink" aria-label="Pink 테마" title="Pink"></button>`;
  dock.addEventListener('click',e=>{
    const btn=e.target.closest('.tp-theme-pip');
    if(btn)applyTheme(btn.dataset.theme,true);
  });
  document.body.appendChild(dock);
}

function boot(){
  addStyles();
  addDock();
  let saved='cyan';
  try{saved=localStorage.getItem(STORAGE_KEY)||'cyan'}catch(_){}
  applyTheme(saved,false);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();