import {QuestionRenderer as BaseQuestionRenderer} from '../test-prep-v2/question-renderer.js?bold-base=1';

function replaceInlineBoldInTextNode(node){
  const text=node.nodeValue||'';
  if(!text.includes('**'))return;
  const re=/\*\*([^*]+?)\*\*/g;
  let m,last=0,changed=false;
  const frag=document.createDocumentFragment();
  while((m=re.exec(text))){
    changed=true;
    if(m.index>last)frag.appendChild(document.createTextNode(text.slice(last,m.index)));
    const strong=document.createElement('strong');
    strong.textContent=m[1];
    frag.appendChild(strong);
    last=re.lastIndex;
  }
  if(!changed)return;
  if(last<text.length)frag.appendChild(document.createTextNode(text.slice(last)));
  node.replaceWith(frag);
}

function fixSplitBoldMarkers(root){
  // The canonical renderer can split `**phrase**` into:
  // text("**") + <span class="u">phrase</span> + text("**").
  // Wrap that existing span without replacing the surrounding interactive element.
  const elements=[...root.querySelectorAll('.u')];
  for(const el of elements){
    const prev=el.previousSibling,next=el.nextSibling;
    if(prev?.nodeType!==Node.TEXT_NODE||next?.nodeType!==Node.TEXT_NODE)continue;
    const left=prev.nodeValue||'',right=next.nodeValue||'';
    if(!left.endsWith('**')||!right.startsWith('**'))continue;
    prev.nodeValue=left.slice(0,-2);
    next.nodeValue=right.slice(2);
    const strong=document.createElement('strong');
    el.replaceWith(strong);
    strong.appendChild(el);
  }
}

function applyBoldMarkup(root){
  if(!root)return;
  fixSplitBoldMarkers(root);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(replaceInlineBoldInTextNode);
}

export class QuestionRenderer extends BaseQuestionRenderer{
  render(question,options={}){
    super.render(question,options);
    applyBoldMarkup(this.host);
    return this;
  }
  showFeedback(result){
    super.showFeedback(result);
    applyBoldMarkup(this.host);
  }
}
