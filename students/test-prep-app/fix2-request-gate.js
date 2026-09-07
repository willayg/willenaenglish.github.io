(function(){
'use strict';

var MAX_ACTIVE=2;
var CONTENT_HOST='https://gxwfsqxyuufqtitspfqg.supabase.co/rest/v1/';
var originalFetch=window.fetch.bind(window);
var active=0;
var queue=[];

function requestUrl(input){
  try{
    if(typeof input==='string')return input;
    if(input&&typeof input.url==='string')return input.url;
  }catch(e){}
  return '';
}

function shouldGate(input,init){
  var url=requestUrl(input);
  var method=(init&&init.method)||((input&&input.method)||'GET');
  return String(method).toUpperCase()==='GET'&&url.indexOf(CONTENT_HOST)===0;
}

function pump(){
  while(active<MAX_ACTIVE&&queue.length){
    var job=queue.shift();
    active++;
    originalFetch(job.input,job.init).then(job.resolve,job.reject).then(done,done);
  }
}

function done(){
  active=Math.max(0,active-1);
  pump();
}

window.fetch=function(input,init){
  if(!shouldGate(input,init))return originalFetch(input,init);
  return new Promise(function(resolve,reject){
    queue.push({input:input,init:init,resolve:resolve,reject:reject});
    pump();
  });
};

function badge(){
  if(document.getElementById('tpFix2Badge'))return;
  var el=document.createElement('div');
  el.id='tpFix2Badge';
  el.textContent='Fix2';
  el.style.cssText='position:fixed;right:5px;bottom:4px;z-index:99999;padding:2px 4px;border-radius:5px;background:rgba(0,0,0,.38);color:#fff;font:700 8px/1.1 Arial,sans-serif;letter-spacing:.2px;opacity:.65;pointer-events:none';
  document.body.appendChild(el);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',badge,{once:true});else badge();
console.log('[Test Prep] Fix2 active: content requests capped at 2 concurrent');
})();
