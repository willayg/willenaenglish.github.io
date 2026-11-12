// Willena Calendar: staff Web Push device registration and diagnostic controls.
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const API='/api/staff-push/';
 const supported=()=>window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
 let statusData=null,subscription=null,busy=false;
 const message=(text,error=false)=>{
  const el=$('wcPushStatus');if(!el)return;
  el.hidden=false;el.textContent=text;el.style.color=error?'#b34263':'#317e89';
 };
 const token=()=>window.WillenaAPI?.getLocalAccessToken?.()||'';
 async function req(path,body){
  const opts={method:body?'POST':'GET',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json',...(token()?{Authorization:'Bearer '+token()}:{})}};
  if(body)opts.body=JSON.stringify(body);
  const response=await fetch(API+path,opts);
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Notification service error ('+response.status+')');
  return data;
 }
 function decodeKey(value){
  const padded=value.replace(/-/g,'+').replace(/_/g,'/');
  const bytes=atob(padded.padEnd(Math.ceil(padded.length/4)*4,'='));
  return Uint8Array.from(bytes,c=>c.charCodeAt(0));
 }
 async function registration(){
  await navigator.serviceWorker.register('/Teachers/sw.js',{scope:'/Teachers/',updateViaCache:'none'});
  return navigator.serviceWorker.ready;
 }
 async function refresh(){
  if(!$('wcEnablePush'))return;
  if(!supported()){
   $('wcEnablePush').disabled=true;
   message('Push notifications are not supported by this browser. Use an HTTPS browser with notifications enabled.',true);
   return;
  }
  try{
   statusData=await req('status');
   const reg=await registration();
   subscription=await reg.pushManager.getSubscription();
   const endpoint=subscription?.endpoint||'';
   const registered=!!endpoint&&statusData.devices?.some(x=>x.endpoint===endpoint);
   $('wcEnablePush').hidden=registered;
   $('wcDisablePush').hidden=!registered;
   $('wcTestPush').hidden=!registered||!statusData.admin;
   if(!statusData.configured){
    $('wcEnablePush').disabled=true;
    message('Push notifications are not configured on Cloudflare. The VAPID private key is required.',true);
   }else if(Notification.permission==='denied'){
    $('wcEnablePush').disabled=true;
    message('Notifications are blocked for this website. Allow them in Chrome site settings and reload.',true);
   }else if(registered){
    message('Notifications enabled on this device. Create a calendar event with Notify staff, or use Send test.');
   }else{
    $('wcEnablePush').disabled=false;
    message(subscription?'This device has a browser subscription but is not registered with Willena. Click Enable notifications.':'Notifications are not enabled on this device.');
   }
  }catch(error){message('Notification status unavailable: '+error.message,true)}
 }
 async function enable(){
  if(busy)return;busy=true;$('wcEnablePush').disabled=true;
  try{
   if(!supported())throw new Error('This browser does not support Web Push.');
   // Browser permission prompt must be triggered directly by a user gesture.
   const permission=await Notification.requestPermission();
   if(permission!=='granted')throw new Error('Browser notification permission was not granted.');
   if(!statusData?.publicKey)statusData=await req('status');
   if(!statusData.configured)throw new Error('Push signing has not been configured on Cloudflare.');
   const reg=await registration();
   let sub=await reg.pushManager.getSubscription();
   if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(statusData.publicKey)});
   const json=sub.toJSON();
   await req('subscribe',{endpoint:sub.endpoint,keys:json.keys,device_label:navigator.userAgent.slice(0,160)});
   message('Device registered successfully. Send a test notification to verify delivery.');
   await refresh();
  }catch(error){message('Could not enable notifications: '+error.message,true)}
  finally{busy=false;$('wcEnablePush').disabled=false}
 }
 async function disable(){
  if(busy)return;busy=true;
  try{
   const reg=await registration(),sub=await reg.pushManager.getSubscription();
   if(sub){await req('unsubscribe',{endpoint:sub.endpoint});await sub.unsubscribe()}
   await refresh();
   message('Notifications disabled on this device.');
  }catch(error){message('Could not disable notifications: '+error.message,true)}
  finally{busy=false}
 }
 async function test(){
  if(busy)return;busy=true;$('wcTestPush').disabled=true;
  try{
   const reg=await registration(),sub=await reg.pushManager.getSubscription();
   if(!sub)throw new Error('Enable notifications on this device first.');
   const result=await req('test',{endpoint:sub.endpoint});
   message('Test accepted by push provider ('+result.provider_status+'). Check this device for the notification.');
  }catch(error){message('Test notification failed: '+error.message,true)}
  finally{busy=false;$('wcTestPush').disabled=false}
 }
 function init(){
  $('wcEnablePush')?.addEventListener('click',enable);
  $('wcDisablePush')?.addEventListener('click',disable);
  $('wcTestPush')?.addEventListener('click',test);
  // Refresh on calendar open and when returning from browser notification settings.
  window.WillenaPush={refresh};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('view-staff-calendar')?.classList.contains('active'))void refresh()});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
