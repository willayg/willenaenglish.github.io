import {FORMS} from './question-model.js';

const API='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const HEAD={apikey:KEY,Authorization:`Bearer ${KEY}`};
const cache=new Map();

async function get(path){
  const r=await fetch(API+path,{headers:HEAD,cache:'no-store'});
  if(!r.ok)throw new Error(await r.text());
  return r.json();
}

function shuffled(items){
  const a=[...items];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  if(a.length>1&&a.every((x,i)=>x===items[i]))[a[0],a[1]]=[a[1],a[0]];
  return a;
}
function tokens(text){return String(text||'').trim().split(/\s+/).filter(Boolean)}
function normalizeRow(row){
  return{
    occurrenceId:String(row.occurrence_id||''),
    sentenceId:String(row.sentence_id||''),
    passageId:String(row.passage_id||''),
    passageTitle:String(row.passage_title||'본문'),
    passageSourceKey:row.passage_source_key||null,
    unitId:String(row.unit_id||''),
    bookId:String(row.book_id||''),
    order:Number(row.sentence_order)||0,
    text:String(row.sentence_text||'').trim(),
    translationKo:String(row.translation_ko||'').trim(),
    speaker:String(row.speaker||'').trim(),
    page:row.page_number==null?null:Number(row.page_number),
    revision:row.passage_revision||null
  };
}

export async function loadPassages(unitId,{force=false}={}){
  const key=String(unitId||'');if(!key)return[];
  if(force)cache.delete(key);
  if(cache.has(key))return cache.get(key);
  const promise=(async()=>{
    const path=`/rest/v1/test_prep_passage_sentences_v1?select=occurrence_id,book_id,unit_id,passage_id,passage_title,passage_source_key,sentence_order,sentence_id,sentence_text,translation_ko,speaker,page_number,passage_revision&unit_id=eq.${encodeURIComponent(key)}&order=passage_id.asc,sentence_order.asc`;
    const rows=(await get(path)).map(normalizeRow).filter(x=>x.occurrenceId&&x.passageId&&x.order>0&&x.text);
    const byId=new Map();
    for(const row of rows){
      let p=byId.get(row.passageId);
      if(!p){p={id:row.passageId,title:row.passageTitle,sourceKey:row.passageSourceKey,unitId:row.unitId,bookId:row.bookId,page:row.page,revision:row.revision,sentences:[]};byId.set(row.passageId,p)}
      p.sentences.push(row);
    }
    return [...byId.values()].map(p=>({...p,sentences:p.sentences.sort((a,b)=>a.order-b.order),translationReady:p.sentences.length>0&&p.sentences.every(s=>!!s.translationKo)})).sort((a,b)=>(a.page??9999)-(b.page??9999)||a.title.localeCompare(b.title));
  })().catch(e=>{cache.delete(key);throw e});
  cache.set(key,promise);return promise;
}

export async function passageAvailable(unitId){return (await loadPassages(unitId)).length>0}
export function invalidatePassages(unitId){if(unitId)cache.delete(String(unitId));else cache.clear()}

export function passageQuestion(sentence,passage){
  const chips=shuffled(tokens(sentence?.text||''));
  if(!sentence?.occurrenceId||!sentence?.text||!chips.length)return null;
  return{
    id:String(sentence.occurrenceId),
    masteryKey:`passage:${sentence.occurrenceId}`,
    bookId:sentence.bookId||passage?.bookId||null,
    unitId:sentence.unitId||passage?.unitId||null,
    skill:'passage',
    form:FORMS.chunks,
    source:{code:'',label:`본문 · ${passage?.title||sentence.passageTitle||'본문'}`,sourceId:sentence.passageId||passage?.id||null,sourceQuestionNumber:sentence.order||null,page:sentence.page??passage?.page??null},
    prompt:'다음 우리말 문장을 영어 문장으로 완성하세요.',
    context:{korean:sentence.translationKo},
    choices:[],
    chips,
    answer:[String(sentence.text)],
    grading:{mode:'exact_normalized',aiAllowed:false,constraints:{}},
    tracking:{practiceType:'passage',questionId:String(sentence.occurrenceId),questionType:'passage_sentence_order',targets:['passage','sentence_order','reading_text']},
    metadata:{
      passage_id:String(sentence.passageId||passage?.id||''),
      passage_title:passage?.title||sentence.passageTitle||null,
      passage_order:Number(sentence.order)||0,
      passage_total:Number(passage?.sentences?.length)||0,
      passage_mode:'ordered',
      unit_id:sentence.unitId||passage?.unitId||null,
      sentence_id:sentence.sentenceId||null,
      translation_ko:sentence.translationKo||null,
      speaker:sentence.speaker||null
    }
  };
}
