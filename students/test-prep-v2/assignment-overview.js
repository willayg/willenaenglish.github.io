import {assignmentMetrics} from './assignment-results.js?v=2';
// Student assignment list: completion is NOT a test score.
export function assignmentOverview(plans,esc){
 const tasks=(plans||[]).flatMap(p=>(p.tasks||[]).filter(t=>t.active!==false).map(t=>({plan:p,task:t})));
 if(!tasks.length)return '';
 const safe=esc||((x)=>String(x??''));
 return '<section class="assignment-section" aria-label="Teacher homework"><div class="assignment-section-title"><h3>선생님 과제</h3><span>'+tasks.length+'개</span></div><div class="assignment-list">'+tasks.map(({plan,task:t})=>{
  const m=assignmentMetrics(t);
  const due=t.due_at?new Date(t.due_at).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'}):'';
  return '<button type="button" class="assignment-card '+(m.complete?'done':'')+'" data-home-task="'+safe(t.id)+'" data-home-plan="'+safe(plan.id)+'"><span class="assignment-main"><span class="assignment-kicker"><span>선생님 과제 · '+safe(t.practice_type||'')+'</span></span><strong class="assignment-title">'+safe(t.title||t.lesson||'내신 과제')+'</strong><span class="assignment-meta">'+safe(plan.book_label||'')+(due?' · 마감 '+safe(due):'')+'</span><span class="assignment-result-breakdown">'+safe(m.resultLabel)+'</span></span><span class="assignment-progress"><strong>'+safe(m.statusLabel)+'</strong><small>'+m.done+'/'+m.target+'문항 풀이</small></span></button>';
 }).join('')+'</div></section>';
}
