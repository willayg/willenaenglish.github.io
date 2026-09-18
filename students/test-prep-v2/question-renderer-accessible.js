import * as BaseRenderer from './question-renderer.js?v=2.20.6-base';
export * from './question-renderer.js?v=2.20.6-base';

const BIG_TEXT_KEY='willena-testprep-big-text';
const BIG_TEXT_EVENT='willena:test-prep-big-text';

function bigTextEnabled(){
  try{return localStorage.getItem(BIG_TEXT_KEY)==='1'}catch{return false}
}

function applyTextMode(host){
  if(!host)return;
  host.classList.add('willena-question-renderer');
  host.classList.toggle('willena-big-text',bigTextEnabled());
}

export class QuestionRenderer extends BaseRenderer.QuestionRenderer{
  constructor(host){
    super(host);
    this.__willenaTextModeListener=()=>applyTextMode(this.host);
    window.addEventListener(BIG_TEXT_EVENT,this.__willenaTextModeListener);
    applyTextMode(this.host);
  }
  render(...args){
    const result=super.render(...args);
    applyTextMode(this.host);
    return result;
  }
}

export const QUESTION_RENDERER_BIG_TEXT_KEY=BIG_TEXT_KEY;
export const QUESTION_RENDERER_BIG_TEXT_EVENT=BIG_TEXT_EVENT;
