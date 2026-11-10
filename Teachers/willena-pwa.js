// Installable Willena Teachers PWA. No student data or auth credentials are cached.
(()=>{
'use strict';
const ROOT='/Teachers/';
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
let installPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
window.addEventListener('appinstalled',()=>{installPrompt=null;updateButton();});
function updateButton(){
 const button=document.getElementById('wcInstallApp');
 if(button)button.hidden=standalone();
}
function guide(){
 const shade=document.createElement('div');
 shade.id='willenaPwaGuide';
 shade.setAttribute('role','presentation');
 shade.style.cssText='position:fixed;inset:0;z-index:100050;background:#152d3b94;display:grid;place-items:center;padding:16px';
 const card=document.createElement('section');
 card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-label','Install Willena Teachers');
 card.style.cssText='background:#fff;border:1px solid #d6e5ea;border-radius:20px;max-width:460px;width:100%;padding:24px;font:14px/1.6 system-ui,sans-serif;box-shadow:0 18px 80px #152d3b55;color:#254451';
 const h=document.createElement('h2');h.textContent='Install Willena Teachers';h.style.cssText='font-size:21px;margin:0 0 12px';
 const p=document.createElement('p');p.style.cssText='margin:0 0 12px';p.textContent=/iPad|iPhone|iPod/.test(navigator.userAgent)
  ?'On iPhone: open this page in Safari, tap Share, then Add to Home Screen. Open the new Willena icon.'
  :'On Android: open this page in Chrome, tap the three-dot menu, then choose Install app or Add to Home screen.';
 const note=document.createElement('p');note.textContent='Log in with your normal Willena staff account. No app-store account is needed. Phone notifications will be added in Phase 3.';note.style.cssText='color:#617d88;font-size:12px;margin:0 0 18px';
 const close=document.createElement('button');close.type='button';close.textContent='Got it';close.style.cssText='padding:10px 20px;background:#eaf9fb;border:1px solid #92d0d9;border-radius:10px;color:#235c68;font-weight:700;cursor:pointer';
 const dismiss=()=>{shade.remove();document.removeEventListener('keydown',escape)};
 const escape=e=>{if(e.key==='Escape')dismiss()};
 close.addEventListener('click',dismiss);shade.addEventListener('click',e=>{if(e.target===shade)dismiss()});
 card.append(h,p,note,close);shade.append(card);document.body.append(shade);document.addEventListener('keydown',escape);close.focus();
}
async function install(){
 if(standalone())return;
 if(installPrompt){
  const pending=installPrompt;installPrompt=null;
  try{await pending.prompt();await pending.userChoice}catch(err){console.warn('PWA install prompt unavailable',err)}
  updateButton();
 }else guide();
}
function init(){
 const button=document.getElementById('wcInstallApp');
 if(button)button.addEventListener('click',install);
 updateButton();
 if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
 navigator.serviceWorker.register(ROOT+'sw.js',{scope:ROOT,updateViaCache:'none'}).catch(error=>{
  console.warn('Willena PWA service worker registration failed',error);
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
