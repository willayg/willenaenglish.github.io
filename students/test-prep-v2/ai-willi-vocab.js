const MODEL='gpt-5.6-luna';
const TIMEOUT=12000;
const STYLE_ID='aiWilliVocabStyles';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function formatText(value){
  return esc(String(value??'')).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
}
function fetcher(){return window.WillenaAPI&&typeof window.WillenaAPI.fetch==='function'?window.WillenaAPI.fetch.bind(window.WillenaAPI):fetch}
function extractText(payload){const data=payload?.data||payload;return String(data?.choices?.[0]?.message?.content||payload?.result||'').trim()}
async function callAi(messages,maxCompletionTokens=260){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT);
  try{
    const response=await fetcher()('/.netlify/functions/openai_proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:'chat/completions',payload:{model:MODEL,messages,reasoning_effort:'low',max_completion_tokens:maxCompletionTokens}}),signal:controller.signal});
    if(!response.ok)throw new Error(`AI_WILLI_VOCAB_HTTP_${response.status}`);
    const text=extractText(await response.json());if(!text)throw new Error('AI_WILLI_VOCAB_EMPTY');return text;
  }finally{clearTimeout(timer)}
}
function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`.ai-willi-vocab{margin:14px 0 0;padding:14px 15px;border:1.5px solid #bfe7ea;border-radius:16px;background:linear-gradient(180deg,#f7feff,#f0fbfc);color:#263d44;box-shadow:0 5px 18px rgba(36,92,99,.07);font-family:Poppins,system-ui,sans-serif}.ai-willi-vocab-head{display:flex;align-items:center;gap:8px;color:#ee5f91;font-weight:800;font-size:13px}.ai-willi-vocab-mark{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:#ffe8f2;color:#ee5f91}.ai-willi-vocab-text{margin-top:10px;padding:10px 12px;border:1px solid #d8ecee;border-radius:14px;background:#fff;font-size:13px;line-height:1.65;font-weight:600;color:#344d55}.ai-willi-vocab-text strong{font-weight:900}.ai-willi-vocab-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}.ai-willi-vocab button{min-height:40px;padding:0 14px;border:1.5px solid #86d9df;border-radius:12px;background:#fff;color:#d9467d;font:800 13px Poppins,system-ui,sans-serif}.ai-willi-vocab button:disabled{opacity:.55}.ai-willi-vocab-thinking{display:inline-flex;gap:5px;align-items:center}.ai-willi-vocab-thinking i{width:7px;height:7px;border-radius:50%;background:#ee5f91;opacity:.4;animation:aiWilliVocabDot 1s ease-in-out infinite}.ai-willi-vocab-thinking i:nth-child(2){animation-delay:.14s}.ai-willi-vocab-thinking i:nth-child(3){animation-delay:.28s}@keyframes aiWilliVocabDot{0%,60%,100%{transform:translateY(0);opacity:.3}30%{transform:translateY(-4px);opacity:1}}`;
  document.head.appendChild(s);
}
function thinking(){return '<span class="ai-willi-vocab-thinking"><i></i><i></i><i></i></span>'}
function responseText(response,question){
  if(Array.isArray(response))return response.join(', ');
  const raw=String(response??'').trim();
  const n=Number(raw);if(Number.isInteger(n)&&n>0&&Array.isArray(question?.choices)&&question.choices[n-1]!=null)return `${raw}: ${question.choices[n-1]}`;
  return raw;
}
function answerText(question){
  const a=Array.isArray(question?.answer)?question.answer[0]:question?.answer;
  const n=Number(a);if(Number.isInteger(n)&&n>0&&Array.isArray(question?.choices)&&question.choices[n-1]!=null)return String(question.choices[n-1]);
  return String(a??'');
}
async function quickExplain({item,question,response,mode}){
  const target=String(item?.canonical_text||question?.metadata?.canonical_text||'').trim(),meaning=String(item?.translation_ko||question?.metadata?.translation_ko||'').trim(),definition=String(item?.definition_en||question?.metadata?.definition_en||'').trim();
  const system=`You are AI Willi, a concise vocabulary tutor for Korean middle-school students. Answer in Korean. This is a vocabulary test, not a grammar lesson. Keep the first explanation very short: normally 2-4 short sentences. Explain the relevant word or expression and why the correct answer fits this question. If the question compares several word-definition pairs, explain only the decisive pair or distinction needed to understand the answer. Do not give a long grammar explanation, a word list, headings, tables, or extra study advice.`;
  const user=`TARGET WORD OR EXPRESSION: ${target}\nKNOWN KOREAN MEANING: ${meaning}\nKNOWN ENGLISH DEFINITION: ${definition}\nPRACTICE MODE: ${mode}\nQUESTION: ${question?.prompt||''}\nCONTEXT: ${JSON.stringify(question?.context||{})}\nCHOICES: ${JSON.stringify(question?.choices||[])}\nSTUDENT ANSWER: ${responseText(response,question)}\nCORRECT ANSWER: ${answerText(question)}`;
  return callAi([{role:'system',content:system},{role:'user',content:user}],240);
}
async function examples({item,question,previous}){
  const target=String(item?.canonical_text||question?.metadata?.canonical_text||'').trim(),meaning=String(item?.translation_ko||question?.metadata?.translation_ko||'').trim();
  const system=`You are AI Willi, a concise vocabulary tutor for Korean middle-school students. Give exactly 3 short, natural English example sentences using the main target word or expression from the question, each followed by a short Korean meaning. Keep them easy and varied. If the question contains several words, use the word or expression that is decisive for the correct answer. No introduction, grammar lecture, table, or extra notes.`;
  const user=`TARGET WORD OR EXPRESSION: ${target}\nKOREAN MEANING: ${meaning}\nQUESTION: ${question?.prompt||''}\nCONTEXT: ${JSON.stringify(question?.context||{})}\nCHOICES: ${JSON.stringify(question?.choices||[])}\nCORRECT ANSWER: ${answerText(question)}\nPREVIOUS EXPLANATION: ${previous||''}`;
  return callAi([{role:'system',content:system},{role:'user',content:user}],280);
}

export function mountVocabAiWilli({container,item={},question,response,result,mode}={}){
  if(!container||!question||result?.correct)return null;ensureStyles();container.querySelector('[data-ai-willi-vocab]')?.remove();
  const el=document.createElement('div');el.className='ai-willi-vocab';el.dataset.aiWilliVocab='1';el.innerHTML=`<div class="ai-willi-vocab-head"><span class="ai-willi-vocab-mark">✦</span><span>AI Willi</span></div><div class="ai-willi-vocab-text">이 단어가 헷갈렸다면 짧게 설명해 줄게요.</div><div class="ai-willi-vocab-actions"><button type="button" data-vocab-willi-ask>AI Willi에게 물어보기</button></div>`;
  const anchor=container.querySelector('#vpQuestionHost')?.closest('.vp-card')||container.querySelector('#questionHost')?.closest('.question-card')||container.querySelector('#vpQuestionHost,#questionHost,.question-card');if(anchor?.parentNode)anchor.insertAdjacentElement('afterend',el);else container.appendChild(el);
  const text=el.querySelector('.ai-willi-vocab-text'),actions=el.querySelector('.ai-willi-vocab-actions'),ask=el.querySelector('[data-vocab-willi-ask]');let busy=false,initial='';
  const setBusy=v=>{busy=!!v;el.querySelectorAll('button').forEach(b=>b.disabled=busy)};
  ask.onclick=async()=>{if(busy)return;setBusy(true);text.innerHTML=thinking();try{initial=await quickExplain({item,question,response,mode});text.innerHTML=formatText(initial);actions.innerHTML='<button type="button" data-vocab-willi-examples>예문 보기</button>';const b=actions.querySelector('[data-vocab-willi-examples]');b.onclick=async()=>{if(busy)return;setBusy(true);text.innerHTML=`${formatText(initial)}<br><br>${thinking()}`;try{const more=await examples({item,question,previous:initial});text.innerHTML=`${formatText(initial)}<br><br>${formatText(more)}`;b.remove()}catch(e){console.warn('[AI Willi vocab examples] failed',e);text.innerHTML=formatText(initial)}finally{setBusy(false)}}}catch(e){console.warn('[AI Willi vocab] failed',e);text.textContent='지금은 설명을 불러오지 못했어요. 다시 시도해 주세요.'}finally{setBusy(false)}};
  return el;
}