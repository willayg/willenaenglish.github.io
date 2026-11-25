// Canonical class-to-textbook assignment lookup shared by Word Genius and Free Talking Genius.
// Returns the original RPC response so existing Word Genius cache and loading logic stay intact.
const OP_URL='https://fiieuiktlsivwfgyivai.supabase.co';
const OP_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
export async function fetchClassBookAssignments(className){
  if(!String(className||'').trim())throw new Error('No active class is assigned.');
  const r=await fetch(OP_URL+'/rest/v1/rpc/get_study_assignment_for_class',{
    method:'POST',headers:{apikey:OP_KEY,Authorization:'Bearer '+OP_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({p_class_name:className}),cache:'no-store'
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.success)throw new Error(d.error||'Could not load assigned books.');
  return d;
}
export function extractClassBookAssignments(data){
  return (Array.isArray(data?.assignments)&&data.assignments.length
    ?data.assignments:(data?.assignment?[data.assignment]:[]))
    .filter(row=>row?.book_id);
}
