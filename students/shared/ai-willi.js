import {contentDbRpc} from '../test-prep-v2/content-source.js?v=2.24.3';

const AI_WILLI_NAME='AI Willi';
const AI_WILLI_EXPLANATION_VERSION='v3';
const DEFAULT_MODEL='gpt-5.6-luna';
const DEFAULT_TIMEOUT_MS=15000;
const STYLE_ID='aiWilliSharedStyles';
const REFINEMENTS={vocab:'핵심 단어',details:'더 자세히 설명',examples:'예시 더 보기'};
const MESSAGES={
  grader:{idle:'AI Willi로 확인',waiting:'AI Willi가 답을 확인하고 있어요…',failed:'AI Willi가 답을 확인하지 못했어요. 다시 시도해 주세요.'},
  helper:{idle:'AI Willi에게 물어보기',waiting:'AI Willi가 생각하고 있어요…',failed:'AI Willi가 지금 답하지 못했어요. 다시 시도해 주세요.'}
};

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function aiWilliMessage(role,key){return MESSAGES?.[role]?.[key]||MESSAGES.helper.idle}

function fetcher(){return window.WillenaAPI&&typeof window.WillenaAPI.fetch==='function'?window.WillenaAPI.fetch.bind(window.WillenaAPI):fetch}
function extractText(payload){const data=payload?.data||payload;return String(data?.choices?.[0]?.message?.content||payload?.result||'').trim()}
async function callAiWilli({messages,model=DEFAULT_MODEL,reasoningEffort='low',maxCompletionTokens=500,responseFormat=null,temperature=null,timeoutMs=DEFAULT_TIMEOUT_MS}={}){
  if(!Array.isArray(messages)||!messages.length)throw new Error('AI_WILLI_MESSAGES_REQUIRED');
  const payload={model,messages,reasoning_effort:reasoningEffort,max_completion_tokens:maxCompletionTokens};
  if(responseFormat)payload.response_format=responseFormat;if(temperature!=null)payload.temperature=temperature;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetcher()('/.netlify/functions/openai_proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:'chat/completions',payload}),signal:controller.signal});
    if(!response.ok)throw new Error(`AI_WILLI_HTTP_${response.status}`);
    const json=await response.json(),text=extractText(json);if(!text)throw new Error('AI_WILLI_EMPTY_RESPONSE');return{text};
  }finally{clearTimeout(timer)}
}
function parseJson(text){return JSON.parse(String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''))}

function systemPrompt(section){
  if(String(section||'').toLowerCase()==='reading')return `You are AI Willi, a clear and supportive English reading tutor for Korean middle-school students. Explain in Korean, using English only for short quotations, expressions, or example sentences. Base the explanation only on the supplied question, passage/context, answers, grading result, and existing explanation. First identify what the question is testing, then explain why the student's answer did not work and what evidence makes the correct answer work. Do not invent the student's reasoning. Keep the answer easy to scan. Avoid unnecessary greetings, tables, and markdown bold markers.`;
  return `You are AI Willi, a clear and supportive English tutor for Korean middle-school students. Explain in Korean, using English only for grammar labels, short expressions, or example sentences. Base the explanation only on the supplied question, context, answers, grading result, and existing explanation. First identify the key grammar or language point, then explain why the student's answer did not work and why the accepted answer works. Do not invent the student's reasoning. Keep the answer easy to scan. Avoid unnecessary greetings, tables, and markdown bold markers.`;
}
function refinementInstruction(mode){
  if(mode==='vocab')return `설명은 길게 하지 마세요. 이 문제를 이해하는 데 도움이 되는 어려운 영어 단어와 표현만 골라 주세요.`;
  if(mode==='examples')return `학생이 예시를 더 보고 싶어 합니다. 같은 핵심 내용을 더 구체적인 예시를 사용해서 설명하세요. 학생 수준에 맞는 짧은 영어 예문을 2~4개 제시하고, 각 예문을 짧고 쉬운 한국어로 설명하세요. 이전 설명을 그대로 반복하지 마세요.`;
  if(mode==='details')return `학생이 더 자세한 설명을 원합니다. 같은 핵심 내용을 더 깊이 있게 설명하세요. 중요한 규칙, 학생의 답이 왜 맞지 않는지, 정답이 왜 맞는지, 그리고 이 문제에 직접 도움이 되는 비교나 예외가 있다면 함께 설명하세요. 이 문제와 관련 없는 내용으로 넓히지 마세요.`;
  return `학생에게 첫 번째 설명을 아주 쉽고 단순하게 제공하세요. 짧은 한국어 문장과 쉬운 단어를 사용하고, 한 번에 하나의 핵심 규칙이나 개념만 설명하세요. 먼저 왜 틀렸는지와 왜 정답이 맞는지를 쉽게 이해시키는 것이 목표입니다. 보통 3~6개의 짧은 문단이나 불릿이면 충분합니다.`;
}
function vocabInstruction(mode){
  if(mode!=='vocab')return `vocabulary에는 빈 배열 []을 반환하세요.`;
  return `vocabulary에는 이 실제 문제와 지문/대화/선택지에 나온 영어 중 한국 중학생에게 어려울 가능성이 높고 문제 이해에 도움이 되는 단어 또는 표현만 3~6개 고르세요. 단순히 모든 단어를 나열하지 마세요. 쉬운 기초어는 제외하세요. 구동사나 고정 표현이 더 유용하면 한 덩어리로 고르세요. 각 항목은 term, meaning_ko, note_ko를 포함하세요. meaning_ko는 짧은 한국어 뜻, note_ko는 이 문제 문맥에서의 의미나 쓰임을 한 문장 이내로 설명하세요. 적절한 어려운 어휘가 거의 없으면 억지로 채우지 마세요.`;
}
function normalizeVocabulary(value){
  if(!Array.isArray(value))return[];const seen=new Set(),out=[];
  for(const row of value){const term=String(row?.term||'').trim(),meaning=String(row?.meaning_ko||'').trim(),note=String(row?.note_ko||'').trim(),key=term.toLowerCase();if(!term||!meaning||seen.has(key))continue;seen.add(key);out.push({term,meaning_ko:meaning,note_ko:note});if(out.length>=6)break}return out;
}
function vocabularyText(vocabulary){
  if(!vocabulary.length)return `### 핵심 단어\n이 문제에는 따로 뽑을 만한 어려운 핵심 단어가 많지 않아요.`;
  return `### 핵심 단어\n${vocabulary.map(v=>`- ${v.term} — ${v.meaning_ko}${v.note_ko?` · ${v.note_ko}`:''}`).join('\n')}`;
}
async function helpWithAiWilli({question,response,result,section,lesson,practiceType,existingExplanation,mode='initial',previousExplanation=''}={}){
  if(!question)throw new Error('AI_WILLI_HELP_QUESTION_REQUIRED');
  const context={question_id:question.id||null,section:section||question.skill||practiceType||'',lesson:lesson||'',practice_type:practiceType||question?.tracking?.practiceType||'',prompt:question.prompt||'',context:question.context||{},choices:question.choices||[],student_response:response??null,accepted_answer:question.answer||[],grading_result:result||null,existing_explanation:existingExplanation||question?.metadata?.explanation_ko||question?.metadata?.source_explanation_ko||'',previous_ai_willi_explanation:previousExplanation||''};
  const {text:raw}=await callAiWilli({messages:[{role:'system',content:`${systemPrompt(context.section)} Return only valid JSON with this shape: {"explanation":"...","vocabulary":[{"term":"...","meaning_ko":"...","note_ko":"..."}]}. Do not wrap the JSON in markdown.`},{role:'user',content:`${refinementInstruction(mode)}\n\n${vocabInstruction(mode)}\n\n아래에 제공된 실제 문제 정보만 사용하세요.\n\n${JSON.stringify(context,null,2)}`}],reasoningEffort:'low',maxCompletionTokens:mode==='details'?1000:mode==='examples'?900:mode==='vocab'?500:700,responseFormat:{type:'json_object'}});
  let parsed;try{parsed=parseJson(raw)}catch(_){parsed={explanation:raw,vocabulary:[]}}
  const vocabulary=mode==='vocab'?normalizeVocabulary(parsed?.vocabulary):[];
  const explanation=String(parsed?.explanation||raw||'').trim();
  return{text:mode==='vocab'?vocabularyText(vocabulary):explanation,vocabulary};
}

function stable(v){if(v==null)return'';if(Array.isArray(v))return`[${v.map(stable).join(',')}]`;if(typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;return JSON.stringify(v)}
function answerFingerprint(response){
  if(Array.isArray(response))return response.map(v=>String(v??'').trim()).filter(Boolean).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'})).join(',');
  if(response==null)return'';if(typeof response==='string'||typeof response==='number')return String(response).trim();return stable(response);
}
function voterKey(){const key='aiWilliVoterKey';try{let v=localStorage.getItem(key);if(!v){v=(crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`).slice(0,120);localStorage.setItem(key,v)}return v}catch(_){return`session-${String(navigator?.userAgent||'browser').slice(0,80)}`}}
async function getCached({questionId,mode,response,rootExplanationId=null}){
  if(!questionId||!mode)return null;const isVocab=mode==='vocab';
  const rows=await contentDbRpc('get_test_prep_ai_explanation',{p_question_id:questionId,p_mode:mode,p_answer_fingerprint:isVocab?'':answerFingerprint(response),p_explanation_version:AI_WILLI_EXPLANATION_VERSION,p_root_explanation_id:isVocab?null:rootExplanationId});
  return Array.isArray(rows)?rows[0]||null:null;
}
async function saveCached({questionId,section,mode,response,text,vocabulary=[],rootExplanationId=null}){
  if(!questionId||!mode||!String(text||'').trim())return null;const isVocab=mode==='vocab';
  const rows=await contentDbRpc('save_test_prep_ai_explanation',{p_question_id:questionId,p_section:String(section||''),p_mode:mode,p_answer_fingerprint:isVocab?'':answerFingerprint(response),p_explanation_version:AI_WILLI_EXPLANATION_VERSION,p_explanation_text:String(text).trim(),p_root_explanation_id:isVocab?null:rootExplanationId,p_vocabulary:isVocab&&Array.isArray(vocabulary)?vocabulary:[]});
  return Array.isArray(rows)?rows[0]||null:null;
}
async function rateCached(explanationId,helpful){if(!explanationId)return null;const rows=await contentDbRpc('rate_test_prep_ai_explanation',{p_explanation_id:explanationId,p_helpful:!!helpful,p_voter_key:voterKey()});return Array.isArray(rows)?rows[0]||null:null}

function formatAiWilliText(value){
  const src=String(value??'').replace(/\r\n?/g,'\n').trim();if(!src)return'';
  const inline=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
  const lines=src.split('\n'),out=[];let list=[];const flush=()=>{if(!list.length)return;out.push(`<ul>${list.map(x=>`<li>${inline(x)}</li>`).join('')}</ul>`);list=[]};
  for(const raw of lines){const line=raw.trim();if(!line){flush();continue}const bullet=line.match(/^[-•]\s+(.+)$/);if(bullet){list.push(bullet[1]);continue}flush();const numbered=line.match(/^\d+[.)]\s+(.+)$/);if(numbered){out.push(`<div class="ai-willi-numbered">${inline(line)}</div>`);continue}if(/^#{1,3}\s+/.test(line)){out.push(`<div class="ai-willi-subhead">${inline(line.replace(/^#{1,3}\s+/,''))}</div>`);continue}out.push(`<p>${inline(line)}</p>`)}flush();return out.join('');
}
function thinkingHtml(){return `<div class="ai-willi-thinking" role="status" aria-label="AI Willi is thinking"><span></span><span></span><span></span></div>`}
function thumbSvg(up=true){return up?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v10H4V10h3Zm2 10V10l4-7c1.2.2 2 1.3 1.8 2.5L14.2 9H19c1.2 0 2.1 1.1 1.8 2.3l-1.6 6.8c-.2 1.1-1.2 1.9-2.3 1.9H9Z"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14V4H4v10h3Zm2-10v10l4 7c1.2-.2 2-1.3 1.8-2.5L14.2 15H19c1.2 0 2.1-1.1 1.8-2.3l-1.6-6.8C19 4.8 18 4 16.9 4H9Z"/></svg>'}
function ratedKey(id){return`aiWilliRated:${id}`}
function alreadyRated(id){try{return localStorage.getItem(ratedKey(id))||''}catch(_){return''}}
function markRated(id,value){try{localStorage.setItem(ratedKey(id),value)}catch(_){}}
function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
.ai-willi-card{margin:14px 0 0;padding:14px 15px;border:1.5px solid #bfe7ea;border-radius:16px;background:linear-gradient(180deg,#f7feff 0%,#f0fbfc 100%);color:#263d44;box-shadow:0 5px 18px rgba(36,92,99,.07);font-family:Poppins,system-ui,sans-serif}.ai-willi-head{display:flex;align-items:center;gap:8px;color:#ee5f91;font-weight:800;font-size:13px;line-height:1.2}.ai-willi-mark{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:#ffe8f2;color:#ee5f91;font-size:15px;flex:0 0 auto}.ai-willi-thread{display:flex;flex-direction:column;gap:10px;margin-top:10px}.ai-willi-turn{max-width:94%;border-radius:14px;padding:10px 12px}.ai-willi-turn.willi{align-self:flex-start;background:#fff;border:1px solid #d8ecee}.ai-willi-turn.student{align-self:flex-end;background:#e9f7f8;border:1px solid #c7e5e8;color:#31545d;font-size:12px;font-weight:800;padding:8px 11px}.ai-willi-message{font-size:13px;line-height:1.65;font-weight:600;color:#344d55}.ai-willi-message p{margin:0 0 9px}.ai-willi-message p:last-child{margin-bottom:0}.ai-willi-message ul{margin:6px 0 10px;padding-left:22px}.ai-willi-message li{margin:4px 0}.ai-willi-message strong{font-weight:900;color:#263d44}.ai-willi-message code{font-family:inherit;font-weight:800;background:#e9f7f8;border-radius:5px;padding:1px 4px}.ai-willi-subhead{margin:10px 0 5px;font-weight:900;color:#263d44}.ai-willi-numbered{margin:5px 0}.ai-willi-thinking{display:flex;align-items:center;gap:5px;min-width:46px;height:22px;padding:0 2px}.ai-willi-thinking span{display:block;width:7px;height:7px;border-radius:50%;background:#ee5f91;opacity:.35;animation:aiWilliDot 1.05s ease-in-out infinite}.ai-willi-thinking span:nth-child(2){animation-delay:.14s}.ai-willi-thinking span:nth-child(3){animation-delay:.28s}.ai-willi-vote{display:flex;align-items:center;gap:5px;margin-top:8px;padding-top:6px;border-top:1px solid #edf4f5}.ai-willi-vote button{display:grid;place-items:center;width:30px;height:28px;padding:0;border:0;border-radius:8px;background:transparent;color:#83969d;cursor:pointer;touch-action:manipulation}.ai-willi-vote button:hover:not(:disabled){background:#f0f8f9;color:#31545d}.ai-willi-vote button:disabled{cursor:default;opacity:.45}.ai-willi-vote button.on{background:#e9f7f8;color:#d9467d;opacity:1}.ai-willi-vote svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linejoin:round;stroke-linecap:round}.ai-willi-vote-note{font-size:10px;font-weight:700;color:#8b999e;margin-left:2px}.ai-willi-action{margin-top:11px;display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 15px;border:1.5px solid #86d9df;border-radius:12px;background:#fff;color:#d9467d;font:800 13px/1.2 Poppins,system-ui,sans-serif;cursor:pointer}.ai-willi-action:disabled,.ai-willi-refine:disabled{opacity:.48;cursor:default}.ai-willi-refinements{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.ai-willi-refine{min-height:38px;padding:0 12px;border:1.5px solid #b7dfe3;border-radius:999px;background:#fff;color:#31545d;font:800 12px/1.2 Poppins,system-ui,sans-serif;cursor:pointer;touch-action:manipulation}.ai-willi-refine:hover:not(:disabled){border-color:#86d9df;background:#f9feff}.ai-willi-refine.used{background:#eef3f4;color:#8b999e;border-color:#d9e2e4}.ai-willi-card.waiting .ai-willi-mark{animation:aiWilliPulse .8s ease-in-out infinite alternate}.ai-willi-card.error{border-color:#efccd8;background:#fff7f9}.feedback .ai-willi-feedback-head{display:flex;align-items:center;gap:7px;margin-bottom:7px;color:#d9467d;font:800 12px/1.2 Poppins,system-ui,sans-serif}.feedback .ai-willi-feedback-head .ai-willi-mark{width:22px;height:22px;font-size:13px}@keyframes aiWilliPulse{from{transform:scale(.92);opacity:.65}to{transform:scale(1.07);opacity:1}}@keyframes aiWilliDot{0%,60%,100%{transform:translateY(0) scale(.82);opacity:.3}30%{transform:translateY(-5px) scale(1.08);opacity:1}}@media(prefers-reduced-motion:reduce){.ai-willi-card.waiting .ai-willi-mark,.ai-willi-thinking span{animation:none}.ai-willi-thinking span{opacity:.7}}@media(min-width:600px) and (max-width:1100px){.ai-willi-card{padding:17px 18px;border-radius:18px}.ai-willi-head,.ai-willi-action{font-size:15px}.ai-willi-message{font-size:15px;line-height:1.7}.ai-willi-turn.student{font-size:14px}.ai-willi-refine{font-size:14px;min-height:42px;padding:0 15px}.ai-willi-thinking span{width:8px;height:8px}.ai-willi-vote button{width:34px;height:32px}.ai-willi-vote svg{width:20px;height:20px}}`;
  document.head.appendChild(s);
}
function cardHtml(message,{action=false}={}){return `<div class="ai-willi-head"><span class="ai-willi-mark">✦</span><span>${esc(AI_WILLI_NAME)}</span></div><div class="ai-willi-thread" data-ai-willi-thread><div class="ai-willi-turn willi"><div class="ai-willi-message">${esc(message)}</div></div></div>${action?`<button type="button" class="ai-willi-action" data-ai-willi-ask>${esc(aiWilliMessage('helper','idle'))}</button>`:''}<div data-ai-willi-refinements></div>`}
function refinementHtml(usedModes){return `<div class="ai-willi-refinements">${Object.entries(REFINEMENTS).map(([mode,label])=>`<button type="button" class="ai-willi-refine${usedModes.has(mode)?' used':''}" data-ai-willi-refine="${mode}" ${usedModes.has(mode)?'disabled':''}>${esc(label)}</button>`).join('')}</div>`}

export function showAiWilliStatus(container,{role='grader',message=null}={}){if(!container)return null;ensureStyles();container.querySelector('[data-ai-willi-status]')?.remove();const el=document.createElement('div');el.className='ai-willi-card waiting';el.dataset.aiWilliStatus='1';el.innerHTML=cardHtml(message||aiWilliMessage(role,'waiting'));const msg=el.querySelector('.ai-willi-message');if(msg)msg.innerHTML=thinkingHtml();const anchor=container.querySelector('#questionHost,.question-card');if(anchor?.parentNode)anchor.insertAdjacentElement('afterend',el);else container.appendChild(el);return el}
export function clearAiWilliStatus(container){container?.querySelector('[data-ai-willi-status]')?.remove()}
export function decorateAiWilliFeedback(container,result){if(!container||!String(result?.method||'').startsWith('ai_willi'))return;ensureStyles();const feedback=container.querySelector('[data-feedback]');if(!feedback||feedback.querySelector('.ai-willi-feedback-head'))return;feedback.insertAdjacentHTML('afterbegin',`<div class="ai-willi-feedback-head"><span class="ai-willi-mark">✦</span><span>${esc(AI_WILLI_NAME)}</span></div>`)}

export function mountAiWilliHelper({container,question,response,result,section,lesson,practiceType,existingExplanation}={}){
  if(!container||!question||result?.correct)return null;ensureStyles();container.querySelector('[data-ai-willi-helper]')?.remove();
  const el=document.createElement('div');el.className='ai-willi-card';el.dataset.aiWilliHelper='1';el.innerHTML=cardHtml('이 문제를 더 이해하고 싶으면 AI Willi에게 물어보세요.',{action:true});
  const anchor=container.querySelector('#questionHost,.question-card');if(anchor?.parentNode)anchor.insertAdjacentElement('afterend',el);else container.appendChild(el);
  const askBtn=el.querySelector('[data-ai-willi-ask]'),thread=el.querySelector('[data-ai-willi-thread]'),refineBox=el.querySelector('[data-ai-willi-refinements]');
  const usedModes=new Set();let busy=false,rootExplanationId=null,initialExplanationText='';
  const questionId=String(question?.tracking?.questionId||question?.id||''),sectionName=String(section||question?.skill||practiceType||'');
  const appendStudent=label=>thread?.insertAdjacentHTML('beforeend',`<div class="ai-willi-turn student">${esc(label)}</div>`);
  const appendWilli=(text,{waiting=false}={})=>{const turn=document.createElement('div');turn.className='ai-willi-turn willi';turn.innerHTML=`<div class="ai-willi-message">${waiting?thinkingHtml():formatAiWilliText(text)}</div>`;thread?.appendChild(turn);return turn};
  const attachVote=(turn,explanationId)=>{if(!turn||!explanationId)return;const prior=alreadyRated(explanationId),vote=document.createElement('div');vote.className='ai-willi-vote';vote.innerHTML=`<button type="button" data-ai-willi-vote="up" aria-label="도움이 됐어요">${thumbSvg(true)}</button><button type="button" data-ai-willi-vote="down" aria-label="도움이 안 됐어요">${thumbSvg(false)}</button><span class="ai-willi-vote-note"></span>`;turn.appendChild(vote);if(prior){vote.querySelector(`[data-ai-willi-vote="${prior}"]`)?.classList.add('on');vote.querySelectorAll('button').forEach(b=>b.disabled=true)}vote.querySelectorAll('[data-ai-willi-vote]').forEach(btn=>btn.onclick=async ev=>{ev.preventDefault();ev.stopPropagation();if(btn.disabled||alreadyRated(explanationId))return;vote.querySelectorAll('button').forEach(b=>b.disabled=true);const helpful=btn.dataset.aiWilliVote==='up';try{await rateCached(explanationId,helpful);markRated(explanationId,helpful?'up':'down');btn.classList.add('on');vote.querySelector('.ai-willi-vote-note').textContent='고마워요!'}catch(e){console.warn('[AI Willi vote] failed',e);vote.querySelectorAll('button').forEach(b=>b.disabled=false);vote.querySelector('.ai-willi-vote-note').textContent='다시 눌러 주세요.'}})};
  const setBusy=value=>{busy=!!value;el.classList.toggle('waiting',busy);el.querySelectorAll('button').forEach(b=>{if(b.dataset.aiWilliRefine&&usedModes.has(b.dataset.aiWilliRefine)){b.disabled=true;return}if(b.closest('.ai-willi-vote'))return;b.disabled=busy})};
  const showRefinements=()=>{if(!refineBox)return;refineBox.innerHTML=refinementHtml(usedModes);refineBox.querySelectorAll('[data-ai-willi-refine]').forEach(btn=>btn.onclick=ev=>{ev.preventDefault();ev.stopPropagation();const mode=btn.dataset.aiWilliRefine||'';if(!mode||busy||usedModes.has(mode))return;run(mode)})};
  const run=async mode=>{
    if(busy||!questionId||!['initial','vocab','details','examples'].includes(mode))return;if(mode!=='initial'&&usedModes.has(mode))return;
    setBusy(true);el.classList.remove('error');const isInitial=mode==='initial';if(!isInitial){usedModes.add(mode);appendStudent(REFINEMENTS[mode]);showRefinements()}
    const waitingTurn=appendWilli('',{waiting:true});
    try{
      const cached=await getCached({questionId,mode,response,rootExplanationId:isInitial?null:rootExplanationId});let record=cached,text=String(cached?.explanation_text||'').trim();
      if(!text){const answer=await helpWithAiWilli({question,response,result,section,lesson,practiceType,existingExplanation,mode,previousExplanation:isInitial?'':initialExplanationText});text=String(answer?.text||'').trim()||aiWilliMessage('helper','failed');record=await saveCached({questionId,section:sectionName,mode,response,text,vocabulary:answer?.vocabulary||[],rootExplanationId:isInitial?null:rootExplanationId})}
      waitingTurn.querySelector('.ai-willi-message').innerHTML=formatAiWilliText(text);attachVote(waitingTurn,record?.id);if(isInitial){rootExplanationId=record?.id||null;initialExplanationText=text}el.classList.remove('error');askBtn?.remove();showRefinements();
    }catch(e){console.warn('[AI Willi helper] failed',e);el.classList.add('error');waitingTurn.querySelector('.ai-willi-message').textContent=aiWilliMessage('helper','failed');if(!isInitial)usedModes.delete(mode);showRefinements()}finally{setBusy(false)}
  };
  askBtn.onclick=ev=>{ev.preventDefault();ev.stopPropagation();run('initial')};return el;
}
