/* Shared, visual-only app startup and selected-app resource warming.
 * Never cache identity or authorization between documents. No activity writes. */
(function(){
'use strict';
if(window.WillenaGeniusBoot)return;
const version='20261126-fade2';
const assets={
 '/students/vocab-study/':{
  entry:'/students/vocab-study/vocab-study.js?v=20261126-boot2',
  css:['/students/vocab-study/vocab-study.css?v=20261111-word-fragments5','/students/study/study.css?v=20260808-7','/students/study-v2/v2.css?v=20260814-daily1']},
 '/students/sentence-genius/':{
  entry:'/students/sentence-genius/app.js?v=20261126-boot2',
  css:['/students/sentence-genius/styles.css?v=20261111-accuracy7','/students/vocab-study/vocab-study.css?v=20261024-home-navigation4','/students/study/study.css?v=20260808-7','/students/study-v2/v2.css?v=20260814-daily1']}
};
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
const q=new URLSearchParams(location.search);
const pilot=Object.hasOwn(assets,location.pathname);
const focused=!!(q.get('homework')||q.get('assignment_id'));
let done=false,finishing=false,timer=0,authTask=null,started=performance.now();
const pending=new Set();
function track(task){
 if(!pilot||focused||done)return task;
 const p=Promise.resolve(task);pending.add(p);
 p.then(()=>pending.delete(p),()=>pending.delete(p));
 return task;
}
function release(status){
 if(done)return;done=true;clearTimeout(timer);
 const html=document.documentElement,overlay=document.getElementById('geniusBootSkeleton');
 const detail={status,ms:Math.round(performance.now()),bootMs:Math.round(performance.now()-started)};
 window.WillenaGeniusBootMetrics=detail;
 try{performance.mark('genius-app-'+status)}catch{}
 console.info('[Genius boot]',detail);
 if(!overlay||focused){html.classList.remove('genius-app-booting');return;}
 html.classList.add('genius-app-revealing');
 html.classList.remove('genius-app-booting');
 const remove=()=>{overlay.remove();html.classList.remove('genius-app-revealing')};
 if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){remove();return;}
 // Paint the fully prepared page under the opaque cover before fading it.
 requestAnimationFrame(()=>requestAnimationFrame(()=>{overlay.classList.add('gb-fade');overlay.addEventListener('transitionend',remove,{once:true});setTimeout(remove,420)}));
}
async function finish(status='ready'){
 if(done)return;
 if(status!=='ready'||focused||!pilot){release(status);return;}
 if(finishing)return;finishing=true;
 if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
 // Let DOMContentLoaded mount callbacks register their promises first.
 await Promise.resolve();
 while(pending.size&&!done)await Promise.allSettled([...pending]);
 if(done)return;
 release('ready');
}
function startAuth(task){
 if(!authTask){authTask=Promise.resolve().then(task);authTask.catch(()=>{});}
 return authTask;
}
window.WillenaGeniusBoot={version,warm,finish,track,continue:()=>release('partial'),startAuth,getAuth:()=>authTask};
if(!pilot||focused)return;
document.documentElement.classList.add('genius-app-booting');
const style=document.createElement('style');
style.textContent=
'html.genius-app-booting .study-app{visibility:hidden}html:not(.genius-app-booting):not(.genius-app-revealing) #geniusBootSkeleton{display:none!important}'+
'html.genius-app-booting #vocabLoading{display:none!important}'+
'#geniusBootSkeleton{position:fixed;inset:0;z-index:2147482000;overflow:auto;display:grid;place-items:center;background:linear-gradient(145deg,#ba347d 0%,#9b3986 36%,#087d9d 100%);color:#fff;font:700 14px Poppins,system-ui,sans-serif;padding:20px;box-sizing:border-box;opacity:1;transition:opacity 280ms ease}'+
'#geniusBootSkeleton.gb-fade{opacity:0;pointer-events:none}.gb-splash{position:relative;isolation:isolate;display:flex;flex-direction:column;align-items:center;text-align:center;gap:13px;width:100%;max-width:520px;padding:35px 8px;box-sizing:border-box}.gb-halo{position:absolute;z-index:-1;left:50%;top:43%;transform:translate(-50%,-50%);width:min(85vw,390px);aspect-ratio:1;border:1px solid #ffc0e6;border-radius:50%;box-shadow:0 0 22px #7aebf577,inset 0 0 25px #7aebf555;pointer-events:none}.gb-halo:before,.gb-halo:after{content:"";position:absolute;inset:9%;border:2px solid #8ff4ff;border-radius:50%}.gb-halo:after{inset:18%;border:1px dashed #ffffff88}.gb-brand{width:clamp(76px,22vw,114px);height:clamp(76px,22vw,114px);border:3px solid #b1f1f5;border-radius:50%;background:#fff;display:grid;place-items:center;box-sizing:border-box;padding:12px}.gb-brand img{width:100%;height:100%;object-fit:contain}.gb-heading{font-size:clamp(28px,8vw,52px);line-height:1.05;font-weight:900;letter-spacing:-.045em;text-shadow:0 3px 7px #0004}.gb-status{font-size:13px;color:#fff;margin:0}.gb-retry{border:1px solid #ffffffad;border-radius:999px;padding:9px 16px;color:white;background:#ffffff24;font:inherit}.gb-retry[hidden]{display:none!important}.gb-progress{height:4px;overflow:hidden;background:#ffffff44;border-radius:20px;width:130px;margin:6px auto}.gb-progress i{display:block;width:45%;height:100%;background:#fff;border-radius:20px;animation:gb-slide .6s ease-in-out infinite alternate}@keyframes gb-slide{to{transform:translateX(120%)}}@media(prefers-reduced-motion:reduce){.gb-progress i{animation:none}#geniusBootSkeleton{transition:none}}';
document.head.append(style);
timer=setTimeout(()=>{
 const el=document.getElementById('geniusBootSkeleton');if(done||!el)return;
 const status=el.querySelector('.gb-status');if(status)status.textContent='연결이 느려요. 다시 시도할 수 있어요.';
 el.querySelectorAll('.gb-retry').forEach(b=>b.hidden=false);
},15000);
})();
