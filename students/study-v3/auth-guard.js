(function(){
'use strict';
var NEXT='/students/study-v3/';
var LOGIN='/students/signin.html?next='+encodeURIComponent(NEXT);

function loadV3Sidecar(){
  try{
    if(!document.querySelector('link[data-study-v3-speaking]')){
      var css=document.createElement('link');
      css.rel='stylesheet';
      css.href='./v3-speaking.css?v=20260822-speaking2';
      css.setAttribute('data-study-v3-speaking','1');
      (document.head||document.documentElement).appendChild(css);
    }
    if(!document.querySelector('script[data-study-v3-badge]')){
      var badge=document.createElement('script');
      badge.src='./v3-badge.js?v=20260822-badge1';
      badge.defer=true;
      badge.setAttribute('data-study-v3-badge','1');
      (document.head||document.documentElement).appendChild(badge);
    }
    if(!document.querySelector('script[data-study-v3-speaking-recall]')){
      var recall=document.createElement('script');
      recall.src='./v3-speaking-recall.js?v=20260822-twomode2';
      recall.defer=true;
      recall.setAttribute('data-study-v3-speaking-recall','1');
      (document.head||document.documentElement).appendChild(recall);
    }
  }catch(e){console.warn('[StudyV3] speaking sidecar load failed',e);}
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