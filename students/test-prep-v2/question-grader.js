import {FORMS} from './question-model.js';

const norm=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[“”"]/g,'').replace(/[.!?,;:]+$/g,'').replace(/\s+/g,' ').trim();
const words=v=>String(v??'').replace(/[“”"!?.,;:()]/g,'').trim().split(/\s+/).filter(Boolean);
const asArray=v=>Array.isArray(v)?v:[v];

function checkConstraints(question,responseText){
  const c=question?.grading?.constraints||{};
  if(c.wordCount&&words(responseText).length!==Number(c.wordCount))return{ok:false,message:`${c.wordCount}단어로 써야 합니다.`};
  if(c.noContractions&&/[A-Za-z]+['’][A-Za-z]+/.test(responseText))return{ok:false,message:'축약형을 사용하면 안 됩니다.'};
  if(c.contractionRequired&&!/[A-Za-z]+['’][A-Za-z]+/.test(responseText))return{ok:false,message:'축약형을 사용해야 합니다.'};
  return{ok:true,message:''};
}
function normalizeResponse(question,response){
  if([FORMS.choice,FORMS.multi,FORMS.multipart,FORMS.correction,FORMS.blanks].includes(question.form))return asArray(response).map(norm).filter(Boolean);
  return norm(response);
}
function exact(question,response){
  const target=(question.answer||[]).map(norm).filter(Boolean),mine=normalizeResponse(question,response),c=question?.grading?.constraints||{};
  if(question.form===FORMS.choice)return Array.isArray(mine)&&mine.length===1&&target.includes(mine[0]);
  if(question.form===FORMS.multi){const a=[...mine].sort(),b=[...target].sort();return a.length===b.length&&a.every((x,i)=>x===b[i])}
  if(question.form===FORMS.multipart||question.form===FORMS.correction||question.form===FORMS.blanks){let a=[...mine],b=[...target];if(c.answerOrderIrrelevant){a.sort();b.sort()}return a.length===b.length&&a.every((x,i)=>x===b[i])}
  if(c.alternatives)return target.includes(String(mine));
  return target.some(a=>a===String(mine));
}
function responseText(response){return Array.isArray(response)?response.join('\n'):String(response??'')}

async function aiGrade(question,response){
  const system='You are a STRICT adjudicator for a Korean middle-school written English test. Do not give partial credit. Judge whether the student answer is fully correct for the exact question and context. If the reference contains multiple answer parts, require every requested part. Accept a paraphrase only if it preserves every required fact. If uncertain, reject. Return JSON only: {"correct":true|false,"reason":"short reason"}';
  const user=`QUESTION:\n${question.prompt||''}\n\nCONTEXT:\n${JSON.stringify(question.context||{})}\n\nREFERENCE ANSWER PARTS:\n${(question.answer||[]).map((a,i)=>`${i+1}. ${a}`).join('\n')}\n\nSTUDENT ANSWER:\n${responseText(response)}`;
  const body={endpoint:'chat/completions',payload:{model:'gpt-5.6-luna',messages:[{role:'system',content:system},{role:'user',content:user}],reasoning_effort:'low',max_completion_tokens:100,response_format:{type:'json_object'}}};
  const fetcher=window.WillenaAPI&&typeof window.WillenaAPI.fetch==='function'?window.WillenaAPI.fetch.bind(window.WillenaAPI):fetch;
  const r=await fetcher('/.netlify/functions/openai_proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok)throw new Error(`AI HTTP ${r.status}`);
  const payload=await r.json(),data=payload?.data||payload,text=data?.choices?.[0]?.message?.content||payload?.result||'';
  const raw=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const parsed=JSON.parse(raw);if(typeof parsed.correct!=='boolean')throw new Error('Invalid AI verdict');return parsed;
}

export async function gradeQuestion(question,response){
  const text=responseText(response),constraint=checkConstraints(question,text);
  if(!constraint.ok)return{correct:false,message:constraint.message,correctAnswer:question.answer,method:'constraint'};
  if(exact(question,response))return{correct:true,message:'',correctAnswer:question.answer,method:'exact'};
  if(question?.grading?.aiAllowed&&question?.grading?.mode==='ai_semantic_strict'&&question.form===FORMS.write){
    try{const verdict=await aiGrade(question,response);return{correct:!!verdict.correct,message:verdict.correct?'':(verdict.reason||'정답을 확인해 보세요.'),correctAnswer:question.answer,method:'luna',aiReason:verdict.reason||null}}
    catch(e){console.warn('[v2.1 grader] AI failed closed',e);return{correct:false,message:'AI 확인에 실패했습니다.',correctAnswer:question.answer,method:'ai_failed'}}
  }
  return{correct:false,message:'정답을 확인해 보세요.',correctAnswer:question.answer,method:'exact'};
}
