// Test Prep V2 stats presentation adapter.
// Keeps canonical stats/tracking untouched; reshapes rendered stats to the V1 visual language.

const root=document.getElementById('screen');
if(root){
  const number=v=>Number(String(v||'').replace(/,/g,'').trim());
  const clamp=v=>Math.max(0,Math.min(100,Math.round(Number(v)||0)));

  function upgradeExamCard(card){
    if(card.dataset.v1ExamAccuracyReady==='1')return;
    const ring=card.querySelector('.ring');
    if(!ring)return;
    const accuracyPill=[...card.querySelectorAll('.exam-meta .pill')].find(el=>/%\s*accuracy/i.test(el.textContent||''));
    if(!accuracyPill)return;
    const match=(accuracyPill.textContent||'').match(/(\d+)%\s*accuracy/i);
    if(!match)return;
    const accuracy=clamp(match[1]);
    ring.style.setProperty('--p',`${accuracy}%`);
    const ringValue=ring.querySelector('b');
    if(ringValue)ringValue.textContent=`${accuracy}%`;
    ring.setAttribute('aria-label',`최근 정확도 ${accuracy}%`);
    card.dataset.v1ExamAccuracyReady='1';
  }

  function upgradeLessonCard(card){
    if(card.dataset.v1StatsReady==='1')return;
    const metric=card.querySelector('.metric');
    const ring=card.querySelector('.ring');
    if(!metric||!ring)return;
    const text=metric.textContent||'';
    const m=text.match(/([\d,]+)\s*\/\s*([\d,]+)\s*questions\s*[·•]?\s*(\d+)%\s*accuracy/i);
    if(!m)return;
    const completed=number(m[1]),total=number(m[2]),accuracy=clamp(m[3]);
    const coverage=total?clamp(completed/total*100):0;
    ring.style.setProperty('--p',`${accuracy}%`);
    const ringValue=ring.querySelector('b');
    if(ringValue)ringValue.textContent=`${accuracy}%`;
    ring.setAttribute('aria-label',`최근 50문제 정확도 ${accuracy}%`);
    metric.textContent='최근 50문제 정확도';
    const progress=document.createElement('div');
    progress.className='lesson-card-completion';
    progress.innerHTML=`<div class="lesson-card-completion-head"><span>문제 완료</span><strong>${completed} / ${total}</strong></div><div class="lesson-card-completion-track"><i style="width:${coverage}%"></i></div>`;
    metric.insertAdjacentElement('afterend',progress);
    const label=document.createElement('small');
    label.className='lesson-card-ring-label';
    label.textContent='정확도';
    ring.insertAdjacentElement('afterend',label);
    card.dataset.v1StatsReady='1';
  }

  function renderJourneyMetrics(stat,completed,total,accuracyValue){
    stat.className='stop-metrics';
    stat.innerHTML=`<span class="stop-metric stop-completion"><strong>${completed}<span>/</span>${total}</strong><small>완료</small></span><span class="stop-metric-divider" aria-hidden="true"></span><span class="stop-metric stop-accuracy"><strong>${accuracyValue}</strong><small>평균</small></span>`;
  }

  function upgradeJourneyRow(row){
    if(row.dataset.v1StatsReady==='1')return;
    const stat=row.querySelector('.stop-stat');
    if(!stat)return;
    const raw=stat.childNodes[0]?.textContent?.trim()||'';
    const small=stat.querySelector('small');
    const accuracyText=small?.textContent||'';
    const count=raw.match(/([\d,]+)\s*\/\s*([\d,]+)/);
    const accuracy=accuracyText.match(/(\d+)%\s*accuracy/i);
    if(!count)return;
    renderJourneyMetrics(stat,count[1],count[2],accuracy?`${clamp(accuracy[1])}%`:'—');
    row.dataset.v1StatsReady='1';
  }

  function upgrade(){
    root.querySelectorAll('.exam-card[data-plan]').forEach(upgradeExamCard);
    root.querySelectorAll('.tile[data-lesson]').forEach(upgradeLessonCard);
    root.querySelectorAll('.journey-stop').forEach(upgradeJourneyRow);
  }

  const observer=new MutationObserver(upgrade);
  observer.observe(root,{childList:true,subtree:true});
  upgrade();
}
