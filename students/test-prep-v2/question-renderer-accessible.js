import * as BaseRenderer from './question-renderer.js?v=2.20.6-base';
export * from './question-renderer.js?v=2.20.6-base';
import {bigTextEnabled,STUDENT_BIG_TEXT_EVENT} from '../shared/student-accessibility.js?v=1.0.0';

function applyTextMode(host){
  if(!host)return;
  host.classList.add('willena-question-renderer');
  host.classList.toggle('willena-big-text',bigTextEnabled());
}

export class QuestionRenderer extends BaseRenderer.QuestionRenderer{
  constructor(host){
    super(host);
    this.__willenaTextModeListener=()=>applyTextMode(this.host);
    window.addEventListener(STUDENT_BIG_TEXT_EVENT,this.__willenaTextModeListener);
    applyTextMode(this.host);
  }
  render(...args){
    const result=super.render(...args);
    applyTextMode(this.host);
    return result;
  }
}

export const QUESTION_RENDERER_BIG_TEXT_KEY='willena-student-big-text';
export const QUESTION_RENDERER_BIG_TEXT_EVENT=STUDENT_BIG_TEXT_EVENT;
