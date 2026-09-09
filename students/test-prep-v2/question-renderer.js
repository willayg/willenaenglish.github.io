import {FORMS,parseCorrection} from './question-model.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const display=v=>String(v??'')
  .replace(/\\+r\\+n/g,'\n')
  .replace(/\\+n/g,'\n')
  .replace(/\\+r/g,'\n');
const textHtml=v=>esc(display(v)).replace(/\n/g,'<br>');
const LABELS={korean:'우리말',korean_b:'우리말',definition:'영영풀이',initial:'주어진 철자',sentence:'문장',sentences:'문장',dialogue:'대화',passage:'윗글',source_passage:'원문',rewritten:'바꿔 쓴 글',question:'질문',questions:'질문',conditions:'조건',words:'보기',given:'보기',provided_words:'보기',word_bank:'보기',bank:'보기',options:'보기',choices:'보기',segments:'보기',rules:'규칙',relation:'관계',base_word:'주어진 단어',setup:'조건',items:'문장',pairs:'보기',clues:'문제 단서',statements:'문장',claims:'설명',table:'표',source:'자료',source_sentence:'문장',source_phrase:'표현',phrase:'표현',example:'예문',incorrect:'고칠 문장',original:'원문',comparison:'비교',target:'대상',pattern:'형식',word_count:'단어 수',given_sentence:'보기',masked:'문장'};
const PREFERRED=['korean','korean_b','definition','initial','base_word','setup','sentence','sentences','dialogue','passage','source_passage','rewritten','question','questions','conditions','words','given','provided_words','word_bank','bank','options','choices','segments','rules','relation','given_sentence','items','pairs','clues','statements','claims','table','source','source_sentence','source_phrase','phrase','example','incorrect','original','comparison','target','pattern','word_count','masked'];
const COMPACT_LIST_KEYS=new Set(['words','given','provided_words','word_bank','bank','options']);
const HIDDEN_CONTEXT_KEYS=new Set(['underlined','underlined_spans','chunks','target_en','prompt_ko','passage_anchor','source_anchor']);
const MARKS=['ⓐ','ⓑ','ⓒ','ⓓ','ⓔ','ⓕ','ⓖ','ⓗ'];

function hiddenContextKey(key){return HIDDEN_CONTEXT_KEYS.has(key)||/(^|_)id$/i.test(String(key||''))}
function spans(context){
  const out=[];
  if(context?.underlined)out.push(context.underlined);
  if(Array.isArray(context?.underlined_spans))out.push(...context.underlined_spans);
  return [...new Set(out.map(display).filter(Boolean))];
}
function marked(value,under=[]){
  const src=display(value);
  if(!src||!under.length)return textHtml(src);
  const hits=[];
  for(const rawNeedle of under){
    const needle=display(rawNeedle);if(!needle)continue;
    let p=0;
    while(p<src.length){
      const i=src.indexOf(needle,p);if(i<0)break;hits.push([i,i+needle.length]);p=i+needle.length;
    }
  }
  if(!hits.length)return textHtml(src);
  hits.sort((a,b)=>a[0]-b[0]||b[1]-a[1]);
  const merged=[];
  for(const h of hits){const last=merged[merged.length-1];if(!last||h[0]>=last[1])merged.push([...h]);else last[1]=Math.max(last[1],h[1])}
  let out='',p=0;
  for(const [a,b] of merged){out+=textHtml(src.slice(p,a))+`<span class="u">${textHtml(src.slice(a,b))}</span>`;p=b}
  return out+textHtml(src.slice(p));
}
function markerOnly(value){return /^[ⓐ-ⓩ①-⑳]+$/u.test(display(value).trim())}
function promptHtml(question){
  const src=display(question?.prompt||''),under=spans(question?.context||{});
  if(!src||!under.length)return textHtml(src);
  const markers=under.filter(markerOnly).filter(x=>src.includes(x));
  if(markers.length){
    const hits=markers.map(marker=>({marker,start:src.indexOf(marker)})).filter(x=>x.start>=0).sort((a,b)=>a.start-b.start);
    let out='',p=0;
    for(let i=0;i<hits.length;i++){
      const cur=hits[i],next=hits[i+1]?.start??src.length;
      const bodyStart=cur.start+cur.marker.length;
      let bodyEnd=next;
      while(bodyEnd>bodyStart&&/\s/.test(src[bodyEnd-1]))bodyEnd--;
      out+=textHtml(src.slice(p,bodyStart));
      if(bodyEnd>bodyStart)out+=`<span class="u">${textHtml(src.slice(bodyStart,bodyEnd))}</span>`;
      out+=textHtml(src.slice(bodyEnd,next));
      p=next;
    }
    if(p<src.length)out+=textHtml(src.slice(p));
    return out;
  }
  return marked(src,under);
}
function printable(value){
  if(value==null)return'';
  if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')return String(value);
  if(Array.isArray(value))return value.map(printable).filter(x=>x!==''&&(!Array.isArray(x)||x.length));
  if(typeof value==='object'){
    return Object.entries(value).map(([k,v])=>{const pv=printable(v),text=Array.isArray(pv)?pv.join(' / '):String(pv||'');return text?`${LABELS[k]||k.replace(/_/g,' ')}: ${text}`:''}).filter(Boolean).join(' · ');
  }
  return String(value);
}
function block(key,value,under=[]){
  const val=printable(value);if(val===''||(Array.isArray(val)&&!val.length))return'';
  const label=LABELS[key]||key.replace(/_/g,' ');
  if(Array.isArray(val)){
    const compact=COMPACT_LIST_KEYS.has(key)?' compact':'';
    return `<div class="context-block"><div class="context-label">${esc(label)}</div><div class="context-list${compact}">${val.map(x=>`<div class="context-item">${marked(x,under)}</div>`).join('')}</div></div>`;
  }
  return `<div class="context-block"><div class="context-label">${esc(label)}</div><div class="context-value">${marked(val,under)}</div></div>`;
}
function contextHtml(question){
  const c=question?.context&&typeof question.context==='object'&&!Array.isArray(question.context)?question.context:{};
  const under=spans(c),seen=new Set(),out=[];
  for(const key of PREFERRED){if(hiddenContextKey(key))continue;if(Object.prototype.hasOwnProperty.call(c,key)){seen.add(key);out.push(block(key,c[key],under))}}
  for(const [key,value] of Object.entries(c)){if(seen.has(key)||hiddenContextKey(key))continue;out.push(block(key,value,under))}
  return out.filter(Boolean).join('');
}
function answerParts(question){return Array.isArray(question?.answer)?question.answer:[]}
function numberMark(i){return ['①','②','③','④','⑤','⑥','⑦','⑧'][i]||String(i+1)}
function inputLanguage(q){return String(q?.input?.language||'mixed')}
function inputAttrs(q,kind='text'){
  const lang=inputLanguage(q),nativeLang=lang==='ko'?'ko':lang==='en'?'en':'';
  const attrs=[`data-willena-text-entry="${esc(kind)}"`,`data-input-language="${esc(lang)}"`,'autocomplete="off"','spellcheck="false"'];
  if(nativeLang)attrs.push(`lang="${nativeLang}"`);
  if(lang==='en')attrs.push('autocapitalize="off"','autocorrect="off"');
  return attrs.join(' ');
}
function placeholder(q,part=null){
  const lang=inputLanguage(q),prefix=part==null?'':`${part} `;
  if(lang==='ko')return `${prefix}우리말 답을 입력하세요`;
  if(lang==='en')return `${prefix}영어 답을 입력하세요`;
  return `${prefix}답을 입력하세요`;
}
function guidanceHtml(q){
  const c=q?.grading?.constraints||{},items=[];
  if(c.wordCount)items.push(`정확히 ${c.wordCount}단어`);
  if(Array.isArray(c.partWordCounts)&&c.partWordCounts.some(Boolean))items.push(c.partWordCounts.map((n,i)=>n?`${MARKS[i]||i+1} ${n}단어`:null).filter(Boolean).join(' · '));
  if(c.noContractions)items.push('축약형 사용 금지');
  if(c.contractionRequired)items.push('축약형 사용');
  return items.length?`<div class="exam-meta answer-guidance">${items.map(x=>`<span class="pill">${esc(x)}</span>`).join('')}</div>`:'';
}
function modelAnswerHtml(q,answers){
  const a=Array.isArray(answers)?answers:[answers];
  if(q?.form===FORMS.multipart||q?.form===FORMS.correction||q?.form===FORMS.identifiedCorrection)return `<div class="model-list">${a.map((x,i)=>`<div><b>${MARKS[i]||i+1}</b><span>${textHtml(x)}</span></div>`).join('')}</div>`;
  return textHtml(a.join(' / '));
}

export class QuestionRenderer{
  constructor(host){this.host=host;this.question=null;this.state={};this.disabled=false;this.onChange=null}
  render(question,{onChange}={}){
    this.question=question;this.state={selected:new Set(),order:[],blank:[]};this.disabled=false;this.onChange=typeof onChange==='function'?onChange:null;
    const controls=this.controls(question);
    this.host.innerHTML=`<div class="prompt">${promptHtml(question)}</div><div class="context">${contextHtml(question)}</div>${guidanceHtml(question)}<div data-answer>${controls}</div><div class="feedback" data-feedback></div>`;
    this.bind(question);this.emit();return this;
  }
  controls(q){
    if(q.form===FORMS.choice||q.form===FORMS.multi)return `<div class="choices">${q.choices.map((x,i)=>`<button type="button" class="choice" data-choice="${i+1}"><span>${numberMark(i)}</span> ${textHtml(x)}</button>`).join('')}</div>`;
    if(q.form===FORMS.write)return `<textarea class="answer" data-write ${inputAttrs(q,'write')} placeholder="${esc(placeholder(q))}"></textarea>`;
    if(q.form===FORMS.multipart)return `<div class="structured">${answerParts(q).map((_,i)=>`<div class="part-row"><div class="row-label">${MARKS[i]||i+1}</div><input class="text-input" data-part="${i}" ${inputAttrs(q,'part')} placeholder="${esc(placeholder(q,`답 ${i+1}`))}"></div>`).join('')}</div>`;
    if(q.form===FORMS.correction)return `<div class="structured">${answerParts(q).map((a,i)=>{parseCorrection(a);return `<div class="correction-row"><div class="row-label">${MARKS[i]||i+1}</div><input class="text-input" data-wrong="${i}" ${inputAttrs(q,'correction-wrong')} placeholder="틀린 부분"><div class="arrow">→</div><input class="text-input" data-right="${i}" ${inputAttrs(q,'correction-right')} placeholder="고친 부분"></div>`}).join('')}</div>`;
    if(q.form===FORMS.identifiedCorrection)return `<div class="structured">${answerParts(q).map((_,i)=>`<div class="correction-row"><input class="text-input" style="text-align:center;padding-left:4px;padding-right:4px" data-correction-label="${i}" ${inputAttrs(q,'correction-label')} placeholder="번호"><input class="text-input" data-wrong="${i}" ${inputAttrs(q,'correction-wrong')} placeholder="틀린 부분"><div class="arrow">→</div><input class="text-input" data-right="${i}" ${inputAttrs(q,'correction-right')} placeholder="고친 부분"></div>`).join('')}</div>`;
    if(q.form===FORMS.order||q.form===FORMS.chunks){const chips=Array.isArray(q.chips)?q.chips:[];return `<div class="build" data-build></div><div class="chips" data-pool>${chips.map((x,i)=>`<button type="button" class="chip" data-chip="${i}">${esc(x)}</button>`).join('')}</div>`}
    if(q.form===FORMS.blanks){const masked=String(q.context?.masked||'');const chips=Array.isArray(q.chips)?q.chips:[];return `<div class="masked">${textHtml(masked)}</div><div class="build" data-build></div><div class="chips" data-pool>${chips.map((x,i)=>`<button type="button" class="chip" data-chip="${i}">${esc(x)}</button>`).join('')}</div>`}
    if(q.form===FORMS.learn)return `<div class="learn">${textHtml(answerParts(q)[0]||q.context?.target_en||'')}</div>`;
    return `<div class="error">Unsupported question form: ${esc(q.form||'unknown')}</div>`;
  }
  bind(q){
    if(q.form===FORMS.choice||q.form===FORMS.multi){
      this.host.querySelectorAll('[data-choice]').forEach(btn=>btn.addEventListener('click',()=>{if(this.disabled)return;const key=String(btn.dataset.choice);if(q.form===FORMS.multi){this.state.selected.has(key)?this.state.selected.delete(key):this.state.selected.add(key)}else{this.state.selected=new Set([key])}this.host.querySelectorAll('[data-choice]').forEach(x=>x.classList.toggle('selected',this.state.selected.has(String(x.dataset.choice))));this.emit()}));
      return;
    }
    this.host.querySelectorAll('input,textarea').forEach(el=>el.addEventListener('input',()=>this.emit()));
    if([FORMS.order,FORMS.chunks,FORMS.blanks].includes(q.form)){
      this.host.querySelectorAll('[data-chip]').forEach(btn=>btn.addEventListener('click',()=>{if(this.disabled)return;const i=Number(btn.dataset.chip);if(this.state.order.includes(i)){this.state.order=this.state.order.filter(x=>x!==i)}else this.state.order.push(i);this.syncOrder();this.emit()}));
      this.host.querySelector('[data-build]')?.addEventListener('click',e=>{const btn=e.target.closest('[data-built]');if(!btn||this.disabled)return;const i=Number(btn.dataset.built);this.state.order=this.state.order.filter(x=>x!==i);this.syncOrder();this.emit()});
    }
  }
  syncOrder(){
    const chips=[...this.host.querySelectorAll('[data-chip]')],build=this.host.querySelector('[data-build]');if(!build)return;
    build.innerHTML=this.state.order.map(i=>`<button type="button" class="chip" data-built="${i}">${esc(chips[i]?.textContent||'')}</button>`).join('');
    chips.forEach((b,i)=>b.classList.toggle('used',this.state.order.includes(i)));
  }
  emit(){this.onChange?.(this.getResponse(),this.hasResponse())}
  hasResponse(){
    const q=this.question;if(!q)return false;
    if(q.form===FORMS.choice||q.form===FORMS.multi)return this.state.selected.size>0;
    if(q.form===FORMS.write)return !!this.host.querySelector('[data-write]')?.value.trim();
    if(q.form===FORMS.multipart){const fields=[...this.host.querySelectorAll('[data-part]')];return fields.length>0&&fields.every(x=>x.value.trim())}
    if(q.form===FORMS.correction){const fields=[...this.host.querySelectorAll('[data-wrong],[data-right]')];return fields.length>0&&fields.every(x=>x.value.trim())}
    if(q.form===FORMS.identifiedCorrection){const fields=[...this.host.querySelectorAll('[data-correction-label],[data-wrong],[data-right]')];return fields.length>0&&fields.every(x=>x.value.trim())}
    if([FORMS.order,FORMS.chunks,FORMS.blanks].includes(q.form))return this.state.order.length>0;
    return q.form===FORMS.learn;
  }
  getResponse(){
    const q=this.question;if(!q)return null;
    if(q.form===FORMS.choice||q.form===FORMS.multi)return [...this.state.selected];
    if(q.form===FORMS.write)return this.host.querySelector('[data-write]')?.value.trim()||'';
    if(q.form===FORMS.multipart)return [...this.host.querySelectorAll('[data-part]')].map(x=>x.value.trim());
    if(q.form===FORMS.correction)return answerParts(q).map((a,i)=>{const wrong=this.host.querySelector(`[data-wrong="${i}"]`)?.value.trim()||'',right=this.host.querySelector(`[data-right="${i}"]`)?.value.trim()||'';return `${wrong} → ${right}`});
    if(q.form===FORMS.identifiedCorrection)return answerParts(q).map((_,i)=>{const label=this.host.querySelector(`[data-correction-label="${i}"]`)?.value.trim().replace(/:$/,'')||'',wrong=this.host.querySelector(`[data-wrong="${i}"]`)?.value.trim()||'',right=this.host.querySelector(`[data-right="${i}"]`)?.value.trim()||'';return `${label}: ${wrong} → ${right}`});
    if([FORMS.order,FORMS.chunks,FORMS.blanks].includes(q.form)){const chips=[...this.host.querySelectorAll('[data-chip]')];const values=this.state.order.map(i=>chips[i]?.textContent.trim()||'');return q.form===FORMS.blanks?values:values.join(' ')}
    if(q.form===FORMS.learn)return answerParts(q)[0]||'';
    return null;
  }
  showFeedback(result){
    const f=this.host.querySelector('[data-feedback]');if(!f)return;
    f.className=`feedback show ${result.correct?'ok':'bad'}`;
    const answers=Array.isArray(result.correctAnswer)?result.correctAnswer:[result.correctAnswer].filter(x=>x!=null);
    f.innerHTML=result.correct?'정답입니다!':`${textHtml(result.message||'정답을 확인해 보세요.')}${answers.length?`<div class="model"><b>모범 답안</b>${modelAnswerHtml(this.question,answers)}</div>`:''}`;
    if([FORMS.choice,FORMS.multi].includes(this.question?.form)){
      const right=new Set((Array.isArray(this.question.answer)?this.question.answer:[]).map(String)),selected=this.state.selected;
      this.host.querySelectorAll('[data-choice]').forEach(btn=>{const k=String(btn.dataset.choice);btn.classList.remove('selected');if(right.has(k))btn.classList.add('correct');else if(selected.has(k))btn.classList.add('wrong')});
    }
  }
  setDisabled(disabled=true){this.disabled=!!disabled;this.host.querySelectorAll('button,input,textarea').forEach(x=>x.disabled=this.disabled);return this}
}
