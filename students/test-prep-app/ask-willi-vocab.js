(function(){
'use strict';
const BUTTON_ID='tpAskWilliVocab',RESULT_ID='tpAskWilliVocabResult';
const MAX=2;
let last=null,busy=false,current=0;
function addStyles(){if(document.getElementById('tpAskWilliVocabStyle'))return;const s=document.createElement('style');s.id='tpAskWilliVocabStyle';s.textContent=`#${BUTTON_ID}{display:inline-flex;align-items:center;gap:7px;margin:14px 0 4px;padding:10px 15px;border:2px solid #15aab5;border-radius:12px;background:#fff;color:#ee5f91;font:800 13px/1.2 Poppins,system-ui,sans-serif;cursor:pointer}#${BUTTON_ID}:disabled{opacity:.58;cursor:not-allowed}#${RESULT_ID}{display:none;margin-top:10px;padding:13px 14px;border:1px solid #c9e6ea;border-radius:13px;background:#f4fbfc;color:#243840;font:600 13px/1.65 Poppins,system-ui,sans-serif;white-space:pre-wrap}#${RESULT_ID}.show{display:block}#${RESULT_ID}.error{border-color:#efccd8;background:#fff6f8;color:#7b334b}@media (min-width:600px) and (max-width:1100px){#${BUTTON_ID}{font-size:16px;padding:12px 18px}#${RESULT_ID}{font-size:16px;line-height:1.7}}`;document.head.appendChild(s)}
function sourceId(){return String(last?.metadata?.source_question_id||'')}
function targetKey(){return String(last?.metadata?.mastery_target_key||last?.question_id||'')}
function countKey(){return `tpAskWilliVocab:${targetKey()}:${sourceId()}:count`}
function getCount(){try{return Math.max(0,Math.min(MAX,Number(localStorage.getItem(countKey()))||0))}catch(_){return 0}}
function setCount(n){try{localStorage.setItem(countKey(),String(n))}catch(_){} }
function studentName(){return String(window.WillenaWilliStudentName?.()||window.WillenaTestPrepAuth?.state?.user?.korean_name||window.WillenaTestPrepAuth?.state?.user?.name||window.WillenaTestPrepAuth?.state?.user?.username||'').trim()}
function txt(el){return String(el?.textContent||'').replace(/\s+/g,' ').trim()}
function answers(values,choices){const arr=Array.isArray(values)?values:[values].filter(v=>v!=null);return arr.map(v=>{const s=String(v??'').trim(),n=Number(s);return Number.isInteger(n)&&n>=1&&n<=choices.length?`${n}. ${choices[n-1]}`:s}).filter(Boolean)}
function collect(){const root=document.getElementById('testPrepVocabTestPractice'),sel=window.WillenaAssignedTestPrep?.selection||{},m=last?.metadata||{},choices=[...root.querySelectorAll('.vtu-choice')].map(txt);return {question_id:sourceId(),mastery_target_key:targetKey(),section:'vocab_test',student_name:studentName()||null,book:sel?.plan?.book_label||sel?.plan?.book||'',lesson:sel?.lesson||'',question_type:String(last?.question_type||''),target:String(m.mastery_target_text||m.canonical_text||'').trim(),korean_meaning:txt(root.querySelector('.vtu-ko'))||String(m.translation_ko||'').trim(),english_definition:txt(root.querySelector('.vtu-def')),source_context:txt(root.querySelector('.vtu-context')),prompt:txt(root.querySelector('.vtu-prompt')),choices,student_answer:answers(last?.selected_answer,choices),correct_answer:answers(last?.correct_answer,choices)}}
function systemPrompt(){return `너는 한국 중학생을 돕는 친절하고 정확한 영어 어휘 튜터 'Willi'다. 학생이 방금 틀린 실제 어휘 문제를 바탕으로 반드시 한국어로 짧고 명확하게 설명한다.

반드시 다음 순서로 설명한다.
1) 첫 줄: 정답 영어 단어/표현 = 한국어 뜻.
2) 영영풀이가 있으면 이해에 꼭 필요한 어려운 영어 단어를 최대 2개만 골라 각각 아주 짧은 한국어 뜻을 준다. a, the, very, of 같은 쉬운 기능어는 설명하지 않는다.
3) 영영풀이 전체가 왜 정답을 뜻하는지 1~2문장으로 설명한다.
4) source_context가 있으면 그 문장에서 어떤 단서 때문에 정답이 맞는지 1문장으로 설명한다. 없는 문맥이나 사실을 만들지 않는다.
5) 마지막에서 두 번째 부분은 반드시 학생의 오답을 진단한다. student_name이 있으면 '학생', '학생이'라고 쓰지 말고 실제 student_name을 문장에 반드시 한 번 사용한다. 예: 'Min은 ③ bridge를 골랐어요.' 또는 'Min은 drugs라고 썼어요.'
   - 학생이 고른/쓴 영어 단어 또는 표현의 실제 기본 뜻을 짧고 정확하게 알려 준다.
   - 선택지에 그 단어의 틀린 영영풀이가 적혀 있어도 그것을 실제 정의로 반복하지 않는다. 예를 들어 bridge는 '강 옆에서 물을 보기 위한 구조물'이 아니라 보통 강, 도로, 계곡 등을 건너기 위해 만든 구조물이다.
   - 그 다음 학생이 무엇을 놓쳤는지 구체적으로 설명한다. 문제의 영영풀이 또는 문맥에서 정답을 가리키는 핵심 단어 1~3개를 직접 짚는다.
   - 학생의 오답 의미를 확실히 알 수 있을 때만 일반적인 기본 뜻을 설명한다. 확신이 없으면 추측하지 말고 문제 속 단서 차이만 설명한다.
   - 이 오답 진단 부분은 보통 2문장, 최대 3문장으로 한다.
6) 마지막 줄은 반드시 정확히 '📓 노트에 적기: [정답 영어] = [한국어 뜻]' 형식으로 끝낸다.

전체는 보통 6~10개의 짧은 줄 또는 짧은 문단 이내로 한다. 정의나 문맥과 상관없는 장소 정보, 배경지식, 추가 예시는 넣지 않는다. 같은 내용을 반복하지 않는다. 불필요한 인사말, 표, 장황한 설명을 쓰지 않는다. 정답 단어 또는 표현 자체를 다른 표현으로 바꾸지 않는다. 학생을 꾸짖거나 학생의 생각을 추측하지 않는다.`}
function update(){const b=document.getElementById(BUTTON_ID);if(!b)return;const used=getCount();if(busy){b.disabled=true;return}if(used>=MAX){b.disabled=true;b.innerHTML='<span>✦</span> 추가 해설 2회 사용 완료'}else if(used===0){b.disabled=false;b.innerHTML='<span>✦</span> Ask Willi'}else{b.disabled=false;b.innerHTML='<span>✦</span> Ask Willi 한 번 더 (1회 남음)'}}
async function ask(){if(busy||!last)return;const b=document.getElementById(BUTTON_ID),out=document.getElementById(RESULT_ID);if(!b||!out)return;const used=getCount();if(used>=MAX){update();return}busy=true;b.disabled=true;b.innerHTML='<span>✦</span> 생각 중...';out.className='show';out.textContent='좋은 해설을 위해 생각 중이에요.';try{const apiFetch=window.WillenaAPI?.fetch?.bind(window.WillenaAPI)||window.fetch.bind(window);const response=await apiFetch('/.netlify/functions/openai_proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:'chat/completions',payload:{model:'gpt-4o-mini',messages:[{role:'system',content:systemPrompt()},{role:'user',content:`다음은 학생이 방금 틀린 어휘 문제의 실제 정보다. 이 정보와 확실한 기본 어휘 지식만을 근거로 설명해 줘.\n\n${JSON.stringify(collect(),null,2)}`}],max_tokens:500,temperature:0.25}})});if(!response.ok)throw new Error(`AI ${response.status}`);const data=await response.json(),ans=data?.data?.choices?.[0]?.message?.content||data?.result||'';if(!ans)throw new Error('empty AI response');out.className='show';out.textContent=String(ans).trim();current=used+1;setCount(current)}catch(e){console.error('[Ask Willi vocab]',e);out.className='show error';out.textContent='지금은 Willi의 추가 설명을 불러오지 못했어요. 잠시 후 다시 눌러 주세요.'}finally{busy=false;update()}}
function install(){if(!last||!document.querySelector('#testPrepVocabTestPractice .vtu-feedback.bad'))return;const card=document.querySelector('#testPrepVocabTestPractice .vtu-card');if(!card||document.getElementById(BUTTON_ID))return;const w=document.createElement('div');w.className='tp-ask-willi-vocab-wrap';w.innerHTML=`<button type="button" id="${BUTTON_ID}"><span>✦</span> Ask Willi</button><div id="${RESULT_ID}" aria-live="polite"></div>`;card.appendChild(w);document.getElementById(BUTTON_ID).addEventListener('click',ask);current=getCount();update()}
function tap(){const a=window.WillenaTestPrepAuth;if(!a||typeof a.recordAttempt!=='function'||a.__askWilliVocabTap)return false;const original=a.recordAttempt;a.recordAttempt=function(payload){try{if(String(payload?.practice_type||'').toLowerCase()==='vocab_test'&&payload?.is_correct===false){last=payload;current=getCount()}}catch(_){}return original.apply(this,arguments)};a.__askWilliVocabTap=true;return true}
function boot(){addStyles();tap();let tries=0;const timer=setInterval(()=>{if(tap()||++tries>200)clearInterval(timer)},25);document.addEventListener('click',e=>{const b=e.target instanceof Element?e.target.closest('#vtuNext'):null;if(b)setTimeout(install,0)},false);console.info('[Test Prep students] Ask Willi vocab active — Willi Vocab Rev4 diagnostic')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();