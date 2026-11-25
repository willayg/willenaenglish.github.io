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
  const retryCount=Math.max(0,Number(word.__vocabRetryCount)||0)+1;
  queue.push(Object.assign({},word,{__vocabRepeat:true,__vocabRetryCount:retryCount}));
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

/**
 * Shared missed-only retry tracker for Word/Grammar-style question rounds.
 * Correct answers are never requeued. A wrong answer reappears at most once
 * in the next retry round; a second mistake remains eligible for the next.
 */
export function createMissedOnlyRetry({idOf=item=>item?.id}={}){
  const missed=new Map();
  let round=[];
  return {
    begin(items){round=[...(items||[])];missed.clear();return [...round];},
    record(item,correct){
      if(!item)return;
      const key=String(idOf(item)??'');
      if(!key)return;
      if(correct)missed.delete(key);
      else missed.set(key,item);
    },
    get pendingCount(){return missed.size;},
    get pending(){return [...missed.values()];},
    retry(){
      round=[...missed.values()];
      missed.clear();
      return [...round];
    },
    reset(){round=[];missed.clear();}
  };
}
