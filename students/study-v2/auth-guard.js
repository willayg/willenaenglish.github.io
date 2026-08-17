(function(){
'use strict';
var NEXT='/students/study-v2/';
var LOGIN='/students/signin.html?next='+encodeURIComponent(NEXT);
var bridgePromise=null;

var api=window.WillenaAPI||null;
var originalApiFetch=api&&typeof api.fetch==='function'?api.fetch.bind(api):null;

function isRefreshRequest(path){
  var s=String(path||'');
  return s.indexOf('supabase_auth')>=0&&/[?&]action=refresh(?:&|$)/.test(s);
}
function bridgePath(path){
  return String(path||'').replace(/([?&])action=refresh(?=&|$)/,'$1action=worker_token');
}

/*
 * Daily Study is the only Study V2 mode that must cross from
 * *.willenaenglish.com to workers.dev. The rest of the app can use the
 * HttpOnly auth cookie directly. Keep one serialized bridge request here so
 * no browser module rotates the refresh token independently.
 */
if(api&&originalApiFetch){
  api.fetch=function(path,options){
    if(!isRefreshRequest(path))return originalApiFetch(path,options);
    if(!bridgePromise){
      bridgePromise=originalApiFetch(bridgePath(path),Object.assign({credentials:'include',cache:'no-store'},options||{}))
        .finally(function(){setTimeout(function(){bridgePromise=null;},0);});
    }
    return bridgePromise.then(function(response){return response.clone();});
  };
}

function authFetch(path,options){
  var fn=window.WillenaAPI&&typeof window.WillenaAPI.fetch==='function'?window.WillenaAPI.fetch.bind(window.WillenaAPI):window.fetch.bind(window);
  return fn(path,Object.assign({credentials:'include',cache:'no-store'},options||{}));
}
async function whoami(){
  try{
    var r=await authFetch('/.netlify/functions/supabase_auth?action=whoami&_='+Date.now());
    var d=await r.json().catch(function(){return{}});
    return !!(r.ok&&d&&d.success);
  }catch(_){return false;}
}
async function recoverSession(){
  try{
    var r=await authFetch('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now());
    var d=await r.json().catch(function(){return{}});
    if(!r.ok||!d||!d.success||!d.access_token)return false;
    if(window.WillenaAPI&&window.WillenaAPI.setLocalTokens){
      window.WillenaAPI.setLocalTokens(d.access_token,'');
    }
    try{window.dispatchEvent(new CustomEvent('auth:changed'));}catch(_){}
    return true;
  }catch(_){return false;}
}
async function guard(){
  if(await whoami())return true;
  if(await recoverSession()&&await whoami())return true;
  location.replace(LOGIN);
  return false;
}
window.WillenaStudyV2AuthReady=guard();
})();
