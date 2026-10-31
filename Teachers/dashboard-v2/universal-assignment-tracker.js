/* Live, read-only Naesin homework outcomes. Distinguishes completion from accuracy. */
(()=>{'use strict';
const ROOT='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>x?new Date(x).toLocaleDateString('ko-KR'):'—';
const id=x=>String(x||'');
let loading=false,selected='',all=[],scope='my',currentTeacherId='',teacherNames=new Map();
const access=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
async function get(path,options={}){
 let token=access();if(!token)throw Error('Teacher login required');
 const send=t=>fetch(ROOT+path,{...options,headers:{apikey:KEY,Authorization:'Bearer '+t,...(options.headers||{})},cache:'no-store',credentials:'omit'});
 let response=await send(token);
 if(response.status===401){
   try{const r=await (window.WillenaAPI?.fetch?window.WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=refresh',{credentials:'include',cache:'no-store'}):fetch('/.netlify/functions/supabase_auth?action=refresh',{credentials:'include',cache:'no-store'}));const d=await r.json();if(d?.access_token){window.WillenaAPI?.setLocalTokens?.(d.access_token,d.refresh_token||'');response=await send(d.access_token)}}catch(_){}
 }
 const body=await response.json().catch(()=>null);
 if(!response.ok)throw Error(body?.message||body?.error||'Request failed '+response.status);
 return body;
}
async function teacherIdentity(){
 const token=access();if(!token)throw Error('Teacher login required');
 const response=await fetch('https://fiieuiktlsivwfgyivai.supabase.co/auth/v1/user',{headers:{apikey:KEY,Authorization:'Bearer '+token},cache:'no-store'});
 if(!response.ok)throw Error('Could not verify current teacher');
 const me=await response.json();
 if(!me?.id)throw Error('Teacher identity unavailable');
 return id(me.id);
}
async function load(){
 if(loading)return;const host=document.querySelector('#uaProgress');if(!host)return;
 loading=true;host.textContent='Loading homework results…';
 try{
  let groups=window.NaesinV2Data?.getCachedGroups?.()||[];
  if(!groups.length){await window.NaesinV2Data?.loadGroups?.();groups=window.NaesinV2Data?.getCachedGroups?.()||[]}
  const ids=groups.map(x=>id((x.group||x).id)).filter(Boolean);
  if(!ids.length){host.textContent='No exam groups loaded. Refresh exams first.';return}
  currentTeacherId=await teacherIdentity();
  const tasks=await get('test_prep_tasks?select=id,created_at,created_by,group_id,plan_id,student_id,lesson,practice_type,title,target_count,due_at,active,completed_at&active=eq.true&group_id=in.('+ids.join(',')+')&order=created_at.desc&limit=1000');
  const creators=[...new Set(tasks.map(t=>id(t.created_by)).filter(Boolean))];
  teacherNames=new Map();
  if(creators.length){
   try{
    const profiles=await get('profiles?select=id,name,username&id=in.('+creators.join(',')+')');
    profiles.forEach(p=>teacherNames.set(id(p.id),p.name||p.username||'Unknown teacher'));
   }catch(e){console.warn('Teacher names unavailable',e)}
  }
  const data=await get('rpc/test_prep_assignment_results_v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_group_id:null})});
  if(!Array.isArray(data))throw Error('Invalid assignment results response');
  const resultMap=new Map(data.map(r=>[id(r.task_id),r]));
  const names=new Map();
  groups.forEach(item=>(item.members||[]).forEach(m=>{const p=m.student||{};names.set(id(p.id||m.student_id),p.korean_name||p.name||p.username||'Student')}));
  all=tasks.map(t=>{
   const result=resultMap.get(id(t.id));
   const done=result?Number(result.done)||0:0,target=Math.max(1,Number(t.target_count)||10);
   return {...t,name:names.get(id(t.student_id))||id(t.student_id).slice(0,8),done,target,
    correct:result?Number(result.correct)||0:0,wrong:result?Number(result.wrong)||0:0,
    unresolved:result?Number(result.unresolved)||0:0,retries:result?Number(result.retries)||0:0,
    accuracy:result?.accuracy_percent??null,verified:!!result,complete:done>=target};
  });
  render();
 }catch(e){host.innerHTML='<p class="empty">Could not load assignment results: '+esc(e.message)+'</p>'}
 finally{loading=false}
}
function render(){
 const host=document.querySelector('#uaProgress');if(!host)return;
 const groups=window.NaesinV2Data?.getCachedGroups?.()||[],options=groups.map(x=>x.group||x);
 const rows=all.filter(t=>(scope==='all'||(currentTeacherId&&id(t.created_by)===currentTeacherId))&&(!selected||id(t.group_id)===selected));
 const completed=rows.filter(t=>t.complete).length;
 host.innerHTML='<div class="ua-scope-tabs" role="tablist" aria-label="Assignment ownership"><button type="button" role="tab" data-ua-scope="my" aria-selected="'+(scope==='my')+'" class="'+(scope==='my'?'active':'')+'">My</button><button type="button" role="tab" data-ua-scope="all" aria-selected="'+(scope==='all')+'" class="'+(scope==='all'?'active':'')+'">All</button></div><div class="ua-toolbar"><strong>내신 homework results</strong><select class="control" id="uaGroupFilter"><option value="">All exams</option>'+
 options.map(g=>'<option value="'+esc(g.id)+'" '+(id(g.id)===selected?'selected':'')+'>'+esc(g.school||'')+' · '+esc(g.book_label||'')+'</option>').join('')+
 '</select><button class="control" id="uaProgressRefresh">Refresh results</button></div>'+
 '<p class="ua-tracker-summary">'+rows.length+' assignments · '+completed+' completed · Completion is not a score</p>'+
 '<div class="ua-progress-table-wrap"><table class="ua-progress-table"><thead><tr><th>Student</th><th>Assigned by</th><th>Lesson / Skill</th><th>Work completed</th><th>Accuracy</th><th>Correct</th><th>Wrong</th><th>오답 remaining</th><th>Retries</th><th>Due</th></tr></thead><tbody>'+
 rows.map(t=>'<tr><td>'+esc(t.name)+'</td><td>'+esc(teacherNames.get(id(t.created_by))||'Unknown')+'</td><td>'+esc(t.lesson)+'<small>'+esc(t.practice_type)+'</small></td><td><b>'+t.done+'/'+t.target+' questions</b><small>'+(t.complete?'완료':'진행 중')+'</small><div class="ua-track"><i style="width:'+Math.min(100,Math.round(t.done/t.target*100))+'%"></i></div></td><td class="ua-accuracy">'+(t.verified&&t.done?esc(t.accuracy)+'%':'—')+'</td><td>'+t.correct+'/'+t.done+'</td><td>'+t.wrong+'</td><td>'+t.unresolved+'</td><td>'+t.retries+'</td><td>'+esc(fmt(t.due_at))+'</td></tr>').join('')+
 '</tbody></table></div>'+(rows.length?'':'<p class="empty">No assignments found.</p>')+
 '<p class="ua-note">Work completed = distinct questions attempted after assignment creation. Accuracy = correct on the first answer to each question in this assignment (not completion %). Wrong = incorrect first answers; 오답 remaining = still unresolved. Reattempts are shown separately.</p>';
 host.querySelectorAll('[data-ua-scope]').forEach(b=>b.onclick=()=>{scope=b.dataset.uaScope;render()});
 host.querySelector('#uaGroupFilter').onchange=e=>{selected=e.target.value;render()};
 host.querySelector('#uaProgressRefresh').onclick=load;
}
window.UniversalAssignmentTracker={load};
})();