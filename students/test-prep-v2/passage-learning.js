import {QuestionRenderer} from './question-renderer.js';
import {gradeQuestion} from './question-grader.js';
import {recordAttempt,startSession,completeSession,trackingState} from './tracking-client.js';
import {loadPassages,passageQuestion} from './passage-source.js';

const TRACK='https://fiieuiktlsivwfgyivai.supabase.co';
const TRACK_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const BATCH_SIZE=10;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const token=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
let ctx=null;

async function refreshToken(){
  try{
    const fetcher=window.WillenaAPI?.fetch?window.WillenaAPI.fetch.bind(window.WillenaAPI):fetch;
    const r=await fetcher(`/.netlify/functions/supabase_auth?action=refresh&_=${Date.now()}`,{credentials:'include',cache:'no-store'}),d=await r.json().catch(()=>({}));
    if(r.ok&&d?.success&&d.access_token){window.WillenaAPI?.setLocalTokens?.(d.access_token,d.refresh_token||'');return d.access_token}
  }catch(_){ }
  return'';
}
async function trackGet(path){
  let t=token()||await refreshToken();if(!t)throw new Error('AUTH_REQUIRED');
  const run=x=>fetch(TRACK+path,{headers:{apikey:TRACK_KEY,Authorization:`Bearer ${x}`},cache:'no-store'});
  let r=await run(t);if(r.status===401){t=await refreshToken();if(t)r=await run(t)}
  if(!r.ok)throw new Error(await r.text());return r.json();
}
async function loadProgress(){
  const student=trackingState().user?.id;if(!student||!ctx?.plan?.id||!ctx.unitId)return new Map();
  const q=new URLSearchParams({select:'passage_id,next_order,total_sentences,last_occurrence_id,last_attempted_at,updated_at',student_id:`eq.${student}`,plan_id:`eq.${ctx.plan.id}`,unit_id:`eq.${ctx.unitId}`,mode:'eq.ordered'});
  try{const rows=await trackGet(`/rest/v1/test_prep_passage_progress_v1?${q}`);return new Map((rows||[]).map(r=>[String(r.passage_id),{nextOrder:Math.max(1,Number(r.next_order)||1),total:Number(r.total_sentences)||0,lastOccurrenceId:r.last_occurrence_id||null,lastAttemptedAt:r.last_attempted_at||null,updatedAt:r.updated_at||null}]))}catch(e){console.warn('[v2 passage] progress load failed',e);return new Map()}
}
function progressFor(p){return ctx.progress.get(String(p.id))||{nextOrder:1,total:p.sentences.length}}
function resumeOrder(p){return Math.max(1,Math.min(p.sentences.length+1,Number(progressFor(p).nextOrder)||1))}
function active(){return ctx?.passage||ctx?.passages?.[0]||null}
function bindBack(handler=exit){const b=ctx?.host?.querySelector('[data-passage-back]');if(b)b.onclick=handler}
function passageSwitcher(){
  if(ctx.passages.length<=1)return'';
  return `<div class="pw-switcher">${ctx.passages.map(p=>`<button type="button" data-passage-id="${esc(p.id)}" class="${active()?.id===p.id?'active':''}">${esc(p.title)}</button>`).join('')}</div>`;
}
function wireSwitcher(){ctx.host.querySelectorAll('[data-passage-id]').forEach(b=>b.onclick=()=>{const p=ctx.passages.find(x=>x.id===b.dataset.passageId);if(p){ctx.passage=p;renderPassage()}})}
function renderPassage(){
  const p=active();if(!p)return;
  const next=resumeOrder(p),done=next>p.sentences.length,ready=p.translationReady;
  ctx.mode='study';ctx.sessionActive=false;ctx.renderer=null;
  ctx.host.innerHTML=`<button class="back pw-back" data-passage-back>← ${esc(ctx.lesson)}</button><div class="pw-wrap"><div class="pw-head"><div><div class="pw-eyebrow">본문</div><h2>${esc(p.title)}</h2><p>${p.sentences.length}문장 · 교과서 순서</p></div><button class="pw-translation" type="button" id="pwTranslation">${ctx.showKo?'우리말 숨기기':'우리말 보기'}</button></div>${passageSwitcher()}<div class="pw-reading">${p.sentences.map(s=>`<div class="pw-line"><span class="pw-num">${s.order}</span><div class="pw-line-copy">${s.speaker?`<b class="pw-speaker">${esc(s.speaker)}:</b> `:''}<span>${esc(s.text)}</span>${s.translationKo?`<div class="pw-ko ${ctx.showKo?'show':''}">${esc(s.translationKo)}</div>`:''}</div></div>`).join('')}</div><div class="pw-actions">${ready?`<button class="pw-primary" id="pwStart">${done?'처음부터 다시 학습':'${next}번 문장부터 이어서 학습'}</button>`:`<div class="pw-unavailable">문장별 우리말 해석이 아직 준비되지 않아 순서 학습은 사용할 수 없습니다.</div>`}</div></div>`;
  const start=ctx.host.querySelector('#pwStart');if(start){start.textContent=done?'처음부터 다시 학습':`${next}번 문장부터 이어서 학습`;start.onclick=()=>startOrdered(p,{restart:done})}
  ctx.host.querySelector('#pwTranslation')?.addEventListener('click',()=>{ctx.showKo=!ctx.showKo;renderPassage()});
  bindBack();wireSwitcher();
}
async function startOrdered(p,{restart=false}={}){
  if(!p?.translationReady)return;
  const first=restart?1:resumeOrder(p);if(first>p.sentences.length){renderPassage();return}
  const last=Math.min(p.sentences.length,first+BATCH_SIZE-1);
  ctx.passage=p;ctx.mode='ordered';ctx.queue=p.sentences.filter(s=>s.order>=first&&s.order<=last);ctx.index=0;ctx.correct=0;ctx.wrongIds=[];ctx.answered=0;ctx.checked=false;ctx.sessionActive=true;ctx.sessionStart=first;ctx.sessionEnd=last;
  await startSession('passage');renderQuestion();
}
function questionHeader(s){const p=active(),overall=s.order/p.sentences.length*100;return `<button class="back pw-back" data-passage-back>← 본문</button><div class="pw-practice-head"><div><div class="pw-eyebrow">순서 학습</div><h2>${esc(p.title)}</h2><p>${s.order} / ${p.sentences.length} · ${ctx.sessionStart}–${ctx.sessionEnd}번 문장</p></div><strong>${Math.round(overall)}%</strong></div><div class="progress"><i style="width:${overall}%"></i></div>`}
function renderQuestion(){
  if(!ctx||ctx.mode!=='ordered')return;if(ctx.index>=ctx.queue.length){finishBatch();return}
  const sentence=ctx.queue[ctx.index],q=passageQuestion(sentence,active());if(!q){ctx.index++;renderQuestion();return}
  ctx.question=q;ctx.checked=false;ctx.startedAt=Date.now();
  ctx.host.innerHTML=`${questionHeader(sentence)}<div class="question-card" id="pwQuestionHost"></div><div class="pw-question-actions"><button type="button" class="pw-secondary" id="pwSkip">모르겠어요</button><button type="button" class="pw-primary" id="pwCheck" disabled>정답 확인</button></div>`;
  ctx.renderer=new QuestionRenderer(ctx.host.querySelector('#pwQuestionHost')).render(q,{onChange:(_,has)=>{const b=ctx.host.querySelector('#pwCheck');if(b&&!ctx.checked)b.disabled=!has}});
  bindBack(renderPassageAfterClose);ctx.host.querySelector('#pwSkip').onclick=skip;ctx.host.querySelector('#pwCheck').onclick=check;
}
async function saveAttempt(result,response,{skipped=false}={}){
  const s=ctx.queue[ctx.index],q=ctx.question;result.responseTimeMs=Date.now()-ctx.startedAt;ctx.answered++;if(result.correct)ctx.correct++;else ctx.wrongIds.push(String(s.occurrenceId));
  const meta={passage_id:s.passageId,passage_title:active().title,passage_order:s.order,passage_total:active().sentences.length,passage_mode:'ordered',unit_id:ctx.unitId,sentence_id:s.sentenceId,translation_ko:s.translationKo||null,speaker:s.speaker||null};
  await recordAttempt({question:q,response,result,practiceType:'passage',skipped,source:'test-prep-v2-passage',metadata:meta});
  const prev=progressFor(active());ctx.progress.set(active().id,{...prev,nextOrder:Math.max(prev.nextOrder||1,s.order+1),total:active().sentences.length});
}
async function check(){
  if(ctx.checked){ctx.index++;renderQuestion();return}
  const b=ctx.host.querySelector('#pwCheck'),response=ctx.renderer.getResponse();b.disabled=true;ctx.renderer.setDisabled(true);const result=await gradeQuestion(ctx.question,response);ctx.checked=true;ctx.renderer.showFeedback(result);try{await saveAttempt(result,response)}catch(e){console.warn('[v2 passage] attempt save failed',e)}b.disabled=false;b.textContent=ctx.index===ctx.queue.length-1?'묶음 완료':'다음 문장 →';ctx.host.querySelector('#pwSkip').disabled=true;
}
async function skip(){
  if(ctx.checked)return;ctx.renderer.setDisabled(true);const result={correct:false,method:'skipped'};ctx.checked=true;ctx.renderer.showFeedback({...result,message:'정답을 확인하고 다음 문장으로 넘어갑니다.',correctAnswer:ctx.question.answer});try{await saveAttempt(result,ctx.renderer.getResponse()??null,{skipped:true})}catch(e){console.warn('[v2 passage] skip save failed',e)}const b=ctx.host.querySelector('#pwCheck');b.disabled=false;b.textContent=ctx.index===ctx.queue.length-1?'묶음 완료':'다음 문장 →';ctx.host.querySelector('#pwSkip').disabled=true;
}
async function closeSession(){
  if(!ctx?.sessionActive)return;ctx.sessionActive=false;
  try{await completeSession({correct:ctx.correct,total:ctx.answered,wrongIds:ctx.wrongIds})}catch(e){console.warn('[v2 passage] session close failed',e)}
}
async function finishBatch(){
  if(!ctx)return;ctx.host.innerHTML='<div class="pw-wrap"><div class="loading">학습 기록을 저장하는 중...</div></div>';await closeSession();ctx.progress=await loadProgress();const p=active(),next=resumeOrder(p),finished=next>p.sentences.length;
  ctx.mode='result';ctx.host.innerHTML=`<button class="back pw-back" data-passage-back>← 본문</button><div class="pw-wrap"><div class="card result pw-result"><div class="score">${ctx.correct}/${Math.max(1,ctx.answered)}</div><h2>${finished?'본문 순서 학습 완료':'이번 묶음 완료'}</h2><div class="statline">${finished?'끝까지 학습했어요.':`${next}번 문장부터 이어집니다.`}</div><div class="pw-result-actions">${finished?'<button class="pw-secondary" id="pwRestart">처음부터 다시</button>':`<button class="pw-primary" id="pwContinue">${next}번부터 계속 →</button>`}<button class="pw-secondary" id="pwRead">본문 보기</button></div></div></div>`;
  ctx.host.querySelector('#pwContinue')?.addEventListener('click',()=>startOrdered(p));ctx.host.querySelector('#pwRestart')?.addEventListener('click',()=>startOrdered(p,{restart:true}));ctx.host.querySelector('#pwRead').onclick=renderPassage;bindBack(renderPassage);
}
async function renderPassageAfterClose(){await closeSession();ctx.progress=await loadProgress();renderPassage()}
async function exit(){await closeSession();const fn=ctx?.onExit;ctx=null;fn?.()}

export async function startPassageLearning({host,plan,lesson,unitId,onExit}={}){
  if(!host||!plan?.id||!unitId)throw new Error('본문 학습을 시작할 수 없습니다.');
  ctx={host,plan,lesson:String(lesson||'Lesson'),unitId:String(unitId),onExit,passages:[],passage:null,progress:new Map(),showKo:false,mode:'loading',sessionActive:false,renderer:null,index:0,correct:0,answered:0,wrongIds:[]};
  host.innerHTML='<div class="pw-wrap"><div class="loading">본문을 불러오는 중...</div></div>';
  const [passages,progress]=await Promise.all([loadPassages(unitId),loadProgress()]);if(!ctx)return;
  ctx.passages=passages;ctx.progress=progress;ctx.passage=passages[0]||null;
  if(!passages.length){host.innerHTML=`<button class="back pw-back" data-passage-back>← ${esc(ctx.lesson)}</button><div class="empty">이 Lesson에는 준비된 본문이 없습니다.</div>`;bindBack();return}
  renderPassage();
}

export async function stopPassageLearning(){if(!ctx)return;await closeSession();ctx=null}
