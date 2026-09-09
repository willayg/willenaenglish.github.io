import {callAiWilli} from './ai-willi-client.js?v=1.0.0';

function systemPrompt(section){
  if(String(section||'').toLowerCase()==='reading')return `You are AI Willi, a clear and supportive English reading tutor for Korean middle-school students. Explain in Korean, using English only for short quotations, expressions, or example sentences. Base the explanation only on the supplied question, passage/context, answers, grading result, and existing explanation. First identify what the question is testing, then explain why the student's answer did not work and what evidence makes the correct answer work. Do not invent the student's reasoning. Keep the answer concise and easy to scan. Avoid unnecessary greetings and tables.`;
  return `You are AI Willi, a clear and supportive English tutor for Korean middle-school students. Explain in Korean, using English only for grammar labels, short expressions, or example sentences. Base the explanation only on the supplied question, context, answers, grading result, and existing explanation. First identify the key grammar or language point, then explain why the student's answer did not work and why the accepted answer works. Do not invent the student's reasoning. Keep the answer concise and easy to scan. Avoid unnecessary greetings and tables.`;
}

export async function helpWithAiWilli({question,response,result,section,lesson,practiceType,existingExplanation}={}){
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
    existing_explanation:existingExplanation||question?.metadata?.explanation_ko||question?.metadata?.source_explanation_ko||''
  };
  const {text}=await callAiWilli({
    messages:[
      {role:'system',content:systemPrompt(context.section)},
      {role:'user',content:`Explain this student's question using only this supplied context:\n\n${JSON.stringify(context,null,2)}`}
    ],
    reasoningEffort:'low',
    maxCompletionTokens:650
  });
  return{text};
}
