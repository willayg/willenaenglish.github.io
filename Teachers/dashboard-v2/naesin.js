(function(){
'use strict';
function load(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
(async()=>{
  try{
    await load('./naesin-core.js?v=20260827-core1');
    await load('./naesin-dynamic-catalog.js?v=20260827-catalog1');
    await load('./naesin-dashboard-v2.js?v=20260827-ui2');
    await load('./naesin-student-analytics.js?v=20260827-naanalytics1');
  }catch(e){console.error('[naesin] failed to load dashboard modules',e)}
})();
})();