(function(){
'use strict';
const BUTTON_ID='tpAskWilliVocab',RESULT_ID='tpAskWilliVocabResult';
const MAX=2;
let last=null,busy=false,current=0;
function addStyles(){
 if(document.getElementById('tpAskWilliVocabStyle'))return;
 const s=document.createElement('style');s.id='tpAskWilliVocabStyle';s.textContent=`
#${BUTTON_ID}{display:inline-flex;align-items:center;gap:7px;margin:14px 0 4px;padding:10px 15px;border:2px solid #15aab5;border-radius:12px;background:#fff;color:#ee5f91;font:800 13px/1.2 Poppins,system-ui,sans-serif;cursor:pointer}
#${BUTTON_ID}:disabled{opacity:.58;cursor:not-allowed}
#${RESULT_ID}{display:none;margin-top:10px;padding:13px 14px;border:1px solid #c9e6ea;border-radius:13px;background:#f4fbfc;color:#243840;font:600 13px/1.65 Poppins,system-ui,sans-serif;white-space:pre-wrap}
#${RESULT_ID}.show{display:block} #${RESULT_ID}.error{border-color:#efccd8;background:#fff6f8;color:#7b334b}
@media (min-width:600px) and (max-width:1100px){#${BUTTON_ID}{font-size:16px;padding:12px 18px}#${RESULT_ID}{font-size:16px;line-height:1.7}}
`;document.head.appendChild(s);
}
function sourceId(){return String(last?.metadata?.source_question_id||'')}
function targetKey(){return String(last?.metadata?.mastery_target_key||last?.question_id||'')}
function countKey(){return `tpAskWilliVocab:${targetKey()}:${sourceId()}:count`}
function getCount(){try{return Math.max(0,Math.min(MAX,Number(localStorage.getItem(countKey()))||0))}catch(_){return 0}}
function setCount(n){try{localStorage.setItem(countKey(),String(n))}catch(_){} }
function txt(el){return String(el?.textContent||'').replace(/\s+/g,' ').trim()}
function answers(values,choices){
 const arr=Array.isArray(values)?values:[values].filter(v=>v!=null);
 return arr.map(v=>{const s=String(v??'').trim(),n=Number(s);return Number.isInteger(n)&&n>=1&&n<=choices.length?`${n}. ${choices[n-1]}`:s}).filter(Boolean);
}
function collect(){
 const root=document.getElementById('testPrepVocabTestPractice'),sel=window.WillenaAssignedTestPrep?.selection||{},m=last?.metadata||{},choices=[...root.querySelectorAll('.vtu-choice')].map(txt);
 return {question_id:sourceId(),mastery_target_key:targetKey(),section:'vocab_test',book:sel?.plan?.book_label||sel?.plan?.book||'',lesson:sel?.lesson||'',question_type:String(last?.question_type||''),target:String(m.mastery_target_text||m.canonical_text||'').trim(),korean_meaning:txt(root.querySelector('.vtu-ko'))||String(m.translation_ko||'').trim(),english_definition:txt(root.querySelector('.vtu-def')),source_context:txt(root.querySelector('.vtu-context')),prompt:txt(root.querySelector('.vtu-prompt')),choices,student_answer:answers(last?.selected_answer,choices),correct_answer:answers(last?.correct_answer,choices)};
}
function systemPrompt(){
 return `너는 한국 중학생을 돕는 친절하고 정확한 영어 어휘 튜터 'Willi'다. 학생이 방금 틀린 실제 어휘 문제의 정보만 사용해 반드시 한국어로 짧고 명확하게 설명한다. 정답 단어 또는 표현 자체를 다른 단어나 표현으로 바꾸지 않는다. 영영풀이가 있으면 그 안에서 중학생에게 어려울 가능성이 높은 핵심 영어 단어를 최대 3개만 골라 쉬운 한국어 뜻을 알려 준다. 그 단어들이 어떻게 정답의 뜻으로 이어지는지 설명한다. 문맥 문장이 있으면 실제 문맥을 근거로 설명한다. 학생 답이 정답과 의미가 비슷하더라도 문제가 특정 단어·표현을 요구한다면 그 차이를 분명히 말한다. 마지막에는 반드시 '📓 노트에 적기'를 넣고 정답 영어 표현과 한국어 뜻을 한 줄로 적게 한다. 필요하면 어려운 정의 단어 1~2개도 추가한다. 학생을 꾸짖거나 학생의 생각을 추측하지 않는다. 3~6개의 짧은 문단 또는 불릿으로 답하고 표와 불필요한 인사말은 쓰지 않는다.`;
}
function update(){
 const b=document.getElementById(BUTTON_ID);if(!b)return;const used=getCount();
 if(busy){b.disabled=true;return}
 if(used>=MAX){b.disabled=true;b.innerHTML='<span>✦</span> 추가 해설 2회 사용 완료'}
 else if(used===0){b.disabled=false;b.innerHTML='<span>✦</span> Ask Willi'}
 else{b.disabled=false;b.innerHTML='<span>✦</span> Ask Willi 한 번 더 (1회 남음)'}
}
async function ask(){
 if(busy||!last)return;const b=document.getElementById(BUTTON_ID),out=document.getElementById(RESULT_ID);if(!b||!out)return;
 const used=getCount();if(used>=MAX){update();return}
 busy=true;b.disabled=true;b.innerHTML='<span>✦</span> 생각 중...';out.className='show';out.textContent='좋은 해설을 위해 생각 중이에요.';
 try{
  const apiFetch=window.WillenaAPI?.fetch?.bind(window.WillenaAPI)||window.fetch.bind(window);
  const response=await apiFetch('/.netlify/functions/openai_proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:'chat/completions',payload:{model:'gpt-4o-mini',messages:[{role:'system',content:systemPrompt()},{role:'user',content:`다음은 학생이 방금 틀린 어휘 문제의 실제 정보다. 이 정보만을 근거로 설명해 줘.\n\n${JSON.stringify(collect(),null,2)}`}],max_tokens:650,temperature:0.25}})});
  if(!response.ok)throw new Error(`AI ${response.status}`);
  const data=await response.json(),ans=data?.data?.choices?.[0]?.message?.content||data?.result||'';if(!ans)throw new Error('empty AI response');
  out.className='show';out.textContent=String(ans).trim();current=used+1;setCount(current);
 }catch(e){console.error('[Ask Willi vocab]',e);out.className='show error';out.textContent='지금은 Willi의 추가 설명을 불러오지 못했어요. 잠시 후 다시 눌러 주세요.'}
 finally{busy=false;update()}
}
function install(){
 if(!last||!document.querySelector('#testPrepVocabTestPractice .vtu-feedback.bad'))return;
 const card=document.querySelector('#testPrepVocabTestPractice .vtu-card');if(!card||document.getElementById(BUTTON_ID))return;
 const w=document.createElement('div');w.className='tp-ask-willi-vocab-wrap';w.innerHTML=`<button type="button" id="${BUTTON_ID}"><span>✦</span> Ask Willi</button><div id="${RESULT_ID}" aria-live="polite"></div>`;card.appendChild(w);
 document.getElementById(BUTTON_ID).addEventListener('click',ask);current=getCount();update();
}
function tap(){
 const a=window.WillenaTestPrepAuth;if(!a||typeof a.recordAttempt!=='function'||a.__askWilliVocabTap)return false;const original=a.recordAttempt;
 a.recordAttempt=function(payload){try{if(String(payload?.practice_type||'').toLowerCase()==='vocab_test'&&payload?.is_correct===false){last=payload;current=getCount()}}catch(_){}return original.apply(this,arguments)};
 a.__askWilliVocabTap=true;return true;
}
function boot(){
 addStyles();tap();let tries=0;const timer=setInterval(()=>{if(tap()||++tries>200)clearInterval(timer)},25);
 document.addEventListener('click',e=>{const b=e.target instanceof Element?e.target.closest('#vtuNext'):null;if(b)setTimeout(install,0)},false);
 console.info('[Test Prep students] Ask Willi vocab active — Willi Vocab Rev1');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();