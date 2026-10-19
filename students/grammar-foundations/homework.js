/* Student Grammar Foundations homework feed; uses existing stage progress for completion. */
const URL='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/grammar_foundation_homework';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
export async function fetchGrammarHomework(getToken,refreshToken){
 let access=getToken()||await refreshToken();
 if(!access)throw Error('Not signed in');
 const run=t=>fetch(URL+'?select=id,class_name,module_id,stage_id,module_title,stage_title,completion_percent,due_at,batch_id&active=eq.true&order=due_at.asc&limit=300',{
 headers:{apikey:KEY,Authorization:'Bearer '+t},cache:'no-store'});
 let response=await run(access);if(response.status===401){access=await refreshToken();response=await run(access)}
 const rows=await response.json().catch(()=>[]);
 if(!response.ok)throw Error(rows?.message||rows?.error||'Homework unavailable');
 return Array.isArray(rows)?rows:[];
}
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function homeworkCards(homeworks,progress){
 if(!homeworks.length)return '';
 const cards=homeworks.map(h=>{
  const p=progress.get(String(h.module_id)+':'+String(h.stage_id));
  const percentage=p?.total>0?Math.min(100,Math.round(100*Number(p.best_score||0)/p.total)):0;
  const done=p?.total>0&&percentage>=Number(h.completion_percent);
  const due=new Date(h.due_at).toLocaleDateString('en-US',{month:'short',day:'numeric'});
  return '<button type="button" class="gf-homework-card'+(done?' gf-homework-done':'')+'" data-homework-module="'+escape(h.module_id)+'" data-homework-stage="'+escape(h.stage_id)+'"><span><strong>'+escape(h.module_title)+'</strong><small>'+escape(h.stage_title)+' · '+(h.completion_percent===100?'Gold 100%':'Pass 80%')+' · Due '+escape(due)+'</small></span><span class="gf-homework-result">'+(done?'✓ Done':percentage+'%')+'</span></button>';
 }).join('');
 const completed=homeworks.filter(h=>{const p=progress.get(h.module_id+':'+h.stage_id);return p?.total>0&&100*Number(p.best_score||0)>=Number(h.completion_percent)*p.total}).length;
 return '<section class="gf-homework" aria-label="Assigned grammar homework"><div class="gf-homework-head"><div><div class="gf-kicker">TEACHER ASSIGNMENTS</div><h2>My Homework</h2></div><span>'+completed+'/'+homeworks.length+' complete</span></div><div class="gf-homework-list">'+cards+'</div></section>';
}
