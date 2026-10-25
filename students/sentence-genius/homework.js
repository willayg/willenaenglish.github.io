// Sentence Genius live unit homework. JWT-scoped RPC; no client-side grading writes.
const OP='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/sg_homework_list_v1';
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
    body:JSON.stringify({p_history:false})});
  let response=await call(await token());
  if(response.status===401)response=await call(await token(true));
  const body=await response.json().catch(()=>({}));
  if(!response.ok||body.success!==true)throw Error(body.message||body.error||
    'Sentence Genius homework unavailable ('+response.status+')');
  return (Array.isArray(body.assignments)?body.assignments:[]).filter(row=>row.active);
}
