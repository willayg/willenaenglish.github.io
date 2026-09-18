import {resolveContentIds,loadStoredSkill,loadStoredWritten} from './content-source.js?v=2.24.4';
import {loadVocabularyTest} from './vocab-test-source.js?v=2.14.0';

export const MOCK_TEST_BLUEPRINT=Object.freeze({
  vocabulary:4,
  communication:6,
  grammar:6,
  reading:6,
  constructed_response:3
});

export const MOCK_TEST_TOTAL=25;
export const MOCK_TEST_MINUTES=45;

const CORE_BUCKETS=['vocabulary','communication','grammar','reading'];
const SECTION_ORDER=[...CORE_BUCKETS,'constructed_response'];
const LABELS={vocabulary:'어휘',communication:'대화',grammar:'문법',reading:'독해',constructed_response:'서술형'};
const text=v=>String(v??'').trim();
const canonicalId=q=>text(q?.tracking?.questionId||q?.masteryKey||q?.id);
const questionType=q=>text(q?.tracking?.questionType||q?.metadata?.mode||q?.form||'unknown').toLowerCase();

function hash32(value){let h=2166136261;for(const ch of String(value||'')){h=Math.imul(h^ch.charCodeAt(0),16777619)}return h>>>0}
function seededRank(seed,key){return hash32(`${seed}|${key}`)}
function entryKey(e){return`${e?.bucket||''}|${e?.unitId||''}|${canonicalId(e?.question)}`}
function stableShuffle(items,seed){
  return [...items].sort((a,b)=>{
    const ak=entryKey(a),bk=entryKey(b),d=seededRank(seed,ak)-seededRank(seed,bk);
    return d||ak.localeCompare(bk);
  });
}
function uniqueEntries(items){
  const seen=new Set();
  return (items||[]).filter(e=>{const key=entryKey(e);if(!canonicalId(e?.question)||seen.has(key))return false;seen.add(key);return true});
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
  const lesson=text(row?.lesson);if(!lesson)return{entries:[],errors:[]};
  const sections=rowSections(plan,row),ids=await resolveContentIds(plan,lesson),unitId=ids?.unitId;
  if(!unitId)return{entries:[],errors:[]};
  const jobs=[];
  const add=(bucket,promise)=>jobs.push(Promise.resolve(promise).then(qs=>({entries:(qs||[]).map(q=>entry(bucket,lesson,unitId,q)),error:null})).catch(e=>({entries:[],error:{lesson,bucket,message:e?.message||String(e)}})));

  // IMPORTANT: these are the same canonical pools used by normal Test Prep practice.
  // Mock selection must not add its own QA/form restrictions on top of them.
  if(sections.has('vocabulary')||sections.has('vocab_test'))add('vocabulary',loadVocabularyTest(unitId,{count:1000}));
  if(sections.has('communication'))add('communication',loadStoredSkill(unitId,'communication'));
  if(sections.has('grammar'))add('grammar',loadStoredSkill(unitId,'grammar'));
  if(sections.has('reading'))add('reading',loadStoredSkill(unitId,'reading'));
  if(sections.has('constructed_response'))add('constructed_response',loadStoredWritten(unitId));

  const parts=await Promise.all(jobs);
  return{entries:parts.flatMap(x=>x.entries),errors:parts.map(x=>x.error).filter(Boolean)};
}

function vocabFamily(q){
  const type=questionType(q);
  if(type.includes('definition'))return'definition';
  if(type.includes('blank')||type.includes('context'))return'context';
  if(type.includes('relation'))return'relation';
  if(type.includes('meaning')||type.includes('ko_en'))return'meaning';
  if(type.includes('usage')||type.includes('replacement'))return'usage';
  return type||'other';
}
function passageKey(e){
  const q=e?.question||{},m=q?.metadata||{},c=q?.context||{},s=q?.source||{};
  const explicit=m.passage_id||m.passageId||m.source_passage_id||m.chunk_id||m.chunkId||c.passage_id||c.passageId||c.chunk_id||c.chunkId;
  if(explicit)return`id:${explicit}`;
  const body=c.passage||c.reading||c.article||c.text||c.source_text||c.dialogue||m.passage_text||m.source_text;
  if(text(body))return`text:${hash32(text(body))}`;
  if(s.sourceId)return`source:${s.sourceId}|page:${s.page||''}`;
  return`question:${canonicalId(q)}`;
}
function countsByBucket(entries){
  const out={vocabulary:0,communication:0,grammar:0,reading:0,constructed_response:0};
  for(const e of entries||[])if(Object.hasOwn(out,e.bucket))out[e.bucket]++;
  return out;
}
function orderedPaper(entries){return SECTION_ORDER.flatMap(bucket=>entries.filter(e=>e.bucket===bucket))}
function groupByUnit(entries){
  const groups=new Map();
  for(const e of entries||[]){const key=String(e.unitId);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e)}
  return groups;
}
function unitDiagnostics(pools,selected){
  const out={};
  for(const bucket of Object.keys(pools)){
    const available=groupByUnit(pools[bucket]),chosen=groupByUnit((selected||[]).filter(e=>e.bucket===bucket));
    out[bucket]=[...available.entries()].map(([unitId,items])=>({
      unitId,
      lesson:items[0]?.lesson||unitId,
      available:items.length,
      selected:(chosen.get(unitId)||[]).length
    }));
  }
  return out;
}

export async function buildMockTestPaper({plan,studentId=null,seed=null}={}){
  if(!plan?.id)throw new Error('MOCK_TEST_PLAN_REQUIRED');
  const paperSeed=text(seed)||`${plan.id}|${studentId||'anon'}|${Date.now()}`,rows=scopeRows(plan);
  if(!rows.length)throw new Error('시험 범위가 없습니다.');

  const settled=await Promise.allSettled(rows.map(row=>loadRowPools(plan,row))),loadErrors=[];let loaded=[];
  settled.forEach((result,index)=>{
    if(result.status==='fulfilled'){loaded.push(...result.value.entries);loadErrors.push(...result.value.errors)}
    else loadErrors.push({lesson:text(rows[index]?.lesson),bucket:'scope',message:result.reason?.message||String(result.reason||'load failed')});
  });
  loaded=uniqueEntries(loaded);

  const pools={vocabulary:[],communication:[],grammar:[],reading:[],constructed_response:[]};
  for(const e of loaded)if(pools[e.bucket])pools[e.bucket].push(e);
  for(const key of Object.keys(pools))pools[key]=stableShuffle(uniqueEntries(pools[key]),`${paperSeed}|${key}`);

  const selected=[],usedQuestionIds=new Set(),shortage={},vocabFamilyCounts=new Map(),usedPassages=new Set();
  const addSelected=(e,slot)=>{const id=canonicalId(e?.question);if(!id||usedQuestionIds.has(id))return false;selected.push({...e,slot});usedQuestionIds.add(id);return true};
  const unusedFrom=items=>items.filter(e=>!usedQuestionIds.has(canonicalId(e.question)));

  function pickCandidate(bucket,items){
    const candidates=unusedFrom(items);if(!candidates.length)return null;
    if(bucket==='vocabulary'){
      return [...candidates].sort((a,b)=>{
        const af=vocabFamily(a.question),bf=vocabFamily(b.question),ac=vocabFamilyCounts.get(af)||0,bc=vocabFamilyCounts.get(bf)||0;
        return ac-bc||seededRank(`${paperSeed}|vocab-family`,entryKey(a))-seededRank(`${paperSeed}|vocab-family`,entryKey(b));
      })[0]||null;
    }
    if(bucket==='reading')return candidates.find(e=>!usedPassages.has(passageKey(e)))||candidates[0];
    return candidates[0];
  }

  function takeUnitBalanced(bucket,count,{slot=bucket}={}){
    const groups=groupByUnit(pools[bucket]),units=[...groups.keys()].sort((a,b)=>seededRank(`${paperSeed}|${bucket}|units`,a)-seededRank(`${paperSeed}|${bucket}|units`,b)||a.localeCompare(b));
    let n=0;
    while(n<count){
      let progress=false;
      for(const unitId of units){
        if(n>=count)break;
        const candidate=pickCandidate(bucket,groups.get(unitId)||[]);if(!candidate)continue;
        if(addSelected(candidate,slot)){
          n++;progress=true;
          if(bucket==='vocabulary'){const family=vocabFamily(candidate.question);vocabFamilyCounts.set(family,(vocabFamilyCounts.get(family)||0)+1)}
          if(bucket==='reading')usedPassages.add(passageKey(candidate));
        }
      }
      if(!progress)break;
    }
    return n;
  }

  for(const bucket of CORE_BUCKETS){
    const wanted=MOCK_TEST_BLUEPRINT[bucket],got=takeUnitBalanced(bucket,wanted);
    if(got<wanted)shortage[bucket]=wanted-got;
  }

  const writtenWanted=MOCK_TEST_BLUEPRINT.constructed_response,writtenGot=takeUnitBalanced('constructed_response',writtenWanted);
  const writtenFallbackNeeded=Math.max(0,writtenWanted-writtenGot);let writtenFallbackUsed=0;
  if(writtenFallbackNeeded){
    const leftovers=stableShuffle(CORE_BUCKETS.flatMap(bucket=>unusedFrom(pools[bucket])),`${paperSeed}|written-fallback`);
    for(const e of leftovers){if(addSelected(e,'constructed_response_fallback'))writtenFallbackUsed++;if(writtenFallbackUsed>=writtenFallbackNeeded)break}
  }

  const coreShortage=Object.values(shortage).reduce((a,b)=>a+b,0),unresolvedWritten=Math.max(0,writtenFallbackNeeded-writtenFallbackUsed);
  const ready=selected.length===MOCK_TEST_TOTAL&&coreShortage===0&&unresolvedWritten===0;
  const ordered=orderedPaper(selected).map((e,index)=>({...e,number:index+1}));
  return{
    version:'1.3.0',seed:paperSeed,planId:String(plan.id),total:ordered.length,ready,questions:ordered,
    blueprint:{...MOCK_TEST_BLUEPRINT},availability:Object.fromEntries(Object.entries(pools).map(([k,v])=>[k,v.length])),selectedCounts:countsByBucket(ordered),unitDiagnostics:unitDiagnostics(pools,ordered),
    writtenFallback:{needed:writtenFallbackNeeded,used:writtenFallbackUsed},shortages:{...shortage,...(unresolvedWritten?{constructed_response_fallback:unresolvedWritten}:{})},loadErrors,labels:{...LABELS}
  };
}
