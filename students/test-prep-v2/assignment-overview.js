import {assignmentMetrics} from './assignment-results.js?v=2.25.180';

// One dedicated basket for all active homework, never mixed with lesson practice cards.
export function assignmentOverview(plans,esc){
 const tasks=(plans||[]).flatMap(plan=>(plan.tasks||[]).filter(t=>t.active!==false).map(task=>({plan,task})))
   .sort((a,b)=>String(a.task.due_at||'9999').localeCompare(String(b.task.due_at||'9999')));
 if(!tasks.length)return '';
 const safe=esc||((x)=>String(x??''));
 const pending=tasks.filter(({task})=>!assignmentMetrics(task).complete).length;
 return '<section class="homework-basket" aria-label="Homework Basket">'+
  '<div class="homework-basket-head"><span class="homework-basket-icon" aria-hidden="true">▤</span><div><span class="homework-basket-eyebrow">MY HOMEWORK</span><h2>숙제 바구니 <span>Homework Basket</span></h2><p>선생님이 낸 숙제는 모두 여기에 있어요.</p></div><span class="homework-basket-count">'+pending+'개 남음</span></div>'+
  '<div class="homework-basket-list">'+tasks.map(({plan,task:t})=>{
    const m=assignmentMetrics(t),due=t.due_at?new Date(t.due_at).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'}):'';
    const done=m.complete;
    const completion=done?100:Math.max(0,Math.min(99,Math.round(Number(t.progress?.final_completion_percent??t.progress?.percent??(m.done/m.target*100))||0)));
    const accuracy=t.progress?.overall_accuracy_percent;
    return '<button type="button" class="homework-basket-card '+(done?'gold':'')+'" data-home-task="'+safe(t.id)+'" data-home-plan="'+safe(plan.id)+'">'+
      '<span class="homework-basket-card-main"><span class="homework-basket-type">'+safe(t.practice_type||'내신')+(done?' · ★ GOLD':'')+'</span>'+
      '<strong>'+safe(t.title||t.lesson||'내신 과제')+'</strong>'+
      '<small>'+safe(plan.book_label||'')+(due?' · 마감 '+safe(due):'')+'</small>'+
      '<span class="homework-basket-metrics">최종 완료 '+completion+'% · 전체 정확도 '+(accuracy==null?'—':safe(Math.round(Number(accuracy)))+'%')+'</span></span>'+
      '<span class="homework-basket-status">'+(done?'★ 완료':'→ 계속하기')+'</span></button>';
  }).join('')+'</div></section>';
}
