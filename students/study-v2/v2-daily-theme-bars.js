(function(){
'use strict';
var KEY='willena-study-v2-daily-theme:v2';
var THEMES={
  pink:{accent:'#ff6fb0',soft:'#fff3f8',ring:'#f3d8e4',badge:'#ffc6df',badgeText:'#d44e8d',glow:'rgba(255,111,176,.14)',icon:'star'},
  cyan:{accent:'#25cfe6',soft:'#effcff',ring:'#d9f4f7',badge:'#bcecf3',badgeText:'#159fb3',glow:'rgba(37,207,230,.14)',icon:'bolt'},
  blue:{accent:'#4f86ff',soft:'#f1f5ff',ring:'#dce5f7',badge:'#c9d8ff',badgeText:'#3d6fd1',glow:'rgba(79,134,255,.14)',icon:'rocket'},
  orange:{accent:'#ff8a3d',soft:'#fff4eb',ring:'#f7dfcf',badge:'#ffd4b8',badgeText:'#df6b20',glow:'rgba(255,138,61,.14)',icon:'fire'}
};
var order=['pink','cyan','blue','orange'];
var shell=document.querySelector('.study-v2-top-actions');
var card=document.getElementById('dailyWorkoutCard');
var rail=document.querySelector('.daily-rail-main');
var row=rail&&rail.querySelector('.daily-rail-progress');
if(!shell||!card||!rail||!row)return;

function svgData(kind,color){
  var c=color,svg='';
  if(kind==='bolt')svg="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M58 7 24 55h24l-8 38 36-52H52z' fill='none' stroke='"+c+"' stroke-opacity='.18' stroke-width='7' stroke-linejoin='round'/></svg>";
  else if(kind==='rocket')svg="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M58 14c16 4 25 13 28 29-14 3-25 10-34 20L37 78 22 63l15-15c10-9 17-20 21-34Z' fill='none' stroke='"+c+"' stroke-opacity='.18' stroke-width='6' stroke-linejoin='round'/><circle cx='64' cy='36' r='7' fill='none' stroke='"+c+"' stroke-opacity='.18' stroke-width='5'/><path d='m29 70-9 15 15-9M42 57l-18-3 7-10M55 70l3 18 10-8' fill='none' stroke='"+c+"' stroke-opacity='.18' stroke-width='5' stroke-linecap='round'/></svg>";
  else if(kind==='fire')svg="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M54 10c4 18-5 24-3 38 2-6 8-10 13-15 3 8 14 19 14 32 0 17-13 28-29 28S20 82 20 65c0-18 14-27 23-40 4-6 8-11 11-15Z' fill='none' stroke='"+c+"' stroke-opacity='.18' stroke-width='6' stroke-linejoin='round'/><path d='M50 55c6 8 11 13 11 21 0 7-5 12-12 12S37 83 37 76c0-7 6-13 13-21Z' fill='none' stroke='"+c+"' stroke-opacity='.18' stroke-width='5'/></svg>";
  else svg="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M50 5 59 38 92 50 59 62 50 95 41 62 8 50 41 38Z' fill='none' stroke='"+c+"' stroke-opacity='.18' stroke-width='4' stroke-linejoin='round'/></svg>";
  return 'url("data:image/svg+xml,'+encodeURIComponent(svg).replace(/%23/g,'%23')+'")';
}
function load(){try{var v=localStorage.getItem(KEY);return THEMES[v]?v:'pink';}catch(_){return'pink';}}
function save(v){try{localStorage.setItem(KEY,v);}catch(_){}}
function install(){
  var style=document.createElement('style');
  style.id='dailyThemeBarsStyles';
  style.textContent='\
.book-hero.daily-inline .daily-rail-progress.daily-theme-bars{grid-template-columns:repeat(4,minmax(0,1fr))!important;pointer-events:auto!important;}\
.book-hero.daily-inline .daily-rail-progress.daily-theme-bars .daily-theme-bar{display:block!important;width:100%!important;height:100%!important;min-height:inherit!important;margin:0!important;padding:0!important;border:0!important;border-radius:999px!important;cursor:pointer!important;appearance:none!important;-webkit-appearance:none!important;box-shadow:none!important;}\
.book-hero.daily-inline .daily-rail-progress.daily-theme-bars .daily-theme-bar:nth-child(1){background:#ff6fb0!important}.book-hero.daily-inline .daily-rail-progress.daily-theme-bars .daily-theme-bar:nth-child(2){background:#25cfe6!important}.book-hero.daily-inline .daily-rail-progress.daily-theme-bars .daily-theme-bar:nth-child(3){background:#4f86ff!important}.book-hero.daily-inline .daily-rail-progress.daily-theme-bars .daily-theme-bar:nth-child(4){background:#ff8a3d!important}\
.book-hero.daily-inline .daily-rail-progress.daily-theme-bars .daily-theme-bar.is-active{box-shadow:0 0 0 2px #fff,0 0 0 4px var(--daily-theme-accent)!important;}\
.book-hero.daily-inline .daily-rail-progress.daily-theme-bars .daily-theme-bar:focus-visible{outline:2px solid #244d53!important;outline-offset:3px!important;}\
.book-hero.daily-inline .study-v2-top-actions[data-daily-theme]{border-color:var(--daily-theme-accent)!important;}\
.book-hero.daily-inline #dailyWorkoutCard.study-v2-daily-primary[data-daily-theme]{border-color:var(--daily-theme-accent)!important;background-color:#fff!important;background-image:var(--daily-theme-art),var(--daily-theme-art-small),linear-gradient(160deg,#fff 0 58%,var(--daily-theme-soft) 100%)!important;background-repeat:no-repeat,no-repeat,no-repeat!important;background-position:left -42px top 142px,right 17px bottom 58px,center!important;background-size:132px 132px,80px 80px,100% 100%!important;box-shadow:0 12px 30px var(--daily-theme-glow)!important;}\
.book-hero.daily-inline #dailyWorkoutCard.study-v2-daily-primary[data-daily-theme]:hover,.book-hero.daily-inline #dailyWorkoutCard.study-v2-daily-primary[data-daily-theme]:focus-visible{border-color:var(--daily-theme-accent)!important;box-shadow:0 14px 34px var(--daily-theme-glow)!important;}\
.book-hero.daily-inline #dailyWorkoutCard.study-v2-daily-primary[data-daily-theme] .progress-ring{background:conic-gradient(var(--daily-theme-accent) 0 calc(var(--progress,0)*1%),var(--daily-theme-ring) calc(var(--progress,0)*1%) 100%)!important;}\
.book-hero.daily-inline #dailyWorkoutCard.study-v2-daily-primary[data-daily-theme] .progress-ring span,.book-hero.daily-inline #dailyWorkoutCard.study-v2-daily-primary[data-daily-theme] .daily-rail-today{color:var(--daily-theme-accent)!important;}\
.book-hero.daily-inline .study-v2-top-actions[data-daily-theme] .daily-rail-streak{border-color:var(--daily-theme-badge)!important;color:var(--daily-theme-badge-text)!important;box-shadow:0 6px 15px var(--daily-theme-glow)!important;}';
  document.head.appendChild(style);
}
function buildBars(){
  row.classList.add('daily-theme-bars');
  row.removeAttribute('aria-hidden');
  row.innerHTML='';
  order.forEach(function(name){
    var b=document.createElement('button');
    b.type='button';b.className='daily-theme-bar';b.dataset.theme=name;
    b.setAttribute('aria-label','Daily Study '+name+' theme');
    b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();apply(name,true);});
    row.appendChild(b);
  });
}
function apply(name,persist){
  var t=THEMES[name]||THEMES.pink;
  shell.dataset.dailyTheme=name;card.dataset.dailyTheme=name;
  shell.style.setProperty('--daily-theme-accent',t.accent);
  shell.style.setProperty('--daily-theme-soft',t.soft);
  shell.style.setProperty('--daily-theme-ring',t.ring);
  shell.style.setProperty('--daily-theme-badge',t.badge);
  shell.style.setProperty('--daily-theme-badge-text',t.badgeText);
  shell.style.setProperty('--daily-theme-glow',t.glow);
  shell.style.setProperty('--daily-theme-art',svgData(t.icon,t.accent));
  shell.style.setProperty('--daily-theme-art-small',svgData(t.icon,t.accent));
  card.style.setProperty('--daily-theme-accent',t.accent);
  card.style.setProperty('--daily-theme-soft',t.soft);
  card.style.setProperty('--daily-theme-ring',t.ring);
  card.style.setProperty('--daily-theme-glow',t.glow);
  card.style.setProperty('--daily-theme-art',svgData(t.icon,t.accent));
  card.style.setProperty('--daily-theme-art-small',svgData(t.icon,t.accent));
  Array.prototype.forEach.call(row.querySelectorAll('.daily-theme-bar'),function(b){b.classList.toggle('is-active',b.dataset.theme===name);b.style.setProperty('--daily-theme-accent',t.accent);});
  if(persist)save(name);
}
install();buildBars();apply(load(),false);
})();
