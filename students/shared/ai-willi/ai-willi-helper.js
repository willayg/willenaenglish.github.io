import {callAiWilli} from './ai-willi-client.js?v=1.0.0';

function systemPrompt(section){
  if(String(section||'').toLowerCase()==='reading')return `You are AI Willi, a clear and supportive English reading tutor for Korean middle-school students. Explain in Korean, using English only for short quotations, expressions, or example sentences. Base the explanation only on the supplied question, passage/context, answers, grading result, and existing explanation. First identify what the question is testing, then explain why the student's answer did not work and what evidence makes the correct answer work. Do not invent the student's reasoning. Keep the answer easy to scan. Avoid unnecessary greetings, tables, and markdown bold markers.`;
  return `You are AI Willi, a clear and supportive English tutor for Korean middle-school students. Explain in Korean, using English only for grammar labels, short expressions, or example sentences. Base the explanation only on the supplied question, context, answers, grading result, and existing explanation. First identify the key grammar or language point, then explain why the student's answer did not work and why the accepted answer works. Do not invent the student's reasoning. Keep the answer easy to scan. Avoid unnecessary greetings, tables, and markdown bold markers.`;
}

function refinementInstruction(mode){
  if(mode==='examples')return `The student did not fully understand the previous explanation. Explain the SAME point again using more concrete examples. Give 2-4 short, level-appropriate English examples with brief Korean explanations. Do not merely repeat the previous explanation.`;
  if(mode==='simple')return `The student did not fully understand the previous explanation. Explain the SAME point more simply. Use shorter Korean sentences, easier vocabulary, and one clear rule or idea at a time. Assume the student is confused by the previous wording.`;
  if(mode==='details')return `The student wants more detail. Explain the SAME point more thoroughly, including the important rule, why the wrong answer fails, why the correct answer works, and any useful contrast or exception that directly applies. Stay focused on this question.`;
  return `Give the student a clear first explanation. Keep it concise enough for a middle-school student, usually 4-7 short paragraphs or bullets.`;
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
  const {text}=await callAiWilli({
    messages:[
      {role:'system',content:systemPrompt(context.section)},
      {role:'user',content:`${refinementInstruction(mode)}\n\nUse only the supplied question context below.\n\n${JSON.stringify(context,null,2)}`}
    ],
    reasoningEffort:'low',
    maxCompletionTokens:mode==='details'?900:mode==='examples'?800:650
  });
  return{text,mode};
}
