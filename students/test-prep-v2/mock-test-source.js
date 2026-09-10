import {resolveContentIds,loadStoredSkill,loadStoredWritten} from './content-source.js?v=2.24.1';
import {loadVocabularyTest} from './vocab-test-source.js?v=2.14.0';
import {FORMS} from './question-model.js';

export const MOCK_TEST_BLUEPRINT=Object.freeze({
  vocabulary:4,
  communication:6,
  grammar:6,
  reading:6,
  constructed_response:3
});

export const MOCK_TEST_TOTAL=25;
export const MOCK_TEST_MINUTES=45;

const OBJECTIVE_BUCKETS=['vocabulary','communication','grammar','reading'];
const LABELS={
  vocabulary:'어휘',
  communication:'대화',
  grammar:'문법',
  reading:'독해',
  constructed_response:'서술형'
};

const text=v=>String(v??'').trim();
const canonicalId=q=>text(q?.tracking?.questionId||q?.masteryKey||q?.id);
const objectiveQuestion=q=>q?.form===FORMS.choice||q?.form===FORMS.multi;

function hash32(value){
  let h=2166136261;
  for(const ch of String(value||'')){h=Math.imul(h^ch.charCodeAt(0),16777619)}
  return h>>>0;
}
function seededRank(seed,key){return hash32(`${seed}|${key}`)}
function stableShuffle(items,seed){
  return [...items].sort((a,b)=>{
    const ak=`${a.bucket}|${a.lesson}|${canonicalId(a.question)}`;
    const bk=`${b.bucket}|${b.lesson}|${canonicalId(b.question)}`;
    const d=seededRank(seed,ak)-seededRank(seed,bk);
    return d||ak.localeCompare(bk);
  });
}
function uniqueEntries(items){
  const seen=new Set();
  return (items||[]).filter(entry=>{
    const id=canonicalId(entry.question);
    if(!id||seen.has(id))return false;
    seen.add(id);return true;
  });
}
function scopeRows(plan){
  const scope=plan?.group?.scope||{};
  const lessons=Array.isArray(scope.lessons)?scope.lessons.filter(x=>x?.lesson):[];
  const external=Array.isArray(scope.external_passages)?scope.external_passages.map(x=>({...x,lesson:x?.lesson||x?.label||x?.unit_label||''})).filter(x=>x.lesson):[];
  if(lessons.length||external.length)return[...lessons,...external];
  return (plan?.units||[]).map(lesson=>({lesson,sections:plan?.practice_types||[]}));
}
function rowSections(plan,row){
  const source=Array.isArray(row?.sections)&&row.sections.length?row.sections:(plan?.practice_types||[]);
  const sections=new Set(source.map(x=>text(x).toLowerCase()).filter(Boolean));
  if(sections.has('vocabulary'))sections.add('vocab_test');
  return sections;
}
function entry(bucket,lesson,unitId,question){return{bucket,lesson:String(lesson),unitId:String(unitId),question}}

async function loadRowPools(plan,row){
  const lesson=text(row?.lesson);if(!lesson)return[];
  const sections=rowSections(plan,row);
  const ids=await resolveContentIds(plan,lesson);
  const unitId=ids?.unitId;if(!unitId)return[];
  const jobs=[];
  if(sections.has('vocabulary')||sections.has('vocab_test'))jobs.push(
    loadVocabularyTest(unitId,{count:60}).then(qs=>qs.filter(objectiveQuestion).map(q=>entry('vocabulary',lesson,unitId,q)))
  );
  if(sections.has('communication'))jobs.push(loadStoredSkill(unitId,'communication').then(qs=>qs.map(q=>entry('communication',lesson,unitId,q))));
  if(sections.has('grammar'))jobs.push(loadStoredSkill(unitId,'grammar').then(qs=>qs.map(q=>entry('grammar',lesson,unitId,q))));
  if(sections.has('reading'))jobs.push(loadStoredSkill(unitId,'reading').then(qs=>qs.map(q=>entry('reading',lesson,unitId,q))));
  if(sections.has('constructed_response'))jobs.push(loadStoredWritten(unitId).then(qs=>qs.map(q=>entry('constructed_response',lesson,unitId,q))));
  const groups=await Promise.all(jobs);return groups.flat();
}

function countsByBucket(entries){
  const out={vocabulary:0,communication:0,grammar:0,reading:0,constructed_response:0};
  for(const e of entries||[])if(Object.hasOwn(out,e.bucket))out[e.bucket]++;
  return out;
}

export async function buildMockTestPaper({plan,studentId=null,seed=null}={}){
  if(!plan?.id)throw new Error('MOCK_TEST_PLAN_REQUIRED');
  const paperSeed=text(seed)||`${plan.id}|${studentId||'anon'}|${Date.now()}`;
  const rows=scopeRows(plan);
  if(!rows.length)throw new Error('시험 범위가 없습니다.');

  const settled=await Promise.allSettled(rows.map(row=>loadRowPools(plan,row)));
  const loadErrors=[];let loaded=[];
  settled.forEach((result,index)=>{
    if(result.status==='fulfilled')loaded.push(...result.value);
    else loadErrors.push({lesson:text(rows[index]?.lesson),message:result.reason?.message||String(result.reason||'load failed')});
  });
  loaded=uniqueEntries(loaded);

  const pools={vocabulary:[],communication:[],grammar:[],reading:[],constructed_response:[]};
  for(const e of loaded)if(pools[e.bucket])pools[e.bucket].push(e);
  for(const key of Object.keys(pools))pools[key]=stableShuffle(uniqueEntries(pools[key]),`${paperSeed}|${key}`);

  const selected=[];const used=new Set();const shortage={};
  const take=(bucket,count,{fallbackFor=null}={})=>{
    let n=0;
    for(const e of pools[bucket]){
      const id=canonicalId(e.question);if(!id||used.has(id))continue;
      selected.push({...e,slot:fallbackFor||bucket});used.add(id);n++;
      if(n>=count)break;
    }
    return n;
  };

  for(const bucket of OBJECTIVE_BUCKETS){
    const wanted=MOCK_TEST_BLUEPRINT[bucket],got=take(bucket,wanted);
    if(got<wanted)shortage[bucket]=wanted-got;
  }

  const writtenWanted=MOCK_TEST_BLUEPRINT.constructed_response;
  const writtenGot=take('constructed_response',writtenWanted);
  let writtenFallbackNeeded=Math.max(0,writtenWanted-writtenGot),writtenFallbackUsed=0;
  if(writtenFallbackNeeded){
    const leftovers=stableShuffle(
      OBJECTIVE_BUCKETS.flatMap(bucket=>pools[bucket].filter(e=>!used.has(canonicalId(e.question)))),
      `${paperSeed}|written-fallback`
    );
    for(const e of leftovers){
      const id=canonicalId(e.question);if(!id||used.has(id))continue;
      selected.push({...e,slot:'constructed_response_fallback'});used.add(id);writtenFallbackUsed++;
      if(writtenFallbackUsed>=writtenFallbackNeeded)break;
    }
  }

  const objectiveShortage=Object.values(shortage).reduce((a,b)=>a+b,0);
  const unresolvedWritten=Math.max(0,writtenFallbackNeeded-writtenFallbackUsed);
  const ready=selected.length===MOCK_TEST_TOTAL&&objectiveShortage===0&&unresolvedWritten===0;
  const mixed=stableShuffle(selected,`${paperSeed}|final-order`).map((e,index)=>({...e,number:index+1}));
  const availability=Object.fromEntries(Object.entries(pools).map(([k,v])=>[k,v.length]));
  const selectedCounts=countsByBucket(mixed);

  return{
    version:'1.0.0',
    seed:paperSeed,
    planId:String(plan.id),
    total:mixed.length,
    ready,
    questions:mixed,
    blueprint:{...MOCK_TEST_BLUEPRINT},
    availability,
    selectedCounts,
    writtenFallback:{needed:writtenFallbackNeeded,used:writtenFallbackUsed},
    shortages:{...shortage,...(unresolvedWritten?{constructed_response_fallback:unresolvedWritten}:{})},
    loadErrors,
    labels:{...LABELS}
  };
}
