const STORAGE_KEY='willena-testprep-theme';

const THEMES={
  cyan:{cyan:'#66d6df',strong:'#25b8c4',soft:'#e9fbfc',pink:'#ff0a8a',pinkDark:'#e60076',ink:'#173f46',muted:'#6f8190',page:'#eef9fa',pageTop:'#dff7f8',card:'#ffffff',line:'#dcebed',border:'#c9f1f4',track:'#dff3f5',heading:'#244f56',shadow:'0 18px 50px rgba(34,106,116,.13)'},
  sunbeam:{cyan:'#f0cc6d',strong:'#c58b00',soft:'#fff4c8',pink:'#ef4e87',pinkDark:'#c9366e',ink:'#40341d',muted:'#857a64',page:'#fffdf5',pageTop:'#fff7d8',card:'#ffffff',line:'#ead9a3',border:'#f0cc6d',track:'#f5eccd',heading:'#4c3500',shadow:'0 18px 50px rgba(197,139,0,.12)'},
  pink:{cyan:'#f5b8d2',strong:'#d54685',soft:'#ffe8f2',pink:'#d83b7b',pinkDark:'#b92f68',ink:'#4a2c39',muted:'#8b7480',page:'#fff7fb',pageTop:'#ffeaf3',card:'#ffffff',line:'#f2cadb',border:'#f5b8d2',track:'#f8dfeb',heading:'#7d2850',shadow:'0 18px 50px rgba(213,70,133,.12)'},
  paper:{cyan:'#77aaa5',strong:'#4f7f7a',soft:'#e7dccb',pink:'#b85f78',pinkDark:'#8d4058',ink:'#3f372f',muted:'#7f7468',page:'#eee5d6',pageTop:'#e7dccb',card:'#faf5ec',line:'#d1c1aa',border:'#c5b49d',track:'#ddd1bf',heading:'#4b4036',shadow:'0 16px 42px rgba(88,68,45,.12)'},
  dark:{cyan:'#65d7df',strong:'#7fe7ed',soft:'#202d33',pink:'#ff76ad',pinkDark:'#ff9cc2',ink:'#edf5f6',muted:'#9aabb1',page:'#10171b',pageTop:'#152126',card:'#182126',line:'#33474f',border:'#3f5a64',track:'#293940',heading:'#effcfd',shadow:'0 18px 50px rgba(0,0,0,.32)'},
  cyberpunk:{cyan:'#35e8ff',strong:'#6cf2ff',soft:'#251238',pink:'#ff4fb5',pinkDark:'#ff8ad0',ink:'#f8f1ff',muted:'#bea8c9',page:'#0b0613',pageTop:'#171031',card:'#160d24',line:'#6c357f',border:'#8d3fbb',track:'#3b224f',heading:'#fff2ff',shadow:'0 18px 54px rgba(0,0,0,.44)'}
};

function applyTheme(name,{save=true}={}){
  const chosen=THEMES[name]?name:'cyan';
  const t=THEMES[chosen];
  const root=document.documentElement;
  const vars={
    '--cyan':t.cyan,'--cyan-strong':t.strong,'--cyan-soft':t.soft,
    '--pink':t.pink,'--pink-dark':t.pinkDark,'--ink':t.ink,'--muted':t.muted,
    '--paper':t.card,'--line':t.line,'--shadow':t.shadow,
    '--vocab-page':t.page,'--vocab-page-top':t.pageTop,'--vocab-card':t.card,
    '--vocab-border':t.border,'--vocab-track':t.track,'--vocab-heading':t.heading
  };
  Object.entries(vars).forEach(([key,value])=>root.style.setProperty(key,value));
  root.dataset.vocabTheme=chosen;
  document.querySelectorAll('.vocab-theme-pip[data-theme]').forEach(button=>{
    button.setAttribute('aria-pressed',String(button.dataset.theme===chosen));
  });
  if(save){try{localStorage.setItem(STORAGE_KEY,chosen)}catch{}}
}

function boot(){
  const dock=document.getElementById('vocabThemeDock');
  dock?.addEventListener('click',event=>{
    const button=event.target.closest('.vocab-theme-pip[data-theme]');
    if(button)applyTheme(button.dataset.theme);
  });
  let saved='cyan';
  try{saved=localStorage.getItem(STORAGE_KEY)||'cyan'}catch{}
  applyTheme(saved,{save:false});
}

window.WillenaVocabTheme={apply:applyTheme};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
