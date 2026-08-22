(function(){
'use strict';
var NEXT='/students/study-v3/';
var LOGIN='/students/signin.html?next='+encodeURIComponent(NEXT);
var V3_CACHE='20260823-hardbust25';

function loadV3Sidecar(){
  try{
    function addCss(key,src){if(document.querySelector('link['+key+']'))return;var x=document.createElement('link');x.rel='stylesheet';x.href=src+'?v='+V3_CACHE;x.setAttribute(key,'1');(document.head||document.documentElement).appendChild(x);}
    function addJs(key,src){if(document.querySelector('script['+key+']'))return;var x=document.createElement('script');x.src=src+'?v='+V3_CACHE;x.defer=true;x.setAttribute(key,'1');(document.head||document.documentElement).appendChild(x);}
    addCss('data-study-v3-speaking','./v3-speaking.css');
    addCss('data-study-v3-activity-shell','./v3-activity-shell.css');
    addJs('data-study-v3-badge','./v3-badge.js');
    addJs('data-study-v3-speaking-recall','./v3-speaking-recall.js');
    addJs('data-study-v3-speaking-integration','./v3-speaking-integration.js');
    addJs('data-study-v3-speaking-audio-fix','./v3-speaking-audio-fix.js');
    addJs('data-study-v3-speaking-card-icon','./v3-speaking-card-icon.js');
    addJs('data-study-v3-speaking-retry-cue','./v3-speaking-retry-cue.js');
    addJs('data-study-v3-points-optimistic','./v3-points-optimistic.js');
    addJs('data-study-v3-daily-conversation-repair','./v3-daily-conversation-repair.js');
    addJs('data-study-v3-activity-shell','./v3-activity-shell.js');
    addJs('data-study-v3-spelling-tablet-help','./v2-spelling-tablet-help.js');
  }catch(e){console.warn('[StudyV3] sidecar load failed',e);}
}
loadV3Sidecar();

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
    if(window.WillenaAPI&&window.WillenaAPI.setLocalTokens){window.WillenaAPI.setLocalTokens(d.access_token,'');}
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
