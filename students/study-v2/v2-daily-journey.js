(function(){
'use strict';
var TARGET=20;
var THEME_KEY='willena-study-v2-daily-theme:v1';
var THEMES=[
  {id:'pink',icon:'★',label:'Stars'},
  {id:'cyan',icon:'⚡',label:'Lightning'},
  {id:'orange',icon:'🔥',label:'Fire'},
  {id:'blue',icon:'🚀',label:'Rockets'}
];
var card=document.getElementById('dailyWorkoutCard');
var pct=document.getElementById('smartDailyPct');
var smartTitle=document.getElementById('smartProgressTitle');
var today=document.querySelector('.daily-rail-today');
var main=document.querySelector('.daily-rail-main');
var shell=document.querySelector('.study-v2-top-actions');
if(!card||!pct||!today||!main||!shell)return;

var headline=main.querySelector('.daily-rail-headline');
var sub=main.querySelector('.daily-rail-sub');
var oldProgress=main.querySelector('.daily-rail-progress');
var KO_SKILL={vocabulary:'어휘',spelling:'철자',grammar:'문법',sentence_building:'문장 만들기',conversation:'회화',listening:'듣기',reading:'읽기'};
var EN_SKILL={vocabulary:'vocabulary',spelling:'spelling',grammar:'grammar',sentence_building:'sentence building',conversation:'conversation',listening:'listening',reading:'reading'};

function korean(){var b=document.getElementById('languageBtn');return !b||String(b.textContent||'').trim()==='English';}
function doneCount(){
  var raw=String(pct.textContent||'').trim();
  if(raw==='✓')return TARGET;
  var m=raw.match(/(\d+)\s*\/\s*(\d+)/);
  if(m)return Math.max(0,Math.min(TARGET,Number(m[1])||0));
  var n=Number((raw.match(/\d+/)||[])[0]);
  return Number.isFinite(n)?Math.max(0,Math.min(TARGET,n)):0;
}
function currentSkill(){
  try{
    var api=window.WillenaStudyV2Daily;
    var s=api&&typeof api.getSession==='function'?api.getSession():null;
    if(!s||s.status==='completed')return'';
    var cursor=Math.max(0,Number(s.cursor)||0),plan=Array.isArray(s.plan)?s.plan:[];
    var item=plan[cursor]||null;
    return String(item&&item.skill||'').trim();
  }catch(_){return'';}
}
function readTheme(){
  try{
    var saved=localStorage.getItem(THEME_KEY);
    return THEMES.some(function(t){return t.id===saved;})?saved:'pink';
  }catch(_){return'pink';}
}
function themeInfo(id){return THEMES.find(function(t){return t.id===id;})||THEMES[0];}
function saveTheme(id){try{localStorage.setItem(THEME_KEY,id);}catch(_){}}
function installThemeStyles(){
  if(document.getElementById('dailyThemeStyles'))return;
  var style=document.createElement('style');
  style.id='dailyThemeStyles';
  style.textContent='\
.study-v2-top-actions[data-daily-theme]{--daily-accent:#ff6fb0;--daily-soft:#fff3f8;--daily-soft-hover:#fff1f7;--daily-border:#f3d7e4;--daily-ring-rest:#f1d5e2;--daily-glow:rgba(255,111,176,.32);position:relative!important;}\
.study-v2-top-actions[data-daily-theme="cyan"]{--daily-accent:#25cfe6;--daily-soft:#effcff;--daily-soft-hover:#e8fbff;--daily-border:#c8f2f7;--daily-ring-rest:#d6f4f7;--daily-glow:rgba(37,207,230,.28);}\
.study-v2-top-actions[data-daily-theme="orange"]{--daily-accent:#ff8a3d;--daily-soft:#fff5ed;--daily-soft-hover:#fff0e5;--daily-border:#ffd8bd;--daily-ring-rest:#f7dfcf;--daily-glow:rgba(255,138,61,.28);}\
.study-v2-top-actions[data-daily-theme="blue"]{--daily-accent:#4f86ff;--daily-soft:#f0f5ff;--daily-soft-hover:#e9f0ff;--daily-border:#cedcff;--daily-ring-rest:#dbe4f7;--daily-glow:rgba(79,134,255,.28);}\
.book-hero.daily-inline .study-v2-top-actions[data-daily-theme]{border-color:var(--daily-accent)!important;}\
.book-hero.daily-inline .study-v2-top-actions[data-daily-theme] #dailyWorkoutCard.study-v2-daily-primary{background:linear-gradient(180deg,var(--daily-soft) 0%,#fff 100%)!important;border-right-color:var(--daily-border)!important;}\
.book-hero.daily-inline .study-v2-top-actions[data-daily-theme] #dailyWorkoutCard.study-v2-daily-primary:hover,.book-hero.daily-inline .study-v2-top-actions[data-daily-theme] #dailyWorkoutCard.study-v2-daily-primary:focus-visible{background:linear-gradient(180deg,var(--daily-soft-hover) 0%,#fff 100%)!important;}\
.book-hero.daily-inline .study-v2-top-actions[data-daily-theme] .daily-rail-today{color:var(--daily-accent)!important;}\
.book-hero.daily-inline .study-v2-top-actions[data-daily-theme] #dailyWorkoutCard.study-v2-daily-primary .progress-ring{background:conic-gradient(var(--daily-accent) 0 calc(var(--progress,0)*1%),var(--daily-ring-rest) calc(var(--progress,0)*1%) 100%)!important;box-shadow:0 0 0 5px #fff,0 0 0 8px var(--daily-glow),0 10px 22px rgba(36,77,83,.12)!important;}\
.book-hero.daily-inline .study-v2-top-actions[data-daily-theme] #dailyWorkoutCard.study-v2-daily-primary .progress-ring span{color:var(--daily-accent)!important;}\
.daily-theme-switch{position:relative;z-index:4;display:inline-flex;align-items:center;gap:9px;width:max-content;max-width:100%;margin-top:20px;padding:9px 12px;border:2px solid var(--daily-border);border-radius:999px;background:#fff;color:#35565b;font:900 .76rem/1 Poppins,sans-serif;letter-spacing:.01em;cursor:pointer;box-shadow:0 5px 14px rgba(36,77,83,.07);transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease;}\
.daily-theme-switch:hover{transform:translateY(-1px);border-color:var(--daily-accent);box-shadow:0 7px 16px rgba(36,77,83,.1);}\
.daily-theme-switch:active{transform:translateY(0) scale(.98);}\
.daily-theme-switch:focus-visible{outline:3px solid var(--daily-glow);outline-offset:2px;}\
.daily-theme-switch-icon{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:var(--daily-soft);color:var(--daily-accent);font-size:1rem;}\
.daily-theme-dots{display:inline-flex;gap:5px;margin-left:2px;}\
.daily-theme-dot{width:8px;height:8px;border-radius:50%;box-shadow:0 0 0 1px rgba(53,86,91,.08);}\
.daily-theme-dot:nth-child(1){background:#ff6fb0}.daily-theme-dot:nth-child(2){background:#25cfe6}.daily-theme-dot:nth-child(3){background:#ff8a3d}.daily-theme-dot:nth-child(4){background:#4f86ff}\
.daily-theme-decor{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden;border-radius:26px;}\
.daily-theme-decor span{position:absolute;opacity:.16;filter:saturate(.9);user-select:none;}\
.daily-theme-decor span:nth-child(1){left:34%;top:16%;font-size:1.45rem;transform:rotate(-13deg)}\
.daily-theme-decor span:nth-child(2){right:7%;top:15%;font-size:1.18rem;transform:rotate(15deg)}\
.daily-theme-decor span:nth-child(3){left:52%;bottom:33%;font-size:1rem;transform:rotate(9deg)}\
.daily-theme-decor span:nth-child(4){right:24%;bottom:26%;font-size:1.35rem;transform:rotate(-11deg)}\
.study-v2-top-actions[data-daily-theme="pink"] .daily-theme-decor span{color:#ff6fb0;}\
.study-v2-top-actions[data-daily-theme="cyan"] .daily-theme-decor span{color:#25cfe6;}\
.study-v2-top-actions[data-daily-theme="orange"] .daily-theme-decor span{opacity:.13;}\
.study-v2-top-actions[data-daily-theme="blue"] .daily-theme-decor span{opacity:.14;}\
.study-v2-top-actions[data-daily-theme]>.study-v2-action-card,.study-v2-top-actions[data-daily-theme]>.daily-rail-main{position:relative;z-index:2;}\
@media(max-width:759px){.daily-theme-switch{margin-top:14px;padding:8px 10px;font-size:.7rem}.daily-theme-decor span:nth-child(1){left:58%;top:8%}.daily-theme-decor span:nth-child(3){left:74%;bottom:42%}}\
@media(min-width:760px) and (max-height:650px){.daily-theme-switch{margin-top:10px;padding:6px 9px;font-size:.65rem}.daily-theme-switch-icon{width:21px;height:21px;font-size:.84rem}.daily-theme-dot{width:7px;height:7px}}';
  document.head.appendChild(style);
}
function ensureDecor(){
  var decor=shell.querySelector('.daily-theme-decor');
  if(!decor){
    decor=document.createElement('div');decor.className='daily-theme-decor';decor.setAttribute('aria-hidden','true');
    for(var i=0;i<4;i++)decor.appendChild(document.createElement('span'));
    shell.appendChild(decor);
  }
  return decor;
}
function ensureSwitcher(){
  var btn=main.querySelector('.daily-theme-switch');
  if(btn)return btn;
  btn=document.createElement('button');
  btn.type='button';btn.className='daily-theme-switch';
  btn.innerHTML='<span class="daily-theme-switch-icon" aria-hidden="true">★</span><span class="daily-theme-switch-label">Theme</span><span class="daily-theme-dots" aria-hidden="true"><i class="daily-theme-dot"></i><i class="daily-theme-dot"></i><i class="daily-theme-dot"></i><i class="daily-theme-dot"></i></span>';
  if(oldProgress)oldProgress.replaceWith(btn);else main.appendChild(btn);
  btn.addEventListener('click',function(e){
    e.preventDefault();e.stopPropagation();
    var current=shell.getAttribute('data-daily-theme')||'pink';
    var index=THEMES.findIndex(function(t){return t.id===current;});
    applyTheme(THEMES[(index+1)%THEMES.length].id,true);
  });
  return btn;
}
function applyTheme(id,persist){
  var info=themeInfo(id),btn=ensureSwitcher(),decor=ensureDecor();
  shell.setAttribute('data-daily-theme',info.id);
  if(persist)saveTheme(info.id);
  var icon=btn.querySelector('.daily-theme-switch-icon');
  var label=btn.querySelector('.daily-theme-switch-label');
  if(icon)icon.textContent=info.icon;
  if(label)label.textContent=korean()?'테마 · '+info.label:'Theme · '+info.label;
  btn.setAttribute('aria-label',(korean()?'Daily Study 테마 변경. 현재 ':'Change Daily Study theme. Current ')+info.label);
  var deco=info.id==='pink'?['★','✦','★','✧']:info.id==='cyan'?['⚡','⚡','✦','⚡']:info.id==='orange'?['🔥','🔥','✦','🔥']:['🚀','✦','🚀','✦'];
  Array.prototype.forEach.call(decor.children,function(el,i){el.textContent=deco[i]||deco[0];});
}
function paint(){
  var done=doneCount(),remaining=Math.max(0,TARGET-done),ko=korean(),skill=currentSkill();
  today.textContent='TODAY';
  if(done<TARGET&&smartTitle)smartTitle.textContent=ko?'오늘의 학습':"Today's Study";
  if(headline){
    if(done>=TARGET)headline.textContent=ko?'오늘 학습 완료!':'Daily Study complete!';
    else headline.textContent=ko?'오늘은 '+remaining+'문제만 더 하면 끝!':remaining+' more question'+(remaining===1?'':'s')+' and you are done!';
  }
  if(sub){
    if(done>=TARGET)sub.textContent=ko?'오늘의 목표를 모두 완료했어요.':'You completed today\'s goal.';
    else if(skill){
      var label=ko?(KO_SKILL[skill]||skill):(EN_SKILL[skill]||skill);
      sub.textContent=ko?'현재 '+label+' 파트를 진행 중이에요.':'You are currently working on '+label+'.';
    }else{
      sub.textContent=ko?'오늘의 Daily Study를 시작해 볼까요?':'Ready to start today\'s Daily Study?';
    }
  }
  main.setAttribute('aria-label',(ko?'오늘의 학습 진행 ':'Daily Study progress ')+done+'/'+TARGET);
  applyTheme(shell.getAttribute('data-daily-theme')||readTheme(),false);
}

installThemeStyles();
applyTheme(readTheme(),false);
paint();
if(window.MutationObserver)new MutationObserver(paint).observe(pct,{childList:true,characterData:true,subtree:true});
var lang=document.getElementById('languageBtn');if(lang)lang.addEventListener('click',function(){setTimeout(paint,0);});
document.addEventListener('visibilitychange',function(){if(!document.hidden)setTimeout(paint,50);});
setTimeout(paint,250);setTimeout(paint,900);setTimeout(paint,2200);
setInterval(function(){if(!document.hidden)paint();},1500);
})();
