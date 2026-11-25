(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
let detailParams=null;
function capture(input){
  try{
    const u=new URL(typeof input==='string'?input:input?.url,location.href);
    if(!u.pathname.includes('/test-prep-teacher-insights')||u.searchParams.get('action')!=='student_detail')return;
    const student_id=u.searchParams.get('student_id')||'';
    const plan_id=u.searchParams.get('plan_id')||'';
    if(student_id)detailParams={student_id,plan_id};
  }catch(_){ }
}
if(!window.__willenaWrongPrintFetchCapture){
  window.__willenaWrongPrintFetchCapture=true;
  const orig=window.fetch.bind(window);
  window.fetch=function(input,opts){capture(input);return orig(input,opts)};
}
function recover(){
  if(detailParams?.student_id)return;
  try{
    const entries=performance.getEntriesByType('resource');
    for(let i=entries.length-1;i>=0;i--){capture(entries[i].name);if(detailParams?.student_id)return;}
  }catch(_){ }
}
function openEditor(){
  recover();
  if(!detailParams?.student_id){alert('학생 오답 정보를 찾지 못했습니다. 학생 창을 다시 열어주세요.');return;}
  const q=new URLSearchParams({student_id:detailParams.student_id});
  if(detailParams.plan_id)q.set('plan_id',detailParams.plan_id);
  const student=$('#naDiagName')?.textContent?.trim()||'';
  const exam=$('#naDiagMeta')?.textContent?.trim()||'';
  if(student)q.set('student',student);
  if(exam)q.set('exam',exam);
  window.open(`/Teachers/wrong-print-editor/?${q.toString()}`,'_blank','noopener');
}
function injectButton(){
  const bg=$('#naFreshDiagBg');
  if(!bg?.classList.contains('open'))return;
  recover();
  const view=$('#naDiagBody [data-view="wrong"]');
  if(!view||$('#naWrongPrintBtn',view))return;
  const head=$('.na-subhead',view);
  if(!head)return;
  const btn=document.createElement('button');
  btn.id='naWrongPrintBtn';
  btn.type='button';
  btn.className='na-btn cyan';
  btn.textContent='오답 프린트 편집';
  btn.style.marginLeft='auto';
  btn.addEventListener('click',openEditor);
  head.appendChild(btn);
}
function boot(){injectButton();new MutationObserver(injectButton).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});console.info('[wrong-answer-print] editor launcher loaded')}
window.WillenaWrongAnswerPrint={open:openEditor};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();