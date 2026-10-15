// Student-facing overview for tasks already supplied by the test-prep student API.
// No extra API calls or backend dependencies.
export function assignmentOverview(plans,esc){
 const tasks=(plans||[]).flatMap(p=>(p.tasks||[]).filter(t=>t.active!==false).map(t=>({plan:p,task:t})));
 if(!tasks.length)return '';
 const safe=esc||((x)=>String(x??''));
 return '<section class="assignment-section" aria-label="Teacher homework"><div class="assignment-section-title"><h3>선생님 과제</h3><span>'+tasks.length+'개</span></div><div class="assignment-list">'+tasks.map(({plan,task:t})=>{
 const done=Math.max(0,Number(t.progress?.done)||0),target=Math.max(1,Number(t.progress?.target)||Number(t.target_count)||10);
 const pct=Math.min(100,Math.round(done/target*100));
 const due=t.due_at?new Date(t.due_at).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'}):'';
 return '<button type="button" class="assignment-card '+(pct>=100?'done':'')+'" data-home-task="'+safe(t.id)+'" data-home-plan="'+safe(plan.id)+'"><span class="assignment-main"><span class="assignment-kicker">선생님 과제 · '+safe(t.practice_type||'')+'</span><strong class="assignment-title">'+safe(t.title||t.lesson||'내신 과제')+'</strong><span class="assignment-meta">'+safe(plan.book_label||'')+(due?' · 마감 '+safe(due):'')+'</span></span><span class="assignment-progress"><strong>'+done+'/'+target+'</strong><small>'+pct+'%</small></span></button>';
 }).join('')+'</div></section>';
}
