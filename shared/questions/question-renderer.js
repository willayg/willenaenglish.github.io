import {FORMS,parseCorrection} from './question-types.js?v=20260925-speaking1';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const display=v=>String(v??'')
  .replace(/\\+r\\+n/g,'\n')
  .replace(/\\+n/g,'\n')
  .replace(/\\+r/g,'\n');
const textHtml=v=>esc(display(v)).replace(/\n/g,'<br>');
const LABELS={korean:'우리말',korean_b:'우리말',definition:'영영풀이',initial:'주어진 철자',sentence:'문장',sentences:'문장',dialogue:'대화',passage:'윗글',source_passage:'원문',rewritten:'바꿔 쓴 글',question:'질문',questions:'질문',conditions:'조건',words:'보기',given:'보기',provided_words:'보기',word_bank:'보기',bank:'보기',options:'보기',choices:'보기',segments:'보기',rules:'규칙',relation:'관계',base_word:'주어진 단어',setup:'조건',items:'문장',pairs:'보기',clues:'문제 단서',statements:'문장',claims:'설명',table:'표',source:'자료',source_sentence:'문장',source_phrase:'표현',phrase:'표현',example:'예문',incorrect:'고칠 문장',original:'원문',comparison:'비교',target:'대상',pattern:'형식',word_count:'단어 수',given_sentence:'보기',masked:'문장'};
const PREFERRED=['korean','korean_b','definition','initial','base_word','setup','sentence','sentences','dialogue','passage','source_passage','rewritten','question','questions','conditions','words','given','provided_words','word_bank','bank','options','choices','segments','rules','relation','given_sentence','items','pairs','clues','statements','claims','table','source','source_sentence','source_phrase','phrase','example','incorrect','original','comparison','target','pattern','word_count','masked'];
const COMPACT_LIST_KEYS=new Set(['words','given','provided_words','word_bank','bank','options']);
const HIDDEN_CONTEXT_KEYS=new Set(['underlined','underlined_spans','chunks','target_en','audio_text','prompt_ko','passage_anchor','source_anchor','transcription_status','transcript_status','source_page']);
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
function scrambledLetters(value){
  const chars=[...String(value||'')].filter(ch=>/[A-Za-z]/.test(ch));
  if(chars.length<2)return chars;
  const original=chars.join('').toLowerCase();
  for(let attempt=0;attempt<8;attempt++){
    const a=chars.slice();
    for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
    if(a.join('').toLowerCase()!==original)return a;
  }
  return chars.slice().reverse();
}
function spellingChunks(value){
  return String(value||'').trim().split(/\s+/).filter(Boolean).map(word=>{
    const chars=[...word];
    if(chars.length<=3)return [word];
    if(chars.length<=6){
      const cut=Math.ceil(chars.length/2);
      return [chars.slice(0,cut).join(''),chars.slice(cut).join('')];
    }
    const first=Math.ceil(chars.length/3);
    const second=Math.ceil((chars.length-first)/2)+first;
    return [chars.slice(0,first).join(''),chars.slice(first,second).join(''),chars.slice(second).join('')];
  });
}
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
function replaceInlineBoldInTextNode(node){
  const value=node.nodeValue||'';if(!value.includes('**'))return;
  const re=/\*\*([^*]+?)\*\*/g;let m,last=0,changed=false;const frag=document.createDocumentFragment();
  while((m=re.exec(value))){changed=true;if(m.index>last)frag.appendChild(document.createTextNode(value.slice(last,m.index)));const strong=document.createElement('strong');strong.textContent=m[1];frag.appendChild(strong);last=re.lastIndex}
  if(!changed)return;if(last<value.length)frag.appendChild(document.createTextNode(value.slice(last)));node.replaceWith(frag);
}
function fixSplitBoldMarkers(root){
  for(const el of [...root.querySelectorAll('.u')]){
    const prev=el.previousSibling,next=el.nextSibling;if(prev?.nodeType!==Node.TEXT_NODE||next?.nodeType!==Node.TEXT_NODE)continue;
    const left=prev.nodeValue||'',right=next.nodeValue||'';if(!left.endsWith('**')||!right.startsWith('**'))continue;
    prev.nodeValue=left.slice(0,-2);next.nodeValue=right.slice(2);const strong=document.createElement('strong');el.replaceWith(strong);strong.appendChild(el);
  }
}
function applyBoldMarkup(root){
  if(!root)return;fixSplitBoldMarkers(root);const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(replaceInlineBoldInTextNode);
}

export class QuestionRenderer{
  constructor(host){this.host=host;this.question=null;this.state={};this.disabled=false;this.onChange=null}
  render(question,{onChange}={}){
    this.question=question;this.state={selected:new Set(),order:[],blank:[]};this.disabled=false;this.onChange=typeof onChange==='function'?onChange:null;
    if(question?.form===FORMS.spellingCoach)this.ensureSpellingCoachStyles();
    if(question?.form===FORMS.speaking)this.ensureSpeakingStyles();
    const controls=this.controls(question);
    this.host.innerHTML=`<div class="prompt">${promptHtml(question)}</div><div class="context">${contextHtml(question)}</div>${guidanceHtml(question)}<div data-answer>${controls}</div><div class="feedback" data-feedback></div>`;
    this.bind(question);this.emit();applyBoldMarkup(this.host);return this;
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
    if(q.form===FORMS.speaking){
      return `<div class="speaking-control">
        <button type="button" class="speaking-mic" data-speaking-mic aria-label="영어로 말하기">🎤</button>
        <div class="speaking-status" data-speaking-status>마이크를 누르고 영어로 말해 보세요.</div>
        <div class="speaking-transcript" data-speaking-transcript hidden></div>
      </div>`;
    }
    if(q.form===FORMS.spellingCoach){
      const target=answerParts(q)[0]||q.context?.target_en||'';
      const audio=String(q.context?.audio_text||target||'');
      const scramble=q.hints?.scramble!==false;
      const chunks=q.hints?.chunks!==false;
      const hint=scramble?scrambledLetters(target):[];
      const chunkGroups=chunks?spellingChunks(target):[];
      const shuffledChunkGroups=chunkGroups.map(group=>{
        const out=group.slice();
        for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}
        if(out.length>1&&out.join('')===group.join(''))[out[0],out[1]]=[out[1],out[0]];
        return out;
      });
      const chunkHtml=shuffledChunkGroups.map(group=>`<div class="spelling-coach-chunk-word">${group.map(part=>`<span>${esc(part)}</span>`).join('')}</div>`).join('');
      return `${scramble?`<div class="spelling-coach-hint-row"><button type="button" class="spelling-coach-hint-button" data-spelling-hint="scramble">Hint 1 · Letters</button><div class="spelling-coach-scramble" data-spelling-scramble hidden>${hint.map(ch=>`<span>${esc(ch)}</span>`).join('')}</div>${chunks?`<button type="button" class="spelling-coach-hint-button spelling-coach-hint-2" data-spelling-hint="chunks" hidden>Hint 2 · Chunks</button><div class="spelling-coach-chunks" data-spelling-chunks hidden>${chunkHtml}</div>`:''}</div>`:''}<input class="text-input spelling-coach-input" data-spelling-input ${inputAttrs(q,'spelling-coach')} placeholder="${esc(placeholder(q))}"><div class="spelling-study-modal" data-spelling-study-modal role="dialog" aria-modal="true" aria-label="Study target word"><div class="spelling-study-card"><span class="spelling-study-label">STUDY THE WORD</span><strong class="spelling-study-target">${textHtml(target)}</strong>${audio?`<button type="button" class="activity-audio spelling-study-audio" data-spelling-audio data-audio-text="${esc(audio)}">▶ Hear English</button>`:''}<button type="button" class="spelling-study-ready" data-spelling-ready>Ready · 시작</button></div></div>`;
    }
    return `<div class="error">Unsupported question form: ${esc(q.form||'unknown')}</div>`;
  }
  bind(q){
    if(q.form===FORMS.choice||q.form===FORMS.multi){
      this.host.querySelectorAll('[data-choice]').forEach(btn=>btn.addEventListener('click',()=>{if(this.disabled)return;const key=String(btn.dataset.choice);if(q.form===FORMS.multi){this.state.selected.has(key)?this.state.selected.delete(key):this.state.selected.add(key)}else{this.state.selected=new Set([key])}this.host.querySelectorAll('[data-choice]').forEach(x=>x.classList.toggle('selected',this.state.selected.has(String(x.dataset.choice))));this.emit()}));
      return;
    }
    this.host.querySelectorAll('input,textarea').forEach(el=>el.addEventListener('input',()=>this.emit()));
    if(q.form===FORMS.speaking){
      const mic=this.host.querySelector('[data-speaking-mic]');
      const status=this.host.querySelector('[data-speaking-status]');
      const transcript=this.host.querySelector('[data-speaking-transcript]');
      const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!Recognition){
        if(mic)mic.disabled=true;
        if(status)status.textContent='이 브라우저에서는 음성 인식을 사용할 수 없어요.';
        return;
      }
      const recognition=new Recognition();
      this.speechRecognition=recognition;
      recognition.lang='en-US';
      recognition.interimResults=false;
      recognition.maxAlternatives=1;
      recognition.continuous=false;
      const setListening=on=>{
        mic?.classList.toggle('is-listening',!!on);
        if(status)status.textContent=on?'듣고 있어요… 영어로 말해 보세요.':'마이크를 누르고 영어로 말해 보세요.';
      };
      recognition.onstart=()=>setListening(true);
      recognition.onend=()=>setListening(false);
      recognition.onerror=e=>{
        setListening(false);
        if(status)status.textContent=e?.error==='not-allowed'?'마이크 권한이 필요해요.':'잘 듣지 못했어요. 다시 눌러 말해 보세요.';
      };
      recognition.onresult=e=>{
        const value=String(e?.results?.[0]?.[0]?.transcript||'').trim();
        this.state.speakingTranscript=value;
        if(transcript){
          transcript.hidden=!value;
          transcript.textContent=value?('“'+value+'”'):'';
        }
        if(status)status.textContent=value?'이렇게 들었어요.':'잘 듣지 못했어요. 다시 말해 보세요.';
        this.emit();
      };
      mic?.addEventListener('click',()=>{
        if(this.disabled)return;
        try{
          if(mic.classList.contains('is-listening'))recognition.stop();
          else{
            this.state.speakingTranscript='';
            if(transcript){transcript.hidden=true;transcript.textContent=''}
            recognition.start();
          }
        }catch{}
      });
      return;
    }
    if(q.form===FORMS.spellingCoach){
      const input=this.host.querySelector('[data-spelling-input]');
      this.host.querySelectorAll('[data-spelling-audio]').forEach(btn=>btn.addEventListener('click',e=>{
        const word=String(e.currentTarget?.dataset?.audioText||'').trim();
        if(!word||!('speechSynthesis' in window))return;
        try{speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(word);utterance.lang='en-US';speechSynthesis.speak(utterance)}catch{}
      }));
      const modal=this.host.querySelector('[data-spelling-study-modal]');
      const ready=this.host.querySelector('[data-spelling-ready]');
      if(input)input.disabled=true;
      ready?.addEventListener('click',()=>{
        if(modal)modal.remove();
        if(input){input.disabled=false;input.focus()}
      });
      ready?.focus?.();
      this.host.querySelector('[data-spelling-hint="scramble"]')?.addEventListener('click',e=>{
        if(this.disabled)return;
        const panel=this.host.querySelector('[data-spelling-scramble]');
        const hint2=this.host.querySelector('[data-spelling-hint="chunks"]');
        if(panel)panel.hidden=false;
        if(hint2)hint2.hidden=false;
        e.currentTarget.hidden=true;
        this.state.spellingHintLevel=Math.max(Number(this.state.spellingHintLevel||0),1);
      });
      this.host.querySelector('[data-spelling-hint="chunks"]')?.addEventListener('click',e=>{
        if(this.disabled)return;
        const panel=this.host.querySelector('[data-spelling-chunks]');
        if(panel)panel.hidden=false;
        e.currentTarget.hidden=true;
        this.state.spellingHintLevel=Math.max(Number(this.state.spellingHintLevel||0),2);
      });
      requestAnimationFrame(()=>ready?.focus?.());
    }
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
  getSupportLevel(){return Number(this.state.spellingHintLevel||0)}
  hasResponse(){
    const q=this.question;if(!q)return false;
    if(q.form===FORMS.choice||q.form===FORMS.multi)return this.state.selected.size>0;
    if(q.form===FORMS.write)return !!this.host.querySelector('[data-write]')?.value.trim();
    if(q.form===FORMS.multipart){const fields=[...this.host.querySelectorAll('[data-part]')];return fields.length>0&&fields.every(x=>x.value.trim())}
    if(q.form===FORMS.correction){const fields=[...this.host.querySelectorAll('[data-wrong],[data-right]')];return fields.length>0&&fields.every(x=>x.value.trim())}
    if(q.form===FORMS.identifiedCorrection){const fields=[...this.host.querySelectorAll('[data-correction-label],[data-wrong],[data-right]')];return fields.length>0&&fields.every(x=>x.value.trim())}
    if([FORMS.order,FORMS.chunks,FORMS.blanks].includes(q.form))return this.state.order.length>0;
    if(q.form===FORMS.spellingCoach)return !!this.host.querySelector('[data-spelling-input]')?.value.trim();
    if(q.form===FORMS.speaking)return !!String(this.state.speakingTranscript||'').trim();
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
    if(q.form===FORMS.spellingCoach)return this.host.querySelector('[data-spelling-input]')?.value.trim()||'';
    if(q.form===FORMS.speaking)return String(this.state.speakingTranscript||'').trim();
    return null;
  }
  ensureSpeakingStyles(){
    if(document.getElementById('willenaSpeakingStyles'))return;
    const style=document.createElement('style');
    style.id='willenaSpeakingStyles';
    style.textContent=`
      .speaking-control{display:grid;justify-items:center;gap:14px;padding:8px 0 4px}
      .speaking-mic{
        width:96px;height:96px;border-radius:50%;border:3px solid #8c79d9;background:#fff;color:#6e5bc6;
        display:grid;place-items:center;font-size:2.2rem;cursor:pointer;box-shadow:0 10px 28px rgba(95,75,180,.14);
        transition:transform .14s ease,box-shadow .14s ease,background .14s ease
      }
      .speaking-mic:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 14px 32px rgba(95,75,180,.20)}
      .speaking-mic.is-listening{background:#f1edff;box-shadow:0 0 0 8px rgba(140,121,217,.12),0 14px 32px rgba(95,75,180,.20)}
      .speaking-mic:disabled{opacity:.45;cursor:default}
      .speaking-status{color:#607b80;font:750 .9rem Poppins,system-ui,sans-serif;text-align:center}
      .speaking-transcript{
        min-width:min(100%,360px);padding:12px 16px;border:1px solid #ddd8f5;border-radius:14px;background:#faf9ff;
        color:#443b72;font:800 1rem Poppins,system-ui,sans-serif;text-align:center
      }
      .speaking-transcript[hidden]{display:none}
      @media(max-width:560px){.speaking-mic{width:88px;height:88px}}
    `;
    document.head.appendChild(style);
  }
  ensureSpellingCoachStyles(){
    if(document.getElementById('willenaSpellingCoachStyles'))return;
    const style=document.createElement('style');
    style.id='willenaSpellingCoachStyles';
    style.textContent=`
      .spelling-coach-input{
        width:100%;
        min-height:72px;
        padding:16px 22px;
        border:3px solid #dcebed;
        border-radius:22px;
        background:#fff;
        color:#173f46;
        font:800 clamp(1.25rem,4vw,1.8rem) Poppins,system-ui,sans-serif;
        text-align:center;
        outline:none;
        box-shadow:0 8px 22px rgba(34,106,116,.07);
        transition:border-color .14s ease,box-shadow .14s ease,background .14s ease;
      }
      .spelling-coach-input:focus{
        border-color:#66d6df;
        background:#fbfeff;
        box-shadow:0 0 0 5px rgba(102,214,223,.16),0 10px 26px rgba(34,106,116,.08);
      }
      .spelling-study-modal{
        position:fixed;inset:0;z-index:2147482000;display:grid;place-items:center;padding:22px;
        background:rgba(18,47,53,.58);backdrop-filter:blur(8px)
      }
      .spelling-study-card{
        width:min(92vw,520px);padding:30px 24px 26px;border-radius:26px;background:#fff;
        border:2px solid #dff2f4;box-shadow:0 24px 70px rgba(16,52,58,.24);text-align:center
      }
      .spelling-study-label{display:block;color:#e60076;font:800 .78rem Poppins,system-ui,sans-serif;letter-spacing:.08em}
      .spelling-study-target{display:block;margin:12px 0 18px;color:#244f56;font:900 clamp(2rem,9vw,4rem) Poppins,system-ui,sans-serif;line-height:1.05;letter-spacing:-.03em}
      .spelling-study-audio{margin:0 auto 16px}
      .spelling-study-ready{
        width:100%;min-height:56px;border:3px solid #e60076;border-radius:18px;background:#fff;color:#e60076;
        font:900 1rem Poppins,system-ui,sans-serif;cursor:pointer
      }
      .spelling-coach-hint-row{margin:16px 0 28px;text-align:center}
      .spelling-coach-hint-button{
        min-height:44px;padding:0 16px;border:2px solid #ffd1e8;border-radius:15px;
        background:#fff;color:#e60076;font:800 .86rem Poppins,system-ui,sans-serif;cursor:pointer
      }
      .spelling-coach-scramble{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:14px}
      .spelling-coach-scramble[hidden]{display:none}
      .spelling-coach-scramble span{
        min-width:38px;height:42px;padding:0 9px;display:grid;place-items:center;border:2px solid #dcebed;
        border-radius:12px;background:#f8fcfc;color:#173f46;font:800 1.05rem Poppins,system-ui,sans-serif
      }
      .spelling-coach-hint-2{margin-top:14px}
      .spelling-coach-chunks{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:14px}
      .spelling-coach-chunks[hidden]{display:none}
      .spelling-coach-chunk-word{display:flex;gap:6px}
      .spelling-coach-chunk-word span{
        min-height:42px;padding:0 12px;display:grid;place-items:center;border:2px solid #bfe5e8;
        border-radius:12px;background:#e9fbfc;color:#315e64;font:800 1rem Poppins,system-ui,sans-serif
      }
      @media(max-width:560px){
        .spelling-coach-input{min-height:68px;padding:14px 18px;border-radius:20px;font-size:1.35rem}
      }
    `;
    document.head.appendChild(style);
  }
  removeGraderOverlay(){
    const overlay=document.querySelector('.grader-blocking-overlay');
    if(!overlay)return;
    const bodyOverflow=overlay.dataset.bodyOverflow??'';
    const htmlOverflow=overlay.dataset.htmlOverflow??'';
    overlay.remove();
    document.body.style.overflow=bodyOverflow;
    document.documentElement.style.overflow=htmlOverflow;
  }
  ensureGraderOverlayStyles(){
    if(document.getElementById('graderBlockingOverlayStyles'))return;
    const style=document.createElement('style');
    style.id='graderBlockingOverlayStyles';
    style.textContent=`
      @keyframes graderOverlaySpin{to{transform:rotate(360deg)}}
      @keyframes graderOverlayPulse{0%,100%{opacity:.55}50%{opacity:1}}
      .grader-blocking-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:22px;background:
        linear-gradient(rgba(5,10,18,.94),rgba(5,10,18,.94)),
        repeating-linear-gradient(0deg,rgba(49,226,255,.035) 0,rgba(49,226,255,.035) 1px,transparent 1px,transparent 4px);
        backdrop-filter:blur(10px);overscroll-behavior:none;touch-action:none}
      .grader-blocking-card{position:relative;overflow:hidden;width:min(92vw,520px);padding:30px 24px 26px;border-radius:22px;background:#08111d;color:#e8fbff;border:1px solid rgba(61,224,255,.62);box-shadow:0 0 0 1px rgba(255,63,190,.12),0 0 32px rgba(28,215,255,.18),0 24px 70px rgba(0,0,0,.55);text-align:center;font-family:Poppins,system-ui,sans-serif}
      .grader-blocking-card:before{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(120deg,transparent 0 42%,rgba(47,231,255,.06) 50%,transparent 58%)}
      .grader-blocking-mark{display:flex;align-items:center;justify-content:center;width:60px;height:60px;margin:0 auto 18px;border-radius:14px;background:rgba(255,61,190,.08);color:#ff65c3;border:1px solid rgba(255,101,195,.58);box-shadow:0 0 24px rgba(255,61,190,.22);font-size:30px;font-weight:900}
      .grader-blocking-spinner{width:62px;height:62px;margin:0 auto 20px;border:5px solid rgba(43,222,255,.14);border-top-color:#35e3ff;border-right-color:#ff5bc1;border-radius:50%;box-shadow:0 0 24px rgba(53,227,255,.18);animation:graderOverlaySpin .75s linear infinite}
      .grader-blocking-title{position:relative;margin:0;font-size:26px;line-height:1.3;font-weight:900;color:#f4fdff;text-shadow:0 0 18px rgba(53,227,255,.18)}
      .grader-blocking-message{position:relative;margin:15px 0 0;font-size:20px;line-height:1.7;font-weight:700;color:#b9d7df;white-space:pre-wrap}
      .grader-blocking-wait{position:relative;margin-top:15px;font-size:15px;font-weight:800;letter-spacing:.04em;color:#57eaff;animation:graderOverlayPulse 1.15s ease-in-out infinite}
      .grader-blocking-action{position:relative;width:100%;min-height:52px;margin-top:24px;padding:0 18px;border:1px solid #3ce6ff;border-radius:13px;background:linear-gradient(90deg,#0b2531,#161c3a);color:#eaffff;box-shadow:0 0 18px rgba(60,230,255,.14);font:800 16px Poppins,system-ui,sans-serif;cursor:pointer}
      .grader-blocking-action:active{transform:translateY(1px)}
      .grader-blocking-action:focus-visible{outline:3px solid rgba(60,230,255,.28);outline-offset:3px}
      @media(prefers-reduced-motion:reduce){.grader-blocking-spinner,.grader-blocking-wait{animation:none}}
    `;
    document.head.appendChild(style);
  }
  mountGraderOverlay({mode='thinking',title='',message='',onDismiss=null}={}){
    this.removeGraderOverlay();
    this.ensureGraderOverlayStyles();
    const overlay=document.createElement('div');
    overlay.className='grader-blocking-overlay';
    overlay.dataset.bodyOverflow=document.body.style.overflow||'';
    overlay.dataset.htmlOverflow=document.documentElement.style.overflow||'';
    overlay.setAttribute('role',mode==='thinking'?'status':'dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-live','polite');
    const card=document.createElement('div');
    card.className='grader-blocking-card';
    if(mode==='thinking'){
      card.innerHTML='<div class="grader-blocking-spinner" aria-hidden="true"></div><h2 class="grader-blocking-title"></h2><div class="grader-blocking-message"></div><div class="grader-blocking-wait">잠시만 기다려 주세요…</div>';
    }else{
      card.innerHTML='<div class="grader-blocking-mark" aria-hidden="true">✦</div><h2 class="grader-blocking-title"></h2><div class="grader-blocking-message"></div><button class="grader-blocking-action" type="button">다시 써보기</button>';
    }
    card.querySelector('.grader-blocking-title').textContent=String(title||'');
    card.querySelector('.grader-blocking-message').textContent=String(message||'');
    overlay.appendChild(card);
    document.body.style.overflow='hidden';
    document.documentElement.style.overflow='hidden';
    document.body.appendChild(overlay);
    if(mode!=='thinking'){
      const btn=card.querySelector('.grader-blocking-action');
      btn.addEventListener('click',()=>{
        this.removeGraderOverlay();
        onDismiss?.();
      });
      requestAnimationFrame(()=>btn.focus());
    }
    return overlay;
  }
  showWarningToast(message,result={}){
    const semantic=result?.warningType==='vocab_semantic_target';
    const typo=result?.warningType==='vocab_typo';
    const title=semantic?'AI Willi 힌트':typo?'거의 맞았어요!':'한 번 더 확인해 보세요';
    this.mountGraderOverlay({
      mode:'hint',
      title,
      message:String(message||'한 번 더 확인해 보세요.'),
      onDismiss:()=>{
        const input=this.host.querySelector('input,textarea');
        input?.focus?.();
        if(input&&typeof input.setSelectionRange==='function'){
          const n=String(input.value||'').length;
          try{input.setSelectionRange(n,n)}catch{}
        }
      }
    });
  }
  showThinking(message='AI Willi가 답을 확인하고 있어요…'){
    this.mountGraderOverlay({
      mode:'thinking',
      title:'AI Willi가 답을 확인하고 있어요…',
      message:'입력한 답이 목표 표현과 뜻이 비슷한지 확인하는 중이에요.'
    });
  }
  clearThinking(){
    this.removeGraderOverlay();
  }
  showFeedback(result){
    const f=this.host.querySelector('[data-feedback]');if(!f)return;
    this.removeGraderOverlay();
    f.className=`feedback show ${result.warning?'warn':(result.correct?'ok':'bad')}`;
    const answers=Array.isArray(result.correctAnswer)?result.correctAnswer:[result.correctAnswer].filter(x=>x!=null);
    if(result.warning){const msg=result.message||'한 번 더 확인해 보세요.';f.innerHTML=textHtml(msg);this.showWarningToast(msg,result);return}
    f.innerHTML=result.correct?'정답입니다!':`${textHtml(result.message||'정답을 확인해 보세요.')}${answers.length?`<div class="model"><b>모범 답안</b>${modelAnswerHtml(this.question,answers)}</div>`:''}`;
    if([FORMS.choice,FORMS.multi].includes(this.question?.form)){
      const right=new Set((Array.isArray(this.question.answer)?this.question.answer:[]).map(String)),selected=this.state.selected;
      this.host.querySelectorAll('[data-choice]').forEach(btn=>{const k=String(btn.dataset.choice);btn.classList.remove('selected');if(right.has(k))btn.classList.add('correct');else if(selected.has(k))btn.classList.add('wrong')});
    }
    applyBoldMarkup(this.host);
  }
  setDisabled(disabled=true){this.disabled=!!disabled;if(this.disabled&&this.speechRecognition){try{this.speechRecognition.stop()}catch{}}this.host.querySelectorAll('button,input,textarea').forEach(x=>x.disabled=this.disabled);return this}
}
