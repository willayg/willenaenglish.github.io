(function(){
'use strict';
var STYLE_ID='v3-speaking-card-icon-style';
function loadActivityShell(){
  try{
    if(!document.querySelector('link[data-study-v3-activity-shell]')){var c=document.createElement('link');c.rel='stylesheet';c.href='./v3-activity-shell.css?v=20260822-hardbust8';c.setAttribute('data-study-v3-activity-shell','1');(document.head||document.documentElement).appendChild(c);}
    if(!document.querySelector('script[data-study-v3-activity-shell]')){var j=document.createElement('script');j.src='./v3-activity-shell.js?v=20260822-hardbust8';j.defer=true;j.setAttribute('data-study-v3-activity-shell','1');(document.head||document.documentElement).appendChild(j);}
  }catch(_){}
}
function ensureStyle(){
  var old=document.getElementById(STYLE_ID);if(old)old.remove();
  var s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent='[data-v3-speaking-card]{position:relative!important}.v3-speaking-card-icon{position:absolute!important;left:32px!important;top:50%!important;transform:translate(-50%,-50%)!important;width:30px!important;height:30px!important;margin:0!important;padding:0!important;display:grid!important;place-items:center!important;color:#25b8c4!important;pointer-events:none!important}.v3-speaking-card-icon svg{display:block!important;width:28px!important;height:28px!important;fill:none!important;stroke:currentColor!important;stroke-width:2!important;stroke-linecap:round!important;stroke-linejoin:round!important}';
  (document.head||document.documentElement).appendChild(s);
}
function decorate(card){
  if(!card)return;
  var icon=card.querySelector('.v3-speaking-card-icon');
  if(!icon){
    icon=document.createElement('span');
    icon.className='v3-speaking-card-icon';
    icon.setAttribute('aria-hidden','true');
    icon.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 14.5a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5.5a3 3 0 0 0 3 3Z"/><path d="M6.5 10.8v.7a5.5 5.5 0 0 0 11 0v-.7M12 17v3.5M9.5 20.5h5"/></svg>';
    card.appendChild(icon);
  }
}
var ensuring=false;
function scan(){
  ensureStyle();
  var grid=document.getElementById('masteryGrid');
  if(grid&&!grid.querySelector('[data-v3-speaking-card]')&&!ensuring&&window.WillenaStudyV3SpeakingRecall&&typeof window.WillenaStudyV3SpeakingRecall.ensureCard==='function'){
    ensuring=true;
    try{window.WillenaStudyV3SpeakingRecall.ensureCard();}finally{setTimeout(function(){ensuring=false;},0);}
  }
  document.querySelectorAll('[data-v3-speaking-card]').forEach(decorate);
}
var mo=new MutationObserver(scan);
function start(){loadActivityShell();scan();mo.observe(document.body,{subtree:true,childList:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();