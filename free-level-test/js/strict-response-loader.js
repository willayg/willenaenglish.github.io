import{loadQuestionBank as loadLegacyBank}from"./question-loader.js?v=20260730-3";

const clean=v=>String(v??"").trim();
const uniq=a=>[...new Set(a.map(clean).filter(Boolean))];
const shuffle=a=>[...a].sort(()=>Math.random()-.5);
const article=n=>/^[aeiou]/i.test(n)?"an":"a";

async function loadLexicalEntries(){
  const originalFetch=window.fetch.bind(window);
  let requestInfo=null;
  window.fetch=async(...args)=>{
    const raw=typeof args[0]==="string"?args[0]:args[0]?.url;
    if(raw){
      try{
        const url=new URL(raw);
        if(url.pathname.endsWith("/rest/v1/lexical_entries"))requestInfo={url,options:args[1]||{}};
      }catch(_){/* Ignore unrelated requests. */}
    }
    return originalFetch(...args);
  };
  try{await loadLegacyBank();}catch(_){/* Only capturing the authenticated request. */}finally{window.fetch=originalFetch;}
  if(!requestInfo)throw new Error("Could not connect to the published curriculum.");
  const url=new URL(requestInfo.url);
  url.searchParams.set("select","id,canonical_text,entry_type,part_of_speech,level_id,difficulty_rating,tags,status,emoji,countability,plural_required,plural_rule,metadata");
  url.searchParams.set("status","eq.published");
  url.searchParams.set("order","level_id.asc,difficulty_rating.asc");
  const response=await originalFetch(url.toString(),{...requestInfo.options,cache:"no-store"});
  if(!response.ok)throw new Error(`Could not load response vocabulary (${response.status}).`);
  const rows=await response.json();
  if(!Array.isArray(rows)||!rows.length)throw new Error("No published vocabulary was returned.");
  return rows;
}

function make(id,level,q,a,wrong,difficulty=level*20){
  const choices=uniq([a,...wrong]);
  if(choices.length!==4||choices.some(x=>/[{}]/.test(x)))return null;
  return{id:`meaningful_response:${id}`,type:"meaningful_response",q,a,choices,level:Number(level)||1,difficulty:Number(difficulty)||level*20,sourceTable:"generated_from_database"};
}

function isCountable(row){
  const c=clean(row.countability).toLowerCase();
  if(["countable","count","both"].includes(c))return true;
  if(["uncountable","mass","noncount"].includes(c))return false;
  return row.plural_required===true;
}

function pluraliseWord(word){
  if(/[^aeiou]y$/i.test(word))return word.slice(0,-1)+"ies";
  if(/(s|x|z|ch|sh)$/i.test(word))return word+"es";
  if(/fe$/i.test(word))return word.slice(0,-2)+"ves";
  if(/f$/i.test(word))return word.slice(0,-1)+"ves";
  return word+"s";
}

function pluralOf(row){
  const explicit=clean(row.metadata?.plural||row.metadata?.plural_form||row.plural_rule);
  if(explicit&&!/^(regular|add_s|add_es|y_to_ies)$/i.test(explicit))return explicit;
  const text=clean(row.canonical_text);
  const irregular={child:"children",person:"people",man:"men",woman:"women",mouse:"mice",goose:"geese",tooth:"teeth",foot:"feet",fish:"fish",sheep:"sheep"};
  if(irregular[text.toLowerCase()])return irregular[text.toLowerCase()];
  const parts=text.split(" ");
  parts[parts.length-1]=pluraliseWord(parts[parts.length-1]);
  return parts.join(" ");
}

function singularObject(row){
  const text=clean(row.canonical_text);
  return isCountable(row)?`${article(text)} ${text}`:text;
}

function generalPreference(row){
  return isCountable(row)?pluralOf(row):clean(row.canonical_text);
}

function pools(rows){
  const published=rows.filter(r=>r.status==="published"&&clean(r.canonical_text));
  const tagged=t=>published.filter(r=>(r.tags||[]).includes(t));
  const naturalPreference=published.filter(r=>{
    const tags=r.tags||[];
    const nounLike=r.part_of_speech==="noun"||["word","noun_phrase"].includes(r.entry_type);
    const preferredCategory=tags.includes("food")||tags.includes("drink")||tags.includes("sport")||tags.includes("hobby")||tags.includes("animal");
    return nounLike&&preferredCategory&&!["verb_phrase","phrasal_verb","fixed_expression"].includes(r.entry_type);
  });
  return{
    nouns:published.filter(r=>r.part_of_speech==="noun"&&r.emoji),
    things:published.filter(r=>(["noun","noun_phrase"].includes(r.entry_type)||r.part_of_speech==="noun")&&!((r.tags||[]).includes("grammar"))),
    preferences:naturalPreference,
    verbs:published.filter(r=>r.part_of_speech==="verb"&&!['be','do','have','want'].includes(clean(r.canonical_text).toLowerCase())),
    verbPhrases:published.filter(r=>["verb_phrase","phrasal_verb","fixed_expression"].includes(r.entry_type)),
    prepositions:published.filter(r=>r.part_of_speech==="preposition"),
    classroom:tagged("classroom")
  };
}

function identificationQuestions(p){
  return p.nouns.flatMap((n,i)=>{
    const emoji=clean(n.emoji);
    const alternatives=shuffle(p.nouns.filter(x=>x.id!==n.id)).slice(0,2);
    if(alternatives.length<2)return[];
    const answer=`It's ${singularObject(n)}.`;
    return[make(`identify-${n.id}-${i}`,n.level_id,`${emoji}\nWhat is this?`,answer,[`They're ${pluralOf(n)}.`,`Yes, it is.`,`It's ${singularObject(alternatives[0])}.`],n.difficulty_rating)];
  }).filter(Boolean);
}

function fixedPersonalQuestions(){
  return[
    make("how-are-you",1,"How are you?","I'm good, thank you.",["I'm eight years old.","My name is Mina.","Yes, I can."],8),
    make("your-name",1,"What's your name?","My name is Mina.",["I'm fine, thank you.","I'm eight years old.","Yes, I do."],14),
    make("your-age",1,"How old are you?","I'm eight years old.",["My name is Mina.","I'm at school.","Yes, I am."],16)
  ].filter(Boolean);
}

function abilityQuestions(p){
  return p.verbs.slice(0,18).map((v,i)=>{
    const verb=clean(v.canonical_text),positive=i%2===0;
    const answer=positive?"Yes, I can.":"No, I can't.";
    const wrong=positive?["Yes, I do.","Yes, I am.","No, I can't."]:["No, I don't.","No, I'm not.","Yes, I can."];
    return make(`can-${v.id}`,Math.max(1,Number(v.level_id)||1),`Can you ${verb}?`,answer,wrong,v.difficulty_rating);
  }).filter(Boolean);
}

function preferenceQuestions(p){
  return p.preferences.slice(0,18).flatMap((row,i)=>{
    const thing=generalPreference(row),ynAnswer=i%2?"No, I don't.":"Yes, I do.";
    return[
      make(`like-yn-${row.id}`,2,`Do you like ${thing}?`,ynAnswer,["Yes, I can.","Yes, I am.",ynAnswer.startsWith("Yes")?"No, I don't.":"Yes, I do."],30),
      make(`like-wh-${row.id}`,2,"What do you like?",`I like ${thing}.`,[`I want ${singularObject(row)}.`,`Yes, I do.`,`No, I don't.`],29)
    ];
  }).filter(Boolean);
}

function wantAndHaveQuestions(p){
  const things=p.things.filter(r=>clean(r.canonical_text).length<24).slice(0,18);
  return things.flatMap((row,i)=>{
    const thing=singularObject(row);
    return[
      make(`want-wh-${row.id}`,2,"What do you want?",`I want ${thing}.`,[`I have ${thing}.`,`I like ${generalPreference(row)}.`,`Yes, I do.`],32),
      make(`want-yn-${row.id}`,2,`Do you want ${thing}?`,i%2?"No, I don't.":"Yes, I do.",["Yes, I can.","Yes, I am.",`I have ${thing}.`],32),
      make(`have-wh-${row.id}`,2,"What do you have?",`I have ${thing}.`,[`I want ${thing}.`,`I like ${generalPreference(row)}.`,`Yes, I do.`],35),
      make(`have-yn-${row.id}`,2,`Do you have ${thing}?`,i%2?"Yes, I do.":"No, I don't.",["Yes, I can.","Yes, I am.","No, I'm not."],36)
    ];
  }).filter(Boolean);
}

function permissionQuestions(p){
  const phrases=uniq(p.classroom.concat(p.verbPhrases).map(x=>x.canonical_text)).filter(x=>/^(come in|go to|speak|open|close|sit|stand|read|write|drink|use|borrow)/i.test(x)).slice(0,12);
  return phrases.map((phrase,i)=>make(`may-${i}`,2,`May I ${phrase}?`,i%2?"No, you may not.":"Yes, you may.",["Yes, I can.","Yes, I do.","No, I'm not."],35)).filter(Boolean);
}

function locationQuestions(p){
  const preps=uniq(p.prepositions.map(x=>x.canonical_text)).filter(x=>["in","on","under","behind","next to","between"].includes(x));
  const nouns=p.things.filter(r=>/^[a-z ]+$/i.test(clean(r.canonical_text))&&clean(r.canonical_text).length<12).slice(0,12);
  if(preps.length<3||nouns.length<4)return[];
  return nouns.slice(0,8).map((itemRow,i)=>{
    const placeRow=nouns[(i+3)%nouns.length],prep=preps[i%preps.length];
    const item=clean(itemRow.canonical_text),place=clean(placeRow.canonical_text);
    const otherPreps=preps.filter(x=>x!==prep).slice(0,2);
    return make(`where-${i}`,2,`The ${item} is ${prep} the ${place}.\nWhere is the ${item}?`,`It's ${prep} the ${place}.`,[`It's ${otherPreps[0]} the ${place}.`,`It's ${otherPreps[1]} the ${place}.`,`It's ${prep} the ${clean(nouns[(i+5)%nouns.length].canonical_text)}.`],34);
  }).filter(Boolean);
}

export async function loadQuestionBank(){
  const lexical=await loadLexicalEntries();
  const p=pools(lexical);
  const bank=[...identificationQuestions(p),...fixedPersonalQuestions(),...abilityQuestions(p),...preferenceQuestions(p),...wantAndHaveQuestions(p),...permissionQuestions(p),...locationQuestions(p)].filter(Boolean);
  if(bank.length<20)throw new Error(`Only ${bank.length} strict response questions could be generated from the published curriculum.`);
  console.info("Willena strict meaningful-response bank",{total:bank.length,levels:[...new Set(bank.map(q=>q.level))]});
  return shuffle(bank);
}