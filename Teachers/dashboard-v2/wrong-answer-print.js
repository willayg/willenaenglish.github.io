(function(){
'use strict';

const WRONG_API='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-teacher-wrong-detail';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const LOGO='/Assets/Images/Logo.png';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));

let detailParams=null;
let lastItems=[];
let lastKey='';
let loading=false;

function capture(input){
  try{
    const u=new URL(typeof input==='string'?input:input?.url,location.href);
    if(!u.pathname.includes('/test-prep-teacher-insights')||u.searchParams.get('action')!=='student_detail')return;
    const student_id=u.searchParams.get('student_id')||'';
    const plan_id=u.searchParams.get('plan_id')||'';
    if(student_id)detailParams={student_id,plan_id};
  }catch(_){ }
}

if(!window.__willenaWrongPrintFetchCapture){
  window.__willenaWrongPrintFetchCapture=true;
  const orig=window.fetch.bind(window);
  window.fetch=function(input,opts){capture(input);return orig(input,opts)};
}

function recover(){
  if(detailParams?.student_id)return;
  try{
    const entries=performance.getEntriesByType('resource');
    for(let i=entries.length-1;i>=0;i--){capture(entries[i].name);if(detailParams?.student_id)return;}
  }catch(_){ }
}

async function fetchItems(){
  recover();
  if(!detailParams?.student_id)throw new Error('학생 오답 기록을 찾지 못했습니다.');
  const token=window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
  if(!token)throw new Error('로그인이 필요합니다.');
  const q=new URLSearchParams({student_id:detailParams.student_id});
  if(detailParams.plan_id)q.set('plan_id',detailParams.plan_id);
  const r=await fetch(`${WRONG_API}?${q}`,{headers:{Authorization:`Bearer ${token}`,apikey:KEY},credentials:'omit',cache:'no-store'});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||j.success===false)throw new Error(j.error||`Request failed (${r.status})`);
  return j.items||[];
}

function answer(v){
  if(v==null||v==='')return'—';
  if(Array.isArray(v))return v.map(answer).join(' / ');
  if(typeof v==='object')return answer(v.text??v.answer??v.value??v.word??v.response??JSON.stringify(v));
  if(typeof v==='string'){
    const t=v.trim();
    if((t.startsWith('[')&&t.endsWith(']'))||(t.startsWith('{')&&t.endsWith('}'))){try{return answer(JSON.parse(t))}catch(_){ }}
  }
  return String(v);
}

function choiceText(c){
  return typeof c==='string'?c:(c?.text??c?.label??c?.value??JSON.stringify(c));
}

function questionHtml(r,i){
  const choices=Array.isArray(r.choices)&&r.choices.length
    ? `<ol class="choices">${r.choices.map(c=>`<li>${esc(choiceText(c))}</li>`).join('')}</ol>`
    : '';
  const context=r.context?`<div class="context">${esc(r.context)}</div>`:'';
  const meta=[r.lesson||r.unit_key,String(r.practice_type||r.section||'').replace(/_/g,' ')].filter(Boolean).join(' · ');
  return `<section class="question"><div class="qtop"><span class="qnum">${i+1}</span><span class="qmeta">${esc(meta)}</span></div><div class="prompt">${esc(r.prompt||'문제')}</div>${context}${choices}<div class="work-lines"><span></span><span></span></div></section>`;
}

function answerKeyHtml(items){
  return `<section class="answer-key page-break"><h2>정답지</h2><div class="answer-grid">${items.map((r,i)=>`<div><b>${i+1}.</b> ${esc(r.correct_display||answer(r.correct_answer))}</div>`).join('')}</div></section>`;
}

function printDocument(items,{includeAnswers=true}={}){
  if(!items.length){alert('현재 unresolved 오답이 없습니다.');return;}
  const student=$('#naDiagName')?.textContent?.trim()||'Student';
  const exam=$('#naDiagMeta')?.textContent?.trim()||'';
  const today=new Date().toLocaleDateString('ko-KR');
  const w=window.open('','_blank');
  if(!w){alert('팝업이 차단되었습니다. 팝업을 허용한 뒤 다시 시도하세요.');return;}
  w.document.open();
  w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(student)} 오답 다시 풀기</title><style>
    @page{size:A4;margin:14mm 15mm 15mm}
    *{box-sizing:border-box}body{margin:0;color:#222;font-family:"Noto Sans KR","Malgun Gothic",Arial,sans-serif;font-size:11pt;line-height:1.55}
    .sheet-head{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2px solid #5ac9d8;padding-bottom:10px;margin-bottom:18px;gap:18px}.brand{display:flex;align-items:center;gap:11px}.brand img{width:96px;height:auto}.title h1{font-size:19pt;margin:0 0 3px}.title p{margin:0;color:#666;font-size:9.5pt}.student-meta{text-align:right;font-size:9.5pt;color:#555}.student-meta b{display:block;color:#222;font-size:12pt}
    .question{break-inside:avoid;border:1px solid #dfe4ea;border-radius:12px;padding:13px 14px 16px;margin:0 0 13px}.qtop{display:flex;align-items:center;gap:9px;margin-bottom:8px}.qnum{display:inline-grid;place-items:center;width:27px;height:27px;border-radius:50%;background:#eefbfc;color:#18798a;font-weight:800}.qmeta{font-size:8.5pt;color:#7b8292}.prompt{font-weight:700;margin-bottom:7px}.context{background:#f6f7f9;border-radius:8px;padding:8px 10px;margin:7px 0;white-space:pre-wrap}.choices{margin:8px 0 5px;padding-left:25px}.choices li{padding:2px 0}.work-lines{margin-top:12px}.work-lines span{display:block;border-bottom:1px solid #cfd5dc;height:22px}.footer{position:fixed;bottom:0;left:0;right:0;text-align:center;color:#999;font-size:8pt}.page-break{break-before:page}.answer-key h2{font-size:16pt;margin:0 0 14px;border-bottom:2px solid #5ac9d8;padding-bottom:8px}.answer-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px}.answer-grid div{padding:6px 0;border-bottom:1px solid #eee}.print-note{font-size:8pt;color:#999;margin-top:8px}@media print{.no-print{display:none!important}}
  </style></head><body><header class="sheet-head"><div class="brand"><img src="${LOGO}" alt="Willena"><div class="title"><h1>오답 다시 풀기</h1><p>Willena English · Test Prep Review</p></div></div><div class="student-meta"><b>${esc(student)}</b><div>${esc(exam)}</div><div>${esc(today)}</div></div></header>${items.map(questionHtml).join('')}${includeAnswers?answerKeyHtml(items):''}<div class="footer">Willena English</div><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));<\/script></body></html>`);
  w.document.close();
}

function ensureDialog(){
  if($('#naWrongPrintDialog'))return;
  const bg=document.createElement('div');
  bg.id='naWrongPrintDialog';
  bg.style.cssText='position:fixed;inset:0;z-index:120;background:rgba(28,31,42,.42);display:none;align-items:center;justify-content:center;padding:18px';
  bg.innerHTML=`<div style="width:min(430px,96vw);background:white;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.24);padding:20px;font-family:Poppins,Arial,sans-serif"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div><div style="font-weight:800;font-size:1.05rem">오답 프린트</div><div id="naWrongPrintCount" style="font-size:.78rem;color:#7b8292;margin-top:3px"></div></div><button id="naWrongPrintClose" style="border:0;background:#f2f3f6;width:34px;height:34px;border-radius:10px;cursor:pointer">×</button></div><label style="display:flex;align-items:center;gap:9px;margin:18px 0 8px;font-size:.86rem"><input id="naWrongPrintAnswers" type="checkbox" checked> 마지막 페이지에 정답지 포함</label><div style="font-size:.74rem;color:#7b8292;margin-bottom:16px">학생 답과 정답은 문제 페이지에는 표시하지 않습니다.</div><div style="display:flex;justify-content:flex-end;gap:8px"><button id="naWrongPrintCancel" style="border:1px solid #dfe4ea;background:white;border-radius:10px;padding:9px 13px;cursor:pointer">취소</button><button id="naWrongPrintGo" style="border:0;background:#39384a;color:white;border-radius:10px;padding:9px 15px;font-weight:700;cursor:pointer">프린트 / PDF</button></div></div>`;
  document.body.appendChild(bg);
  const close=()=>bg.style.display='none';
  $('#naWrongPrintClose').onclick=close;
  $('#naWrongPrintCancel').onclick=close;
  bg.addEventListener('click',e=>{if(e.target===bg)close()});
  $('#naWrongPrintGo').onclick=()=>{const includeAnswers=$('#naWrongPrintAnswers').checked;close();printDocument(lastItems,{includeAnswers})};
}

async function openPrint(){
  if(loading)return;
  loading=true;
  const btn=$('#naWrongPrintBtn');
  if(btn){btn.disabled=true;btn.textContent='불러오는 중…';}
  try{
    const key=`${detailParams?.student_id||''}|${detailParams?.plan_id||''}`;
    if(!lastItems.length||lastKey!==key){lastItems=await fetchItems();lastKey=key;}
    ensureDialog();
    $('#naWrongPrintCount').textContent=`현재 시험 오답 ${lastItems.length}문제`;
    $('#naWrongPrintDialog').style.display='flex';
  }catch(e){alert(e.message||e)}
  finally{loading=false;if(btn){btn.disabled=false;btn.textContent='오답 프린트';}}
}

function injectButton(){
  const bg=$('#naFreshDiagBg');
  if(!bg?.classList.contains('open'))return;
  recover();
  const view=$('#naDiagBody [data-view="wrong"]');
  if(!view||$('#naWrongPrintBtn',view))return;
  const head=$('.na-subhead',view);
  if(!head)return;
  const btn=document.createElement('button');
  btn.id='naWrongPrintBtn';
  btn.type='button';
  btn.className='na-btn cyan';
  btn.textContent='오답 프린트';
  btn.style.marginLeft='auto';
  btn.addEventListener('click',openPrint);
  head.appendChild(btn);
}

function boot(){
  ensureDialog();
  injectButton();
  new MutationObserver(injectButton).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  console.info('[wrong-answer-print] module loaded');
}

window.WillenaWrongAnswerPrint={open:openPrint,print:printDocument};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();