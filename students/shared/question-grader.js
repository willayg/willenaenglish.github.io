import {resolveQuestionGradingPolicy} from './question-grading-policy.js?v=2.0.0';

const FORMS={choice:'choice',multi:'multi',write:'write',multipart:'multipart',correction:'correction',identifiedCorrection:'identified_correction',order:'order',chunks:'chunks',blanks:'blanks',learn:'learn',unsupported:'unsupported'};
const CIRCLED_NUM=['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];
const asArray=v=>Array.isArray(v)?v:[v];
const words=v=>String(v??'').replace(/[“”"!?.,;:()]/g,'').trim().split(/\s+/).filter(Boolean);

function parseCorrection(value){
  const raw=String(value||'').trim(),m=raw.match(/^(.+?)\s*→\s*(.+)$/);if(!m)return null;
  let left=m[1].trim(),right=m[2].trim(),prefix='',label='';
  const pm=left.match(/^([①-⑳ⓐ-ⓩ]|\d+\s*:?)\s*(.+)$/u);if(pm&&pm[2]){prefix=pm[1].trim();left=pm[2].trim();label=prefix.replace(/:$/,'')}
  return{raw,wrong:left,right,prefix,label};
}
function normBasic(v){return String(v??'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[“”"]/g,'').replace(/[.!?,;:]+$/g,'').replace(/\s+/g,' ').trim()}
function expandContractions(v){
  let s=` ${normBasic(v)} `;
  const pairs=[
    ["isn't",'is not'],["aren't",'are not'],["wasn't",'was not'],["weren't",'were not'],
    ["don't",'do not'],["doesn't",'does not'],["didn't",'did not'],["can't",'can not'],['cannot','can not'],
    ["couldn't",'could not'],["won't",'will not'],["wouldn't",'would not'],["shouldn't",'should not'],["mustn't",'must not'],
    ["haven't",'have not'],["hasn't",'has not'],["hadn't",'had not'],["i'm",'i am'],["you're",'you are'],
    ["we're",'we are'],["they're",'they are'],["i've",'i have'],["you've",'you have'],["we've",'we have'],["they've",'they have'],
    ["i'll",'i will'],["you'll",'you will'],["we'll",'we will'],["they'll",'they will'],["he'll",'he will'],["she'll",'she will']
  ];
  for(const [a,b] of pairs)s=s.replace(new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'g'),b);
  return s.replace(/\s+/g,' ').trim();
}
function normExact(v){return expandContractions(v)}
function searchable(v){return normBasic(v).replace(/[^a-z0-9가-힣'\-]+/gi,' ').replace(/\s+/g,' ').trim()}
function containsPhrase(text,phrase){
  const t=` ${searchable(text)} `,p=searchable(phrase);if(!p)return true;return t.includes(` ${p} `);
}
function correctionLabel(v){const s=String(v||'').trim().replace(/:$/,'');const n=CIRCLED_NUM.indexOf(s);if(n>=0)return String(n+1);const m=s.match(/^\d+$/);return m?String(Number(s)):s.toLowerCase()}
function correctionNorm(v){const p=parseCorrection(v);return p?`${correctionLabel(p.label||p.prefix)}|${normExact(p.wrong)}|${normExact(p.right)}`:normExact(v)}
function correctionTokens(v){const s=normExact(v).replace(/[.!?,;:()]+/g,' ');return s.split(/\s+/).filter(Boolean)}
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
  for(const r of refs){let hit=-1;for(let i=0;i<mine.length;i++){if(used.has(i))continue;if(correctionPairEquivalent(r,mine[i],{requireLabel})){hit=i;break}}if(hit<0)return false;used.add(hit)}
  return true;
}

function checkConstraints(question,response,policy){
  const c=policy.constraints||{},parts=Array.isArray(response)?response:[response],text=parts.join('\n');
  if(c.wordCount&&words(text).length!==Number(c.wordCount))return{ok:false,message:`${c.wordCount}단어로 써야 합니다.`};
  if(Array.isArray(c.partWordCounts)&&c.partWordCounts.length){
    for(let i=0;i<c.partWordCounts.length;i++){const n=Number(c.partWordCounts[i])||0;if(n&&words(parts[i]??'').length!==n)return{ok:false,message:`${['ⓐ','ⓑ','ⓒ','ⓓ','ⓔ','ⓕ'][i]||`${i+1}번`} 답은 ${n}단어로 써야 합니다.`}}
  }
  if(c.noContractions&&/[A-Za-z]+['’][A-Za-z]+/.test(text))return{ok:false,message:'축약형을 사용하면 안 됩니다.'};
  if(c.contractionRequired&&!/[A-Za-z]+['’][A-Za-z]+/.test(text))return{ok:false,message:'축약형을 사용해야 합니다.'};
  const missingWords=(c.requiredWords||[]).filter(x=>!containsPhrase(text,x));if(missingWords.length)return{ok:false,message:`필수 단어를 사용하세요: ${missingWords.join(', ')}`};
  const missingExpressions=(c.requiredExpressions||[]).filter(x=>!containsPhrase(text,x));if(missingExpressions.length)return{ok:false,message:`필수 표현을 사용하세요: ${missingExpressions.join(', ')}`};
  return{ok:true,message:''};
}
function normalizeResponse(question,response){
  if(question.form===FORMS.identifiedCorrection)return asArray(response).map(correctionNorm).filter(Boolean);
  if([FORMS.choice,FORMS.multi,FORMS.multipart,FORMS.correction,FORMS.blanks].includes(question.form))return asArray(response).map(normExact).filter(Boolean);
  return normExact(response);
}
function exact(question,response,policy){
  const target=(question.answer||[]).map(normExact).filter(Boolean),mine=normalizeResponse(question,response),c=policy.constraints||{};
  if(question.form===FORMS.choice)return Array.isArray(mine)&&mine.length===1&&target.includes(mine[0]);
  if(question.form===FORMS.multi){const a=[...mine].sort(),b=[...target].sort();return a.length===b.length&&a.every((x,i)=>x===b[i])}
  if(question.form===FORMS.identifiedCorrection)return correctionArrayEquivalent(question.answer,response,{requireLabel:true,orderIrrelevant:true});
  if(question.form===FORMS.correction)return correctionArrayEquivalent(question.answer,response,{orderIrrelevant:!!c.answerOrderIrrelevant});
  if(question.form===FORMS.multipart||question.form===FORMS.blanks){let a=[...mine],b=[...target];if(c.answerOrderIrrelevant){a.sort();b.sort()}return a.length===b.length&&a.every((x,i)=>x===b[i])}
  if(c.alternatives)return target.includes(String(mine));
  return target.some(a=>a===String(mine));
}
function responseText(response){return Array.isArray(response)?response.map((x,i)=>`${i+1}. ${String(x??'')}`).join('\n'):String(response??'')}
function outputText(data){
  if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text;
  for(const item of data?.output||[])for(const c of item?.content||[])if(c?.type==='output_text'&&c.text)return c.text;
  return data?.choices?.[0]?.message?.content||'';
}
function parseVerdict(text){
  const raw=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');const p=JSON.parse(raw);
  if(typeof p.correct!=='boolean')throw new Error('Invalid AI verdict');return p;
}

async function aiGrade(question,response,policy){
  const system=`You are the strict final adjudicator for a Korean middle-school English assessment. Do not give partial credit.\n\nPOLICY FAMILY: ${policy.family}\nPOLICY RULE: ${policy.semanticRule}\n\nThe app has already enforced deterministic hard constraints that it can prove locally. You must still enforce every condition visible in the question/context, including required grammar, supplied words or expressions, word form instructions, completeness, and source meaning. For Korean free-response answers, judge content meaning rather than exact Korean wording, spacing, particles, or stylistic naturalness. Do not require the model-answer wording when the policy permits semantic equivalence. If the task asks the student to create an original sentence, the reference is an example rather than a mandatory meaning. If uncertain, reject.\n\nReturn JSON only with: {"correct":true|false,"reason_code":"correct_alternative|grammar|meaning|completeness|task|word_choice|word_order|missing_required_word|extra_information|other","reason":"short internal English reason","explanation_ko":"short student-facing Korean explanation"}. If correct, explanation_ko must be an empty string.`;
  const user=`QUESTION TYPE:\n${question?.tracking?.questionType||''}\n\nQUESTION FORM:\n${question.form||''}\n\nQUESTION:\n${question.prompt||''}\n\nCONTEXT AND CONDITIONS:\n${JSON.stringify(question.context||{})}\n\nCANONICAL HARD CONSTRAINTS:\n${JSON.stringify(policy.constraints||{})}\n\nREFERENCE ANSWER PARTS:\n${(question.answer||[]).map((a,i)=>`${i+1}. ${a}`).join('\n')}\n\nSTUDENT RESPONSE:\n${responseText(response)}`;
  const body={endpoint:'responses',payload:{model:'gpt-5.6-luna',input:[{role:'system',content:[{type:'input_text',text:system}]},{role:'user',content:[{type:'input_text',text:user}]}],reasoning:{effort:'low'},max_output_tokens:260}};
  const fetcher=window.WillenaAPI&&typeof window.WillenaAPI.fetch==='function'?window.WillenaAPI.fetch.bind(window.WillenaAPI):fetch;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const r=await fetcher('/.netlify/functions/openai_proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
    if(!r.ok)throw new Error(`AI HTTP ${r.status}`);const payload=await r.json(),data=payload?.data||payload;return parseVerdict(outputText(data));
  }finally{clearTimeout(timer)}
}

export async function gradeQuestion(question,response){
  const policy=resolveQuestionGradingPolicy(question);
  const constraint=checkConstraints(question,response,policy);
  if(!constraint.ok)return{correct:false,message:constraint.message,correctAnswer:question.answer,method:'constraint',gradingPolicy:policy};
  if(exact(question,response,policy))return{correct:true,message:'',correctAnswer:question.answer,method:'exact',gradingPolicy:policy};
  if(policy.aiAllowed){
    try{
      const verdict=await aiGrade(question,response,policy),correct=verdict.correct===true;
      return{correct,message:correct?'':(verdict.explanation_ko||verdict.reason||'정답을 확인해 보세요.'),correctAnswer:question.answer,method:'luna',aiReason:verdict.reason||null,aiReasonCode:verdict.reason_code||null,gradingPolicy:policy};
    }catch(e){
      console.warn('[shared grader] AI failed closed',{questionId:question?.id||null,type:question?.tracking?.questionType||null,error:e?.message||String(e)});
      return{correct:false,message:'AI 확인에 실패했습니다. 다시 시도해 주세요.',correctAnswer:question.answer,method:'ai_failed',gradingPolicy:policy};
    }
  }
  return{correct:false,message:'정답을 확인해 보세요.',correctAnswer:question.answer,method:'exact',gradingPolicy:policy};
}

export {resolveQuestionGradingPolicy};
