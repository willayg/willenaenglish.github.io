import {helpWithAiWilli} from './ai-willi-helper.js?v=1.2.0';
import {AI_WILLI_NAME,aiWilliMessage} from './ai-willi-messages.js?v=1.0.0';

const STYLE_ID='aiWilliSharedStyles';
const MAX_FOLLOWUPS=2;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function formatAiWilliText(value){
  const src=String(value??'').replace(/\r\n?/g,'\n').trim();
  if(!src)return'';
  const inline=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
  const lines=src.split('\n');
  const out=[];
  let list=[];
  const flush=()=>{if(!list.length)return;out.push(`<ul>${list.map(x=>`<li>${inline(x)}</li>`).join('')}</ul>`);list=[]};
  for(const raw of lines){
    const line=raw.trim();
    if(!line){flush();continue}
    const bullet=line.match(/^[-•]\s+(.+)$/);
    if(bullet){list.push(bullet[1]);continue}
    flush();
    const numbered=line.match(/^\d+[.)]\s+(.+)$/);
    if(numbered){out.push(`<div class="ai-willi-numbered">${inline(line)}</div>`);continue}
    if(/^#{1,3}\s+/.test(line)){out.push(`<div class="ai-willi-subhead">${inline(line.replace(/^#{1,3}\s+/,''))}</div>`);continue}
    out.push(`<p>${inline(line)}</p>`);
  }
  flush();
  return out.join('');
}

function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
.ai-willi-card{margin:14px 0 0;padding:14px 15px;border:1.5px solid #bfe7ea;border-radius:16px;background:linear-gradient(180deg,#f7feff 0%,#f0fbfc 100%);color:#263d44;box-shadow:0 5px 18px rgba(36,92,99,.07);font-family:Poppins,system-ui,sans-serif}
.ai-willi-head{display:flex;align-items:center;gap:8px;color:#ee5f91;font-weight:800;font-size:13px;line-height:1.2}
.ai-willi-mark{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:#ffe8f2;color:#ee5f91;font-size:15px;flex:0 0 auto}
.ai-willi-message{margin-top:9px;font-size:13px;line-height:1.65;font-weight:600;color:#344d55}
.ai-willi-message p{margin:0 0 9px}.ai-willi-message p:last-child{margin-bottom:0}
.ai-willi-message ul{margin:6px 0 10px;padding-left:22px}.ai-willi-message li{margin:4px 0}
.ai-willi-message strong{font-weight:900;color:#263d44}.ai-willi-message code{font-family:inherit;font-weight:800;background:#e9f7f8;border-radius:5px;padding:1px 4px}
.ai-willi-subhead{margin:10px 0 5px;font-weight:900;color:#263d44}.ai-willi-numbered{margin:5px 0}
.ai-willi-action{margin-top:11px;display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 15px;border:1.5px solid #86d9df;border-radius:12px;background:#fff;color:#d9467d;font:800 13px/1.2 Poppins,system-ui,sans-serif;cursor:pointer}
.ai-willi-action:disabled,.ai-willi-refine:disabled{opacity:.55;cursor:default}
.ai-willi-refinements{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.ai-willi-refine{min-height:38px;padding:0 12px;border:1.5px solid #b7dfe3;border-radius:999px;background:#fff;color:#31545d;font:800 12px/1.2 Poppins,system-ui,sans-serif;cursor:pointer;touch-action:manipulation}
.ai-willi-refine:hover{border-color:#86d9df;background:#f9feff}
.ai-willi-refine-note{margin-top:8px;color:#71868d;font-size:11px;font-weight:700}
.ai-willi-card.waiting .ai-willi-mark{animation:aiWilliPulse 1s ease-in-out infinite alternate}
.ai-willi-card.error{border-color:#efccd8;background:#fff7f9}
.feedback .ai-willi-feedback-head{display:flex;align-items:center;gap:7px;margin-bottom:7px;color:#d9467d;font:800 12px/1.2 Poppins,system-ui,sans-serif}
.feedback .ai-willi-feedback-head .ai-willi-mark{width:22px;height:22px;font-size:13px}
@keyframes aiWilliPulse{from{transform:scale(.92);opacity:.65}to{transform:scale(1.06);opacity:1}}
@media(min-width:600px) and (max-width:1100px){.ai-willi-card{padding:17px 18px;border-radius:18px}.ai-willi-head,.ai-willi-action{font-size:15px}.ai-willi-message{font-size:15px;line-height:1.7}.ai-willi-refine{font-size:14px;min-height:42px;padding:0 15px}.ai-willi-refine-note{font-size:13px}}
`;
  document.head.appendChild(s);
}

function cardHtml(message,{action=false}={}){
  return `<div class="ai-willi-head"><span class="ai-willi-mark">✦</span><span>${esc(AI_WILLI_NAME)}</span></div><div class="ai-willi-message" data-ai-willi-message>${esc(message)}</div>${action?`<button type="button" class="ai-willi-action" data-ai-willi-ask>${esc(aiWilliMessage('helper','idle'))}</button>`:''}<div data-ai-willi-refinements></div>`;
}

function refinementHtml(used){
  const left=Math.max(0,MAX_FOLLOWUPS-used);
  if(left<=0)return `<div class="ai-willi-refine-note">AI Willi follow-ups complete.</div>`;
  return `<div class="ai-willi-refinements"><button type="button" class="ai-willi-refine" data-ai-willi-refine="examples">More examples</button><button type="button" class="ai-willi-refine" data-ai-willi-refine="simple">More simple</button><button type="button" class="ai-willi-refine" data-ai-willi-refine="details">More details</button></div><div class="ai-willi-refine-note">${left} follow-up${left===1?'':'s'} left</div>`;
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
  const askBtn=el.querySelector('[data-ai-willi-ask]'),message=el.querySelector('[data-ai-willi-message]'),refineBox=el.querySelector('[data-ai-willi-refinements]');
  let previousExplanation='',followupsUsed=0,busy=false;

  const setBusy=value=>{
    busy=!!value;el.classList.toggle('waiting',busy);
    el.querySelectorAll('button').forEach(b=>b.disabled=busy);
  };
  const run=async mode=>{
    if(busy)return;
    setBusy(true);el.classList.remove('error');
    const prior=previousExplanation;
    message.textContent=aiWilliMessage('helper','waiting');
    try{
      const answer=await helpWithAiWilli({question,response,result,section,lesson,practiceType,existingExplanation,mode,previousExplanation:prior});
      const text=String(answer?.text||'').trim()||aiWilliMessage('helper','failed');
      previousExplanation=text;
      message.innerHTML=formatAiWilliText(text);
      el.classList.remove('error');
      if(mode!=='initial')followupsUsed=Math.min(MAX_FOLLOWUPS,followupsUsed+1);
      askBtn?.remove();
      showRefinements();
    }catch(e){
      console.warn('[AI Willi helper] failed',e);el.classList.add('error');message.textContent=aiWilliMessage('helper','failed');
    }finally{setBusy(false)}
  };
  const showRefinements=()=>{
    if(!refineBox)return;
    refineBox.innerHTML=refinementHtml(followupsUsed);
    refineBox.querySelectorAll('[data-ai-willi-refine]').forEach(btn=>{
      btn.onclick=ev=>{
        ev.preventDefault();ev.stopPropagation();
        if(busy||followupsUsed>=MAX_FOLLOWUPS)return;
        run(btn.dataset.aiWilliRefine||'simple');
      };
    });
  };

  askBtn.onclick=ev=>{ev.preventDefault();ev.stopPropagation();run('initial')};
  return el;
}
