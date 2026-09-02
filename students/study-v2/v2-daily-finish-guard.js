(function(global){
'use strict';
function text(v){return String(v==null?'':v).trim();}
function inDaily(){return document.body&&document.body.classList.contains('study-v2-daily-mode');}
function isDoneButton(btn){var t=text(btn&&btn.textContent).toLowerCase();return t==='완료'||t==='done'||t==='finish';}
function tryFinish(){
  if(!inDaily())return;
  var root=document.getElementById('v2ActivityRoot');
  var btn=root&&root.querySelector('.activity-check');
  if(btn&&!btn.disabled&&isDoneButton(btn)){
    btn.click();
    return;
  }
  var daily=global.WillenaStudyV2Daily;
  var session=daily&&typeof daily.getSession==='function'?daily.getSession():null;
  var resolved=session&&Array.isArray(session.resolved_keys)?session.resolved_keys.length:0;
  if(resolved>=20&&btn&&!btn.disabled)btn.click();
}
global.addEventListener('willena:activity-answer',function(){
  if(!inDaily())return;
  setTimeout(tryFinish,0);
});
})(window);
