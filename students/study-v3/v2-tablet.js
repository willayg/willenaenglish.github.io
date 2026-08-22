(function(){
'use strict';
function compactHeader(){
  var host=document.querySelector('student-header');
  if(!host||!host.shadowRoot)return;
  var id='studyV2TabletHeaderStyle';
  var style=host.shadowRoot.getElementById(id);
  if(!style){style=document.createElement('style');style.id=id;host.shadowRoot.appendChild(style);}
  style.textContent='@media (orientation:landscape) and (min-width:700px) and (max-height:900px){header{padding:4px 8px 3px!important}.top{gap:7px!important;min-height:0!important}.title,.page-title{font-size:.9rem!important}.info{gap:1px!important}.points-pill,.stars-pill{font-size:10px!important;padding:2px 6px!important;gap:4px!important}.points-pill svg,.stars-pill svg{width:11px!important;height:11px!important}.avatar{width:32px!important;height:32px!important;font-size:18px!important;border-width:1.5px!important}.btn{padding:6px 9px!important;border-radius:8px!important;font-size:.78rem!important}.mut{font-size:10px!important}}@media (orientation:landscape) and (min-width:900px) and (max-height:700px){header{padding:2px 7px!important}.avatar{width:29px!important;height:29px!important;font-size:16px!important}.title,.page-title{font-size:.82rem!important}.points-pill,.stars-pill{font-size:9px!important}}';
}
function run(){compactHeader();setTimeout(compactHeader,250);setTimeout(compactHeader,900);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
window.addEventListener('resize',compactHeader);
})();
