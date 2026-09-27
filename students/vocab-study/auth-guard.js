(function(){
'use strict';

var NEXT='/students/vocab-study/';
var LOGIN='/students/signin.html?next='+encodeURIComponent(NEXT);
var guardStarted=(window.performance&&performance.now)?performance.now():Date.now();

function authFetch(path,options){
  var fn=window.WillenaAPI&&typeof window.WillenaAPI.fetch==='function'
    ?window.WillenaAPI.fetch.bind(window.WillenaAPI)
    :window.fetch.bind(window);
  return fn(path,Object.assign({credentials:'include',cache:'no-store'},options||{}));
}
async function whoami(){
  try{
    var r=await authFetch('/.netlify/functions/supabase_auth?action=whoami&_='+Date.now());
    var d=await r.json().catch(function(){return{}});
    return r.ok&&d&&d.success?d:null;
  }catch(_){return null;}
}
async function recoverSession(){
  try{
    var r=await authFetch('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now());
    var d=await r.json().catch(function(){return{}});
    if(!r.ok||!d||!d.success||!d.access_token)return false;
    if(window.WillenaAPI&&window.WillenaAPI.setLocalTokens)window.WillenaAPI.setLocalTokens(d.access_token,'');
    try{window.dispatchEvent(new CustomEvent('auth:changed'));}catch(_){}
    return true;
  }catch(_){return false;}
}
async function guard(){
  var first=await whoami();
  if(first){first.auth_elapsed_ms=Math.round((((window.performance&&performance.now)?performance.now():Date.now())-guardStarted)*10)/10;return first;}
  if(await recoverSession()){
    var recovered=await whoami();
    if(recovered){recovered.auth_elapsed_ms=Math.round((((window.performance&&performance.now)?performance.now():Date.now())-guardStarted)*10)/10;return recovered;}
  }
  location.replace(LOGIN);
  return null;
}
window.WillenaVocabStudyAuthReady=guard();
})();