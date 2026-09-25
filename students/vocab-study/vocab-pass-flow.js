export function coachAttempt({correct,supportLevel=0}={}){
  const assisted=Number(supportLevel)>0;
  return{
    assisted,
    passed:!!correct&&!assisted,
    repeat:!!correct&&assisted
  };
}

export function repeatUntilCorrect(correct){
  return !correct;
}

export function appendRetry(queue,word){
  if(!Array.isArray(queue)||!word)return;
  queue.push(Object.assign({},word,{__vocabRepeat:true}));
}

export function uniquePassedCount(results){
  const ids=new Set();
  (Array.isArray(results)?results:[]).forEach(result=>{
    if(!result?.correct)return;
    const id=String(result.lexicalEntryId||result.word||'').trim();
    if(id)ids.add(id);
  });
  return ids.size;
}

export function wrongAttemptCount(results){
  return (Array.isArray(results)?results:[]).filter(result=>result&&!result.correct).length;
}
