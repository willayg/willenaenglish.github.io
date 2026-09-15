(function(){
  'use strict';

  function applySharedUi(root=document){
    root.querySelectorAll?.('.gf-btn.primary').forEach(btn=>{
      btn.classList.remove('gf-btn','primary');
      btn.classList.add('review-primary');
    });
    root.querySelectorAll?.('.gf-btn.secondary').forEach(btn=>{
      btn.classList.remove('gf-btn','secondary');
      btn.classList.add('review-secondary');
    });
    root.querySelectorAll?.('#checkAnswer,#checkChallenge').forEach(btn=>btn.classList.add('primary'));
  }

  const start=()=>{
    applySharedUi();
    const observer=new MutationObserver(records=>{
      for(const record of records){
        for(const node of record.addedNodes){
          if(node.nodeType!==Node.ELEMENT_NODE)continue;
          applySharedUi(node);
          if(node.matches?.('.gf-btn.primary,.gf-btn.secondary,#checkAnswer,#checkChallenge'))applySharedUi(node.parentElement||document);
        }
      }
    });
    observer.observe(document.body,{childList:true,subtree:true});
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
