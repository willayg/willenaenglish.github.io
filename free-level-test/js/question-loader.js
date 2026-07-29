const SUPABASE_URL="https://gxwfsqxyuufqtitspfqg.supabase.co";
const SUPABASE_KEY=["sb_publishable_","G-FYhHfDL4OGdL892gY1Zg_","epdbEeqO"].join("");
const headers={apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`};

async function fetchTable(table,columns){
  const url=`${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(columns)}&status=eq.published&order=level_id.asc,difficulty_rating.asc`;
  const response=await fetch(url,{headers,cache:"no-store"});
  if(!response.ok)throw new Error(`Database request failed for ${table} (${response.status})`);
  return response.json();
}
const clean=value=>String(value??"").trim();
const unique=items=>[...new Set(items.map(clean).filter(Boolean))];
const shuffled=items=>[...items].sort(()=>Math.random()-.5);
function distractorsFor(target,pool,getAnswer,getLevel){
  const answer=clean(getAnswer(target));
  const same=pool.filter(x=>x.id!==target.id&&getLevel(x)===getLevel(target));
  const other=pool.filter(x=>x.id!==target.id&&getLevel(x)!==getLevel(target));
  return unique([...shuffled(same),...shuffled(other)].map(getAnswer)).filter(x=>x!==answer).slice(0,3);
}
function makeVocabularyQuestions(rows){
  const usable=rows.filter(x=>clean(x.canonical_text)&&clean(x.translation_ko)&&x.level_id);
  return usable.map(row=>{
    const a=clean(row.canonical_text),d=distractorsFor(row,usable,x=>x.canonical_text,x=>x.level_id);
    return d.length<3?null:{id:`vocab:${row.id}`,type:"vocabulary",q:`다음 뜻에 맞는 영어 표현을 고르세요: “${clean(row.translation_ko)}”`,choices:shuffled([a,...d]),a,level:Number(row.level_id),difficulty:Number(row.difficulty_rating)||null,sourceTable:"lexical_entries"};
  }).filter(Boolean);
}
function makeSentenceQuestions(rows){
  const usable=rows.filter(x=>clean(x.text)&&clean(x.translation_ko)&&x.level_id);
  return usable.map(row=>{
    const a=clean(row.text),d=distractorsFor(row,usable,x=>x.text,x=>x.level_id);
    return d.length<3?null:{id:`sentence:${row.id}`,type:"sentence",q:`다음 문장과 뜻이 같은 영어 문장을 고르세요: “${clean(row.translation_ko)}”`,choices:shuffled([a,...d]),a,level:Number(row.level_id),difficulty:Number(row.difficulty_rating)||null,sourceTable:"sentences"};
  }).filter(Boolean);
}
const patternAnswer=row=>clean(row.response_pattern)||clean(row.prompt_pattern)||clean(row.name);
function makePatternQuestions(rows){
  const usable=rows.filter(x=>patternAnswer(x)&&x.level_id);
  return usable.map(row=>{
    const a=patternAnswer(row),d=distractorsFor(row,usable,patternAnswer,x=>x.level_id);
    const description=clean(row.explanation_ko)||clean(row.language_function)||clean(row.name);
    return d.length<3?null:{id:`pattern:${row.id}`,type:"pattern",q:`다음 설명에 맞는 문장 패턴을 고르세요: “${description}”`,choices:shuffled([a,...d]),a,level:Number(row.level_id),difficulty:Number(row.difficulty_rating)||null,sourceTable:"patterns"};
  }).filter(Boolean);
}
export async function loadQuestionBank(){
  const [vocabulary,patterns,sentences]=await Promise.all([
    fetchTable("lexical_entries","id,canonical_text,translation_ko,level_id,difficulty_rating,status"),
    fetchTable("patterns","id,name,language_function,prompt_pattern,response_pattern,explanation_ko,level_id,difficulty_rating,status"),
    fetchTable("sentences","id,text,translation_ko,level_id,difficulty_rating,status")
  ]);
  const bank=[...makeVocabularyQuestions(vocabulary),...makePatternQuestions(patterns),...makeSentenceQuestions(sentences)];
  if(bank.length<20)throw new Error(`The database returned only ${bank.length} usable test questions.`);
  console.info("Willena live database question bank",{total:bank.length,vocabulary:bank.filter(q=>q.type==="vocabulary").length,patterns:bank.filter(q=>q.type==="pattern").length,sentences:bank.filter(q=>q.type==="sentence").length});
  return shuffled(bank);
}
export async function loadJSON(){throw new Error("JSON loading is disabled. This test uses the live Supabase database only.")}
