(function(){
'use strict';

const ORDER=['vocabulary','vocab_test','communication','grammar','sentences','reading','constructed_response'];
const LABELS={
  vocabulary:'단어 학습',
  vocab_test:'어휘 문제',
  communication:'의사소통',
  grammar:'문법',
  sentences:'본문',
  reading:'독해',
  constructed_response:'서술형'
};

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const pct=v=>v==null?'—':`${Math.round(Number(v)||0)}%`;
const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));

function reviewMap(review){
  const map=new Map();
  (review?.lessons||[]).forEach(l=>map.set(String(l.unit_id||l.lesson||''),l));
  return map;
}
function practiceReviewMap(lessonReview){
  const map=new Map();
  (lessonReview?.practices||[]).forEach(p=>map.set(String(p.practice_type||''),p));
  return map;
}
function lessonKey(l){return String(l?.unit_id||l?.lesson||'')}
function coverage(row){return row?.total?Math.round(n(row.completed)/n(row.total)*100):0}

function ring(row){
  const c=clamp(coverage(row));
  return `<div class="na2-lesson-ring" style="--na2-ring:${c}%" aria-label="${c}% 완료"><div><strong>${c}%</strong><span>완료</span></div></div>`;
}
function chips(practices){
  const set=new Set((practices||[]).filter(p=>n(p.total)>0).map(p=>p.practice_type));
  return ORDER.filter(k=>set.has(k)).map(k=>`<span>${esc(LABELS[k]||k)}</span>`).join('');
}
function lessonRow(l,review){
  const wrong=n(review?.wrong_now);
  return `<article class="na2-progress-lesson" data-lesson-key="${esc(lessonKey(l))}">
    <button type="button" class="na2-progress-summary" data-toggle-lesson aria-expanded="false">
      ${ring(l)}
      <div class="na2-progress-main">
        <div class="na2-progress-titleline"><strong>${esc(l.lesson||'Lesson')}</strong><i>›</i></div>
        <div class="na2-progress-chips">${chips(l.practices)}</div>
      </div>
      <div class="na2-progress-stats">
        <div><b>${n(l.completed)}/${n(l.total)}</b><span>완료</span></div>
        <div><b>${esc(pct(l.recent_accuracy))}</b><span>최근 ${n(l.recent_count)}</span></div>
        <div><b>${esc(pct(l.unique_accuracy))}</b><span>전체</span></div>
        <div class="wrong"><b>${wrong}</b><span>오답</span></div>
      </div>
    </button>
    <div class="na2-practice-journey" data-journey hidden></div>
  </article>`;
}

function practiceRow(p,index,review){
  const cov=coverage(p),wrong=n(review?.wrong_now);
  return `<div class="na2-practice-stop">
    <div class="na2-practice-num">${index+1}</div>
    <div class="na2-practice-copy">
      <strong>${esc(LABELS[p.practice_type]||p.practice_type)}</strong>
      <div class="na2-practice-bar"><i style="width:${clamp(cov)}%"></i></div>
    </div>
    <div class="na2-practice-metrics">
      <span><b>${n(p.completed)}/${n(p.total)}</b> 완료</span>
      <span class="recent"><b>${esc(pct(p.recent_accuracy))}</b> 최근 ${n(p.recent_count)}</span>
      <span class="all"><b>${esc(pct(p.unique_accuracy))}</b> 전체</span>
      ${wrong?`<span class="wrong"><b>${wrong}</b> 오답</span>`:''}
    </div>
  </div>`;
}

function fillJourney(article,lesson,review){
  const box=article.querySelector('[data-journey]');
  if(!box||box.dataset.ready==='1')return;
  const rmap=practiceReviewMap(review);
  const practices=(lesson.practices||[]).filter(p=>n(p.total)>0||n(p.completed)>0);
  box.innerHTML=practices.length
    ? practices.map((p,i)=>practiceRow(p,i,rmap.get(p.practice_type))).join('')
    : '<div class="na2-journey-empty">이 레슨에는 표시할 학습 영역이 없습니다.</div>';
  box.dataset.ready='1';
}

function render(container,data){
  if(!container)return;
  const stats=data?.stats||data||{},lessons=Array.isArray(stats.lessons)?stats.lessons:[],rmap=reviewMap(stats.review||{});
  if(!lessons.length){container.innerHTML='<div class="na2-detail-empty">레슨 데이터가 없습니다.</div>';return}
  container.innerHTML=`<div class="na2-progress-list">${lessons.map(l=>lessonRow(l,rmap.get(lessonKey(l)))).join('')}</div>`;
  container.querySelectorAll('.na2-progress-lesson').forEach((article,index)=>{
    const lesson=lessons[index],review=rmap.get(lessonKey(lesson)),btn=article.querySelector('[data-toggle-lesson]'),box=article.querySelector('[data-journey]');
    btn?.addEventListener('click',()=>{
      const open=btn.getAttribute('aria-expanded')==='true';
      if(!open)fillJourney(article,lesson,review);
      btn.setAttribute('aria-expanded',String(!open));
      article.classList.toggle('open',!open);
      if(box)box.hidden=open;
    });
  });
}

window.NaesinV2LessonJourney={render,version:'p6-1'};
})();
