import {buildMockTestPaper,MOCK_TEST_BLUEPRINT,MOCK_TEST_MINUTES,MOCK_TEST_TOTAL} from './mock-test-source.js?v=1.0.0';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LABELS={vocabulary:'어휘',communication:'대화',grammar:'문법',reading:'독해',constructed_response:'서술형'};
let activeToken=0;
let previewPaper=null;

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
function sourceLabel(entry){
  const q=entry?.question||{},code=String(q?.source?.code||'').trim(),type=String(q?.tracking?.questionType||q?.form||'').trim();
  return [entry?.lesson,code,type].filter(Boolean).join(' · ');
}
function promptPreview(entry){
  const q=entry?.question||{},prompt=String(q.prompt||'').replace(/\s+/g,' ').trim();
  return prompt.length>92?`${prompt.slice(0,92)}…`:prompt;
}
function blueprintHtml(paper){
  const boxes=Object.entries(MOCK_TEST_BLUEPRINT).map(([key,wanted])=>{
    const actual=Number(paper?.selectedCounts?.[key]||0),available=Number(paper?.availability?.[key]||0);
    return `<div class="wrong-stat"><strong>${actual}/${wanted}</strong><small>${esc(LABELS[key])} · 후보 ${available}</small></div>`;
  }).join('');
  return `<div class="wrong-stats" style="margin-top:12px">${boxes}</div>`;
}
function diagnosticsHtml(paper){
  const messages=[];
  if(paper.writtenFallback?.used)messages.push(`서술형 부족분 ${paper.writtenFallback.used}문항을 객관식으로 대체했습니다.`);
  if(Object.keys(paper.shortages||{}).length)messages.push(`부족: ${Object.entries(paper.shortages).map(([k,v])=>`${LABELS[k]||k} ${v}`).join(' · ')}`);
  if(paper.loadErrors?.length)messages.push(`불러오기 실패: ${paper.loadErrors.map(x=>x.lesson||'범위').join(', ')}`);
  if(!messages.length)return'<div class="pill" style="margin-top:10px">구성 조건 충족 ✓</div>';
  return`<div class="statline" style="margin-top:10px">${messages.map(esc).join('<br>')}</div>`;
}
function questionList(paper){
  return `<div class="journey" style="margin-top:18px">${paper.questions.map(entry=>{
    const actualLabel=LABELS[entry.bucket]||entry.bucket;
    const fallback=entry.slot==='constructed_response_fallback'?'<span class="pill">서술형 대체</span>':'';
    return `<div class="journey-stop"><div class="station">${entry.number}</div><div class="stop-copy"><b>${esc(actualLabel)} ${fallback}</b><small>${esc(sourceLabel(entry))}</small><small>${esc(promptPreview(entry))}</small></div></div>`;
  }).join('')}</div>`;
}

export async function renderMockTestPreflight({host,plan,studentId=null,onBack=()=>{}}={}){
  if(!host||!plan?.id)return null;
  const token=++activeToken;
  host.innerHTML='<div class="loading">실전모의고사 시험지를 구성하는 중...</div>';
  const render=async seed=>{
    const paper=await buildMockTestPaper({plan,studentId,seed});
    if(token!==activeToken)return null;
    previewPaper=paper;
    host.innerHTML=`<button class="back" type="button" data-mock-back>← ${esc(plan.book_label||'시험 범위')}</button><div class="heading"><div><h2>실전모의고사</h2><p>${MOCK_TEST_TOTAL}문항 · ${MOCK_TEST_MINUTES}분 · 제출 전 피드백 없음</p></div></div><div class="wrong-card" style="cursor:default"><span class="wrong-copy"><b>${paper.ready?'시험지 구성 완료':'시험지 구성을 확인해 주세요'}</b><small>${esc(plan.exam_name||'현재 시험 범위')}</small></span>${blueprintHtml(paper)}${diagnosticsHtml(paper)}</div>${questionList(paper)}<div class="review-actions" style="margin-top:18px"><button class="review-secondary" type="button" data-mock-regenerate>시험지 다시 구성</button><button class="review-primary" type="button" data-mock-start ${paper.ready?'':'disabled'}>시험 시작 · Stage 2에서 연결</button></div>`;
    host.querySelector('[data-mock-back]').onclick=onBack;
    host.querySelector('[data-mock-regenerate]').onclick=async()=>{
      host.innerHTML='<div class="loading">새 시험지를 구성하는 중...</div>';
      try{await render(resetSeed(plan.id))}catch(e){if(token===activeToken)host.innerHTML=`<button class="back" type="button" data-mock-back>← 시험 범위</button><div class="error">${esc(e.message||'시험지를 구성하지 못했습니다.')}</div>`}
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
