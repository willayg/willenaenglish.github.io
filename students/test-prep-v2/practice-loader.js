// Canonical practice loader/orchestrator for Test Prep v2.
// Owns practice-type content selection and ordinary question sequencing.
import {loadStoredSkill,loadStoredWritten} from './content-source.js?v=2.24.0';
import {loadVocabularyTest} from './vocab-test-source.js?v=2.14.0';
import {buildQuestionQueue} from '../shared/question-sequencer.js?v=1.0.0';

export async function loadPracticeContent({
  kind,
  practice,
  unitId,
  studentId=null,
  planId=null,
  lesson=null,
  count=20
}){
  if(kind==='vocab-learning'||kind==='passage-learning'){
    return {mode:'workflow',kind,unitId};
  }

  let pool;
  if(kind==='vocab-test')pool=await loadVocabularyTest(unitId,{count:1000});
  else if(kind==='written')pool=await loadStoredWritten(unitId);
  else pool=await loadStoredSkill(unitId,practice);

  if(!Array.isArray(pool)||!pool.length)return {mode:'questions',pool:[],rawCount:0};
  const rawCount=pool.length;
  const queue=await buildQuestionQueue(pool,{studentId,planId,lesson,practiceType:practice,count});
  return {mode:'questions',pool:Array.isArray(queue)?queue:[],rawCount};
}
