(function(){
'use strict';

const REVIEW_EDGE='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-review-v48';
const REVIEW_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const CONTENT_HEADERS={apikey:CONTENT_KEY,Authorization:`Bearer ${CONTENT_KEY}`};
const RUN_LIMIT=20;
const IS_STAGING=/^staging\./i.test(location.hostname)||['localhost','127.0.0.1'].includes(location.hostname);
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=s=>esc(String(s??'')).replace(/\r\n?/g,'\n').replace(/\n/g,'<br>');
const uuidLike=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s||''));

let reviews=[],run=[],index=0,done=0,correct=0,wrong=[],active=false,saving=false,currentQuestion=null;

function token(){return window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||''}
function due(x){return x?.due_now===true||!x?.next_review_at||new Date(x.next_review_at).getTime()<=Date.now()}
function mins(x){if(!x?.next_review_at)return 0;return Math.max(1,Math.ceil((new Date(x.next_review_at).getTime()-Date.now())/60000))}
function answerArray(v){if(Array.isArray(v))return v.map(x=>String(x??'').trim()).filter(Boolean);if(v==null)return[];return[String(v).trim()].filter(Boolean)}
function normText(v){return String(v??'').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/[\s\u00a0]+/g,' ').replace(/[.?!]+$/,'').trim()}
function sameSet(a,b){const A=[...a].map(String).sort(),B=[...b].map(String).sort();return A.length===B.length&&A.every((x,i)=>x===B[i])}
function planFor(item){return window.WillenaTestPrepAuth?.state?.plans?.find(p=>String(p.id)===String(item.plan_id))||item.plan||null}

function installStyles(){
 if($('#tpReview48Styles'))return;
 const s=document.createElement('style');s.id='tpReview48Styles';s.textContent=`
 .tp48-page{width:min(900px,calc(100% - 24px));margin:18px auto 42px;font-family:Poppins,'Noto Sans KR',system-ui,sans-serif;color:#203039}
 .tp48-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 0 16px}.tp48-back{border:0;background:transparent;color:#52666e;font:800 13px Poppins;cursor:pointer;padding:8px 0}.tp48-title{margin:0;font-size:25px;font-weight:800}.tp48-sub{margin:4px 0 0;color:#74868d;font-size:12px;font-weight:600}
 .tp48-panel,.tp48-card{background:#fff;border:1.5px solid #b8e7e9;border-radius:24px;box-shadow:0 12px 38px rgba(31,63,68,.08)}.tp48-panel{padding:22px}.tp48-card{overflow:hidden}
 .tp48-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}.tp48-stat{background:#f4f9f9;border-radius:16px;padding:14px;text-align:center}.tp48-stat b{display:block;font-size:24px;color:#19777e}.tp48-stat span{display:block;font-size:10px;font-weight:800;color:#7a8b90;margin-top:2px}
 .tp48-primary,.tp48-next,.tp48-test{width:100%;border:0;border-radius:15px;padding:14px 16px;font:800 14px Poppins,sans-serif;cursor:pointer}.tp48-primary,.tp48-next{background:#19777e;color:#fff}.tp48-test{background:#fff3bf;color:#6e5200;border:1px solid #ead66f;margin-top:9px}.tp48-primary:disabled,.tp48-next:disabled,.tp48-test:disabled{opacity:.45;cursor:default}
 .tp48-wait{text-align:center;padding:24px 12px;color:#61747b;font-size:13px;line-height:1.7}.tp48-wait b{display:block;color:#203039;font-size:18px;margin-bottom:4px}
 .tp48-run-head{padding:18px 20px 12px;border-bottom:1px solid #e8f1f2}.tp48-run-row{display:flex;justify-content:space-between;gap:12px;align-items:center}.tp48-count{font-size:13px;font-weight:800;color:#607078}.tp48-skill{font-size:10px;font-weight:800;color:#19777e;background:#eaf7f7;border-radius:999px;padding:5px 9px}.tp48-progress{height:8px;background:#edf4f4;border-radius:99px;overflow:hidden;margin-top:12px}.tp48-progress i{display:block;height:100%;background:#19777e;border-radius:99px;transition:width .2s ease}
 .tp48-body{padding:24px 22px}.tp48-prompt{font-size:20px;line-height:1.5;font-weight:800;margin-bottom:16px}.tp48-context{background:#f8fbfb;border:1px solid #d8ecee;border-radius:15px;padding:14px 15px;margin:10px 0;font-size:15px;line-height:1.65;font-weight:600}.tp48-context b{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#71858b;margin-bottom:5px}.tp48-grid{display:grid;gap:10px;margin-top:18px}.tp48-choice{width:100%;text-align:left;border:1.5px solid #b8e7e9;background:#fff;color:#26383f;border-radius:15px;padding:14px;font:700 15px/1.5 Poppins,'Noto Sans KR',sans-serif;cursor:pointer}.tp48-choice.on{border-color:#19777e;background:#effafa;box-shadow:0 0 0 3px rgba(25,119,126,.08)}.tp48-choice.correct{border-color:#5eb77b;background:#eefaf2;color:#176b35}.tp48-choice.wrong{border-color:#df8c92;background:#fff1f1;color:#953039}.tp48-n{display:inline-block;min-width:30px;font-weight:800}.tp48-input{width:100%;box-sizing:border-box;border:2px solid #8edcdf;border-radius:15px;padding:14px 15px;font:700 17px Poppins,sans-serif;outline:none}.tp48-input:focus{border-color:#19777e}.tp48-actions{margin-top:18px}.tp48-feedback{display:none;border-radius:13px;padding:12px 14px;margin-top:14px;font-size:13px;font-weight:800}.tp48-feedback.ok{display:block;background:#eefaf2;color:#176b35}.tp48-feedback.bad{display:block;background:#fff1f1;color:#953039}.tp48-source{font-size:10px;color:#8a999e;font-weight:700;margin-top:12px}
 .tp48-done{text-align:center;padding:34px 20px}.tp48-done h2{font-size:24px;margin:0 0 8px}.tp48-done p{color:#667980;font-size:13px;line-height:1.6}.tp48-score{font-size:52px;font-weight:800;color:#19777e;margin:8px 0}
 @media(max-width:600px){.tp48-page{width:calc(100% - 18px);margin-top:10px}.tp48-body{padding:20px 16px}.tp48-prompt{font-size:18px}.tp48-stats{gap:7px}.tp48-stat{padding:12px 6px}.tp48-stat b{font-size:21px}}
 `;document.head.appendChild(s)
}

async function load(){
 const t=token();if(!t)throw new Error('로그인이 필요합니다.');
 const r=await fetch(REVIEW_EDGE,{headers:{Authorization:`Bearer ${t}`,apikey:REVIEW_KEY},cache:'no-store'});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||d.success===false)throw new Error(d.error||'오답을 불러오지 못했습니다.');
 const seen=new Set();
 return (d.reviews||[]).filter(x=>{const k=`${x.plan_id}::${x.question_id}`;if(seen.has(k))return false;seen.add(k);return true});
}

async function contentQuestion(id){
 if(!uuidLike(id))return null;
 const sel='id,section,source_question_number,question_type,prompt_text,context,choices,correct_answer,targets,answer_mode,student_source_label,content_status,metadata';
 const r=await fetch(`${CONTENT}/rest/v1/test_prep_questions?select=${encodeURIComponent(sel)}&id=eq.${encodeURIComponent(id)}&limit=1`,{headers:CONTENT_HEADERS,cache:'no-store'});
 if(!r.ok)return null;const rows=await r.json().catch(()=>[]);return rows?.[0]||null;
}

async function materialize(item){
 const ids=[item.question_id,item?.attempt_metadata?.source_question_id,item?.metadata?.source_question_id].map(String).filter((x,i,a)=>x&&a.indexOf(x)===i);
 let q=null;for(const id of ids){q=await contentQuestion(id);if(q)break}
 if(q)return q;
 const m={...(item.attempt_metadata||{}),...(item.metadata||{})};
 const expected=answerArray(item.correct_answer_snapshot);
 if(String(item.practice_type)==='sentences'||m.sentence||m.korean){
  const answer=expected[0]||String(m.sentence||'');
  return{id:item.question_id,section:'sentences',question_type:item.question_type||'sentence_review',prompt_text:'다음 문장을 영어로 쓰세요.',context:{korean:m.korean||null},choices:[],correct_answer:answer?[answer]:[],answer_mode:'text',targets:item.targets||[],student_source_label:m.source_label||m.activity_title||'본문외우기',metadata:m};
 }
 const canonical=String(m.mastery_target_text||m.canonical_text||'').trim();
 if(canonical){
  return{id:item.question_id,section:item.practice_type||'vocab_test',question_type:item.question_type||'vocab_review',prompt_text:m.prompt_text||'다음 단어 또는 표현을 쓰세요.',context:{korean:m.translation_ko||null,definition:m.definition_en||null},choices:[],correct_answer:[expected[0]||canonical],answer_mode:'text',targets:item.targets||[],student_source_label:m.source_label||'어휘 시험',metadata:m};
 }
 return{id:item.question_id,section:item.practice_type||'review',question_type:item.question_type||'review',prompt_text:m.prompt_text||'이 오답을 다시 확인하세요.',context:m.context||{},choices:Array.isArray(m.choices)?m.choices:[],correct_answer:expected,answer_mode:Array.isArray(m.choices)&&m.choices.length?'single_select':'text',targets:item.targets||[],student_source_label:m.source_label||'오답 복습',metadata:m};
}

function ctxBlock(label,value){
 if(value==null||value==='')return'';
 if(Array.isArray(value))return `<div class="tp48-context">${label?`<b>${esc(label)}</b>`:''}${value.map(v=>`<div>${text(typeof v==='string'?v:JSON.stringify(v))}</div>`).join('')}</div>`;
 if(typeof value==='object')return `<div class="tp48-context">${label?`<b>${esc(label)}</b>`:''}${Object.entries(value).map(([k,v])=>`<div><strong>${esc(k)}</strong> ${text(typeof v==='string'?v:JSON.stringify(v))}</div>`).join('')}</div>`;
 return `<div class="tp48-context">${label?`<b>${esc(label)}</b>`:''}${text(value)}</div>`;
}
function renderContext(c={}){
 const order=[['korean','우리말'],['definition','정의'],['sentence','문장'],['passage','지문'],['dialogue','대화'],['source_passage','원문'],['rewritten','바꿔 쓴 글'],['given_sentence','보기'],['bank','보기'],['items',''],['statements',''],['pairs',''],['clues','문제 단서'],['segments','A–D'],['claims','설명'],['table','표'],['source',''],['source_sentence',''],['original','원문'],['comparison','비교']];
 const used=new Set();let out='';for(const [k,l] of order){if(c?.[k]!=null&&c[k]!==''){out+=ctxBlock(l,c[k]);used.add(k)}}
 for(const [k,v] of Object.entries(c||{})){if(used.has(k)||v==null||v===''||['underlined','underlined_spans'].includes(k))continue;if(typeof v==='string'||Array.isArray(v))out+=ctxBlock(k,v)}return out;
}
function choiceText(x){return typeof x==='string'?x:String(x?.text??x?.label??x?.value??JSON.stringify(x))}
function correctFor(item,q){const snap=answerArray(item.correct_answer_snapshot);return snap.length?snap:answerArray(q?.correct_answer)}
function modeFor(q,correct){const m=String(q?.answer_mode||'').toLowerCase();if(Array.isArray(q?.choices)&&q.choices.length&&(m.includes('choice')||m.includes('select')||m==='single'||m==='multi'||correct.every(x=>/^\d+$/.test(x))))return correct.length>1||m.includes('multi')?'multi':'choice';return'text'}
function skillLabel(k){return({vocabulary:'Vocabulary',vocab_test:'Vocab Test',communication:'Communication',grammar:'Grammar',sentences:'본문외우기',reading:'Reading',constructed_response:'서술형'}[String(k||'').toLowerCase()]||String(k||'Review'))}

function suppressLegacy(){
 window.__WillenaReviewV48Active=true;
 $('.app')?.classList.remove('tp-rev42-result-active');
 const oldResult=$('#tpRev42Result');if(oldResult){oldResult.style.display='none';oldResult.innerHTML=''}
 const quiz=$('#assignedQuizPane');if(quiz)quiz.style.display='none';
 const engine=$('#engineShell');if(engine)engine.style.display='none';
}
function releaseLegacy(){window.__WillenaReviewV48Active=false;const engine=$('#engineShell');if(engine)engine.style.display=''}
function home(){return $('#assignmentHome')}
function backHome(){active=false;run=[];currentQuestion=null;releaseLegacy();window.WillenaTestPrepUX?.renderHome?.()}

function card(revs){
 const ready=revs.filter(due).length,later=revs.length-ready;
 return `<button class="tp-wrong-card ${revs.length?'':'no-wrong'}" ${revs.length?'':'disabled'}><span class="tp-wrong-icon">↺</span><span class="tp-wrong-copy"><b>${revs.length?'오답 복습':'오답 없음'}</b><small>${ready?`남은 ${revs.length}개 · 지금 ${ready}개`:later?`남은 ${revs.length}개 · 다음 복습 대기 중`:'현재 남아 있는 오답이 없어요'}</small></span><span class="tp-wrong-count">${revs.length}<small>개 남음</small></span></button>`;
}
async function refreshHomeCard(){
 if(active)return;const h=home();if(!h)return;
 try{const revs=await load(),old=$('.tp-wrong-card',h);if(!old)return;const wrap=document.createElement('div');wrap.innerHTML=card(revs);old.replaceWith(wrap.firstElementChild);$('.tp-wrong-card:not(.no-wrong)',h)?.addEventListener('click',show)}catch(e){console.warn('[REV48] card refresh failed',e)}
}

async function show(){
 installStyles();suppressLegacy();active=true;run=[];index=0;done=0;correct=0;wrong=[];currentQuestion=null;
 const h=home();if(!h)return;h.style.display='block';h.innerHTML='<div class="tp48-page"><div class="tp48-panel"><div class="tp48-wait">오답을 불러오는 중...</div></div></div>';
 try{
  reviews=await load();const ready=reviews.filter(due),later=reviews.filter(x=>!due(x)).sort((a,b)=>new Date(a.next_review_at)-new Date(b.next_review_at)),next=later[0],count=Math.min(RUN_LIMIT,ready.length);
  h.innerHTML=`<div class="tp48-page"><div class="tp48-top"><div><button class="tp48-back">← 시험 대비</button><h1 class="tp48-title">오답 복습</h1><p class="tp48-sub">별도 REV48 러너 · 한 번에 최대 20문제</p></div></div><div class="tp48-panel"><div class="tp48-stats"><div class="tp48-stat"><b>${ready.length}</b><span>지금 복습</span></div><div class="tp48-stat"><b>${later.length}</b><span>대기 중</span></div><div class="tp48-stat"><b>${reviews.length}</b><span>남은 오답</span></div></div>${ready.length?`<button class="tp48-primary" id="tp48Start">${count}문제 연속 복습 시작 →</button>${ready.length>RUN_LIMIT?'<div class="tp48-wait">이번 실행은 20문제입니다. 끝나면 다음 20문제를 바로 시작할 수 있어요.</div>':''}`:reviews.length?`<div class="tp48-wait"><b>지금은 풀 문제가 없어요.</b>다음 복습 약 ${mins(next)}분 후</div>`:'<div class="tp48-wait"><b>오답 완료 🎉</b>남아 있는 오답이 없어요.</div>'}</div></div>`;
  $('.tp48-back',h).onclick=backHome;$('#tp48Start',h)?.addEventListener('click',()=>start(ready));
 }catch(e){h.innerHTML=`<div class="tp48-page"><button class="tp48-back">← 시험 대비</button><div class="tp48-panel"><div class="tp48-wait"><b>오답을 불러오지 못했습니다.</b>${esc(e.message)}</div></div></div>`;$('.tp48-back',h).onclick=backHome}
}

async function start(items){
 suppressLegacy();active=true;const seen=new Set();run=(items||[]).filter(due).filter(x=>{const k=`${x.plan_id}::${x.question_id}`;if(seen.has(k))return false;seen.add(k);return true}).slice(0,RUN_LIMIT);index=0;done=0;correct=0;wrong=[];
 if(!run.length)return show();await renderCurrent();
}

async function ensurePlan(item){
 const auth=window.WillenaTestPrepAuth;if(!auth)throw new Error('학습 기록 시스템을 불러오지 못했습니다.');const p=planFor(item);if(!p)throw new Error('시험 계획을 찾지 못했습니다.');
 const same=String(auth.state?.plan?.id||'')===String(item.plan_id)&&String(auth.state?.lesson||'')===String(item.unit_key||'');if(!same)auth.setActivePlan(p,item.unit_key||null);
}

async function saveAnswer(item,q,ok,selected,testMode=false){
 if(saving)return false;saving=true;setButtons(false);
 try{
  await ensurePlan(item);const auth=window.WillenaTestPrepAuth;if(!auth?.recordAttempt)throw new Error('기록 저장기를 찾지 못했습니다.');const answers=correctFor(item,q);
  const r=await auth.recordAttempt({practice_type:String(item.practice_type||q.section||'reading').toLowerCase(),question_id:String(item.question_id),selected_answer:selected,correct_answer:answers,is_correct:!!ok,question_type:item.question_type||q.question_type||null,targets:Array.isArray(item.targets)&&item.targets.length?item.targets:(Array.isArray(q.targets)?q.targets:[]),source_label:q.student_source_label||item?.attempt_metadata?.source_label||item?.metadata?.source_label||'오답 복습',metadata:{review_mode:true,source:'wrong-review',review_state_id:String(item.question_id),source_question_id:q.id||null,review_runner:'v48',staging_auto_correct:!!testMode}});
  if(!r)throw new Error('오답 기록 저장에 실패했습니다.');await auth.flushAttemptBatch?.('review-v48');const bs=auth.getAttemptBatchState?.();if(bs&&Number(bs.queued)>0)throw new Error('오답 기록이 아직 저장되지 않았습니다.');
  done++;if(ok)correct++;else wrong.push(String(item.question_id));return true;
 }catch(e){showFeedback(false,'저장 실패: '+String(e?.message||e));setButtons(true);return false}finally{saving=false}
}
function setButtons(on){document.querySelectorAll('.tp48-choice,.tp48-input,.tp48-next,.tp48-test').forEach(el=>{if('disabled'in el)el.disabled=!on})}
function showFeedback(ok,msg){const f=$('#tp48Feedback');if(!f)return;f.className='tp48-feedback '+(ok?'ok':'bad');f.textContent=msg}

async function renderCurrent(){
 suppressLegacy();const h=home();if(!h)return;if(index>=run.length)return finishRun();const item=run[index];
 h.style.display='block';h.innerHTML='<div class="tp48-page"><div class="tp48-card"><div class="tp48-wait">문제를 준비하는 중...</div></div></div>';
 try{currentQuestion=await materialize(item)}catch(e){currentQuestion=null}
 const q=currentQuestion||{id:item.question_id,prompt_text:'이 오답을 다시 확인하세요.',context:{},choices:[],correct_answer:answerArray(item.correct_answer_snapshot),answer_mode:'text',targets:item.targets||[]};
 const answers=correctFor(item,q),mode=modeFor(q,answers),choices=Array.isArray(q.choices)?q.choices:[],multi=mode==='multi',source=q.student_source_label||item?.attempt_metadata?.source_label||item?.metadata?.source_label||'';
 h.innerHTML=`<div class="tp48-page"><div class="tp48-card"><div class="tp48-run-head"><div class="tp48-run-row"><span class="tp48-count">${index+1} / ${run.length}</span><span class="tp48-skill">${esc(skillLabel(item.practice_type))}</span></div><div class="tp48-progress"><i style="width:${Math.round(index/run.length*100)}%"></i></div></div><div class="tp48-body"><div class="tp48-prompt">${text(q.prompt_text||'')}</div>${renderContext(q.context||{})}${mode==='text'?'<input class="tp48-input" id="tp48Input" autocomplete="off" spellcheck="false" placeholder="답을 입력하세요">':`<div class="tp48-grid" id="tp48Choices">${choices.map((c,i)=>`<button class="tp48-choice" data-i="${i+1}"><span class="tp48-n">${['①','②','③','④','⑤','⑥','⑦','⑧'][i]||i+1}</span>${text(choiceText(c))}</button>`).join('')}</div>`}<div class="tp48-feedback" id="tp48Feedback"></div><div class="tp48-actions"><button class="tp48-next" id="tp48Check" ${mode==='text'?'':'disabled'}>정답 확인</button>${IS_STAGING?'<button class="tp48-test" id="tp48Test">TEST · 이 문제 정답 처리 ✓</button>':''}</div>${source?`<div class="tp48-source">${esc(source)}</div>`:''}</div></div></div>`;
 let selected=new Set(),answered=false;const check=$('#tp48Check',h),input=$('#tp48Input',h);
 const next=()=>{index++;renderCurrent()};
 const reveal=ok=>{if(mode!=='text'){$$('.tp48-choice',h).forEach(b=>{const n=String(b.dataset.i);if(answers.includes(n))b.classList.add('correct');else if(selected.has(n))b.classList.add('wrong');b.disabled=true})}if(input)input.disabled=true;showFeedback(ok,ok?'정답입니다!':'정답: '+answers.join(', '));check.disabled=false;check.textContent=index===run.length-1?'복습 끝내기':'다음 문제';answered=true};
 async function submit(testMode=false){
  if(answered)return next();let ok=false,sel;
  if(testMode){ok=true;sel=mode==='text'?(answers[0]||''):[...answers]}
  else if(mode==='text'){const typed=input?.value??'';if(!String(typed).trim())return;sel=String(typed);ok=answers.some(a=>normText(a)===normText(typed))}
  else{sel=[...selected];if(!sel.length)return;ok=sameSet(sel,answers)}
  const saved=await saveAnswer(item,q,ok,sel,testMode);if(!saved)return;reveal(ok);if(testMode)setTimeout(next,120);
 }
 if(mode==='text'){input?.focus();input?.addEventListener('input',()=>{if(!answered)check.disabled=!input.value.trim()});input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit(false)}})}
 else $$('.tp48-choice',h).forEach(b=>b.onclick=()=>{if(answered)return;const n=String(b.dataset.i);if(multi){selected.has(n)?selected.delete(n):selected.add(n);b.classList.toggle('on',selected.has(n))}else{selected=new Set([n]);$$('.tp48-choice',h).forEach(x=>x.classList.toggle('on',x===b))}check.disabled=!selected.size});
 check.onclick=()=>submit(false);$('#tp48Test',h)?.addEventListener('click',()=>submit(true));
}
function $$(s,r=document){return[...r.querySelectorAll(s)]}

async function finishRun(){
 const auth=window.WillenaTestPrepAuth;try{if(auth?.state?.session)await auth.completeSession?.(correct,done,wrong)}catch(_){}
 const h=home();if(!h)return;let all=[];try{all=await load()}catch(_){}reviews=all;const ready=all.filter(due),later=all.filter(x=>!due(x)).sort((a,b)=>new Date(a.next_review_at)-new Date(b.next_review_at)),next=later[0],pct=done?Math.round(correct/done*100):0;
 h.innerHTML=`<div class="tp48-page"><div class="tp48-card"><div class="tp48-done"><h2>이번 오답 복습 완료 ✓</h2><div class="tp48-score">${done}</div><p>${done}문제 완료 · 정답률 ${pct}%</p>${ready.length?`<button class="tp48-primary" id="tp48More">다음 ${Math.min(RUN_LIMIT,ready.length)}문제 계속 →</button>`:all.length?`<div class="tp48-wait"><b>지금 풀 문제는 끝났어요.</b>다음 복습 약 ${mins(next)}분 후</div>`:'<div class="tp48-wait"><b>오답 완료 🎉</b>남아 있는 오답이 없어요.</div>'}<button class="tp48-test" id="tp48Home">시험 대비로 돌아가기</button></div></div></div>`;
 $('#tp48More',h)?.addEventListener('click',()=>start(ready));$('#tp48Home',h).onclick=backHome;refreshHomeCard();
}

function install(){
 installStyles();const ux=window.WillenaTestPrepUX;if(!ux){setTimeout(install,50);return}ux.showWrongCenter=show;const old=ux.renderHome;if(!old.__rev48){const wrapped=function(){const r=old.apply(this,arguments);setTimeout(refreshHomeCard,60);return r};wrapped.__rev48=true;ux.renderHome=wrapped}refreshHomeCard();
}
window.addEventListener('testprep:student-state-refresh',()=>{if(!active)setTimeout(refreshHomeCard,80)});
window.WillenaReviewV48={show,load,start};
install();
console.log('[REV48] standalone wrong-answer runner active; legacy practice engines are not used for review');
})();
