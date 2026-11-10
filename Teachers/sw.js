// Willena Teachers PWA, Phase 2. Intentionally no fetch interception or caching.
// Student records, API responses, login state, and pages always use the network.
'use strict';
self.addEventListener('install',()=>{self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())});
// Phase 3 will add push subscriptions and a verified notification dispatcher.
// Safe notification-click routing is prepared, but no subscriptions are created.
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const payload=event.notification.data||{};
 const target=typeof payload.url==='string'?payload.url:'/Teachers/';
 const url=new URL(target,self.location.origin);
 if(url.origin!==self.location.origin||!url.pathname.startsWith('/Teachers/'))return;
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(w=>new URL(w.url).pathname.startsWith('/Teachers/'));
  if(existing){await existing.focus();return existing.navigate(url.href)}
  return self.clients.openWindow(url.href);
 })());
});
