(function(){
'use strict';
var NEXT='/students/study-v2/';
var LOGIN='/students/signin.html?next='+encodeURIComponent(NEXT);
var DAILY_RE=/^https:\/\/willena-proxy\.willena\.workers\.dev\/api\/daily-study(?:\?|$)/i;
var nativeFetch=window.fetch.bind(window);
var dailyRefreshPromise=null;

function authFetch(path,options){return (window.WillenaAPI?WillenaAPI.fetch:fetch)(path,Object.assign({credentials:'include',cache:'no-store'},options||{}));}
async function whoami(){try{var r=await authFetch('/.netlify/functions/supabase_auth?action=whoami&_='+Date.now());var d=await r.json().catch(function(){return{}});return !!(r.ok&&d&&d.success);}catch(_){return false;}}
function localAccessToken(){try{return String((window.WillenaAPI&&WillenaAPI.getLocalAccessToken?WillenaAPI.getLocalAccessToken():localStorage.getItem('sb_access_token'))||'').trim();}catch(_){return'';}}
function saveAccessToken(token,refreshToken){
  if(!token)return;
  try{
    if(window.WillenaAPI&&WillenaAPI.setLocalTokens)WillenaAPI.setLocalTokens(token,refreshToken||'');
    else localStorage.setItem('sb_access_token',token);
  }catch(_){}
}
async function refresh(){
  try{
    var r=await authFetch('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now());
    var d=await r.json().catch(function(){return{}});
    var token=String(d&&d.access_token||'').trim();
    if(!r.ok||!d||!d.success||!token)return'';
    saveAccessToken(token,d.refresh_token||'');
    try{window.dispatchEvent(new CustomEvent('auth:changed'));}catch(_){}
    return token;
  }catch(_){return'';}
}
function tokenExpiresSoon(token,skewSeconds){
  try{
    var parts=String(token||'').split('.');
    if(parts.length<2)return false;
    var body=parts[1].replace(/-/g,'+').replace(/_/g,'/');
    while(body.length%4)body+='=';
    var data=JSON.parse(atob(body));
    var exp=Number(data&&data.exp);
    return Number.isFinite(exp)&&exp*1000<=Date.now()+(Number(skewSeconds)||90)*1000;
  }catch(_){return false;}
}
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
      try{return await refresh();}
      finally{dailyRefreshPromise=null;}
    })();
  }
  return dailyRefreshPromise;
}
async function currentDailyToken(forceRefresh){
  var token=localAccessToken();
  if(forceRefresh||!token||tokenExpiresSoon(token,90)){
    var fresh=await refreshDailyToken();
    if(fresh)token=fresh;
  }
  return token||'';
}

/*
 * Daily Study lives on a workers.dev host and therefore cannot receive the
 * persistent .willenaenglish.com login cookie directly. Bridge that cookie
 * session to a short-lived bearer token on the client, refresh before expiry,
 * and retry once if the Worker rejects it.
 */
window.WillenaStudyV2GetAccessToken=currentDailyToken;
window.fetch=async function(input,init){
  var url='';
  try{url=typeof input==='string'?input:(input&&input.url)||'';}catch(_){}
  if(!DAILY_RE.test(url))return nativeFetch(input,init);

  var token=requestToken(input,init)||localAccessToken();
  if(!token||tokenExpiresSoon(token,90)){
    var fresh=await refreshDailyToken();
    if(fresh)token=fresh;
  }

  var first=await nativeFetch(input,token?withDailyToken(input,init,token):init);
  if(first.status!==401&&first.status!==403)return first;

  token=await refreshDailyToken();
  if(!token)return first;

  console.info('[Study V2 auth] restored persistent session token for Daily Study');
  return nativeFetch(input,withDailyToken(input,init,token));
};

async function guard(){
  if(await whoami()){
    /* Align the direct-Worker bearer token with the persistent cookie session. */
    await refreshDailyToken();
    return true;
  }
  if(await refreshDailyToken()&&await whoami())return true;
  location.replace(LOGIN);
  return false;
}
window.WillenaStudyV2AuthReady=guard();
})();
