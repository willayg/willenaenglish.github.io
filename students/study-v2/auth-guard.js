(function(){
'use strict';
var NEXT='/students/study-v2/';
var LOGIN='/students/signin.html?next='+encodeURIComponent(NEXT);
var DAILY_RE=/^https:\/\/willena-proxy\.willena\.workers\.dev\/api\/daily-study(?:\?|$)/i;
var SUPABASE_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var SUPABASE_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var nativeFetch=window.fetch.bind(window);
var dailyRefreshPromise=null;

function authFetch(path,options){return (window.WillenaAPI?WillenaAPI.fetch:fetch)(path,Object.assign({credentials:'include',cache:'no-store'},options||{}));}
async function whoami(){try{var r=await authFetch('/.netlify/functions/supabase_auth?action=whoami&_='+Date.now());var d=await r.json().catch(function(){return{}});return !!(r.ok&&d&&d.success);}catch(_){return false;}}
function localAccessToken(){try{return String((window.WillenaAPI&&WillenaAPI.getLocalAccessToken?WillenaAPI.getLocalAccessToken():localStorage.getItem('sb_access_token'))||'').trim();}catch(_){return'';}}
function localRefreshToken(){try{return String(localStorage.getItem('sb_refresh_token')||'').trim();}catch(_){return'';}}
function saveTokens(accessToken,refreshToken){
  if(!accessToken)return;
  try{
    if(window.WillenaAPI&&WillenaAPI.setLocalTokens)WillenaAPI.setLocalTokens(accessToken,refreshToken||'');
    else{
      localStorage.setItem('sb_access_token',accessToken);
      if(refreshToken)localStorage.setItem('sb_refresh_token',refreshToken);
    }
  }catch(_){}
}
async function refreshFromSession(){
  try{
    var r=await authFetch('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now());
    var d=await r.json().catch(function(){return{}});
    var token=String(d&&d.access_token||'').trim();
    if(!r.ok||!d||!d.success||!token)return'';
    saveTokens(token,d.refresh_token||'');
    try{window.dispatchEvent(new CustomEvent('auth:changed'));}catch(_){}
    return token;
  }catch(_){return'';}
}
async function refreshFromLocalRefreshToken(){
  var refreshToken=localRefreshToken();
  if(!refreshToken)return'';
  try{
    var r=await nativeFetch(SUPABASE_URL+'/auth/v1/token?grant_type=refresh_token',{
      method:'POST',cache:'no-store',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:refreshToken})
    });
    var d=await r.json().catch(function(){return{}});
    var token=String(d&&d.access_token||'').trim();
    if(!r.ok||!token)return'';
    saveTokens(token,d.refresh_token||refreshToken);
    try{window.dispatchEvent(new CustomEvent('auth:changed'));}catch(_){}
    return token;
  }catch(_){return'';}
}
function tokenExpiresSoon(token,skewSeconds){
  try{var parts=String(token||'').split('.');if(parts.length<2)return true;var body=parts[1].replace(/-/g,'+').replace(/_/g,'/');while(body.length%4)body+='=';var data=JSON.parse(atob(body));var exp=Number(data&&data.exp);return !Number.isFinite(exp)||exp*1000<=Date.now()+(Number(skewSeconds)||90)*1000;}catch(_){return true;}
}
function requestToken(input,init){try{var headers=new Headers((init&&init.headers)||(input instanceof Request?input.headers:undefined));var auth=String(headers.get('Authorization')||'').trim();if(/^Bearer\s+\S+/i.test(auth))return auth.replace(/^Bearer\s+/i,'').trim();}catch(_){}return'';}
function withDailyToken(input,init,token){var retry=Object.assign({},init||{}),headers;try{headers=new Headers((init&&init.headers)||(input instanceof Request?input.headers:undefined));}catch(_){headers=new Headers();}if(token)headers.set('Authorization','Bearer '+token);retry.headers=headers;retry.credentials='omit';retry.cache='no-store';return retry;}
async function recoverDailyToken(forceLocalRefresh){if(dailyRefreshPromise)return dailyRefreshPromise;dailyRefreshPromise=(async function(){try{var token='';if(!forceLocalRefresh)token=await refreshFromSession();if(!token)token=await refreshFromLocalRefreshToken();return token||'';}finally{dailyRefreshPromise=null;}})();return dailyRefreshPromise;}
async function currentDailyToken(forceRefresh){var token=localAccessToken();if(forceRefresh||!token||tokenExpiresSoon(token,90)){var fresh=await recoverDailyToken(!!forceRefresh);if(fresh)token=fresh;}return token||'';}
window.WillenaStudyV2GetAccessToken=currentDailyToken;
window.fetch=async function(input,init){
  var url='';try{url=typeof input==='string'?input:(input&&input.url)||'';}catch(_){}
  if(!DAILY_RE.test(url))return nativeFetch(input,init);
  var token=requestToken(input,init)||localAccessToken();
  if(!token||tokenExpiresSoon(token,90)){var fresh=await recoverDailyToken(false);if(fresh)token=fresh;}
  var first=await nativeFetch(input,token?withDailyToken(input,init,token):init);
  if(first.status!==401&&first.status!==403)return first;
  token=await recoverDailyToken(true);
  if(!token)return first;
  return nativeFetch(input,withDailyToken(input,init,token));
};
async function guard(){
  if(await whoami()){if(!localAccessToken())recoverDailyToken(false).catch(function(){});return true;}
  if(await refreshFromSession()&&await whoami())return true;
  location.replace(LOGIN);return false;
}
window.WillenaStudyV2AuthReady=guard();
})();
