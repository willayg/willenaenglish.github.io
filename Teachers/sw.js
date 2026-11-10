// Willena Teachers PWA, Phase 2. Intentionally no fetch interception or caching.
// Student records, API responses, login state, and pages always use the network.
'use strict';
self.addEventListener('install',()=>{self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())});
// Push handlers never cache private data or send messages themselves.
self.addEventListener('push',event=>{
 let data={};
 try{data=event.data?.json()||{}}catch{}
 const title=String(data.title||'Willena Teachers').slice(0,80);
 const body=String(data.body||'You have a Willena notification.').slice(0,180);
 const target=String(data.url||'/Teachers/');
 let url;
 try{url=new URL(target,self.location.origin)}catch{url=new URL('/Teachers/',self.location.origin)}
 if(url.origin!==self.location.origin||!url.pathname.startsWith('/Teachers/'))url=new URL('/Teachers/',self.location.origin);
 event.waitUntil(self.registration.showNotification(title,{
  body,icon:'/Teachers/icons/willena-w.svg',badge:'/Teachers/icons/willena-w.svg',
  tag:String(data.tag||'willena-push').slice(0,100),
  data:{url:url.pathname+url.search},
  renotify:false
 }));
});
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
