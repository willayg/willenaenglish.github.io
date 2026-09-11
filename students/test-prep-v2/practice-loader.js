// Canonical practice loader/orchestrator for Test Prep v2.
// Owns practice-type content selection and ordinary question sequencing.
import {loadStoredSkill,loadStoredWritten} from './content-source.js?v=2.24.0';
import {loadVocabularyTest} from './vocab-test-source.js?v=2.14.0';
import {buildQuestionQueue} from '../shared/question-sequencer.js?v=1.0.0';
import {loadActivitySnapshot,saveActivityQueue} from './activity-session-store.js?v=3.0.0';

export async function loadPracticeContent({
  kind,
  practice,
  unitId,
  studentId=null,
  planId=null,
  lesson=null,
  count=20
}){
  if(kind==='vocab-learning'){
    return {mode:'workflow',kind,unitId};
  }

  const route={view:'practice',planId,lesson,practice};
  const saved=loadActivitySnapshot(route);
  if(saved?.queue?.length)return {mode:'questions',pool:saved.queue,rawCount:saved.queue.length,resumed:true};

  let pool;
  if(kind==='vocab-test')pool=await loadVocabularyTest(unitId,{count:1000});
  else if(kind==='written')pool=await loadStoredWritten(unitId);
  else pool=await loadStoredSkill(unitId,practice);

  if(!Array.isArray(pool)||!pool.length)return {mode:'questions',pool:[],rawCount:0};
  const rawCount=pool.length;
  const queue=await buildQuestionQueue(pool,{studentId,planId,lesson,practiceType:practice,count});
  const selected=Array.isArray(queue)?queue:[];
  if(selected.length)saveActivityQueue(route,selected);
  return {mode:'questions',pool:selected,rawCount};
}
