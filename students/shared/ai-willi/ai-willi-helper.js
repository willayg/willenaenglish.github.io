import {callAiWilli,parseAiWilliJson} from './ai-willi-client.js?v=1.0.0';

function systemPrompt(section){
  if(String(section||'').toLowerCase()==='reading')return `You are AI Willi, a clear and supportive English reading tutor for Korean middle-school students. Explain in Korean, using English only for short quotations, expressions, or example sentences. Base the explanation only on the supplied question, passage/context, answers, grading result, and existing explanation. First identify what the question is testing, then explain why the student's answer did not work and what evidence makes the correct answer work. Do not invent the student's reasoning. Keep the answer easy to scan. Avoid unnecessary greetings, tables, and markdown bold markers.`;
  return `You are AI Willi, a clear and supportive English tutor for Korean middle-school students. Explain in Korean, using English only for grammar labels, short expressions, or example sentences. Base the explanation only on the supplied question, context, answers, grading result, and existing explanation. First identify the key grammar or language point, then explain why the student's answer did not work and why the accepted answer works. Do not invent the student's reasoning. Keep the answer easy to scan. Avoid unnecessary greetings, tables, and markdown bold markers.`;
}

function refinementInstruction(mode){
  if(mode==='examples')return `학생이 이전 설명을 충분히 이해하지 못했습니다. 같은 핵심 내용을 더 구체적인 예시를 사용해서 다시 설명하세요. 학생 수준에 맞는 짧은 영어 예문을 2~4개 제시하고, 각 예문을 짧고 쉬운 한국어로 설명하세요. 이전 설명을 그대로 반복하지 마세요.`;
  if(mode==='simple')return `학생이 이전 설명을 이해하기 어려워합니다. 같은 핵심 내용을 더 쉽고 단순하게 다시 설명하세요. 짧은 한국어 문장과 쉬운 단어를 사용하고, 한 번에 하나의 규칙이나 개념만 설명하세요. 학생이 이전 표현 때문에 혼란스러웠다고 생각하고 더 쉬운 방식으로 풀어 주세요.`;
  if(mode==='details')return `학생이 더 자세한 설명을 원합니다. 같은 핵심 내용을 더 깊이 있게 설명하세요. 중요한 규칙, 학생의 답이 왜 맞지 않는지, 정답이 왜 맞는지, 그리고 이 문제에 직접 도움이 되는 비교나 예외가 있다면 함께 설명하세요. 이 문제와 관련 없는 내용으로 넓히지 마세요.`;
  return `학생에게 첫 번째 설명을 명확하게 제공하세요. 한국 중학생이 읽기 쉽게 간결하게 설명하고, 보통 4~7개의 짧은 문단이나 불릿 정도면 충분합니다.`;
}

function vocabInstruction(mode){
  if(mode!=='initial')return `vocabulary에는 빈 배열 []을 반환하세요.`;
  return `vocabulary에는 이 실제 문제와 지문/대화/선택지에 나온 영어 중 한국 중학생에게 어려울 가능성이 높고 문제 이해에 도움이 되는 단어 또는 표현만 3~6개 고르세요. 단순히 모든 단어를 나열하지 마세요. 쉬운 기초어는 제외하세요. 구동사나 고정 표현이 더 유용하면 한 덩어리로 고르세요. 각 항목은 term, meaning_ko, note_ko를 포함하세요. meaning_ko는 짧은 한국어 뜻, note_ko는 이 문제 문맥에서의 의미나 쓰임을 한 문장 이내로 설명하세요. 적절한 어려운 어휘가 거의 없으면 3개를 억지로 채우지 말고 더 적게 반환해도 됩니다.`;
}

function normalizeVocabulary(value){
  if(!Array.isArray(value))return[];
  const seen=new Set(),out=[];
  for(const row of value){
    const term=String(row?.term||'').trim(),meaning=String(row?.meaning_ko||'').trim(),note=String(row?.note_ko||'').trim();
    const key=term.toLowerCase();
    if(!term||!meaning||seen.has(key))continue;
    seen.add(key);out.push({term,meaning_ko:meaning,note_ko:note});
    if(out.length>=6)break;
  }
  return out;
}

function appendVocabulary(text,vocabulary){
  if(!Array.isArray(vocabulary)||!vocabulary.length)return String(text||'').trim();
  const lines=vocabulary.map(v=>`- ${v.term} — ${v.meaning_ko}${v.note_ko?` · ${v.note_ko}`:''}`);
  return `${String(text||'').trim()}\n\n### 핵심 단어\n${lines.join('\n')}`.trim();
}

export async function helpWithAiWilli({question,response,result,section,lesson,practiceType,existingExplanation,mode='initial',previousExplanation=''}={}){
  if(!question)throw new Error('AI_WILLI_HELP_QUESTION_REQUIRED');
  const context={
    question_id:question.id||null,
    section:section||question.skill||practiceType||'',
    lesson:lesson||'',
    practice_type:practiceType||question?.tracking?.practiceType||'',
    prompt:question.prompt||'',
    context:question.context||{},
    choices:question.choices||[],
    student_response:response??null,
    accepted_answer:question.answer||[],
    grading_result:result||null,
    existing_explanation:existingExplanation||question?.metadata?.explanation_ko||question?.metadata?.source_explanation_ko||'',
    previous_ai_willi_explanation:previousExplanation||''
  };
  const {text:raw}=await callAiWilli({
    messages:[
      {role:'system',content:`${systemPrompt(context.section)} Return only valid JSON with this shape: {"explanation":"...","vocabulary":[{"term":"...","meaning_ko":"...","note_ko":"..."}]}. Do not wrap the JSON in markdown.`},
      {role:'user',content:`${refinementInstruction(mode)}\n\n${vocabInstruction(mode)}\n\n아래에 제공된 실제 문제 정보만 사용해서 설명하세요.\n\n${JSON.stringify(context,null,2)}`}
    ],
    reasoningEffort:'low',
    maxCompletionTokens:mode==='details'?1000:mode==='examples'?900:800,
    responseFormat:{type:'json_object'}
  });
  let parsed;
  try{parsed=parseAiWilliJson(raw)}catch(_){parsed={explanation:raw,vocabulary:[]}}
  const vocabulary=mode==='initial'?normalizeVocabulary(parsed?.vocabulary):[];
  const explanation=String(parsed?.explanation||raw||'').trim();
  return{text:appendVocabulary(explanation,vocabulary),explanation,vocabulary,mode};
}
