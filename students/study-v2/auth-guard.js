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
function requestToken(input,init){
  try{
    var headers=new Headers((init&&init.headers)||(input instanceof Request?input.headers:undefined));
    var auth=String(headers.get('Authorization')||'').trim();
    if(/^Bearer\s+\S+/i.test(auth))return auth.replace(/^Bearer\s+/i,'').trim();
  }catch(_){}
  return'';
}
function withDailyToken(input,init,token){
  var retry=Object.assign({},init||{}),headers;
  try{headers=new Headers((init&&init.headers)||(input instanceof Request?input.headers:undefined));}catch(_){headers=new Headers();}
  if(token)headers.set('Authorization','Bearer '+token);
  retry.headers=headers;
  retry.credentials='omit';
  retry.cache='no-store';
  return retry;
}
async function refreshDailyToken(){
  if(!dailyRefreshPromise){
    dailyRefreshPromise=(async function(){
      try{return await refresh()?localAccessToken():'';}
      finally{dailyRefreshPromise=null;}
    })();
  }
  return dailyRefreshPromise;
}

/*
 * Daily Study talks directly to its Worker with a bearer token. The rest of the
 * app can stay signed in through the persistent Willena session cookie, so make
 * sure a bearer token exists before the Worker request. If an existing token is
 * stale, refresh it from that persistent session and retry once.
 */
window.fetch=async function(input,init){
  var url='';
  try{url=typeof input==='string'?input:(input&&input.url)||'';}catch(_){}
  if(!DAILY_RE.test(url))return nativeFetch(input,init);

  var token=requestToken(input,init)||localAccessToken();
  var firstInit=init;
  if(!token){
    token=await refreshDailyToken();
    if(token)firstInit=withDailyToken(input,init,token);
  }

  var first=await nativeFetch(input,firstInit);
  if(first.status!==401&&first.status!==403)return first;

  token=await refreshDailyToken();
  if(!token)return first;

  console.info('[Study V2 auth] restored persistent session token for Daily Study');
  return nativeFetch(input,withDailyToken(input,init,token));
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
