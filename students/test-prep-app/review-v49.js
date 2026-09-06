(function(){
'use strict';
const REVIEW_EDGE='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-review-v48';
const REVIEW_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const CONTENT_HEADERS={apikey:CONTENT_KEY,Authorization:`Bearer ${CONTENT_KEY}`};
const RUN_LIMIT=20;
const IS_STAGING=/^staging\./i.test(location.hostname)||['localhost','127.0.0.1'].includes(location.hostname);
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const htmlText=s=>esc(String(s??'')).replace(/\r\n?/g,'\n').replace(/\n/g,'<br>');
const uuidLike=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s||''));
let reviews=[],run=[],index=0,done=0,correct=0,wrong=[],active=false,saving=false;

function token(){return window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||''}
function due(x){return x?.due_now===true||!x?.next_review_at||new Date(x.next_review_at).getTime()<=Date.now()}
function mins(x){if(!x?.next_review_at)return 0;return Math.max(1,Math.ceil((new Date(x.next_review_at).getTime()-Date.now())/60000))}
function arr(v){if(Array.isArray(v))return v.map(x=>String(x??'').trim()).filter(Boolean);if(v==null)return[];return[String(v).trim()].filter(Boolean)}
function norm(v){return String(v??'').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/[\s\u00a0]+/g,' ').replace(/[.?!]+$/,'').trim()}
function numeric(v){return /^\d+$/.test(String(v||'').trim())}
function meta(item){return{...(item?.metadata||{}),...(item?.attempt_metadata||{})}}
function planFor(item){return window.WillenaTestPrepAuth?.state?.plans?.find(p=>String(p.id)===String(item.plan_id))||item.plan||null}
function choiceText(x){return typeof x==='string'?x:String(x?.text??x?.label??x?.value??JSON.stringify(x))}
function stableVocabText(item){const qid=String(item?.question_id||'');return qid.startsWith('vocab:')?qid.slice(6).trim():''}
function canonicalText(item,q){
 const m=meta(item),keys=['mastery_target_text','canonical_text','answer_text','expected_answer','target_text','word','term'];
 for(const k of keys){const v=String(m?.[k]??'').trim();if(v&&!numeric(v))return v}
 if(String(item?.practice_type||'').toLowerCase()==='sentences'){
  const s=String(m?.sentence??m?.english??m?.source_sentence??'').trim();if(s&&!numeric(s))return s;
 }
 const qAns=arr(q?.correct_answer).filter(x=>!numeric(x));if(qAns.length)return qAns[0];
 const snap=arr(item?.correct_answer_snapshot).filter(x=>!numeric(x));if(snap.length)return snap[0];
 return stableVocabText(item);
}
function qType(item,q){return String(q?.question_type||item?.question_type||meta(item)?.question_type||'').toLowerCase()}
function isUnscramble(item,q){const t=qType(item,q);return t.includes('sentence_unscramble')||t.includes('unscramble')}
function isConstructed(item,q){const m={...meta(item),...(q?.metadata||{})},t=qType(item,q);return String(item?.practice_type||'').toLowerCase()==='constructed_response'||m.constructed_response===true||m.authored_constructed_response===true||m.constructed_response_authored===true||m.authored_constructed_response===true||t.includes('correction_text')}

function installStyles(){
 if($('#tpReview49RunnerStyles'))return;
 const s=document.createElement('style');s.id='tpReview49RunnerStyles';s.textContent=`
 .tp49-page{width:min(900px,calc(100% - 24px));margin:18px auto 42px;font-family:Poppins,'Noto Sans KR',system-ui,sans-serif;color:#203039}
 .tp49-top{margin-bottom:14px}.tp49-back{border:0;background:transparent;color:#52666e;font:800 13px Poppins;cursor:pointer;padding:8px 0}
 .tp49-title{margin:4px 0 0;font-size:25px;font-weight:800}.tp49-sub{margin:4px 0 0;color:#74868d;font-size:12px;font-weight:600}
 .tp49-panel,.tp49-card{background:#fff;border:1.5px solid #b8e7e9;border-radius:24px;box-shadow:0 12px 38px rgba(31,63,68,.08)}
 .tp49-panel{padding:22px}.tp49-card{overflow:hidden}.tp49-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}
 .tp49-stat{background:#f4f9f9;border-radius:16px;padding:14px;text-align:center}.tp49-stat b{display:block;font-size:24px;color:#19777e}.tp49-stat span{display:block;font-size:10px;font-weight:800;color:#7a8b90;margin-top:2px}
 .tp49-primary,.tp49-next,.tp49-test{width:100%;border:0;border-radius:15px;padding:14px 16px;font:800 14px Poppins,sans-serif;cursor:pointer}.tp49-primary,.tp49-next{background:#19777e;color:#fff}.tp49-test{background:#fff4bd;color:#6b5300;border:1px solid #e9d56f;margin-top:10px}.tp49-primary:disabled,.tp49-next:disabled,.tp49-test:disabled{opacity:.45;cursor:default}
 .tp49-wait{text-align:center;padding:24px 12px;color:#61747b;font-size:13px;line-height:1.7}.tp49-wait b{display:block;color:#203039;font-size:18px;margin-bottom:4px}
 .tp49-run-head{padding:18px 20px 12px;border-bottom:1px solid #e8f1f2}.tp49-run-row{display:flex;justify-content:space-between;gap:12px;align-items:center}.tp49-count{font-size:13px;font-weight:800;color:#607078}.tp49-skill{font-size:10px;font-weight:800;color:#19777e;background:#eaf7f7;border-radius:999px;padding:5px 9px}.tp49-progress{height:8px;background:#edf4f4;border-radius:99px;overflow:hidden;margin-top:12px}.tp49-progress i{display:block;height:100%;background:#19777e;border-radius:99px;transition:width .2s ease}
 .tp49-body{padding:24px 22px}.tp49-prompt{font-size:20px;line-height:1.5;font-weight:800;margin-bottom:16px}.tp49-context{background:#f8fbfb;border:1px solid #d8ecee;border-radius:15px;padding:14px 15px;margin:10px 0;font-size:15px;line-height:1.65;font-weight:600}.tp49-context b{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#71858b;margin-bottom:5px}
 .tp49-grid{display:grid;gap:10px;margin-top:18px}.tp49-choice{width:100%;text-align:left;border:1.5px solid #b8e7e9;background:#fff;color:#26383f;border-radius:15px;padding:14px;font:700 15px/1.5 Poppins,'Noto Sans KR',sans-serif;cursor:pointer}.tp49-choice.on{border-color:#19777e;background:#effafa;box-shadow:0 0 0 3px rgba(25,119,126,.08)}.tp49-choice.correct{border-color:#5eb77b;background:#eefaf2;color:#176b35}.tp49-choice.wrong{border-color:#df8c92;background:#fff1f1;color:#953039}.tp49-n{display:inline-block;min-width:30px;font-weight:800}
 .tp49-input{width:100%;box-sizing:border-box;border:2px solid #8edcdf;border-radius:15px;padding:14px 15px;font:700 17px Poppins,sans-serif;outline:none}.tp49-input:focus{border-color:#19777e}.tp49-actions{margin-top:18px}.tp49-feedback{display:none;border-radius:13px;padding:12px 14px;margin-top:14px;font-size:13px;font-weight:800}.tp49-feedback.ok{display:block;background:#eefaf2;color:#176b35}.tp49-feedback.bad{display:block;background:#fff1f1;color:#953039}.tp49-source{font-size:10px;color:#8a999e;font-weight:700;margin-top:12px}
 .tp49-done{text-align:center;padding:34px 20px}.tp49-done h2{font-size:24px;margin:0 0 8px}.tp49-done p{color:#667980;font-size:13px;line-height:1.6}.tp49-score{font-size:52px;font-weight:800;color:#19777e;margin:8px 0}
 .tp49-unscramble-answer{min-height:74px;border:2px dashed #9bdcdf;border-radius:16px;padding:12px;display:flex;align-items:flex-start;align-content:flex-start;flex-wrap:wrap;gap:8px;background:#f8fcfc;margin:12px 0}.tp49-unscramble-answer.empty::before{content:'단어를 눌러 문장을 만드세요';color:#9aa9ae;font-weight:700;font-size:13px;padding:9px 4px}.tp49-unscramble-bank{display:flex;flex-wrap:wrap;gap:9px;margin:14px 0 4px}.tp49-word{border:1.5px solid #99dfe2;background:#fff;border-radius:13px;padding:10px 13px;font:800 15px Poppins,'Noto Sans KR',sans-serif;color:#26383f;cursor:pointer;box-shadow:0 3px 10px rgba(31,63,68,.06)}.tp49-word.used{display:none}.tp49-word.answer{background:#eaf8f8;border-color:#19777e}.tp49-unscramble-help{font-size:11px;color:#7a8b90;font-weight:700;margin-top:4px}
 @media(max-width:600px){.tp49-page{width:calc(100% - 18px);margin-top:10px}.tp49-body{padding:20px 16px}.tp49-prompt{font-size:18px}.tp49-stats{gap:7px}.tp49-stat{padding:12px 6px}.tp49-stat b{font-size:21px}}
 `;document.head.appendChild(s);
}

async function load(){const t=token();if(!t)throw new Error('로그인이 필요합니다.');const r=await fetch(REVIEW_EDGE,{headers:{Authorization:`Bearer ${t}`,apikey:REVIEW_KEY},cache:'no-store'}),d=await r.json().catch(()=>({}));if(!r.ok||d.success===false)throw new Error(d.error||'오답을 불러오지 못했습니다.');const seen=new Set();return(d.reviews||[]).filter(x=>{const k=`${x.plan_id}::${x.question_id}`;if(seen.has(k))return false;seen.add(k);return true})}
async function contentQuestion(id){if(!uuidLike(id))return null;const sel='id,section,source_question_number,question_type,prompt_text,context,choices,correct_answer,targets,answer_mode,student_source_label,content_status,metadata';const r=await fetch(`${CONTENT}/rest/v1/test_prep_questions?select=${encodeURIComponent(sel)}&id=eq.${encodeURIComponent(id)}&limit=1`,{headers:CONTENT_HEADERS,cache:'no-store'});if(!r.ok)return null;const rows=await r.json().catch(()=>[]);return rows?.[0]||null}
async function materialize(item){
 const ids=[item.question_id,item?.attempt_metadata?.source_question_id,item?.metadata?.source_question_id].map(String).filter((x,i,a)=>x&&a.indexOf(x)===i);
 for(const id of ids){const q=await contentQuestion(id);if(q)return{...q,metadata:{...meta(item),...(q.metadata||{})}}}
 const m=meta(item),practice=String(item.practice_type||'').toLowerCase(),canonical=canonicalText(item,null),type=qType(item,null);
 if(practice==='sentences'){
  const answer=canonical||arr(item.correct_answer_snapshot).find(x=>!numeric(x))||'',unscramble=type.includes('unscramble');
  return{id:item.question_id,section:'sentences',question_type:type||'sentence_review',prompt_text:unscramble?'다음 단어를 올바른 순서로 배열하세요.':'다음 문장을 영어로 쓰세요.',context:{korean:m.sentence_ko||m.korean||m.translation_ko||null},choices:[],correct_answer:answer?[answer]:[],answer_mode:unscramble?'unscramble':'text',targets:item.targets||[],student_source_label:m.source_label||m.passage_title||m.activity_title||'본문외우기',metadata:m};
 }
 if(['vocabulary','vocab_test'].includes(practice)||canonical){return{id:item.question_id,section:practice||'vocab_test',question_type:type||'vocab_review',prompt_text:m.prompt_text||'다음 단어 또는 표현을 쓰세요.',context:{korean:m.translation_ko||m.korean||null,definition:m.definition_en||m.definition||null},choices:[],correct_answer:canonical?[canonical]:arr(item.correct_answer_snapshot).filter(x=>!numeric(x)),answer_mode:'text',targets:item.targets||[],student_source_label:m.source_label||'어휘 시험',metadata:m}}
 return{id:item.question_id,section:practice||'review',question_type:type||'review',prompt_text:m.prompt_text||'이 오답을 다시 확인하세요.',context:m.context||{},choices:Array.isArray(m.choices)?m.choices:[],correct_answer:arr(item.correct_answer_snapshot),answer_mode:Array.isArray(m.choices)&&m.choices.length?'single_select':'text',targets:item.targets||[],student_source_label:m.source_label||'오답 복습',metadata:m};
}
function resolveSpec(item,q){
 const answer=canonicalText(item,q),choices=Array.isArray(q?.choices)?q.choices:[],mode=String(q?.answer_mode||'').toLowerCase(),qAns=arr(q?.correct_answer).filter(x=>!numeric(x)),snapText=arr(item?.correct_answer_snapshot).filter(x=>!numeric(x));
 if(isConstructed(item,q)){
  const constructedAnswers=qAns.length?qAns:(snapText.length?snapText:(answer?[answer]:[]));
  if(constructedAnswers.length)return{mode:'constructed',answers:constructedAnswers,display:constructedAnswers};
 }
 if(isUnscramble(item,q)){
  const sentence=answer||qAns[0]||snapText[0]||'';
  return{mode:'unscramble',answers:sentence?[sentence]:[],display:sentence?[sentence]:[]};
 }
 const snap=arr(item?.correct_answer_snapshot),allQAns=arr(q?.correct_answer),numericSource=snap.filter(numeric).length?snap.filter(numeric):allQAns.filter(numeric);
 const choiceMode=choices.length>0&&(mode.includes('choice')||mode.includes('select')||mode==='single'||mode==='multi'||numericSource.length>0);
 if(choiceMode){let correctIndices=numericSource;if(!correctIndices.length){const texts=(snap.length?snap:allQAns).map(norm);correctIndices=choices.map((c,i)=>texts.includes(norm(choiceText(c)))?String(i+1):null).filter(Boolean)}return{mode:correctIndices.length>1||mode.includes('multi')?'multi':'choice',answers:correctIndices,display:correctIndices.map(n=>choiceText(choices[Number(n)-1])).filter(Boolean)}}
 let answers=[];if(answer)answers=[answer];if(!answers.length)answers=qAns;if(!answers.length)answers=snapText;return{mode:'text',answers,display:answers};
}
function ctx(label,value){if(value==null||value==='')return'';if(Array.isArray(value))return`<div class="tp49-context">${label?`<b>${esc(label)}</b>`:''}${value.map(v=>`<div>${htmlText(typeof v==='string'?v:JSON.stringify(v))}</div>`).join('')}</div>`;if(typeof value==='object')return`<div class="tp49-context">${label?`<b>${esc(label)}</b>`:''}${Object.entries(value).map(([k,v])=>`<div><strong>${esc(k)}</strong> ${htmlText(typeof v==='string'?v:JSON.stringify(v))}</div>`).join('')}</div>`;return`<div class="tp49-context">${label?`<b>${esc(label)}</b>`:''}${htmlText(value)}</div>`}
function contextFingerprint(value){const stable=v=>{if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object')return Object.keys(v).sort().reduce((o,k)=>{o[k]=stable(v[k]);return o},{});return String(v??'').replace(/\s+/g,' ').trim()};return JSON.stringify(stable(value))}
function renderContext(c={}){const order=[['korean','우리말'],['definition','정의'],['sentence','문장'],['sentences','문장'],['passage','지문'],['dialogue','대화'],['source_passage','원문'],['rewritten','바꿔 쓴 글'],['given_sentence','보기'],['bank','보기'],['items',''],['statements',''],['pairs',''],['clues','문제 단서'],['segments','A–D'],['claims','설명'],['table','표'],['source_sentence',''],['original','원문']];const used=new Set(),seenValues=new Set();let out='';const add=(k,l,v)=>{const fp=contextFingerprint(v);used.add(k);if(!fp||seenValues.has(fp))return;seenValues.add(fp);out+=ctx(l,v)};for(const[k,l]of order){if(c?.[k]!=null&&c[k]!=='')add(k,l,c[k])}for(const[k,v]of Object.entries(c||{})){if(used.has(k)||v==null||v===''||['underlined','underlined_spans'].includes(k))continue;if(typeof v==='string'||Array.isArray(v))add(k,k,v)}return out}
function skillLabel(item,q){if(isConstructed(item,q))return'서술형';return({vocabulary:'Vocabulary',vocab_test:'Vocab Test',communication:'Communication',grammar:'Grammar',sentences:'본문외우기',reading:'Reading',constructed_response:'서술형'}[String(item?.practice_type||'').toLowerCase()]||String(item?.practice_type||'Review'))}
function home(){return $('#assignmentHome')}
function suppressNormal(){window.__WillenaReviewV49Active=true;const quiz=$('#assignedQuizPane');if(quiz)quiz.style.display='none';const engine=$('#engineShell');if(engine)engine.style.display='none'}
function releaseNormal(){window.__WillenaReviewV49Active=false;const engine=$('#engineShell');if(engine)engine.style.display=''}
function backHome(){active=false;run=[];releaseNormal();if(window.WillenaTestPrepNavigation?.toHome)return window.WillenaTestPrepNavigation.toHome({replaceEntry:true});window.WillenaTestPrepUX?.renderHome?.()}
function setButtons(on){document.querySelectorAll('.tp49-choice,.tp49-input,.tp49-next,.tp49-test,.tp49-word,.wcri-input,.wcri-textarea').forEach(el=>{if('disabled'in el)el.disabled=!on})}
function feedback(ok,msg){const f=$('#tp49Feedback');if(!f)return;f.className='tp49-feedback '+(ok?'ok':'bad');f.textContent=msg}
async function ensurePlan(item){const auth=window.WillenaTestPrepAuth;if(!auth)throw new Error('학습 기록 시스템을 불러오지 못했습니다.');const p=planFor(item);if(!p)throw new Error('시험 계획을 찾지 못했습니다.');const same=String(auth.state?.plan?.id||'')===String(item.plan_id)&&String(auth.state?.lesson||'')===String(item.unit_key||'');if(!same)auth.setActivePlan(p,item.unit_key||null)}
async function saveAnswer(item,q,spec,ok,selected,testMode=false){
 if(saving)return false;saving=true;setButtons(false);
 try{
  await ensurePlan(item);const auth=window.WillenaTestPrepAuth;if(!auth?.recordAttempt)throw new Error('기록 저장기를 찾지 못했습니다.');const base=meta(item),qm=q?.metadata||{},constructed=isConstructed(item,q);
  const r=await auth.recordAttempt({practice_type:constructed?'constructed_response':String(item.practice_type||q.section||'reading').toLowerCase(),question_id:String(item.question_id),selected_answer:selected,correct_answer:spec.answers,is_correct:!!ok,question_type:item.question_type||q.question_type||null,targets:Array.isArray(item.targets)&&item.targets.length?item.targets:(Array.isArray(q.targets)?q.targets:[]),source_label:q.student_source_label||base.source_label||'오답 복습',metadata:{...base,...qm,review_mode:true,source:'wrong-review',review_state_id:String(item.question_id),source_question_id:q.id||base.source_question_id||null,review_runner:'v49f',staging_auto_correct:!!testMode,canonical_text:canonicalText(item,q)||base.canonical_text||null}});
  if(!r)throw new Error('오답 기록 저장에 실패했습니다.');await auth.flushAttemptBatch?.('review-v49f');const bs=auth.getAttemptBatchState?.();if(bs&&Number(bs.queued)>0)throw new Error('오답 기록이 아직 저장되지 않았습니다.');done++;if(ok)correct++;else wrong.push(String(item.question_id));return true;
 }catch(e){feedback(false,'저장 실패: '+String(e?.message||e));setButtons(true);return false}finally{saving=false}
}
async function show(){installStyles();suppressNormal();active=true;run=[];index=0;done=0;correct=0;wrong=[];const h=home();if(!h)return;h.style.display='block';h.innerHTML='<div class="tp49-page"><div class="tp49-panel"><div class="tp49-wait">오답을 불러오는 중...</div></div></div>';try{reviews=await load();const ready=reviews.filter(due),later=reviews.filter(x=>!due(x)).sort((a,b)=>new Date(a.next_review_at)-new Date(b.next_review_at)),next=later[0],count=Math.min(RUN_LIMIT,ready.length);h.innerHTML=`<div class="tp49-page"><div class="tp49-top"><button class="tp49-back">← 시험 대비</button><h1 class="tp49-title">오답 복습</h1><p class="tp49-sub">한 번에 최대 20문제</p></div><div class="tp49-panel"><div class="tp49-stats"><div class="tp49-stat"><b>${ready.length}</b><span>지금 복습</span></div><div class="tp49-stat"><b>${later.length}</b><span>대기 중</span></div><div class="tp49-stat"><b>${reviews.length}</b><span>남은 오답</span></div></div>${ready.length?`<button class="tp49-primary" id="tp49Start">${count}문제 연속 복습 시작 →</button>`:reviews.length?`<div class="tp49-wait"><b>지금은 풀 문제가 없어요.</b>다음 복습 약 ${mins(next)}분 후</div>`:'<div class="tp49-wait"><b>오답 완료 🎉</b>남아 있는 오답이 없어요.</div>'}</div></div>`;$('.tp49-back',h).onclick=backHome;$('#tp49Start',h)?.addEventListener('click',()=>start(ready))}catch(e){h.innerHTML=`<div class="tp49-page"><button class="tp49-back">← 시험 대비</button><div class="tp49-panel"><div class="tp49-wait"><b>오답을 불러오지 못했습니다.</b>${esc(e.message)}</div></div></div>`;$('.tp49-back',h).onclick=backHome}}
async function start(items){suppressNormal();active=true;const seen=new Set();run=(items||[]).filter(due).filter(x=>{const k=`${x.plan_id}::${x.question_id}`;if(seen.has(k))return false;seen.add(k);return true}).slice(0,RUN_LIMIT);index=0;done=0;correct=0;wrong=[];if(!run.length)return show();await renderCurrent()}
function shuffledTokens(sentence){const raw=String(sentence||'').trim().split(/\s+/).filter(Boolean).map((text,i)=>({id:`w${i}`,text})),a=raw.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}if(a.length>1&&a.every((x,i)=>x.id===raw[i].id))a.push(a.shift());return a}
function renderUnscrambleUI(sentence){const tokens=shuffledTokens(sentence);return{tokens,html:`<div class="tp49-unscramble-answer empty" id="tp49Built"></div><div class="tp49-unscramble-bank" id="tp49Bank">${tokens.map(t=>`<button class="tp49-word" type="button" data-token="${esc(t.id)}">${esc(t.text)}</button>`).join('')}</div><div class="tp49-unscramble-help">위 단어를 눌러 문장을 만들고, 만든 단어를 다시 누르면 되돌릴 수 있어요.</div>`}}
async function renderCurrent(){
 suppressNormal();const h=home();if(!h)return;if(index>=run.length)return finishRun();const item=run[index];h.style.display='block';h.innerHTML='<div class="tp49-page"><div class="tp49-card"><div class="tp49-wait">문제를 준비하는 중...</div></div></div>';
 let q;try{q=await materialize(item)}catch(_){q=null}q=q||{id:item.question_id,prompt_text:'이 오답을 다시 확인하세요.',context:{},choices:[],correct_answer:arr(item.correct_answer_snapshot),answer_mode:'text',targets:item.targets||[]};
 const spec=resolveSpec(item,q),source=q.student_source_label||meta(item).source_label||'',choices=Array.isArray(q.choices)?q.choices:[];let modeHTML='',uns=null;
 if(spec.mode==='constructed')modeHTML='<div id="tp49ConstructedHost"></div>';
 else if(spec.mode==='text')modeHTML='<input class="tp49-input" id="tp49Input" inputmode="none" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="답을 입력하세요">';
 else if(spec.mode==='unscramble'){uns=renderUnscrambleUI(spec.answers[0]||'');modeHTML=uns.html}
 else modeHTML=`<div class="tp49-grid" id="tp49Choices">${choices.map((c,i)=>`<button class="tp49-choice" data-i="${i+1}" type="button"><span class="tp49-n">${['①','②','③','④','⑤','⑥','⑦','⑧'][i]||i+1}</span>${htmlText(choiceText(c))}</button>`).join('')}</div>`;
 h.innerHTML=`<div class="tp49-page"><div class="tp49-card"><div class="tp49-run-head"><div class="tp49-run-row"><span class="tp49-count">${index+1} / ${run.length}</span><span class="tp49-skill">${esc(skillLabel(item,q))}</span></div><div class="tp49-progress"><i style="width:${Math.round(index/run.length*100)}%"></i></div></div><div class="tp49-body"><div class="tp49-prompt">${htmlText(q.prompt_text||'')}</div>${renderContext(q.context||{})}${modeHTML}<div class="tp49-feedback" id="tp49Feedback"></div><div class="tp49-actions"><button class="tp49-next" id="tp49Check" disabled>정답 확인</button>${IS_STAGING?'<button class="tp49-test" id="tp49Test">TEST · 이 문제 정답 처리 ✓</button>':''}</div>${source?`<div class="tp49-source">${esc(source)}</div>`:''}</div></div></div>`;
 let selected=new Set(),answered=false,built=[],constructedControl=null,constructedValue='';const check=$('#tp49Check',h),input=$('#tp49Input',h),next=()=>{index++;renderCurrent()};
 if(spec.mode==='constructed'){
  const api=window.WillenaConstructedResponseInput,host=$('#tp49ConstructedHost',h);if(!api?.mount||!host){feedback(false,'서술형 입력 컴포넌트를 불러오지 못했습니다.');return}
  constructedControl=api.mount(host,spec.answers,{useAppKeyboard:true,onChange:value=>{constructedValue=value;if(!answered)check.disabled=!String(value||'').trim()}});
 }
 function reveal(ok){if(spec.mode==='choice'||spec.mode==='multi'){$$('.tp49-choice',h).forEach(b=>{const n=String(b.dataset.i);if(spec.answers.includes(n))b.classList.add('correct');else if(selected.has(n))b.classList.add('wrong');b.disabled=true})}if(input)input.disabled=true;constructedControl?.setDisabled(true);$$('.tp49-word',h).forEach(b=>b.disabled=true);feedback(ok,ok?'정답입니다!':'모범 답안: '+spec.display.join(' / '));check.disabled=false;check.textContent=index===run.length-1?'복습 끝내기':'다음 문제';answered=true}
 function rerenderBuilt(){const box=$('#tp49Built',h),bank=$('#tp49Bank',h);if(!box||!bank)return;box.classList.toggle('empty',built.length===0);box.innerHTML=built.map(id=>{const t=uns.tokens.find(x=>x.id===id);return`<button class="tp49-word answer" type="button" data-built="${esc(id)}">${esc(t?.text||'')}</button>`}).join('');$$('.tp49-word[data-token]',bank).forEach(b=>b.classList.toggle('used',built.includes(b.dataset.token)));$$('[data-built]',box).forEach(b=>b.onclick=()=>{if(answered)return;built=built.filter(x=>x!==b.dataset.built);rerenderBuilt();check.disabled=built.length!==uns.tokens.length})}
 if(spec.mode==='unscramble'){$$('.tp49-word[data-token]',h).forEach(b=>b.onclick=()=>{if(answered||built.includes(b.dataset.token))return;built.push(b.dataset.token);rerenderBuilt();check.disabled=built.length!==uns.tokens.length});rerenderBuilt()}
 async function submit(testMode=false){
  if(answered)return next();let ok=false,sel;
  if(testMode){ok=true;sel=spec.mode==='choice'||spec.mode==='multi'?[...spec.answers]:(spec.mode==='constructed'?spec.answers.join('\n'):(spec.answers[0]||''))}
  else if(spec.mode==='constructed'){sel=constructedControl?.getValue?.()||constructedValue;if(!String(sel||'').trim())return;ok=!!window.WillenaConstructedResponseInput?.matches?.(sel,spec.answers)}
  else if(spec.mode==='text'){const typed=input?.value??'';if(!String(typed).trim())return;sel=String(typed);ok=spec.answers.some(a=>norm(a)===norm(typed))}
  else if(spec.mode==='unscramble'){if(!uns||built.length!==uns.tokens.length)return;sel=built.map(id=>uns.tokens.find(x=>x.id===id)?.text||'').join(' ');ok=spec.answers.some(a=>norm(a)===norm(sel))}
  else{sel=[...selected];if(!sel.length)return;const A=[...sel].sort(),B=[...spec.answers].sort();ok=A.length===B.length&&A.every((x,i)=>x===B[i])}
  const saved=await saveAnswer(item,q,spec,ok,sel,testMode);if(!saved)return;reveal(ok);if(testMode)setTimeout(next,120);
 }
 if(spec.mode==='text'){input?.focus();input?.addEventListener('input',()=>{if(!answered)check.disabled=!input.value.trim()});input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit(false)}})}
 else if(spec.mode==='choice'||spec.mode==='multi'){$$('.tp49-choice',h).forEach(b=>b.onclick=()=>{if(answered)return;const n=String(b.dataset.i);if(spec.mode==='multi'){selected.has(n)?selected.delete(n):selected.add(n);b.classList.toggle('on',selected.has(n))}else{selected=new Set([n]);$$('.tp49-choice',h).forEach(x=>x.classList.toggle('on',x===b))}check.disabled=!selected.size})}
 check.onclick=()=>submit(false);$('#tp49Test',h)?.addEventListener('click',()=>submit(true));
}
async function finishRun(){const h=home();if(!h)return;let all=[];try{all=await load()}catch(_){}reviews=all;const ready=all.filter(due),later=all.filter(x=>!due(x)).sort((a,b)=>new Date(a.next_review_at)-new Date(b.next_review_at)),next=later[0],pct=done?Math.round(correct/done*100):0;h.innerHTML=`<div class="tp49-page"><div class="tp49-card"><div class="tp49-done"><h2>이번 오답 복습 완료 ✓</h2><div class="tp49-score">${done}</div><p>${done}문제 완료 · 정답률 ${pct}%</p>${ready.length?`<button class="tp49-primary" id="tp49More">다음 ${Math.min(RUN_LIMIT,ready.length)}문제 계속 →</button>`:all.length?`<div class="tp49-wait"><b>지금 풀 문제는 끝났어요.</b>다음 복습 약 ${mins(next)}분 후</div>`:'<div class="tp49-wait"><b>오답 완료 🎉</b>남아 있는 오답이 없어요.</div>'}<button class="tp49-test" id="tp49Home">시험 대비로 돌아가기</button></div></div></div>`;$('#tp49More',h)?.addEventListener('click',()=>start(ready));$('#tp49Home',h).onclick=backHome;window.dispatchEvent(new CustomEvent('testprep:review-finished'))}
function install(){installStyles();const ux=window.WillenaTestPrepUX;if(!ux){setTimeout(install,50);return}ux.showWrongCenter=show;window.WillenaReviewV49={show,load,start}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
console.log('[REV49f] review uses Willena app keyboard inputs');
})();