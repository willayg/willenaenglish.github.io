import {FORMS,parseCorrection} from './question-model.js';

const norm=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[“”"]/g,'').replace(/[.!?,;:]+$/g,'').replace(/\s+/g,' ').trim();
const words=v=>String(v??'').replace(/[“”"!?.,;:()]/g,'').trim().split(/\s+/).filter(Boolean);
const asArray=v=>Array.isArray(v)?v:[v];
const CIRCLED_NUM=['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];
function correctionLabel(v){const s=String(v||'').trim().replace(/:$/,'');const n=CIRCLED_NUM.indexOf(s);if(n>=0)return String(n+1);const m=s.match(/^\d+$/);return m?String(Number(s)):s.toLowerCase()}
function correctionNorm(v){const p=parseCorrection(v);return p?`${correctionLabel(p.label||p.prefix)}|${norm(p.wrong)}|${norm(p.right)}`:norm(v)}
function correctionTokens(v){const s=norm(v).replace(/[.!?,;:()]+/g,' ');return s.split(/\s+/).filter(Boolean)}
function expandedCorrectionEquivalent(referenceWrong,referenceRight,studentWrong,studentRight){
  const rw=correctionTokens(referenceWrong),rr=correctionTokens(referenceRight),sw=correctionTokens(studentWrong),sr=correctionTokens(studentRight);
  if(!rw.length||!rr.length||!sw.length||!sr.length)return false;
  if(sw.length===rw.length&&sr.length===rr.length&&sw.every((x,i)=>x===rw[i])&&sr.every((x,i)=>x===rr[i]))return true;
  if(sw.length<rw.length)return false;
  for(let i=0;i<=sw.length-rw.length;i++){
    if(!rw.every((x,j)=>sw[i+j]===x))continue;
    const expected=[...sw.slice(0,i),...rr,...sw.slice(i+rw.length)];
    if(expected.length===sr.length&&expected.every((x,j)=>x===sr[j]))return true;
  }
  return false;
}
function correctionPairEquivalent(reference,student,{requireLabel=false}={}){
  const r=parseCorrection(reference),s=parseCorrection(student);if(!r||!s)return false;
  if(requireLabel&&correctionLabel(r.label||r.prefix)!==correctionLabel(s.label||s.prefix))return false;
  return expandedCorrectionEquivalent(r.wrong,r.right,s.wrong,s.right);
}
function correctionArrayEquivalent(referenceAnswers,studentAnswers,{requireLabel=false,orderIrrelevant=false}={}){
  const refs=asArray(referenceAnswers),mine=asArray(studentAnswers);if(refs.length!==mine.length)return false;
  if(!orderIrrelevant&&!requireLabel)return refs.every((r,i)=>correctionPairEquivalent(r,mine[i]));
  const used=new Set();
  for(const r of refs){
    let hit=-1;
    for(let i=0;i<mine.length;i++){if(used.has(i))continue;if(correctionPairEquivalent(r,mine[i],{requireLabel})){hit=i;break}}
    if(hit<0)return false;used.add(hit);
  }
  return true;
}

function checkConstraints(question,response){
  const c=question?.grading?.constraints||{},parts=Array.isArray(response)?response:[response],text=parts.join('\n');
  if(c.wordCount&&words(text).length!==Number(c.wordCount))return{ok:false,message:`${c.wordCount}단어로 써야 합니다.`};
  if(Array.isArray(c.partWordCounts)&&c.partWordCounts.length){
    for(let i=0;i<c.partWordCounts.length;i++){const n=Number(c.partWordCounts[i])||0;if(n&&words(parts[i]??'').length!==n)return{ok:false,message:`${['ⓐ','ⓑ','ⓒ','ⓓ','ⓔ','ⓕ'][i]||`${i+1}번`} 답은 ${n}단어로 써야 합니다.`}}
  }
  if(c.noContractions&&/[A-Za-z]+['’][A-Za-z]+/.test(text))return{ok:false,message:'축약형을 사용하면 안 됩니다.'};
  if(c.contractionRequired&&!/[A-Za-z]+['’][A-Za-z]+/.test(text))return{ok:false,message:'축약형을 사용해야 합니다.'};
  return{ok:true,message:''};
}
function normalizeResponse(question,response){
  if(question.form===FORMS.identifiedCorrection)return asArray(response).map(correctionNorm).filter(Boolean);
  if([FORMS.choice,FORMS.multi,FORMS.multipart,FORMS.correction,FORMS.blanks].includes(question.form))return asArray(response).map(norm).filter(Boolean);
  return norm(response);
}
function exact(question,response){
  const target=(question.answer||[]).map(norm).filter(Boolean),mine=normalizeResponse(question,response),c=question?.grading?.constraints||{};
  if(question.form===FORMS.choice)return Array.isArray(mine)&&mine.length===1&&target.includes(mine[0]);
  if(question.form===FORMS.multi){const a=[...mine].sort(),b=[...target].sort();return a.length===b.length&&a.every((x,i)=>x===b[i])}
  if(question.form===FORMS.identifiedCorrection)return correctionArrayEquivalent(question.answer,response,{requireLabel:true,orderIrrelevant:true});
  if(question.form===FORMS.correction)return correctionArrayEquivalent(question.answer,response,{orderIrrelevant:!!c.answerOrderIrrelevant});
  if(question.form===FORMS.multipart||question.form===FORMS.blanks){let a=[...mine],b=[...target];if(c.answerOrderIrrelevant){a.sort();b.sort()}return a.length===b.length&&a.every((x,i)=>x===b[i])}
  if(c.alternatives)return target.includes(String(mine));
  return target.some(a=>a===String(mine));
}
function responseText(response){return Array.isArray(response)?response.map((x,i)=>`${i+1}. ${String(x??'')}`).join('\n'):String(response??'')}

async function aiGrade(question,response){
  const c=question?.grading?.constraints||{};
  const system='You are a STRICT adjudicator for a Korean middle-school written English test. Do not give partial credit. Judge whether the student response is fully correct for the exact question, source context, and every stated condition. Reference answer parts are separate required parts unless the grading constraints explicitly say they are alternatives. For multipart or correction tasks, require every requested part and do not forgive a missing part. Accept a paraphrase only when the task allows semantic equivalence and it preserves every required fact, grammar requirement, word-count rule, and required expression. If uncertain, reject. Return JSON only: {"correct":true|false,"reason":"short reason"}';
  const user=`QUESTION FORM:\n${question.form}\n\nQUESTION:\n${question.prompt||''}\n\nCONTEXT AND CONDITIONS:\n${JSON.stringify(question.context||{})}\n\nGRADING CONSTRAINTS:\n${JSON.stringify(c)}\n\nREFERENCE ANSWER PARTS:\n${(question.answer||[]).map((a,i)=>`${i+1}. ${a}`).join('\n')}\n\nSTUDENT RESPONSE:\n${responseText(response)}`;
  const body={endpoint:'chat/completions',payload:{model:'gpt-5.6-luna',messages:[{role:'system',content:system},{role:'user',content:user}],reasoning_effort:'low',max_completion_tokens:100,response_format:{type:'json_object'}}};
  const fetcher=window.WillenaAPI&&typeof window.WillenaAPI.fetch==='function'?window.WillenaAPI.fetch.bind(window.WillenaAPI):fetch;
  const r=await fetcher('/.netlify/functions/openai_proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok)throw new Error(`AI HTTP ${r.status}`);
  const payload=await r.json(),data=payload?.data||payload,text=data?.choices?.[0]?.message?.content||payload?.result||'';
  const raw=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const parsed=JSON.parse(raw);if(typeof parsed.correct!=='boolean')throw new Error('Invalid AI verdict');return parsed;
}

export async function gradeQuestion(question,response){
  const constraint=checkConstraints(question,response);
  if(!constraint.ok)return{correct:false,message:constraint.message,correctAnswer:question.answer,method:'constraint'};
  if(exact(question,response))return{correct:true,message:'',correctAnswer:question.answer,method:'exact'};
  const aiForm=[FORMS.write,FORMS.multipart,FORMS.correction,FORMS.identifiedCorrection].includes(question.form);
  if(question?.grading?.aiAllowed&&question?.grading?.mode==='ai_semantic_strict'&&aiForm){
    try{const verdict=await aiGrade(question,response);return{correct:!!verdict.correct,message:verdict.correct?'':(verdict.reason||'정답을 확인해 보세요.'),correctAnswer:question.answer,method:'luna',aiReason:verdict.reason||null}}
    catch(e){console.warn('[v2 grader] AI failed closed',e);return{correct:false,message:'AI 확인에 실패했습니다.',correctAnswer:question.answer,method:'ai_failed'}}
  }
  return{correct:false,message:'정답을 확인해 보세요.',correctAnswer:question.answer,method:'exact'};
}
