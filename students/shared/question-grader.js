import {resolveQuestionGradingPolicy} from './question-grading-policy.js?v=2.0.0';
import {gradeWithAiWilli} from './ai-willi/ai-willi-grader.js?v=1.0.0';
import {aiWilliMessage} from './ai-willi/ai-willi-messages.js?v=1.0.0';

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
function containsPhrase(text,phrase){const t=` ${searchable(text)} `,p=searchable(phrase);if(!p)return true;return t.includes(` ${p} `)}
function correctionLabel(v){const s=String(v||'').trim().replace(/:$/,'');const n=CIRCLED_NUM.indexOf(s);if(n>=0)return String(n+1);const m=s.match(/^\d+$/);return m?String(Number(s)):s.toLowerCase()}
function correctionNorm(v){const p=parseCorrection(v);return p?`${correctionLabel(p.label||p.prefix)}|${normExact(p.wrong)}|${normExact(p.right)}`:normExact(v)}
function correctionTokens(v){return normExact(v).replace(/[.!?,;:()]+/g,' ').split(/\s+/).filter(Boolean)}
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

export async function gradeQuestion(question,response){
  const policy=resolveQuestionGradingPolicy(question);
  const constraint=checkConstraints(question,response,policy);
  if(!constraint.ok)return{correct:false,message:constraint.message,correctAnswer:question.answer,method:'constraint',gradingPolicy:policy};
  if(exact(question,response,policy))return{correct:true,message:'',correctAnswer:question.answer,method:'exact',gradingPolicy:policy};
  if(policy.aiAllowed){
    try{
      const verdict=await gradeWithAiWilli(question,response,policy),correct=verdict.correct===true;
      return{correct,message:correct?'':(verdict.explanationKo||verdict.reason||'정답을 확인해 보세요.'),correctAnswer:question.answer,method:'ai_willi',aiReason:verdict.reason||null,aiReasonCode:verdict.reasonCode||null,gradingPolicy:policy};
    }catch(e){
      console.warn('[shared grader] AI Willi failed closed',{questionId:question?.id||null,type:question?.tracking?.questionType||null,error:e?.message||String(e)});
      return{correct:false,message:aiWilliMessage('grader','failed'),correctAnswer:question.answer,method:'ai_willi_failed',gradingPolicy:policy};
    }
  }
  return{correct:false,message:'정답을 확인해 보세요.',correctAnswer:question.answer,method:'exact',gradingPolicy:policy};
}

export {resolveQuestionGradingPolicy};
