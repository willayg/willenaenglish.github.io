// Sentence Genius live unit homework. JWT-scoped RPC; no client-side grading writes.
const OP='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/sg_homework_student_v3';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
async function token(refresh=false){
  const current=window.WillenaAPI?.getLocalAccessToken?.();
  if(current&&!refresh)return current;
  const url='/.netlify/functions/supabase_auth?action=refresh';
  const response=await (window.WillenaAPI?.fetch?window.WillenaAPI.fetch(url):
    fetch(url,{credentials:'include'}));
  const body=await response.json().catch(()=>({}));
  if(!response.ok||!body.access_token)throw Error('Student login expired');
  window.WillenaAPI?.setLocalTokens?.(body.access_token,body.refresh_token||'');
  return body.access_token;
}
export async function loadSentenceHomework(){
  const call=jwt=>fetch(OP,{method:'POST',cache:'no-store',
    headers:{apikey:KEY,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},
    body:'{}'});
  let response=await call(await token());
  if(response.status===401)response=await call(await token(true));
  const body=await response.json().catch(()=>({}));
  if(!response.ok||body.success!==true)throw Error(body.message||body.error||
    'Sentence Genius homework unavailable ('+response.status+')');
  // The student RPC already filters active homework and omits the `active` field.
  // Do not drop valid rows just because that optional field is absent.
  return (Array.isArray(body.assignments)?body.assignments:[]).filter(row=>row.active!==false);
}

export async function recordSentenceHomeworkAnswer({assignmentId,sentenceId,mode,sessionId,correct}){
 const auth=await token();
 const response=await fetch('https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/record_sentence_genius_homework_answer_v1',{
  method:'POST',cache:'no-store',
  headers:{apikey:KEY,Authorization:'Bearer '+auth,'Content-Type':'application/json'},
  body:JSON.stringify({p_assignment_id:assignmentId,p_sentence_id:sentenceId,p_mode:mode,p_session_id:sessionId,p_correct:!!correct})
 });
 const body=await response.json().catch(()=>null);
 if(!response.ok||body?.success!==true)throw Error(body?.message||body?.reason||'Homework answer not saved');
 return body;
}
