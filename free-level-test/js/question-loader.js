const SUPABASE_URL="https://gxwfsqxyuufqtitspfqg.supabase.co";
const SUPABASE_KEY=["sb_publishable_","G-FYhHfDL4OGdL892gY1Zg_","epdbEeqO"].join("");
const headers={apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`};

async function fetchRows(table,columns,filters=""){
  const suffix=filters?`&${filters}`:"";
  const url=`${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(columns)}${suffix}`;
  const response=await fetch(url,{headers,cache:"no-store"});
  if(!response.ok)throw new Error(`Database request failed for ${table} (${response.status})`);
  return response.json();
}

const clean=v=>String(v??"").trim();
const shuffle=a=>[...a].sort(()=>Math.random()-.5);
const uniq=a=>[...new Set(a.map(clean).filter(Boolean))];
const words=s=>clean(s).replace(/[.!?]$/g,"").split(/\s+/).filter(Boolean);
const levelOf=r=>Number(r.level_id)||1;
const difficultyOf=r=>Number(r.difficulty_rating)||null;
const make=(row,type,q,choices,a,extra={})=>({id:`${type}:${row.id}:${Math.random().toString(36).slice(2,7)}`,type,q,choices:uniq(choices),a,level:levelOf(row),difficulty:difficultyOf(row),sourceTable:extra.sourceTable||"sentences",...extra});

function nearby(pool,row,getValue){
  const same=shuffle(pool.filter(x=>x.id!==row.id&&levelOf(x)===levelOf(row)));
  const near=shuffle(pool.filter(x=>x.id!==row.id&&Math.abs(levelOf(x)-levelOf(row))<=1));
  return uniq([...same,...near,...shuffle(pool)].map(getValue));
}

function vocabularyQuestions(rows){
  const usable=rows.filter(r=>clean(r.canonical_text)&&clean(r.translation_ko)&&r.level_id);
  const out=[];
  for(const row of usable){
    const answer=clean(row.canonical_text);
    const english=nearby(usable,row,x=>x.canonical_text).filter(x=>x!==answer).slice(0,3);
    const korean=nearby(usable,row,x=>x.translation_ko).filter(x=>x!==clean(row.translation_ko)).slice(0,3);
    if(english.length===3&&levelOf(row)>=3)out.push(make(row,"vocab_ko_en",`다음 뜻에 맞는 영어 표현을 고르세요: “${clean(row.translation_ko)}”`,[answer,...english],answer,{sourceTable:"lexical_entries",translation:true}));
    if(korean.length===3&&levelOf(row)>=5)out.push(make(row,"vocab_en_ko",`“${answer}”의 뜻을 고르세요.`,[clean(row.translation_ko),...korean],clean(row.translation_ko),{sourceTable:"lexical_entries",translation:true}));
    const letters=answer.replace(/[^A-Za-z]/g,"");
    if(levelOf(row)<=3&&letters.length>=3&&letters.length<=10){
      const i=Math.max(1,Math.min(letters.length-2,Math.floor(letters.length/2)));
      const missing=letters[i].toLowerCase();
      const prompt=letters.slice(0,i)+"_"+letters.slice(i+1);
      const choices=uniq([missing,...shuffle("abcdefghijklmnopqrstuvwxyz".split("")).filter(x=>x!==missing).slice(0,3)]);
      out.push(make(row,"spelling_gap",`빈칸에 들어갈 알파벳을 고르세요: ${prompt}`,choices,missing,{sourceTable:"lexical_entries"}));
    }
  }
  return out;
}

function sentenceQuestions(rows){
  const usable=rows.filter(r=>clean(r.text)&&r.level_id);
  const out=[];
  for(const row of usable){
    const text=clean(row.text),parts=words(text);
    const alternatives=nearby(usable,row,x=>x.text).filter(x=>x!==text).slice(0,3);

    if(clean(row.translation_ko)&&alternatives.length===3&&levelOf(row)>=4){
      out.push(make(row,"sentence_translation",`다음 문장과 뜻이 같은 영어 문장을 고르세요: “${clean(row.translation_ko)}”`,[text,...alternatives],text,{translation:true}));
    }

    if(parts.length>=2&&parts.length<=8){
      const wrong=uniq(Array.from({length:12},()=>shuffle(parts).join(" ")).filter(x=>x!==parts.join(" "))).slice(0,3);
      if(wrong.length===3)out.push(make(row,"word_order","올바른 어순의 문장을 고르세요.",[parts.join(" "),...wrong],parts.join(" ")));
    }

    if(parts.length>=3){
      const targetIndex=Math.min(parts.length-1,Math.max(1,Math.floor(parts.length/2)));
      const answer=parts[targetIndex];
      const blank=[...parts];blank[targetIndex]="____";
      const candidates=uniq(usable.flatMap(x=>words(x.text)).filter(w=>w.toLowerCase()!==answer.toLowerCase()&&/^[A-Za-z']+$/.test(w)));
      const distractors=shuffle(candidates).slice(0,3);
      if(distractors.length===3)out.push(make(row,"fill_blank",`빈칸에 알맞은 말을 고르세요: ${blank.join(" ")}`,[answer,...distractors],answer));
    }

    if(text.endsWith("?")){
      const responsePool=usable.filter(x=>!clean(x.text).endsWith("?")&&Math.abs(levelOf(x)-levelOf(row))<=1);
      const directRules=[
        [/^how are you\?/i,/^(i am|i'm) (fine|good|okay)/i],
        [/^what('?s| is) your name\?/i,/^my name is /i],
        [/^how old are you\?/i,/^i am [a-z0-9]+/i],
        [/^can you /i,/^(yes, i can|no, i can'?t)/i],
        [/^do you /i,/^(yes, i do|no, i don'?t)/i],
        [/^what (is|are) (this|that|it|these|those)/i,/^(this|that|it|these|those) (is|are) /i]
      ];
      const rule=directRules.find(([q])=>q.test(text));
      if(rule){
        const correct=responsePool.find(x=>rule[1].test(clean(x.text)));
        if(correct){
          const wrong=shuffle(responsePool.filter(x=>x.id!==correct.id&&!rule[1].test(clean(x.text)))).slice(0,3).map(x=>clean(x.text));
          if(wrong.length===3)out.push(make(row,"best_response",`가장 알맞은 대답을 고르세요: ${text}`,[clean(correct.text),...wrong],clean(correct.text)));
        }
      }
    }
  }
  return out;
}

function grammarQuestions(patterns,sentences,links){
  const patternById=new Map(patterns.map(p=>[p.id,p]));
  const sentenceById=new Map(sentences.map(s=>[s.id,s]));
  const linkedByPattern=new Map();
  for(const link of links){
    const p=patternById.get(link.pattern_id),s=sentenceById.get(link.sentence_id);
    if(!p||!s)continue;
    if(!linkedByPattern.has(p.id))linkedByPattern.set(p.id,[]);
    linkedByPattern.get(p.id).push(s);
  }
  const out=[];
  for(const pattern of patterns){
    const examples=linkedByPattern.get(pattern.id)||[];
    if(!examples.length)continue;
    const label=clean(pattern.explanation_ko)||clean(pattern.language_function)||clean(pattern.name);
    for(const example of examples.slice(0,3)){
      const correct=clean(example.text);
      const distractorPool=sentences.filter(s=>s.id!==example.id&&Math.abs(levelOf(s)-levelOf(pattern))<=1&&!(linkedByPattern.get(pattern.id)||[]).some(x=>x.id===s.id));
      const wrong=shuffle(distractorPool).slice(0,3).map(s=>clean(s.text));
      if(wrong.length===3&&label){
        out.push(make(pattern,"grammar_function",`다음 중 “${label}”에 알맞은 문장을 고르세요.`,[correct,...wrong],correct,{sourceTable:"patterns"}));
      }
    }
  }
  return out;
}

export async function loadQuestionBank(){
  const [vocabulary,patterns,sentences,links]=await Promise.all([
    fetchRows("lexical_entries","id,canonical_text,translation_ko,level_id,difficulty_rating,status","status=eq.published&order=level_id.asc,difficulty_rating.asc"),
    fetchRows("patterns","id,name,language_function,prompt_pattern,response_pattern,explanation_ko,level_id,difficulty_rating,status","status=eq.published&order=level_id.asc,difficulty_rating.asc"),
    fetchRows("sentences","id,text,translation_ko,level_id,difficulty_rating,status,metadata","status=eq.published&order=level_id.asc,difficulty_rating.asc"),
    fetchRows("sentence_patterns","sentence_id,pattern_id,relationship,is_primary")
  ]);
  const bank=[...vocabularyQuestions(vocabulary),...sentenceQuestions(sentences),...grammarQuestions(patterns,sentences,links)].filter(q=>q.choices.length===4&&!q.choices.some(c=>/[{}]/.test(c)));
  if(bank.length<40)throw new Error(`The database returned only ${bank.length} usable test questions.`);
  console.info("Willena live database question bank",bank.reduce((m,q)=>(m[q.type]=(m[q.type]||0)+1,m),{total:bank.length}));
  return shuffle(bank);
}

export async function loadJSON(){throw new Error("JSON loading is disabled. This test uses the live Supabase database only.");}
