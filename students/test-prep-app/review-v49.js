(function(){
'use strict';

const REVIEW_EDGE='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-review-v48';
const REVIEW_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const CONTENT_HEADERS={apikey:CONTENT_KEY,Authorization:`Bearer ${CONTENT_KEY}`};
const RUN_LIMIT=20;
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuidLike=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s||''));
let reviews=[],run=[],index=0,done=0,correct=0,wrong=[],active=false,currentQuestion=null;

function token(){return window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||''}
function due(x){return x?.due_now===true||!x?.next_review_at||new Date(x.next_review_at).getTime()<=Date.now()}
function mins(x){if(!x?.next_review_at)return 0;return Math.max(1,Math.ceil((new Date(x.next_review_at).getTime()-Date.now())/60000))}
function answerArray(v){if(Array.isArray(v))return v.map(x=>String(x??'').trim()).filter(Boolean);if(v==null)return[];return[String(v).trim()].filter(Boolean)}
function planFor(item){return window.WillenaTestPrepAuth?.state?.plans?.find(p=>String(p.id)===String(item.plan_id))||item.plan||null}
function waitFor(fn,label){return new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{const v=fn();if(v){clearInterval(t);resolve(v)}else if(++n>120){clearInterval(t);reject(new Error(`${label}을 불러오지 못했습니다.`))}},25)})}

function installStyles(){
 if($('#tpReview49Styles'))return;
 const s=document.createElement('style');s.id='tpReview49Styles';s.textContent=`
 .tp49-page{width:min(900px,calc(100% - 24px));margin:18px auto 42px;font-family:Poppins,'Noto Sans KR',system-ui,sans-serif;color:#203039}
 .tp49-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 0 16px}.tp49-back{border:0;background:transparent;color:#52666e;font:800 13px Poppins;cursor:pointer;padding:8px 0}.tp49-title{margin:0;font-size:25px;font-weight:800}.tp49-sub{margin:4px 0 0;color:#74868d;font-size:12px;font-weight:600}
 .tp49-panel,.tp49-card{background:#fff;border:1.5px solid #b8e7e9;border-radius:24px;box-shadow:0 12px 38px rgba(31,63,68,.08)}.tp49-panel{padding:22px}.tp49-card{padding:28px 22px;text-align:center}
 .tp49-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}.tp49-stat{background:#f4f9f9;border-radius:16px;padding:14px;text-align:center}.tp49-stat b{display:block;font-size:24px;color:#19777e}.tp49-stat span{display:block;font-size:10px;font-weight:800;color:#7a8b90;margin-top:2px}
 .tp49-primary,.tp49-secondary{width:100%;border-radius:15px;padding:14px 16px;font:800 14px Poppins,sans-serif;cursor:pointer}.tp49-primary{border:0;background:#19777e;color:#fff}.tp49-secondary{background:#fff;color:#52666e;border:1px solid #cfe7e8;margin-top:9px}.tp49-wait{padding:18px 10px;color:#61747b;font-size:13px;line-height:1.7}.tp49-wait b{display:block;color:#203039;font-size:18px;margin-bottom:4px}.tp49-score{font-size:52px;font-weight:800;color:#19777e;margin:8px 0}
 #tp49RuntimeBanner{width:min(900px,calc(100% - 24px));margin:10px auto 0;display:flex;align-items:center;justify-content:space-between;gap:12px;font-family:Poppins,'Noto Sans KR',system-ui,sans-serif}
 #tp49RuntimeBanner button{border:0;background:transparent;color:#52666e;font:800 13px Poppins;cursor:pointer;padding:8px 0}#tp49RuntimeBanner span{font-size:12px;font-weight:800;color:#607078}
 @media(max-width:600px){.tp49-page{width:calc(100% - 18px);margin-top:10px}.tp49-stats{gap:7px}.tp49-stat{padding:12px 6px}.tp49-stat b{font-size:21px}#tp49RuntimeBanner{width:calc(100% - 18px)}}
 `;document.head.appendChild(s)
}

async function load(){
 const t=token();if(!t)throw new Error('로그인이 필요합니다.');
 const r=await fetch(REVIEW_EDGE,{headers:{Authorization:`Bearer ${t}`,apikey:REVIEW_KEY},cache:'no-store'});
 const d=await r.json().catch(()=>({}));if(!r.ok||d.success===false)throw new Error(d.error||'오답을 불러오지 못했습니다.');
 const seen=new Set();return(d.reviews||[]).filter(x=>{const k=`${x.plan_id}::${x.question_id}`;if(seen.has(k))return false;seen.add(k);return true});
}

async function contentQuestion(id){
 if(!uuidLike(id))return null;
 const sel='id,section,source_question_number,question_type,prompt_text,context,choices,correct_answer,targets,answer_mode,student_source_label,content_status,student_usable,metadata';
 const r=await fetch(`${CONTENT}/rest/v1/test_prep_questions?select=${encodeURIComponent(sel)}&id=eq.${encodeURIComponent(id)}&limit=1`,{headers:CONTENT_HEADERS,cache:'no-store'});if(!r.ok)return null;const rows=await r.json().catch(()=>[]);return rows?.[0]||null;
}
async function materialize(item){
 const ids=[item.question_id,item?.attempt_metadata?.source_question_id,item?.metadata?.source_question_id].map(String).filter((x,i,a)=>x&&a.indexOf(x)===i);for(const id of ids){const q=await contentQuestion(id);if(q)return q}
 const m={...(item.attempt_metadata||{}),...(item.metadata||{})},expected=answerArray(item.correct_answer_snapshot);
 if(String(item.practice_type)==='sentences'||m.sentence||m.korean){const answer=expected[0]||String(m.sentence||'');return{id:item.question_id,section:'sentences',question_type:item.question_type||'sentence_review',prompt_text:'다음 문장을 영어로 쓰세요.',context:{korean:m.korean||null},choices:[],correct_answer:answer?[answer]:[],answer_mode:'text',targets:item.targets||[],student_source_label:m.source_label||m.activity_title||'본문외우기',metadata:m}}
 const canonical=String(m.mastery_target_text||m.canonical_text||'').trim();if(canonical)return{id:item.question_id,section:item.practice_type||'vocab_test',question_type:item.question_type||'vocab_review',prompt_text:m.prompt_text||'다음 단어 또는 표현을 쓰세요.',context:{korean:m.translation_ko||null,definition:m.definition_en||null},choices:[],correct_answer:[expected[0]||canonical],answer_mode:'text',targets:item.targets||[],student_source_label:m.source_label||'어휘 시험',metadata:m};
 return{id:item.question_id,section:item.practice_type||'review',question_type:item.question_type||'review',prompt_text:m.prompt_text||'이 오답을 다시 확인하세요.',context:m.context||{},choices:Array.isArray(m.choices)?m.choices:[],correct_answer:expected,answer_mode:Array.isArray(m.choices)&&m.choices.length?'single_select':'text',targets:item.targets||[],student_source_label:m.source_label||'오답 복습',metadata:m};
}

function markActive(on){active=on;window.__WillenaReviewV49Active=on;window.__WillenaReviewV48Active=on}
function home(){return $('#assignmentHome')}
function engine(){return $('#engineShell')}
function hideEngine(){const e=engine();if(e)e.style.display='none';$('#tp49RuntimeBanner')?.remove()}
function showEngine(){const e=engine();if(e)e.style.display='';const h=home();if(h)h.style.display='none'}
function backHome(){try{window.WillenaQuestionRuntime?.cancel?.()}catch(_){}run=[];currentQuestion=null;markActive(false);hideEngine();const h=home();if(h)h.style.display='';window.WillenaTestPrepUX?.renderHome?.()}
function runtimeBanner(){
 $('#tp49RuntimeBanner')?.remove();const app=document.querySelector('.app');if(!app)return;const d=document.createElement('div');d.id='tp49RuntimeBanner';d.innerHTML=`<button type="button">← 오답 복습</button><span>${index+1} / ${run.length}</span>`;app.insertBefore(d,app.firstChild);d.querySelector('button').onclick=()=>show();
}
function card(revs){const ready=revs.filter(due).length,later=revs.length-ready;return `<button class="tp-wrong-card ${revs.length?'':'no-wrong'}" ${revs.length?'':'disabled'}><span class="tp-wrong-icon">↺</span><span class="tp-wrong-copy"><b>${revs.length?'오답 복습':'오답 없음'}</b><small>${ready?`남은 ${revs.length}개 · 지금 ${ready}개`:later?`남은 ${revs.length}개 · 다음 복습 대기 중`:'현재 남아 있는 오답이 없어요'}</small></span><span class="tp-wrong-count">${revs.length}<small>개 남음</small></span></button>`}
async function refreshHomeCard(){if(active)return;const h=home();if(!h)return;try{const revs=await load(),old=$('.tp-wrong-card',h);if(!old)return;const wrap=document.createElement('div');wrap.innerHTML=card(revs);old.replaceWith(wrap.firstElementChild);$('.tp-wrong-card:not(.no-wrong)',h)?.addEventListener('click',show)}catch(e){console.warn('[REV49] card refresh failed',e)}}

async function show(){
 installStyles();markActive(true);hideEngine();const h=home();if(!h)return;h.style.display='block';h.innerHTML='<div class="tp49-page"><div class="tp49-panel"><div class="tp49-wait">오답을 불러오는 중...</div></div></div>';
 try{reviews=await load();const ready=reviews.filter(due),later=reviews.filter(x=>!due(x)).sort((a,b)=>new Date(a.next_review_at)-new Date(b.next_review_at)),next=later[0],count=Math.min(RUN_LIMIT,ready.length);h.innerHTML=`<div class="tp49-page"><div class="tp49-top"><div><button class="tp49-back">← 시험 대비</button><h1 class="tp49-title">오답 복습</h1><p class="tp49-sub">원래 문제 렌더링 엔진으로 다시 풀어요</p></div></div><div class="tp49-panel"><div class="tp49-stats"><div class="tp49-stat"><b>${ready.length}</b><span>지금 복습</span></div><div class="tp49-stat"><b>${later.length}</b><span>나중에</span></div><div class="tp49-stat"><b>${reviews.length}</b><span>남은 오답</span></div></div>${ready.length?`<button class="tp49-primary" id="tp49Start">${count}문제 복습 시작 →</button>`:reviews.length?`<div class="tp49-wait"><b>지금은 풀 문제가 없어요.</b>다음 복습 약 ${mins(next)}분 후</div>`:'<div class="tp49-wait"><b>오답 완료 🎉</b>남아 있는 오답이 없어요.</div>'}</div></div>`;$('.tp49-back',h).onclick=backHome;$('#tp49Start',h)?.addEventListener('click',()=>start(ready))}catch(e){h.innerHTML=`<div class="tp49-page"><button class="tp49-back">← 시험 대비</button><div class="tp49-panel"><div class="tp49-wait"><b>오답을 불러오지 못했습니다.</b>${esc(e.message)}</div></div></div>`;$('.tp49-back',h).onclick=backHome}
}
async function ensurePlan(item){const auth=window.WillenaTestPrepAuth;if(!auth)throw new Error('학습 기록 시스템을 불러오지 못했습니다.');const p=planFor(item);if(!p)throw new Error('시험 계획을 찾지 못했습니다.');const same=String(auth.state?.plan?.id||'')===String(item.plan_id)&&String(auth.state?.lesson||'')===String(item.unit_key||'');if(!same)auth.setActivePlan(p,item.unit_key||null)}
async function start(items){markActive(true);const seen=new Set();run=(items||[]).filter(due).filter(x=>{const k=`${x.plan_id}::${x.question_id}`;if(seen.has(k))return false;seen.add(k);return true}).slice(0,RUN_LIMIT);index=0;done=0;correct=0;wrong=[];if(!run.length)return show();await renderCurrent()}
async function renderCurrent(){
 if(index>=run.length)return finishRun();const item=run[index];await ensurePlan(item);currentQuestion=await materialize(item);const q=currentQuestion;const runtime=await waitFor(()=>window.WillenaQuestionRuntime,'문제 렌더링 엔진');
 if(!runtime.supports?.(q))throw new Error(`지원되지 않는 오답 형식: ${q?.question_type||q?.answer_mode||'unknown'}`);
 showEngine();runtimeBanner();const auth=window.WillenaTestPrepAuth,baseRecord=auth.recordAttempt;auth.recordAttempt=function(payload){const p={...(payload||{}),question_id:String(item.question_id||payload?.question_id||q.id||''),metadata:{...(payload?.metadata||{}),review_mode:true,source:'wrong-review',review_runner:'v49',review_state_id:String(item.question_id||''),source_question_id:q.id||null}};return baseRecord.call(auth,p)};
 let result;try{result=await runtime.run(q,{reviewMode:true,planId:item.plan_id,lesson:item.unit_key||null,position:index+1,total:run.length})}finally{if(auth.recordAttempt!==baseRecord)auth.recordAttempt=baseRecord;try{await auth.flushAttemptBatch?.('review-v49')}catch(_){}}
 done++;if(result?.correct)correct++;else wrong.push(String(item.question_id));index++;setTimeout(()=>renderCurrent().catch(showRunError),60);
}
function showRunError(e){console.error('[REV49] review run failed',e);hideEngine();const h=home();if(!h)return;h.style.display='block';h.innerHTML=`<div class="tp49-page"><div class="tp49-card"><div class="tp49-wait"><b>오답 문제를 열지 못했습니다.</b>${esc(e?.message||e)}</div><button class="tp49-secondary" id="tp49Retry">오답 화면으로 돌아가기</button></div></div>`;$('#tp49Retry',h).onclick=show}
async function finishRun(){
 hideEngine();const h=home();if(!h)return;h.style.display='block';let all=[];try{all=await load()}catch(_){}reviews=all;const ready=all.filter(due),later=all.filter(x=>!due(x)).sort((a,b)=>new Date(a.next_review_at)-new Date(b.next_review_at)),next=later[0],pct=done?Math.round(correct/done*100):0;h.innerHTML=`<div class="tp49-page"><div class="tp49-card"><h2>이번 오답 복습 완료 ✓</h2><div class="tp49-score">${done}</div><p>${done}문제 완료 · 정답률 ${pct}%</p>${ready.length?`<button class="tp49-primary" id="tp49More">다음 ${Math.min(RUN_LIMIT,ready.length)}문제 계속 →</button>`:all.length?`<div class="tp49-wait"><b>지금 풀 문제는 끝났어요.</b>다음 복습 약 ${mins(next)}분 후</div>`:'<div class="tp49-wait"><b>오답 완료 🎉</b>남아 있는 오답이 없어요.</div>'}<button class="tp49-secondary" id="tp49Home">시험 대비로 돌아가기</button></div></div>`;$('#tp49More',h)?.addEventListener('click',()=>start(ready));$('#tp49Home',h).onclick=backHome;markActive(false);refreshHomeCard()
}
function install(){installStyles();const ux=window.WillenaTestPrepUX;if(!ux){setTimeout(install,50);return}ux.showWrongCenter=show;const old=ux.renderHome;if(!old.__rev49){const wrapped=function(){const r=old.apply(this,arguments);setTimeout(refreshHomeCard,60);return r};wrapped.__rev49=true;ux.renderHome=wrapped}hideEngine();refreshHomeCard()}
window.addEventListener('testprep:student-state-refresh',()=>{if(!active)setTimeout(refreshHomeCard,80)});window.WillenaReviewV49={show,load,start};install();console.log('[REV49] wrong-answer runner uses QuestionRuntime / canonical engines');
})();