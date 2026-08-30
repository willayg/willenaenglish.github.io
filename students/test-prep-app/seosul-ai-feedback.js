(function(){
'use strict';

let lastVerdict = null;
let thinkingTimer = null;
let thinkingButton = null;
let dots = 1;

function isSeosulAiRequest(url, options){
  if(!String(url || '').includes('/.netlify/functions/openai_proxy')) return false;
  try{
    const body = JSON.parse(options?.body || '{}');
    const payload = body?.payload || {};
    const system = payload?.messages?.find?.(m => m?.role === 'system')?.content || '';
    return payload?.model === 'gpt-5.6-luna' && system.includes('STRICT adjudicator for a Korean middle-school written English test');
  }catch(_){ return false; }
}

function enrichRequest(options){
  try{
    const body = JSON.parse(options?.body || '{}');
    const messages = body?.payload?.messages;
    if(!Array.isArray(messages)) return options;
    const system = messages.find(m => m?.role === 'system');
    if(!system) return options;
    system.content = String(system.content || '').replace(
      /Return JSON only:[\s\S]*$/,
      'Return JSON only: {"correct":true|false,"reason_code":"typo|spelling|capitalization|punctuation|grammar|meaning|completeness|task|word_choice|word_order|missing_required_word|extra_information|correct_alternative|other","reason":"very short internal reason","error_label_ko":"짧은 오류 유형","explanation_ko":"student-facing Korean explanation"}. If correct, error_label_ko and explanation_ko must both be empty strings. If incorrect, identify the PRIMARY reason the answer is wrong. Use typo only for an obvious accidental mistype where the intended word is clear; use spelling for a genuine spelling error; grammar for tense/agreement/article/preposition/form errors; meaning for wrong meaning; completeness for missing required information; task for not following the question; word_choice for the wrong lexical item; word_order for incorrect ordering; missing_required_word when a required word/condition was omitted. explanation_ko must be 1–2 short Korean sentences that say exactly what was wrong and, when useful, how to fix it. Be concrete and strict. Do not praise, soften, or merely say that the answer differs from the model answer.'
    );
    body.payload.max_completion_tokens = Math.max(Number(body.payload.max_completion_tokens || 0), 220);
    return {...options, body: JSON.stringify(body)};
  }catch(_){ return options; }
}

async function captureVerdict(response){
  try{
    if(!response?.clone) return;
    const outer = await response.clone().json();
    const data = outer?.data || outer;
    const text = data?.choices?.[0]?.message?.content || outer?.result || '';
    const clean = String(text || '').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    const verdict = JSON.parse(clean);
    if(typeof verdict?.correct === 'boolean'){
      lastVerdict = {...verdict, capturedAt: Date.now()};
      setTimeout(inspect, 0);
    }
  }catch(_){ }
}

function wrapFetcher(owner, key){
  const original = owner?.[key];
  if(typeof original !== 'function' || original.__seosulAiFeedbackWrapped) return;
  const wrapped = async function(url, options){
    const match = isSeosulAiRequest(url, options);
    const nextOptions = match ? enrichRequest(options || {}) : options;
    if(match) lastVerdict = null;
    const response = await original.call(this, url, nextOptions);
    if(match) captureVerdict(response);
    return response;
  };
  wrapped.__seosulAiFeedbackWrapped = true;
  wrapped.__original = original;
  owner[key] = wrapped;
}

function installFetchHooks(){
  wrapFetcher(window, 'fetch');
  if(window.WillenaAPI) wrapFetcher(window.WillenaAPI, 'fetch');
}

function stopThinking(){
  if(thinkingTimer) clearInterval(thinkingTimer);
  thinkingTimer = null;
  thinkingButton = null;
  dots = 1;
}

function startThinking(btn){
  if(!btn || thinkingButton === btn) return;
  stopThinking();
  thinkingButton = btn;
  dots = 1;
  btn.textContent = 'AI thinking.';
  thinkingTimer = setInterval(() => {
    if(!document.contains(btn) || !btn.disabled){ stopThinking(); return; }
    dots = dots % 3 + 1;
    btn.textContent = 'AI thinking' + '.'.repeat(dots);
  }, 420);
}

function addExplanation(){
  const feedback = document.querySelector('#feedback.feedback.bad');
  const model = document.getElementById('seosulModel');
  if(!feedback || !model?.classList.contains('show')) return;
  if(document.getElementById('seosulAiExplanation')) return;
  if(!lastVerdict || lastVerdict.correct !== false || Date.now() - Number(lastVerdict.capturedAt || 0) > 15000) return;
  const text = String(lastVerdict.explanation_ko || '').trim();
  const label = String(lastVerdict.error_label_ko || '').trim();
  if(!text && !label) return;
  const box = document.createElement('div');
  box.id = 'seosulAiExplanation';
  box.className = 'seosul-ai-explanation';
  box.innerHTML = '<b></b><div></div>';
  box.querySelector('b').textContent = label ? `왜 틀렸나요? · ${label}` : '왜 틀렸나요?';
  box.querySelector('div').textContent = text;
  model.parentNode.insertBefore(box, model);
}

function inspect(){
  const btn = document.getElementById('seosulCheck');
  const feedback = document.getElementById('feedback');
  const aiActive = !!btn?.disabled && (
    String(btn?.textContent || '').includes('AI 코치') ||
    String(btn?.textContent || '').startsWith('AI thinking') ||
    feedback?.classList.contains('authored-ai')
  );
  if(aiActive) startThinking(btn);
  else if(thinkingButton) stopThinking();
  addExplanation();
}

function addStyles(){
  if(document.getElementById('seosulAiFeedbackStyles')) return;
  const style = document.createElement('style');
  style.id = 'seosulAiFeedbackStyles';
  style.textContent = `
    .seosul-ai-explanation{margin-top:12px;padding:13px 14px;border-radius:12px;background:#eef9fa;color:#34454b;font-size:14px;line-height:1.6}
    .seosul-ai-explanation b{display:block;color:#19777e;margin-bottom:4px;font-size:14px}
  `;
  document.head.appendChild(style);
}

function boot(){
  addStyles();
  installFetchHooks();
  const observer = new MutationObserver(inspect);
  observer.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['class','disabled']});
  inspect();
  let n = 0;
  const hookRetry = setInterval(() => {
    installFetchHooks();
    if(++n > 80) clearInterval(hookRetry);
  }, 100);
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
else boot();
})();
