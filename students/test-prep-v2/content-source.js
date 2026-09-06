import {adaptStored,isAuthoredWritten,FORMS} from './question-model.js';

const API='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const HEAD={apikey:KEY,Authorization:`Bearer ${KEY}`};
const FIELDS='id,source_id,source_question_number,source_page,section,question_type,prompt_text,context,choices,correct_answer,targets,answer_mode,context_type,difficulty,student_source_label,content_status,metadata,book_id,unit_id,replacement_needed';

async function get(path,range){
  const headers={...HEAD};if(range)headers.Range=range;
  const r=await fetch(API+path,{headers,cache:'no-store'});if(!r.ok)throw new Error(await r.text());return r.json();
}
async function paged(path){
  const out=[];
  for(let start=0;start<10000;start+=1000){const rows=await get(path,`${start}-${start+999}`);out.push(...rows);if(rows.length<1000)break}
  return out;
}
export async function resolveContentIds(plan,lesson){
  const scope=(plan?.group?.scope?.lessons||[]).find(x=>String(x.lesson)===String(lesson));
  let unitId=scope?.unit_id||null,bookId=null;
  const books=await get(`/rest/v1/content_books?select=id,title&title=eq.${encodeURIComponent(plan?.book_label||'')}&limit=1`);
  if(books[0])bookId=books[0].id;
  if(!unitId&&bookId){const units=await get(`/rest/v1/content_units?select=id,title&book_id=eq.${encodeURIComponent(bookId)}&title=eq.${encodeURIComponent(lesson)}&limit=1`);unitId=units[0]?.id||null}
  if(!bookId||!unitId)throw new Error('교재 또는 Lesson을 콘텐츠 DB에서 찾지 못했습니다.');
  return{bookId,unitId};
}
async function rawRows(unitId,extra=''){
  const path=`/rest/v1/test_prep_questions?select=${encodeURIComponent(FIELDS)}&student_usable=eq.true&unit_id=eq.${encodeURIComponent(unitId)}${extra}&order=source_page.asc.nullslast,source_question_number.asc.nullslast`;
  return (await paged(path)).filter(x=>x.replacement_needed!==true);
}
export async function loadStoredSkill(unitId,section){
  const rows=await rawRows(unitId,`&section=eq.${encodeURIComponent(section)}`);
  return rows.map(adaptStored).filter(q=>q.form===FORMS.choice||q.form===FORMS.multi);
}
export async function loadStoredWritten(unitId){
  const rows=await rawRows(unitId,'&answer_mode=eq.text');
  return rows.filter(isAuthoredWritten).map(adaptStored).filter(q=>[FORMS.write,FORMS.multipart,FORMS.correction].includes(q.form));
}
export function shuffle(items){
  const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a;
}
