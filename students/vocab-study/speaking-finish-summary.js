// A transcript-based speaking practice score, not an acoustic diagnosis.
// Completed words receive 4/3/2; an unsuccessful microphone/answer attempt
// reduces the *displayed* quality score by half a point, never mastery.
// No extra points are awarded or deducted from the canonical point balance.
const keyOf=row=>String(row?.lexicalEntryId||row?.word||'').trim().toLowerCase();
export function summarizeSpeakingSession(session){
  const original=Math.max(0,Number(session?.initialTotal)||0);
  const resultRows=Array.isArray(session?.results)?session.results:[];
  const items=new Map();
  for(const row of resultRows){
    const key=keyOf(row);
    if(!key)continue;
    if(!items.has(key))items.set(key,{word:String(row.word||''),points:0,retries:0,passed:false,skipped:false});
    const item=items.get(key);
    if(row.word)item.word=String(row.word);
    if(row.skipped){item.skipped=true;continue}
    if(row.correct){
      item.passed=true;
      item.points=Math.max(item.points,Math.max(2,Math.min(4,Number(row.gradePoints)||4)));
    }else item.retries++;
  }
  const total=original||items.size;
  const records=[...items.values()];
  const passed=records.filter(x=>x.passed).length;
  const retryCount=records.reduce((n,x)=>n+x.retries,0);
  const partialCount=records.filter(x=>x.passed&&x.points<4).length;
  const scorePoints=records.reduce((n,x)=>n+(x.passed?x.points:0),0);
  const score=total?Math.max(0,Math.min(100,Math.round((scorePoints-0.5*retryCount)*100/(4*total)))):0;
  // Prefer words with repeated failures, then lower passing grade.
  const tricky=records.filter(x=>x.word&&(x.retries>0||x.points<4||x.skipped))
    .sort((a,b)=>(a.points-0.5*a.retries)-(b.points-0.5*b.retries)||b.retries-a.retries);
  return {total,passed,score,partialCount,retryCount,
    hardestWord:tricky[0]?.word||null,
    hardestWordRetries:tricky[0]?.retries||0,
    hardestWordPoints:tricky[0]?.points??null};
}
