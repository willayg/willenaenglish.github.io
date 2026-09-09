const DEFAULT_MODEL='gpt-5.6-luna';
const DEFAULT_TIMEOUT_MS=15000;

function fetcher(){
  return window.WillenaAPI&&typeof window.WillenaAPI.fetch==='function'
    ?window.WillenaAPI.fetch.bind(window.WillenaAPI)
    :fetch;
}

function extractText(payload){
  const data=payload?.data||payload;
  return String(data?.choices?.[0]?.message?.content||payload?.result||'').trim();
}

export async function callAiWilli({
  messages,
  model=DEFAULT_MODEL,
  reasoningEffort='low',
  maxCompletionTokens=500,
  responseFormat=null,
  temperature=null,
  timeoutMs=DEFAULT_TIMEOUT_MS
}={}){
  if(!Array.isArray(messages)||!messages.length)throw new Error('AI_WILLI_MESSAGES_REQUIRED');
  const payload={model,messages,reasoning_effort:reasoningEffort,max_completion_tokens:maxCompletionTokens};
  if(responseFormat)payload.response_format=responseFormat;
  if(temperature!=null)payload.temperature=temperature;
  const body={endpoint:'chat/completions',payload};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetcher()('/.netlify/functions/openai_proxy',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal
    });
    if(!response.ok)throw new Error(`AI_WILLI_HTTP_${response.status}`);
    const json=await response.json(),text=extractText(json);
    if(!text)throw new Error('AI_WILLI_EMPTY_RESPONSE');
    return{text,raw:json,model};
  }finally{clearTimeout(timer)}
}

export function parseAiWilliJson(text){
  const raw=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  return JSON.parse(raw);
}
