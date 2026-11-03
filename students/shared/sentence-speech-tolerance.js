// Shared sentence-speaking tolerance, version 1.
// This is for recognizing spoken sentences only: never apply to typed grammar or spelling.
// Preserve word order, negation, numbers, and other meaning-changing terms.
const APOSTROPHES=/[\u2018\u2019\u02bc]/g;
const EXPAND={
 "i'm":"i am","you're":"you are","we're":"we are","they're":"they are",
 "he's":"he is","she's":"she is","it's":"it is","that's":"that is",
 "what's":"what is","who's":"who is","where's":"where is",
 "there's":"there is","here's":"here is","this's":"this is",
 "don't":"do not","doesn't":"does not","didn't":"did not",
 "isn't":"is not","aren't":"are not","wasn't":"was not","weren't":"were not",
 "can't":"cannot","cannot":"cannot","won't":"will not",
 "couldn't":"could not","wouldn't":"would not","shouldn't":"should not",
 "i've":"i have","we've":"we have","they've":"they have",
 "i'll":"i will","you'll":"you will","we'll":"we will","they'll":"they will",
 "i'd":"i would","you'd":"you would","we'd":"we would","they'd":"they would"
};
// Avoid treating all possessive 's as "is": e.g. "Tim's book" must not become "Tim is book".
// These familiar subject expressions are genuinely ordinary spoken contractions.
const IS_SUBJECTS=new Set(["name","my name","your name","his name","her name","our name",
 "the name","today","tomorrow","yesterday","everyone","somebody","someone",
 "everything","something","nobody","nothing","the weather"]);
const PROTECTED=new Set(["no","not","never","cannot","can","can't","will","won't",
 "do","does","did","don't","doesn't","didn't","was","were","is","are",
 "am","has","have","had","must","should","shouldn't",
 "one","two","three","four","five","six","seven","eight","nine","ten",
 "first","second","third","last","before","after","more","less","most","least"]);
function clean(s){return String(s??"").normalize("NFKC").toLowerCase().replace(APOSTROPHES,"'")
 .replace(/[‐‑–—]/g," ").replace(/[^a-z0-9' ]/g," ").replace(/\s+/g," ").trim();}
export function spokenTokens(input){
 let s=clean(input);
 // Name's Mina -> name is mina; not Tim's book -> tim is book.
 s=s.replace(/\b((?:my|your|his|her|our|the) name|name|today|tomorrow|yesterday|everyone|somebody|someone|everything|something|nobody|nothing|the weather)'s\b/g,
 (_full,subject)=>IS_SUBJECTS.has(subject)?subject+" is":_full);
 const words=s.split(" ").filter(Boolean);
 const normalized=[];
 for(const part of words){
   const expanded=EXPAND[part]||part;
   normalized.push(...expanded.split(" "));
 }
 return normalized;
}
function same(a,b){return a.length===b.length && a.every((w,i)=>w===b[i]);}
function repeatedTarget(target,heard){
 if(!target.length||heard.length<target.length*2||heard.length>target.length*4)return false;
 if(heard.length%target.length!==0)return false;
 for(let i=0;i<heard.length;i++)if(heard[i]!==target[i%target.length])return false;
 return true;
}
function lcsLength(a,b){
 const row=new Uint16Array(b.length+1);
 for(const x of a){
  let diagonal=0;
  for(let j=1;j<=b.length;j++){
   const previous=row[j];
   row[j]=x===b[j-1]?diagonal+1:Math.max(row[j],row[j-1]);
   diagonal=previous;
  }
 }
 return row[b.length];
}
export function judgeSentenceSpeech(target,transcript,{contractionPolicy='flexible'}={}){
 const raw=String(transcript??"").trim();
 if(!raw)return {correct:false,matchedBy:null,transcript:raw};
 const a=contractionPolicy==="exact_only"?clean(target).split(" ").filter(Boolean):spokenTokens(target);
 const b=contractionPolicy==="exact_only"?clean(raw).split(" ").filter(Boolean):spokenTokens(raw);
 if(!a.length||!b.length)return {correct:false,matchedBy:null,transcript:raw};
 if(same(a,b))return {correct:true,matchedBy:"speech_normalized",transcript:raw};
 if(repeatedTarget(a,b))return {correct:true,matchedBy:"speech_repeated",transcript:raw};
 // For longer targets, allow minor STT omissions but not critical-word changes.
 // Both recall and precision must be >= 90%, preserving meaningful ordering.
 if(a.length>=10&&b.length>=10 && Math.abs(a.length-b.length)<=Math.floor(a.length*.1)){
  for(const w of a)if(PROTECTED.has(w) && a.filter(x=>x===w).length!==b.filter(x=>x===w).length)
   return {correct:false,matchedBy:null,transcript:raw};
  const coverage=lcsLength(a,b);
  if(coverage/a.length>=.90 && coverage/b.length>=.90)
   return {correct:true,matchedBy:"speech_90_percent",transcript:raw};
 }
 return {correct:false,matchedBy:null,transcript:raw};
}
export function judgeSentenceSpeechAlternatives(target,candidates,policy={}){
 for(const transcript of (Array.isArray(candidates)?candidates:[candidates])){
  const result=judgeSentenceSpeech(target,transcript,policy);
  if(result.correct)return result;
 }
 return null;
}
