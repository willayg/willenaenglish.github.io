// Draft readiness is the same in the editor and the Pages review endpoint.
export const MAX_WRITING_CHARS=12000;
export const MAX_WRITING_LINES=30;
const LEGACY_CUTOFF=Date.parse('2026-11-29T00:00:00.000Z');
export const writingGoal=kind=>kind==='topic'?50:35;
const englishWords=text=>String(text||'').match(/[A-Za-z]+(?:['’\-][A-Za-z]+)*/g)||[];
export const writingWordCount=text=>englishWords(text).length;
export function splitWritingSentences(value){
 const text=String(value||'').replace(/\r\n?/g,'\n');
 const out=[];let start=0;
 const emit=end=>{const line=text.slice(start,end).trim();if(/[a-z]/i.test(line))out.push(line)};
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='\n'){emit(i);start=i+1;continue}
  if(!'.!?'.includes(ch))continue;
  if(ch==='.'&&/\d/.test(text[i-1]||'')&&/\d/.test(text[i+1]||''))continue;
  let end=i+1;
  while(end<text.length&&/[.!?]/.test(text[end]))end++;
  while(end<text.length&&/["'”’)\]]/.test(text[end]))end++;
  if(end<text.length&&!/\s/.test(text[end]))continue;
  if(ch==='.'&&end===i+1){
   const tail=text.slice(start,i+1);
   const following=text.slice(end).match(/^[ \t]+([A-Za-z])/);
   if(following&&(/\b(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr)\.$/i.test(tail)||/\b[A-Z]\.$/.test(tail)))continue;
   if(following&&/[a-z]/.test(following[1])&&/\b(?:a\.m|p\.m|e\.g|i\.e|etc)\.$/i.test(tail))continue;
  }
  emit(end);start=end;i=end-1;
 }
 emit(text.length);return out;
}

export function writingReadiness(entry,value=entry?.body){
 const text=String(value||'');
 const count=writingWordCount(text),goal=writingGoal(entry?.kind),lines=splitWritingSentences(text);
 const created=Date.parse(entry?.created_at||'');
 // Preserve drafts that already qualified under the old rule before release.
 const legacy=Number.isFinite(created)&&created<LEGACY_CUTOFF&&lines.length>=(entry?.kind==='topic'?8:6);
 const tooLong=text.length>MAX_WRITING_CHARS||lines.length>MAX_WRITING_LINES;
 return {count,goal,lines,legacy,tooLong,ready:!tooLong&&(count>=goal||legacy)};
}
export function writingReadinessError(state){
 return state.tooLong?'글이 너무 길어요. 내용을 조금 줄여 주세요.':('영어 단어를 '+state.goal+'개 이상 써 주세요. 현재 '+state.count+'개예요.');
}

// A missing full stop should never make a whole paragraph a single typing or
// recording target. Preserve the exact text; prefer obvious clause breaks.
export function writingPracticeLines(text){
 return splitWritingSentences(text).flatMap(line=>{
  const tokens=line.split(/\s+/);
  if(tokens.length<=24)return [line];
  const chunks=[];
  const clauseStart=/^(?:I|you|we|they|he|she|it|then|afterward[s]?|finally|next|later)$/i;
  let i=0;
  while(tokens.length-i>24){
   let at=i+16;
   for(let j=i+11;j<=i+20;j++){
    if(clauseStart.test(tokens[j])&&!/^(?:and|or|because|but|so)$/i.test(tokens[j-1])){at=j;break}
    if(/[,;:]$/.test(tokens[j-1])){at=j;break}
   }
   chunks.push(tokens.slice(i,at).join(' '));i=at;
  }
  return [...chunks,tokens.slice(i).join(' ')];
 });
}
