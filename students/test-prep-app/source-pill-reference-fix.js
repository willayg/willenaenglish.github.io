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
function forceBIfAuthored(){
  const kind=document.querySelector('#card .seosul-kind');
  const pill=document.querySelector('#card .tp-source-pill,#card .source');
  if(!kind||!pill||!/b\s*reference/i.test(kind.textContent||''))return false;
  pill.textContent='B';
  pill.className='tp-source-pill b';
  pill.title='Book reference';
  pill.dataset.referenceResolved='1';
  return true;
}
async function refresh(){
  if(forceBIfAuthored())return;
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
    const el=document.querySelector('.tp-source-pill,.source');
    if(!el)return;
    el.textContent=hit.src.code;
    el.className=`tp-source-pill ${hit.src.cls}`;
    el.title=hit.src.title;
    el.dataset.referenceResolved='1';
    lastKey=key;
  }catch(e){console.warn('[test-prep] source pill reference lookup failed',e)}finally{running=false}
}
function boot(){
  refresh();
  new MutationObserver(()=>{setTimeout(refresh,0)}).observe(document.getElementById('card')||document.body,{childList:true,subtree:true,characterData:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
