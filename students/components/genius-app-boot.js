/* Shared, visual-only app startup and selected-app resource warming.
 * Never cache identity or authorization between documents. No activity writes. */
(function(){
'use strict';
if(window.WillenaGeniusBoot)return;
const version='20261126-pilot1';
const assets={
 '/students/vocab-study/':{
  entry:'/students/vocab-study/vocab-study.js?v=20261126-boot1',
  css:['/students/vocab-study/vocab-study.css?v=20261111-word-fragments5','/students/study/study.css?v=20260808-7','/students/study-v2/v2.css?v=20260814-daily1']},
 '/students/sentence-genius/':{
  entry:'/students/sentence-genius/app.js?v=20261126-boot1',
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
let done=false,timer=0,authTask=null,started=performance.now();
function finish(status='ready'){
 if(done)return;done=true;clearTimeout(timer);
 document.documentElement.classList.remove('genius-app-booting');
 document.getElementById('geniusBootSkeleton')?.remove();
 const detail={status,ms:Math.round(performance.now()),bootMs:Math.round(performance.now()-started)};
 window.WillenaGeniusBootMetrics=detail;
 try{performance.mark('genius-app-'+status)}catch{}
 console.info('[Genius boot]',detail);
}
function startAuth(task){
 if(!authTask){authTask=Promise.resolve().then(task);authTask.catch(()=>{});}
 return authTask;
}
window.WillenaGeniusBoot={version,warm,finish,startAuth,getAuth:()=>authTask};
if(!pilot||focused)return;
document.documentElement.classList.add('genius-app-booting');
const style=document.createElement('style');
style.textContent=
'html.genius-app-booting .study-app{visibility:hidden}html:not(.genius-app-booting) #geniusBootSkeleton{display:none!important}'+
'html.genius-app-booting #vocabLoading{display:none!important}'+
'#geniusBootSkeleton{position:fixed;inset:0;z-index:2147482000;overflow:auto;background:#f5fbfc;color:#276f79;font:700 14px Poppins,system-ui,sans-serif;padding:env(safe-area-inset-top) 14px 20px;box-sizing:border-box}'+
'.gb-head{max-width:760px;margin:auto;display:flex;align-items:center;gap:12px;min-height:68px;padding:8px 5px;box-sizing:border-box}.gb-brand{height:42px;width:42px;border-radius:14px;background:#e0f2f4;display:grid;place-items:center;flex:none}.gb-brand img{width:31px;height:31px;object-fit:contain}.gb-heading{flex:1;font-size:19px;font-weight:850}.gb-line{display:block;background:#e0edef;border-radius:9px;height:11px}.gb-body{max-width:620px;margin:20px auto;display:grid;gap:12px}.gb-label{height:13px;width:40%;margin:10px 0}.gb-card{display:flex;align-items:center;gap:12px;border:2px solid #dcebed;border-radius:20px;padding:20px 15px;background:#fff;min-height:44px}.gb-card .gb-line{width:58%}.gb-card .gb-arrow{margin-left:auto;width:13px;height:13px;transform:rotate(-45deg);border-right:3px solid #cddfe2;border-bottom:3px solid #cddfe2}.gb-pips{display:flex;justify-content:center;gap:5px;margin:6px}.gb-pips i{width:17px;height:17px;border-radius:50%;background:#dcebed}.gb-status{font-size:12px;text-align:center;color:#6c8e96;font-weight:600;margin:12px 0}.gb-retry{display:block;margin:10px auto;border:1px solid #a8dbe0;border-radius:12px;padding:10px 18px;color:#247d85;background:#fff;font:inherit}.gb-retry[hidden]{display:none}.gb-progress{height:4px;overflow:hidden;background:#e1eff0;border-radius:20px;width:130px;margin:12px auto}.gb-progress i{display:block;width:45%;height:100%;background:linear-gradient(90deg,#65cbd3,#ee86b7);border-radius:20px;animation:gb-slide .85s ease-in-out infinite alternate}@keyframes gb-slide{to{transform:translateX(120%)}}@media(prefers-reduced-motion:reduce){.gb-progress i{animation:none}}';
document.head.append(style);
timer=setTimeout(()=>{
 const el=document.getElementById('geniusBootSkeleton');if(done||!el)return;
 const status=el.querySelector('.gb-status');if(status)status.textContent='연결이 느려요. 다시 시도할 수 있어요.';
 const retry=el.querySelector('.gb-retry');if(retry)retry.hidden=false;
},15000);
})();
