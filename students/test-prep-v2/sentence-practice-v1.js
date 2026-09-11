// Canonical 본문외우기 workflow for Test Prep V2.
// Loads sentence-level items from the content DB, shows the Korean target,
// and tracks the exact canonical sentence id used by shared stats.
import {startSession,recordAttempt,completeSession} from './tracking-client.js?v=2.17a';

const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const HEAD={apikey:KEY,Authorization:`Bearer ${KEY}`};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ctx=null;

async function get(path){
  const response=await fetch(CONTENT+path,{headers:HEAD,cache:'no-store'});
  if(!response.ok)throw new Error(await response.text());
  return response.json();
}

async function loadItems(unitId){
  const select=encodeURIComponent('canonical_id,passage_id,passage_title,passage_source_key,sentence_order,sentence_text,translation_ko,speaker');
  const rows=await get(`/rest/v1/test_prep_sentence_items_v2?select=${select}&unit_id=eq.${encodeURIComponent(unitId)}&order=passage_source_key.asc,sentence_order.asc`);
  return (rows||[]).map(row=>({
    id:String(row.canonical_id||''),
    text:String(row.sentence_text||'').trim(),
    ko:String(row.translation_ko||'').trim(),
    speaker:String(row.speaker||'').trim(),
    passageTitle:String(row.passage_title||'본문'),
    passageId:String(row.passage_id||''),
    sentenceOrder:Number(row.sentence_order)||0
  })).filter(q=>q.id&&q.text);
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
    .spv1-ko{margin:10px 0 16px;font-size:22px;line-height:1.5;font-weight:850;color:var(--ink)}
    .spv1-missing-ko{margin:10px 0 16px;font-size:13px;font-weight:700;color:var(--bad)}
    .spv1-answer,.spv1-bank{display:flex;flex-wrap:wrap;gap:8px;min-height:58px;padding:10px;border-radius:14px}
    .spv1-answer{margin-top:4px;border:2px dashed var(--line);background:#fbffff}
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
    @media(max-width:680px){.spv1-title{font-size:22px}.spv1-card{padding:17px}.spv1-ko{font-size:19px}}
  `;
  document.head.appendChild(style);
}

async function saveAttempt(q,correct,built){
  const active=ctx;
  if(!active)return;
  const question={
    id:q.id,
    answer:q.text,
    form:'chunks',
    tracking:{
      practiceType:'sentences',
      questionId:q.id,
      questionType:'sentence_unscramble',
      targets:['sentence_order','reading_text']
    },
    source:{code:'',label:q.passageTitle,sourceId:q.passageId}
  };
  const result={correct,method:'exact_normalized',responseTimeMs:Date.now()-active.startedAt};
  if(!correct)active.wrongIds.push(q.id);
  active.answered++;
  if(correct)active.score++;
  await recordAttempt({
    question,
    response:built,
    result,
    practiceType:'sentences',
    source:'test-prep-v2-sentences',
    metadata:{
      canonical_sentence_id:q.id,
      passage_id:q.passageId,
      passage_title:q.passageTitle,
      sentence:q.text,
      sentence_ko:q.ko||null,
      speaker:q.speaker||null,
      sentence_order:q.sentenceOrder
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
        ${q.ko?`<div class="spv1-ko">${esc(q.ko)}</div>`:'<div class="spv1-missing-ko">이 문장의 한국어 뜻이 아직 등록되지 않았습니다.</div>'}
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
    if(active.checked){active.index++;render();return}
    if(answer.children.length!==words.length){
      feedback.className='spv1-feedback bad';
      feedback.textContent='아직 모든 단어를 사용하지 않았어요.';
      return;
    }
    const built=[...answer.children].map(node=>node.textContent.trim()).join(' ');
    const correct=built===q.text;
    check.disabled=true;
    try{await saveAttempt(q,correct,built)}catch(e){console.warn('[sentence-v1] attempt save failed',e)}
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
    try{await completeSession({correct:active.score,total:active.answered,wrongIds:active.wrongIds})}
    catch(e){console.warn('[sentence-v1] session close failed',e)}
    if(ctx!==active)return;
    active.sessionOpen=false;
  }
  active.host.innerHTML=`
    <div class="spv1"><div class="spv1-result">
      <div class="spv1-score">${active.score}/${Math.max(1,active.answered)}</div>
      <h2>본문외우기 완료</h2><p>이번 라운드를 끝냈어요.</p>
      <button id="spv1Done" type="button">${esc(active.lesson)}로 돌아가기</button>
    </div></div>`;
  active.host.querySelector('#spv1Done').onclick=()=>{
    if(ctx!==active)return;
    const onExit=active.onExit;ctx=null;onExit?.();
  };
}

export async function startSentencePracticeV1({host,plan,lesson,unitId,onExit}={}){
  if(!host||!plan?.id||!unitId)throw new Error('본문외우기를 시작할 수 없습니다.');
  await stopSentencePracticeV1();
  ensureStyles();
  const active={host,plan,lesson:String(lesson||'Lesson'),unitId:String(unitId),onExit,queue:[],index:0,score:0,answered:0,wrongIds:[],checked:false,startedAt:0,sessionOpen:false};
  ctx=active;
  host.innerHTML='<div class="loading">본문 문장을 불러오는 중...</div>';
  const items=await loadItems(active.unitId);
  if(ctx!==active)return;
  if(!items.length){
    host.innerHTML=`<button class="back" id="spv1EmptyBack">← ${esc(active.lesson)}</button><div class="empty">이 Lesson에는 준비된 본문 문장이 없습니다.</div>`;
    host.querySelector('#spv1EmptyBack').onclick=()=>{if(ctx!==active)return;const fn=active.onExit;ctx=null;fn?.()};
    return;
  }
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
    try{await completeSession({correct:active.score,total:active.answered,wrongIds:active.wrongIds})}
    catch(e){console.warn('[sentence-v1] stop session failed',e)}
  }
}
