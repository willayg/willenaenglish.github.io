const SUPABASE_URL="https://gxwfsqxyuufqtitspfqg.supabase.co";
const SUPABASE_KEY=["sb_publishable_","G-FYhHfDL4OGdL892gY1Zg_","epdbEeqO"].join("");
const headers={apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`};

const clean=value=>String(value??"").trim();

function isExcludedFromLevelTest(row){
  const metadata=row?.metadata||{};
  const value=metadata.exclude_level_test??metadata.exclude_from_level_test;
  return value===true||String(value).toLowerCase()==="true";
}
const shuffle=items=>[...items].sort(()=>Math.random()-.5);
const unique=items=>[...new Set(items.map(clean).filter(Boolean))];

function optionRows(row){
  const related=Array.isArray(row.assessment_item_options)?row.assessment_item_options:[];
  if(related.length){
    return [...related]
      .sort((a,b)=>(Number(a.display_order)||0)-(Number(b.display_order)||0))
      .map(option=>({text:clean(option.option_text),correct:option.is_correct===true}));
  }
  const stored=Array.isArray(row.choices)?row.choices:[];
  return stored.map(text=>({text:clean(text),correct:clean(text)===clean(row.correct_answer)}));
}

function mapItem(row){
  const answer=clean(row.correct_answer);
  const type=clean(row.item_type)||"question_response";
  const metadata=row.metadata||{};
  const context=clean(row.context_text);
  const prompt=clean(row.prompt_text);

  if(!prompt)throw new Error(`Assessment item ${row.source_key||row.id} has no prompt.`);
  if(!answer)throw new Error(`Assessment item ${row.source_key||row.id} has no correct answer.`);

  if(type==="sentence_unscramble"){
    const tokens=Array.isArray(metadata.tokens)?metadata.tokens.map(clean).filter(Boolean):[];
    if(tokens.length<2)throw new Error(`Unscramble item ${row.source_key||row.id} has no usable tokens.`);
    return{id:clean(row.source_key)||row.id,type,q:prompt,meaning:context,a:answer,choices:[],tokens,level:Number(row.level_id)||1,difficulty:Number(row.difficulty_rating)||Number(row.level_id)*20,sourceTable:"assessment_items",translation:false,metadata};
  }

  const options=optionRows(row);
  const choices=unique(options.map(option=>option.text));
  const markedCorrect=options.filter(option=>option.correct).map(option=>option.text);
  if(choices.length!==4)throw new Error(`Assessment item ${row.source_key||row.id} must have exactly four unique choices.`);
  if(!choices.includes(answer))throw new Error(`Assessment item ${row.source_key||row.id} does not include its correct answer among the choices.`);
  if(markedCorrect.length&&!(markedCorrect.length===1&&markedCorrect[0]===answer))throw new Error(`Assessment item ${row.source_key||row.id} has inconsistent correct-option data.`);

  if(type==="listening"){
    const transcript=clean(metadata.transcript)||context;
    if(!transcript)throw new Error(`Listening item ${row.source_key||row.id} has no transcript.`);
    return{id:clean(row.source_key)||row.id,type,q:prompt,a:answer,choices,level:Number(row.level_id)||1,difficulty:Number(row.difficulty_rating)||Number(row.level_id)*20,sourceTable:"assessment_items",translation:false,metadata:{...metadata,transcript}};
  }

  return{id:clean(row.source_key)||row.id,type,q:context?`${context}\n${prompt}`:prompt,a:answer,choices,level:Number(row.level_id)||1,difficulty:Number(row.difficulty_rating)||Number(row.level_id)*20,sourceTable:"assessment_items",translation:false,metadata};
}

async function loadAllPublishedRows(){
  const select="id,source_key,level_id,difficulty_rating,item_type,prompt_text,context_text,correct_answer,metadata,choices,assessment_item_options(option_text,is_correct,display_order)";
  const baseUrl=`${SUPABASE_URL}/rest/v1/assessment_items?select=${encodeURIComponent(select)}&status=eq.published&is_flagged=eq.false&order=level_id.asc,difficulty_rating.asc,source_key.asc,id.asc`;
  const pageSize=1000;
  const rows=[];

  for(let start=0;;start+=pageSize){
    const response=await fetch(baseUrl,{headers:{...headers,Range:`${start}-${start+pageSize-1}`},cache:"no-store"});
    if(!response.ok)throw new Error(`Could not load the authored assessment bank (${response.status}).`);
    const page=await response.json();
    if(!Array.isArray(page))throw new Error("The authored assessment bank returned an invalid response.");
    rows.push(...page);
    if(page.length<pageSize)break;
  }
  return rows;
}

export async function loadQuestionBank(){
  const rows=await loadAllPublishedRows();
  if(!rows.length)throw new Error("No published authored assessment questions are available yet.");

  const bank=[];
  let excludedByMetadata=0;
  let invalid=0;
  for(const row of rows){
    if(isExcludedFromLevelTest(row)){
      excludedByMetadata++;
      continue;
    }
    try{
      bank.push(mapItem(row));
    }catch(error){
      invalid++;
      console.warn("Skipping invalid level-test assessment item",row.source_key||row.id,error.message);
    }
  }

  if(!bank.length)throw new Error("No usable published authored assessment questions are available yet.");
  console.info("Willena authored assessment bank",{
    fetched:rows.length,
    total:bank.length,
    excludedByMetadata,
    invalid,
    byLevel:bank.reduce((counts,item)=>(counts[item.level]=(counts[item.level]||0)+1,counts),{})
  });
  return shuffle(bank);
}

export async function loadJSON(){throw new Error("JSON loading is disabled. This test uses authored Supabase assessment items only.");}
