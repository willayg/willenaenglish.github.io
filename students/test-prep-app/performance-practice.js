(function(){
'use strict';

const PRIMARY='https://fiieuiktlsivwfgyivai.supabase.co';
const PRIMARY_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const STAGES=[
  {key:'learn',label:'익히기'},
  {key:'blank',label:'빈칸'},
  {key:'chunks',label:'청크 배열'},
  {key:'scramble',label:'실전 배열'},
  {key:'write',label:'직접쓰기'},
  {key:'final',label:'완벽암기'}
];

let assignments=[];
let lastLessonArgs=null;
let started=false;
let current=null;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const token=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
const shuffle=a=>{const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x};
const norm=s=>String(s??'').trim().replace(/[’‘]/g,"'").replace(/\s+/g,' ');
const exact=(a,b)=>norm(a)===norm(b);
const storageKey=(assessmentId,itemId)=>`tp:performance:${assessmentId}:${itemId}`;
const getProgress=(assessmentId,itemId)=>{try{return JSON.parse(localStorage.getItem(storageKey(assessmentId,itemId))||'{}')}catch{return{}}};
const setProgress=(assessmentId,itemId,p)=>{try{localStorage.setItem(storageKey(assessmentId,itemId),JSON.stringify(p))}catch(_){}};

function addStyles(){
 if(document.getElementById('tpPerformanceStyles'))return;
 const s=document.createElement('style');s.id='tpPerformanceStyles';s.textContent=`
 .tp-performance-stop{position:relative}.tp-performance-stop .tp-station{background:linear-gradient(135deg,#f3b64b,#f07f77);color:#fff;box-shadow:0 8px 22px rgba(240,127,119,.24)}
 .tp-performance-stop .tp-task-badge{background:#fff2d9;color:#9c5d00}
 .tp-pa-shell{max-width:900px;margin:0 auto;padding:18px 16px 42px;font-family:Poppins,system-ui,sans-serif;color:#213238}
 .tp-pa-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 0 18px}
 .tp-pa-back{border:0;background:#fff;border-radius:999px;padding:10px 14px;font-weight:800;box-shadow:0 4px 14px rgba(30,50,60,.1);cursor:pointer}
 .tp-pa-title small{display:block;color:#7b8b91;font-weight:700;margin-top:4px}.tp-pa-title h1{margin:0;font-size:clamp(24px,4vw,38px)}
 .tp-pa-progress{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin:0 0 18px}.tp-pa-dot{height:10px;border-radius:999px;background:#e7ecee}.tp-pa-dot.done{background:#f0a44b}
 .tp-pa-list{display:grid;gap:12px}.tp-pa-card{width:100%;border:1px solid #e4eaec;background:#fff;border-radius:20px;padding:16px;text-align:left;display:flex;justify-content:space-between;gap:14px;align-items:center;box-shadow:0 8px 24px rgba(30,50,60,.07);cursor:pointer}.tp-pa-card b{font-size:17px}.tp-pa-card p{margin:6px 0 0;color:#566970}.tp-pa-card .status{font-weight:800;color:#a06a16;white-space:nowrap}
 .tp-pa-stagebar{display:flex;gap:7px;overflow:auto;padding:2px 0 14px}.tp-pa-stagepill{border:0;border-radius:999px;padding:8px 10px;background:#edf2f3;color:#718087;font-weight:800;white-space:nowrap}.tp-pa-stagepill.on{background:#214f55;color:#fff}.tp-pa-stagepill.done{background:#daf1e7;color:#256f5f}
 .tp-pa-panel{background:#fff;border:1px solid #e4eaec;border-radius:24px;padding:clamp(18px,4vw,30px);box-shadow:0 12px 34px rgba(30,50,60,.08)}
 .tp-pa-ko{font-size:18px;font-weight:800;line-height:1.55;margin-bottom:14px}.tp-pa-en{font-size:clamp(22px,4vw,34px);font-weight:800;line-height:1.5;color:#173f45}.tp-pa-chunks{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px}.tp-pa-chip{border:1px solid #cbd8db;background:#f7fafb;border-radius:14px;padding:10px 13px;font-weight:800;cursor:pointer}.tp-pa-chip.used{opacity:.35}.tp-pa-build{min-height:64px;border:2px dashed #c9d7da;border-radius:16px;padding:12px;margin:16px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center}.tp-pa-input{width:100%;min-height:54px;border:2px solid #d3dfe1;border-radius:14px;padding:12px 14px;font:700 18px/1.45 Poppins,system-ui,sans-serif;box-sizing:border-box}.tp-pa-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}.tp-pa-btn{border:0;border-radius:14px;padding:12px 17px;font-weight:900;cursor:pointer}.tp-pa-btn.primary{background:#19777e;color:#fff}.tp-pa-btn.secondary{background:#edf3f4;color:#28494e}.tp-pa-feedback{margin-top:14px;border-radius:14px;padding:12px 14px;font-weight:800}.tp-pa-feedback.ok{background:#e3f5ed;color:#246a59}.tp-pa-feedback.bad{background:#fff0ef;color:#a3433d}.tp-pa-answer{margin-top:8px;font-size:14px;line-height:1.5}.tp-pa-mastered{display:inline-flex;align-items:center;gap:6px;border-radius:999px;background:#e2f4eb;color:#2f715f;padding:6px 10px;font-weight:900}
 @media(max-width:640px){.tp-pa-progress{gap:5px}.tp-pa-card{align-items:flex-start}.tp-pa-card .status{font-size:12px}.tp-pa-actions{justify-content:stretch}.tp-pa-btn{flex:1}.tp-pa-en{font-size:22px}}
 `;document.head.appendChild(s);
}

async function primaryGet(path){
 const t=token();if(!t)throw new Error('로그인이 필요합니다.');
 const r=await fetch(PRIMARY+path,{headers:{apikey:PRIMARY_KEY,Authorization:`Bearer ${t}`},cache:'no-store'});
 if(!r.ok)throw new Error(await r.text());return r.json();
}
async function contentGet(path){
 const r=await fetch(CONTENT+path,{headers:{apikey:CONTENT_KEY,Authorization:`Bearer ${CONTENT_KEY}`},cache:'no-store'});
 if(!r.ok)throw new Error(await r.text());return r.json();
}

async function loadAssignments(){
 try{
  const rows=await primaryGet('/rest/v1/student_performance_assessments?select=id,student_id,plan_id,content_assessment_id,book_key,unit_key,title,due_date,status,metadata&status=eq.active&order=due_date.asc.nullslast');
  assignments=Array.isArray(rows)?rows:[];
  if(lastLessonArgs)decorateLesson(...lastLessonArgs);
 }catch(e){console.warn('[performance] assignment load failed',e);assignments=[]}
}
function assignmentFor(planId,lesson){return assignments.find(a=>String(a.plan_id)===String(planId)&&String(a.unit_key||'')===String(lesson||''))||null}
function masteredCount(assessmentId,items){return items.reduce((n,it)=>n+(getProgress(assessmentId,it.id).mastered?1:0),0)}

function decorateLesson(planId,lesson){
 lastLessonArgs=[planId,lesson];
 const a=assignmentFor(planId,lesson);if(!a)return;
 const subway=document.querySelector('#assignmentHome .tp-subway');if(!subway||subway.querySelector('[data-skill="performance"]'))return;
 const stop=document.createElement('div');stop.className='tp-stop tp-performance-stop';stop.dataset.skill='performance';
 stop.innerHTML=`<div class="tp-station">★</div><div class="tp-stop-copy"><b>수행평가</b><small>${esc(a.title||'문장 암기 수행평가')}</small><span class="tp-task-badge">추가 학습</span><div class="tp-mini"><i style="width:0%"></i></div></div><div class="tp-stop-pct">시작<small>${a.due_date?esc(a.due_date)+'까지':''}</small></div>`;
 stop.onclick=()=>window.WillenaAssignedTestPrep?.startSelection?.(planId,lesson,'performance');
 subway.appendChild(stop);
 hydrateStopProgress(stop,a).catch(()=>{});
}
async function hydrateStopProgress(stop,a){
 try{const items=await contentGet(`/rest/v1/performance_assessment_items?select=id&assessment_id=eq.${encodeURIComponent(a.content_assessment_id)}&order=item_number.asc`);const done=masteredCount(a.content_assessment_id,items),pct=items.length?Math.round(done/items.length*100):0;const bar=stop.querySelector('.tp-mini i'),right=stop.querySelector('.tp-stop-pct');if(bar)bar.style.width=pct+'%';if(right)right.innerHTML=`${pct}%<small>${done}/${items.length} 문장</small>`}catch(_){}}

async function loadAssessment(a){
 const [sets,items]=await Promise.all([
  contentGet(`/rest/v1/performance_assessment_sets?select=*&id=eq.${encodeURIComponent(a.content_assessment_id)}&limit=1`),
  contentGet(`/rest/v1/performance_assessment_items?select=*&assessment_id=eq.${encodeURIComponent(a.content_assessment_id)}&order=item_number.asc`)
 ]);
 if(!sets[0]||!items.length)throw new Error('수행평가 내용을 찾지 못했습니다.');
 return{assignment:a,set:sets[0],items};
}

function showPane(){
 const home=document.getElementById('assignmentHome'),quiz=document.getElementById('assignedQuizPane');if(home)home.style.display='none';if(quiz)quiz.style.display='block';
 const engine=document.getElementById('engineShell');if(engine)engine.style.display='none';
}
function restorePane(){const engine=document.getElementById('engineShell');if(engine)engine.style.display='block'}
function shell(){let root=document.getElementById('performancePracticeRoot');if(!root){root=document.createElement('div');root.id='performancePracticeRoot';const quiz=document.getElementById('assignedQuizPane');quiz?.appendChild(root)}return root}
function leave(){
 const root=shell();root.innerHTML='';restorePane();
 const q=document.getElementById('assignedQuizPane'),h=document.getElementById('assignmentHome');if(q)q.style.display='none';if(h)h.style.display='block';
 if(current?.planId&&current?.lesson)window.WillenaTestPrepUX?.renderLesson?.(current.planId,current.lesson,'performance');else window.WillenaTestPrepUX?.renderHome?.();
 current=null;
}
function overview(){
 const {set,items,assignment}=current.data,done=masteredCount(set.id,items),root=shell();showPane();
 root.innerHTML=`<div class="tp-pa-shell"><div class="tp-pa-top"><button class="tp-pa-back">← ${esc(current.lesson)}</button><div class="tp-pa-title"><h1>수행평가</h1><small>${esc(assignment.title||set.title||'문장 암기')} · ${done}/${items.length} 완벽암기</small></div></div><div class="tp-pa-progress">${items.map(it=>`<i class="tp-pa-dot ${getProgress(set.id,it.id).mastered?'done':''}"></i>`).join('')}</div><div class="tp-pa-list">${items.map(it=>{const p=getProgress(set.id,it.id),stage=Math.max(0,Number(p.stage)||0);return`<button class="tp-pa-card" data-pa-item="${esc(it.id)}"><span><b>문장 ${it.item_number}</b><p>${esc(it.prompt_ko)}</p></span><span class="status">${p.mastered?'✓ 암기완료':`${STAGES[Math.min(stage,STAGES.length-1)].label}`}</span></button>`}).join('')}</div></div>`;
 root.querySelector('.tp-pa-back').onclick=leave;root.querySelectorAll('[data-pa-item]').forEach(b=>b.onclick=()=>openItem(b.dataset.paItem));
}
function stageHeader(item,stage){const p=getProgress(current.data.set.id,item.id);return `<div class="tp-pa-stagebar">${STAGES.map((s,i)=>`<span class="tp-pa-stagepill ${i===stage?'on':''} ${i<stage||p.mastered?'done':''}">${esc(s.label)}</span>`).join('')}</div>`}
function saveStage(item,next,mastered=false){const p=getProgress(current.data.set.id,item.id);setProgress(current.data.set.id,item.id,{...p,stage:Math.max(Number(p.stage)||0,next),mastered:!!(p.mastered||mastered),updated_at:new Date().toISOString()})}
async function track(item,stage,isCorrect,answer){
 try{await window.WillenaTestPrepAuth?.recordAttempt?.({practice_type:'performance',question_id:`performance:${item.id}:${stage}`,selected_answer:answer,correct_answer:item.target_en,is_correct:isCorrect,question_type:`performance_${stage}`,targets:['performance_assessment','sentence_memorization'],metadata:{assessment_id:current.data.set.id,performance_item_id:item.id,item_number:item.item_number,stage}})}catch(e){console.warn('[performance] tracking failed',e)}
}
function feedback(el,ok,msg,answer=''){el.innerHTML=`<div class="tp-pa-feedback ${ok?'ok':'bad'}">${esc(msg)}${answer?`<div class="tp-pa-answer">정답: ${esc(answer)}</div>`:''}</div>`}
function openItem(id,forcedStage=null){const item=current.data.items.find(x=>String(x.id)===String(id));if(!item)return;const p=getProgress(current.data.set.id,item.id),stage=forcedStage==null?Math.min(Number(p.stage)||0,STAGES.length-1):forcedStage;renderStage(item,stage)}
function next(item,stage,mastered=false){saveStage(item,stage+1,mastered);if(stage>=STAGES.length-1){overview();return}renderStage(item,stage+1)}
function renderStage(item,stage){
 const root=shell(),s=STAGES[stage];showPane();
 root.innerHTML=`<div class="tp-pa-shell"><div class="tp-pa-top"><button class="tp-pa-back">← 6문장</button><div class="tp-pa-title"><h1>문장 ${item.item_number}</h1><small>${esc(s.label)}</small></div></div>${stageHeader(item,stage)}<div class="tp-pa-panel"><div class="tp-pa-ko">${esc(item.prompt_ko)}</div><div id="tpPaActivity"></div><div id="tpPaFeedback"></div></div></div>`;
 root.querySelector('.tp-pa-back').onclick=overview;const box=root.querySelector('#tpPaActivity'),fb=root.querySelector('#tpPaFeedback');
 if(stage===0)return renderLearn(item,box,fb,stage);
 if(stage===1)return renderBlank(item,box,fb,stage);
 if(stage===2)return renderChunks(item,box,fb,stage);
 if(stage===3)return renderScramble(item,box,fb,stage);
 if(stage===4)return renderWrite(item,box,fb,stage,false);
 return renderWrite(item,box,fb,stage,true);
}
function renderLearn(item,box,fb,stage){const chunks=Array.isArray(item.chunks)&&item.chunks.length?item.chunks:[item.target_en];box.innerHTML=`<div class="tp-pa-en">${esc(item.target_en)}</div><div class="tp-pa-chunks">${chunks.map(c=>`<span class="tp-pa-chip">${esc(c)}</span>`).join('')}</div><div class="tp-pa-actions"><button class="tp-pa-btn primary">다음</button></div>`;box.querySelector('.primary').onclick=()=>{track(item,'learn',true,item.target_en);next(item,stage)}}
function renderBlank(item,box,fb,stage){
 const words=String(item.target_en).split(/\s+/),targets=[];let n=0;const masked=words.map((w,i)=>{const clean=w.replace(/[^A-Za-z']/g,'');if(clean.length>4&&n<3&&i>0){n++;targets.push(w);return'_____'}return w}).join(' ');
 box.innerHTML=`<div class="tp-pa-en">${esc(masked)}</div><div class="tp-pa-chunks">${shuffle(targets).map(w=>`<button class="tp-pa-chip" data-word="${esc(w)}">${esc(w)}</button>`).join('')}</div><div class="tp-pa-build" id="tpPaBuild"></div><div class="tp-pa-actions"><button class="tp-pa-btn secondary" data-reset>다시</button><button class="tp-pa-btn primary" data-check>확인</button></div>`;
 const picked=[];box.querySelectorAll('[data-word]').forEach(b=>b.onclick=()=>{if(b.classList.contains('used'))return;b.classList.add('used');picked.push(b.dataset.word);box.querySelector('#tpPaBuild').textContent=picked.join(' · ')});box.querySelector('[data-reset]').onclick=()=>renderBlank(item,box,fb,stage);box.querySelector('[data-check]').onclick=()=>{const ok=picked.length===targets.length&&picked.every((x,i)=>x===targets[i]);track(item,'blank',ok,picked);if(ok){feedback(fb,true,'좋아요!');setTimeout(()=>next(item,stage),350)}else feedback(fb,false,'빈칸에 들어갈 순서를 다시 확인해 보세요.',targets.join(' · '))}
}
function renderChunks(item,box,fb,stage){
 const chunks=Array.isArray(item.chunks)&&item.chunks.length?item.chunks:[item.target_en],pool=shuffle(chunks),picked=[];box.innerHTML=`<div class="tp-pa-build" id="tpPaBuild"></div><div class="tp-pa-chunks">${pool.map((c,i)=>`<button class="tp-pa-chip" data-i="${i}">${esc(c)}</button>`).join('')}</div><div class="tp-pa-actions"><button class="tp-pa-btn secondary" data-reset>다시</button><button class="tp-pa-btn primary" data-check>확인</button></div>`;const build=box.querySelector('#tpPaBuild');box.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{if(b.classList.contains('used'))return;b.classList.add('used');picked.push(pool[Number(b.dataset.i)]);build.textContent=picked.join(' ')});box.querySelector('[data-reset]').onclick=()=>renderChunks(item,box,fb,stage);box.querySelector('[data-check]').onclick=()=>{const ans=picked.join(' '),ok=exact(ans,item.target_en);track(item,'chunks',ok,ans);if(ok){feedback(fb,true,'청크 순서가 맞아요!');setTimeout(()=>next(item,stage),350)}else feedback(fb,false,'청크 순서를 다시 확인하세요.',item.target_en)}}
function tokenizeTarget(s){return String(s).replace(/([,.!?])/g,' $1 ').trim().split(/\s+/)}
function renderScramble(item,box,fb,stage){
 const target=tokenizeTarget(item.target_en),pool=shuffle(target),picked=[];box.innerHTML=`<div class="tp-pa-build" id="tpPaBuild"></div><div class="tp-pa-chunks">${pool.map((w,i)=>`<button class="tp-pa-chip" data-i="${i}">${esc(w)}</button>`).join('')}</div><div class="tp-pa-actions"><button class="tp-pa-btn secondary" data-reset>다시</button><button class="tp-pa-btn primary" data-check>확인</button></div>`;const build=box.querySelector('#tpPaBuild');box.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{if(b.classList.contains('used'))return;b.classList.add('used');picked.push(pool[Number(b.dataset.i)]);build.textContent=picked.join(' ').replace(/\s+([,.!?])/g,'$1')});box.querySelector('[data-reset]').onclick=()=>renderScramble(item,box,fb,stage);box.querySelector('[data-check]').onclick=()=>{const ans=picked.join(' ').replace(/\s+([,.!?])/g,'$1'),ok=exact(ans,item.target_en);track(item,'scramble',ok,ans);if(ok){feedback(fb,true,'실전 배열 성공!');setTimeout(()=>next(item,stage),350)}else feedback(fb,false,'단어 순서와 문장부호를 다시 확인하세요.',item.target_en)}}
function renderWrite(item,box,fb,stage,isFinal){
 box.innerHTML=`${isFinal?'<div class="tp-pa-mastered">★ 마지막 확인</div>':''}<textarea class="tp-pa-input" rows="3" autocomplete="off" autocapitalize="sentences" spellcheck="false" placeholder="영어 문장을 직접 써 보세요."></textarea><div class="tp-pa-actions"><button class="tp-pa-btn primary" data-check>${isFinal?'완벽암기 확인':'확인'}</button></div>`;const input=box.querySelector('textarea');input.focus();box.querySelector('[data-check]').onclick=()=>{const ans=input.value,ok=exact(ans,item.target_en);track(item,isFinal?'final':'write',ok,ans);if(ok){feedback(fb,true,isFinal?'완벽암기 완료! ✓':'정확해요!');setTimeout(()=>next(item,stage,isFinal),450)}else{const shown=norm(ans);feedback(fb,false,isFinal?'한 글자라도 다르면 다시 써야 해요.':'철자, 대소문자, 단어 순서를 확인하세요.',item.target_en);if(shown)input.select()}};input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();box.querySelector('[data-check]').click()}})
}

async function startPerformance(planId,lesson){
 const a=assignmentFor(planId,lesson);if(!a){alert('이 Lesson에 지정된 수행평가가 없습니다.');return}
 addStyles();showPane();shell().innerHTML='<div class="tp-pa-shell"><div class="tp-pa-panel">수행평가를 불러오는 중...</div></div>';
 try{const data=await loadAssessment(a);current={planId:String(planId),lesson:String(lesson),data};window.WillenaTestPrepAuth?.setActivePlan?.(window.WillenaTestPrepAuth.state.plans.find(p=>String(p.id)===String(planId)),lesson);overview()}catch(e){console.error('[performance] load failed',e);shell().innerHTML=`<div class="tp-pa-shell"><div class="tp-pa-panel">${esc(e.message||'수행평가를 불러오지 못했습니다.')}<div class="tp-pa-actions"><button class="tp-pa-btn primary" id="tpPaClose">돌아가기</button></div></div></div>`;document.getElementById('tpPaClose').onclick=leave}
}

function patch(){
 if(started)return;const ux=window.WillenaTestPrepUX,assigned=window.WillenaAssignedTestPrep;if(!ux?.renderLesson||!assigned?.startSelection)return;started=true;addStyles();
 const originalLesson=ux.renderLesson.bind(ux);ux.renderLesson=function(planId,lesson,focus){const r=originalLesson(planId,lesson,focus);setTimeout(()=>decorateLesson(planId,lesson),0);return r};
 const originalStart=assigned.startSelection.bind(assigned);assigned.startSelection=function(planId,lesson,section,opts){if(String(section).toLowerCase()==='performance')return startPerformance(planId,lesson);return originalStart(planId,lesson,section,opts)};
 window.addEventListener('testprep:student-state-refresh',loadAssignments);
 loadAssignments();
}
function boot(){let tries=0;const t=setInterval(()=>{if(window.WillenaTestPrepUX?.renderLesson&&window.WillenaAssignedTestPrep?.startSelection){clearInterval(t);patch()}else if(++tries>200)clearInterval(t)},25)}
boot();
window.WillenaPerformancePractice={reloadAssignments:loadAssignments,start:startPerformance,get assignments(){return assignments}};
})();