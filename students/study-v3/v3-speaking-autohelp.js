(function(){
'use strict';
function handle(node){if(!node||node.nodeType!==1)return;var fb=node.matches&&node.matches('.v3-speaking-feedback')?node:node.querySelector&&node.querySelector('.v3-speaking-feedback');if(!fb||fb.hidden||!/not quite/i.test(fb.textContent||''))return;var card=fb.closest('.v3-speaking-card'),btn=card&&card.querySelector('.v3-speaking-helpbtn');if(btn&&!btn.hidden){setTimeout(function(){if(btn&&!btn.hidden)btn.click();},180);}}
var mo=new MutationObserver(function(ms){ms.forEach(function(m){if(m.target&&m.target.nodeType===1)handle(m.target);Array.prototype.forEach.call(m.addedNodes||[],handle);});});
function start(){mo.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','class']});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();