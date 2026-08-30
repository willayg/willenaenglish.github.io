(function(){
'use strict';

function cleanInstruction(el){
  if(!el || !el.classList?.contains('seosul-instruction')) return;
  let t=el.textContent||'';
  // Remove internal machine target labels such as responding_to_praise,
  // ability_response, asking_future_hopes, word_order, etc. Keep useful
  // student-facing constraints such as required words and word counts.
  t=t.replace(/\s*·\s*[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+(?=\s*\))/g,'');
  t=t.replace(/\(\s*[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+\s*(?:활용|사용)?\s*\)/g,'');
  t=t.replace(/\s{2,}/g,' ').replace(/\(\s*\)/g,'').trim();
  if(el.textContent!==t) el.textContent=t;
}

function scan(root=document){
  if(root?.matches?.('.seosul-instruction')) cleanInstruction(root);
  root?.querySelectorAll?.('.seosul-instruction').forEach(cleanInstruction);
}

scan();
new MutationObserver(ms=>{
  for(const m of ms){
    m.addedNodes.forEach(n=>{ if(n.nodeType===1) scan(n); });
  }
}).observe(document.documentElement,{childList:true,subtree:true});
})();
