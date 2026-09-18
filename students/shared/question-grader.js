import {resolveQuestionGradingPolicy} from './question-grading-policy.js?v=2.0.1';
import {gradeWithAiWilli,classifyVocabSemanticNearMatch,aiWilliMessage} from './ai-willi.js?v=1.0.3';

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
function questionTypeOf(question){return String(question?.tracking?.questionType||question?.questionType||question?.metadata?.question_type||'').trim().toLowerCase()}
function isTypedVocabQuestion(question){
  if(String(question?.form||'').toLowerCase()!==FORMS.write)return false;
  const practice=String(question?.tracking?.practiceType||question?.metadata?.practice_type||question?.skill||'').toLowerCase();
  const mastery=String(question?.mastery_key||question?.masteryKey||question?.metadata?.mastery_key||'').toLowerCase();
  return practice==='vocab_test'||practice==='vocabulary'||mastery.startsWith('vocab:')||!!question?.metadata?.lexical_entry_id;
}
function isStandaloneVocabMeaningQuestion(question){
  if(!isTypedVocabQuestion(question))return false;
  const type=questionTypeOf(question);
  if(['translation_blank','bilingual_blank_write','sentence_transformation','common_blank','common_word_text','definition_blank_write'].includes(type))return false;
  return String(question?.mastery_key||question?.masteryKey||question?.metadata?.mastery_key||'').toLowerCase().startsWith('vocab:')
    || !!question?.metadata?.lexical_entry_id
    || type.startsWith('vocab_');
}
function normVocabLoose(v){
  return normExact(v)
    .replace(/[~–—_.,!?;:()[\]{}"'“”‘’`]/g,' ')
    .replace(/-/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function compactVocab(v){return normVocabLoose(v).replace(/[\s/]+/g,'')}
function expandSlashAlternatives(value){
  const s=normExact(value).replace(/\s*\/\s*/g,'/');
  const tokens=s.split(/\s+/).filter(Boolean);
  let variants=[''];
  for(const token of tokens){
    const parts=token.includes('/')?token.split('/').filter(Boolean):[token];
    const next=[];
    for(const prefix of variants)for(const part of parts)next.push((prefix+' '+part).trim());
    variants=next;
    if(variants.length>16)return[normExact(value)];
  }
  return variants.length?variants:[normExact(value)];
}
function stripArticles(v){return normVocabLoose(v).split(/\s+/).filter(w=>w&&!['a','an','the'].includes(w)).join(' ')}
function oneSimpleNumberDifference(a,b){
  const aw=normVocabLoose(a).split(/\s+/).filter(Boolean),bw=normVocabLoose(b).split(/\s+/).filter(Boolean);
  if(aw.length!==bw.length||!aw.length)return false;
  let diffs=0;
  for(let i=0;i<aw.length;i++){
    if(aw[i]===bw[i])continue;
    const x=aw[i],y=bw[i];
    const simple=(x.length>3&&x===y+'s')||(y.length>3&&y===x+'s');
    if(!simple)return false;
    diffs++;
  }
  return diffs===1;
}
function normalizePossessivePlaceholder(v){
  return normVocabLoose(v).replace(/\b(?:one's|my|your|his|her|our|their)\b/g,'{poss}');
}
function possessivePlaceholderEquivalent(a,b){
  const aa=normalizePossessivePlaceholder(a),bb=normalizePossessivePlaceholder(b);
  return aa.includes('{poss}')&&aa===bb;
}
function vocabLenientEquivalent(question,response){
  if(!isTypedVocabQuestion(question))return null;
  const mine=normExact(response);
  if(!mine)return null;
  const targets=(question.answer||[]).map(String).filter(Boolean);
  for(const raw of targets){
    for(const alt of expandSlashAlternatives(raw)){
      if(normExact(alt)===mine)return{type:'slash_alternative',matched:alt};
      if(compactVocab(alt)===compactVocab(mine))return{type:'punctuation_or_spacing',matched:alt};
      if(isStandaloneVocabMeaningQuestion(question)){
        if(stripArticles(alt)===stripArticles(mine)&&stripArticles(alt))return{type:'article_variation',matched:alt};
        if(oneSimpleNumberDifference(alt,mine))return{type:'singular_plural',matched:alt};
        if(possessivePlaceholderEquivalent(alt,mine))return{type:'possessive_placeholder',matched:alt};
      }
    }
  }
  return null;
}
function searchable(v){return normBasic(v).replace(/[^a-z0-9가-힣'\-]+/gi,' ').replace(/\s+/g,' ').trim()}
function containsPhrase(text,phrase){const t=` ${searchable(text)} `,p=searchable(phrase);if(!p)return true;return t.includes(` ${p} `)}
function correctionLabel(v){const s=String(v||'').trim().replace(/:$/,'');const n=CIRCLED_NUM.indexOf(s);if(n>=0)return String(n+1);const m=s.match(/^\d+$/);return m?String(Number(s)):s.toLowerCase()}
function correctionNorm(v){const p=parseCorrection(v);return p?`${correctionLabel(p.label||p.prefix)}|${normExact(p.wrong)}|${normExact(p.right)}`:normExact(v)}
function correctionTokens(v){return normExact(v).replace(/[.!?,;:()]+/g,' ').split(/\s+/).filter(Boolean)}
function sameTokens(a,b){return a.length===b.length&&a.every((x,i)=>x===b[i])}
function replaceTokenSequence(base,from,to){
  if(!base.length||!from.length)return null;
  for(let i=0;i<=base.length-from.length;i++){
    if(!from.every((x,j)=>base[i+j]===x))continue;
    return[...base.slice(0,i),...to,...base.slice(i+from.length)];
  }
  return null;
}
function expandedCorrectionEquivalent(referenceWrong,referenceRight,studentWrong,studentRight){
  const rw=correctionTokens(referenceWrong),rr=correctionTokens(referenceRight),sw=correctionTokens(studentWrong),sr=correctionTokens(studentRight);
  if(!rw.length||!rr.length||!sw.length||!sr.length)return false;
  if(sameTokens(sw,rw)&&sameTokens(sr,rr))return true;
  const studentExpanded=replaceTokenSequence(sw,rw,rr);
  if(studentExpanded&&sameTokens(studentExpanded,sr))return true;
  const referenceEdited=replaceTokenSequence(rw,sw,sr);
  return !!referenceEdited&&sameTokens(referenceEdited,rr);
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
  const lenient=vocabLenientEquivalent(question,response);
  if(lenient)return{correct:true,message:'',correctAnswer:question.answer,method:'lenient_vocab',leniencyType:lenient.type,leniencyMatched:lenient.matched,gradingPolicy:policy};
  if(isStandaloneVocabMeaningQuestion(question)){
    try{
      const semantic=await classifyVocabSemanticNearMatch(question,response);
      if(semantic.nearMatch)return{correct:false,warning:true,warningType:'semantic_target',message:'뜻은 비슷하지만 목표 표현이 달라요. 목표 표현을 다시 써 보세요.',correctAnswer:question.answer,method:'semantic_vocab_near_match',semanticReason:semantic.reason||null,gradingPolicy:policy};
    }catch(e){console.warn('[shared grader] vocab semantic near-match check failed',{questionId:question?.id||null,error:e?.message||String(e)})}
  }
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
