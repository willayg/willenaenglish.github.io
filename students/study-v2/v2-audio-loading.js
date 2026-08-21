(function(global){
'use strict';
var ROOT_IDS=['v2ActivityRoot','aiCoachActivityRoot'];
var SHOW_DELAY=380;

function ensureMessage(button){
  if(!button)return null;
  var host=button.parentElement||button;
  var existing=host.querySelector&&host.querySelector('.v2-audio-loading-message');
  if(existing)return existing;
  var msg=document.createElement('small');
  msg.className='v2-audio-loading-message';
  msg.textContent='AI loading speech…';
  msg.hidden=true;
  host.appendChild(msg);
  return msg;
}

function bindButton(button){
  if(!button||button.dataset.v2AudioLoadingBound==='1')return;
  button.dataset.v2AudioLoadingBound='1';
  var timer=null;
  var msg=ensureMessage(button);

  function hide(){
    if(timer){clearTimeout(timer);timer=null;}
    if(msg)msg.hidden=true;
  }
  function watch(){
    hide();
    timer=setTimeout(function(){
      timer=null;
      if(!button.isConnected||!msg)return;
      if(button.classList.contains('is-playing')&&!button.classList.contains('has-played'))msg.hidden=false;
    },SHOW_DELAY);
  }

  button.addEventListener('click',watch);
  new MutationObserver(function(){
    if(!button.classList.contains('is-playing')||button.classList.contains('has-played'))hide();
  }).observe(button,{attributes:true,attributeFilter:['class']});
}

function scan(root){
  if(!root)return;
  root.querySelectorAll('.activity-audio').forEach(bindButton);
}
function bind(){
  ROOT_IDS.forEach(function(id){
    var root=document.getElementById(id);
    if(!root)return;
    scan(root);
    new MutationObserver(function(){scan(root);}).observe(root,{childList:true,subtree:true});
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})(window);
