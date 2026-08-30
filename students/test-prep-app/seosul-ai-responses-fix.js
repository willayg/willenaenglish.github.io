(function(){
'use strict';
let lastVerdict=null;

function parseBody(options){try{return JSON.parse(options?.body||'{}')}catch(_){return null}}
function isTarget(url,options){
  if(!String(url||'').includes('/.netlify/functions/openai_proxy'))return false;
  const body=parseBody(options),p=body?.payload||{};
  const system=Array.isArray(p.messages)?(p.messages.find(m=>m?.role==='system')?.content||''):'';
  return p.model==='gpt-5.6-luna'&&String(system).includes('STRICT adjudicator for a Korean middle-school written English test');
}
function toResponses(options){
  const body=parseBody(options),p=body.payload||{},messages=Array.isArray(p.messages)?p.messages:[];
  const system=String(messages.find(m=>m?.role==='system')?.content||'');
  const user=String(messages.find(m=>m?.role==='user')?.content||'');
  const coachSystem=system.replace(/Return JSON only:[\s\S]*$/,
    'Return JSON only with these keys: {"correct":true|false,"reason_code":"typo|spelling|capitalization|punctuation|grammar|meaning|completeness|task|word_choice|word_order|missing_required_word|extra_information|correct_alternative|other","reason":"short internal English reason","error_label_ko":"짧은 오류 유형","explanation_ko":"학생에게 보여 줄 구체적인 한국어 설명"}. If correct, error_label_ko and explanation_ko must be empty strings. If incorrect, identify the PRIMARY problem. explanation_ko must be 1–2 short Korean sentences. State exactly what is missing or wrong and how to fix it. Do not merely say the answer differs from the model answer.');
  body.endpoint='responses';
  body.payload={
    model:'gpt-5.6-luna',
    input:[
      {role:'system',content:[{type:'input_text',text:coachSystem}]},
      {role:'user',content:[{type:'input_text',text:user}]}
    ],
    reasoning:{effort:'low'},
    max_output_tokens:300
  };
  return {...options,headers:{...(options?.headers||{}),'Content-Type':'application/json'},body:JSON.stringify(body)};
}
function outputText(data){
  if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text;
  for(const item of data?.output||[]){for(const c of item?.content||[]){if(c?.type==='output_text'&&c.text)return c.text}}
  return '';
}
function parseVerdict(text){
  try{const clean=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');const v=JSON.parse(clean);return typeof v?.correct==='boolean'?v:null}catch(_){return null}
}
function injectCoach(){
  const v=lastVerdict;if(!v||v.correct!==false)return;
  const model=document.getElementById('seosulModel'),feedback=document.querySelector('#feedback.feedback.bad');
  if(!model?.classList.contains('show')||!feedback)return;
  let box=document.getElementById('seosulAiExplanation');
  if(!box){box=document.createElement('div');box.id='seosulAiExplanation';box.className='seosul-ai-explanation';box.innerHTML='<b></b><div></div>';model.parentNode.insertBefore(box,model)}
  const label=String(v.error_label_ko||'').trim(),text=String(v.explanation_ko||v.reason||'').trim();
  box.querySelector('b').textContent=label?`왜 틀렸나요? · ${label}`:'왜 틀렸나요?';
  box.querySelector('div').textContent=text||'답의 핵심 내용을 다시 확인해 보세요.';
}
function scheduleCoach(){[0,60,180,400].forEach(ms=>setTimeout(injectCoach,ms))}
function wrap(owner,key){
  const original=owner?.[key];if(typeof original!=='function'||original.__seosulResponsesFix)return;
  const wrapped=async function(url,options){
    if(!isTarget(url,options))return original.call(this,url,options);
    lastVerdict=null;
    const response=await original.call(this,url,toResponses(options||{}));
    if(!response?.ok)return response;
    try{
      const outer=await response.clone().json(),data=outer?.data||outer,text=outputText(data),verdict=parseVerdict(text);
      if(!verdict)throw new Error('No JSON verdict returned');
      lastVerdict=verdict;scheduleCoach();
      const synthetic={data:{choices:[{message:{content:JSON.stringify(verdict)}}]}};
      return new Response(JSON.stringify(synthetic),{status:200,headers:{'Content-Type':'application/json'}});
    }catch(e){console.warn('[seosul-ai] Responses parse failed',e);return response}
  };
  wrapped.__seosulResponsesFix=true;wrapped.__original=original;owner[key]=wrapped;
}
function boot(){
  wrap(window,'fetch');
  if(window.WillenaAPI)wrap(window.WillenaAPI,'fetch');
  let n=0;const t=setInterval(()=>{wrap(window,'fetch');if(window.WillenaAPI)wrap(window.WillenaAPI,'fetch');if(++n>40)clearInterval(t)},100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
