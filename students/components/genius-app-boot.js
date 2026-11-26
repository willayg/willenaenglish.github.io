/* Shared, visual-only app startup and selected-app resource warming.
 * Never cache identity or authorization between documents. No activity writes. */
(function(){
'use strict';
if(window.WillenaGeniusBoot)return;
const version='20261126-home-profile1';
const assets={
 '/students/vocab-study/':{
  entry:'/students/vocab-study/vocab-study.js?v=20261126-boot3',
  css:['/students/vocab-study/vocab-study.css?v=20261111-word-fragments5','/students/study/study.css?v=20260808-7','/students/study-v2/v2.css?v=20260814-daily1']},
 '/students/sentence-genius/':{
  entry:'/students/sentence-genius/app.js?v=20261126-boot3',
  css:['/students/sentence-genius/styles.css?v=20261111-accuracy7','/students/vocab-study/vocab-study.css?v=20261024-home-navigation4','/students/study/study.css?v=20260808-7','/students/study-v2/v2.css?v=20260814-daily1']}
};
Object.assign(assets,{"/students/grammar-books/":{"entry":"/students/grammar-books/books.js?v=20261126-guide1","css":["/students/study/study.css?v=20260808-7","/students/study/study-overrides.css?v=20260808-1","/students/study-v2/v2.css?v=20260814-daily1","/students/vocab-study/vocab-study.css?v=20261024-home-navigation4","/students/vocab-study/theme-pips.css?v=20261101-footer1","/students/test-prep-v2/question-renderer-accessibility.css?v=2.25.93"]},"/students/free-talking-genius/":{"entry":"/students/free-talking-genius/app.js?v=20261126-portal-rollout1","css":["/students/study/study.css?v=20260808-7","/students/study/study-overrides.css?v=20260808-1","/students/study-v2/v2.css?v=20260814-daily1","/students/vocab-study/vocab-study.css?v=20261024-home-navigation4","/students/vocab-study/theme-pips.css?v=20261101-footer1","/students/shared/willena-keyboard-safe.css?v=1.0.0"]},"/students/writing-genius/":{"entry":"/students/writing-genius/app.js?v=20261126-portal-rollout1","css":["/students/study/study.css?v=20260808-7","/students/study/study-overrides.css?v=20260808-1","/students/study-v2/v2.css?v=20260814-daily1","/students/shared/willena-keyboard-safe.css?v=1.0.0","/students/vocab-study/vocab-study.css?v=20261024-home-navigation4","/students/vocab-study/theme-pips.css?v=20261101-footer1"]},"/students/wordsearch/":{"entry":"/students/wordsearch/wordsearch.js?v=20261126-portal-rollout1","css":["/students/wordsearch/wordsearch.css?v=20261031-mix-face-fix1"]},"/students/listening-genius/":{"entry":"/students/listening-genius/app.js?v=20261126-portal-rollout1","css":[]},"/Games/english_arcade/index.html":{"entry":"/Games/english_arcade/main.js?v=20260329f","css":["/Games/english_arcade/style.css?v=20251115a","/students/theme.css"]}});
assets["/students/grammar-foundations/"]={"entry":"/students/grammar-foundations/app.js?v=20261126-naesin-portal1","css":["/students/test-prep-v2/styles.css?v=2.21.2","/students/test-prep-v2/card-style-v2.css?v=1.0.0","/students/test-prep-v2/question-renderer-accessibility.css?v=2.25.93","/students/vocab-study/theme-pips.css?v=20261101-footer1","/students/test-prep-v2/dark-mode.css?v=2.25.112","/students/test-prep-v2/cyberpunk-mode.css?v=2.25.112"]};
const warmed=new Set();
function hint(rel,url,as){
 const k=rel+'|'+url;if(warmed.has(k))return;
 warmed.add(k);const l=document.createElement('link');l.rel=rel;l.href=url;if(as)l.as=as;document.head.append(l);
}
function warm(destination){
 try{
  const url=new URL(destination,location.href);if(url.origin!==location.origin)return false;
  const app=assets[url.pathname];if(!app)return false;
  if(navigator.connection?.saveData)return false;
  hint('prefetch',url.href,'document');
  hint('modulepreload',app.entry);
  for(const css of app.css)hint('prefetch',css,'style');
  return true;
 }catch{return false}
}
// Only continue a real portal handoff. Direct visits keep their normal UI.
const KEY='willena:portal-handoff-v1';
function portalPath(path){
 if(['/students/dashboard','/students/dashboard/','/students/dashboard.html'].includes(path))return '/students/dashboard.html';
 return path;
}
const homePath='/students/dashboard.html',profilePath='/students/profile.html';
const supported=path=>Object.hasOwn(assets,path)||path===homePath||path===profilePath;
const currentPath=portalPath(location.pathname);
const pilot=supported(currentPath);
const q=new URLSearchParams(location.search);
const focused=!!(q.get('homework')||q.get('assignment_id'));
const iconMarkup={"/students/grammar-books/":"<svg class=\"lu-app-icon\" viewBox=\"0 0 80 80\" aria-hidden=\"true\"><path d=\"M39 12c-10-8-25-2-25 10-9 5-9 18-1 23-4 11 3 21 14 21 5 6 13 5 13-2V20c0-4-1-6-1-8Z\" fill=\"#e9fbfc\" stroke=\"#28b7c4\" stroke-width=\"4\" stroke-linejoin=\"round\"/><path d=\"M41 12c10-8 25-2 25 10 9 5 9 18 1 23 4 11-3 21-14 21-5 6-13 5-13-2V20c0-4 1-6 1-8Z\" fill=\"#ffe7f3\" stroke=\"#ed61a7\" stroke-width=\"4\" stroke-linejoin=\"round\"/><path d=\"M25 24c9 0 12 6 12 13m-19 6c11-4 18 0 20 10M55 24c-9 0-12 6-12 13m19 6c-11-4-18 0-20 10\" fill=\"none\" stroke=\"#d04f94\" stroke-width=\"3\" stroke-linecap=\"round\"/></svg>","/students/free-talking-genius/":"<img class=\"lu-app-icon\" src=\"/students/assets/icons/free-talking-bunny-fox.svg?v=20261108-1\" alt=\"\">","/students/writing-genius/":"<svg class=\"lu-app-icon\" viewBox=\"0 0 80 80\" aria-hidden=\"true\"><path d=\"M17 12h36l11 11v43a5 5 0 0 1-5 5H17a5 5 0 0 1-5-5V17a5 5 0 0 1 5-5Z\" fill=\"#fff\" stroke=\"#ff67ad\" stroke-width=\"4\" stroke-linejoin=\"round\"/><path d=\"M53 12v12h11M23 34h25M23 45h18\" fill=\"none\" stroke=\"#ff67ad\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"m38 61 22-22 7 7-22 22-10 3Z\" fill=\"#72dce3\" stroke=\"#267f89\" stroke-width=\"2.5\" stroke-linejoin=\"round\"/></svg>","/students/wordsearch/":"<img class=\"lu-app-icon\" src=\"/students/shared/assets/puzzles.png?v=20260928-4\" alt=\"Puzzles\">","/students/listening-genius/":"<img class=\"lu-app-icon\" src=\"/students/assets/icons/listening-genius.svg?v=20261112a\" alt=\"\">","/Games/english_arcade/index.html":"<img class=\"lu-app-icon\" src=\"/Games/english_arcade/assets/Images/icons/word-arcade.svg\" alt=\"English Arcade\">"};
const titles={"/students/grammar-books/":"GRAMMAR GENIUS BOOKS","/students/free-talking-genius/":"FREE TALKING GENIUS","/students/writing-genius/":"WRITING GENIUS","/students/wordsearch/":"PUZZLES","/students/listening-genius/":"LISTENING GENIUS","/Games/english_arcade/index.html":"ENGLISH ARCADE"};
iconMarkup["/students/grammar-foundations/"]="<img class=\"lu-app-icon\" src=\"/students/assets/icons/grammar-foundation-logo.png?v=20260929-1\" alt=\"\">";
titles["/students/grammar-foundations/"]='GRAMMAR GENIUS 내신';
const icons={'/students/vocab-study/':'/students/assets/icons/word-genius.svg?v=20260927-1','/students/sentence-genius/':'/students/assets/icons/sentence-genius.svg?v=20261025-sentence-path-1'};
Object.assign(titles,{'/students/vocab-study/':'WORD GENIUS','/students/sentence-genius/':'SENTENCE GENIUS'});
let handoff=null,cover=null,done=false,authTask=null,deadline=0,mission=null,started=performance.now();
function handoffPortal(destination){
 try{
  const u=new URL(destination,location.href);
  if(u.origin!==location.origin||!supported(portalPath(u.pathname)))return;
  const p=document.querySelector('.lu-neon-portal');if(!p)return;
  const read=selector=>{const e=p.querySelector(selector);return e&&!e.hidden?e.textContent:''};
  sessionStorage.setItem(KEY,JSON.stringify({path:portalPath(u.pathname)+u.search,at:Date.now(),title:read('.lu-neon-name'),book:read('.lu-neon-book'),unit:read('.lu-neon-unit'),mission:read('.lu-neon-mission'),avatar:portalPath(u.pathname)===profilePath?read('.lu-neon-avatar'):''}));
 }catch{}
}
if(pilot){
 try{
  const raw=sessionStorage.getItem(KEY);sessionStorage.removeItem(KEY);
  const value=JSON.parse(raw||'null');
  if(!focused&&value?.path===currentPath+location.search&&Date.now()-value.at>=0&&Date.now()-value.at<8000&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)handoff=value;
 }catch{}
}
function release(status='ready'){
 if(done)return;done=true;clearTimeout(deadline);
 const detail={status,ms:Math.round(performance.now()),bootMs:Math.round(performance.now()-started)};
 window.WillenaGeniusBootMetrics=detail;
 try{performance.mark('genius-app-'+status)}catch{}
 console.info('[Genius boot]',detail);
 document.documentElement.classList.remove('genius-portal-handoff');
 if(!cover)return;
 const el=cover;cover=null;
 const remove=()=>el.remove();
 // No task, font, animation, or frame callback can prevent the hard release.
 el.classList.add('lu-neon-fade');el.addEventListener('transitionend',remove,{once:true});setTimeout(remove,260);
}
function track(task){return task}
function trackMission(task){
 if(!done&&handoff&&task)mission=Promise.resolve(task).catch(()=>{});
 return task;
}
function finish(status='ready'){
 if(done)return;
 if(status!=='ready'||!handoff||!mission){release(status);return;}
 // Only the visible basket gets a short grace period. Never wait on
 // achievements, historical progress, or other background network work.
 Promise.race([mission,new Promise(r=>setTimeout(r,180))]).then(()=>release(status));
}
function startAuth(task){
 if(!authTask){authTask=Promise.resolve().then(task);authTask.catch(()=>{});}
 return authTask;
}
function buildPortal(path,data,className){
 const el=document.createElement('div');el.className='lu-neon-portal '+className;el.setAttribute('role','status');
 el.innerHTML='<div class="lu-neon-cover"></div><div class="lu-neon-intro"><div class="lu-neon-halo" aria-hidden="true"></div><div class="lu-neon-mission"></div><div class="lu-neon-icon" aria-hidden="true"><img class="lu-app-icon" alt=""></div><div class="lu-neon-name"></div><div class="lu-neon-book"></div><div class="lu-neon-unit"></div><div class="lu-neon-loading" aria-hidden="true"><i></i></div></div>';
 const home=path===homePath,profile=path===profilePath;
 if(home)el.classList.add('lu-neon-home');
 if(profile)el.classList.add('lu-neon-profile');
 const title=home?'':profile?'MY PROFILE':String(data.title||titles[path]||'').slice(0,100);
 el.setAttribute('aria-label',(home?'Home':title)+' loading');
 const icon=el.querySelector('.lu-neon-icon');
 if(home){
  icon.innerHTML='<span class="lu-neon-willena" aria-hidden="true"></span>';
 }else if(profile){
  const av=document.createElement('span');av.className='lu-neon-avatar';
  av.textContent=String(data.avatar||'🙂').slice(0,64);icon.replaceChildren(av);
 }else if(iconMarkup[path])icon.innerHTML=iconMarkup[path];else el.querySelector('.lu-app-icon').src=icons[path];
 const name=el.querySelector('.lu-neon-name');name.textContent=title;name.hidden=home;
 for(const key of ['book','unit','mission']){const node=el.querySelector('.lu-neon-'+key);node.textContent=String(data[key]||'').slice(0,180);node.hidden=!node.textContent;}
 return el;
}
function mountPortal(){
 if(!handoff||done||cover||!document.body)return;
 cover=buildPortal(currentPath,handoff,'lu-neon-continuation');document.body.append(cover);
}
let switchCover=null,switchTimer=0,switchSafety=0;
function clearSwitch(){
 clearTimeout(switchTimer);clearTimeout(switchSafety);
 switchTimer=switchSafety=0;
 if(switchCover)switchCover.remove();switchCover=null;
}
window.addEventListener('pagehide',clearSwitch);
function switchApp(destination,avatar=''){
 try{
  const url=new URL(destination,location.href);
  const path=portalPath(url.pathname);
  if(url.origin!==location.origin||!supported(path)||path===currentPath&&url.search===location.search)return false;
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||document.getElementById('motionToggle')?.checked===false)return false;
  if(switchCover)return true;
  if(!document.body||document.querySelector('.lu-neon-portal'))return false;
  ensurePortalStyle();
  const el=buildPortal(path,{avatar},'lu-neon-switch');
  const rings=document.createElement('div');rings.className='lu-neon-rings';rings.setAttribute('aria-hidden','true');
  el.style.setProperty('--lu-portal-x','50%');el.style.setProperty('--lu-portal-y','47%');
  el.style.setProperty('--lu-portal-scale',String(Math.max(8,Math.hypot(innerWidth,innerHeight)/48)));
  for(let i=0;i<3;i++){const ring=document.createElement('i');ring.style.setProperty('--lu-delay',(i*35)+'ms');rings.append(ring)}
  el.insertBefore(rings,el.querySelector('.lu-neon-intro'));
  switchCover=el;document.body.append(el);warm(url.href);
  switchTimer=setTimeout(()=>{
   try{handoffPortal(url.href);location.assign(url.href);
    // A cancelled navigation must never leave a blocking overlay.
    switchSafety=setTimeout(clearSwitch,2200);
   }catch{clearSwitch();try{sessionStorage.removeItem(KEY)}catch{}}
  },path===homePath?350:400);
  return true;
 }catch{clearSwitch();return false}
}
window.WillenaGeniusBoot={version,warm,handoffPortal,mountPortal,switchApp,finish,track,trackMission,startAuth,getAuth:()=>authTask};
let portalStyle=null;
function ensurePortalStyle(){
 if(portalStyle?.isConnected)return;
 const style=document.createElement('style');
style.textContent=".lu-neon-portal{position:fixed;inset:0;z-index:99998;overflow:hidden;isolation:isolate;pointer-events:auto;color:#fff;font-family:Poppins,\"Noto Sans KR\",system-ui,sans-serif;touch-action:none}\n.lu-neon-cover{position:absolute;inset:0;background:linear-gradient(145deg,#ba347d 0%,#9b3986 36%,#087d9d 100%);opacity:0;animation:luNeonCover 480ms ease-out forwards}\n.lu-neon-rings{position:absolute;inset:0;pointer-events:none}\n.lu-neon-rings i{position:absolute;left:var(--lu-portal-x);top:var(--lu-portal-y);width:48px;height:48px;box-sizing:border-box;border:3px solid #ffc0e6;border-radius:50%;box-shadow:0 0 12px #7aebf5,inset 0 0 8px #7aebf5;opacity:0;animation:luNeonRing 560ms var(--lu-delay) cubic-bezier(.15,.65,.3,1) both}\n.lu-neon-rings i:nth-child(even){border-color:#8ff4ff;box-shadow:0 0 12px #ff95cd,inset 0 0 8px #ff95cd}\n.lu-neon-intro{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:max(20px,env(safe-area-inset-top)) 22px max(20px,env(safe-area-inset-bottom));box-sizing:border-box;opacity:0;animation:luNeonArrive 320ms 480ms cubic-bezier(.2,.8,.3,1) both}\n.lu-neon-halo{position:absolute;left:50%;top:47%;width:min(110vw,560px);aspect-ratio:1;transform:translate(-50%,-50%);border:1px solid #ffc0e6;border-radius:50%;box-shadow:0 0 22px #7aebf577,inset 0 0 25px #7aebf555;opacity:.72;pointer-events:none}\n.lu-neon-halo::before,.lu-neon-halo::after{content:\"\";position:absolute;inset:9%;border:2px solid #8ff4ff;border-radius:50%}\n.lu-neon-halo::after{inset:18%;border:1px dashed #ffffff88}\n.lu-neon-icon{position:relative;width:clamp(76px,22vw,114px);height:clamp(76px,22vw,114px);display:grid;place-items:center;background:#fff;border:3px solid #b1f1f5;border-radius:50%;box-sizing:border-box;padding:12px;filter:drop-shadow(0 5px 9px #0003)}\n.lu-neon-icon .lu-app-icon{display:block;width:100%!important;height:100%!important;max-width:100%;max-height:100%;object-fit:contain;margin:0!important}\n.lu-neon-name{position:relative;font-size:clamp(28px,8vw,52px);max-width:570px;font-weight:900;letter-spacing:-.045em;line-height:1.02;color:#fff;text-shadow:0 3px 7px #0004;overflow-wrap:normal}\n.lu-neon-book{position:relative;font-size:clamp(12px,3.5vw,17px);font-weight:700;letter-spacing:.03em;color:#fff;max-width:95%;overflow-wrap:anywhere}\n.lu-neon-unit{position:relative;background:#ffffff24;border:1px solid #ffffff9c;border-radius:999px;padding:7px 19px;font-size:14px;font-weight:850;color:#fff}\n.lu-neon-mission{position:relative;font-size:13px;font-weight:850;letter-spacing:.12em;color:#fff;border-bottom:2px solid #8ff4ff;padding:3px 6px}\n.lu-neon-mission[hidden],.lu-neon-book[hidden],.lu-neon-unit[hidden]{display:none}\n.lu-neon-loading{position:absolute;bottom:max(9%,env(safe-area-inset-bottom));left:35%;width:30%;height:4px;border-radius:6px;background:#ffffff44;overflow:hidden}\n.lu-neon-loading i{display:block;width:45%;height:100%;background:#fff;border-radius:6px;animation:luNeonLoading .6s ease-in-out infinite alternate}\n@keyframes luNeonCover{0%,15%{opacity:0}100%{opacity:1}}\n@keyframes luNeonRing{0%{transform:translate(-50%,-50%) scale(.75);opacity:0}12%{opacity:.9}65%{opacity:.9}100%{transform:translate(-50%,-50%) scale(var(--lu-portal-scale));opacity:0}}\n@keyframes luNeonArrive{from{opacity:0;transform:scale(.83)}to{opacity:1;transform:scale(1)}}\n@keyframes luNeonLoading{to{transform:translateX(120%)}}\n@media(max-height:420px){.lu-neon-intro{gap:6px}.lu-neon-icon{width:64px;height:64px}.lu-neon-name{font-size:26px}.lu-neon-loading{bottom:5%}}\n@media(prefers-reduced-motion:reduce){.lu-neon-portal *{animation-duration:1ms!important;animation-delay:0ms!important}}"+
'.lu-neon-continuation{z-index:2147483647!important;opacity:1;transition:opacity 220ms ease}.lu-neon-continuation .lu-neon-cover,.lu-neon-continuation .lu-neon-intro{opacity:1;animation:none;transform:none}.lu-neon-continuation.lu-neon-fade{opacity:0;pointer-events:none}html.genius-portal-handoff #vocabLoading:not([hidden]){visibility:hidden}';
style.textContent+='.lu-neon-home .lu-neon-icon{width:min(64vw,260px);height:clamp(85px,28vw,132px);border:0;border-radius:24px;padding:20px;background:#fff;filter:drop-shadow(0 5px 12px #0002)}.lu-neon-willena{width:100%;height:100%;display:block;background:#ed579e;-webkit-mask:url(/Logo.png) center/contain no-repeat;mask:url(/Logo.png) center/contain no-repeat}.lu-neon-home .lu-neon-name[hidden]{display:none!important}.lu-neon-profile .lu-neon-avatar{font:900 clamp(38px,15vw,68px)/1 Poppins,system-ui,sans-serif;color:#dc5597}.lu-neon-profile .lu-neon-icon{background:#fff0f7}.lu-neon-switch{z-index:2147483647!important}.lu-neon-switch .lu-neon-cover{animation-duration:170ms}.lu-neon-switch .lu-neon-intro{animation-duration:200ms;animation-delay:90ms}.lu-neon-switch .lu-neon-rings i{animation-duration:310ms}';
 document.head.append(style);portalStyle=style;
}
if(!handoff)return;
document.documentElement.classList.add('genius-portal-handoff');
ensurePortalStyle();
// The continuation is a bounded visual transition, not a startup gate.
deadline=setTimeout(()=>release('timeout'),1800);
window.addEventListener('pagehide',()=>{if(cover)cover.remove();cover=null;release('navigation')},{once:true});
})();
