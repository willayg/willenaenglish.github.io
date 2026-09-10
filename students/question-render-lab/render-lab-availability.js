import {QuestionRenderer} from '../test-prep-v2/question-renderer.js';

const nativeFetch=window.fetch.bind(window);
const isUuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s||''));
const availabilityFilter=()=>document.getElementById('availability')?.value||'all';
const issueFilter=()=>document.getElementById('underlineIssue')?.value||'all';

window.fetch=async function(input,init){
  const raw=typeof input==='string'?input:input?.url;
  if(!raw||!raw.includes('/rest/v1/test_prep_questions?'))return nativeFetch(input,init);
  const u=new URL(raw,location.href);
  const availability=availabilityFilter();
  u.searchParams.delete('student_usable');
  if(availability==='usable')u.searchParams.set('student_usable','eq.true');
  if(availability==='unusable')u.searchParams.set('student_usable','eq.false');
  const issue=issueFilter();
  u.searchParams.delete('metadata->underline_audit->>issue_type');
  if(issue!=='all')u.searchParams.set('metadata->underline_audit->>issue_type',`eq.${issue}`);
  const select=u.searchParams.get('select')||'';
  if(select&&!select.split(',').includes('student_usable'))u.searchParams.set('select',`${select},student_usable`);
  const r=await nativeFetch(u.toString(),init);
  if(!r.ok)return r;
  const ct=r.headers.get('content-type')||'';
  if(!ct.includes('application/json'))return r;
  const rows=await r.json();
  if(!Array.isArray(rows))return new Response(JSON.stringify(rows),{status:r.status,statusText:r.statusText,headers:r.headers});
  const patched=rows.map(row=>({...row,metadata:{...(row.metadata||{}),__render_lab_student_usable:row.student_usable!==false}}));
  return new Response(JSON.stringify(patched),{status:r.status,statusText:r.statusText,headers:r.headers});
};

function toast(msg,bad=false){
  let t=document.getElementById('renderLabAvailabilityToast');
  if(!t){t=document.createElement('div');t.id='renderLabAvailabilityToast';t.style.cssText='position:fixed;left:50%;bottom:118px;transform:translateX(-50%);z-index:100300;background:#263238;color:#fff;padding:9px 14px;border-radius:999px;font:700 12px system-ui,sans-serif;opacity:0;transition:.15s';document.body.appendChild(t)}
  t.textContent=msg;t.style.background=bad?'#9d3b34':'#263238';t.style.opacity='1';clearTimeout(t._timer);t._timer=setTimeout(()=>t.style.opacity='0',1600);
}

async function setUsable(q,next,button){
  if(!isUuid(q?.id)){toast('Generated lab item cannot be toggled',true);return}
  const api=window.__renderLabApi;if(!api?.base||!api?.headers){toast('Database connection is not ready',true);return}
  button.disabled=true;const old=button.textContent;button.textContent='Saving…';
  try{
    const r=await nativeFetch(`${api.base}/rest/v1/test_prep_questions?id=eq.${encodeURIComponent(q.id)}`,{method:'PATCH',headers:{...api.headers,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({student_usable:next,updated_at:new Date().toISOString()})});
    if(!r.ok)throw new Error(await r.text()||`Save failed (${r.status})`);
    q.metadata={...(q.metadata||{}),__render_lab_student_usable:next};updateAvailability(q);toast(next?'Question is usable':'Question is unavailable to students');
  }catch(e){console.error('[render lab availability]',e);button.textContent=old;button.disabled=false;toast('Could not update availability',true)}
}

function issueLabel(type){return ({answer_choices_stored_as_passage_target:'Passage target missing',malformed_missing_source_target:'Malformed / source target missing',whole_choice_spans:'Whole-choice underline',single_target:'Single target',per_choice_targets:'Per-choice targets',missing_underline_metadata:'Missing underline data',multi_target_other:'Multiple-target oddity',underlined_by_choice:'Explicit per-choice targets'})[type]||type||''}
function updateAvailability(q){
  const bar=document.querySelector('#card .rl-flag-bar');if(!bar)return;
  bar.querySelector('.rl-usable-btn')?.remove();bar.querySelector('.rl-issue-pill')?.remove();
  const usable=q?.metadata?.__render_lab_student_usable!==false;
  const b=document.createElement('button');b.type='button';b.className='rl-flag-btn rl-usable-btn';b.style.borderColor=usable?'#67b989':'#d96d61';b.style.color=usable?'#237247':'#9e332b';b.style.background=usable?'#f2fbf5':'#fff3f1';b.textContent=usable?'✓ Usable':'⛔ Unusable';
  if(!isUuid(q?.id)){b.disabled=true;b.title='Generated lab item'}else b.onclick=()=>setUsable(q,!usable,b);
  const type=q?.metadata?.underline_audit?.issue_type;if(type){const p=document.createElement('span');p.className='rl-issue-pill';p.style.cssText='border:1px solid #c9d2d6;background:#f7f9fa;color:#58676d;border-radius:999px;padding:7px 10px;font:700 11px system-ui,sans-serif';p.textContent=`Audit: ${issueLabel(type)}`;bar.appendChild(p)}
  bar.appendChild(b);
}

function reloadLab(){const skill=document.getElementById('skill');if(skill)skill.dispatchEvent(new Event('change',{bubbles:true}))}
['availability','underlineIssue'].forEach(id=>document.getElementById(id)?.addEventListener('change',reloadLab));
const previousRender=QuestionRenderer.prototype.render;
QuestionRenderer.prototype.render=function(q,...args){const result=previousRender.call(this,q,...args);queueMicrotask(()=>updateAvailability(q));return result};
window.WillenaRenderLabAvailability={reload:reloadLab};
console.log('[Render Lab] availability toggle + underline audit filters ready');
