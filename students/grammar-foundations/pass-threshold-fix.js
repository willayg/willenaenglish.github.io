(function(){
  'use strict';
  const requiredFor=total=>Math.max(1,Math.ceil(Number(total||0)*0.8));

  function patchPassLabels(root=document){
    root.querySelectorAll?.('.pill').forEach(el=>{
      if(/^\d+\/10 to pass$/i.test((el.textContent||'').trim()))el.textContent='80% to pass';
    });

    root.querySelectorAll?.('.gf-result').forEach(card=>{
      const scoreEl=card.querySelector('.gf-score');
      if(!scoreEl)return;
      const m=(scoreEl.textContent||'').trim().match(/^(\d+)\s*\/\s*(\d+)$/);
      if(!m)return;
      const score=Number(m[1]),total=Number(m[2]);
      if(!total)return;
      const required=requiredFor(total),passed=score>=required;
      const passEl=card.querySelector('.gf-pass');
      if(passEl&&passed&&!/Passed\s*✓/i.test(passEl.textContent||''))passEl.textContent='Passed ✓';
      card.querySelectorAll('p').forEach(p=>{
        const text=(p.textContent||'').trim();
        if(/^통과하려면\s*\d+\/\d+\s*이상이 필요해요\.?$/.test(text)){
          p.textContent=passed?'좋아요. 다음 단계로 넘어갈 준비가 됐어요.':`통과하려면 ${required}/${total} 이상이 필요해요.`;
        }
      });
    });
  }

  const run=()=>patchPassLabels(document);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes){
        if(node.nodeType===1)patchPassLabels(node.parentElement||document);
      }
    }
  }).observe(document.documentElement,{childList:true,subtree:true});
})();
