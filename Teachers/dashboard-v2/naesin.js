(function(){
'use strict';
function load(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
load('./naesin-core-fresh.js?v=20260828-ui1').then(()=>load('./naesin-signedoff-ui.js?v=20260828-ui1')).catch(e=>console.error('[naesin-loader]',e));
})();