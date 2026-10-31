/* Assignment-only performance: completion and first-answer accuracy stay separate.
   Uses an authenticated, read-only Postgres RPC; no worker or proxy calls. */
const ROOT='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/test_prep_assignment_results_v1';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
let byId=new Map();
let status='pending';
const access=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
async function call(token){return fetch(ROOT,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({p_group_id:null}),credentials:'omit',cache:'no-store'})}
export async function loadAssignmentResults(){
 let token=access();if(!token){status='unavailable';throw Error('Student login required')}
 let response=await call(token);
 if(response.status===401){
   try{const r=await (window.WillenaAPI?.fetch?window.WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=refresh',{credentials:'include',cache:'no-store'}):fetch('/.netlify/functions/supabase_auth?action=refresh',{credentials:'include',cache:'no-store'}));const d=await r.json();if(d?.access_token){window.WillenaAPI?.setLocalTokens?.(d.access_token,d.refresh_token||'');response=await call(d.access_token)}}catch(_){}
 }
 const data=await response.json().catch(()=>null);
 if(!response.ok||!Array.isArray(data)){status='unavailable';throw Error(data?.message||data?.error||'Could not load assignment results')}
 byId=new Map(data.map(r=>[String(r.task_id),r]));status='ready';
 return byId;
}
export function assignmentMetrics(task){
 const saved=byId.get(String(task?.id)),basic=task?.progress||{};
 const target=Math.max(1,Number(saved?.target)||Number(basic.target)||Number(task?.target_count)||10);
 const done=Math.max(0,Number(saved?.done??basic.done)||0);
 const complete=done>=target&&(saved?Number(saved.unresolved||0)===0:basic.complete===true);
 const verified=!!saved;
 const correct=verified?Number(saved.correct)||0:null;
 const wrong=verified?Number(saved.wrong)||0:null;
 const unresolved=verified?Number(saved.unresolved)||0:null;
 const accuracy=verified&&done>0?Number(saved.accuracy_percent):null;
 const due=task?.due_at?new Date(task.due_at).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'}):'';
 return{done,target,complete,verified,correct,wrong,unresolved,accuracy,due,
   statusLabel:complete?'완료':(done>=target?'오답 복습 필요':'진행 중'),
   resultLabel:verified?(done?('정답 '+correct+'/'+done+' · 정확도 '+accuracy+'% · 오답 '+wrong+' (미해결 '+unresolved+')'):'아직 풀이 없음'):(status==='unavailable'?'정확도 불러오기 실패':'정확도 확인 중')};
}
