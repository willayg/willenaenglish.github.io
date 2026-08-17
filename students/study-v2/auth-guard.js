(function(){
'use strict';
var NEXT='/students/study-v2/';
var LOGIN='/students/signin.html?next='+encodeURIComponent(NEXT);
var DAILY_DIRECT_RE=/^https:\/\/willena-proxy\.willena\.workers\.dev\/api\/daily-study(?:\?|$)/i;
var DAILY_GATEWAY='https://api.willenaenglish.com/api/daily-study';
var nativeFetch=window.fetch.bind(window);

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
async function refresh(){
  try{
    var r=await authFetch('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now());
    var d=await r.json().catch(function(){return{}});
    if(!r.ok||!d||!d.success)return false;
    if(d.access_token&&window.WillenaAPI&&WillenaAPI.setLocalTokens){
      WillenaAPI.setLocalTokens(d.access_token,d.refresh_token||'');
    }
    try{window.dispatchEvent(new CustomEvent('auth:changed'));}catch(_){}
    return true;
  }catch(_){return false;}
}
function dailyGatewayUrl(url){
  try{return DAILY_GATEWAY+(new URL(url)).search;}
  catch(_){return DAILY_GATEWAY;}
}
function dailyGatewayInit(input,init){
  var opts=Object.assign({},init||{}),headers;
  try{
    headers=new Headers((init&&init.headers)||(input instanceof Request?input.headers:undefined));
  }catch(_){headers=new Headers();}
  headers.delete('Authorization');
  headers.delete('authorization');
  opts.headers=headers;
  opts.credentials='include';
  opts.cache='no-store';
  return opts;
}

/*
 * v2-daily.js historically points at workers.dev. Keep that implementation
 * untouched while routing the request through the deployed Willena API gateway,
 * where the normal .willenaenglish.com persistent login cookie authenticates it.
 */
window.fetch=function(input,init){
  var url='';
  try{url=typeof input==='string'?input:(input&&input.url)||'';}catch(_){}
  if(!DAILY_DIRECT_RE.test(url))return nativeFetch(input,init);
  return nativeFetch(dailyGatewayUrl(url),dailyGatewayInit(input,init));
};

async function guard(){
  if(await whoami())return true;
  if(await refresh()&&await whoami())return true;
  location.replace(LOGIN);
  return false;
}
window.WillenaStudyV2AuthReady=guard();
})();
