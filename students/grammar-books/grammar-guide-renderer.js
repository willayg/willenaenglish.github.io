import {guides} from './grammar-guides-core.js?v=20261126-guide1';
import {advancedGuides} from './grammar-guides-advanced.js?v=20261126-guide1';
const all={...guides,...advancedGuides};
const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n};
function highlighted(node,text){
 for(const part of String(text).split(/(\[[^\]]+\])/g)){
  if(!part)continue;
  if(part.startsWith('[')&&part.endsWith(']'))node.append(el('strong','gg-guide-highlight',part.slice(1,-1)));
  else node.append(document.createTextNode(part));
 }
}
function examplesDiagram(key,unit,index,section){
 const counts=(key==='buzz1'&&[4,5].includes(unit)&&index===0)||(key==='eu2'&&unit===6&&index===0)||(key==='buzz3'&&[3,8].includes(unit)&&index===0);
 if(counts){
  const strip=el('div','gg-guide-compare');
  for(const [count,word] of [[1,unit===8?'was':'is'],[2,unit===8?'were':'are']]){
   const cell=el('div','gg-guide-compare-cell'),objects=el('div','gg-guide-objects');
   objects.setAttribute('aria-hidden','true');
   for(let i=0;i<count;i++)objects.append(el('span','gg-guide-object'));
   cell.append(objects,el('small','',count===1?'하나':'여러 개'),el('strong','gg-guide-highlight',word));strip.append(cell);
  }
  section.append(strip);
 }
 if((key==='buzz4'&&unit===1&&index===2)||(key==='eu5'&&unit===5&&index===0)){
  const meter=el('div','gg-guide-frequency');
  for(const [word,ko,f] of [['always','항상',5],['usually','보통',4],['often','자주',3],['sometimes','가끔',2],['never','전혀 안 함',0]]){
   const row=el('div','gg-guide-frequency-row'),dots=el('span','gg-guide-frequency-dots');
   for(let i=0;i<5;i++)dots.append(el('i',i<f?'is-filled':''));
   dots.setAttribute('aria-hidden','true');row.append(el('strong','',word),dots,el('small','',ko));meter.append(row);
  }
  section.append(meter,el('small','gg-guide-diagram-note','점은 빈도의 상대적인 차이를 보여 줘요.'));
 }
 if((key==='buzz6'&&unit===1&&index===1)||(key==='eu6'&&unit===3&&index===2)){
  const time=el('div','gg-guide-timeline');time.append(el('span','gg-guide-since','since · 시작 시점'),el('div','gg-guide-time-line'),el('div','gg-guide-time-labels'));
  time.lastChild.append(el('span','','과거'),el('span','','지금'));
  time.append(el('div','gg-guide-duration','for · 이어진 기간'));section.append(time);
 }
}
export function renderGrammarGuide(container,key,unit){
 const guide=all[key]?.[Number(unit)-1];
 if(!guide)return false;
 const beginner=key==='buzz1'||key==='eu2';
 container.replaceChildren();
 const wrap=el('div','gg-guide'+(beginner?' gg-guide-beginner':''));
 wrap.append(el('h3','gg-guide-title',guide[0]));
 guide.slice(1).forEach((block,index)=>{
  const [title,rule,...pairs]=block.split('|');
  const section=el('section','gg-guide-section');
  section.append(el('h4','gg-guide-section-title',title),el('p','gg-guide-rule',rule));
  examplesDiagram(key,Number(unit),index,section);
  const examples=el('div','gg-guide-examples');
  for(let i=0;i<pairs.length;i+=2){
   const item=el('div','gg-guide-example'),en=el('div','gg-guide-en');
   en.lang='en';highlighted(en,pairs[i]);item.append(en,el('div','gg-guide-ko',pairs[i+1]));examples.append(item);
  }
  section.append(examples);wrap.append(section);
 });
 container.append(wrap);return true;
}
