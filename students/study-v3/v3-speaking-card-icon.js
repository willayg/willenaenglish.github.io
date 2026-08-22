(function(){
'use strict';
var STYLE_ID='v3-speaking-card-icon-style';
function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  var s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent='[data-v3-speaking-card]{position:relative}.v3-speaking-card-icon{position:absolute;left:52px;top:50%;transform:translateY(-50%);width:30px;height:30px;display:flex;align-items:center;justify-content:center;color:#25b8c4;pointer-events:none}.v3-speaking-card-icon svg{width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}@media(max-width:759px){.v3-speaking-card-icon{left:52px;width:30px;height:30px}.v3-speaking-card-icon svg{width:28px;height:28px}}';
  (document.head||document.documentElement).appendChild(s);
}
function decorate(card){
  if(!card||card.querySelector('.v3-speaking-card-icon'))return;
  ensureStyle();
  var icon=document.createElement('span');
  icon.className='v3-speaking-card-icon';
  icon.setAttribute('aria-hidden','true');
  icon.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 14.5a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5.5a3 3 0 0 0 3 3Z"/><path d="M6.5 10.8v.7a5.5 5.5 0 0 0 11 0v-.7M12 17v3.5M9.5 20.5h5"/></svg>';
  card.appendChild(icon);
}
function scan(){document.querySelectorAll('[data-v3-speaking-card]').forEach(decorate);}
var mo=new MutationObserver(scan);
function start(){ensureStyle();scan();mo.observe(document.body,{subtree:true,childList:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();