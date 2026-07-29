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
  url.searchParams.set("select","id,canonical_text,entry_type,part_of_speech,level_id,difficulty_rating,tags,status,emoji");
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

function pools(rows){
  const published=rows.filter(r=>r.status==="published"&&clean(r.canonical_text));
  const tagged=t=>published.filter(r=>(r.tags||[]).includes(t));
  return{
    nouns:published.filter(r=>r.part_of_speech==="noun"&&r.emoji),
    things:published.filter(r=>["noun","noun_phrase"].includes(r.entry_type)||r.part_of_speech==="noun"),
    foods:[...tagged("food"),...tagged("drink")],
    verbs:published.filter(r=>r.part_of_speech==="verb"&&!['be','do','have','want'].includes(clean(r.canonical_text).toLowerCase())),
    verbPhrases:published.filter(r=>["verb_phrase","phrasal_verb","fixed_expression"].includes(r.entry_type)),
    prepositions:published.filter(r=>r.part_of_speech==="preposition"),
    classroom:tagged("classroom")
  };
}

function identificationQuestions(p){
  return p.nouns.flatMap((n,i)=>{
    const noun=clean(n.canonical_text),emoji=clean(n.emoji);
    const alternatives=shuffle(p.nouns.filter(x=>x.id!==n.id)).slice(0,3).map(x=>clean(x.canonical_text));
    if(alternatives.length<3)return[];
    const answer=`It's ${article(noun)} ${noun}.`;
    return[make(`identify-${n.id}-${i}`,n.level_id,`${emoji}\nWhat is this?`,answer,[`It's ${article(alternatives[0])} ${alternatives[0]}.`,`Yes, it is.`,`I like ${alternatives[1]}.`],n.difficulty_rating)];
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
  const things=uniq(p.foods.map(x=>x.canonical_text)).slice(0,18);
  return things.flatMap((thing,i)=>{
    const ynAnswer=i%2?"No, I don't.":"Yes, I do.";
    return[
      make(`like-yn-${i}`,2,`Do you like ${thing}?`,ynAnswer,["Yes, I can.","Yes, I am.",ynAnswer.startsWith("Yes")?"No, I don't.":"Yes, I do."],30),
      make(`like-wh-${i}`,2,"What do you like?",`I like ${thing}.`,[`I want ${thing}.`,`Yes, I do.`,`I can ${thing}.`],29)
    ];
  }).filter(Boolean);
}

function wantAndHaveQuestions(p){
  const things=uniq(p.things.map(x=>x.canonical_text)).filter(x=>x.length<24).slice(0,18);
  return things.flatMap((thing,i)=>[
    make(`want-wh-${i}`,2,"What do you want?",`I want ${thing}.`,[`I have ${thing}.`,`I like ${thing}.`,`Yes, I do.`],32),
    make(`want-yn-${i}`,2,`Do you want ${thing}?`,i%2?"No, I don't.":"Yes, I do.",["Yes, I can.","Yes, I am.",`I have ${thing}.`],32),
    make(`have-wh-${i}`,2,"What do you have?",`I have ${thing}.`,[`I want ${thing}.`,`I like ${thing}.`,`Yes, I do.`],35),
    make(`have-yn-${i}`,2,`Do you have ${thing}?`,i%2?"Yes, I do.":"No, I don't.",["Yes, I can.","Yes, I am.","No, I'm not."],36)
  ]).filter(Boolean);
}

function permissionQuestions(p){
  const phrases=uniq(p.classroom.concat(p.verbPhrases).map(x=>x.canonical_text)).filter(x=>/^(come in|go to|speak|open|close|sit|stand|read|write|drink|use|borrow)/i.test(x)).slice(0,12);
  return phrases.map((phrase,i)=>make(`may-${i}`,2,`May I ${phrase}?`,i%2?"No, you may not.":"Yes, you may.",["Yes, I can.","Yes, I do.","No, I'm not."],35)).filter(Boolean);
}

function locationQuestions(p){
  const preps=uniq(p.prepositions.map(x=>x.canonical_text)).filter(x=>["in","on","under","behind","next to","between"].includes(x));
  const nouns=uniq(p.things.map(x=>x.canonical_text)).filter(x=>/^[a-z ]+$/i.test(x)&&x.length<12).slice(0,12);
  if(preps.length<3||nouns.length<4)return[];
  return nouns.slice(0,8).map((item,i)=>{
    const place=nouns[(i+3)%nouns.length],prep=preps[i%preps.length];
    const otherPreps=preps.filter(x=>x!==prep).slice(0,2);
    return make(`where-${i}`,2,`The ${item} is ${prep} the ${place}.\nWhere is the ${item}?`,`It's ${prep} the ${place}.`,[`It's ${otherPreps[0]} the ${place}.`,`It's ${otherPreps[1]} the ${place}.`,`It's ${prep} the ${nouns[(i+5)%nouns.length]}.`],34);
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