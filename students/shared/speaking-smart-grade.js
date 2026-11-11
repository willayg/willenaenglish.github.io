// Deterministic speaking-only evaluator. Never use for typed spelling or grammar.
// Grade the STT transcript, not acoustic pronunciation; 4/3/2 are confidence tiers.
// A missing or unrelated transcript is a retry (0).
const CONTRACTIONS={"i'm":"i am","you're":"you are","we're":"we are","they're":"they are","he's":"he is","she's":"she is","it's":"it is","don't":"do not","doesn't":"does not","didn't":"did not","can't":"cannot","won't":"will not","isn't":"is not","aren't":"are not","wasn't":"was not","weren't":"were not","i've":"i have","we've":"we have","they've":"they have","i'll":"i will","you'll":"you will","we'll":"we will","they'll":"they will"};
const ARTICLES=new Set(['a','an','the']);
const LIGHT=new Set(['a','an','the','is','are','am','to','of','in','on','at','for','and']);
const CRITICAL=new Set(['not','never','no','cannot','can','will','would','should','must','before','after','more','less','first','last','one','two','three','four','five','six','seven','eight','nine','ten']);
const PAIRS=[['to','too','two'],['there','their',"they're"],['by','buy','bye'],['see','sea'],['right','write'],['flower','flour'],['one','won'],['four','for'],['night','knight'],['wear','where'],['hear','here']];
function tokens(value){
 let s=String(value||'').toLowerCase().normalize('NFKC').replace(/[’‘]/g,"'").replace(/[—–-]/g,' ');
 s=s.replace(/\b(?:i'm|you're|we're|they're|he's|she's|it's|don't|doesn't|didn't|can't|won't|isn't|aren't|wasn't|weren't|i've|we've|they've|i'll|you'll|we'll|they'll)\b/g,w=>CONTRACTIONS[w]||w);
 return s.replace(/[^a-z0-9' ]/g,' ').trim().split(/\s+/).filter(Boolean);
}
const stem=w=>w.length>4&&w.endsWith('ies')?w.slice(0,-3)+'y':
 w.length>4&&w.endsWith('ed')?w.slice(0,-2):
 w.length>4&&w.endsWith('ing')?w.slice(0,-3):
 w.length>3&&w.endsWith('s')&&!w.endsWith('ss')?w.slice(0,-1):w;
function sameRoot(a,b){return a===b||stem(a)===stem(b)||(a+'e'===b&&a.length>=4)||(b+'e'===a&&b.length>=4)}
function homophone(a,b){return PAIRS.some(g=>g.includes(a)&&g.includes(b))}
function compatible(a,b){return a===b||sameRoot(a,b)||homophone(a,b)}
function aligned(target,heard){
 const used=new Set();let matched=0,exact=0,changed=0;const matchedTargets=[];
 for(let i=0;i<target.length;i++){
  let pos=-1;
  for(let j=0;j<heard.length;j++)if(!used.has(j)&&target[i]===heard[j]){pos=j;break}
  if(pos<0)for(let j=0;j<heard.length;j++)if(!used.has(j)&&compatible(target[i],heard[j])){pos=j;break}
  if(pos>=0){used.add(pos);matched++;if(target[i]===heard[pos])exact++;else changed++;matchedTargets.push(i)}
 }
 return {matched,exact,changed,used,matchedTargets};
}
// Ordered token overlap, rather than unordered bag-of-words matching.
function orderedCoverage(target,heard){
 const dp=new Array(heard.length+1).fill(0);
 for(const w of target){let prior=0;for(let j=1;j<=heard.length;j++){const old=dp[j];dp[j]=compatible(w,heard[j-1])?prior+1:Math.max(dp[j],dp[j-1]);prior=old;}}
 return dp[heard.length];
}
const result=(points,transcript,reason)=>({points,correct:points>=2,level:points===4?'green':points===3?'lime':points===2?'yellow':'red',transcript,matchedBy:reason});
export function gradeSpeaking(target,alternatives,{mode='word',exactMatcher=null}={}){
 const expected=tokens(target);
 const heardList=(Array.isArray(alternatives)?alternatives:[alternatives]).map(String).map(s=>s.trim()).filter(Boolean).slice(0,5);
 if(!expected.length||!heardList.length)return result(0,heardList[0]||'','no_speech');
 let best=result(0,heardList[0],'unrecognized');
 for(const raw of heardList){
  const heard=tokens(raw);
  if(!heard.length)continue;
  let score=0,reason='unrecognized';
  if(expected.join(' ')===heard.join(' ')){score=4;reason='exact';}
  // Vocabulary phrases: an inserted definite article can be a natural,
  // fully correct utterance (watch birds -> watch the birds).
  // Require every original target token in order and exactly one extra "the".
  // Do not apply this shortcut to sentence-pattern practice.
  else if(mode==='word'&&expected.length>=2&&heard.length===expected.length+1&&
    heard.some((word,index)=>word==='the'&&
      [...heard.slice(0,index),...heard.slice(index+1)].every((v,i)=>v===expected[i]))){
    score=4;reason='optional_definite_article';
  }
  else if(mode==='word'&&typeof exactMatcher==='function'){
   const legacy=exactMatcher(target,[raw]);
   if(legacy?.correct&&['homophone','spacing','exact','in_sentence','in_sentence_homophone'].includes(legacy.matchedBy)){score=4;reason=legacy.matchedBy;}
   else if(legacy?.correct&&['phonetic','singular_plural','final_m_n'].includes(legacy.matchedBy)){score=3;reason='legacy_'+legacy.matchedBy;}
  }
  if(!score){
   const a=aligned(expected,heard);
   const required=expected.filter(w=>!LIGHT.has(w));
   const recognized=required.filter(w=>heard.some(h=>compatible(w,h))).length;
   const criticalSafe=[...new Set([...expected,...heard])].every(w=>!CRITICAL.has(w)||expected.filter(x=>x===w).length===heard.filter(x=>x===w).length);
   const meaningful=required.length?recognized/required.length:0;
   const missing=expected.length-a.matched,extra=heard.length-a.matched;
   const inOrder=(()=>{let next=0;for(const token of expected){let found=-1;for(let j=next;j<heard.length;j++)if(compatible(token,heard[j])){found=j;break}if(found<0)return false;next=found+1;}return true})();
   if(criticalSafe&&meaningful>=0.75&&a.matched>=Math.max(1,expected.length-1)){
    if(mode==='word'){
     // Never pass a two-word phrase on just one of its content words.
     if(expected.length>1&&(!inOrder||recognized<required.length)){score=0;}
     else if(extra===0&&missing===0&&a.changed<=1){score=3;reason='minor_form';}
     else if(extra<=3&&missing<=1){score=2;reason='recognizable_phrase';}
     else if(extra===0&&missing===1&&expected.length>=3){score=2;reason='one_word_missing';}
    }else{
     // For sentence practice, restrict partial passes to small, recognizable
     // differences; avoid accepting meaning-changing substitutions.
     const preservedOrder=(()=>{
      let next=0;
      for(const w of expected){let found=-1;for(let j=next;j<heard.length;j++)if(compatible(w,heard[j])){found=j;break}
       if(found>=0)next=found+1;else if(!LIGHT.has(w))return false;
      }return true;
     })();
     const coverage=orderedCoverage(expected,heard);
     const ratio=coverage/expected.length;
     const missed=expected.length-coverage;
     const additions=heard.length-coverage;
     const missedContent=required.filter(w=>!heard.some(h=>compatible(w,h))).length;
     const oppositePairs=[['left','right'],['up','down'],['before','after'],['first','last'],['yes','no']];
     const contradictory=oppositePairs.some(([a,b])=>
       (expected.includes(a)&&heard.includes(b)&&!expected.includes(b))||
       (expected.includes(b)&&heard.includes(a)&&!expected.includes(a)));
     if(!contradictory&&ratio>=0.9&&missed<=1&&additions<=1&&missedContent===0){
       score=3;reason='high_sentence_coverage';
     }else if(!contradictory&&ratio>=0.75&&missed<=Math.max(2,Math.ceil(expected.length*0.25))&&
       additions<=Math.max(2,Math.ceil(heard.length*0.25))&&missedContent<=1){
       score=2;reason='recognizable_sentence_coverage';
     }else if(!contradictory&&preservedOrder&&missing<=1&&extra<=2&&meaningful===1){
       score=2;reason='minor_sentence_difference';
     }
    }
   }
  }
  if(score>best.points)best=result(score,raw,reason);
  if(score===4)break;
 }
 return best;
}
export function speakingStars(qualityPercent){
 const p=Number(qualityPercent)||0;
 return p>=100?5:p>=85?4:p>=70?3:p>=55?2:p>=40?1:0;
}
