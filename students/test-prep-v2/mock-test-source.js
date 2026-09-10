import {resolveContentIds,loadStoredSkill,loadStoredWritten} from './content-source.js?v=2.24.3';
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

const CORE_BUCKETS=['vocabulary','communication','grammar','reading'];
const SECTION_ORDER=[...CORE_BUCKETS,'constructed_response'];
const LABELS={vocabulary:'어휘',communication:'대화',grammar:'문법',reading:'독해',constructed_response:'서술형'};
const UNDERLINE_KEYS=new Set(['underlined','underlined_spans']);
const VOCAB_FORMS=new Set([FORMS.choice,FORMS.multi,FORMS.write,FORMS.multipart,FORMS.correction,FORMS.identifiedCorrection]);

const text=v=>String(v??'').trim();
const canonicalId=q=>text(q?.tracking?.questionId||q?.masteryKey||q?.id);
const questionType=q=>text(q?.tracking?.questionType||q?.metadata?.mode||q?.form||'unknown').toLowerCase();
const sourceCode=q=>text(q?.source?.code).toUpperCase();
function flattenVisible(value,key=''){
  if(UNDERLINE_KEYS.has(key)||value==null)return'';
  if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')return String(value);
  if(Array.isArray(value))return value.map(x=>flattenVisible(x)).join(' ');
  if(typeof value==='object')return Object.entries(value).map(([k,v])=>flattenVisible(v,k)).join(' ');
  return'';
}
function underlineSpans(q){
  const c=q?.context&&typeof q.context==='object'&&!Array.isArray(q.context)?q.context:{},out=[];
  if(c.underlined)out.push(text(c.underlined));
  if(Array.isArray(c.underlined_spans))out.push(...c.underlined_spans.map(text));
  return [...new Set(out.filter(Boolean))];
}
function underlineLooksRenderable(q){
  const prompt=text(q?.prompt);if(!prompt.includes('밑줄'))return true;
  const spans=underlineSpans(q);if(!spans.length)return false;
  const body=`${prompt} ${flattenVisible(q?.context||{})}`;
  const choices=(Array.isArray(q?.choices)?q.choices:[]).map(text);
  const bodyMatch=spans.some(s=>body.includes(s));
  const choiceMatch=spans.some(s=>choices.some(c=>c.includes(s)));
  const mirrorsChoices=spans.length===choices.length&&spans.every((s,i)=>s===choices[i]);
  if(/(?:글|윗글|대화)/.test(prompt)&&mirrorsChoices&&!bodyMatch)return false;
  return bodyMatch||choiceMatch;
}
function objectiveQuestion(q){
  if(!(q?.form===FORMS.choice||q?.form===FORMS.multi))return false;
  const choices=Array.isArray(q?.choices)?q.choices:[],answers=Array.isArray(q?.answer)?q.answer:[];
  if(choices.length<2||!answers.length||!text(q?.prompt)||!underlineLooksRenderable(q))return false;
  return answers.every(a=>{const n=Number(a);return Number.isInteger(n)&&n>=1&&n<=choices.length});
}
function storedVocabQuestion(q){
  const answers=Array.isArray(q?.answer)?q.answer:[];
  return q?.skill==='vocabulary'&&VOCAB_FORMS.has(q?.form)&&answers.some(a=>text(a))&&!!text(q?.prompt)&&underlineLooksRenderable(q);
}
function vocabFamily(q){
  const type=questionType(q);
  if(['expression_usage_mismatch','incorrect_usage'].includes(type))return'usage';
  if(['vocab_definition_choice','definition_sentence_match','expression_definition','definition_mismatch','vocab_definition','word_definition','definition_blank_write','vocab_definition_initial_write','vocab_definition_context_write'].includes(type))return'definition';
  if(['blank_choice','common_blank_choice','common_blank_write','bilingual_blank_choice','bilingual_blank_write','expression_blank_choice','dialogue_blank_choice'].includes(type))return'blank';
  if(['vocab_relation_odd_one_out','vocab_relation_write','relation_completion_write'].includes(type))return'relation';
  if(['meaning_mismatch','reference_word_choice','word_meaning_odd_one_out','vocabulary_context','underlined_meaning','underlined_implication','word_meaning'].includes(type))return'meaning';
  if(type==='expression_replacement')return'replacement';
  return type||q?.form||'other';
}

function hash32(value){let h=2166136261;for(const ch of String(value||'')){h=Math.imul(h^ch.charCodeAt(0),16777619)}return h>>>0}
function seededRank(seed,key){return hash32(`${seed}|${key}`)}
function stableShuffle(items,seed){
  return [...items].sort((a,b)=>{
    const ak=`${a.bucket}|${a.lesson}|${canonicalId(a.question)}`,bk=`${b.bucket}|${b.lesson}|${canonicalId(b.question)}`;
    const d=seededRank(seed,ak)-seededRank(seed,bk);return d||ak.localeCompare(bk);
  });
}
function uniqueEntries(items){
  const seen=new Set();
  return (items||[]).filter(entry=>{const id=canonicalId(entry.question);if(!id||seen.has(id))return false;seen.add(id);return true});
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

async function loadStoredVocab(unitId){
  const questions=await loadStoredSkill(unitId,'vocabulary',{trustedOnly:true,includeText:true});
  return questions.filter(storedVocabQuestion);
}
async function loadRowPools(plan,row){
  const lesson=text(row?.lesson);if(!lesson)return{entries:[],errors:[]};
  const sections=rowSections(plan,row),ids=await resolveContentIds(plan,lesson),unitId=ids?.unitId;
  if(!unitId)return{entries:[],errors:[]};
  const jobs=[];
  const add=(bucket,promise)=>jobs.push(promise.then(qs=>({entries:(qs||[]).map(q=>entry(bucket,lesson,unitId,q)),error:null})).catch(e=>({entries:[],error:{lesson,bucket,message:e?.message||String(e)}})));
  if(sections.has('vocabulary')||sections.has('vocab_test'))add('vocabulary',loadStoredVocab(unitId));
  if(sections.has('communication'))add('communication',loadStoredSkill(unitId,'communication',{trustedOnly:true}).then(qs=>qs.filter(objectiveQuestion)));
  if(sections.has('grammar'))add('grammar',loadStoredSkill(unitId,'grammar',{trustedOnly:true}).then(qs=>qs.filter(objectiveQuestion)));
  if(sections.has('reading'))add('reading',loadStoredSkill(unitId,'reading',{trustedOnly:true}).then(qs=>qs.filter(objectiveQuestion)));
  if(sections.has('constructed_response'))add('constructed_response',loadStoredWritten(unitId));
  const parts=await Promise.all(jobs);
  return{entries:parts.flatMap(x=>x.entries),errors:parts.map(x=>x.error).filter(Boolean)};
}

function countsByBucket(entries){
  const out={vocabulary:0,communication:0,grammar:0,reading:0,constructed_response:0};
  for(const e of entries||[])if(Object.hasOwn(out,e.bucket))out[e.bucket]++;
  return out;
}
function orderedPaper(entries){return SECTION_ORDER.flatMap(bucket=>entries.filter(e=>e.bucket===bucket))}

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

  const selected=[],used=new Set(),shortage={};
  const addSelected=(e,slot)=>{const id=canonicalId(e?.question);if(!id||used.has(id))return false;selected.push({...e,slot});used.add(id);return true};
  const unused=bucket=>pools[bucket].filter(e=>!used.has(canonicalId(e.question)));
  const takePlain=(bucket,count,{fallbackFor=null}={})=>{let n=0;for(const e of unused(bucket)){if(addSelected(e,fallbackFor||bucket))n++;if(n>=count)break}return n};
  const takeVocabDiverse=count=>{
    const candidates=unused('vocabulary'),groups=new Map();
    for(const e of candidates){const family=vocabFamily(e.question);if(!groups.has(family))groups.set(family,[]);groups.get(family).push(e)}
    const families=[...groups.keys()].sort((a,b)=>seededRank(`${paperSeed}|vocab-families`,a)-seededRank(`${paperSeed}|vocab-families`,b));
    let n=0,round=0;
    while(n<count&&families.length){
      let progress=false;
      for(const family of families){const e=(groups.get(family)||[])[round];if(e&&addSelected(e,'vocabulary')){n++;progress=true;if(n>=count)break}}
      if(!progress)break;round++;
    }
    if(n<count)n+=takePlain('vocabulary',count-n);
    return n;
  };
  const takeSourceBalanced=(bucket,count)=>{
    const candidates=unused(bucket),willena=candidates.filter(e=>sourceCode(e.question)==='W'),other=candidates.filter(e=>sourceCode(e.question)!=='W');
    const maxWillena=Math.ceil(count/2),needOther=Math.min(other.length,count-maxWillena);let n=0;
    for(const e of other.slice(0,needOther))if(addSelected(e,bucket))n++;
    for(const e of willena){if(n>=count||selected.filter(x=>x.bucket===bucket&&sourceCode(x.question)==='W').length>=maxWillena)break;if(addSelected(e,bucket))n++}
    if(n<count){for(const e of candidates){if(n>=count)break;if(addSelected(e,bucket))n++}}
    return n;
  };

  for(const bucket of CORE_BUCKETS){
    const wanted=MOCK_TEST_BLUEPRINT[bucket],got=bucket==='vocabulary'?takeVocabDiverse(wanted):takeSourceBalanced(bucket,wanted);
    if(got<wanted)shortage[bucket]=wanted-got;
  }

  const writtenWanted=MOCK_TEST_BLUEPRINT.constructed_response,writtenGot=takePlain('constructed_response',writtenWanted);
  const writtenFallbackNeeded=Math.max(0,writtenWanted-writtenGot);let writtenFallbackUsed=0;
  if(writtenFallbackNeeded){
    const leftovers=stableShuffle(CORE_BUCKETS.flatMap(bucket=>unused(bucket)),`${paperSeed}|written-fallback`);
    for(const e of leftovers){if(addSelected(e,'constructed_response_fallback'))writtenFallbackUsed++;if(writtenFallbackUsed>=writtenFallbackNeeded)break}
  }

  const coreShortage=Object.values(shortage).reduce((a,b)=>a+b,0),unresolvedWritten=Math.max(0,writtenFallbackNeeded-writtenFallbackUsed);
  const ready=selected.length===MOCK_TEST_TOTAL&&coreShortage===0&&unresolvedWritten===0;
  const ordered=orderedPaper(selected).map((e,index)=>({...e,number:index+1}));
  return{
    version:'1.2.2',seed:paperSeed,planId:String(plan.id),total:ordered.length,ready,questions:ordered,
    blueprint:{...MOCK_TEST_BLUEPRINT},availability:Object.fromEntries(Object.entries(pools).map(([k,v])=>[k,v.length])),selectedCounts:countsByBucket(ordered),
    writtenFallback:{needed:writtenFallbackNeeded,used:writtenFallbackUsed},shortages:{...shortage,...(unresolvedWritten?{constructed_response_fallback:unresolvedWritten}:{})},loadErrors,labels:{...LABELS}
  };
}
