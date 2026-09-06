(function(){
'use strict';
const MODES=new Set(['semantic','ai_semantic','ai_semantic_strict']);
let lastReviewQuestion=null,bypass=false,busy=false;
const norm=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[“”"]/g,'').replace(/[.!?,;:]/g,'').replace(/\s+/g,' ').trim();
const answerList=q=>{const a=Array.isArray(q?.correct_answer)?q.correct_answer:[q?.correct_answer];return a.filter(v=>v!=null&&String(v).trim()!=='').map(String)};
function enabled(q){const m=q?.metadata||{};return (m.ai_allowed===true||m.ai_allowed==='true')&&MODES.has(String(m.grading_mode||'').toLowerCase())}
function exact(q,mine){const a=answerList(q);if(a.length!==1)return false;return norm(a[0])===norm(mine)}
function parseJson(text){const raw=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');const p=JSON.parse(raw);if(typeof p.correct!=='boolean')throw new Error('invalid AI verdict');return p}
async function grade(q,mine){
 const refs=answerList(q);
 const system=`You are a strict semantic adjudicator for a Korean middle-school assessment. Judge whether the student's answer communicates the same required meaning as the reference answer for the exact question and source context. Accept paraphrases and different wording when every required fact is preserved. If the task asks for an answer in Korean, grade CONTENT MEANING, not exact Korean wording, spacing, particles, or stylistic naturalness; awkward Korean is acceptable when the intended meaning is clear and complete. Do not require the model-answer sentence. Reject missing facts, contradictory meaning, or answers that change the reason/result. For English-form tasks, still enforce explicit grammar, word-count, required-word, or form constraints supplied by the question. Return JSON only: {"correct":true|false,"reason":"short reason"}`;
 const user=`QUESTION:\n${q?.prompt_text||''}\n\nCONTEXT:\n${JSON.stringify(q?.context||{})}\n\nREFERENCE ANSWER:\n${refs.join(' / ')}\n\nSTUDENT ANSWER:\n${mine}`;
 const body={endpoint:'chat/completions',payload:{model:'gpt-5.6-luna',messages:[{role:'system',content:system},{role:'user',content:user}],reasoning_effort:'low',max_completion_tokens:120,response_format:{type:'json_object'}}};
 const fetcher=window.WillenaAPI&&typeof window.WillenaAPI.fetch==='function'?window.WillenaAPI.fetch.bind(window.WillenaAPI):window.fetch.bind(window);
 const r=await fetcher('/.netlify/functions/openai_proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!r.ok)throw new Error(`AI HTTP ${r.status}`);
 const payload=await r.json(),data=payload?.data||payload,text=data?.choices?.[0]?.message?.content||payload?.result||'';
 return parseJson(text);
}
function readReviewAnswer(){
 const host=document.getElementById('tp49ConstructedHost');
 if(host){
  const multiCorr=[...host.querySelectorAll('.wcri-multi-row')];
  if(multiCorr.length)return multiCorr.map(row=>`${row.querySelector('.wcri-wrong')?.value||''} → ${row.querySelector('.wcri-right')?.value||''}`).join('\n');
  const corr=host.querySelector('.wcri-correction');
  if(corr)return `${corr.querySelector('.wcri-wrong')?.value||''} → ${corr.querySelector('.wcri-right')?.value||''}`;
  const multi=[...host.querySelectorAll('.wcri-multi .wcri-input')];if(multi.length)return multi.map(x=>x.value||'').join('\n');
  const ta=host.querySelector('.wcri-textarea');if(ta)return ta.value||'';
 }
 return document.getElementById('tp49Input')?.value||'';
}
function setReviewBusy(on){const b=document.getElementById('tp49Check'),f=document.getElementById('tp49Feedback');if(b){b.disabled=!!on;if(on)b.textContent='AI 코치에게 확인 중…';else if(!b.textContent.includes('다음')&&!b.textContent.includes('끝내기'))b.textContent='정답 확인'}if(f&&on){f.className='tp49-feedback';f.style.display='block';f.textContent='답의 의미를 확인하고 있어요…'}}
function captureQuestionResponse(response){try{response.clone().json().then(rows=>{const q=Array.isArray(rows)?rows[0]:null;if(q&&q.id)lastReviewQuestion=q}).catch(()=>{})}catch(_){}}
const originalFetch=window.fetch;
if(typeof originalFetch==='function'&&!originalFetch.__willenaSemanticCapture){const wrapped=async function(input,init){const response=await originalFetch.call(this,input,init);try{const url=String(typeof input==='string'?input:input?.url||'');if(window.__WillenaReviewV49Active&&url.includes('/rest/v1/test_prep_questions?')&&url.includes('id=eq.'))captureQuestionResponse(response)}catch(_){}return response};wrapped.__willenaSemanticCapture=true;wrapped.__original=originalFetch;window.fetch=wrapped}
document.addEventListener('click',async e=>{
 const btn=e.target?.closest?.('#tp49Check');
 if(!btn||!window.__WillenaReviewV49Active||bypass||busy)return;
 const q=lastReviewQuestion;if(!q||!enabled(q))return;
 const mine=readReviewAnswer().trim();if(!mine||exact(q,mine))return;
 e.preventDefault();e.stopImmediatePropagation();busy=true;setReviewBusy(true);
 try{
  const verdict=await grade(q,mine);
  const api=window.WillenaConstructedResponseInput,oldMatches=api?.matches;
  if(verdict.correct&&api&&typeof oldMatches==='function')api.matches=()=>true;
  else if(verdict.correct&&!document.getElementById('tp49ConstructedHost')){const input=document.getElementById('tp49Input');if(input){input.dataset.semanticOriginal=input.value;input.value=answerList(q)[0]||input.value;input.dispatchEvent(new Event('input',{bubbles:true}))}}
  bypass=true;setReviewBusy(false);btn.disabled=false;btn.click();
  setTimeout(()=>{bypass=false;if(api&&oldMatches)api.matches=oldMatches;const input=document.getElementById('tp49Input');if(input?.dataset.semanticOriginal!=null){input.value=input.dataset.semanticOriginal;delete input.dataset.semanticOriginal}},0);
 }catch(err){console.warn('[semantic-grader] review AI check failed',err);const f=document.getElementById('tp49Feedback');if(f){f.className='tp49-feedback bad';f.style.display='block';f.textContent='AI 의미 확인에 실패했습니다. 다시 시도해 주세요.'}setReviewBusy(false);btn.disabled=false}
 finally{busy=false}
},true);
window.WillenaSemanticGrader={enabled,grade,answerList};
console.log('[REV49g] shared semantic grader active');
})();