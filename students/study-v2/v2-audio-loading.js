(function(global){
'use strict';
var ROOT_IDS=['v2ActivityRoot','aiCoachActivityRoot'];
var SHOW_DELAY=380;
var DOT_DELAY=320;

function koreanMode(){
  var langBtn=document.getElementById('languageBtn');
  if(langBtn)return String(langBtn.textContent||'').trim()==='English';
  return String(document.documentElement.lang||'').toLowerCase().indexOf('ko')===0;
}
function loadingBase(){return koreanMode()?'AI 음성을 불러오는 중':'AI loading speech';}

function ensureMessage(button){
  if(!button)return null;
  var existing=button.querySelector&&button.querySelector('.v2-audio-loading-message');
  if(existing)return existing;
  var msg=document.createElement('small');
  msg.className='v2-audio-loading-message';
  msg.hidden=true;
  msg.setAttribute('aria-live','polite');
  button.appendChild(msg);
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
  if(!button||button.dataset.v2AudioLoadingBound==='2')return;
  button.dataset.v2AudioLoadingBound='2';
  ensureSparkles(button);
  var timer=null,dotTimer=null,dotStep=0;
  var msg=ensureMessage(button);

  function paintMessage(){
    if(!msg)return;
    var dots=['.','..','...'];
    msg.textContent=loadingBase()+dots[dotStep%dots.length];
    dotStep=(dotStep+1)%dots.length;
  }
  function stopDots(){if(dotTimer){clearInterval(dotTimer);dotTimer=null;}}
  function hide(){
    if(timer){clearTimeout(timer);timer=null;}
    stopDots();
    button.classList.remove('v2-audio-loading-active');
    if(msg)msg.hidden=true;
  }
  function show(){
    if(!msg)return;
    dotStep=0;
    paintMessage();
    msg.hidden=false;
    button.classList.add('v2-audio-loading-active');
    stopDots();
    dotTimer=setInterval(paintMessage,DOT_DELAY);
  }
  function watch(){
    button.classList.add('v2-audio-sparkles-used');
    hide();
    timer=setTimeout(function(){
      timer=null;
      if(!button.isConnected||!msg)return;
      if(button.classList.contains('is-playing')&&!button.classList.contains('has-played'))show();
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
  var languageBtn=document.getElementById('languageBtn');
  if(languageBtn)languageBtn.addEventListener('click',function(){
    setTimeout(function(){document.querySelectorAll('.activity-audio.v2-audio-loading-active .v2-audio-loading-message').forEach(function(msg){var button=msg.closest('.activity-audio');if(button){msg.textContent=loadingBase()+'.';}});},0);
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})(window);
