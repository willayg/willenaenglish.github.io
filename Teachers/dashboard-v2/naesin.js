(function(){
'use strict';
const v=Date.now();
function load(file){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=`./${file}?v=${v}`;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
load('naesin-core-fresh.js')
  .then(()=>load('naesin-signedoff-ui.js'))
  .then(()=>load('naesin-history.js'))
  .then(()=>load('naesin-diagnostic-fix.js'))
  .then(()=>load('naesin-delete.js'))
  .then(()=>load('naesin-mobile-polish.js'))
  .then(()=>load('naesin-scope-selector-fix.js'))
  .then(()=>load('naesin-stats-rescue.js'))
  .catch(e=>console.error('[naesin-loader]',e));
})();