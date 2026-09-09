import {helpWithAiWilli} from './ai-willi-helper.js?v=1.0.0';
import {AI_WILLI_NAME,aiWilliMessage} from './ai-willi-messages.js?v=1.0.0';

const STYLE_ID='aiWilliSharedStyles';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
.ai-willi-card{margin:14px 0 0;padding:14px 15px;border:1.5px solid #bfe7ea;border-radius:16px;background:linear-gradient(180deg,#f7feff 0%,#f0fbfc 100%);color:#263d44;box-shadow:0 5px 18px rgba(36,92,99,.07);font-family:Poppins,system-ui,sans-serif}
.ai-willi-head{display:flex;align-items:center;gap:8px;color:#ee5f91;font-weight:800;font-size:13px;line-height:1.2}
.ai-willi-mark{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:#ffe8f2;color:#ee5f91;font-size:15px;flex:0 0 auto}
.ai-willi-message{margin-top:9px;font-size:13px;line-height:1.65;font-weight:600;white-space:pre-wrap;color:#344d55}
.ai-willi-action{margin-top:11px;display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 15px;border:1.5px solid #86d9df;border-radius:12px;background:#fff;color:#d9467d;font:800 13px/1.2 Poppins,system-ui,sans-serif;cursor:pointer}
.ai-willi-action:disabled{opacity:.6;cursor:default}
.ai-willi-card.waiting .ai-willi-mark{animation:aiWilliPulse 1s ease-in-out infinite alternate}
.ai-willi-card.error{border-color:#efccd8;background:#fff7f9}
.feedback .ai-willi-feedback-head{display:flex;align-items:center;gap:7px;margin-bottom:7px;color:#d9467d;font:800 12px/1.2 Poppins,system-ui,sans-serif}
.feedback .ai-willi-feedback-head .ai-willi-mark{width:22px;height:22px;font-size:13px}
@keyframes aiWilliPulse{from{transform:scale(.92);opacity:.65}to{transform:scale(1.06);opacity:1}}
@media(min-width:600px) and (max-width:1100px){.ai-willi-card{padding:17px 18px;border-radius:18px}.ai-willi-head,.ai-willi-action{font-size:15px}.ai-willi-message{font-size:15px;line-height:1.7}}
`;
  document.head.appendChild(s);
}

function cardHtml(message,{action=false}={}){
  return `<div class="ai-willi-head"><span class="ai-willi-mark">✦</span><span>${esc(AI_WILLI_NAME)}</span></div><div class="ai-willi-message" data-ai-willi-message>${esc(message)}</div>${action?`<button type="button" class="ai-willi-action" data-ai-willi-ask>${esc(aiWilliMessage('helper','idle'))}</button>`:''}`;
}

export function showAiWilliStatus(container,{role='grader',message=null}={}){
  if(!container)return null;ensureStyles();
  container.querySelector('[data-ai-willi-status]')?.remove();
  const el=document.createElement('div');el.className='ai-willi-card waiting';el.dataset.aiWilliStatus='1';
  el.innerHTML=cardHtml(message||aiWilliMessage(role,'waiting'));
  const anchor=container.querySelector('#questionHost,.question-card');
  if(anchor?.parentNode)anchor.insertAdjacentElement('afterend',el);else container.appendChild(el);
  return el;
}

export function clearAiWilliStatus(container){container?.querySelector('[data-ai-willi-status]')?.remove()}

export function decorateAiWilliFeedback(container,result){
  if(!container||!String(result?.method||'').startsWith('ai_willi'))return;
  ensureStyles();const feedback=container.querySelector('[data-feedback]');if(!feedback||feedback.querySelector('.ai-willi-feedback-head'))return;
  feedback.insertAdjacentHTML('afterbegin',`<div class="ai-willi-feedback-head"><span class="ai-willi-mark">✦</span><span>${esc(AI_WILLI_NAME)}</span></div>`);
}

export function mountAiWilliHelper({container,question,response,result,section,lesson,practiceType,existingExplanation}={}){
  if(!container||!question||result?.correct)return null;ensureStyles();
  container.querySelector('[data-ai-willi-helper]')?.remove();
  const el=document.createElement('div');el.className='ai-willi-card';el.dataset.aiWilliHelper='1';
  el.innerHTML=cardHtml('이 문제를 더 이해하고 싶으면 AI Willi에게 물어보세요.',{action:true});
  const anchor=container.querySelector('#questionHost,.question-card');
  if(anchor?.parentNode)anchor.insertAdjacentElement('afterend',el);else container.appendChild(el);
  const btn=el.querySelector('[data-ai-willi-ask]'),message=el.querySelector('[data-ai-willi-message]');
  btn.onclick=async()=>{
    if(btn.disabled)return;btn.disabled=true;el.classList.add('waiting');message.textContent=aiWilliMessage('helper','waiting');
    try{
      const answer=await helpWithAiWilli({question,response,result,section,lesson,practiceType,existingExplanation});
      el.classList.remove('waiting','error');message.textContent=String(answer?.text||'').trim()||aiWilliMessage('helper','failed');btn.remove();
    }catch(e){
      console.warn('[AI Willi helper] failed',e);el.classList.remove('waiting');el.classList.add('error');message.textContent=aiWilliMessage('helper','failed');btn.disabled=false;
    }
  };
  return el;
}
