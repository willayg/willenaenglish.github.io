import {QuestionRenderer} from './question-renderer.js?v=2.20.6';
import {FORMS} from './question-model.js?v=2.24.0';
import {mountAiWilliHelper} from '../shared/ai-willi.js?v=1.0.2';

const LABELS={vocabulary:'어휘',communication:'대화',grammar:'문법',reading:'독해',constructed_response:'서술형'};
const ORDER=['vocabulary','communication','grammar','reading','constructed_response'];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arr=v=>Array.isArray(v)?v:(v==null||v===''?[]:[v]);

function choiceAnswerText(question,value){
  const choices=Array.isArray(question?.choices)?question.choices:[];
  const values=arr(value).map(String).filter(Boolean);
  if(!values.length)return'미응답';
  return values.map(v=>{
    const i=Number(v)-1;
    return i>=0&&i<choices.length?`${v}. ${choices[i]}`:v;
  }).join(' / ');
}
function answerText(question,value){
  if(question?.form===FORMS.choice||question?.form===FORMS.multi)return choiceAnswerText(question,value);
  const values=arr(value).map(x=>String(x??'').trim()).filter(Boolean);
  return values.length?values.join(' / '):'미응답';
}
function practiceTypeFor(item){return item?.bucket==='vocabulary'?'vocab_test':String(item?.bucket||'')}
function sectionStats(snapshot){
  const out={};for(const key of ORDER)out[key]={correct:0,total:0,items:[]};
  for(const item of snapshot?.items||[]){
    const key=out[item.bucket]?item.bucket:'reading',s=out[key];s.total++;if(item.result?.correct)s.correct++;s.items.push(item);
  }
  return out;
}
function statusText(item){return item.answered?(item.result?.correct?'정답':'오답'):'미응답'}
function renderQuestionItem(host,item){
  const card=document.createElement('article');
  card.className=`mock-review-question ${item.result?.correct?'is-correct':'is-wrong'}${item.answered?'':' is-unanswered'}`;
  card.innerHTML=`<div class="mock-review-question-head"><span>문제 ${item.number}</span><strong>${statusText(item)}</strong></div><div class="mock-review-render"></div><div class="mock-review-answers"><div><span>내 답</span><b>${esc(answerText(item.question,item.response))}</b></div><div><span>정답</span><b>${esc(answerText(item.question,item.result?.correctAnswer??item.question?.answer))}</b></div></div>`;
  host.appendChild(card);
  const renderHost=card.querySelector('.mock-review-render'),renderer=new QuestionRenderer(renderHost);
  renderer.render(item.question);renderer.setDisabled(true);
  if(item.question?.form===FORMS.choice||item.question?.form===FORMS.multi){
    const selected=new Set(arr(item.response).map(String)),correct=new Set(arr(item.question?.answer).map(String));
    renderHost.querySelectorAll('[data-choice]').forEach(btn=>{
      const key=String(btn.dataset.choice);
      btn.classList.remove('selected');
      if(correct.has(key))btn.classList.add('correct');
      if(selected.has(key)&&!correct.has(key))btn.classList.add('wrong');
    });
  }
  if(!item.result?.correct){
    mountAiWilliHelper({
      container:card,
      question:item.question,
      response:item.response,
      result:item.result||{correct:false,method:'unanswered'},
      section:item.bucket,
      lesson:item.lesson,
      practiceType:practiceTypeFor(item)
    });
  }
}
function sectionHtml(key,s){
  const pct=s.total?Math.round(s.correct/s.total*100):0;
  return `<details class="mock-result-section" data-result-section="${key}"><summary><span>${LABELS[key]||key}</span><strong>${s.correct} / ${s.total}</strong><small>${pct}%</small><i aria-hidden="true">⌄</i></summary><div class="mock-result-section-body" data-result-body="${key}"></div></details>`;
}

export function renderMockTestResults({host,snapshot,plan,onBack=()=>{}}={}){
  if(!host||!snapshot)return null;
  const timedOut=snapshot.reason==='timeout',stats=sectionStats(snapshot);
  host.innerHTML=`<div class="mock-results"><div class="mock-results-hero"><span class="mock-summary-eyebrow">${timedOut?'시간 종료 · 자동 제출':'실전모의고사 결과'}</span><div class="mock-results-score"><strong>${snapshot.correct}</strong><span>/ ${snapshot.total}</span></div><h2>${snapshot.pct}%</h2><p>틀린 문제 ${snapshot.wrong}개 · 미응답 ${snapshot.total-snapshot.answered}개</p></div><section class="mock-summary-card"><div class="mock-summary-head"><div><span class="mock-summary-eyebrow">영역별 결과</span><h3 class="mock-summary-title">${esc(plan?.exam_name||'시험 결과')}</h3><p class="mock-summary-copy">영역을 눌러 문제와 답안을 확인하세요.</p></div></div><div class="mock-result-sections">${ORDER.filter(key=>stats[key].total).map(key=>sectionHtml(key,stats[key])).join('')}</div><div class="mock-result-sync" data-mock-sync>오답과 통계를 저장하는 중...</div></section><div class="mock-actions"><button class="review-primary" type="button" data-mock-finished-back>시험 범위로 돌아가기</button></div></div>`;
  host.querySelector('[data-mock-finished-back]').onclick=onBack;
  host.querySelectorAll('[data-result-section]').forEach(details=>details.addEventListener('toggle',()=>{
    if(!details.open||details.dataset.rendered==='1')return;
    details.dataset.rendered='1';
    const key=details.dataset.resultSection,body=details.querySelector(`[data-result-body="${key}"]`);
    for(const item of stats[key]?.items||[])renderQuestionItem(body,item);
  }));
  return{syncEl:host.querySelector('[data-mock-sync]')};
}
