(function(global){
'use strict';
var BASE_KEY='willena-study-v2-language';
var restored=false;
function text(v){return String(v==null?'':v).trim();}
function uid(){try{return text(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function key(){var id=uid();return id?BASE_KEY+':'+id:BASE_KEY;}
function currentFromButton(){var b=document.getElementById('languageBtn');if(!b)return'';return text(b.textContent)==='한국어'?'en':'ko';}
function read(){try{var v=text(localStorage.getItem(key())||localStorage.getItem(BASE_KEY));return v==='en'||v==='ko'?v:'';}catch(_){return'';}}
function save(lang){if(lang!=='en'&&lang!=='ko')return;try{localStorage.setItem(key(),lang);localStorage.setItem(BASE_KEY,lang);}catch(_){}}
function restore(){
  if(restored)return;
  var b=document.getElementById('languageBtn'),wanted=read();
  if(!b)return;
  restored=true;
  if(!wanted){save(currentFromButton());return;}
  var current=currentFromButton();
  if(current&&current!==wanted)b.click();
}
function bind(){
  var b=document.getElementById('languageBtn');
  if(b)b.addEventListener('click',function(){setTimeout(function(){save(currentFromButton());},0);});
  global.addEventListener('willena:study-v2-ready',restore,{once:true});
}
bind();
})(window);
