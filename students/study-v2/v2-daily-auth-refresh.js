(function(global){
'use strict';

var DAILY_WORKER='https://willena-proxy.willena.workers.dev/api/daily-study';
var DAILY_GATEWAY='https://api.willenaenglish.com/api/daily-study';
var nativeFetch=global.fetch.bind(global);
var refreshPromise=null;

function text(v){return String(v==null?'':v).trim();}
function tokenFromHeaders(headers){
  try{
    var h=headers instanceof Headers?headers:new Headers(headers||{});
    var value=text(h.get('Authorization'));
    return /^Bearer\s+/i.test(value)?value.replace(/^Bearer\s+/i,'').trim():'';
  }catch(_){return'';}
}
function localToken(){
  try{
    var api=global.WillenaAPI;
    return text(api&&api.getLocalAccessToken?api.getLocalAccessToken():localStorage.getItem('sb_access_token'));
  }catch(_){return'';}
}
function tokenExpiry(token){
  try{
    var part=String(token||'').split('.')[1];if(!part)return 0;
    part=part.replace(/-/g,'+').replace(/_/g,'/');while(part.length%4)part+='=';
    var payload=JSON.parse(atob(part));return Number(payload&&payload.exp)||0;
  }catch(_){return 0;}
}
function tokenNeedsRefresh(token){
  var exp=tokenExpiry(token);
  return !token||!exp||exp<=Math.floor(Date.now()/1000)+90;
}
async function refreshToken(){
  if(refreshPromise)return refreshPromise;
  refreshPromise=(async function(){
    try{
      var api=global.WillenaAPI;
      if(!api||typeof api.fetch!=='function')return'';
      var r=await api.fetch('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now(),{credentials:'include',cache:'no-store'});
      var d=await r.json().catch(function(){return{};});
      if(!r.ok||!d||!d.success||!d.access_token)return'';
      if(api.setLocalTokens)api.setLocalTokens(d.access_token,'');
      try{global.dispatchEvent(new CustomEvent('auth:changed'));}catch(_){}
      return text(d.access_token);
    }catch(_){return'';}
    finally{refreshPromise=null;}
  })();
  return refreshPromise;
}
function cloneOptions(init,token){
  var opts=Object.assign({},init||{}),headers=new Headers(opts.headers||{});
  if(token)headers.set('Authorization','Bearer '+token);
  opts.headers=headers;
  opts.credentials='omit';
  return opts;
}
function dailyUrl(input){
  var url='';
  try{url=input instanceof Request?input.url:String(input||'');}catch(_){url=String(input||'');}
  return url;
}
function workerInput(input,url){
  if(url.indexOf(DAILY_GATEWAY)!==0)return input;
  var target=DAILY_WORKER+url.slice(DAILY_GATEWAY.length);
  if(input instanceof Request)return new Request(target,input);
  return target;
}

global.fetch=async function(input,init){
  var url=dailyUrl(input);
  if(url.indexOf(DAILY_WORKER)!==0&&url.indexOf(DAILY_GATEWAY)!==0)return nativeFetch(input,init);

  var opts=init||{};
  var token=tokenFromHeaders(opts.headers)||localToken();
  if(tokenNeedsRefresh(token)){
    var fresh=await refreshToken();
    if(fresh)token=fresh;
  }
  opts=cloneOptions(opts,token);
  var target=workerInput(input,url);
  var response=await nativeFetch(target,opts);
  if(response.status!==401)return response;

  var retryToken=await refreshToken();
  if(!retryToken)return response;
  return nativeFetch(target,cloneOptions(opts,retryToken));
};
})(window);
