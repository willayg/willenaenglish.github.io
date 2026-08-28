(function(){
'use strict';
function load(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
load('./naesin-core-fresh.js?v=20260828-ui3')
  .then(()=>load('./naesin-signedoff-ui.js?v=20260828-ui3'))
  .then(()=>load('./naesin-history.js?v=20260828-nav1'))
  .then(()=>load('./naesin-diagnostic-fix.js?v=20260828-wrong3'))
  .then(()=>load('./naesin-delete.js?v=20260828-delete1'))
  .then(()=>load('./naesin-mobile-polish.js?v=20260828-style1'))
  .catch(e=>console.error('[naesin-loader]',e));
})();