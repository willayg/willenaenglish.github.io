// Read-only teacher preview of the SAME canonical paper generator used by the student app.
// Never calls student session, attempt, or score APIs.
import {buildMockTestPaper} from '/students/test-prep-v2/mock-test-source.js?v=1.3.0';

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
