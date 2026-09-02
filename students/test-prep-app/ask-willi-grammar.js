(function(){
'use strict';

const STYLE_ID='tpAskWilliGrammarStyle';
const BUTTON_ID='tpAskWilliGrammar';
const RESULT_ID='tpAskWilliGrammarResult';
const DB_EXTRA_CLASS='tp-db-explanation-extra';
const DB_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
const DB_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
let requestBusy=false;
let lastWrongGrammarQuestionId='';

function addStyles(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
#${BUTTON_ID}{display:inline-flex;align-items:center;gap:7px;margin:14px 0 4px;padding:10px 15px;border:0;border-radius:12px;background:#123f52;color:#fff;font:800 13px/1.2 Poppins,system-ui,sans-serif;cursor:pointer;box-shadow:0 3px 10px rgba(18,63,82,.16)}
#${BUTTON_ID}:disabled{opacity:.58;cursor:wait}
#${BUTTON_ID} .willi-spark{font-size:15px}
#${RESULT_ID}{display:none;margin-top:10px;padding:13px 14px;border:1px solid #c9e6ea;border-radius:13px;background:#f4fbfc;color:#243840;font:600 13px/1.65 Poppins,system-ui,sans-serif;white-space:pre-wrap}
#${RESULT_ID}.show{display:block}
#${RESULT_ID}.error{border-color:#efccd8;background:#fff6f8;color:#7b334b}
.${DB_EXTRA_CLASS}{margin-top:8px;white-space:pre-wrap}
@media (min-width:600px) and (max-width:1100px){
  #${BUTTON_ID}{font-size:16px;padding:12px 18px;border-radius:14px}
  #${RESULT_ID}{font-size:16px;line-height:1.7;padding:16px 17px}
}
`;
  document.head.appendChild(s);
}

function isGrammarWrong(){
  return window.WillenaTestPrepQuestionEngine?.section==='grammar' && !!document.querySelector('#card .feedback.bad');
}

function choiceText(el){
  return String(el?.textContent||'').replace(/\s+/g,' ').trim();
}

function collectQuestionContext(){
  const root=document.getElementById('card');
  const selection=window.WillenaAssignedTestPrep?.selection||{};
  const choices=[...root.querySelectorAll('.choice')].map((el,i)=>({
    number:i+1,
    text:choiceText(el.querySelector('.t')||el),
    selected:el.classList.contains('selected'),
    correct:el.classList.contains('correct')
  }));
  const contextText=[...root.querySelectorAll('.context')].map(x=>String(x.textContent||'').trim()).filter(Boolean).join('\n\n');
  const existingExplanation=root.querySelector('#explanation')?.textContent?.replace(/Ask Willi[\s\S]*$/,'').trim()||'';
  return {
    question_id:lastWrongGrammarQuestionId||'',
    book:selection?.plan?.book_label||selection?.plan?.book||'',
    lesson:selection?.lesson||'',
    prompt:String(root.querySelector('.prompt')?.textContent||'').trim(),
    context:contextText.slice(0,6000),
    choices,
    student_answer:choices.filter(x=>x.selected).map(x=>`${x.number}. ${x.text}`),
    correct_answer:choices.filter(x=>x.correct).map(x=>`${x.number}. ${x.text}`),
    existing_explanation:existingExplanation.slice(0,2400)
  };
}

function normalizeCompare(v){return String(v||'').replace(/\s+/g,' ').trim()}

async function addDbExplanation(){
  if(!isGrammarWrong()||!lastWrongGrammarQuestionId)return;
  const e=document.querySelector('#card #explanation');
  if(!e)return;
  try{
    const r=await fetch(`${DB_URL}/rest/v1/test_prep_questions?select=metadata&id=eq.${encodeURIComponent(lastWrongGrammarQuestionId)}&limit=1`,{
      headers:{apikey:DB_KEY,Authorization:`Bearer ${DB_KEY}`},cache:'no-store'
    });
    if(!r.ok)throw new Error(`DB ${r.status}`);
    const row=(await r.json())?.[0];
    const m=row?.metadata||{};
    const values=[m.source_explanation_ko,m.explanation_ko]
      .map(v=>String(v||'').trim()).filter(Boolean)
      .filter((v,i,a)=>a.findIndex(x=>normalizeCompare(x)===normalizeCompare(v))===i);
    if(!values.length)return;
    const existing=normalizeCompare(e.textContent||'');
    const missing=values.filter(v=>!existing.includes(normalizeCompare(v)));
    if(!missing.length)return;
    if(!e.querySelector('strong')){
      const title=document.createElement('strong');
      title.textContent='해설';
      e.prepend(title);
    }
    e.classList.add('show');
    const wrap=e.querySelector('.tp-ask-willi-wrap');
    missing.forEach(v=>{
      const d=document.createElement('div');
      d.className=DB_EXTRA_CLASS;
      d.textContent=v;
      if(wrap)e.insertBefore(d,wrap);else e.appendChild(d);
    });
  }catch(err){
    console.warn('[Ask Willi grammar] DB explanation lookup failed',err);
  }
}

async function askWilli(){
  if(requestBusy)return;
  const btn=document.getElementById(BUTTON_ID),out=document.getElementById(RESULT_ID);
  if(!btn||!out||!isGrammarWrong())return;
  requestBusy=true;
  btn.disabled=true;
  btn.innerHTML='<span class="willi-spark">✦</span> 생각 중...';
  out.className='show';
  out.textContent='좋은 해설을 위해 생각 중이에요';

  const q=collectQuestionContext();
  const system=`너는 한국 중학생을 돕는 친절하고 정확한 영어 문법 튜터 'Willi'다. 학생이 방금 틀린 실제 문제를 바탕으로 피드백한다. 반드시 한국어로 설명하고, 필요한 영어 표현과 예문만 영어로 쓴다. 학생이 왜 그 답을 골랐을지 추측해서 단정하지 말고, 실제 선택지와 정답의 차이를 근거로 설명한다. 먼저 이 문제에서 확인하는 핵심 문법을 짚고, 학생이 고른 답이 왜 맞지 않는지, 정답이 왜 맞는지 설명한다. 문맥이나 밑줄 친 표현이 중요하면 반드시 반영한다. 기존 해설이 있으면 참고하되 그대로 반복하지 말고 더 이해하기 쉽게 풀어 쓴다. 답변은 중학생이 읽기 쉽게 간결하게 작성한다. 보통 4~7개의 짧은 문단 또는 불릿이면 충분하다. 불필요한 인사말, 영어로 된 장황한 설명, 표는 사용하지 않는다.`;
  const user=`다음은 학생이 방금 틀린 문법 문제의 실제 화면 정보다. 이 정보만을 근거로 맞춤 설명을 해 줘.\n\n${JSON.stringify(q,null,2)}`;

  try{
    const apiFetch=window.WillenaAPI?.fetch?.bind(window.WillenaAPI)||window.fetch.bind(window);
    const response=await apiFetch('/.netlify/functions/openai_proxy',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        endpoint:'chat/completions',
        payload:{
          model:'gpt-4o-mini',
          messages:[{role:'system',content:system},{role:'user',content:user}],
          max_tokens:650,
          temperature:0.25
        }
      })
    });
    if(!response.ok)throw new Error(`AI ${response.status}`);
    const data=await response.json();
    const answer=data?.data?.choices?.[0]?.message?.content||data?.result||'';
    if(!answer)throw new Error('empty AI response');
    out.className='show';
    out.textContent=String(answer).trim();
    btn.innerHTML='<span class="willi-spark">✦</span> Ask Willi 다시 보기';
  }catch(err){
    console.error('[Ask Willi grammar]',err);
    out.className='show error';
    out.textContent='지금은 Willi의 추가 설명을 불러오지 못했어요. 잠시 후 다시 눌러 주세요.';
    btn.innerHTML='<span class="willi-spark">✦</span> Ask Willi 다시 시도';
  }finally{
    requestBusy=false;
    btn.disabled=false;
  }
}

function installButton(){
  if(!isGrammarWrong())return;
  const e=document.querySelector('#card #explanation');
  if(!e)return;
  if(!document.getElementById(BUTTON_ID)){
    if(!String(e.textContent||'').trim()){
      const title=document.createElement('strong');
      title.textContent='해설';
      e.appendChild(title);
    }
    e.classList.add('show');
    const wrap=document.createElement('div');
    wrap.className='tp-ask-willi-wrap';
    wrap.innerHTML=`<button type="button" id="${BUTTON_ID}"><span class="willi-spark">✦</span> Ask Willi</button><div id="${RESULT_ID}" aria-live="polite"></div>`;
    e.appendChild(wrap);
    document.getElementById(BUTTON_ID).addEventListener('click',askWilli);
  }
  addDbExplanation();
}

function installAttemptTap(){
  const auth=window.WillenaTestPrepAuth;
  if(!auth||typeof auth.recordAttempt!=='function'||auth.__askWilliGrammarTap)return false;
  const original=auth.recordAttempt;
  auth.recordAttempt=function(payload){
    try{
      if(String(payload?.practice_type||'').toLowerCase()==='grammar'&&payload?.is_correct===false&&payload?.question_id){
        lastWrongGrammarQuestionId=String(payload.question_id);
      }
    }catch(_){ }
    return original.apply(this,arguments);
  };
  auth.__askWilliGrammarTap=true;
  return true;
}

function onDocumentClick(e){
  const check=e.target instanceof Element?e.target.closest('#check'):null;
  if(!check)return;
  setTimeout(installButton,0);
}

function boot(){
  addStyles();
  installAttemptTap();
  let tries=0;
  const timer=setInterval(()=>{if(installAttemptTap()||++tries>200)clearInterval(timer)},25);
  document.addEventListener('click',onDocumentClick,false);
  console.info('[Test Prep staging] Ask Willi grammar pilot active');
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
