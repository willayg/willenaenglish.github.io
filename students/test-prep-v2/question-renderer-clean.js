import {QuestionRenderer as BaseQuestionRenderer} from './question-renderer.js?v=2.20.0';

const HIDDEN_CONTEXT_KEYS=new Set([
  'transcription_status',
  'transcript_status',
  'source_page'
]);

function cleanQuestion(question){
  if(!question||typeof question!=='object')return question;
  const raw=question.context;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return question;
  const context={...raw};
  for(const key of HIDDEN_CONTEXT_KEYS)delete context[key];
  return{...question,context};
}

export class QuestionRenderer extends BaseQuestionRenderer{
  render(question,options={}){
    return super.render(cleanQuestion(question),options);
  }
}
