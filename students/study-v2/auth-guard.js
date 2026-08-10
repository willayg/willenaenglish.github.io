(function(){
'use strict';
var NEXT='/students/study-v2/';
var LOGIN='/students/login.html?next='+encodeURIComponent(NEXT);
async function requestProfile(){return (window.WillenaAPI?WillenaAPI.fetch:fetch)('/.netlify/functions/progress_summary?section=my_progress&_='+Date.now(),{credentials:'include',cache:'no-store'});}
async function refresh(){try{var r=await (window.WillenaAPI?WillenaAPI.fetch:fetch)('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now(),{credentials:'include',cache:'no-store'});var d=await r.json().catch(function(){return{}});if(!r.ok||!d.success)return false;if(d.access_token&&window.WillenaAPI&&WillenaAPI.setLocalTokens)WillenaAPI.setLocalTokens(d.access_token,d.refresh_token);return true;}catch(_){return false;}}
async function guard(){try{var r=await requestProfile();if(r.status!==401&&r.status!==403)return true;if(await refresh()){r=await requestProfile();if(r.status!==401&&r.status!==403)return true;}location.replace(LOGIN);return false;}catch(_){return true;}}
window.WillenaStudyV2AuthReady=guard();
})();
