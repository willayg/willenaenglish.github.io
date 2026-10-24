// Sentence Genius deterministic answer equivalence, revision 2.0.
// Conservative by design: no phonetic/plural guessing; unknown answers
// remain incorrect here until the later semantic AI grader is connected.
export const FLEXIBILITY_REVISION='2.0.0';

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
    if(toPermissionKey(reference)===toPermissionKey(value)&&
        toPermissionKey(reference)!==reference)
      return {correct:true,matchedBy:'equivalent_permission',transcript};
    if(toRequestKey(reference)===toRequestKey(value)&&
        toRequestKey(reference)!==reference)
      return {correct:true,matchedBy:'equivalent_request',transcript};
  }
  return null;
}
