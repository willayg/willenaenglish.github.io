(function(){
'use strict';
const U='https://gxwfsqxyuufqtitspfqg.supabase.co';
const K=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const H={apikey:K,Authorization:`Bearer ${K}`};
const cache=new Map();
let queued=false,lastKey='';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
function ensureStyles(){
  if(document.getElementById('tp-inline-bank-style'))return;
  const style=document.createElement('style');
  style.id='tp-inline-bank-style';
  style.textContent=`
    .context .items.bank-inline{
      display:flex;
      flex-wrap:wrap;
      align-items:center;
      gap:8px;
    }
    .context .items.bank-inline .item{
      width:auto;
      flex:0 0 auto;
      padding:8px 12px;
    }
    .context .items.bank-inline .item .line{
      display:inline;
      white-space:nowrap;
    }
  `;
  document.head.appendChild(style);
}
function layoutBanks(card){
  if(!card)return;
  ensureStyles();
  card.querySelectorAll('.context').forEach(ctx=>{
    const title=ctx.querySelector(':scope > .context-title');
    const items=ctx.querySelector(':scope > .items');
    if(!title||!items)return;
    const label=(title.textContent||'').trim().replace(/\s+/g,'');
    if(label==='<보기>'||label==='보기')items.classList.add('bank-inline');
  });
}
function spansFrom(c){const out=[];if(c?.underlined)out.push(c.underlined);if(Array.isArray(c?.underlined_spans))out.push(...c.underlined_spans);return [...new Set(out.map(String).filter(Boolean))]}
async function lookup(prompt){if(cache.has(prompt))return cache.get(prompt);const q=new URLSearchParams({select:'id,context',student_usable:'eq.true',prompt_text:`eq.${prompt}`,limit:'8'});try{const r=await fetch(`${U}/rest/v1/test_prep_questions?${q}`,{headers:H,cache:'no-store'});if(!r.ok)throw new Error(await r.text());const rows=await r.json(),row=(rows||[]).find(x=>spansFrom(x.context).length)||(rows||[])[0]||null;cache.set(prompt,row);return row}catch(e){console.warn('[test-prep] render metadata lookup failed',e);cache.set(prompt,null);return null}}
function markLine(el,spans){let src=el.textContent||'';if(!src||!spans.length)return;const hits=[];for(const span of spans){let from=0;while(from<src.length){const at=src.indexOf(span,from);if(at<0)break;hits.push([at,at+span.length]);from=at+span.length}}
if(!hits.length)return;hits.sort((a,b)=>a[0]-b[0]||b[1]-a[1]);const merged=[];for(const h of hits){const last=merged[merged.length-1];if(!last||h[0]>=last[1])merged.push(h);else last[1]=Math.max(last[1],h[1])}let html='',p=0;for(const [a,b] of merged){html+=esc(src.slice(p,a))+`<span class="u">${esc(src.slice(a,b))}</span>`;p=b}html+=esc(src.slice(p));el.innerHTML=html}
async function enhance(){queued=false;const card=document.getElementById('card');if(!card)return;layoutBanks(card);const isMock=!!card.querySelector('.mock-kicker,.mock-all-kicker');if(!isMock)return;const promptEl=card.querySelector('.prompt');const prompt=promptEl?.textContent?.trim()||'';if(!prompt||!prompt.includes('밑줄'))return;const key=`${prompt}|${card.querySelector('.qnum')?.textContent||''}`;if(key===lastKey&&card.querySelector('.context .u'))return;lastKey=key;const row=await lookup(prompt),spans=spansFrom(row?.context);if(!spans.length)return;card.querySelectorAll('.context .line,.context .item').forEach(el=>{if(el.querySelector('.line'))return;markLine(el,spans)})}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(enhance)}
function boot(){const card=document.getElementById('card');if(!card)return;new MutationObserver(schedule).observe(card,{childList:true,subtree:true});schedule()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();