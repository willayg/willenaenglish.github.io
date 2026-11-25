// Read-only teacher mock preview. Mirrors the student paper's section quota
// against currently published unit banks, without student sessions or writes.
const CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const BLUEPRINT={vocabulary:4,communication:6,grammar:6,reading:6,constructed_response:3};
const KEY_ORDER=Object.keys(BLUEPRINT);
function rank(seed,id){let h=2166136261;for(const c of seed+'|'+id)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0}
async function contentRows(path){
  const out=[];
  for(let offset=0;offset<10000;offset+=1000){
    const r=await fetch(CONTENT_URL+'/rest/v1/'+path,{headers:{apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY,Range:offset+'-'+(offset+999)},cache:'no-store'});
    if(!r.ok)throw Error('콘텐츠 DB 조회 실패 ('+r.status+')');
    const rows=await r.json();out.push(...rows);if(rows.length<1000)break;
  }
  return out;
}
function fitQ(row,bucket,lesson,unitId){
  const choices=Array.isArray(row.choices)?row.choices:[],answers=Array.isArray(row.correct_answer)?row.correct_answer:[row.correct_answer];
  return {bucket,lesson,unitId,question:{id:row.id,prompt:row.prompt_text,context:row.context||{},choices,answer:answers.filter(x=>x!=null),source:{label:row.student_source_label||'Willena'},metadata:row.metadata||{}}};
}
function scopeRows(group){
  const scope=group.scope||{};
  return [...(scope.lessons||[]),...(scope.external_passages||[]).map(x=>({...x,lesson:x.lesson||x.label||x.unit_label}))].filter(x=>x.unit_id&&x.lesson);
}
async function loadUnit(row){
  const lesson=row.lesson,unitId=row.unit_id,sections=new Set(row.sections||[]);
  const jobs=[];
  const stored=async section=>contentRows('test_prep_questions?select='+encodeURIComponent('id,section,question_type,answer_mode,prompt_text,context,choices,correct_answer,metadata,student_source_label,replacement_needed')+'&unit_id=eq.'+encodeURIComponent(unitId)+'&section=eq.'+section+'&student_usable=eq.true');
  for(const bucket of ['communication','grammar','reading']){
    if(sections.has(bucket))jobs.push(stored(bucket).then(list=>list.filter(q=>q.replacement_needed!==true&&Array.isArray(q.choices)&&q.choices.length>1).map(q=>fitQ(q,bucket,lesson,unitId))));
  }
  if(sections.has('constructed_response')){
    jobs.push(contentRows('test_prep_questions?select='+encodeURIComponent('id,section,question_type,answer_mode,prompt_text,context,choices,correct_answer,metadata,student_source_label,replacement_needed')+'&unit_id=eq.'+encodeURIComponent(unitId)+'&answer_mode=eq.text&student_usable=eq.true').then(list=>list.filter(q=>q.replacement_needed!==true&&['grammar','reading','communication','constructed_response'].includes(q.section)).map(q=>fitQ(q,'constructed_response',lesson,unitId))));
  }
  if(sections.has('vocabulary')||sections.has('vocab_test')){
    jobs.push((async()=>{
      const occurrences=await contentRows('source_content_occurrences?select=lexical_entry_id&unit_id=eq.'+encodeURIComponent(unitId)+'&occurrence_type=eq.lexical_entry&skill=eq.vocabulary');
      const ids=[...new Set(occurrences.map(x=>x.lexical_entry_id).filter(Boolean))],words=[];
      for(let i=0;i<ids.length;i+=100){
        const part=await contentRows('lexical_entries?select=id,canonical_text,translation_ko,definition_en&id=in.'+encodeURIComponent('('+ids.slice(i,i+100).join(',')+')'));
        words.push(...part);
      }
      const ready=words.filter(w=>w.canonical_text&&w.definition_en);
      return ready.map((w,i)=>{
        const distractors=[...ready].filter(x=>x.id!==w.id).sort((a,b)=>rank(w.id,a.id)-rank(w.id,b.id)).slice(0,3);
        if(distractors.length<3)return null;
        const choices=[w,...distractors].sort((a,b)=>rank('choice|'+w.id,a.id)-rank('choice|'+w.id,b.id));
        return {bucket:'vocabulary',lesson,unitId,question:{id:'vocab:'+w.id,prompt:'다음 영어 정의에 해당하는 단어를 고르시오.',context:{definition:w.definition_en},choices:choices.map(x=>x.canonical_text),answer:[String(choices.findIndex(x=>x.id===w.id)+1)],source:{label:'Lesson vocabulary'},metadata:{translation_ko:w.translation_ko,canonical_text:w.canonical_text}}};
      }).filter(Boolean);
    })());
  }
  const settled=await Promise.allSettled(jobs),entries=[],errors=[];
  for(const x of settled){if(x.status==='fulfilled')entries.push(...x.value);else errors.push({lesson,message:String(x.reason?.message||x.reason)})}
  return {entries,errors};
}
async function buildMockTestPaper({plan,seed}){
  const rows=scopeRows(plan.group);
  if(!rows.length)throw Error('선택된 시험 범위가 없습니다.');
  const results=await Promise.all(rows.map(loadUnit)),all=results.flatMap(x=>x.entries),loadErrors=results.flatMap(x=>x.errors);
  const pools=Object.fromEntries(KEY_ORDER.map(k=>[k,all.filter(x=>x.bucket===k)]));
  const selected=[],used=new Set(),shortages={};
  for(const bucket of KEY_ORDER){
    const pool=[...pools[bucket]].sort((a,b)=>rank(seed+'|'+bucket,a.question.id)-rank(seed+'|'+bucket,b.question.id));
    // Distribute across lessons first, then reuse remaining candidates.
    const groups=new Map();
    for(const e of pool){if(!groups.has(e.unitId))groups.set(e.unitId,[]);groups.get(e.unitId).push(e)}
    const units=[...groups.keys()].sort((a,b)=>rank(seed+'|unit',a)-rank(seed+'|unit',b));
    let n=0,progress=true;
    while(n<BLUEPRINT[bucket]&&progress){
      progress=false;
      for(const unit of units){
        const list=groups.get(unit);
        while(list.length&&used.has(list[0].question.id))list.shift();
        if(!list.length)continue;
        const e=list.shift();selected.push(e);used.add(e.question.id);n++;progress=true;
        if(n===BLUEPRINT[bucket])break;
      }
    }
    if(n<BLUEPRINT[bucket])shortages[bucket]=BLUEPRINT[bucket]-n;
  }
  // Student mock-test behavior: replace missing written slots with other sections.
  const missingWritten=shortages.constructed_response||0;
  let fallback=0;
  if(missingWritten){
    for(const e of all.sort((a,b)=>rank(seed+'|fallback',a.question.id)-rank(seed+'|fallback',b.question.id))){
      if(fallback>=missingWritten)break;
      if(e.bucket==='constructed_response'||used.has(e.question.id))continue;
      selected.push({...e,bucket:'constructed_response_fallback'});used.add(e.question.id);fallback++;
    }
    if(fallback===missingWritten)delete shortages.constructed_response;
    else shortages.constructed_response=missingWritten-fallback;
  }
  const questions=[...selected].sort((a,b)=>KEY_ORDER.indexOf(a.bucket)-KEY_ORDER.indexOf(b.bucket)||rank(seed+'|order',a.question.id)-rank(seed+'|order',b.question.id));
  const selectedCounts=Object.fromEntries(KEY_ORDER.map(k=>[k,selected.filter(e=>e.bucket===k||(k==='constructed_response'&&e.bucket==='constructed_response_fallback')).length]));
  return {ready:questions.length===25&&Object.keys(shortages).length===0,total:questions.length,questions,blueprint:BLUEPRINT,selectedCounts,shortages,loadErrors};
}

const h=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const labels={vocabulary:'어휘',communication:'대화',grammar:'문법',reading:'독해',constructed_response:'서술형',constructed_response_fallback:'서술형 대체'};
let dialog, currentGroup, currentPaper, selected=0, running=false;

function ensureDialog(){
  if(dialog)return dialog;
  const css=document.createElement('style');
  css.textContent=`
  .na2-mock-dialog{border:0;border-radius:18px;padding:0;width:min(1040px,96vw);max-width:96vw;max-height:94vh;background:#f8fafc;color:#243040;box-shadow:0 22px 70px #192b4055;font-family:Poppins,Arial,sans-serif}
  .na2-mock-dialog::backdrop{background:#182532bb}
  .na2-mock-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 22px;background:#fff;border-bottom:1px solid #dfe7ec}
  .na2-mock-header h2{margin:0;font-size:20px;color:#253645}.na2-mock-header p{margin:5px 0 0;font-size:12px;color:#687987}
  .na2-mock-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .na2-mock-dialog button{cursor:pointer;font:inherit}
  .na2-mock-action{border:1.5px solid #8cced8;background:#fff;color:#1c5c70;border-radius:12px;padding:9px 13px;font-weight:700}
  .na2-mock-action:disabled{opacity:.5;cursor:wait}
  .na2-mock-body{overflow:auto;max-height:calc(94vh - 85px);padding:18px 22px 24px}
  .na2-mock-stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
  .na2-mock-stat{background:#fff;border:1px solid #e2eaef;border-radius:9px;padding:9px 11px;font-size:12px}
  .na2-mock-status{padding:12px;background:#fff;border:1px solid #e6eaed;border-radius:12px;margin-bottom:12px;font-size:13px;line-height:1.6}
  .na2-mock-layout{display:grid;grid-template-columns:minmax(180px,245px) minmax(0,1fr);gap:16px;align-items:start}
  .na2-mock-list{max-height:65vh;overflow:auto;background:#fff;border:1px solid #e6edf0;border-radius:13px;padding:7px}
  .na2-mock-list button{display:block;width:100%;text-align:left;padding:11px 12px;border:0;border-bottom:1px solid #f0f2f4;background:#fff;color:#354755;font-size:12px}
  .na2-mock-list button.active{background:#e9f8fb;border-radius:9px;color:#126074}
  .na2-mock-question{background:#fff;border:1px solid #e6edf0;border-radius:13px;padding:20px;min-width:0}
  .na2-mock-kicker{font-weight:700;font-size:12px;color:#397e8d;margin-bottom:10px}
  .na2-mock-prompt{font-size:18px;font-weight:700;white-space:pre-wrap;line-height:1.6;margin-bottom:12px}
  .na2-mock-context{white-space:pre-wrap;font-size:14px;line-height:1.7;padding:13px 15px;border-radius:10px;background:#f6f9fb;margin:10px 0;overflow-wrap:anywhere}
  .na2-mock-options{margin:14px 0;padding-left:25px;font-size:14px;line-height:1.8}
  .na2-mock-answer{margin-top:15px;border-top:1px solid #e2ebee;padding-top:13px;font-size:14px;overflow-wrap:anywhere}
  .na2-mock-navigation{display:flex;justify-content:space-between;gap:10px;margin-top:18px}
  @media(max-width:650px){.na2-mock-layout{grid-template-columns:1fr}.na2-mock-list{max-height:160px}.na2-mock-header{align-items:flex-start;flex-direction:column}.na2-mock-dialog{max-height:96vh}.na2-mock-body{max-height:calc(96vh - 145px)}}
  `;
  document.head.appendChild(css);
  dialog=document.createElement('dialog');dialog.className='na2-mock-dialog';
  dialog.innerHTML='<div class="na2-mock-header"><div><h2>모의고사 검사</h2><p id="na2MockSubtitle">Student-style question paper · teacher preview</p></div><div class="na2-mock-actions"><button class="na2-mock-action" type="button" data-mock-regenerate>새 시험지</button><button class="na2-mock-action" type="button" data-mock-close>닫기</button></div></div><div class="na2-mock-body" id="na2MockBody"></div>';
  document.body.appendChild(dialog);
  dialog.querySelector('[data-mock-close]').onclick=()=>dialog.close();
  dialog.querySelector('[data-mock-regenerate]').onclick=()=>generate();
  return dialog;
}

function contextHtml(context){
  if(!context||typeof context!=='object')return '';
  const parts=[];
  for(const [key,value] of Object.entries(context)){
    if(value==null||value==='')continue;
    // Show passages, dialogue, numbered statements, constraints and other actual source data.
    const text=Array.isArray(value)?value.map(v=>typeof v==='string'?v:JSON.stringify(v)).join('\n'):typeof value==='object'?JSON.stringify(value,null,2):String(value);
    if(!text.trim())continue;
    parts.push('<div class="na2-mock-context"><strong>'+h(key)+'</strong>\n'+h(text.replace(/\\n/g,'\n'))+'</div>');
  }
  return parts.join('');
}
function answerHtml(q){
  const answers=Array.isArray(q?.answer)?q.answer:[q?.answer].filter(Boolean);
  const choices=Array.isArray(q?.choices)?q.choices:[];
  return answers.map(raw=>{
    const s=String(raw??'');
    const idx=/^\d+$/.test(s)?Number(s)-1:-1;
    return h(idx>=0&&idx<choices.length? `${s}. ${choices[idx]}`:s);
  }).join(' / ')||'—';
}
function questionHtml(e,index){
  const q=e?.question||{},choices=Array.isArray(q.choices)?q.choices:[],source=q.source||{},meta=q.metadata||{};
  const expl=meta.explanation_ko||meta.source_explanation_ko||meta.explanation||'';
  return '<div class="na2-mock-kicker">#'+(index+1)+' · '+h(labels[e.bucket]||e.bucket)+' · '+h(e.lesson||'')+' · '+h(source.label||'')+'</div>'+
    '<div class="na2-mock-prompt">'+h(q.prompt||'문제 없음')+'</div>'+contextHtml(q.context)+
    (choices.length?'<ol class="na2-mock-options">'+choices.map(c=>'<li>'+h(typeof c==='string'?c:JSON.stringify(c))+'</li>').join('')+'</ol>':'')+
    '<div class="na2-mock-answer"><strong>정답:</strong> '+answerHtml(q)+'</div>'+
    (expl?'<div class="na2-mock-context"><strong>해설</strong>\n'+h(expl)+'</div>':'')+
    '<div class="na2-mock-navigation"><button class="na2-mock-action" data-mock-prev '+(index===0?'disabled':'')+'>이전</button><button class="na2-mock-action" data-mock-next '+(index===currentPaper.questions.length-1?'disabled':'')+'>다음</button></div>';
}
function showQuestion(index){
  if(!currentPaper?.questions?.length)return;
  selected=Math.max(0,Math.min(index,currentPaper.questions.length-1));
  dialog.querySelector('#na2MockQuestion').innerHTML=questionHtml(currentPaper.questions[selected],selected);
  dialog.querySelectorAll('[data-mock-item]').forEach(b=>b.classList.toggle('active',Number(b.dataset.mockItem)===selected));
  dialog.querySelector('[data-mock-prev]').onclick=()=>showQuestion(selected-1);
  dialog.querySelector('[data-mock-next]').onclick=()=>showQuestion(selected+1);
}
function render(){
  const p=currentPaper,box=dialog.querySelector('#na2MockBody');if(!p)return;
  const diag=(p.loadErrors||[]).map(x=>h((x.lesson||'')+': '+(x.message||''))).join(' · ');
  box.innerHTML='<div class="na2-mock-stats">'+Object.entries(p.blueprint||{}).map(([k,count])=>'<span class="na2-mock-stat">'+h(labels[k]||k)+' '+(p.selectedCounts?.[k]||0)+' / '+count+'</span>').join('')+'</div>'+
    '<div class="na2-mock-status"><strong>'+(p.ready?'25문항 구성 완료':'시험 구성 확인 필요')+'</strong> · '+p.total+' questions'+(diag?'<div>불러오기 오류: '+diag+'</div>':'')+(Object.keys(p.shortages||{}).length?'<div>부족한 문제: '+h(JSON.stringify(p.shortages))+'</div>':'')+'<div>읽기 전용 검사입니다. 학생 점수와 기록은 변경되지 않습니다.</div></div>'+
    '<div class="na2-mock-layout"><nav class="na2-mock-list" aria-label="모의고사 문제 목록">'+(p.questions||[]).map((e,i)=>'<button type="button" data-mock-item="'+i+'"><b>#'+(i+1)+' · '+h(labels[e.bucket]||e.bucket)+'</b><div>'+h(e.lesson||'')+'</div></button>').join('')+'</nav><article class="na2-mock-question" id="na2MockQuestion"></article></div>';
  box.querySelectorAll('[data-mock-item]').forEach(b=>b.onclick=()=>showQuestion(Number(b.dataset.mockItem)));
  if(p.questions?.length)showQuestion(0);
}
async function generate(){
  if(running||!currentGroup)return;
  running=true;
  const btn=dialog.querySelector('[data-mock-regenerate]');btn.disabled=true;
  dialog.querySelector('#na2MockBody').textContent='시험지를 구성하는 중…';
  try{
    const g=currentGroup;
    // Use the actual group scope, which also drives student practice.
    const plan={id:g.id,book_label:g.book_label,book_key:g.book_key,group:{scope:g.scope},units:(g.scope?.lessons||[]).map(x=>x.lesson),practice_types:['vocabulary','vocab_test','communication','grammar','reading','constructed_response']};
    currentPaper=await buildMockTestPaper({plan,seed:g.id+'|teacher-review|'+Date.now()+'|'+Math.random()});
    render();
  }catch(e){
    currentPaper=null;dialog.querySelector('#na2MockBody').textContent='시험지를 불러오지 못했습니다: '+(e?.message||String(e));
    console.error('[teacher mock preview]',e);
  }finally{running=false;btn.disabled=false}
}
window.NaesinV2MockPreview={open(item){
  const g=item?.group||item;
  if(!g?.id||!g?.scope)return alert('시험 범위 정보가 없습니다. 새로고침 후 다시 시도해 주세요.');
  ensureDialog();currentGroup=g;currentPaper=null;selected=0;
  dialog.querySelector('#na2MockSubtitle').textContent=(g.school||'')+' · '+(g.book_label||'')+' · 25문항 (학생 시험과 동일한 구성)';
  if(!dialog.open)dialog.showModal();
  generate();
}};
