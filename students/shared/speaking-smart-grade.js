import {sentenceContractionForms} from '/students/shared/sentence-contraction-forms.js?v=20261112-context2';
// Deterministic speaking-only evaluator. Never use for typed spelling or grammar.
// Grade the STT transcript, not acoustic pronunciation; 4/3/2/1 are confidence tiers.
// A missing or unrelated transcript is a retry (0).
const CONTRACTIONS={"i'm":"i am","you're":"you are","we're":"we are","they're":"they are","he's":"he is","she's":"she is","it's":"it is","don't":"do not","doesn't":"does not","didn't":"did not","can't":"cannot","won't":"will not","isn't":"is not","aren't":"are not","wasn't":"was not","weren't":"were not","i've":"i have","we've":"we have","they've":"they have","i'll":"i will","you'll":"you will","we'll":"we will","they'll":"they will"};
const ARTICLES=new Set(['a','an','the']);
const LIGHT=new Set(['a','an','the','is','are','am','to','of','in','on','at','for','and']);
const CRITICAL=new Set(['not','never','no','cannot','can','will','would','should','must','before','after','more','less','first','last','one','two','three','four','five','six','seven','eight','nine','ten']);
const PAIRS=[['to','too','two'],['there','their',"they're"],['by','buy','bye'],['see','sea'],['right','write'],['flower','flour'],['one','won'],['four','for'],['night','knight'],['wear','where'],['hear','here']];
function tokens(value,mode='word'){
 let s=String(value||'').toLowerCase().normalize('NFKC').replace(/[’‘]/g,"'").replace(/[—–-]/g,' ');
 s=s.replace(/\b(?:i'm|you're|we're|they're|he's|she's|it's|don't|doesn't|didn't|can't|won't|isn't|aren't|wasn't|weren't|i've|we've|they've|i'll|you'll|we'll|they'll)\b/g,w=>CONTRACTIONS[w]||w);
 s=s.replace(/[^a-z0-9' ]/g,' ').trim().replace(/\s+/g,' ');
 if(mode==='sentence'){
  const numbers={zero:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10',eleven:'11',twelve:'12',thirteen:'13',fourteen:'14',fifteen:'15',sixteen:'16',seventeen:'17',eighteen:'18',nineteen:'19',twenty:'20'};
  s=s.split(' ').map(w=>numbers[w]||w).join(' ');
  s=s.replace(/\bmom\b/g,'mother').replace(/\bdad\b/g,'father');
  s=s.replace(/\b([0-9]{1,3})\s+years?\s+old\b/g,'$1');
 }
 return s.split(/\s+/).filter(Boolean);
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
// A long target word may be split by browser STT into short fragments:
// "creative" -> "create TV". Grant low-confidence partial credit when
// a substantial prefix survives, never for a tiny arbitrary substring.
function commonPrefixLength(a,b){
 let n=0;while(n<a.length&&n<b.length&&a[n]===b[n])n++;return n;
}
function fragmentedWordGrade(expected,heard){
 if(expected.length!==1||heard.length<1||heard.length>3)return 0;
 const target=expected[0];
 if(target.length<6||!heard.every(w=>/^[a-z]+$/.test(w)))return 0;
 const first=heard[0];
 const prefix=commonPrefixLength(target,first);
 if(prefix<Math.max(4,Math.ceil(target.length*0.55)))return 0;
 if(heard.length===1)return Math.abs(target.length-first.length)<=3?2:1;
 if(heard.slice(1).some(w=>w.length>4))return 0;
 return 1;
}
const result=(points,transcript,reason)=>({points,correct:points>=1,level:points===4?'green':points===3?'lime':points===2?'yellow':points===1?'orange':'red',transcript,matchedBy:reason});
export function gradeSpeaking(target,alternatives,{mode='word',exactMatcher=null}={}){
 const expectedForms=(mode==='sentence'?sentenceContractionForms(target):[target]).map(v=>tokens(v,mode));
 const heardList=(Array.isArray(alternatives)?alternatives:[alternatives]).map(String).map(s=>s.trim()).filter(Boolean).slice(0,5);
 if(!expectedForms[0]?.length||!heardList.length)return result(0,heardList[0]||'','no_speech');
 let best=result(0,heardList[0],'unrecognized');
 for(const raw of heardList){
  const heardForms=(mode==='sentence'?sentenceContractionForms(raw):[raw]).map(v=>tokens(v,mode));
  for(const expected of expectedForms)for(const heard of heardForms){
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
   // A dropped sequence marker can earn yellow when the other words are clear;
   // an opposite marker (first -> last) remains protected below.
   const criticalSafe=[...new Set([...expected,...heard])].every(w=>['first','last'].includes(w)||(!CRITICAL.has(w)&&!/^\d+$/.test(w))||expected.filter(x=>x===w).length===heard.filter(x=>x===w).length);
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
     const oppositePairs=[['left','right'],['up','down'],['before','after'],['first','last'],['yes','no'],['mother','father']];
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
  // A single ordinary word substitution in an otherwise correctly ordered
  // sentence earns lime. Keep age, negation and direction changes on the
  // existing lower-credit path.
  if(mode==='sentence'&&score<3&&expected.length>=5&&expected.length===heard.length){
    const differences=expected.map((w,i)=>compatible(w,heard[i])?null:i).filter(i=>i!==null);
    if(differences.length===1){
      const i=differences[0],from=expected[i],to=heard[i];
      const protectedWord=w=>CRITICAL.has(w)||/^[0-9]+$/.test(w);
      const opposites=[['left','right'],['up','down'],['before','after'],['first','last'],['yes','no'],['mother','father']];
      const reversed=opposites.some(([a,b])=>(from===a&&to===b)||(from===b&&to===a));
      if(!protectedWord(from)&&!protectedWord(to)&&!reversed){
        score=3;reason='one_word_substitution';
      }
    }
  }
  // Sentence practice is progressive: ordered recognition earns partial
  // credit even when an age, detail, or the last phrase is absent/wrong.
  // Use both recall and precision so random long speech cannot pass.
  // Never promote a meaning-changing response to lime/green here.
  if(mode==='sentence'&&expected.length>=5&&score<3){
    const matched=orderedCoverage(expected,heard);
    const recall=matched/expected.length;
    const precision=matched/heard.length;
    const opposites=[['left','right'],['up','down'],['before','after'],['first','last'],['yes','no'],['mother','father']];
    const reversed=opposites.some(([a,b])=>
      (expected.includes(a)&&heard.includes(b)&&!expected.includes(b))||
      (expected.includes(b)&&heard.includes(a)&&!expected.includes(a)));
    const negation=['not','never','no','cannot'];
    const negationChanged=negation.some(w=>expected.includes(w)!==heard.includes(w));
    const numerals=w=>/^\\d+$/.test(w)||['one','two','three','four','five','six','seven','eight','nine','ten'].includes(w);
    const expectedNums=expected.filter(numerals),heardNums=heard.filter(numerals);
    const wrongNumber=(expectedNums.length||heardNums.length)&&expectedNums.join('|')!==heardNums.join('|');
    if(!reversed&&!negationChanged&&precision>=0.7){
      if(recall>=0.70) {score=Math.max(score,2);reason=wrongNumber?'ordered_coverage_wrong_detail':'ordered_coverage_yellow';}
      else if(recall>0.50){score=Math.max(score,1);reason='ordered_coverage_orange';}
    }
  }
  // Two-word vocabulary targets: recognizing one substantial target word
  // is worth orange, even if the browser mishears the other word.
  // Do not count articles, short function words, or unrelated speech.
  if(mode==='word'&&score===0&&expected.length===2){
    const substantive=expected.filter(w=>!LIGHT.has(w)&&w.length>=3);
    const matched=substantive.filter(w=>heard.some(h=>compatible(w,h)));
    if(matched.length===1&&heard.length<=4){
      score=1;reason='one_content_word_of_two';
    }
  }
  if(mode==='word'&&score===0){
    const partial=fragmentedWordGrade(expected,heard);
    if(partial){score=partial;reason=partial===2?'recognizable_word_stem':'fragmented_word_sound';}
  }
  // Low-credit pass: strictly more than half the expected words detected
  // in their original order. Guard negation, directions and numeric changes.
  // Word Genius keeps its independent vocabulary rules.
  if(mode==='sentence'&&score===0&&expected.length>=5){
    const coverage=orderedCoverage(expected,heard);
    const oppositePairs=[['left','right'],['up','down'],['before','after'],['first','last'],['yes','no'],['mother','father']];
    const contradictory=oppositePairs.some(([a,b])=>
      (expected.includes(a)&&heard.includes(b)&&!expected.includes(b))||
      (expected.includes(b)&&heard.includes(a)&&!expected.includes(a)));
    const protectedWords=[...new Set([...expected,...heard])].filter(w=>(CRITICAL.has(w)||/^\d+$/.test(w))&&w!=='first'&&w!=='last');
    const changedProtected=protectedWords.some(w=>expected.filter(x=>x===w).length!==heard.filter(x=>x===w).length);
    const important=expected.filter(w=>!LIGHT.has(w));
    const importantMatches=important.filter(w=>heard.some(h=>compatible(w,h))).length;
    // Require at least three meaningful matched tokens for long sentences.
    if(coverage/expected.length>0.5&&importantMatches>=Math.min(3,important.length)&&
       !contradictory&&!changedProtected){
      score=1;reason='partial_sentence_coverage';
    }
  }
  if(score>best.points)best=result(score,raw,reason);
  if(score===4)return best;
  }
 }
 return best;
}
export function speakingStars(qualityPercent){
 const p=Number(qualityPercent)||0;
 return p>=100?5:p>=85?4:p>=70?3:p>=55?2:p>=40?1:0;
}
