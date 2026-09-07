(function(){
'use strict';
function relabel(root=document){const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const n of nodes){const p=n.parentElement;if(!p||['SCRIPT','STYLE','TEXTAREA','INPUT'].includes(p.tagName))continue;const t=n.nodeValue;if(!t||!t.includes('Sentences'))continue;n.nodeValue=t.replace(/\bSentences\b/g,'본문 Unscramble')}}
function numberFromPercent(v){const m=String(v||'').match(/(-?\d+(?:\.\d+)?)\s*%/);return m?Number(m[1]):null}
function doneFromFraction(v){const m=String(v||'').match(/(\d+)\s*\/\s*(\d+)/);return m?Number(m[1]):null}
function testPrepMastery(completion,accuracy,done){const c=Number(completion)||0;if(!(Number(done)>0))return 0;const a=accuracy==null?c:Number(accuracy)||0;return Math.max(0,Math.min(100,Math.round(c*.65+a*.35)))}
function syncLessonMastery(root=document){
  root.querySelectorAll?.('.na-tj-stop').forEach(row=>{
    const completionEl=row.querySelector('.na-tj-completion b'),fractionEl=row.querySelector('.na-tj-completion .na-tj-fraction'),allEl=row.querySelector('.na-tj-alltime b'),middle=row.querySelector('.na-tj-recent');
    if(!completionEl||!middle)return;
    const completion=numberFromPercent(completionEl.textContent)??0,done=doneFromFraction(fractionEl?.textContent),accuracy=numberFromPercent(allEl?.textContent),mastery=testPrepMastery(completion,accuracy,done);
    const value=middle.querySelector('b'),parts=middle.querySelectorAll('small');
    if(value&&value.textContent!==`${mastery}%`)value.textContent=`${mastery}%`;
    if(parts[0]&&parts[0].textContent!=='학생 앱과 동일')parts[0].textContent='학생 앱과 동일';
    if(parts[1]&&parts[1].textContent!=='숙련도')parts[1].textContent='숙련도';
  });
  const lessonView=root.querySelector?.('.na-diag-view[data-view="lesson"]');
  if(!lessonView)return;
  const kpis=lessonView.querySelectorAll('.na-tj-kpi');
  if(kpis.length>=3){
    const completion=numberFromPercent(kpis[0].querySelector('b')?.textContent)??0,done=doneFromFraction(kpis[0].querySelector('span')?.textContent),accuracy=numberFromPercent(kpis[2].querySelector('b')?.textContent),mastery=testPrepMastery(completion,accuracy,done);
    const value=kpis[1].querySelector('b'),label=kpis[1].querySelector('span');
    if(value&&value.textContent!==`${mastery}%`)value.textContent=`${mastery}%`;
    if(label&&label.textContent!=='숙련도 · 학생 앱과 동일')label.textContent='숙련도 · 학생 앱과 동일';
  }
  const head=lessonView.querySelector('.na-tj-head p');
  if(head&&head.textContent.includes('최근 정확도'))head.textContent='완료율 · 학생 앱과 같은 숙련도 · 전체 정확도를 함께 표시합니다.';
  const note=lessonView.querySelector('.na-tj-source-note');
  if(note&&note.textContent.includes('최근 정확도'))note.textContent='숙련도는 학생 Test Prep과 같은 공식(완료율 65% + 정확도 35%)으로 계산합니다. 학습을 시작하지 않은 활동은 0%입니다.';
}
let raf=0;function scan(){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{relabel(document.body);syncLessonMastery(document)})}
function boot(){scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true,characterData:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();