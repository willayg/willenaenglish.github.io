import {assignmentMetrics} from './assignment-results.js?v=2.25.183';

// A single student-owned basket shared across non-activity overview screens.
export function assignmentOverview(plans,esc,expanded=true,archivedIds=new Set(),tab='active'){
 const tasks=(plans||[]).flatMap(plan=>(plan.tasks||[]).filter(t=>t.active!==false).map(task=>({plan,task})))
  .sort((a,b)=>Date.parse(b.task.created_at||0)-Date.parse(a.task.created_at||0));
 if(!tasks.length)return '';
 const safe=esc||((x)=>String(x??''));
 const archive=tasks.filter(({task})=>archivedIds.has(String(task.id)));
 const live=tasks.filter(({task})=>!archivedIds.has(String(task.id)));
 const pending=live.filter(({task})=>!assignmentMetrics(task).complete).length;
 const visible=tab==='archive'?archive:live;
 return '<section class="homework-basket" aria-label="미션함">'+
 '<button type="button" class="homework-basket-head" data-basket-toggle aria-expanded="'+(expanded?'true':'false')+'"><span class="homework-basket-icon" aria-hidden="true">🎯</span><div><h2>미션함</h2></div><span class="homework-basket-count">'+pending+'개 남음</span><span class="homework-basket-chevron">'+(expanded?'▾':'▸')+'</span></button>'+
 '<div class="homework-basket-content" '+(expanded?'':'hidden')+'><div class="homework-basket-tabs" role="tablist" aria-label="미션 상태">'+
 '<button type="button" role="tab" data-basket-tab="active" aria-selected="'+(tab==='active')+'">진행 중 <b>'+live.length+'</b></button>'+
 '<button type="button" role="tab" data-basket-tab="archive" aria-selected="'+(tab==='archive')+'">보관함 <b>'+archive.length+'</b></button></div>'+
 '<div class="homework-basket-list">'+(visible.length?visible.map(({plan,task:t})=>{
   const m=assignmentMetrics(t),due=t.due_at?new Date(t.due_at).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'}):'';
   const done=m.complete,archived=archivedIds.has(String(t.id));
   const completion=done?100:Math.max(0,Math.min(99,Math.round(Number(t.progress?.final_completion_percent??t.progress?.percent??(m.done/m.target*100))||0)));
   const accuracy=t.progress?.overall_accuracy_percent;
   return '<button type="button" class="homework-basket-card '+(done?'gold':'')+'" data-home-task="'+safe(t.id)+'" data-home-plan="'+safe(plan.id)+'" data-home-gold="'+(done?'1':'0')+'" data-home-archived="'+(archived?'1':'0')+'">'+
     '<span class="homework-basket-card-main"><span class="homework-basket-type">'+safe(t.practice_type||'내신')+(done?' · ★ GOLD':'')+'</span>'+
     '<strong>'+safe(t.title||t.lesson||'내신 과제')+'</strong>'+
     '<small>'+safe(plan.book_label||'')+(due?' · 마감 '+safe(due):'')+'</small></span>'+
     '<span class="homework-basket-scores"><span class="homework-basket-score"><b>'+completion+'%</b><small>최종 완료</small></span>'+
     '<span class="homework-basket-score accuracy"><b>'+(accuracy==null?'—':safe(Math.round(Number(accuracy)))+'%')+'</b><small>전체 정확도</small></span></span></button>';
 }).join(''):'<div class="homework-basket-empty">'+(tab==='archive'?'아직 보관한 골드 카드가 없어요.':'모든 숙제를 보관했어요!')+'</div>')+'</div></div></section>';
}
