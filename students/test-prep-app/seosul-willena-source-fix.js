(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
function currentQuestion(){
  const eng=window.WillenaSeosulEngine;
  const qs=eng?.questions;
  if(!Array.isArray(qs)||!qs.length)return null;
  const txt=$('#card .qnum')?.textContent||'';
  const m=txt.match(/(\d+)\s*\//);
  const i=m?Math.max(0,Number(m[1])-1):0;
  return qs[i]||null;
}
function sourceInfo(q){
  if(!q)return{label:'',badge:'',isWillena:false};
  const md=q.metadata||q.raw?.metadata||{};
  const raw=String(q.raw?.student_source_label||md.source_label||'').trim();
  const remix=md.constructed_response_source==='willena_remix'||md.copyright_status==='willena_original';
  const isWillena=remix||/^willena$/i.test(raw);
  return isWillena?{label:'Willena',badge:'W',isWillena:true}:{label:raw||'B Reference',badge:'B',isWillena:false};
}
function apply(){
  const q=currentQuestion();
  if(!q)return;
  const src=sourceInfo(q);
  const pill=$('#card .source,#card .tp-source-pill');
  if(pill){
    pill.textContent=src.badge;
    pill.title=src.label;
    pill.dataset.referenceResolved='1';
    pill.dataset.sourceLabel=src.label;
    if(src.isWillena){pill.className='tp-source-pill w';}
    else{pill.className='tp-source-pill b';}
  }
  const kind=$('#card .seosul-kind');
  if(kind){
    const base=String(kind.textContent||'').split('·')[0].trim();
    const num=q.number!=null&&q.number!==''?` #${q.number}`:'';
    kind.textContent=`${base} · ${src.label}${src.isWillena?'':num}`;
  }
  const card=$('#card');
  if(card){card.dataset.seosulSource=src.label;card.dataset.seosulQuestionId=String(q.id||'');}
}
function audit(){
  const qs=window.WillenaSeosulEngine?.questions;
  const bank=window.WillenaSeosulEngine?.bank;
  const count=(arr,p)=>Array.isArray(arr)?arr.filter(p).length:0;
  const isW=q=>sourceInfo(q).isWillena;
  const data={
    bankTotal:Array.isArray(bank)?bank.length:0,
    bankWillena:count(bank,isW),
    bankReference:count(bank,q=>!isW(q)),
    sessionTotal:Array.isArray(qs)?qs.length:0,
    sessionWillena:count(qs,isW),
    sessionReference:count(qs,q=>!isW(q))
  };
  window.WillenaSeosulAudit=data;
  return data;
}
function boot(){
  const root=$('#card')||document.body;
  const run=()=>{apply();audit()};
  new MutationObserver(()=>queueMicrotask(run)).observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
  let n=0;const t=setInterval(()=>{run();if(window.WillenaSeosulEngine?.questions||++n>200)clearInterval(t)},25);
  window.addEventListener('testprep:student-state-refresh',run);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();