import {QuestionRenderer} from '../test-prep-v2/question-renderer.js';
import {FORMS} from '../test-prep-v2/question-model.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numberMark=i=>['①','②','③','④','⑤','⑥','⑦','⑧'][i]||String(i+1);
function marked(value,needles=[]){
  const src=String(value??'');if(!src||!needles.length)return esc(src);
  const hits=[];for(const raw of needles){const needle=String(raw??'');if(!needle)continue;let p=0;while(p<src.length){const i=src.indexOf(needle,p);if(i<0)break;hits.push([i,i+needle.length]);p=i+needle.length}}
  if(!hits.length)return esc(src);hits.sort((a,b)=>a[0]-b[0]||b[1]-a[1]);const merged=[];for(const h of hits){const last=merged[merged.length-1];if(!last||h[0]>=last[1])merged.push([...h]);else last[1]=Math.max(last[1],h[1])}
  let out='',p=0;for(const [a,b] of merged){out+=esc(src.slice(p,a))+`<span class="u">${esc(src.slice(a,b))}</span>`;p=b}return out+esc(src.slice(p));
}

const originalControls=QuestionRenderer.prototype.controls;
QuestionRenderer.prototype.controls=function(q){
  if(q?.form!==FORMS.choice&&q?.form!==FORMS.multi)return originalControls.call(this,q);
  const c=q?.context||{},explicit=Array.isArray(c.underlined_by_choice)?c.underlined_by_choice:[],spans=Array.isArray(c.underlined_spans)?c.underlined_spans:[];
  const perChoice=explicit.length===q.choices.length?explicit:(spans.length===q.choices.length&&spans.some((s,i)=>String(s)!==String(q.choices[i]))?spans:null);
  if(!perChoice)return originalControls.call(this,q);
  return `<div class="choices">${q.choices.map((x,i)=>`<button type="button" class="choice" data-choice="${i+1}"><span>${numberMark(i)}</span> ${marked(x,[perChoice[i]])}</button>`).join('')}</div>`;
};

function hideInternalUnderlineMetadata(host){
  if(!host)return;
  host.querySelectorAll('.context-block').forEach(block=>{
    const raw=block.querySelector('.context-label')?.textContent||'';
    const label=raw.trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ');
    if(label==='underlined by choice')block.remove();
  });
}

const originalRender=QuestionRenderer.prototype.render;
QuestionRenderer.prototype.render=function(q,...args){
  const result=originalRender.call(this,q,...args);
  if(Array.isArray(q?.context?.underlined_by_choice)){
    hideInternalUnderlineMetadata(this.host);
    queueMicrotask(()=>hideInternalUnderlineMetadata(this.host));
  }
  return result;
};

// Defensive: if another render-layer patch inserts/rebuilds context after render,
// strip this internal metadata block as soon as it appears.
const observer=new MutationObserver(records=>{
  for(const record of records){
    for(const node of record.addedNodes){
      if(node.nodeType!==1)continue;
      const host=node.closest?.('#card')||node.querySelector?.('#card');
      if(host)hideInternalUnderlineMetadata(host);
      else if(node.matches?.('.context-block')||node.querySelector?.('.context-block'))hideInternalUnderlineMetadata(document.getElementById('card'));
    }
  }
});
observer.observe(document.documentElement,{childList:true,subtree:true});

console.log('[Render Lab] per-choice underline engine: inline targets on, metadata box hidden');
