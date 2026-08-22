(function(){
'use strict';
var STYLE_ID='v3-speaking-card-icon-style';
function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  var s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent='[data-v3-speaking-card]{position:relative;overflow:hidden;padding-right:62px!important}.v3-speaking-card-icon{position:absolute;right:14px;top:50%;transform:translateY(-50%);width:40px;height:40px;display:flex;align-items:center;justify-content:center;border:2px solid #ff0a8a;border-radius:50%;background:#fff;color:#ff0a8a;box-shadow:0 0 0 5px rgba(255,10,138,.06);pointer-events:none}.v3-speaking-card-icon svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}';
  (document.head||document.documentElement).appendChild(s);
}
function decorate(card){
  if(!card||card.querySelector('.v3-speaking-card-icon'))return;
  ensureStyle();
  var icon=document.createElement('span');
  icon.className='v3-speaking-card-icon';
  icon.setAttribute('aria-hidden','true');
  icon.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 15.5a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 1 0-7 0v6a3.5 3.5 0 0 0 3.5 3.5Z"/><path d="M5.5 11.5v.5a6.5 6.5 0 0 0 13 0v-.5M12 18.5V22M9 22h6"/><path d="M18.7 7.3c1 .9 1.6 2.1 1.6 3.5M5.3 7.3c-1 .9-1.6 2.1-1.6 3.5"/></svg>';
  card.appendChild(icon);
}
function scan(){document.querySelectorAll('[data-v3-speaking-card]').forEach(decorate);}
var mo=new MutationObserver(scan);
function start(){ensureStyle();scan();mo.observe(document.body,{subtree:true,childList:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();