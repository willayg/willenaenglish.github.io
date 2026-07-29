const SUPABASE_URL="https://gxwfsqxyuufqtitspfqg.supabase.co";
const SUPABASE_KEY=["sb_publishable_","G-FYhHfDL4OGdL892gY1Zg_","epdbEeqO"].join("");
const headers={apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`};

async function fetchTable(table,columns){
  const url=`${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(columns)}&status=eq.published&order=level_id.asc,difficulty_rating.asc`;
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
    if(english.length===3)out.push(make(row,"vocab_ko_en",`다음 뜻에 맞는 영어 표현을 고르세요: “${clean(row.translation_ko)}”`,[answer,...english],answer,{sourceTable:"lexical_entries",translation:true}));
    if(korean.length===3&&levelOf(row)>=3)out.push(make(row,"vocab_en_ko",`“${answer}”의 뜻을 고르세요.`,[clean(row.translation_ko),...korean],clean(row.translation_ko),{sourceTable:"lexical_entries",translation:true}));
    const letters=answer.replace(/[^A-Za-z]/g,"");
    if(levelOf(row)<=3&&letters.length>=3&&letters.length<=10){
      const i=Math.max(1,Math.min(letters.length-2,Math.floor(letters.length/2)));
      const missing=letters[i];
      const prompt=letters.slice(0,i)+"_"+letters.slice(i+1);
      const choices=uniq([missing,...shuffle("abcdefghijklmnopqrstuvwxyz".split("")).filter(x=>x!==missing).slice(0,3)]);
      out.push(make(row,"spelling_gap",`빈칸에 들어갈 알파벳을 고르세요: ${prompt}`,[...choices],missing,{sourceTable:"lexical_entries"}));
    }
  }
  return out;
}

function sentenceQuestions(rows){
  const usable=rows.filter(r=>clean(r.text)&&r.level_id);
  const out=[];
  const allSentences=usable.map(r=>clean(r.text));
  for(const row of usable){
    const text=clean(row.text),parts=words(text);
    const alternatives=nearby(usable,row,x=>x.text).filter(x=>x!==text).slice(0,3);

    if(clean(row.translation_ko)&&alternatives.length===3){
      out.push(make(row,"sentence_translation",`다음 문장과 뜻이 같은 영어 문장을 고르세요: “${clean(row.translation_ko)}”`,[text,...alternatives],text,{translation:true}));
    }

    if(parts.length>=2&&parts.length<=9){
      const shuffledWords=shuffle(parts);
      if(shuffledWords.join(" ")!==parts.join(" ")){
        const wrong1=shuffle(parts).join(" ");
        const wrong2=shuffle(parts).join(" ");
        const wrong3=shuffle(parts).join(" ");
        out.push(make(row,"word_order","올바른 어순의 문장을 고르세요.",[parts.join(" "),wrong1,wrong2,wrong3],parts.join(" ")));
      }
    }

    if(parts.length>=3){
      const targetIndex=Math.min(parts.length-1,Math.max(1,Math.floor(parts.length/2)));
      const answer=parts[targetIndex];
      const blank=[...parts];blank[targetIndex]="____";
      const candidates=uniq(usable.flatMap(x=>words(x.text)).filter(w=>w.toLowerCase()!==answer.toLowerCase()&&/^[A-Za-z']+$/.test(w)));
      const distractors=shuffle(candidates).slice(0,3);
      if(distractors.length===3)out.push(make(row,"fill_blank",`빈칸에 알맞은 말을 고르세요: ${blank.join(" ")}`,[answer,...distractors],answer));
    }

    const lower=text.toLowerCase();
    if(lower.endsWith("?")){
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

    if(levelOf(row)>=4&&alternatives.length===3){
      const pool=shuffle([text,...alternatives]);
      const answer=pool.find(s=>allSentences.includes(s))||text;
      out.push(make(row,"correct_sentence","문법적으로 자연스러운 문장을 고르세요.",pool,answer));
    }
  }
  return out;
}

function patternQuestions(rows){
  const usable=rows.filter(r=>r.level_id&&(clean(r.response_pattern)||clean(r.prompt_pattern)||clean(r.name)));
  const out=[];
  for(const row of usable){
    const answer=clean(row.response_pattern)||clean(row.prompt_pattern)||clean(row.name);
    const options=nearby(usable,row,x=>clean(x.response_pattern)||clean(x.prompt_pattern)||clean(x.name)).filter(x=>x!==answer).slice(0,3);
    if(options.length===3){
      const desc=clean(row.explanation_ko)||clean(row.language_function)||clean(row.name);
      out.push(make(row,"pattern_match",`다음 기능에 알맞은 문장 패턴을 고르세요: “${desc}”`,[answer,...options],answer,{sourceTable:"patterns"}));
    }
  }
  return out;
}

export async function loadQuestionBank(){
  const [vocabulary,patterns,sentences]=await Promise.all([
    fetchTable("lexical_entries","id,canonical_text,translation_ko,level_id,difficulty_rating,status"),
    fetchTable("patterns","id,name,language_function,prompt_pattern,response_pattern,explanation_ko,level_id,difficulty_rating,status"),
    fetchTable("sentences","id,text,translation_ko,level_id,difficulty_rating,status,metadata")
  ]);
  const bank=[...vocabularyQuestions(vocabulary),...sentenceQuestions(sentences),...patternQuestions(patterns)].filter(q=>q.choices.length===4);
  if(bank.length<40)throw new Error(`The database returned only ${bank.length} usable test questions.`);
  console.info("Willena live database question bank",bank.reduce((m,q)=>(m[q.type]=(m[q.type]||0)+1,m),{total:bank.length}));
  return shuffle(bank);
}

export async function loadJSON(){throw new Error("JSON loading is disabled. This test uses the live Supabase database only.");}
