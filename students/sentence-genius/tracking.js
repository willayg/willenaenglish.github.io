// No new credential paths or direct student-attempt queries.
// The existing study-progress recorder owns session identity, queueing, and upload.
export const SKILL_NAMES={coach:'sentence_coach',unscramble:'sentence_unscramble',speaking:'sentence_speaking'};
// The operational database's existing per-student mastery reader returns
// server-backed evidence. It is authenticated by the same Cloudflare gateway
// as Word Genius, not by a public anonymous DB query.
export async function getSentenceMastery(bookId,unitId){
  const reader=window.WillenaStudyProgress?.getContentMastery;
  if(typeof reader!=='function')throw Error('Study mastery reader unavailable');
  const data=await reader(bookId,unitId);
  if(!data?.success||!Array.isArray(data.items))throw Error('Study mastery response incomplete');
  return data.items.filter(item=>item.content_type==='sentence'
    && Object.values(SKILL_NAMES).includes(String(item.skill))
    && String(item.book_id)===String(bookId)
    && String(item.unit_id)===String(unitId))
    .map(item=>({mode:Object.keys(SKILL_NAMES).find(mode=>SKILL_NAMES[mode]===item.skill),
      id:String(item.content_id),passed:Number(item.accuracy)>0,attempts:Number(item.attempts)||0}));
}
export function recordSentenceAttempt({book,unit,item,mode,response,correct,retryCount,points,assisted=false,almostRight=false,matchedBy='unmatched',source='browser',elapsedMs=0}){
  const recorder=window.WillenaStudyProgress;
  if(typeof recorder?.record!=='function')throw Error('Canonical study recorder did not load');
  const activity={
    id:'sentence-genius-'+mode+'-'+item.id,
    skill:SKILL_NAMES[mode],
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
      sentence_genius_verdict:assisted?'assisted_correct':
        almostRight?'almost_right':correct?'mastered':'incorrect',
      listen_used:!!assisted,
      almost_right:!!almostRight,
      grading_match_method:String(matchedBy||'unmatched').slice(0,80),
      sentence_genius_policy_version:Number(item.gradingContext?.policyVersion)||0,
      stt_source:mode==='unscramble'?null:source,
      recorded_from:'sentence-genius'
    }
  };
  return recorder.record({
    activity,
    result:{selected:response,answer:item.en,correct:!!correct,score:correct?1:0},
    responseTimeMs:Math.max(0,elapsedMs),
    retryCount:Math.max(0,retryCount),
    hintsUsed:assisted?1:0,
    attemptNumber:Math.max(1,retryCount+1),
    sessionSource:'student'
  });
}
