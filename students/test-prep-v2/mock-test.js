import {buildMockTestPaper,MOCK_TEST_BLUEPRINT,MOCK_TEST_MINUTES,MOCK_TEST_TOTAL} from './mock-test-source.js?v=1.0.2';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LABELS={vocabulary:'어휘',communication:'대화',grammar:'문법',reading:'독해',constructed_response:'서술형'};
let activeToken=0;
let previewPaper=null;

function ensureStyles(){
  if(document.querySelector('link[data-mock-test-style]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';link.href='./mock-test.css?v=1.0.1';link.dataset.mockTestStyle='1';document.head.appendChild(link);
}
ensureStyles();

function seedKey(planId){return`willenaMockPaperSeed:${planId}`}
function makeSeed(planId){
  const raw=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;
  return`${planId}|${raw}`;
}
function getSeed(planId){
  try{
    let seed=sessionStorage.getItem(seedKey(planId));
    if(!seed){seed=makeSeed(planId);sessionStorage.setItem(seedKey(planId),seed)}
    return seed;
  }catch(_){return makeSeed(planId)}
}
function resetSeed(planId){
  const seed=makeSeed(planId);
  try{sessionStorage.setItem(seedKey(planId),seed)}catch(_){}
  return seed;
}
function countsHtml(paper){
  return `<div class="mock-section-counts">${Object.keys(MOCK_TEST_BLUEPRINT).map(key=>{
    const actual=Number(paper?.selectedCounts?.[key]||0);
    return `<div class="mock-section-count"><span>${esc(LABELS[key])}</span><strong>${actual}문항</strong></div>`;
  }).join('')}</div>`;
}
function diagnosticsHtml(paper){
  const messages=[];
  if(paper.writtenFallback?.used)messages.push(`서술형 ${paper.writtenFallback.used}문항은 객관식으로 대체됩니다.`);
  if(Object.keys(paper.shortages||{}).length)messages.push(`필요한 문제 수가 부족합니다: ${Object.entries(paper.shortages).map(([k,v])=>`${LABELS[k]||k} ${v}문항`).join(' · ')}`);
  if(paper.loadErrors?.length)messages.push(`일부 범위를 불러오지 못했습니다: ${paper.loadErrors.map(x=>x.lesson||'범위').join(', ')}`);
  return messages.length?`<div class="mock-summary-note">${messages.map(esc).join('<br>')}</div>`:'';
}

export async function renderMockTestPreflight({host,plan,studentId=null,onBack=()=>{}}={}){
  if(!host||!plan?.id)return null;
  const token=++activeToken;
  host.innerHTML='<div class="loading">실전모의고사 시험지를 구성하는 중...</div>';
  const render=async seed=>{
    const paper=await buildMockTestPaper({plan,studentId,seed});
    if(token!==activeToken)return null;
    previewPaper=paper;
    host.innerHTML=`<div class="mock-preflight"><button class="back" type="button" data-mock-back>← ${esc(plan.book_label||'시험 범위')}</button><div class="heading"><div><h2>실전모의고사</h2><p>${MOCK_TEST_TOTAL}문항 · ${MOCK_TEST_MINUTES}분</p></div></div><section class="mock-summary-card"><div class="mock-summary-head"><div><span class="mock-summary-eyebrow">시험 구성</span><h3 class="mock-summary-title">${esc(plan.exam_name||'현재 시험 범위')}</h3><p class="mock-summary-copy">답안은 마지막에 한 번에 제출하고 채점합니다.</p></div><span class="mock-ready ${paper.ready?'':'is-warning'}">${paper.ready?'준비 완료':'확인 필요'}</span></div>${countsHtml(paper)}${diagnosticsHtml(paper)}</section><div class="mock-actions"><button class="review-secondary" type="button" data-mock-regenerate>시험지 다시 구성</button><button class="review-primary" type="button" data-mock-start disabled>시험 시작 · Stage 2에서 연결</button></div></div>`;
    host.querySelector('[data-mock-back]').onclick=onBack;
    host.querySelector('[data-mock-regenerate]').onclick=async()=>{
      host.innerHTML='<div class="loading">새 시험지를 구성하는 중...</div>';
      try{await render(resetSeed(plan.id))}
      catch(e){
        if(token!==activeToken)return;
        host.innerHTML=`<button class="back" type="button" data-mock-back>← 시험 범위</button><div class="error">${esc(e.message||'시험지를 구성하지 못했습니다.')}</div>`;
        host.querySelector('[data-mock-back]').onclick=onBack;
      }
    };
    return paper;
  };
  try{return await render(getSeed(plan.id))}
  catch(e){
    if(token!==activeToken)return null;
    console.error('[mock-test] preflight failed',e);
    host.innerHTML=`<button class="back" type="button" data-mock-back>← ${esc(plan.book_label||'시험 범위')}</button><div class="error">${esc(e.message||'시험지를 구성하지 못했습니다.')}</div>`;
    host.querySelector('[data-mock-back]').onclick=onBack;
    return null;
  }
}

export function stopMockTest(){activeToken++;previewPaper=null}
export function getMockPreviewPaper(){return previewPaper}
