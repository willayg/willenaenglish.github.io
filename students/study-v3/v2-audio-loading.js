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

function ensureSparkles(button){
  if(!button||button.querySelector('.v2-audio-sparkles'))return;
  var field=document.createElement('div');
  field.className='v2-audio-sparkles';
  field.setAttribute('aria-hidden','true');
  for(var i=0;i<10;i++){
    var star=document.createElement('i');
    star.className='v2-audio-sparkle v2-audio-sparkle-'+(i+1);
    star.textContent='✦';
    field.appendChild(star);
  }
  button.appendChild(field);
}

function bindButton(button){
  if(!button||button.dataset.v2AudioLoadingBound==='1')return;
  button.dataset.v2AudioLoadingBound='1';
  ensureSparkles(button);
  var timer=null;
  var msg=ensureMessage(button);

  function hide(){
    if(timer){clearTimeout(timer);timer=null;}
    if(msg)msg.hidden=true;
  }
  function watch(){
    button.classList.add('v2-audio-sparkles-used');
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
