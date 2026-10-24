// No new credential paths or direct student-attempt queries.
// The existing study-progress recorder owns session identity, queueing, and upload.
export function recordSentenceAttempt({book,unit,item,mode,response,correct,retryCount,points,source='browser',elapsedMs=0}){
  const recorder=window.WillenaStudyProgress;
  if(typeof recorder?.record!=='function')throw Error('Canonical study recorder did not load');
  const activity={
    id:'sentence-genius-'+mode+'-'+item.id,
    skill:mode==='speaking'||mode==='coach'?'speaking':'grammar',
    sourceType:'sentence',
    sourceId:item.id,
    stimulus:{type:'text',prompt:item.ko},
    response:{type:mode==='unscramble'?'order':'speech'},
    answer:item.en,
    metadata:{
      sentence_genius:true,sentence_genius_mode:mode,
      book_id:book.id,unit_id:unit.id,
      occurrence_id:item.occurrenceId,
      mastery_content_type:'sentence',mastery_content_id:item.id,
      points_override:points,
      stt_source:mode==='unscramble'?null:source,
      recorded_from:'sentence-genius'
    }
  };
  return recorder.record({
    activity,
    result:{selected:response,answer:item.en,correct:!!correct,score:correct?1:0},
    responseTimeMs:Math.max(0,elapsedMs),
    retryCount:Math.max(0,retryCount),
    attemptNumber:Math.max(1,retryCount+1),
    sessionSource:'student'
  });
}
