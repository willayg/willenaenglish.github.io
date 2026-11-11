// Installable Willena Teachers PWA. No student data or auth credentials are cached.
(()=>{
'use strict';
const ROOT='/Teachers/';
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const isAndroid=()=>/Android/i.test(navigator.userAgent);
const isChrome=()=>/Chrome|CriOS/i.test(navigator.userAgent)&&!/Edg|OPR|SamsungBrowser|DuckDuckGo/i.test(navigator.userAgent);
let installPrompt=null;
let promptAttempted=false;
window.addEventListener('beforeinstallprompt',event=>{
 event.preventDefault();
 installPrompt=event;
 promptAttempted=false;
 updateButton();
});
window.addEventListener('appinstalled',()=>{
 installPrompt=null;
 updateButton();
});
function updateButton(){
 const button=document.getElementById('wcInstallApp');
 if(!button)return;
 button.hidden=standalone();
 button.textContent=installPrompt?'Install app':'Install app';
 button.title=installPrompt?'Install Willena Teachers':'Open the browser installation options for Willena Teachers';
}
async function diagnoseInstall(){
 const issues=[];
 if(!window.isSecureContext)issues.push('HTTPS is unavailable.');
 if(!('serviceWorker' in navigator))issues.push('Service workers are not supported.');
 try{
  const response=await fetch('/Teachers/manifest.webmanifest?v=20261111-install-3',{cache:'no-store'});
  if(!response.ok)issues.push('Manifest HTTP '+response.status);
  else {
   const m=await response.json();
   if(m.display!=='standalone'||!m.start_url||!m.scope)issues.push('Manifest configuration is incomplete.');
   for(const size of [192,512]){
    const info=m.icons?.find(x=>x.sizes===size+'x'+size&&x.type==='image/png');
    if(!info){issues.push('Missing '+size+'px PNG icon.');continue}
    try{
     const r=await fetch(info.src,{cache:'no-store'});
     if(!r.ok){issues.push(size+'px icon HTTP '+r.status);continue}
     if(!/image\/png/i.test(r.headers.get('content-type')||'')){issues.push(size+'px icon has wrong content type.');continue}
     const blob=await r.blob();
     const bitmap=await createImageBitmap(blob);
     const matches=bitmap.width===size&&bitmap.height===size;
     bitmap.close();
     if(!matches)issues.push(size+'px icon dimensions are invalid.');
    }catch(e){issues.push(size+'px icon cannot be decoded: '+e.message)}
   }
  }
 }catch(e){issues.push('Manifest unavailable: '+e.message)}
 try{
  const reg=await navigator.serviceWorker?.getRegistration(ROOT);
  if(!reg?.active)issues.push('The Willena service worker is not active.');
 }catch(e){issues.push('Service worker check failed: '+e.message)}
 return issues;
}
function installGuide(){
 // Browser rules prevent websites from invoking the system installer
 // without a beforeinstallprompt event; this is only the fallback.
 document.getElementById('willenaPwaGuide')?.remove();
 const shade=document.createElement('div');
 shade.id='willenaPwaGuide';
 shade.style.cssText='position:fixed;inset:0;z-index:100050;background:#152d3b94;display:grid;place-items:center;padding:16px';
 const card=document.createElement('section');
 card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-label','Install Willena Teachers');
 card.style.cssText='background:#fff;border:1px solid #d6e5ea;border-radius:20px;max-width:460px;width:100%;padding:24px;font:14px/1.6 system-ui,sans-serif;box-shadow:0 18px 80px #152d3b55;color:#254451';
 const h=document.createElement('h2');h.textContent='Install Willena Teachers';h.style.cssText='font-size:21px;margin:0 0 12px';
 const p=document.createElement('p');p.style.cssText='margin:0 0 12px';
 if(isIOS())p.textContent='Open this page in Safari, tap Share, then Add to Home Screen. The install prompt cannot be opened directly on iPhone.';
 else if(isAndroid())p.textContent=isChrome()
  ?'Chrome has not made its install prompt available. Open Chrome’s ⋮ menu and choose Install app or Add to Home screen. If Willena is already listed in Android Settings → Apps, remove that old installation first.'
  :'Open this page in Chrome (not an in-app browser), then use Chrome’s ⋮ menu → Install app or Add to Home screen.';
 else p.textContent=isChrome()
  ?'Chrome has not offered the site installation prompt yet. Use Chrome’s ⋮ menu → Cast, save and share → Install page as app (or the Install icon in the address bar).'
  :'Use your browser menu to install this site as an app. On Windows, Chrome or Edge is recommended.';
 const detail=document.createElement('p');detail.textContent='Checking installation requirements…';detail.style.cssText='color:#617d88;font-size:12px;margin:0 0 18px';
 const close=document.createElement('button');close.type='button';close.textContent='Close';close.style.cssText='padding:10px 20px;background:#eaf9fb;border:1px solid #92d0d9;border-radius:10px;color:#235c68;font-weight:700;cursor:pointer';
 const dismiss=()=>{shade.remove();document.removeEventListener('keydown',escape)};
 const escape=e=>{if(e.key==='Escape')dismiss()};
 close.addEventListener('click',dismiss);shade.addEventListener('click',e=>{if(e.target===shade)dismiss()});
 card.append(h,p,detail,close);shade.append(card);document.body.append(shade);document.addEventListener('keydown',escape);close.focus();
 diagnoseInstall().then(issues=>{
  if(!detail.isConnected)return;
  detail.textContent=issues.length?'Installation check: '+issues.join(' '):'The manifest, icon, and service worker are present. The browser must still offer installation; a website cannot bypass that permission.';
 }).catch(()=>{detail.textContent='Unable to run installation checks.'});
}
async function install(){
 if(standalone())return;
 if(installPrompt){
  const pending=installPrompt;
  installPrompt=null;
  promptAttempted=true;
  try{
   await pending.prompt();
   const result=await pending.userChoice;
   if(result?.outcome==='accepted')return;
  }catch(error){console.warn('Willena native install prompt failed',error)}
  updateButton();
 }
 installGuide();
}

// Willena Web Push preferences. Permission is requested ONLY after a user tap.
const PUSH='/api/staff-push';
let pushStatus=null;
function toBytes(value){
 const padded=value.replace(/-/g,'+').replace(/_/g,'/');
 return Uint8Array.from(atob(padded.padEnd(Math.ceil(padded.length/4)*4,'=')),ch=>ch.charCodeAt(0));
}
async function pushAPI(method,path,body){
 const headers={'content-type':'application/json'};
 const token=window.WillenaAPI?.getLocalAccessToken?.()||'';
 if(token.split('.').length===3)headers.Authorization='Bearer '+token;
 const r=await fetch(PUSH+path,{method,headers,credentials:'include',cache:'no-store',body:body===undefined?undefined:JSON.stringify(body)});
 const json=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(json.error||'Notification request failed ('+r.status+')');
 return json;
}
function pushNotice(value,isError=false){
 const el=document.getElementById('wcPushStatus');
 if(!el)return;
 el.hidden=false;el.textContent=value;
 el.style.color=isError?'#b33b5b':'#267585';
}
function pushButtons(active,admin){
 const enable=document.getElementById('wcEnablePush');
 const disable=document.getElementById('wcDisablePush');
 const test=document.getElementById('wcTestPush');
 if(enable)enable.textContent=active?'Notifications enabled':'Enable notifications';
 if(disable)disable.hidden=!active;
 if(test)test.hidden=!active||!admin;
}
async function currentSubscription(){
 if(!('serviceWorker' in navigator))return null;
 const reg=await navigator.serviceWorker.ready;
 return reg.pushManager.getSubscription();
}
async function refreshPush(){
 if(!document.getElementById('wcEnablePush'))return;
 if(!('PushManager' in window)||!('Notification' in window)||!('serviceWorker' in navigator)){
  pushNotice('This browser does not support Willena Web Push.',true);
  return;
 }
 try{
  const status=await pushAPI('GET','/status');
  pushStatus=status;
  const current=await currentSubscription();
  pushButtons(!!current,status.admin);
  if(!status.configured){
   const button=document.getElementById('wcEnablePush');if(button)button.disabled=true;
   pushNotice('Push sending needs one Cloudflare secret before it can be enabled.',true);
   return;
  }
  const button=document.getElementById('wcEnablePush');if(button)button.disabled=false;
  pushNotice(current?'This device is subscribed to Willena notifications.':'Notifications are not enabled on this device.');
 }catch(e){pushNotice(e.message,true)}
}
async function enablePush(){
 const btn=document.getElementById('wcEnablePush');if(btn)btn.disabled=true;
 try{
  if(!window.isSecureContext||!('PushManager' in window)||!('Notification' in window))throw Error('Push is unavailable in this browser.');
  if(!pushStatus?.configured)throw Error('Administrator must configure the Web Push secret in Cloudflare.');
  // Request permission within the original button gesture (required by iOS).
  let permission=Notification.permission;
  if(permission==='default')permission=await Notification.requestPermission();
  if(permission!=='granted')throw Error('Phone notifications are blocked. Enable them in your device settings.');
  const status=pushStatus;
  const reg=await navigator.serviceWorker.ready;
  const current=await reg.pushManager.getSubscription();
  const sub=current||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:toBytes(status.publicKey)});
  const data=sub.toJSON();
  await pushAPI('POST','/subscribe',{endpoint:data.endpoint,keys:data.keys,device_label:navigator.userAgent.slice(0,150)});
  pushButtons(true,status.admin);
  pushNotice('Notifications enabled on this device. You can send a test notification.');
 }catch(err){pushNotice(err.message,true)}
 finally{if(btn)btn.disabled=false}
}
async function disablePush(){
 const btn=document.getElementById('wcDisablePush');if(btn)btn.disabled=true;
 try{
  const sub=await currentSubscription();
  if(sub){
   await pushAPI('POST','/unsubscribe',{endpoint:sub.endpoint});
   await sub.unsubscribe();
  }
  pushButtons(false,false);pushNotice('Notifications disabled on this device.');
 }catch(e){pushNotice(e.message,true)}
 finally{if(btn)btn.disabled=false}
}
async function testPush(){
 const button=document.getElementById('wcTestPush');if(button)button.disabled=true;
 try{
  const sub=await currentSubscription();if(!sub)throw Error('Enable notifications first.');
  const response=await pushAPI('POST','/test',{endpoint:sub.endpoint});
  pushNotice('Test accepted by push provider ('+response.provider_status+'). Check your phone notifications.');
 }catch(e){pushNotice(e.message,true)}
 finally{if(button)button.disabled=false}
}

function init(){
 const button=document.getElementById('wcInstallApp');
 if(button)button.addEventListener('click',install);
 updateButton();
 for(const [id,fn] of [['wcEnablePush',enablePush],['wcDisablePush',disablePush],['wcTestPush',testPush]]){
  document.getElementById(id)?.addEventListener('click',fn);
 }
 if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
 navigator.serviceWorker.register(ROOT+'sw.js',{scope:ROOT,updateViaCache:'none'}).then(()=>refreshPush()).catch(error=>{
  console.warn('Willena PWA service worker registration failed',error);
 });
}
window.WillenaPush={refresh:refreshPush};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
