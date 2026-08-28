(function(){
'use strict';
function relabel(root=document){const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const n of nodes){const p=n.parentElement;if(!p||['SCRIPT','STYLE','TEXTAREA','INPUT'].includes(p.tagName))continue;const t=n.nodeValue;if(!t||!t.includes('Sentences'))continue;n.nodeValue=t.replace(/\bSentences\b/g,'본문 Unscramble')}}
let raf=0;function scan(){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>relabel(document.body))}
function boot(){scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true,characterData:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();