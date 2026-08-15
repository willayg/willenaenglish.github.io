(function(){
'use strict';
var NEXT='/students/study-v2/';
var LOGIN='/students/signin.html?next='+encodeURIComponent(NEXT);
var DAILY_RE=/^https:\/\/willena-proxy\.willena\.workers\.dev\/api\/daily-study(?:\?|$)/i;
var nativeFetch=window.fetch.bind(window);
var dailyRefreshPromise=null;

function authFetch(path,options){return (window.WillenaAPI?WillenaAPI.fetch:fetch)(path,Object.assign({credentials:'include',cache:'no-store'},options||{}));}
async function whoami(){try{var r=await authFetch('/.netlify/functions/supabase_auth?action=whoami&_='+Date.now());var d=await r.json().catch(function(){return{}});return !!(r.ok&&d&&d.success);}catch(_){return false;}}
async function refresh(){try{var r=await authFetch('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now());var d=await r.json().catch(function(){return{}});if(!r.ok||!d||!d.success)return false;if(d.access_token&&window.WillenaAPI&&WillenaAPI.setLocalTokens)WillenaAPI.setLocalTokens(d.access_token,d.refresh_token||'');try{window.dispatchEvent(new CustomEvent('auth:changed'));}catch(_){}return true;}catch(_){return false;}}
function localAccessToken(){try{return String((window.WillenaAPI&&WillenaAPI.getLocalAccessToken?WillenaAPI.getLocalAccessToken():localStorage.getItem('sb_access_token'))||'').trim();}catch(_){return'';}}

/*
 * Daily Study uses a direct Worker request with credentials:'omit' and a bearer
 * token. The page itself can remain authenticated through the persistent Willena
 * cookie after that bearer token expires. If the Worker rejects the stale token,
 * refresh it from the persistent session and retry that Daily Study request once.
 */
window.fetch=async function(input,init){
  var url='';
  try{url=typeof input==='string'?input:(input&&input.url)||'';}catch(_){}
  if(!DAILY_RE.test(url))return nativeFetch(input,init);

  var first=await nativeFetch(input,init);
  if(first.status!==401)return first;

  if(!dailyRefreshPromise){
    dailyRefreshPromise=(async function(){
      try{return await refresh()?localAccessToken():'';}
      finally{dailyRefreshPromise=null;}
    })();
  }
  var token=await dailyRefreshPromise;
  if(!token)return first;

  var retry=Object.assign({},init||{}),headers;
  try{headers=new Headers((init&&init.headers)||(input instanceof Request?input.headers:undefined));}catch(_){headers=new Headers();}
  headers.set('Authorization','Bearer '+token);
  retry.headers=headers;
  retry.credentials='omit';
  retry.cache='no-store';
  console.info('[Study V2 auth] refreshed persistent session token for Daily Study');
  return nativeFetch(input,retry);
};

async function guard(){
  if(await whoami()){
    /* Keep the local bearer token aligned with the persistent login on page load. */
    await refresh();
    return true;
  }
  if(await refresh()&&await whoami())return true;
  location.replace(LOGIN);
  return false;
}
window.WillenaStudyV2AuthReady=guard();
})();
