(()=>{
'use strict';
function relabelSentences(root=document){
  root.querySelectorAll?.('*').forEach(el=>{
    if(el.childElementCount===0&&el.textContent?.trim()==='Sentences')el.textContent='본문 Unscramble';
  });
}
relabelSentences();
new MutationObserver(m=>{for(const x of m)for(const n of x.addedNodes)if(n.nodeType===1)relabelSentences(n)}).observe(document.documentElement,{childList:true,subtree:true});
})();
