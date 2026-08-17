(function(){
'use strict';
var NEXT='/students/study-v2/';
var LOGIN='/students/signin.html?next='+encodeURIComponent(NEXT);
var DAILY_RE=/^https:\/\/willena-proxy\.willena\.workers\.dev\/api\/daily-study(?:\?|$)/i;
var DAILY_GATEWAY='https://api.willenaenglish.com/api/daily-study';
var nativeFetch=window.fetch.bind(window);

function authFetch(path,options){return (window.WillenaAPI?WillenaAPI.fetch:fetch)(path,Object.assign({credentials:'include',cache:'no-store'},options||{}));}
async function whoami(){try{var r=await authFetch('/.netlify/functions/supabase_auth?action=whoami&_='+Date.now());var d=await r.json().catch(function(){return{}});return !!(r.ok&&d&&d.success);}catch(_){return false;}}
function localAccessToken(){try{return String((window.WillenaAPI&&WillenaAPI.getLocalAccessToken?WillenaAPI.getLocalAccessToken():localStorage.getItem('sb_access_token'))||'').trim();}catch(_){return'';}}
async function refresh(){
  try{
    var r=await authFetch('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now());
    var d=await r.json().catch(function(){return{}});
    if(!r.ok||!d||!d.success)return false;
    if(d.access_token&&window.WillenaAPI&&WillenaAPI.setLocalTokens)WillenaAPI.setLocalTokens(d.access_token,d.refresh_token||'');
    try{window.dispatchEvent(new CustomEvent('auth:changed'));}catch(_){}
    return true;
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
function gatewayUrl(url){
  try{return DAILY_GATEWAY+(new URL(url)).search;}
  catch(_){return DAILY_GATEWAY;}
}
function gatewayInit(input,init){
  var opts=Object.assign({},init||{}),headers;
  try{headers=new Headers((init&&init.headers)||(input instanceof Request?input.headers:undefined));}catch(_){headers=new Headers();}
  var token=requestToken(input,init)||localAccessToken();
  if(token&&!headers.get('Authorization'))headers.set('Authorization','Bearer '+token);
  opts.headers=headers;
  opts.credentials='include';
  opts.cache='no-store';
  return opts;
}

/*
 * Older Daily Study frontend code points at workers.dev directly. The existing
 * Willena API gateway already exposes /api/daily-study and authenticates it from
 * the normal persistent sb_access cookie (with bearer auth as a fallback).
 * Route those calls through the gateway so Daily Study uses the same persistent
 * login path as the rest of Study V2.
 */
window.fetch=async function(input,init){
  var url='';
  try{url=typeof input==='string'?input:(input&&input.url)||'';}catch(_){}
  if(!DAILY_RE.test(url))return nativeFetch(input,init);
  return nativeFetch(gatewayUrl(url),gatewayInit(input,init));
};

window.WillenaStudyV2GetAccessToken=async function(forceRefresh){
  var token=localAccessToken();
  if(forceRefresh||!token){if(await refresh())token=localAccessToken();}
  return token||'';
};

async function guard(){
  if(await whoami())return true;
  if(await refresh()&&await whoami())return true;
  location.replace(LOGIN);
  return false;
}
window.WillenaStudyV2AuthReady=guard();
})();
