(function(){
'use strict';
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const HEAD={apikey:KEY,Authorization:`Bearer ${KEY}`};
let lastKey='',running=false;
function sourceCode(label,status){
  const s=String(label||'').trim().toLowerCase();
  const c=String(status||'').trim().toLowerCase();
  if(s.includes('b reference'))return{code:'B',title:'Book reference',cls:'b'};
  if(s.includes('z reference'))return{code:'Z',title:'Zocbo reference',cls:'z'};
  if(s.includes('willena')||c==='willena_published')return{code:'W',title:'Willena',cls:'w'};
  return null;
}
function isConstructedResponse(){
  const s=window.WillenaAssignedTestPrep?.selection;
  return String(s?.section||s?.practiceType||s?.practice_type||'').toLowerCase()==='constructed_response'||!!document.querySelector('#card #seosulAnswer');
}
function paint(el,src){
  if(!el||!src)return false;
  if(el.textContent!==src.code)el.textContent=src.code;
  const cls=`tp-source-pill ${src.cls}`;
  if(el.className!==cls)el.className=cls;
  if(el.title!==src.title)el.title=src.title;
  el.dataset.referenceResolved='1';
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
  return paint(pill,src);
}
async function refresh(){
  if(isConstructedResponse()){
    refreshAuthored();
    return;
  }
  if(running)return;
  const pill=document.querySelector('.tp-source-pill,.source');
  const prompt=document.querySelector('#card .prompt');
  if(!pill||!prompt)return;
  const text=(prompt.textContent||'').trim();
  if(!text)return;
  const section=window.WillenaTestPrepQuestionEngine?.section||'';
  const key=`${section}|${text}`;
  if(key===lastKey&&pill.dataset.referenceResolved==='1')return;
  running=true;
  try{
    const qs=new URLSearchParams({select:'student_source_label,content_status',prompt_text:`eq.${text}`,limit:'5'});
    if(section)qs.set('section',`eq.${section}`);
    const scope=window.WillenaAssignedTestPrep?.questionQuery?.()||'';
    const r=await fetch(`${CONTENT}/rest/v1/test_prep_questions?${qs.toString()}${scope}`,{headers:HEAD,cache:'no-store'});
    if(!r.ok)return;
    const rows=await r.json();
    const hit=(rows||[]).map(x=>({row:x,src:sourceCode(x.student_source_label,x.content_status)})).find(x=>x.src);
    if(!hit)return;
    if(paint(document.querySelector('.tp-source-pill,.source'),hit.src))lastKey=key;
  }catch(e){console.warn('[test-prep] source pill reference lookup failed',e)}finally{running=false}
}
function boot(){
  refresh();
  new MutationObserver(()=>{setTimeout(refresh,0)}).observe(document.getElementById('card')||document.body,{childList:true,subtree:true,characterData:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();