const SUPABASE_URL="https://gxwfsqxyuufqtitspfqg.supabase.co";
const SUPABASE_KEY=["sb_publishable_G-FYhHfD","L4OGdL892gY1Zg_","epdbEeqO"].join("");
const PAGE_SIZE=1000;

const clean=value=>String(value??"").trim();

function normalise(row){
  if(row?.metadata?.exclude_from_level_test===true)return null;
  const choices=Array.isArray(row.choices)?row.choices.map(clean).filter(Boolean):[];
  const answer=clean(row.correct_answer);
  if(!row.source_key||!clean(row.prompt_text)||!answer||choices.length!==4||!choices.includes(answer))return null;
  return{
    id:row.source_key,
    type:clean(row.item_type)||"question_response",
    q:clean(row.prompt_text),
    a:answer,
    choices,
    level:Number(row.level_id)||1,
    difficulty:Number(row.difficulty_rating)||((Number(row.level_id)||1)*20),
    sourceTable:"assessment_items"
  };
}

async function loadPage(offset){
  const params=new URLSearchParams({
    select:"source_key,level_id,difficulty_rating,item_type,prompt_text,correct_answer,choices,metadata",
    status:"eq.published",
    order:"level_id.asc,difficulty_rating.asc,source_key.asc",
    limit:String(PAGE_SIZE),
    offset:String(offset)
  });
  const response=await fetch(`${SUPABASE_URL}/rest/v1/assessment_items?${params}`,{
    headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`},
    cache:"no-store"
  });
  if(!response.ok)throw new Error(`Could not load the authored assessment bank (${response.status}).`);
  const rows=await response.json();
  return Array.isArray(rows)?rows:[];
}

export async function loadQuestionBank(){
  const rows=[];
  for(let offset=0;;offset+=PAGE_SIZE){
    const page=await loadPage(offset);
    rows.push(...page);
    if(page.length<PAGE_SIZE)break;
  }
  const bank=rows.map(normalise).filter(Boolean);
  if(bank.length<100)throw new Error(`Only ${bank.length} valid authored questions were returned.`);
  return bank;
}
