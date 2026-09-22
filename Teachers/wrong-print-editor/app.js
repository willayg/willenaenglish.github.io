(function(){
'use strict';
const WRONG_API='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-teacher-wrong-detail';
const EXPL_API='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-print-explanations';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const text=v=>String(v??'').replace(/\\r\\n|\\n|\\r/g,'\n');
const qp=new URLSearchParams(location.search);
const state={items:[],removed:new Set(),hiddenSkills:new Set(),studentId:qp.get('student_id')||'',planId:qp.get('plan_id')||'',student:qp.get('student')||'Student',exam:qp.get('exam')||'',wrongFilter:qp.get('wrong_filter')==='today'?'today':'all'};
const SKILL_ORDER=['vocabulary','grammar','reading','communication','sentences','writing','listening','other'];

function answer(v){if(v==null||v==='')return'—';if(Array.isArray(v))return v.map(answer).join(' / ');if(typeof v==='object')return answer(v.text??v.answer??v.value??v.word??v.response??JSON.stringify(v));if(typeof v==='string'){const t=v.trim();if((t.startsWith('[')&&t.endsWith(']'))||(t.startsWith('{')&&t.endsWith('}'))){try{return answer(JSON.parse(t))}catch(_){}}}return String(v)}
function choiceText(c){return typeof c==='string'?text(c):text(c?.text??c?.label??c?.value??JSON.stringify(c))}
function localCorrectDisplay(r){
  if(isRecoveredVocab(r))return vocabPair(r).english;
  const vals=Array.isArray(r.correct_answer)?r.correct_answer:[r.correct_answer];
  if(!vals.length||vals[0]==null||vals[0]==='')return r.correct_display||answer(r.correct_answer);
  const choices=Array.isArray(r.choices)?r.choices:[];
  const circles=['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];
  return vals.map(v=>{
    const n=Number(String(v).trim());
    if(Number.isInteger(n)&&n>=1&&n<=choices.length){
      return `${circles[n-1]||n} ${choiceText(choices[n-1])}`;
    }
    return answer(v);
  }).join(' / ');
}
function contextText(v){if(v==null||v==='')return'';if(typeof v==='string')return text(v);if(Array.isArray(v))return v.map(contextText).filter(Boolean).join('\n');if(typeof v==='object'){const order=['korean','translation_ko','definition','definition_en','sentence','text','passage','dialogue','initial'];const used=new Set(),parts=[];for(const k of order){if(v[k]!=null&&v[k]!==''){used.add(k);parts.push(contextText(v[k]))}}for(const [k,x] of Object.entries(v)){if(used.has(k)||x==null||x==='')continue;if(typeof x==='string'||typeof x==='number')parts.push(text(x))}return parts.filter(Boolean).join('\n')}return String(v)}
function isVocab(r){return /vocab/i.test(String(r.practice_type||''))||/vocab/i.test(String(r.question_type||''))}
function looksRecovered(r){const p=String(r.prompt||'').trim();const explicit=r.recovered===true||r.reconstructed===true||r.source_origin==='reconstructed'||r.metadata?.reconstructed===true;const oldVocab=isVocab(r)&&!r.metadata?.question_snapshot&&!r.question_snapshot;const generic=/^(recorded question|vocab record|vocab review|vocabulary record|question)$/i.test(p);return explicit||generic||oldVocab}
function isRecoveredVocab(r){return isVocab(r)&&looksRecovered(r)}
function keyFor(r,i){return String(r.attempt_id||r.id||r.question_id||`${i}:${r.attempted_at||''}`)}
function firstString(...vals){for(const v of vals){if(v==null)continue;if(Array.isArray(v)){for(const x of v){const s=String(x??'').trim();if(s)return s}}else if(typeof v==='string'||typeof v==='number'){const s=String(v).trim();if(s)return s}}return''}
function cleanEnglish(v){const s=firstString(v);if(!s||!/[A-Za-z]/.test(s)||/[가-힣]/.test(s))return'';if(/^(vocab(ulary)?\s*(record|review)?|recorded question|question)$/i.test(s))return'';return s}
function cleanKorean(v){const s=firstString(v);return s&&/[가-힣]/.test(s)?s:''}
function vocabPair(r){
  const m=r.metadata||{},snap=r.question_snapshot||m.question_snapshot||{},sm=snap.metadata||{},ctx=r.context||snap.context||{};
  const english=cleanEnglish(firstString(m.canonical_text,sm.canonical_text,r.canonical_text,r.correct_answer,r.correct_display,snap.answer));
  const korean=cleanKorean(firstString(m.translation_ko,sm.translation_ko,r.translation_ko,ctx?.translation_ko,ctx?.korean));
  return{english,korean,valid:Boolean(english&&korean)};
}
function skillKey(r){if(isVocab(r))return'vocabulary';const raw=String(r.practice_type||r.section||r.skill||r.question_type||'other').toLowerCase();if(raw.includes('commun')||raw.includes('dialog'))return'communication';if(raw.includes('grammar'))return'grammar';if(raw.includes('read'))return'reading';if(raw.includes('sentence')||raw.includes('본문'))return'sentences';if(raw.includes('listen'))return'listening';if(raw.includes('construct')||raw.includes('writ'))return'writing';return raw.replace(/_+/g,' ').trim()||'other'}
function skillLabel(k){return({vocabulary:'Vocabulary',communication:'Communication',grammar:'Grammar',reading:'Reading',sentences:'본문',listening:'Listening',writing:'서술형',other:'Other'})[k]||k.replace(/\b\w/g,m=>m.toUpperCase())}
function koreaDateKey(v){const d=v instanceof Date?v:new Date(v);if(Number.isNaN(d.getTime()))return'';const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d),get=t=>parts.find(p=>p.type===t)?.value||'';return `${get('year')}-${get('month')}-${get('day')}`}
function isTodayWrong(r){return koreaDateKey(r?.attempted_at)===koreaDateKey(new Date())}

function cardHtml(r,i){const key=keyFor(r,i),ctx=contextText(r.context),recovered=looksRecovered(r),choices=Array.isArray(r.choices)&&r.choices.length?`<ol class="choices">${r.choices.map(c=>`<li>${esc(choiceText(c))}</li>`).join('')}</ol>`:'';return `<article class="question-card ${recovered?'recovered':''}" data-key="${esc(key)}" data-explanation="${esc(r.explanation_text||'')}"><div class="card-top"><div class="tags"><span class="tag">${esc(r.lesson||r.unit_key||'Lesson')}</span><span class="tag">${esc(String(r.practice_type||'').replace(/_/g,' '))}</span>${recovered?'<span class="tag warn">⚠ 복원된 문제</span>':''}</div><button class="remove-btn" type="button" data-remove="${esc(key)}">이 프린트에서 제외</button></div><div class="prompt">${esc(text(r.prompt||'문제'))}</div>${ctx?`<div class="context">${esc(ctx)}</div>`:''}${choices}<div class="answers"><div class="answer student"><small>학생 답</small>${esc(r.selected_display||answer(r.selected_answer))}</div><div class="answer correct"><small>정답</small>${esc(localCorrectDisplay(r))}</div></div>${recovered?'<div class="raw-note">이 문제는 예전 기록에서 복원되었습니다. 내용이 이상하면 프린트에서 제외하세요.</div>':''}</article>`}
function vocabListHtml(rows){if(!rows.length)return'';return `<div class="vocab-list-card"><div class="vocab-list-head"><h3>한국어 → 영어</h3><p>복원된 어휘는 간단한 단어 시험으로 바꿉니다.</p></div><div class="vocab-table">${rows.map(({r,i})=>{const key=keyFor(r,i),p=vocabPair(r);return `<div class="vocab-row" data-key="${esc(key)}"><div class="vocab-num"></div><div class="vocab-ko">${esc(p.korean)}</div><div class="vocab-write"><span class="print-blank"></span><span class="editor-answer">${esc(p.english)}</span></div><button class="remove-btn vocab-remove" type="button" data-remove="${esc(key)}">제외</button></div>`}).join('')}</div></div>`}
function sectionHtml(label,body,cls=''){return `<section class="skill-section ${cls}"><div class="skill-heading">${esc(label)}</div><div class="skill-grid">${body}</div><div class="skill-end"></div></section>`}
function allEntries(){return state.items.map((r,i)=>({r,i,key:keyFor(r,i)}))}
function validEntries(){return allEntries().filter(x=>!isRecoveredVocab(x.r)||vocabPair(x.r).valid)}
function includedEntries(){return allEntries().filter(x=>!state.removed.has(x.key)&&!state.hiddenSkills.has(skillKey(x.r)))}
function printableEntries(){return includedEntries().filter(x=>!isRecoveredVocab(x.r)||vocabPair(x.r).valid)}
function renderSections(entries){if(!entries.length)return'';const vocabRecovered=entries.filter(x=>isRecoveredVocab(x.r)&&vocabPair(x.r).valid),vocabExact=entries.filter(x=>isVocab(x.r)&&!isRecoveredVocab(x.r));let html='';if(vocabRecovered.length||vocabExact.length){let body='';if(vocabRecovered.length)body+=`<div class="vocab-span">${vocabListHtml(vocabRecovered)}</div>`;body+=vocabExact.map(({r,i})=>cardHtml(r,i)).join('');html+=sectionHtml('Vocabulary',body,'vocab-section has-page-break')}
  const non=entries.filter(x=>!isVocab(x.r)),groups=new Map();for(const x of non){const k=skillKey(x.r);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(x)}for(const [k,rows] of groups)html+=sectionHtml(skillLabel(k),rows.map(({r,i})=>cardHtml(r,i)).join(''));return html}

function renderSkillFilters(){const mount=$('#skillFilters');if(!mount)return;const counts=new Map();for(const x of validEntries()){const k=skillKey(x.r);counts.set(k,(counts.get(k)||0)+1)}const keys=[...counts.keys()].sort((a,b)=>{const ai=SKILL_ORDER.indexOf(a),bi=SKILL_ORDER.indexOf(b);return (ai<0?999:ai)-(bi<0?999:bi)||skillLabel(a).localeCompare(skillLabel(b))});mount.innerHTML=keys.map(k=>{const off=state.hiddenSkills.has(k),count=counts.get(k)||0;return `<button type="button" class="skill-filter-card${off?' off':''}" data-skill-filter="${esc(k)}" aria-pressed="${off?'false':'true'}"><span class="skill-filter-check">${off?'×':'✓'}</span><span class="skill-filter-copy"><b>${esc(skillLabel(k))}</b><small>${count}문항</small></span><span class="skill-filter-state">${off?'제외':'포함'}</span></button>`}).join('')||'<div class="empty-small">필터할 영역이 없습니다.</div>';mount.querySelectorAll('[data-skill-filter]').forEach(btn=>btn.onclick=()=>{const k=btn.dataset.skillFilter;if(state.hiddenSkills.has(k))state.hiddenSkills.delete(k);else state.hiddenSkills.add(k);render()})}
function included(){return printableEntries().map(x=>x.r)}
function updateCounts(){const n=printableEntries().length;$('#includedCount').textContent=String(n);$('#removedCount').textContent=String(Math.max(0,state.items.length-n));$('#totalCount').textContent=String(state.items.length);$('#printBtn').disabled=n===0;const pdf=$('#downloadPdfBtn');if(pdf)pdf.disabled=n===0}
function renderRemoved(){const rows=allEntries().filter(x=>state.removed.has(x.key));$('#removedList').innerHTML=rows.length?rows.map(({r,key})=>`<div class="removed-item"><span>${esc(isRecoveredVocab(r)?(vocabPair(r).english||vocabPair(r).korean||'복원 어휘'):r.prompt||r.correct_display||answer(r.correct_answer)||'문제')}</span><button class="restore-one" type="button" data-restore="${esc(key)}">복구</button></div>`).join(''):'<div class="empty-small">아직 없습니다.</div>';document.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{state.removed.delete(b.dataset.restore);render()})}
async function attachExplanations(items,token){
  const ids=[...new Set(items.map(r=>String(r.question_id||'')).filter(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))];
  if(!ids.length)return items;
  try{
    const r=await fetch(EXPL_API,{method:'POST',headers:{Authorization:`Bearer ${token}`,apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({question_ids:ids}),credentials:'omit',cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.success===false)throw new Error(j.error||`Request failed (${r.status})`);
    const map=new Map((Array.isArray(j.items)?j.items:[]).map(x=>[String(x.question_id),String(x.explanation_text||'').trim()]));
    for(const item of items)item.explanation_text=map.get(String(item.question_id))||'';
  }catch(e){console.warn('[wrong-print-editor] explanation lookup failed',e)}
  return items;
}

function render(){const entries=printableEntries(),skipped=includedEntries().filter(x=>isRecoveredVocab(x.r)&&!vocabPair(x.r).valid);$('#status').hidden=true;$('#cards').innerHTML=renderSections(entries)||'<div class="empty-state">프린트할 문제가 없습니다. 영역 선택이나 제외된 문제를 확인하세요.</div>';if(skipped.length){const n=document.createElement('div');n.className='status';n.textContent=`한국어 뜻 또는 정확한 영어 단어가 없는 복원 어휘 ${skipped.length}개는 자동으로 제외했습니다.`;$('#cards').prepend(n)}document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{state.removed.add(b.dataset.remove);render()});renderSkillFilters();renderRemoved();updateCounts()}

async function load(){if(!state.studentId){$('#status').textContent='학생 ID가 없습니다. Teacher Dashboard에서 이 편집기를 열어주세요.';return}$('#status').hidden=false;$('#status').textContent='오답을 불러오는 중…';$('#cards').innerHTML='';const token=window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';if(!token){$('#status').textContent='로그인이 필요합니다.';return}try{const q=new URLSearchParams({student_id:state.studentId,_t:String(Date.now())});if(state.planId)q.set('plan_id',state.planId);const r=await fetch(`${WRONG_API}?${q}`,{headers:{Authorization:`Bearer ${token}`,apikey:KEY},credentials:'omit',cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok||j.success===false)throw new Error(j.error||`Request failed (${r.status})`);state.items=Array.isArray(j.items)?j.items:[];if(state.wrongFilter==='today')state.items=state.items.filter(isTodayWrong);await attachExplanations(state.items,token);state.removed.clear();state.hiddenSkills.clear();render()}catch(e){$('#status').hidden=false;$('#status').textContent=`불러오기 실패: ${e.message||e}`}}

function printAnswer(r){return localCorrectDisplay(r)}
function answerKeyHtml(entries){const groups=[];const vocab=entries.filter(x=>isVocab(x.r));if(vocab.length)groups.push(['Vocabulary',vocab]);const seen=new Map();for(const x of entries.filter(x=>!isVocab(x.r))){const k=skillKey(x.r);if(!seen.has(k))seen.set(k,[]);seen.get(k).push(x)}for(const [k,rows] of seen)groups.push([skillLabel(k),rows]);return groups.map(([label,rows])=>`<section class="answer-skill"><h3>${esc(label)}</h3><div class="answer-grid">${rows.map((x,i)=>`<div class="answer-key-item"><div><b>${i+1}.</b> ${esc(printAnswer(x.r))}</div>${x.r.explanation_text?`<div class="answer-explanation"><b>해설</b> ${esc(text(x.r.explanation_text))}</div>`:''}</div>`).join('')}</div></section>`).join('')}
function ensurePrintExtras(){document.querySelectorAll('.print-only').forEach(x=>x.remove());const entries=printableEntries(),showMeta=$('#showMeta').checked,head=document.createElement('header');head.className='print-only print-head';head.innerHTML=`<div class="print-brand"><img src="/Assets/Images/color-logo.png" alt="Willena"><div><h1>오답 다시 풀기</h1><p>Willena English · Test Prep Review</p></div></div><div class="print-student"><b>${esc(state.student)}</b><span>${esc(state.exam)}</span><span>${esc(new Date().toLocaleDateString('ko-KR'))}</span></div>`;$('.workspace').prepend(head);document.querySelectorAll('.question-card .tag').forEach(x=>{x.style.display=showMeta?'':'none'});if($('#answerKey').checked){const key=document.createElement('section');key.className='print-only answer-key';key.innerHTML=`<h2>정답지</h2>${answerKeyHtml(entries)}`;$('.workspace').appendChild(key)}}
function doPrint(){if(!printableEntries().length)return;ensurePrintExtras();window.print();setTimeout(()=>{document.querySelectorAll('.print-only').forEach(x=>x.remove());document.querySelectorAll('.question-card .tag').forEach(x=>x.style.display='')},300)}

$('#studentMeta').textContent=[state.student,state.exam,state.wrongFilter==='today'?'오늘 오답':null].filter(Boolean).join(' · ')||'오답 프린트 편집';$('#reloadBtn').onclick=load;$('#restoreAll').onclick=()=>{state.removed.clear();state.hiddenSkills.clear();render()};$('#printBtn').onclick=doPrint;load();
})();