import {adaptStored,isAuthoredWritten,FORMS} from './question-model.js';

const API='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const HEAD={apikey:KEY,Authorization:`Bearer ${KEY}`};
const FIELDS='id,source_id,source_question_number,source_page,section,question_type,prompt_text,context,choices,correct_answer,targets,answer_mode,context_type,difficulty,student_source_label,content_status,metadata,book_id,unit_id,replacement_needed';
const idCache=new Map();
const rowCache=new Map();
const bookCache=new Map();
const unitCache=new Map();

async function get(path,range){
  const headers={...HEAD};if(range)headers.Range=range;
  const r=await fetch(API+path,{headers,cache:'no-store'});if(!r.ok)throw new Error(await r.text());return r.json();
}
async function paged(path){
  const out=[];
  for(let start=0;start<10000;start+=1000){const rows=await get(path,`${start}-${start+999}`);out.push(...rows);if(rows.length<1000)break}
  return out;
}
async function resolveBookId(label){
  const key=String(label||'');if(bookCache.has(key))return bookCache.get(key);
  const promise=get(`/rest/v1/content_books?select=id,title&title=eq.${encodeURIComponent(key)}&limit=1`).then(rows=>rows[0]?.id||null).catch(e=>{bookCache.delete(key);throw e});
  bookCache.set(key,promise);return promise;
}
async function resolveUnit(unitId){
  const key=String(unitId||'');if(!key)return null;if(unitCache.has(key))return unitCache.get(key);
  const promise=get(`/rest/v1/content_units?select=id,book_id,title,unit_type&id=eq.${encodeURIComponent(key)}&limit=1`).then(rows=>rows[0]||null).catch(e=>{unitCache.delete(key);throw e});
  unitCache.set(key,promise);return promise;
}
export async function resolveContentIds(plan,lesson){
  const scope=(plan?.group?.scope?.lessons||[]).find(x=>String(x.lesson)===String(lesson));
  const scopeUnit=scope?.unit_id?String(scope.unit_id):'';
  const cacheKey=`${plan?.book_label||''}|${lesson||''}|${scopeUnit}`;if(idCache.has(cacheKey))return idCache.get(cacheKey);
  const promise=(async()=>{
    if(scopeUnit){
      const unit=await resolveUnit(scopeUnit);
      if(unit?.id&&unit?.book_id)return{bookId:unit.book_id,unitId:unit.id,unitType:unit.unit_type||'textbook'};
    }
    const bookId=await resolveBookId(plan?.book_label||'');
    let unitId=null;
    if(bookId){const units=await get(`/rest/v1/content_units?select=id,book_id,title,unit_type&book_id=eq.${encodeURIComponent(bookId)}&title=eq.${encodeURIComponent(lesson)}&limit=1`);if(units[0]){unitCache.set(String(units[0].id),Promise.resolve(units[0]));unitId=units[0].id;return{bookId:units[0].book_id||bookId,unitId,unitType:units[0].unit_type||'textbook'}}}
    throw new Error('교재 또는 Lesson을 콘텐츠 DB에서 찾지 못했습니다.');
  })().catch(e=>{idCache.delete(cacheKey);throw e});
  idCache.set(cacheKey,promise);return promise;
}
async function rawRows(unitId,extra=''){
  const key=`${unitId}|${extra}`;if(rowCache.has(key))return rowCache.get(key);
  const path=`/rest/v1/test_prep_questions?select=${encodeURIComponent(FIELDS)}&student_usable=eq.true&unit_id=eq.${encodeURIComponent(unitId)}${extra}&order=source_page.asc.nullslast,source_question_number.asc.nullslast`;
  const promise=paged(path).then(rows=>rows.filter(x=>x.replacement_needed!==true)).catch(e=>{rowCache.delete(key);throw e});
  rowCache.set(key,promise);return promise;
}
export async function loadStoredSkill(unitId,section){
  const [rows,unit]=await Promise.all([rawRows(unitId,`&section=eq.${encodeURIComponent(section)}`),resolveUnit(unitId)]);
  const external=String(unit?.unit_type||'')==='external_passage';
  return rows.filter(row=>!isAuthoredWritten(row)).map(adaptStored).filter(q=>q.form===FORMS.choice||q.form===FORMS.multi||(external&&[FORMS.write,FORMS.multipart,FORMS.correction].includes(q.form)));
}
export async function loadStoredWritten(unitId){
  const rows=await rawRows(unitId,'&answer_mode=eq.text');
  return rows.filter(isAuthoredWritten).map(adaptStored).filter(q=>[FORMS.write,FORMS.multipart,FORMS.correction].includes(q.form));
}
export function reviewQuestionFromItem(item){
  if(!item?.canonicalId||!item?.content)return null;
  const practice=String(item.practiceType||'').toLowerCase();
  if(item.contentKind==='vocab'||String(item.canonicalId).startsWith('vocab:')){
    const v=item.content||{},word=String(v.canonical_text||String(item.canonicalId).slice(6)||'').trim();
    if(!word)return null;
    const context={};
    if(v.translation_ko)context.korean=v.translation_ko;
    if(v.definition_en)context.definition=v.definition_en;
    return{
      id:`review:${item.canonicalId}`,
      masteryKey:String(item.canonicalId),
      bookId:null,
      unitId:item.unitId||null,
      skill:practice||'vocab_test',
      form:FORMS.write,
      source:{code:'',label:'오답 복습',sourceId:null,sourceQuestionNumber:null,page:null},
      prompt:'다음 뜻에 맞는 영어 단어 또는 표현을 쓰세요.',
      context,
      choices:[],
      chips:[],
      answer:[word],
      grading:{mode:'exact_normalized',aiAllowed:false,constraints:{wordCount:0,noContractions:false,contractionRequired:false,answerOrderIrrelevant:false,alternatives:false}},
      tracking:{practiceType:practice||'vocab_test',questionId:String(item.canonicalId),questionType:'vocab_review',targets:[]},
      metadata:{review_mode:true,canonical_id:String(item.canonicalId),lexical_entry_id:v.id||null}
    };
  }
  const q=adaptStored(item.content);
  if(q.form===FORMS.unsupported)return null;
  q.masteryKey=String(item.canonicalId);
  q.skill=practice||q.skill;
  q.tracking={...(q.tracking||{}),practiceType:practice||q.tracking?.practiceType||'',questionId:String(item.canonicalId)};
  q.metadata={...(q.metadata||{}),review_mode:true,canonical_id:String(item.canonicalId)};
  return q;
}
export function shuffle(items){
  const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a;
}
