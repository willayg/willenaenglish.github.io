(function(){
'use strict';
const MODEL='gpt-5.6-luna';
function isWilliRequest(data){
  if(!data||String(data.endpoint||'')!=='chat/completions')return false;
  const messages=Array.isArray(data.payload?.messages)?data.payload.messages:[];
  return messages.some(m=>String(m?.content||'').includes("'Willi'"));
}
function rewrite(init){
  if(!init||typeof init.body!=='string')return init;
  try{
    const data=JSON.parse(init.body);
    if(!isWilliRequest(data))return init;
    const payload={...(data.payload||{})};
    payload.model=MODEL;
    payload.reasoning_effort='low';
    if(payload.max_tokens!=null&&payload.max_completion_tokens==null)payload.max_completion_tokens=payload.max_tokens;
    delete payload.max_tokens;
    delete payload.temperature;
    return {...init,body:JSON.stringify({...data,payload})};
  }catch(_){return init}
}
function patch(){
  const api=window.WillenaAPI;
  if(!api||typeof api.fetch!=='function'||api.__williLunaPatched)return false;
  const original=api.fetch.bind(api);
  api.fetch=function(input,init){return original(input,rewrite(init))};
  api.__williLunaPatched=true;
  console.info('[Test Prep students] Willi model adapter active — gpt-5.6-luna / low reasoning');
  return true;
}
function boot(){
  if(patch())return;
  let tries=0;
  const timer=setInterval(()=>{if(patch()||++tries>300)clearInterval(timer)},20);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();