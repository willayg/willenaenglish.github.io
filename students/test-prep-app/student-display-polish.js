(function(){
'use strict';
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const HEAD={apikey:KEY,Authorization:`Bearer ${KEY}`};
const sourceCache=new Map();
function normalizeRegularPill(){document.querySelectorAll('.source:not([data-wz-done])').forEach(el=>{const raw=el.textContent||'',w=/응용|Willena|\bW\d*/i.test(raw);el.textContent=w?'W':'Z';el.className=`tp-source-pill ${w?'w':'z'}`;el.dataset.wzDone='1';el.title=w?'Willena':'Xocbo reference'})}
function mockSection(t){if(t.includes('어휘'))return'vocab_test';if(t.includes('Communication'))return'communication';if(t.includes('Grammar'))return'grammar';if(t.includes('Reading'))return'reading';return''}
async function lookupMockSource(prompt,kicker){const section=mockSection(kicker);if(section==='vocab_test')return'W';const qtype=String(kicker||'').split(' · ').pop()||'',key=[prompt,section,qtype].join('|');if(sourceCache.has(key))return sourceCache.get(key);let result='Z';try{const qs=new URLSearchParams({select:'student_source_label,content_status',prompt_text:`eq.${prompt}`,limit:'5'});if(section)qs.set('section',`eq.${section}`);if(qtype)qs.set('question_type',`eq.${qtype}`);const r=await fetch(`${CONTENT}/rest/v1/test_prep_questions?${qs}`,{headers:HEAD,cache:'no-store'});if(r.ok){const x=(await r.json())?.[0];if(x&&(String(x.student_source_label||'').toLowerCase().includes('willena')||String(x.content_status||'').toLowerCase()==='willena_published'))result='W'}}catch(_){}sourceCache.set(key,result);return result}
async function addMockPills(){for(const kicker of document.querySelectorAll('.mock-kicker:not([data-wz-pending]),.mock-all-kicker:not([data-wz-pending])')){kicker.dataset.wzPending='1';if(kicker.querySelector('.tp-source-pill'))continue;const pr=(kicker.closest('.card')||document).querySelector('.prompt'),src=await lookupMockSource(pr?.textContent?.trim()||'',kicker.textContent||'');if(!kicker.isConnected)continue;const pill=document.createElement('span');pill.className=`tp-source-pill ${src==='W'?'w':'z'}`;pill.textContent=src;pill.title=src==='W'?'Willena':'Xocbo reference';kicker.appendChild(pill)}}
function scan(){normalizeRegularPill();addMockPills()}
function boot(){scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
console.log('[REV51] display polish only owns source labels');
})();
