(function(){
'use strict';
var NEXT='/students/study-v2/';
var LOGIN='/students/signin.html?next='+encodeURIComponent(NEXT);
var DAILY_RE=/^https:\/\/willena-proxy\.willena\.workers\.dev\/api\/daily-study(?:\?|$)/i;
var nativeFetch=window.fetch.bind(window);
var refreshPromise=null;

function authFetch(path,options){
  return (window.WillenaAPI?WillenaAPI.fetch:fetch)(path,Object.assign({credentials:'include',cache:'no-store'},options||{}));
}
async function whoami(){
  try{
    var r=await authFetch('/.netlify/functions/supabase_auth?action=whoami&_='+Date.now());
    var d=await r.json().catch(function(){return{}});
    return !!(r.ok&&d&&d.success);
  }catch(_){return false;}
}
function localAccessToken(){
  try{
    return String((window.WillenaAPI&&WillenaAPI.getLocalAccessToken?WillenaAPI.getLocalAccessToken():localStorage.getItem('sb_access_token'))||'').trim();
  }catch(_){return'';}
}
function saveAccessToken(token){
  if(!token)return;
  try{
    if(window.WillenaAPI&&WillenaAPI.setLocalTokens)WillenaAPI.setLocalTokens(token);
    else localStorage.setItem('sb_access_token',token);
  }catch(_){}
}
async function refreshAccessToken(){
  if(refreshPromise)return refreshPromise;
  refreshPromise=(async function(){
    try{
      var r=await authFetch('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now());
      var d=await r.json().catch(function(){return{}});
      var token=String(d&&d.access_token||'').trim();
      if(!r.ok||!d||!d.success||!token)return'';
      saveAccessToken(token);
      try{window.dispatchEvent(new CustomEvent('auth:changed'));}catch(_){}
      console.info('[Study V2 auth] restored access token from persistent session');
      return token;
    }catch(_){return'';}
    finally{refreshPromise=null;}
  })();
  return refreshPromise;
}
function tokenExpiresSoon(token,skewSeconds){
  try{
    var parts=String(token||'').split('.');
    if(parts.length<2)return true;
    var body=parts[1].replace(/-/g,'+').replace(/_/g,'/');
    while(body.length%4)body+='=';
    var data=JSON.parse(atob(body));
    var exp=Number(data&&data.exp);
    return !Number.isFinite(exp)||exp*1000<=Date.now()+(Number(skewSeconds)||90)*1000;
  }catch(_){return true;}
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
  var opts=Object.assign({},init||{}),headers;
  try{headers=new Headers((init&&init.headers)||(input instanceof Request?input.headers:undefined));}catch(_){headers=new Headers();}
  if(token)headers.set('Authorization','Bearer '+token);
  opts.headers=headers;
  opts.credentials='omit';
  opts.cache='no-store';
  return opts;
}
async function currentDailyToken(forceRefresh){
  var token=localAccessToken();
  if(forceRefresh||!token||tokenExpiresSoon(token,90)){
    var fresh=await refreshAccessToken();
    if(fresh)token=fresh;
  }
  return token||'';
}

/*
 * Daily Study is hosted on workers.dev, so it cannot receive the shared
 * .willenaenglish.com login cookie. Use the already-deployed supabase_auth
 * refresh endpoint to turn that persistent cookie session into a short-lived
 * bearer token before Daily Study is allowed to run.
 */
window.WillenaStudyV2GetAccessToken=currentDailyToken;
window.fetch=async function(input,init){
  var url='';
  try{url=typeof input==='string'?input:(input&&input.url)||'';}catch(_){}
  if(!DAILY_RE.test(url))return nativeFetch(input,init);

  var token=requestToken(input,init)||localAccessToken();
  if(!token||tokenExpiresSoon(token,90)){
    var fresh=await refreshAccessToken();
    if(fresh)token=fresh;
  }

  var first=await nativeFetch(input,token?withDailyToken(input,init,token):init);
  if(first.status!==401&&first.status!==403)return first;

  token=await refreshAccessToken();
  if(!token)return first;
  return nativeFetch(input,withDailyToken(input,init,token));
};

async function guard(){
  if(await whoami()){
    var token=localAccessToken();
    if(!token||tokenExpiresSoon(token,90))await refreshAccessToken();
    return true;
  }
  if(await refreshAccessToken()&&await whoami())return true;
  location.replace(LOGIN);
  return false;
}
window.WillenaStudyV2AuthReady=guard();
})();
