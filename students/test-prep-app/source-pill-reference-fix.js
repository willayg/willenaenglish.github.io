(function(){
'use strict';
let lastKey='';
function sourceCode(label,status){
  const s=String(label||'').trim().toLowerCase();
  const c=String(status||'').trim().toLowerCase();
  if(s.includes('b reference'))return{code:'B',title:'Book reference',cls:'b'};
  if(s.includes('z reference')||s.includes('zocbo')||s.includes('족보'))return{code:'Z',title:'Zocbo reference',cls:'z'};
  if(s.includes('willena')||c==='willena_published')return{code:'W',title:'Willena',cls:'w'};
  return null;
}
function isConstructedResponse(){
  const s=window.WillenaAssignedTestPrep?.selection;
  return String(s?.section||s?.practiceType||s?.practice_type||'').toLowerCase()==='constructed_response'||!!document.querySelector('#card #seosulAnswer');
}
function paint(el,src,key=''){
  if(!el||!src)return false;
  if(el.textContent!==src.code)el.textContent=src.code;
  const cls=`tp-source-pill ${src.cls}`;
  if(el.className!==cls)el.className=cls;
  if(el.title!==src.title)el.title=src.title;
  el.dataset.referenceResolved='1';
  if(key)el.dataset.referenceQuestion=key;
  return true;
}
function refreshAuthored(){
  const pill=document.querySelector('#card .tp-source-pill,#card .source');
  const qnum=document.querySelector('#card .qnum');
  const qs=window.WillenaSeosulEngine?.questions;
  if(!pill||!qnum||!Array.isArray(qs))return false;
  const m=String(qnum.textContent||'').match(/(\d+)\s*\/\s*\d+/);
  if(!m)return false;
  const q=qs[Number(m[1])-1];
  if(!q)return false;
  const label=q.metadata?.source_label||q.metadata?.student_source_label||q.raw?.student_source_label||'';
  const src=sourceCode(label,q.raw?.content_status);
  if(!src)return false;
  return paint(pill,src,String(q.id||q.raw?.id||`seosul-${m[1]}`));
}
function refresh(){
  if(isConstructedResponse()){
    refreshAuthored();
    return;
  }
  const pill=document.querySelector('#card .tp-source-pill,#card .source');
  const q=window.WillenaTestPrepQuestionEngine?.currentQuestion;
  if(!pill||!q)return;
  const key=String(q.id||`${window.WillenaTestPrepQuestionEngine?.section||''}|${q.source_question_number||''}`);
  if(key===lastKey&&pill.dataset.referenceResolved==='1'&&pill.dataset.referenceQuestion===key)return;
  const label=q.student_source_label||q.metadata?.student_source_label||q.metadata?.source_label||'';
  const src=sourceCode(label,q.content_status);
  if(!src)return;
  if(paint(pill,src,key))lastKey=key;
}
function boot(){
  refresh();
  new MutationObserver(()=>{setTimeout(refresh,0)}).observe(document.getElementById('card')||document.body,{childList:true,subtree:true,characterData:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();