import {callAiWilli,parseAiWilliJson} from './ai-willi-client.js?v=1.0.0';

function responseText(response){
  return Array.isArray(response)?response.map((x,i)=>`${i+1}. ${String(x??'')}`).join('\n'):String(response??'');
}

function systemPrompt(policy){
  return `You are AI Willi acting as the strict final adjudicator for a Korean middle-school English assessment. Do not give partial credit.\n\nPOLICY FAMILY: ${policy.family}\nPOLICY RULE: ${policy.semanticRule}\n\nThe app has already enforced deterministic hard constraints that it can prove locally. You must still enforce every condition visible in the question/context, including required grammar, supplied words or expressions, word form instructions, completeness, and source meaning. For Korean free-response answers, judge content meaning rather than exact Korean wording, spacing, particles, or stylistic naturalness. Do not require the model-answer wording when the policy permits semantic equivalence. If the task asks the student to create an original sentence, the reference is an example rather than a mandatory meaning. If uncertain, reject. Return JSON only with keys correct, explanation_ko, reason, reason_code. If correct, explanation_ko must be an empty string.`;
}

function userPrompt(question,response,policy){
  return `QUESTION TYPE:\n${question?.tracking?.questionType||''}\n\nQUESTION FORM:\n${question?.form||''}\n\nQUESTION:\n${question?.prompt||''}\n\nCONTEXT AND CONDITIONS:\n${JSON.stringify(question?.context||{})}\n\nCANONICAL HARD CONSTRAINTS:\n${JSON.stringify(policy?.constraints||{})}\n\nREFERENCE ANSWER PARTS:\n${(question?.answer||[]).map((a,i)=>`${i+1}. ${a}`).join('\n')}\n\nSTUDENT RESPONSE:\n${responseText(response)}`;
}

export async function gradeWithAiWilli(question,response,policy){
  const {text}=await callAiWilli({
    messages:[
      {role:'system',content:systemPrompt(policy)},
      {role:'user',content:userPrompt(question,response,policy)}
    ],
    reasoningEffort:'low',
    maxCompletionTokens:320,
    responseFormat:{type:'json_object'}
  });
  const verdict=parseAiWilliJson(text);
  if(typeof verdict?.correct!=='boolean')throw new Error('AI_WILLI_INVALID_GRADING_VERDICT');
  return{
    correct:verdict.correct===true,
    explanationKo:String(verdict.explanation_ko||''),
    reason:String(verdict.reason||''),
    reasonCode:String(verdict.reason_code||'')
  };
}
