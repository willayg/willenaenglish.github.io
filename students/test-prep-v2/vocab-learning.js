import {QuestionRenderer} from './question-renderer.js';
import {gradeQuestion} from './question-grader.js';
import {recordAttempt,startSession,completeSession,trackingState} from './tracking-client.js';

const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const TRACK='https://fiieuiktlsivwfgyivai.supabase.co';
const TRACK_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const ORDER=['cards','ko-en','en-ko','spelling'];
const LABEL={cards:'카드', 'ko-en':'한국어 → 영어','en-ko':'영어 → 한국어',spelling:'Spelling'};
const COMPLETE_KEY={'ko-en':'ko_en_complete','en-ko':'en_ko_complete',spelling:'spelling_complete'};
const CLEARED_KEY={'ko-en':'ko_en_cleared','en-ko':'en_ko_cleared',spelling:'spelling_cleared'};

const norm=s=>String(s??'').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uniq=a=>[...new Set((Array.isArray(a)?a:[]).map(String).filter(Boolean))];
const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b};
const token=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';

let ctx=null;
let saveChain=Promise.resolve();

function blankProgress(){return{cards_complete:false,ko_en_complete:false,en_ko_complete:false,spelling_complete:false,ko_en_cleared:[],en_ko_cleared:[],spelling_cleared:[]}}
function normalizedProgress(row={}){return{cards_complete:!!row.cards_complete,ko_en_complete:!!row.ko_en_complete,en_ko_complete:!!row.en_ko_complete,spelling_complete:!!row.spelling_complete,ko_en_cleared:uniq(row.ko_en_cleared),en_ko_cleared:uniq(row.en_ko_cleared),spelling_cleared:uniq(row.spelling_cleared)}}
async function contentGet(path){const r=await fetch(CONTENT+path,{headers:{apikey:CONTENT_KEY,Authorization:`Bearer ${CONTENT_KEY}`},cache:'no-store'});if(!r.ok)throw new Error(await r.text());return r.json()}
async function trackGet(path){const t=token();if(!t)throw new Error('AUTH_REQUIRED');const r=await fetch(TRACK+path,{headers:{apikey:TRACK_KEY,Authorization:`Bearer ${t}`},cache:'no-store'});if(!r.ok)throw new Error(await r.text());return r.json()}
async function loadItems(unitId){
  const occ=await contentGet(`/rest/v1/source_content_occurrences?select=lexical_entry_id,source_text,metadata&unit_id=eq.${encodeURIComponent(unitId)}&occurrence_type=eq.lexical_entry&skill=eq.vocabulary&order=source_text.asc`);
  const ids=[...new Set((occ||[]).map(x=>x.lexical_entry_id).filter(Boolean))];if(!ids.length)return[];
  const lex=await contentGet(`/rest/v1/lexical_entries?select=id,canonical_text,translation_ko,entry_type,part_of_speech&id=in.${encodeURIComponent('('+ids.join(',')+')')}`);
  const byId=new Map((lex||[]).map(x=>[String(x.id),x])),seen=new Set(),out=[];
  for(const o of occ||[]){const x=byId.get(String(o.lexical_entry_id)),k=norm(x?.canonical_text||'');if(!x?.canonical_text||!x?.translation_ko||!k||seen.has(k))continue;seen.add(k);out.push(x)}
  return out;
}
async function loadProgress(){
  const student=trackingState().user?.id;if(!student||!ctx?.plan?.id||!ctx.lesson)return blankProgress();
  const q=new URLSearchParams({select:'cards_complete,ko_en_complete,en_ko_complete,spelling_complete,ko_en_cleared,en_ko_cleared,spelling_cleared',student_id:`eq.${student}`,plan_id:`eq.${ctx.plan.id}`,lesson:`eq.${ctx.lesson}`,limit:'1'});
  try{const rows=await trackGet(`/rest/v1/test_prep_vocab_progress?${q}`);return normalizedProgress(rows?.[0]||{})}catch(e){console.warn('[v2.13 vocab] progress load failed',e);return blankProgress()}
}
async function loadCardChecks(){
  const student=trackingState().user?.id;if(!student||!ctx?.plan?.id||!ctx.lesson)return new Map();
  const q=new URLSearchParams({select:'knew,created_at,metadata',student_id:`eq.${student}`,plan_id:`eq.${ctx.plan.id}`,lesson:`eq.${ctx.lesson}`,order:'created_at.asc'});
  try{const rows=await trackGet(`/rest/v1/test_prep_vocab_self_checks?${q}`),latest=new Map();for(const r of rows||[]){const word=norm(r?.metadata?.canonical_text||'');if(word)latest.set(word,!!r.knew)}return latest}catch(e){console.warn('[v2.13 vocab] card checks load failed',e);return new Map()}
}
function queueProgressSave(patch={}){
  if(!ctx)return Promise.resolve(false);ctx.progress=normalizedProgress({...ctx.progress,...patch});
  const student=trackingState().user?.id,t=token();if(!student||!ctx.plan?.id||!ctx.lesson||!t)return Promise.resolve(false);
  const snapshot={student_id:student,plan_id:ctx.plan.id,lesson:ctx.lesson,...ctx.progress,updated_at:new Date().toISOString()};
  saveChain=saveChain.then(async()=>{const r=await fetch(`${TRACK}/rest/v1/test_prep_vocab_progress?on_conflict=student_id,plan_id,lesson`,{method:'POST',headers:{apikey:TRACK_KEY,Authorization:`Bearer ${t}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(snapshot)});if(!r.ok)throw new Error(await r.text());window.dispatchEvent(new CustomEvent('testprep:vocab-progress-changed',{detail:snapshot}));return true}).catch(e=>{console.warn('[v2.13 vocab] progress save failed',e);return false});
  return saveChain;
}
async function saveCardCheck(item,knew,responseMs){
  const student=trackingState().user?.id,t=token();if(!student||!ctx?.plan?.id||!ctx.lesson||!item?.id||!t)return false;
  const payload={student_id:student,plan_id:ctx.plan.id,lesson:ctx.lesson,lexical_entry_id:item.id,knew:!!knew,repeat_phase:!!ctx.cardRepeat,response_time_ms:Math.max(0,Math.round(responseMs||0)),metadata:{canonical_text:item.canonical_text,translation_ko:item.translation_ko||null,book_label:ctx.plan.book_label||null,source:'test-prep-v2-vocab-card'}};
  try{const r=await fetch(`${TRACK}/rest/v1/test_prep_vocab_self_checks`,{method:'POST',headers:{apikey:TRACK_KEY,Authorization:`Bearer ${t}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(payload)});if(!r.ok)throw new Error(await r.text());return true}catch(e){console.warn('[v2.13 vocab] self-check save failed',e);return false}
}
function unlocked(mode){if(mode==='cards')return true;if(mode==='ko-en')return !!ctx.progress.cards_complete;if(mode==='en-ko')return !!ctx.progress.ko_en_complete;if(mode==='spelling')return !!ctx.progress.en_ko_complete;return false}
function isComplete(mode){if(mode==='cards')return !!ctx.progress.cards_complete;return !!ctx.progress[COMPLETE_KEY[mode]]}
function remainingIds(mode){if(mode==='cards')return ctx.items.filter(x=>ctx.cardKnown.get(norm(x.canonical_text))!==true).map(x=>String(x.id));const cleared=new Set(uniq(ctx.progress[CLEARED_KEY[mode]]));return ctx.items.filter(x=>!cleared.has(String(x.id))).map(x=>String(x.id))}
function firstUnfinished(){if(!ctx.progress.cards_complete)return'cards';if(!ctx.progress.ko_en_complete)return'ko-en';if(!ctx.progress.en_ko_complete)return'en-ko';if(!ctx.progress.spelling_complete)return'spelling';return null}
function modeButton(mode){const on=unlocked(mode),active=ctx.mode===mode;return `<button class="vp-mode ${active?'active':''} ${on?'':'vp-card-locked'}" data-mode="${mode}" ${on?'':'disabled'}><span>${LABEL[mode]}</span>${on?'':'<span class="vp-lock-icon">🔒</span>'}</button>`}
function shell(body,subtitle=''){
  const left=Math.max(0,ctx.queue.length-(ctx.index+1)),progress=Math.max(0,Math.min(100,ctx.index/Math.max(1,ctx.queue.length)*100));
  ctx.host.innerHTML=`<button class="back vp-back" id="vpBack">← ${esc(ctx.lesson)}</button><div class="vp-wrap"><div class="vp-head"><div><div class="vp-title">${esc(ctx.lesson)} Vocabulary</div><div class="vp-count">${ctx.items.length} lexical items${subtitle?` · ${esc(subtitle)}`:''}</div></div><div class="vp-count">${left}</div></div><div class="vp-modes">${ORDER.map(modeButton).join('')}</div><div class="vp-progress"><i style="width:${progress}%"></i></div>${body}</div>`;
  ctx.host.querySelector('#vpBack').onclick=exit;
  ctx.host.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{if(unlocked(b.dataset.mode))startMode(b.dataset.mode,{practiceAgain:isComplete(b.dataset.mode)})});
}
function pickVoice(){const voices=window.speechSynthesis?.getVoices?.()||[];return voices.find(v=>/^en-US$/i.test(v.lang)&&/(google|microsoft|samsung)/i.test(v.name))||voices.find(v=>/^en-US$/i.test(v.lang))||voices.find(v=>/^en[-_]/i.test(v.lang))||null}
function speak(word,button){if(!word||!('speechSynthesis'in window)||typeof SpeechSynthesisUtterance==='undefined')return;try{window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(word);u.lang='en-US';u.rate=.82;u.pitch=1;const voice=pickVoice();if(voice)u.voice=voice;if(button)button.disabled=true;const done=()=>{if(button)button.disabled=false};u.onend=done;u.onerror=done;window.speechSynthesis.speak(u)}catch(e){console.warn('[v2.13 vocab] TTS failed',e);if(button)button.disabled=false}}
function showModal(title,text,button,action){document.querySelector('.vocab-unlock-bg')?.remove();const bg=document.createElement('div');bg.className='vocab-unlock-bg';bg.innerHTML=`<div class="vocab-unlock" role="dialog" aria-modal="true"><div class="icon">🔓</div><h3>${esc(title)}</h3><p>${esc(text)}</p><button type="button">${esc(button)}</button></div>`;document.body.appendChild(bg);const b=bg.querySelector('button');b.onclick=()=>{bg.remove();action?.()};b.focus()}
function renderCard(){
  if(ctx.index>=ctx.queue.length)return finishCards();
  const item=ctx.queue[ctx.index];ctx.cardShownAt=Date.now();
  shell(`<div class="vp-card vp-selfcheck-cards"><div class="vp-prompt">${esc(item.canonical_text)}</div><button class="vp-card-audio" id="vpAudio" type="button" aria-label="단어 듣기">🎧</button><div class="vp-sub">${esc(item.part_of_speech||item.entry_type||'')}</div><div class="vp-flash-answer" id="vpFlashAnswer">${esc(item.translation_ko)}</div><button class="vp-reveal" id="vpReveal">뜻 보기</button><div class="vp-selfcheck" id="vpSelfCheck"><p>이 단어를 알고 있었어요?</p><div class="vp-selfcheck-actions"><button type="button" class="vp-selfcheck-btn" data-knew="yes">예</button><button type="button" class="vp-selfcheck-btn" data-knew="no">아니요</button></div></div></div>`,'카드');
  ctx.host.querySelector('#vpAudio').onclick=e=>{e.preventDefault();speak(item.canonical_text,e.currentTarget)};
  ctx.host.querySelector('#vpReveal').onclick=()=>{ctx.host.querySelector('#vpFlashAnswer').classList.add('show');ctx.host.querySelector('#vpReveal').hidden=true;ctx.host.querySelector('#vpSelfCheck').classList.add('show')};
  ctx.host.querySelectorAll('[data-knew]').forEach(b=>b.onclick=async()=>{const knew=b.dataset.knew==='yes';ctx.host.querySelectorAll('[data-knew]').forEach(x=>x.disabled=true);ctx.cardKnown.set(norm(item.canonical_text),knew);if(knew)ctx.cardUnknown.delete(String(item.id));else ctx.cardUnknown.add(String(item.id));await saveCardCheck(item,knew,Date.now()-ctx.cardShownAt);ctx.index++;renderCard()});
}
function finishCards(){
  if(ctx.cardUnknown.size){const ids=[...ctx.cardUnknown],wanted=new Set(ids);ctx.cardRepeat=true;shell(`<div class="vp-result"><div class="vp-score">${ids.length}</div><h2>한 번 더 볼게요</h2><p>모른다고 답한 단어만 마지막에 다시 확인합니다.</p></div>`,'카드');setTimeout(()=>{ctx.queue=shuffle(ctx.items.filter(x=>wanted.has(String(x.id))));ctx.index=0;ctx.cardUnknown.clear();renderCard()},450);return}
  ctx.cardRepeat=false;queueProgressSave({cards_complete:true}).then(()=>{shell(`<div class="vp-result"><div class="vp-score">${ctx.items.length}</div><h2>카드 학습 완료</h2><p>모든 단어를 확인했어요.</p></div>`,'카드');showModal('다음 단계가 열렸어요!','모든 카드를 알고 있어요. 이제 한국어 → 영어 단계로 넘어갑니다.','한국어 → 영어 시작',()=>startMode('ko-en'))})
}
function distractors(item,field){const seen=new Set(),pool=[];for(const x of shuffle(ctx.items)){if(String(x.id)===String(item.id))continue;const v=String(x[field]||'').trim(),k=norm(v);if(!v||seen.has(k)||k===norm(item[field]))continue;seen.add(k);pool.push(v)}return shuffle([item[field],...pool.slice(0,3)])}
function makeQuestion(item,mode){
  if(mode==='spelling')return{id:String(item.id),masteryKey:`lexical:${item.id}`,skill:'vocabulary',form:'write',source:{code:'',label:'lesson_vocabulary',sourceId:null,sourceQuestionNumber:null},prompt:String(item.translation_ko||''),context:{},choices:[],answer:[String(item.canonical_text)],grading:{mode:'exact_normalized',aiAllowed:false,constraints:{}},tracking:{practiceType:'vocabulary',questionType:'vocabulary_spelling',targets:['vocabulary',item.part_of_speech||item.entry_type||'lexical_item']},metadata:{vocab_mode:'spelling'}};
  const field=mode==='ko-en'?'canonical_text':'translation_ko',choices=distractors(item,field),answer=mode==='ko-en'?item.canonical_text:item.translation_ko;
  return{id:String(item.id),masteryKey:`lexical:${item.id}`,skill:'vocabulary',form:'choice',source:{code:'',label:'lesson_vocabulary',sourceId:null,sourceQuestionNumber:null},prompt:String(mode==='ko-en'?item.translation_ko:item.canonical_text),context:{},choices,answer:[String(choices.indexOf(answer)+1)],grading:{mode:'exact_normalized',aiAllowed:false,constraints:{}},tracking:{practiceType:'vocabulary',questionType:`vocabulary_${mode}`,targets:['vocabulary',item.part_of_speech||item.entry_type||'lexical_item']},metadata:{vocab_mode:mode}};
}
function renderStudyQuestion(){
  if(ctx.index>=ctx.queue.length)return finishStudyRound();
  const item=ctx.queue[ctx.index],q=makeQuestion(item,ctx.mode);ctx.question=q;ctx.answered=false;ctx.startedAt=Date.now();
  shell(`<div class="vp-card"><div id="vpQuestionHost"></div></div><button class="vp-next" id="vpNext" ${ctx.mode==='spelling'?'disabled':''}>${ctx.mode==='spelling'?'정답 확인':'다음'}</button>`,LABEL[ctx.mode]);
  const next=ctx.host.querySelector('#vpNext');
  ctx.renderer=new QuestionRenderer(ctx.host.querySelector('#vpQuestionHost')).render(q,{onChange:(_,has)=>{if(ctx.mode==='spelling'&&!ctx.answered)next.disabled=!has;if(ctx.mode!=='spelling'&&has&&!ctx.answered)gradeCurrent()}});
  next.disabled=ctx.mode!=='spelling';
  next.onclick=()=>{if(ctx.mode==='spelling'&&!ctx.answered)return gradeCurrent();if(!ctx.answered)return;ctx.index++;renderStudyQuestion()};
  if(ctx.mode==='spelling'){const input=ctx.host.querySelector('[data-write]');input?.focus();input?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(!ctx.answered)gradeCurrent();else{ctx.index++;renderStudyQuestion()}}})}
}
async function gradeCurrent(){
  if(ctx.answered||!ctx.renderer||!ctx.question)return;ctx.answered=true;const q=ctx.question,response=ctx.renderer.getResponse(),result=await gradeQuestion(q,response);result.responseTimeMs=Date.now()-ctx.startedAt;ctx.renderer.setDisabled(true);ctx.renderer.showFeedback(result);if(result.correct){ctx.score++;const key=CLEARED_KEY[ctx.mode],set=new Set(uniq(ctx.progress[key]));set.add(String(q.id));await queueProgressSave({[key]:[...set]})}else ctx.wrong.add(String(q.id));
  try{await recordAttempt({question:q,response,result,practiceType:'vocabulary'})}catch(e){console.warn('[v2.13 vocab] attempt queue failed',e)}
  const next=ctx.host.querySelector('#vpNext');if(next){next.disabled=false;next.textContent=ctx.index===ctx.queue.length-1?'끝내기':'다음'}
}
async function finishStudyRound(){
  await saveChain;await completeSession({correct:ctx.score,total:ctx.queue.length,wrongIds:[...ctx.wrong]});const wasComplete=isComplete(ctx.mode),pending=remainingIds(ctx.mode);
  if(!wasComplete&&pending.length){shell(`<div class="vp-result"><div class="vp-score">${ctx.score}/${ctx.queue.length}</div><h2>한 번 더 도전해요</h2><p>${pending.length===1?'남은 1개를 다시 확인해요.':`남은 ${pending.length}개를 다시 확인해요.`}</p><button class="vp-next" id="vpAgain">${pending.length===1?'남은 1개 계속하기':`남은 ${pending.length}개 계속하기`}</button></div>`,LABEL[ctx.mode]);ctx.host.querySelector('#vpAgain').onclick=()=>startMode(ctx.mode);return}
  if(!wasComplete){await queueProgressSave({[COMPLETE_KEY[ctx.mode]]:true});await saveChain}
  shell(`<div class="vp-result"><div class="vp-score">${ctx.score}/${ctx.queue.length}</div><h2>${ctx.score===ctx.queue.length?'완벽해요!':'단계 완료'}</h2><p>${ctx.queue.length?Math.round(ctx.score/ctx.queue.length*100):0}% correct</p></div>`,LABEL[ctx.mode]);
  if(wasComplete)return;
  if(ctx.mode==='spelling'){showModal('Vocabulary 완료!','모든 단어를 Spelling까지 끝냈어요. 처음 틀린 기록은 오답 복습에 그대로 남아 있습니다.','레슨으로 돌아가기',exit);return}
  const next=ORDER[ORDER.indexOf(ctx.mode)+1];showModal('다음 단계가 열렸어요!',`${LABEL[ctx.mode]}의 모든 단어를 끝냈어요. ${LABEL[next]} 단계가 영구적으로 열렸습니다.`,`${LABEL[next]} 시작`,()=>startMode(next))
}
async function startMode(mode,{practiceAgain=false}={}){
  if(!ctx||!unlocked(mode))return false;await saveChain;ctx.mode=mode;ctx.index=0;ctx.score=0;ctx.wrong=new Set();ctx.renderer=null;ctx.question=null;
  if(mode==='cards'){
    ctx.cardUnknown=new Set();ctx.cardRepeat=false;const pending=practiceAgain||isComplete('cards')?ctx.items:ctx.items.filter(x=>ctx.cardKnown.get(norm(x.canonical_text))!==true);ctx.queue=shuffle(pending.length?pending:ctx.items);renderCard();return true;
  }
  const ids=practiceAgain||isComplete(mode)?ctx.items.map(x=>String(x.id)):remainingIds(mode),wanted=new Set(ids);ctx.queue=shuffle(ctx.items.filter(x=>wanted.has(String(x.id))));if(!ctx.queue.length){await queueProgressSave({[COMPLETE_KEY[mode]]:true});const next=ORDER[ORDER.indexOf(mode)+1];if(next)showModal('다음 단계가 열렸어요!',`${LABEL[mode]}을 완료했어요. ${LABEL[next]} 단계가 열렸습니다.`,`${LABEL[next]} 시작`,()=>startMode(next));else showModal('Vocabulary 완료!','모든 단계를 완료했어요.','레슨으로 돌아가기',exit);return false}
  await startSession('vocabulary');renderStudyQuestion();return true;
}
function showDone(){ctx.mode='cards';ctx.queue=[];ctx.index=0;shell(`<div class="vp-result tp-vocab-done"><div class="tp-vocab-done-mark">✓</div><h2>Vocabulary 완료</h2><p>카드부터 Spelling까지 모두 끝냈어요. 틀렸던 단어가 있다면 오답 복습에는 그대로 남아 있습니다.</p><button type="button" class="tp-vocab-reopen" id="vpReopen">다시 학습하기</button></div>`);ctx.host.querySelector('#vpReopen').onclick=()=>startMode('cards',{practiceAgain:true})}
async function exit(){if(!ctx)return;try{if(ctx.mode!=='cards')await completeSession({correct:ctx.score,total:ctx.index,wrongIds:[...ctx.wrong]})}catch(e){console.warn('[v2.13 vocab] close session failed',e)}const cb=ctx.onExit;ctx=null;cb?.()}

export async function getVocabularyProgress(planId,lesson){
  const student=trackingState().user?.id;if(!student||!planId||!lesson)return blankProgress();const q=new URLSearchParams({select:'cards_complete,ko_en_complete,en_ko_complete,spelling_complete,ko_en_cleared,en_ko_cleared,spelling_cleared',student_id:`eq.${student}`,plan_id:`eq.${planId}`,lesson:`eq.${lesson}`,limit:'1'});try{const rows=await trackGet(`/rest/v1/test_prep_vocab_progress?${q}`);return normalizedProgress(rows?.[0]||{})}catch{return blankProgress()}
}

export async function startVocabularyLearning({host,plan,lesson,unitId,onExit}){
  if(!host||!plan?.id||!lesson||!unitId)throw new Error('Vocabulary practice could not start.');
  ctx={host,plan,lesson,unitId,onExit,items:[],progress:blankProgress(),cardKnown:new Map(),cardUnknown:new Set(),cardRepeat:false,mode:'cards',queue:[],index:0,score:0,wrong:new Set(),renderer:null,question:null,startedAt:0,cardShownAt:0};
  host.innerHTML='<div class="loading">단어를 불러오는 중...</div>';
  ctx.items=await loadItems(unitId);if(!ctx.items.length){host.innerHTML='<div class="empty">이 Lesson에 사용할 Vocabulary가 없습니다.</div>';return}
  [ctx.progress,ctx.cardKnown]=await Promise.all([loadProgress(),loadCardChecks()]);
  if(!ctx.progress.cards_complete&&ctx.items.every(x=>ctx.cardKnown.get(norm(x.canonical_text))===true))await queueProgressSave({cards_complete:true});
  await saveChain;
  if(ctx.progress.spelling_complete){showDone();return}
  await startMode(firstUnfinished()||'cards');
}
