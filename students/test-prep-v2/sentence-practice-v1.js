// V1-compatible 본문외우기 adapter for Test Prep V2.
// Contract:
// 1) read the exact published passage source/order used by Test Prep V1,
// 2) deliver every sentence sequentially (no selector/sampling/shuffle),
// 3) save attempts only through the normal Test Prep V2 tracking client.
import {startSession,recordAttempt,completeSession} from './tracking-client.js?v=2.17a';

const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const HEAD={apikey:KEY,Authorization:`Bearer ${KEY}`};
const DOT='\uE000';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ctx=null;

async function get(path){
  const response=await fetch(CONTENT+path,{headers:HEAD,cache:'no-store'});
  if(!response.ok)throw new Error(await response.text());
  return response.json();
}

// Keep this splitter intentionally aligned with V1 sentence-practice.js.
function protectSentenceDots(value){
  let s=String(value||'');
  s=s.replace(/\b(Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr)\./gi,(_,a)=>`${a}${DOT}`);
  s=s.replace(/\b(e\.g|i\.e|a\.m|p\.m|U\.S|U\.K)\./gi,m=>m.replace(/\./g,DOT));
  s=s.replace(/(\d)\.(\d)/g,`$1${DOT}$2`);
  return s;
}
function restoreSentenceDots(value){return String(value||'').split(DOT).join('.')}
function splitSentences(body,title,passageId,translations=[]){
  const out=[];
  let sentenceIndex=0;
  for(let line of String(body||'').split(/\n+/).map(x=>x.trim()).filter(Boolean)){
    if(/^(Situation\s+\d+|D-?\d+|D-Day)$/i.test(line)||/^What will happen next\?/i.test(line)||/^(Dear\s+.+,|Hi\s+.+,|Love,?|Best,?|Your friend,?|Uncle Jay|Amy|Minji)$/i.test(line))continue;
    line=line.replace(/^(D-?\d+|D-Day)\s+/i,'');
    let speaker='';
    const match=line.match(/^([A-Za-z][A-Za-z .'-]{0,24}):\s*(.+)$/);
    if(match){speaker=match[1];line=match[2]}
    const safe=protectSentenceDots(line);
    const parts=safe.match(/[^.!?]+[.!?]+(?:["'”’])?|[^.!?]+$/g)||[];
    parts.map(x=>restoreSentenceDots(x.trim())).filter(x=>x&&/[A-Za-z]/.test(x)).forEach((text,partIndex)=>{
      out.push({
        text,
        ko:String(translations[sentenceIndex]||''),
        speaker,
        passageTitle:title,
        passageId,
        partIndex,
        sentenceIndex
      });
      sentenceIndex++;
    });
  }
  return out;
}

async function loadItems(unitId){
  const rows=await get(`/rest/v1/passages?select=id,title,body,source_key,metadata&status=eq.published&metadata-%3E%3Eunit_id=eq.${encodeURIComponent(unitId)}&order=source_key.asc`);
  return(rows||[]).flatMap(p=>splitSentences(
    p.body,
    p.title,
    p.id,
    Array.isArray(p.metadata?.sentence_translations_ko)?p.metadata.sentence_translations_ko:[]
  ));
}

// IMPORTANT: this is the exact deterministic identity contract used by V1.
// Do not replace partIndex with sentenceIndex: existing tracking/mastery uses this ID.
function uid(q){
  const s=`${q.passageId}|${q.partIndex}|${q.text}`;
  let h1=2166136261,h2=2246822519,h3=3266489917,h4=668265263;
  for(let i=0;i<s.length;i++){
    const c=s.charCodeAt(i);
    h1=Math.imul(h1^c,16777619);
    h2=Math.imul(h2^c,1597334677);
    h3=Math.imul(h3^c,374761393);
    h4=Math.imul(h4^c,1103515245);
  }
  const hex=n=>(n>>>0).toString(16).padStart(8,'0');
  const x=hex(h1)+hex(h2)+hex(h3)+hex(h4);
  return`${x.slice(0,8)}-${x.slice(8,12)}-4${x.slice(13,16)}-a${x.slice(17,20)}-${x.slice(20,32)}`;
}

const tokens=text=>String(text||'').trim().split(/\s+/).filter(Boolean);
function shuffle(items){
  const out=[...items];
  for(let i=out.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [out[i],out[j]]=[out[j],out[i]];
  }
  if(out.length>1&&out.every((v,i)=>v.order===i)){
    [out[0],out[1]]=[out[1],out[0]];
  }
  return out;
}

function ensureStyles(){
  if(document.getElementById('tpSentenceV1Styles'))return;
  const style=document.createElement('style');
  style.id='tpSentenceV1Styles';
  style.textContent=`
    .spv1{max-width:820px;margin:0 auto;display:grid;gap:16px}
    .spv1-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
    .spv1-title{font-size:26px;font-weight:800}
    .spv1-meta{margin-top:5px;color:var(--muted);font-size:12px}
    .spv1-count{font-weight:800;color:var(--cyan-dark)}
    .spv1-progress{height:7px;background:var(--track);border-radius:99px;overflow:hidden}
    .spv1-progress i{display:block;height:100%;background:var(--pink);border-radius:99px}
    .spv1-card{background:#fff;border:2px solid var(--line);border-radius:24px;padding:22px;box-shadow:var(--shadow)}
    .spv1-speaker{font-size:11px;font-weight:800;color:var(--cyan-dark);margin-bottom:8px}
    .spv1-hint{font-size:12px;font-weight:700;color:var(--muted)}
    .spv1-ko{margin:12px 0;font-size:20px;line-height:1.5;font-weight:800}
    .spv1-answer,.spv1-bank{display:flex;flex-wrap:wrap;gap:8px;min-height:58px;padding:10px;border-radius:14px}
    .spv1-answer{margin-top:14px;border:2px dashed var(--line);background:#fbffff}
    .spv1-bank{margin-top:12px;background:var(--soft)}
    .spv1-word{border:1.5px solid var(--line);background:#fff;color:var(--ink);border-radius:11px;padding:9px 11px;font-weight:700}
    .spv1-feedback{min-height:28px;margin-top:12px;font-weight:800}
    .spv1-feedback.ok{color:var(--good)}
    .spv1-feedback.bad{color:var(--bad)}
    .spv1-actions{display:flex;justify-content:space-between;gap:10px;margin-top:14px}
    .spv1-actions button,.spv1-result button{border:1.5px solid var(--line);background:#fff;border-radius:13px;padding:11px 16px;font-weight:800}
    .spv1-actions .primary,.spv1-result button{border-color:var(--pink);color:var(--pink)}
    .spv1-result{text-align:center;background:#fff;border:2px solid var(--line);border-radius:24px;padding:38px 20px}
    .spv1-score{font-size:48px;font-weight:900;color:var(--cyan-dark)}
    @media(max-width:680px){.spv1-title{font-size:22px}.spv1-card{padding:17px}.spv1-ko{font-size:18px}}
  `;
  document.head.appendChild(style);
}

async function saveAttempt(q,correct,built){
  const active=ctx;
  if(!active)return;
  const id=uid(q);
  const question={
    id,
    answer:q.text,
    form:'chunks',
    tracking:{
      practiceType:'sentences',
      questionId:id,
      questionType:'sentence_unscramble',
      targets:['sentence_order','reading_text']
    },
    source:{code:'',label:q.passageTitle,sourceId:q.passageId}
  };
  const result={correct,method:'exact_normalized',responseTimeMs:Date.now()-active.startedAt};
  if(!correct)active.wrongIds.push(id);
  active.answered++;
  if(correct)active.score++;
  await recordAttempt({
    question,
    response:built,
    result,
    practiceType:'sentences',
    source:'test-prep-v2-sentences',
    metadata:{
      passage_id:q.passageId,
      passage_title:q.passageTitle,
      sentence:q.text,
      sentence_ko:q.ko||null,
      speaker:q.speaker||null,
      part_index:q.partIndex,
      sentence_index:q.sentenceIndex
    }
  });
}

function render(){
  const active=ctx;
  if(!active)return;
  if(active.index>=active.queue.length){void finish();return}

  const q=active.queue[active.index];
  const words=tokens(q.text);
  const bank=shuffle(words.map((text,order)=>({text,order})));
  active.checked=false;
  active.startedAt=Date.now();
  const pct=Math.round(active.index/Math.max(1,active.queue.length)*100);

  active.host.innerHTML=`
    <button class="back" id="spv1Back">← ${esc(active.lesson)}</button>
    <div class="spv1">
      <div class="spv1-head">
        <div>
          <div class="spv1-title">${esc(active.lesson)} 본문외우기</div>
          <div class="spv1-meta">${esc(q.passageTitle||'본문')} · 단어를 눌러 문장을 완성하세요</div>
        </div>
        <div class="spv1-count">${active.index+1} / ${active.queue.length}</div>
      </div>
      <div class="spv1-progress"><i style="width:${pct}%"></i></div>
      <div class="spv1-card">
        ${q.speaker?`<div class="spv1-speaker">${esc(q.speaker)}</div>`:''}
        <div class="spv1-hint">다음 우리말 문장을 영어로 완성하세요.</div>
        ${q.ko?`<div class="spv1-ko">${esc(q.ko)}</div>`:''}
        <div class="spv1-answer" id="spv1Answer"></div>
        <div class="spv1-bank" id="spv1Bank">${bank.map((w,k)=>`<button class="spv1-word" data-key="${k}" type="button">${esc(w.text)}</button>`).join('')}</div>
        <div class="spv1-feedback" id="spv1Feedback"></div>
        <div class="spv1-actions">
          <button id="spv1Clear" type="button">다시 섞기</button>
          <button class="primary" id="spv1Check" type="button" disabled>정답 확인</button>
        </div>
      </div>
    </div>`;

  const answer=active.host.querySelector('#spv1Answer');
  const bankEl=active.host.querySelector('#spv1Bank');
  const check=active.host.querySelector('#spv1Check');
  const feedback=active.host.querySelector('#spv1Feedback');
  const update=()=>{check.disabled=!answer.children.length};

  active.host.querySelectorAll('.spv1-word').forEach(btn=>{
    btn.onclick=()=>{
      if(active.checked||ctx!==active)return;
      (btn.parentElement===bankEl?answer:bankEl).appendChild(btn);
      update();
    };
  });

  active.host.querySelector('#spv1Clear').onclick=()=>{
    if(active.checked||ctx!==active)return;
    const nodes=[...answer.children,...bankEl.children];
    const mixed=shuffle(nodes.map((node,order)=>({node,order}))).map(x=>x.node);
    bankEl.innerHTML='';
    mixed.forEach(node=>bankEl.appendChild(node));
    update();
  };

  check.onclick=async()=>{
    if(ctx!==active)return;
    if(active.checked){
      active.index++;
      render();
      return;
    }
    if(answer.children.length!==words.length){
      feedback.className='spv1-feedback bad';
      feedback.textContent='아직 모든 단어를 사용하지 않았어요.';
      return;
    }

    const built=[...answer.children].map(node=>node.textContent.trim()).join(' ');
    const correct=built===q.text;
    check.disabled=true;
    try{
      await saveAttempt(q,correct,built);
    }catch(e){
      console.warn('[sentence-v1] attempt save failed',e);
    }
    if(ctx!==active)return;
    active.checked=true;
    feedback.className=`spv1-feedback ${correct?'ok':'bad'}`;
    feedback.textContent=correct?'정답입니다!':`정답: ${q.text}`;
    check.disabled=false;
    check.textContent=active.index===active.queue.length-1?'끝내기':'다음 문장';
  };

  active.host.querySelector('#spv1Back').onclick=async()=>{
    const onExit=active.onExit;
    await stopSentencePracticeV1();
    onExit?.();
  };
}

async function finish(){
  const active=ctx;
  if(!active)return;
  if(active.sessionOpen){
    try{
      await completeSession({correct:active.score,total:active.answered,wrongIds:active.wrongIds});
    }catch(e){
      console.warn('[sentence-v1] session close failed',e);
    }
    if(ctx!==active)return;
    active.sessionOpen=false;
  }
  active.host.innerHTML=`
    <div class="spv1">
      <div class="spv1-result">
        <div class="spv1-score">${active.score}/${Math.max(1,active.answered)}</div>
        <h2>본문외우기 완료</h2>
        <p>이번 라운드를 끝냈어요.</p>
        <button id="spv1Done" type="button">${esc(active.lesson)}로 돌아가기</button>
      </div>
    </div>`;
  active.host.querySelector('#spv1Done').onclick=()=>{
    if(ctx!==active)return;
    const onExit=active.onExit;
    ctx=null;
    onExit?.();
  };
}

export async function startSentencePracticeV1({host,plan,lesson,unitId,onExit}={}){
  if(!host||!plan?.id||!unitId)throw new Error('본문외우기를 시작할 수 없습니다.');
  await stopSentencePracticeV1();
  ensureStyles();

  const active={
    host,
    plan,
    lesson:String(lesson||'Lesson'),
    unitId:String(unitId),
    onExit,
    queue:[],
    index:0,
    score:0,
    answered:0,
    wrongIds:[],
    checked:false,
    startedAt:0,
    sessionOpen:false
  };
  ctx=active;
  host.innerHTML='<div class="loading">본문 문장을 불러오는 중...</div>';

  const items=await loadItems(active.unitId);
  if(ctx!==active)return;
  if(!items.length){
    host.innerHTML=`<button class="back" id="spv1EmptyBack">← ${esc(active.lesson)}</button><div class="empty">이 Lesson에는 준비된 본문 문장이 없습니다.</div>`;
    host.querySelector('#spv1EmptyBack').onclick=()=>{
      if(ctx!==active)return;
      const fn=active.onExit;
      ctx=null;
      fn?.();
    };
    return;
  }

  // Every sentence, exactly in passage/source order. No selector or sampling.
  active.queue=items;
  await startSession('sentences');
  if(ctx!==active)return;
  active.sessionOpen=true;
  render();
}

export async function stopSentencePracticeV1(){
  const active=ctx;
  if(!active)return;
  ctx=null;
  if(active.sessionOpen){
    try{
      await completeSession({correct:active.score,total:active.answered,wrongIds:active.wrongIds});
    }catch(e){
      console.warn('[sentence-v1] close failed',e);
    }
  }
}
