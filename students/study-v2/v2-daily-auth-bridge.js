(function(global){
'use strict';

/*
 * Daily Study talks directly to the daily-study Worker because that endpoint is
 * not a normal /.netlify/functions route. The rest of Study V2 can stay logged
 * in through the persistent Willena session cookie even after the locally cached
 * Supabase access token has expired. In that case the Worker sees the stale
 * bearer token and returns 401.
 *
 * Keep the direct Worker request, but transparently refresh the access token
 * through the persistent Willena session and retry the failed Daily Study call
 * once. This deliberately affects only /api/daily-study.
 */
var nativeFetch=global.fetch.bind(global);
var DAILY_RE=/^https:\/\/willena-proxy\.willena\.workers\.dev\/api\/daily-study(?:\?|$)/i;
var refreshPromise=null;

function clean(v){return String(v==null?'':v).trim();}

async function refreshDailyToken(){
  if(refreshPromise)return refreshPromise;
  refreshPromise=(async function(){
    try{
      var api=global.WillenaAPI;
      if(!api||typeof api.fetch!=='function')return '';
      var r=await api.fetch('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now(),{
        cache:'no-store',
        credentials:'include'
      });
      var d=await r.json().catch(function(){return {};});
      if(!r.ok||!d||!d.success||!d.access_token)return '';
      if(typeof api.setLocalTokens==='function')api.setLocalTokens(d.access_token,d.refresh_token||'');
      try{global.dispatchEvent(new CustomEvent('auth:changed'));}catch(_){}
      return clean(d.access_token);
    }catch(e){
      console.warn('[Daily Study auth] persistent-session refresh failed',e);
      return '';
    }finally{
      refreshPromise=null;
    }
  })();
  return refreshPromise;
}

global.fetch=async function(input,init){
  var url='';
  try{url=typeof input==='string'?input:(input&&input.url)||'';}catch(_){}
  if(!DAILY_RE.test(url))return nativeFetch(input,init);

  var first=await nativeFetch(input,init);
  if(first.status!==401)return first;

  var token=await refreshDailyToken();
  if(!token)return first;

  var retry=Object.assign({},init||{});
  var headers;
  try{
    headers=new Headers((init&&init.headers)||(input instanceof Request?input.headers:undefined));
  }catch(_){headers=new Headers();}
  headers.set('Authorization','Bearer '+token);
  retry.headers=headers;
  retry.credentials='omit';
  retry.cache='no-store';

  console.info('[Daily Study auth] refreshed persistent session token; retrying request');
  return nativeFetch(input,retry);
};

})(window);
