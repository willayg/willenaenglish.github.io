import {QuestionRenderer as BaseQuestionRenderer} from './question-renderer.js?v=2.20.2';

const HIDDEN_CONTEXT_KEYS=new Set(['transcription_status','transcript_status','source_page']);

function cleanQuestion(question){
  if(!question||typeof question!=='object')return question;
  const raw=question.context;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return question;
  const context={...raw};
  for(const key of HIDDEN_CONTEXT_KEYS)delete context[key];
  return{...question,context};
}
function replaceInlineBoldInTextNode(node){
  const text=node.nodeValue||'';
  if(!text.includes('**'))return;
  const re=/\*\*([^*]+?)\*\*/g;
  let m,last=0,changed=false;
  const frag=document.createDocumentFragment();
  while((m=re.exec(text))){
    changed=true;
    if(m.index>last)frag.appendChild(document.createTextNode(text.slice(last,m.index)));
    const strong=document.createElement('strong');strong.textContent=m[1];frag.appendChild(strong);last=re.lastIndex;
  }
  if(!changed)return;
  if(last<text.length)frag.appendChild(document.createTextNode(text.slice(last)));
  node.replaceWith(frag);
}
function fixSplitBoldMarkers(root){
  for(const el of [...root.querySelectorAll('.u')]){
    const prev=el.previousSibling,next=el.nextSibling;
    if(prev?.nodeType!==Node.TEXT_NODE||next?.nodeType!==Node.TEXT_NODE)continue;
    const left=prev.nodeValue||'',right=next.nodeValue||'';
    if(!left.endsWith('**')||!right.startsWith('**'))continue;
    prev.nodeValue=left.slice(0,-2);next.nodeValue=right.slice(2);
    const strong=document.createElement('strong');el.replaceWith(strong);strong.appendChild(el);
  }
}
function applyBoldMarkup(root){
  if(!root)return;
  fixSplitBoldMarkers(root);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(replaceInlineBoldInTextNode);
}

export class QuestionRenderer extends BaseQuestionRenderer{
  render(question,options={}){
    super.render(cleanQuestion(question),options);
    applyBoldMarkup(this.host);
    return this;
  }
  showFeedback(result){
    super.showFeedback(result);
    applyBoldMarkup(this.host);
  }
}
