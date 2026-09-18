import {resolveQuestionGradingPolicy} from './question-grading-policy.js?v=2.0.1';
import {gradeWithAiWilli,aiWilliMessage} from './ai-willi.js?v=1.0.2';

export const GRADER_VERSION='2.2.0';
const stamp=result=>({...result,graderVersion:GRADER_VERSION});

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
function isTypedVocabWrite(question){
  if(String(question?.form||'').toLowerCase()!==FORMS.write)return false;
  const practice=String(question?.tracking?.practiceType||question?.metadata?.practice_type||'').toLowerCase();
  const type=String(question?.tracking?.questionType||question?.questionType||question?.metadata?.question_type||'').toLowerCase();
  return practice==='vocabulary'||practice==='vocab_test'||type.startsWith('vocab');
}
function spaceBoundaries(value){
  const s=normExact(value),out=new Set();let pos=0;
  for(const ch of s){if(ch===' ')out.add(pos);else pos++}
  return{flat:s.replace(/ /g,''),boundaries:out,count:out.size};
}
function missingTargetSpacesEquivalent(question,response){
  if(!isTypedVocabWrite(question))return false;
  const mine=spaceBoundaries(response);
  if(!mine.flat)return false;
  for(const raw of question.answer||[]){
    const target=spaceBoundaries(raw);
    if(target.flat!==mine.flat||mine.count>=target.count)continue;
    let valid=true;
    for(const boundary of mine.boundaries){if(!target.boundaries.has(boundary)){valid=false;break}}
    if(valid)return true;
  }
  return false;
}

function slashVariants(value){
  const base=normExact(value);
  if(!base.includes('/'))return[base];
  const tokens=base.split(' ');let variants=[''];
  for(const token of tokens){
    const options=token.includes('/')?token.split('/').map(x=>x.trim()).filter(Boolean):[token];
    if(!options.length)return[base];
    const next=[];
    for(const prefix of variants)for(const option of options){
      next.push((prefix+' '+option).trim());
      if(next.length>=16)break;
    }
    variants=next.slice(0,16);
  }
  return variants;
}
function slashAlternativeEquivalent(question,response){
  if(!isTypedVocabWrite(question))return false;
  const mine=normExact(response);
  return (question.answer||[]).some(raw=>slashVariants(raw).some(v=>v===mine));
}
function possessivePlaceholderEquivalent(question,response){
  if(!isTypedVocabWrite(question))return false;
  const mine=normExact(response);
  const possessives=["my","your","his","her","our","their","one's"];
  for(const raw of question.answer||[]){
    const target=normExact(raw);
    if(!/\bone's\b/.test(target))continue;
    for(const p of possessives)if(target.replace(/\bone's\b/g,p)===mine)return true;
  }
  return false;
}
function vocabMarkerNorm(value){
  return normExact(value).replace(/\s*~\s*/g,' ').replace(/\s+/g,' ').trim();
}
function harmlessVocabSymbolEquivalent(question,response){
  if(!isTypedVocabWrite(question))return false;
  const mine=vocabMarkerNorm(response);
  return (question.answer||[]).some(raw=>{
    const target=vocabMarkerNorm(raw);
    return target!==normExact(raw)&&target===mine;
  });
}
function vocabPartOfSpeech(question){
  const meta=String(question?.metadata?.part_of_speech||question?.metadata?.entry_type||'').toLowerCase();
  const targets=(question?.tracking?.targets||[]).map(x=>String(x||'').toLowerCase()).join(' ');
  return(meta+' '+targets).trim();
}
function isNounLikeVocab(question){
  if(!isTypedVocabWrite(question))return false;
  return /(^|[^a-z])noun([^a-z]|$)/.test(vocabPartOfSpeech(question));
}
function stripLeadingArticle(value){
  return normExact(value).replace(/^(?:a|an|the)\s+/,'').trim();
}
function articleEquivalent(question,response){
  if(!isNounLikeVocab(question))return false;
  const mine=normExact(response),mineBare=stripLeadingArticle(mine);
  for(const raw of question.answer||[]){
    const target=normExact(raw),targetBare=stripLeadingArticle(target);
    if(target===targetBare&&mine===mineBare)continue;
    if(targetBare&&targetBare===mineBare&&target!==mine)return true;
  }
  return false;
}
function regularPlural(word){
  const w=String(word||'').toLowerCase();
  if(!/^[a-z]+$/.test(w)||w.length<2)return null;
  if(/[^aeiou]y$/.test(w))return w.slice(0,-1)+'ies';
  if(/(?:s|x|z|ch|sh)$/.test(w))return w+'es';
  return w+'s';
}
function regularPluralEquivalent(question,response){
  if(!isNounLikeVocab(question))return false;
  const mine=normExact(response);
  if(!/^[a-z]+$/.test(mine))return false;
  for(const raw of question.answer||[]){
    const target=normExact(raw);
    if(!/^[a-z]+$/.test(target))continue;
    if(regularPlural(target)===mine||regularPlural(mine)===target)return true;
  }
  return false;
}
function searchable(v){return normBasic(v).replace(/[^a-z0-9가-힣'\-]+/gi,' ').replace(/\s+/g,' ').trim()}
function typoWord(v){return normExact(v).replace(/[^a-z]/g,'')}
function isSubsequence(shorter,longer){
  let i=0;for(const ch of longer){if(ch===shorter[i])i++;if(i===shorter.length)return true}return i===shorter.length;
}
function omittedSuffix(shorter,longer){
  if(!longer.startsWith(shorter))return'';
  return longer.slice(shorter.length);
}
function adjacentTransposition(a,b){
  if(a.length!==b.length)return false;
  const diff=[];for(let i=0;i<a.length;i++)if(a[i]!==b[i])diff.push(i);
  return diff.length===2&&diff[1]===diff[0]+1&&a[diff[0]]===b[diff[1]]&&a[diff[1]]===b[diff[0]];
}
function introducedDouble(response,target){
  if(response.length!==target.length)return false;
  const diff=[];for(let i=0;i<response.length;i++)if(response[i]!==target[i])diff.push(i);
  if(diff.length!==1)return false;
  const i=diff[0];
  return (i>0&&response[i]===response[i-1]&&target[i]!==target[i-1])||(i<response.length-1&&response[i]===response[i+1]&&target[i]!==target[i+1]);
}
function safeTypoNearMiss(question,response){
  if(!isTypedVocabWrite(question))return false;
  const mine=typoWord(response);
  if(!mine||mine.includes(' ')||mine.length<3)return false;
  for(const raw of question.answer||[]){
    const target=typoWord(raw);
    if(!target||target===mine||target.length<4)continue;
    const gap=target.length-mine.length;
    if(gap===1&&isSubsequence(mine,target)){
      const suffix=omittedSuffix(mine,target);
      if(!['s','d'].includes(suffix))return true;
    }
    if(gap===2&&target.length>=7&&isSubsequence(mine,target)){
      const suffix=omittedSuffix(mine,target);
      if(!['ly','ed','es','er'].includes(suffix))return true;
    }
    if(gap===0&&(adjacentTransposition(mine,target)||introducedDouble(mine,target)))return true;
  }
  return false;
}
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

export async function gradeQuestion(question,response,options={}){
  const policy=resolveQuestionGradingPolicy(question);
  const constraint=checkConstraints(question,response,policy);
  if(!constraint.ok)return stamp({correct:false,message:constraint.message,correctAnswer:question.answer,method:'constraint',gradingPolicy:policy});
  if(exact(question,response,policy))return stamp({correct:true,message:'',correctAnswer:question.answer,method:'exact',gradingPolicy:policy});
  if(missingTargetSpacesEquivalent(question,response))return stamp({correct:true,message:'',correctAnswer:question.answer,method:'vocab_missing_space',gradingPolicy:policy});
  if(slashAlternativeEquivalent(question,response))return stamp({correct:true,message:'',correctAnswer:question.answer,method:'vocab_slash_alternative',gradingPolicy:policy});
  if(possessivePlaceholderEquivalent(question,response))return stamp({correct:true,message:'',correctAnswer:question.answer,method:'vocab_possessive_placeholder',gradingPolicy:policy});
  if(harmlessVocabSymbolEquivalent(question,response))return stamp({correct:true,message:'',correctAnswer:question.answer,method:'vocab_symbol_marker',gradingPolicy:policy});
  if(articleEquivalent(question,response))return stamp({correct:true,message:'',correctAnswer:question.answer,method:'vocab_article_variant',gradingPolicy:policy});
  if(regularPluralEquivalent(question,response))return stamp({correct:true,message:'',correctAnswer:question.answer,method:'vocab_regular_plural',gradingPolicy:policy});
  if(!options.suppressWarnings&&safeTypoNearMiss(question,response))return stamp({correct:false,warning:true,warningType:'vocab_typo',message:'⚠️ 거의 맞았어요! 철자나 띄어쓰기를 한 번 더 확인해 보세요.',correctAnswer:question.answer,method:'vocab_typo_warning',gradingPolicy:policy});
  if(policy.aiAllowed){
    try{
      const verdict=await gradeWithAiWilli(question,response,policy),correct=verdict.correct===true;
      return stamp({correct,message:correct?'':(verdict.explanationKo||verdict.reason||'정답을 확인해 보세요.'),correctAnswer:question.answer,method:'ai_willi',aiReason:verdict.reason||null,aiReasonCode:verdict.reasonCode||null,gradingPolicy:policy});
    }catch(e){
      console.warn('[shared grader] AI Willi failed closed',{questionId:question?.id||null,type:question?.tracking?.questionType||null,error:e?.message||String(e)});
      return stamp({correct:false,message:aiWilliMessage('grader','failed'),correctAnswer:question.answer,method:'ai_willi_failed',gradingPolicy:policy});
    }
  }
  return stamp({correct:false,message:'정답을 확인해 보세요.',correctAnswer:question.answer,method:'exact',gradingPolicy:policy});
}

export {resolveQuestionGradingPolicy};
