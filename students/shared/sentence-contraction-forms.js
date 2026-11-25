// Expand contractions as alternative spoken readings, without an AI call.
// Ambiguous 's / 'd depend on following-word grammar; do not accept "he's to"
// as "he has to".
const SIMPLE={
 "i'm":"i am","you're":"you are","we're":"we are","they're":"they are",
 "i've":"i have","you've":"you have","we've":"we have","they've":"they have",
 "i'll":"i will","you'll":"you will","he'll":"he will","she'll":"she will",
 "it'll":"it will","we'll":"we will","they'll":"they will","that'll":"that will",
 "don't":"do not","doesn't":"does not","didn't":"did not","can't":"cannot",
 "won't":"will not","shan't":"shall not","isn't":"is not","aren't":"are not",
 "wasn't":"was not","weren't":"were not","hasn't":"has not","haven't":"have not",
 "hadn't":"had not","wouldn't":"would not","couldn't":"could not",
 "shouldn't":"should not","mustn't":"must not","needn't":"need not",
 "mightn't":"might not","could've":"could have","would've":"would have",
 "should've":"should have","might've":"might have","must've":"must have",
 "may've":"may have","who've":"who have","what've":"what have",
 "where've":"where have","let's":"let us","y'all":"you all",
 "what're":"what are","who're":"who are","where're":"where are","how're":"how are",
 "there're":"there are","that's":"that is",
 "couldn't've":"could not have","wouldn't've":"would not have","shouldn't've":"should not have",
 "mightn't've":"might not have","mustn't've":"must not have",
 "gonna":"going to","wanna":"want to"
};
const PAST=new Set(['been','gone','done','had','got','gotten','seen','known',
 'taken','given','written','eaten','drunk','spoken','broken','chosen','driven',
 'ridden','fallen','forgotten','grown','thrown','shown','worn','won','lost',
 'left','found','made','built','bought','brought','thought','caught','taught',
 'read','said','heard','felt','kept','slept','met','paid','sent','sold']);
const PAST_LIKE=w=>PAST.has(w)||w.endsWith('ed');
const IS_HAS=new Set(["he's","she's","it's","that's","what's","who's",
 "where's","there's","here's","how's"]);
const WOULD_HAD=new Set(["i'd","you'd","he'd","she'd","it'd","we'd","they'd"]);
export function sentenceContractionForms(value){
 const raw=String(value||'').toLowerCase().normalize('NFKC').replace(/[’‘]/g,"'")
  .replace(/[—–-]/g,' ').replace(/[^a-z0-9' ]/g,' ').trim();
 const parts=raw.split(' ').filter(Boolean);
 let forms=[''];
 for(let i=0;i<parts.length;i++){
  const w=parts[i],next=parts[i+1]||'';
  let readings=[SIMPLE[w]||w];
  if(IS_HAS.has(w)){
   const subject=w.slice(0,-2);
   readings=[subject+' is'];
   if(next==='been'||next==='got'||PAST_LIKE(next))readings.push(subject+' has');
  }else if(WOULD_HAD.has(w)){
   const subject=w.slice(0,-2);
   readings=[subject+' would'];
   if(next==='better'||PAST_LIKE(next))readings.push(subject+' had');
  }
  forms=forms.flatMap(before=>readings.map(reading=>(before+' '+reading).trim())).slice(0,32);
 }
 return [...new Set(forms)];
}
