(function(){
'use strict';
var NEXT='/students/study-v2/';
var LOGIN='/students/signin.html?next='+encodeURIComponent(NEXT);
function authFetch(path,options){return (window.WillenaAPI?WillenaAPI.fetch:fetch)(path,Object.assign({credentials:'include',cache:'no-store'},options||{}));}
async function whoami(){try{var r=await authFetch('/.netlify/functions/supabase_auth?action=whoami&_='+Date.now());var d=await r.json().catch(function(){return{}});return !!(r.ok&&d&&d.success);}catch(_){return false;}}
async function refresh(){try{var r=await authFetch('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now());var d=await r.json().catch(function(){return{}});if(!r.ok||!d||!d.success)return false;if(d.access_token&&window.WillenaAPI&&WillenaAPI.setLocalTokens)WillenaAPI.setLocalTokens(d.access_token,d.refresh_token);try{window.dispatchEvent(new CustomEvent('auth:changed'));}catch(_){}return true;}catch(_){return false;}}
async function guard(){if(await whoami())return true;if(await refresh()&&await whoami())return true;location.replace(LOGIN);return false;}
window.WillenaStudyV2AuthReady=guard();
})();