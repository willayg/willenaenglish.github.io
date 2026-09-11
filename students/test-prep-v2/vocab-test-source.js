import {adaptStored,FORMS} from './question-model.js';
import {shuffle} from './content-source.js';
import {splitSentences} from './passage-utils.js';

const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const HEAD={apikey:KEY,Authorization:`Bearer ${KEY}`};
const STORED_FIELDS='id,source_id,source_question_number,source_page,section,question_type,prompt_text,context,choices,correct_answer,targets,answer_mode,context_type,difficulty,student_source_label,content_status,metadata,book_id,unit_id,replacement_needed,qa_status';
const TRUSTED=new Set(['published','answer_key_verified','verified']);
const SUPPORTED=new Set([FORMS.choice,FORMS.multi,FORMS.write,FORMS.multipart,FORMS.correction]);

const norm=s=>String(s??'').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/[.,!?;:]+$/,'').replace(/\s+/g,' ');
const lexicalKey=item=>`vocab:${norm(item?.canonical_text)}`;

async function get(path){
  const r=await fetch(CONTENT+path,{headers:HEAD,cache:'no-store'});
  if(!r.ok)throw new Error(await r.text());
  return r.json();
}
async function paged(path){
  const out=[];
  for(let start=0;start<10000;start+=1000){
    const r=await fetch(CONTENT+path,{headers:{...HEAD,Range:`${start}-${start+999}`},cache:'no-store'});
    if(!r.ok)throw new Error(await r.text());
    const rows=await r.json();out.push(...rows);if(rows.length<1000)break;
  }
  return out;
}
function hashUuid(input){
  const s=String(input||'');let a=2166136261,b=0x9e3779b9,c=0x85ebca6b,d=0xc2b2ae35;
  for(let i=0;i<s.length;i++){const x=s.charCodeAt(i);a=Math.imul(a^x,16777619);b=Math.imul(b+x,2246822519);c=Math.imul(c^x,3266489917);d=Math.imul(d+x,668265263)}
  const h=[a,b,c,d].map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
const qid=(type,key)=>hashUuid(`vocab-test-v3|${type}|${key}`);
function spellingShape(s){return String(s||'').split('').map(c=>/[A-Za-z]/.test(c)?'_':c).join('')}
function sameMeaning(a,b){const A=norm(a?.translation_ko),B=norm(b?.translation_ko);return !!A&&!!B&&A===B}
function unsafeRelation(target,candidate){return target?.unsafe_related_ids instanceof Set&&target.unsafe_related_ids.has(String(candidate?.id||''))}
function distractorPool(list,target){
  const valid=shuffle((list||[]).filter(x=>x&&x.id!==target.id&&norm(x.canonical_text)!==norm(target.canonical_text)&&!sameMeaning(x,target)&&!unsafeRelation(target,x)));
  const samePos=valid.filter(x=>target.part_of_speech&&x.part_of_speech===target.part_of_speech),other=valid.filter(x=>!samePos.some(y=>y.id===x.id));
  return [...samePos,...other];
}
function rxEscape(s){return String(s||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function hasLiteralTarget(text,target){if(!text||!target)return false;return new RegExp(`(^|[^A-Za-z0-9'])${rxEscape(target)}(?=$|[^A-Za-z0-9'])`,'i').test(String(text))}
function sourceBlank(text,target){if(!text||!target)return String(text||'');const re=new RegExp(`(^|[^A-Za-z0-9'])(${rxEscape(target)})(?=$|[^A-Za-z0-9'])`,'i');return String(text).replace(re,(m,prefix)=>`${prefix}_____`)}
function sentencePieces(text){return splitSentences(text).map(text=>({text}))}

async function loadItems(unitId){
  const occ=await paged(`/rest/v1/source_content_occurrences?select=lexical_entry_id&unit_id=eq.${encodeURIComponent(unitId)}&occurrence_type=eq.lexical_entry&skill=eq.vocabulary`);
  const ids=[...new Set((occ||[]).map(x=>x.lexical_entry_id).filter(Boolean))];if(!ids.length)return[];
  const list=[];for(let i=0;i<ids.length;i+=100){list.push(...await get(`/rest/v1/lexical_entries?select=id,canonical_text,translation_ko,definition_en,part_of_speech&id=in.${encodeURIComponent('('+ids.slice(i,i+100).join(',')+')')}`))}
  const usable=(list||[]).filter(x=>x?.canonical_text&&x?.definition_en).sort((a,b)=>String(a.canonical_text).localeCompare(String(b.canonical_text),'en'));
  const usableIds=usable.map(x=>String(x.id)),traps=[],relations=[];
  for(let i=0;i<usableIds.length;i+=100){
    const chunk=usableIds.slice(i,i+100),q=encodeURIComponent('('+chunk.join(',')+')');
    const [t,a,b]=await Promise.all([
      get(`/rest/v1/lexical_definition_distractors?select=id,lexical_entry_id,false_definition_en,trap_type,difficulty&exam_usable=eq.true&lexical_entry_id=in.${q}`).catch(()=>[]),
      get(`/rest/v1/lexical_relations?select=lexical_entry_a_id,lexical_entry_b_id,relation_type&lexical_entry_a_id=in.${q}`).catch(()=>[]),
      get(`/rest/v1/lexical_relations?select=lexical_entry_a_id,lexical_entry_b_id,relation_type&lexical_entry_b_id=in.${q}`).catch(()=>[])
    ]);
    traps.push(...t);relations.push(...a,...b);
  }
  const byTrap=new Map();for(const t of traps){if(!byTrap.has(String(t.lexical_entry_id)))byTrap.set(String(t.lexical_entry_id),[]);byTrap.get(String(t.lexical_entry_id)).push(t)}
  const unsafe=new Map(),unsafeTypes=new Set(['synonym','near_synonym']);
  for(const r of relations){if(!unsafeTypes.has(String(r.relation_type||'').toLowerCase()))continue;const a=String(r.lexical_entry_a_id||''),b=String(r.lexical_entry_b_id||'');if(!a||!b)continue;if(!unsafe.has(a))unsafe.set(a,new Set());if(!unsafe.has(b))unsafe.set(b,new Set());unsafe.get(a).add(b);unsafe.get(b).add(a)}
  return usable.map(x=>({...x,traps:byTrap.get(String(x.id))||[],unsafe_related_ids:unsafe.get(String(x.id))||new Set()}));
}

function generatedQuestion({id,item,questionType,prompt,context={},choices=[],answer=[],targets=[],source=null,metadata={}}){
  const mastery=item?lexicalKey(item):String(id);
  return {
    id:String(id),masteryKey:mastery,bookId:null,unitId:null,skill:'vocabulary',
    form:choices.length?FORMS.choice:FORMS.write,
    source:source||{code:'',label:'어휘 시험',sourceId:null,sourceQuestionNumber:null,page:null},
    prompt:String(prompt||''),context:{...context},choices:[...choices],answer:(Array.isArray(answer)?answer:[answer]).map(String),
    grading:{mode:'exact_normalized',aiAllowed:false,constraints:{}},
    tracking:{practiceType:'vocab_test',questionType,targets:[...targets],questionId:item?mastery:String(id)},
    metadata:{...metadata,lexical_entry_id:item?.id||metadata.lexical_entry_id||null,canonical_text:item?.canonical_text||metadata.canonical_text||null,translation_ko:item?.translation_ko||metadata.translation_ko||null,definition_en:item?.definition_en||metadata.definition_en||null,vocab_test_variant_id:String(id)}
  };
}
function indexOfChoice(choices,correct){return String(choices.findIndex(x=>x===correct)+1)}
function definitionMatch(list){return list.map(item=>{const ds=distractorPool(list,item).slice(0,3);if(ds.length<3)return null;const choices=shuffle([item.canonical_text,...ds.map(x=>x.canonical_text)]);return generatedQuestion({id:qid('match',item.id),item,questionType:'vocab_definition_match',prompt:'다음 영어 정의에 해당하는 단어는?',context:{definition:item.definition_en},choices,answer:[indexOfChoice(choices,item.canonical_text)],targets:['vocabulary','definition'],metadata:{mode:'definition_match'}})}).filter(Boolean)}
function definitionWrite(list){return list.map(item=>generatedQuestion({id:qid('write',item.id),item,questionType:'vocab_definition_write',prompt:'다음 영어 정의에 해당하는 단어를 쓰세요.',context:{definition:item.definition_en,initial:spellingShape(item.canonical_text)},answer:[item.canonical_text],targets:['vocabulary','definition','spelling'],metadata:{mode:'definition_write'}}))}
function koreanToEnglishChoice(list){return list.filter(x=>String(x.translation_ko||'').trim()).map(item=>{const ds=distractorPool(list,item).filter(x=>String(x.translation_ko||'').trim()).slice(0,3);if(ds.length<3)return null;const choices=shuffle([item.canonical_text,...ds.map(x=>x.canonical_text)]);return generatedQuestion({id:qid('koenchoice',item.id),item,questionType:'vocab_ko_en_choice',prompt:'다음 우리말 뜻에 맞는 영어 단어 또는 표현을 고르세요.',context:{korean:item.translation_ko},choices,answer:[indexOfChoice(choices,item.canonical_text)],targets:['vocabulary','translation'],metadata:{mode:'ko_en_choice'}})}).filter(Boolean)}
function koreanToEnglishWrite(list){return list.filter(x=>String(x.translation_ko||'').trim()).map(item=>generatedQuestion({id:qid('koenwrite',item.id),item,questionType:'vocab_ko_en_write',prompt:'다음 우리말 뜻에 맞는 영어 단어 또는 표현을 쓰세요.',context:{korean:item.translation_ko,initial:spellingShape(item.canonical_text)},answer:[item.canonical_text],targets:['vocabulary','translation','spelling'],metadata:{mode:'ko_en_write'}}))}
function falsePairQuestions(list){
  const withTraps=list.filter(x=>x.traps?.length);if(withTraps.length<4)return[];const out=[];
  for(let i=0;i<withTraps.length;i+=4){let group=withTraps.slice(i,i+4),c=0;while(group.length<4&&c<withTraps.length){const x=withTraps[c++];if(!group.some(y=>y.id===x.id))group.push(x)}if(group.length<4)break;const bad=Math.floor(i/4)%4,badWord=group[bad],trap=badWord.traps[Math.floor(i/4)%badWord.traps.length],choices=group.map((x,j)=>`${x.canonical_text} — ${j===bad?trap.false_definition_en:x.definition_en}`),id=qid('falsepair',`${group.map(x=>x.id).join('|')}|${trap.id}`);out.push(generatedQuestion({id,questionType:'vocab_false_definition_spot',prompt:'단어와 영어 뜻의 연결이 잘못된 것은?',choices,answer:[String(bad+1)],targets:['vocabulary','definition','careful_reading','exam_style'],metadata:{lexical_entry_ids:group.map(x=>x.id),false_lexical_entry_id:badWord.id,distractor_id:trap.id,trap_type:trap.trap_type,mode:'false_definition'}}))}
  return out;
}
function correctPairQuestions(list){
  const falseQs=falsePairQuestions(list);return falseQs.map((q,idx)=>{const ids=q.metadata.lexical_entry_ids,group=ids.map(id=>list.find(x=>String(x.id)===String(id))).filter(Boolean);if(group.length!==4)return null;const good=idx%4,choices=group.map((x,j)=>{if(j===good)return`${x.canonical_text} — ${x.definition_en}`;const trap=x.traps?.[0],wrong=trap?.false_definition_en||group[(j+1)%4].definition_en;return`${x.canonical_text} — ${wrong}`}),id=qid('correctpair',ids.join('|')+'|'+good);return generatedQuestion({id,questionType:'vocab_correct_definition_spot',prompt:'단어와 영어 뜻의 연결이 올바른 것은?',choices,answer:[String(good+1)],targets:['vocabulary','definition','careful_reading','exam_style'],metadata:{lexical_entry_ids:ids,mode:'correct_definition'}})}).filter(Boolean);
}
function buildBasePools(list){const mc=[...definitionMatch(list),...koreanToEnglishChoice(list),...falsePairQuestions(list),...correctPairQuestions(list)],written=[...definitionWrite(list),...koreanToEnglishWrite(list)];return{mc,written,all:[...mc,...written]}}

async function loadContextSeeds(unitId){
  const rows=await paged(`/rest/v1/test_prep_questions?select=${encodeURIComponent('id,question_type,context,choices,correct_answer,answer_mode,student_source_label,qa_status')}&unit_id=eq.${encodeURIComponent(unitId)}&section=eq.vocabulary&student_usable=eq.true`);
  return rows.filter(r=>TRUSTED.has(String(r.qa_status||'')));
}
function seedAnswer(row){const raw=Array.isArray(row.correct_answer)?row.correct_answer[0]:row.correct_answer;if(raw==null)return'';const n=Number(raw);if(Array.isArray(row.choices)&&Number.isInteger(n)&&n>=1&&n<=row.choices.length)return String(row.choices[n-1]??'').trim();return String(raw).trim()}
function buildContextQuestions(list,seeds){
  const byText=new Map(list.map(x=>[norm(x.canonical_text),x])),out=[];
  for(const row of seeds||[]){const answer=seedAnswer(row),item=byText.get(norm(answer)),ctx=row.context||{},sentence=String(ctx.sentence||'').trim(),korean=String(ctx.korean||'').trim();if(!item||!sentence||!/_+|ⓐ|ⓑ|\bblank\b/i.test(sentence))continue;const ds=distractorPool(list,item);if(ds.length>=3){const choices=shuffle([item.canonical_text,...ds.slice(0,3).map(x=>x.canonical_text)]);out.push(generatedQuestion({id:qid('contextmc',`${row.id}|${item.id}`),item,questionType:korean?'vocab_context_bilingual_choice':'vocab_context_choice_generated',prompt:korean?'우리말과 문맥에 맞는 단어를 고르세요.':'문맥에 맞는 단어를 고르세요.',context:{sentence,...(korean?{korean}:{})},choices,answer:[indexOfChoice(choices,item.canonical_text)],targets:['vocabulary','context'],metadata:{generator:'context_mc_v1',source_question_id:row.id,source_question_type:row.question_type,source_backed:true}}))}out.push(generatedQuestion({id:qid('contextwrite',`${row.id}|${item.id}`),item,questionType:'vocab_definition_context_write_generated',prompt:'영영풀이와 문맥에 맞는 단어를 쓰세요.',context:{definition:item.definition_en,sentence,...(korean?{korean}:{}),initial:spellingShape(item.canonical_text)},answer:[item.canonical_text],targets:['vocabulary','definition','context','spelling'],metadata:{generator:'definition_context_write_v1',source_question_id:row.id,source_question_type:row.question_type,source_backed:true}}))}
  const seen=new Set();return out.filter(q=>{const k=`${q.tracking.questionType}|${q.metadata.source_question_id}|${q.metadata.lexical_entry_id}`;if(seen.has(k))return false;seen.add(k);return true});
}

async function loadSourceLinks(unitId,list){
  const [passages,dialogues]=await Promise.all([
    get(`/rest/v1/test_prep_source_passages?select=id,title,passage_order,source_text,source_question_id,metadata&unit_id=eq.${encodeURIComponent(unitId)}&student_usable=eq.true&order=passage_order.asc`).catch(()=>[]),
    get(`/rest/v1/source_dialogues?select=id,title,page_number,dialogue_type,activity_label,metadata&unit_id=eq.${encodeURIComponent(unitId)}&order=page_number.asc`).catch(()=>[])
  ]);
  const dids=(dialogues||[]).map(x=>x.id).filter(Boolean),turns=dids.length?await get(`/rest/v1/source_dialogue_turns?select=id,dialogue_id,turn_number,speaker_label,source_text,metadata&dialogue_id=in.${encodeURIComponent('('+dids.join(',')+')')}&order=dialogue_id.asc,turn_number.asc`).catch(()=>[]):[];
  const dm=new Map((dialogues||[]).map(d=>[String(d.id),d])),sources=[];
  for(const p of passages||[])for(const piece of sentencePieces(p.source_text))sources.push({source_type:'passage',source_id:p.id,title:p.title||'',source_question_id:p.source_question_id||null,passage_order:p.passage_order??null,source_text:piece.text,metadata:p.metadata||{}});
  for(const t of turns||[]){const d=dm.get(String(t.dialogue_id))||{};sources.push({source_type:'dialogue',source_id:t.id,dialogue_id:t.dialogue_id,title:d.title||'',page_number:d.page_number??null,turn_number:t.turn_number??null,speaker_label:t.speaker_label||'',source_text:String(t.source_text||''),metadata:{...(d.metadata||{}),...(t.metadata||{})}})}
  const out=[];for(const item of list){for(const src of sources)if(hasLiteralTarget(src.source_text,item.canonical_text))out.push({...src,lexical_entry_id:item.id})}return out;
}
function buildSourceQuestions(list,links){
  const byId=new Map(list.map(x=>[String(x.id),x])),seen=new Set(),out=[];
  for(const link of links||[]){const item=byId.get(String(link.lexical_entry_id||''));if(!item||seen.has(item.id))continue;const original=String(link.source_text||'').trim();if(original.length<8||original.length>240)continue;const sentence=sourceBlank(original,item.canonical_text);if(sentence===original)continue;seen.add(item.id);const source={code:'B',label:'교과서 문맥',sourceId:link.source_id||null,sourceQuestionNumber:null,page:link.page_number??null},meta={generator:'source_exact_v1',source_backed:true,source_kind:link.source_type||null,source_id:link.source_id||null,dialogue_id:link.dialogue_id||null,source_title:link.title||null,page_number:link.page_number??null,passage_order:link.passage_order??null,turn_number:link.turn_number??null,speaker_label:link.speaker_label||null,exact_source_text:original};const ds=distractorPool(list,item).slice(0,3);if(ds.length>=3){const choices=shuffle([item.canonical_text,...ds.map(x=>x.canonical_text)]);out.push(generatedQuestion({id:qid('sourcecontextmc',`${link.source_type}|${link.source_id}|${item.id}`),item,questionType:'vocab_source_context_choice',prompt:'교과서 문맥에 맞는 단어 또는 표현을 고르세요.',context:{sentence},choices,answer:[indexOfChoice(choices,item.canonical_text)],targets:['vocabulary','context','source_text'],source,metadata:meta}))}out.push(generatedQuestion({id:qid('sourcecontextwrite',`${link.source_type}|${link.source_id}|${item.id}`),item,questionType:'vocab_source_context_write',prompt:'교과서 문맥에 맞는 단어 또는 표현을 쓰세요.',context:{sentence,initial:spellingShape(item.canonical_text)},answer:[item.canonical_text],targets:['vocabulary','context','source_text','spelling'],source,metadata:meta}))}
  return out;
}

async function loadStoredQuestions(unitId,list){
  const rows=await paged(`/rest/v1/test_prep_questions?select=${encodeURIComponent(STORED_FIELDS)}&student_usable=eq.true&unit_id=eq.${encodeURIComponent(unitId)}&section=eq.vocabulary&order=source_page.asc.nullslast,source_question_number.asc.nullslast`),byText=new Map(list.map(x=>[norm(x.canonical_text),x]));
  return rows.filter(row=>row.replacement_needed!==true).map(row=>{
    const q=adaptStored(row);if(!SUPPORTED.has(q.form))return null;
    const canonical=String(q.metadata?.canonical_text||((q.form===FORMS.write&&q.answer.length===1)?q.answer[0]:'')).trim(),item=byText.get(norm(canonical));
    if(item){const mastery=lexicalKey(item);q.masteryKey=mastery;q.tracking={...q.tracking,practiceType:'vocab_test',questionId:mastery};q.metadata={...q.metadata,lexical_entry_id:item.id,canonical_text:item.canonical_text,vocab_test_variant_id:q.id}}
    else q.tracking={...q.tracking,practiceType:'vocab_test',questionId:q.id};
    return q;
  }).filter(Boolean);
}
function dedupeTargets(arr){const seen=new Set();return (arr||[]).filter(q=>{const k=String(q?.tracking?.questionId||q?.masteryKey||q?.id||'');if(!k||seen.has(k))return false;seen.add(k);return true})}
function selectQuestions({base,generated,stored,count=20}){
  const wanted=Math.max(1,Number(count)||20),storedCount=Math.min(stored.length,Math.max(0,Math.round(wanted*.35))),generatedSlots=Math.max(0,wanted-storedCount),contextCount=Math.min(generated.length,generatedSlots?Math.max(1,Math.round(generatedSlots*.3)):0),baseCount=Math.max(0,generatedSlots-contextCount);
  let picked=dedupeTargets(shuffle([...shuffle(base).slice(0,baseCount),...shuffle(generated).slice(0,contextCount),...shuffle(stored).slice(0,storedCount)]));
  if(picked.length<wanted){const used=new Set(picked.map(q=>String(q.tracking?.questionId||q.masteryKey||q.id))),remaining=shuffle([...base,...generated,...stored]).filter(q=>!used.has(String(q.tracking?.questionId||q.masteryKey||q.id)));picked=dedupeTargets([...picked,...remaining.slice(0,wanted-picked.length)])}
  return shuffle(picked).slice(0,wanted);
}

export async function loadVocabularyTest(unitId,{count=20}={}){
  const [list,seeds]=await Promise.all([loadItems(unitId),loadContextSeeds(unitId).catch(()=>[])]),stored=await loadStoredQuestions(unitId,list).catch(()=>[]);
  if(!list.length&&!stored.length)return[];
  const base=list.length?buildBasePools(list).all:[],links=list.length?await loadSourceLinks(unitId,list).catch(()=>[]):[],generated=list.length?[...buildContextQuestions(list,seeds),...buildSourceQuestions(list,links)]:[];
  return selectQuestions({base,generated,stored,count});
}
export async function loadVocabularyTestAvailableIds(unitId){
  const list=await loadItems(unitId),stored=await loadStoredQuestions(unitId,list).catch(()=>[]),ids=new Set(list.map(lexicalKey));
  for(const q of [...falsePairQuestions(list),...correctPairQuestions(list),...stored])ids.add(String(q.tracking?.questionId||q.id));
  return ids;
}
