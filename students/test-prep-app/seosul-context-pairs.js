(function(){
'use strict';
const U='https://gxwfsqxyuufqtitspfqg.supabase.co';
const K=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const H={apikey:K,Authorization:`Bearer ${K}`};
let lastKey='',running=false;
const $=(s,r=document)=>r.querySelector(s);
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function style(){if($('#seosulPairsStyle'))return;const s=document.createElement('style');s.id='seosulPairsStyle';s.textContent=`.seosul-pairs-context{margin:0 0 14px;padding:14px 16px;border:1.5px solid #dde5e8;border-radius:15px;background:#f8fafb;display:grid;gap:8px}.seosul-pair-line{font-size:17px;line-height:1.55;font-weight:700;color:#34434a;letter-spacing:.01em}`;document.head.appendChild(s)}
async function apply(){
  style();
  const card=$('#card'),instruction=$('#card .seosul-instruction'),answer=$('#card #seosulAnswer');
  if(!card||!instruction||!answer)return;
  if($('#card .seosul-pairs-context'))return;
  const prompt=(instruction.textContent||'').trim();
  if(!prompt||running)return;
  const scope=window.WillenaAssignedTestPrep?.questionQuery?.()||'';
  const key=prompt+'|'+scope;
  if(key===lastKey)return;
  running=true;
  try{
    const qs=new URLSearchParams({select:'id,question_type,context',prompt_text:`eq.${prompt}`,answer_mode:'eq.text',student_usable:'eq.true',limit:'10'});
    const r=await fetch(`${U}/rest/v1/test_prep_questions?${qs.toString()}${scope}`,{headers:H,cache:'no-store'});
    if(!r.ok)return;
    const rows=await r.json();
    const row=(rows||[]).find(x=>Array.isArray(x?.context?.pairs)&&x.context.pairs.length);
    if(!row)return;
    const box=document.createElement('div');box.className='seosul-pairs-context';
    box.innerHTML=row.context.pairs.map(x=>`<div class="seosul-pair-line">${esc(x)}</div>`).join('');
    answer.parentNode.insertBefore(box,answer);
    lastKey=key;
  }catch(e){console.warn('[seosul] pair context render failed',e)}finally{running=false}
}
function boot(){style();apply();const root=$('#card')||document.body;new MutationObserver(()=>queueMicrotask(apply)).observe(root,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();