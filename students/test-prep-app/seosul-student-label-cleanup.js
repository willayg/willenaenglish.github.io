(function(){
'use strict';

const U='https://gxwfsqxyuufqtitspfqg.supabase.co';
const K=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const H={apikey:K,Authorization:`Bearer ${K}`};
let underlineTimer=0;
const rowCache=new Map();

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

function addUnderlineStyle(){
  if(document.getElementById('seosulUnderlineStyle')) return;
  const s=document.createElement('style');
  s.id='seosulUnderlineStyle';
  s.textContent='.seosul-source u.seosul-target-underline{text-decoration-line:underline;text-decoration-thickness:2px;text-underline-offset:3px;text-decoration-skip-ink:auto;text-decoration-color:#47545d}';
  document.head.appendChild(s);
}

function currentKey(){
  const instruction=document.querySelector('#card .seosul-instruction')?.textContent?.trim()||'';
  const kind=document.querySelector('#card .seosul-kind')?.textContent||'';
  const m=kind.match(/#\s*(\d+)/);
  const number=m?Number(m[1]):null;
  if(!instruction || !number) return null;
  return {instruction,number,key:`${number}|${instruction}`};
}

async function fetchRow(info){
  if(rowCache.has(info.key)) return rowCache.get(info.key);
  const qs=new URLSearchParams({
    select:'id,source_question_number,question_type,prompt_text,context,metadata,student_source_label,source_page',
    source_question_number:`eq.${info.number}`,
    prompt_text:`eq.${info.instruction}`,
    student_usable:'eq.true',
    limit:'10'
  });
  const r=await fetch(`${U}/rest/v1/test_prep_questions?${qs.toString()}`,{headers:H,cache:'no-store'});
  if(!r.ok) throw new Error(`underline lookup ${r.status}`);
  const rows=await r.json();
  const lessonText=String(window.WillenaAssignedTestPrep?.selection?.lesson||'');
  const lm=lessonText.match(/Lesson\s*(\d+)/i);
  const lesson=lm?Number(lm[1]):null;
  const row=rows.find(x=>Number(x?.metadata?.lesson)===lesson)||rows[0]||null;
  rowCache.set(info.key,row);
  return row;
}

function uniq(arr){return [...new Set(arr.filter(Boolean).map(x=>String(x).trim()).filter(Boolean))]}

function markerTargets(instruction,context){
  const markers=uniq((instruction.match(/[ⓐ-ⓩ①-⑳]/g)||[]));
  if(!markers.length) return [];
  const blobs=[context.dialogue,context.passage,context.sentence]
    .concat(Array.isArray(context.items)?context.items:[])
    .filter(Boolean).map(String);
  const out=[];
  for(const marker of markers){
    for(const blob of blobs){
      const i=blob.indexOf(marker);
      if(i<0) continue;
      let end=i+marker.length;
      while(end<blob.length && !/[\n.!?]/.test(blob[end])) end++;
      if(end<blob.length && /[.!?]/.test(blob[end])) end++;
      const piece=blob.slice(i,end).trim();
      if(piece.length>marker.length) out.push(piece);
      break;
    }
  }
  return out;
}

function inferredTargets(row){
  const c=row?.context||{};
  const p=String(row?.prompt_text||'');
  const explicit=[];
  if(c.underlined) explicit.push(c.underlined);
  if(Array.isArray(c.underlined_spans)) explicit.push(...c.underlined_spans);
  if(explicit.length) return uniq(explicit);

  const targets=[];
  targets.push(...markerTargets(p,c));
  if(/밑줄/.test(p) && c.korean) targets.push(c.korean);
  if(/밑줄/.test(p) && c.sentence) targets.push(c.sentence);

  // Older authored rows sometimes omitted underline metadata for these
  // mechanical textbook patterns. Infer the visible target conservatively.
  if(row?.question_type==='to_usage_classification' && Array.isArray(c.items)){
    for(const item of c.items){
      const s=String(item);
      const m=s.match(/(?:^|\s)(To\s+[^,.!?]+|to\s+[^,.!?]+)/);
      if(m) targets.push(m[1].trim());
    }
  }
  return uniq(targets);
}

function markText(root,target){
  if(!root || !target || root.dataset.underlineDone==='1' && root.textContent.indexOf(target)<0) return false;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(n){
    if(!n.nodeValue || !n.nodeValue.includes(target)) return NodeFilter.FILTER_REJECT;
    if(n.parentElement?.closest('u.seosul-target-underline')) return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_ACCEPT;
  }});
  const node=walker.nextNode();
  if(!node) return false;
  const idx=node.nodeValue.indexOf(target);
  const before=node.nodeValue.slice(0,idx),after=node.nodeValue.slice(idx+target.length);
  const u=document.createElement('u');u.className='seosul-target-underline';u.textContent=target;
  const frag=document.createDocumentFragment();
  if(before) frag.appendChild(document.createTextNode(before));
  frag.appendChild(u);
  if(after) frag.appendChild(document.createTextNode(after));
  node.parentNode.replaceChild(frag,node);
  return true;
}

async function applyUnderlines(){
  const info=currentKey();
  if(!info) return;
  const card=document.getElementById('card');
  if(!card || card.dataset.underlineKey===info.key) return;
  try{
    const row=await fetchRow(info);
    if(!row) return;
    const targets=inferredTargets(row);
    if(!targets.length){ card.dataset.underlineKey=info.key; return; }
    const sources=[...card.querySelectorAll('.seosul-source,.seosul-word')];
    for(const target of targets){
      for(const source of sources){ if(markText(source,target)) break; }
    }
    card.dataset.underlineKey=info.key;
  }catch(e){console.warn('[seosul-underline]',e)}
}

function scheduleUnderlines(){
  clearTimeout(underlineTimer);
  underlineTimer=setTimeout(applyUnderlines,70);
}

function scan(root=document){
  if(root?.matches?.('.seosul-instruction')) cleanInstruction(root);
  root?.querySelectorAll?.('.seosul-instruction').forEach(cleanInstruction);
  if(root===document || root?.matches?.('#card,.body,.seosul-source,.seosul-instruction') || root?.querySelector?.('.seosul-source,.seosul-instruction')) scheduleUnderlines();
}

addUnderlineStyle();
scan();
new MutationObserver(ms=>{
  for(const m of ms){
    m.addedNodes.forEach(n=>{ if(n.nodeType===1) scan(n); });
  }
}).observe(document.documentElement,{childList:true,subtree:true});
})();
