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
  var host=button.parentElement||button;
  var existing=host.querySelector&&host.querySelector('.v2-audio-loading-message[data-v2-audio-for="'+(button.dataset.v2AudioLoadingId||'')+'"]');
  if(existing)return existing;
  if(!button.dataset.v2AudioLoadingId)button.dataset.v2AudioLoadingId='a'+Math.random().toString(36).slice(2,9);
  var msg=document.createElement('small');
  msg.className='v2-audio-loading-message';
  msg.dataset.v2AudioFor=button.dataset.v2AudioLoadingId;
  msg.hidden=true;
  msg.setAttribute('aria-live','polite');
  host.appendChild(msg);
  return msg;
}

function positionMessage(button,msg){
  if(!button||!msg||!button.parentElement)return;
  var host=button.parentElement;
  var oldPos=getComputedStyle(host).position;
  if(oldPos==='static')host.style.position='relative';
  var b=button.getBoundingClientRect();
  var h=host.getBoundingClientRect();
  msg.style.setProperty('left',(b.left-h.left+b.width/2)+'px','important');
  msg.style.setProperty('top',(b.top-h.top+b.height/2)+'px','important');
  msg.style.setProperty('transform','translate(-50%,-50%)','important');
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
  if(!button||button.dataset.v2AudioLoadingBound==='3')return;
  button.dataset.v2AudioLoadingBound='3';
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
    if(button.classList.contains('v2-audio-loading-active'))button.classList.remove('v2-audio-loading-active');
    if(msg)msg.hidden=true;
  }
  function show(){
    if(!msg)return;
    dotStep=0;
    paintMessage();
    positionMessage(button,msg);
    msg.hidden=false;
    if(!button.classList.contains('v2-audio-loading-active'))button.classList.add('v2-audio-loading-active');
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
    new MutationObserver(function(records){
      var needsScan=false;
      for(var i=0;i<records.length;i++){
        for(var j=0;j<records[i].addedNodes.length;j++){
          var n=records[i].addedNodes[j];
          if(n.nodeType===1&&(n.matches&&n.matches('.activity-audio')||n.querySelector&&n.querySelector('.activity-audio'))){needsScan=true;break;}
        }
        if(needsScan)break;
      }
      if(needsScan)scan(root);
    }).observe(root,{childList:true,subtree:true});
  });
  var languageBtn=document.getElementById('languageBtn');
  if(languageBtn)languageBtn.addEventListener('click',function(){
    setTimeout(function(){document.querySelectorAll('.v2-audio-loading-message:not([hidden])').forEach(function(msg){msg.textContent=loadingBase()+'.';});},0);
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})(window);
