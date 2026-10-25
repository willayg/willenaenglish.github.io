// Sentence Genius deterministic answer equivalence, revision 2.0.
// Conservative by design: no phonetic/plural guessing; unknown answers
// remain incorrect here until the later semantic AI grader is connected.
export const FLEXIBILITY_REVISION='2.2.0';

export function normalizeFlexibleText(value,{contractions=true}={}){
  let text=String(value??'').normalize('NFKC').toLowerCase()
    .replace(/[’‘]/g,"'").replace(/[-–—]/g,' ')
    .replace(/[^a-z0-9' ]/g,' ').replace(/\s+/g,' ').trim();
  if(contractions){
    const expand={
      "i'm":"i am","you're":"you are","we're":"we are","they're":"they are",
      "don't":"do not","doesn't":"does not","didn't":"did not",
      "isn't":"is not","aren't":"are not","wasn't":"was not","weren't":"were not",
      "can't":"cannot","cannot":"cannot","won't":"will not",
      "wouldn't":"would not","couldn't":"could not","shouldn't":"should not",
      "i've":"i have","we've":"we have","they've":"they have",
      "i'll":"i will","you'll":"you will","we'll":"we will","they'll":"they will",
      "i'd":"i would"
    };
    text=text.split(' ').map(part=>expand[part]||part).join(' ');
  }
  return text;
}

const safePermissionVerbs='borrow|use|have|take|ask|leave|go|get';
function toPermissionKey(sentence){
  // Recognizes ordinary permission requests only, not ability or tense.
  return sentence.replace(new RegExp('^(?:may|can|could) i (?=(?:'+safePermissionVerbs+')\\b)'),'PERMISSION i');
}

function toRequestKey(sentence){
  // Only imperative requests for help: other can/could questions may test ability.
  return sentence.replace(/^(?:can|could) you (?=(?:help|tell|show|pass|give|lend|open|close|explain)\b)/,'REQUEST you');
}

function quantifierEquivalent(target,spoken){
  if(target===spoken)return false;
  // Deterministic plural/countable frames. This intentionally does not
  // rewrite "how many", "too many", or pronoun uses like "many are ready".
  const countFrame=/^((?:there (?:are|were)|(?:i|we|you|they|he|she) (?:have|had|has)) )(?:(?:many)|(?:a lot of)|(?:lots of)) (.+)$/;
  const left=target.match(countFrame),right=spoken.match(countFrame);
  if(left&&right&&left[1]===right[1]&&left[2]===right[2])return true;

  // "lots of" and "a lot of" work with countable and uncountable nouns.
  if(target.includes('a lot of ')&&target.replace(/\ba lot of\b/g,'lots of')===spoken)return true;
  if(target.includes('lots of ')&&target.replace(/\blots of\b/g,'a lot of')===spoken)return true;
  return false;
}

// In ordinary classroom possession questions, "Do you have a marker?"
// and "Do you have any markers?" ask essentially the same yes/no question.
// Only a/an + a safely inflected count noun; never for mass nouns, pronouns,
// plural-only nouns, or questions that require a specific textbook structure.
const pluralOnlyNouns=new Set([
  'glasses','scissors','shorts','trousers','pants','clothes','jeans',
  'pliers','tongs','binoculars','spectacles','news','series','species'
]);
function ordinaryPlural(singular,plural){
  if(!/^[a-z]{3,}$/.test(singular)||pluralOnlyNouns.has(plural))return false;
  if(singular.endsWith('s')||singular.endsWith('ss'))return false;
  if(singular+'s'===plural)return true;
  if(/(?:s|x|z|ch|sh)$/.test(singular)&&singular+'es'===plural)return true;
  if(/[^aeiou]y$/.test(singular)&&singular.slice(0,-1)+'ies'===plural)return true;
  return false;
}
function articleMatches(article,noun){
  // Don't automatically validate ambiguous sound/spelling combinations.
  if(!/^[a-z]{3,}$/.test(noun)||/^(?:honest|hour|heir|one|university|unicorn|unique|european)/.test(noun))return false;
  const vowel=/^[aeio]/.test(noun);
  return article===(vowel?'an':'a');
}
function possessionQuestionEquivalent(target,heard){
  const any=/^((?:do|does) (?:i|you|we|they|he|she|it) have )any ([a-z]+)$/;
  const article=/^((?:do|does) (?:i|you|we|they|he|she|it) have )(a|an) ([a-z]+)$/;
  const check=(pluralSentence,singularSentence)=>{
    const p=pluralSentence.match(any),s=singularSentence.match(article);
    return !!(p&&s&&p[1]===s[1]&&articleMatches(s[2],s[3])&&ordinaryPlural(s[3],p[2]));
  };
  return check(target,heard)||check(heard,target);
}

export function matchFlexibleSentence(target,transcripts,policy={}){
  const candidates=(Array.isArray(transcripts)?transcripts:[transcripts])
    .map(v=>String(v??'').trim()).filter(Boolean);
  if(!candidates.length)return null;
  const allowContractions=policy.contractionPolicy!=='exact_only';
  const reference=normalizeFlexibleText(target,{contractions:allowContractions});
  if(!reference)return null;
  const approved=(Array.isArray(policy.approvedAlternatives)?policy.approvedAlternatives:[])
    .map(v=>normalizeFlexibleText(v,{contractions:allowContractions})).filter(Boolean);

  for(const transcript of candidates){
    const value=normalizeFlexibleText(transcript,{contractions:allowContractions});
    if(!value)continue;
    if(value===reference)return {correct:true,matchedBy:'normalized',transcript};
    // Published teacher decisions are scoped to this specific book occurrence.
    if(approved.includes(value))
      return {correct:true,matchedBy:'approved_alternative',transcript};
    // Strict policies must never be weakened by a generic synonym rule.
    if(policy.mode==='exact_text'||policy.mode==='require_pattern')continue;
    if(quantifierEquivalent(reference,value))
      return {correct:true,matchedBy:'equivalent_quantifier',transcript};
    if(possessionQuestionEquivalent(reference,value))
      return {correct:true,matchedBy:'equivalent_possession_question',transcript};
    if(toPermissionKey(reference)===toPermissionKey(value)&&
        toPermissionKey(reference)!==reference)
      return {correct:true,matchedBy:'equivalent_permission',transcript};
    if(toRequestKey(reference)===toRequestKey(value)&&
        toRequestKey(reference)!==reference)
      return {correct:true,matchedBy:'equivalent_request',transcript};
  }
  return null;
}


// Minor, mechanically verifiable mistakes only. Different meaning, missing
// negation, wrong auxiliaries and unknown paraphrases must NOT receive credit.
// The semantic AI phase can adjudicate less obvious cases later.
function minorEnding(expected,heard){
  if(!/^[a-z]+$/.test(expected)||!/^[a-z]+$/.test(heard))return false;
  if(heard.length<3||expected.length<4)return false;
  if(expected===heard+'s')return true;
  if(expected===heard+'es'&&/(?:s|x|z|ch|sh|o)$/.test(heard))return true;
  if(expected.endsWith('ies')&&heard.endsWith('y')&&expected.slice(0,-3)===heard.slice(0,-1))return true;
  // Do not equate opposite directions (e.g. plural target vs plural student
  // expression) without a reliable grammatical target.
  return false;
}
function nearMissReason(target,response){
  const expected=target.split(' ').filter(Boolean),heard=response.split(' ').filter(Boolean);
  if(!expected.length||!heard.length)return '';
  // A single missing indefinite article: "I want apple".
  if(expected.length===heard.length+1){
    for(let index=0;index<expected.length;index++){
      if(!['a','an'].includes(expected[index]))continue;
      if(expected.filter((_,i)=>i!==index).join(' ')===response)return'missing_article';
    }
  }
  if(expected.length!==heard.length)return '';
  const changed=[];
  for(let i=0;i<expected.length;i++)if(expected[i]!==heard[i])changed.push(i);
  if(changed.length!==1)return '';
  const i=changed[0],a=expected[i],b=heard[i];
  if((a==='a'&&b==='an')||(a==='an'&&b==='a'))return'wrong_article';
  if(minorEnding(a,b))return'missing_word_ending';
  return '';
}
export function detectAlmostRight(target,transcripts,policy={}){
  const candidates=(Array.isArray(transcripts)?transcripts:[transcripts])
    .map(v=>String(v??'').trim()).filter(Boolean);
  const contractions=policy.contractionPolicy!=='exact_only';
  const reference=normalizeFlexibleText(target,{contractions});
  if(!reference)return null;
  for(const transcript of candidates){
    const value=normalizeFlexibleText(transcript,{contractions});
    const reason=nearMissReason(reference,value);
    if(reason)return{correct:false,almostRight:true,matchedBy:'almost_'+reason,
      transcript,reason};
  }
  return null;
}
