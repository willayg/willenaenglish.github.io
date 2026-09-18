// Canonical practice loader/orchestrator for Test Prep v2.
// Owns practice-type content selection and ordinary question sequencing.
import {loadStoredSkill,loadStoredWritten} from './content-source.js?v=2.24.0';
import {loadVocabularyTest} from './vocab-test-source.js?v=2.14.0';
import {buildQuestionQueue} from '../shared/question-sequencer.js?v=1.0.0';
import {loadActivitySnapshot,saveActivityQueue,clearActivitySnapshotFor} from './activity-session-store.js?v=4.0.0';

const OLIVIA_ID='70a422d5-9587-481e-9f05-4a3c3aeb96b1';

export function questionAllowedForStudent(question,studentId=null){
  if(String(studentId||'')!==OLIVIA_ID)return true;
  if(String(question?.source?.code||'').toUpperCase()!=='W')return true;
  const skill=String(question?.skill||question?.tracking?.practiceType||'').toLowerCase();
  if(skill==='reading'||skill==='grammar')return false;
  const meta=question?.metadata&&typeof question.metadata==='object'?question.metadata:{};
  const targets=Array.isArray(question?.tracking?.targets)?question.tracking.targets.map(x=>String(x).toLowerCase()):[];
  const shadow=!!meta.shadow_of||meta.olivia_targeted===true||meta.olivia_targeted==='true'||targets.includes('shadow_practice');
  const examStyle=meta.willena_exam_style_v2===true||meta.willena_exam_style_v2==='true';
  return !(shadow||examStyle);
}

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
  if(saved?.queue?.length){
    const filteredSaved=saved.queue.filter(q=>questionAllowedForStudent(q,studentId));
    if(filteredSaved.length===saved.queue.length)return {mode:'questions',pool:saved.queue,rawCount:saved.queue.length,resumed:true};
    clearActivitySnapshotFor(route);
  }

  let pool;
  if(kind==='vocab-test')pool=await loadVocabularyTest(unitId,{count:1000});
  else if(kind==='written')pool=await loadStoredWritten(unitId);
  else pool=await loadStoredSkill(unitId,practice);

  if(!Array.isArray(pool)||!pool.length)return {mode:'questions',pool:[],rawCount:0};
  pool=pool.filter(q=>questionAllowedForStudent(q,studentId));
  if(!pool.length)return {mode:'questions',pool:[],rawCount:0};
  const rawCount=pool.length;
  const queue=await buildQuestionQueue(pool,{studentId,planId,lesson,practiceType:practice,count});
  const selected=Array.isArray(queue)?queue:[];
  if(selected.length)saveActivityQueue(route,selected);
  return {mode:'questions',pool:selected,rawCount};
}
