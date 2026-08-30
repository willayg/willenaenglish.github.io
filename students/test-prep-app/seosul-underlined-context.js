(function(){
'use strict';
const U='https://gxwfsqxyuufqtitspfqg.supabase.co';
const K=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const H={apikey:K,Authorization:`Bearer ${K}`};
let lastKey='',running=false;
const clean=s=>String(s??'').replace(/\\\\n/g,'\n').replace(/\\n/g,'\n').replace(/\r/g,'').replace(/\s+/g,' ').trim();
const escRx=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function style(){if(document.getElementById('seosulUnderlineCtxStyle'))return;const s=document.createElement('style');s.id='seosulUnderlineCtxStyle';s.textContent='.seosul-source .seosul-underlined-target{text-decoration-line:underline;text-decoration-thickness:2px;text-underline-offset:3px;text-decoration-color:#19777e;font-weight:700}';document.head.appendChild(s)}
function current(){const instruction=document.querySelector('#card .seosul-instruction');const source=[...document.querySelectorAll('#card .seosul-source')].find(x=>x.offsetParent!==null);if(!instruction||!source)return null;const p=clean(instruction.textContent),t=clean(source.textContent);if(!p||!t)return null;return{instruction,source,p,t,key:p+'|'+t}}
function targets(ctx){const out=[];if(ctx?.underlined)out.push(ctx.underlined);if(Array.isArray(ctx?.underlined_spans))out.push(...ctx.underlined_spans);if(Array.isArray(ctx?.underlined))out.push(...ctx.underlined);return out.map(x=>String(x||'').replace(/^[ⓐ-ⓩ①-⑳]\s*/,'').trim()).filter(Boolean)}
function sourceMatches(ctx,text){const vals=[ctx?.dialogue,ctx?.passage,ctx?.sentence,ctx?.sentences,ctx?.question];return vals.some(v=>Array.isArray(v)?clean(v.join(' '))===text:clean(v)===text)}
function mark(el,list){if(!el||!list.length)return;let html=el.textContent||'';let changed=false;for(const raw of list){const target=String(raw||'').replace(/^[ⓐ-ⓩ①-⑳]\s*/,'').trim();if(!target)continue;const re=new RegExp(escRx(target),'g');if(re.test(html)){html=html.replace(re,m=>`<span class="seosul-underlined-target">${m}</span>`);changed=true}}
 if(changed){el.innerHTML=html;el.dataset.underlineReady='1'}
}
async function apply(){style();const c=current();if(!c||c.source.dataset.underlineReady==='1'||running)return;if(c.key===lastKey&&c.source.dataset.underlineChecked==='1')return;running=true;c.source.dataset.underlineChecked='1';try{const qs=new URLSearchParams({select:'context',prompt_text:`eq.${c.p}`,student_usable:'eq.true',limit:'20'});const r=await fetch(`${U}/rest/v1/test_prep_questions?${qs}`,{headers:H,cache:'no-store'});if(!r.ok)return;const rows=await r.json();const hit=(rows||[]).find(x=>sourceMatches(x.context||{},c.t)&&targets(x.context||{}).length);if(hit)mark(c.source,targets(hit.context||{}));lastKey=c.key}catch(e){console.warn('[seosul] underline lookup failed',e)}finally{running=false}}
function boot(){style();apply();const root=document.getElementById('card')||document.body;new MutationObserver(()=>queueMicrotask(apply)).observe(root,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
