import { SCRIPT_LINES } from './listening-tts-manifest.js';
const ORIGINS=new Set(['https://teachers.willenaenglish.com','https://willenaenglish.com','https://www.willenaenglish.com']);
const VOICES={boy:'onyx',girl:'shimmer',narrator:'shimmer'};
const error=(status,msg)=>new Response(JSON.stringify({error:msg}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function onRequestPost({request,env}){
  const origin=request.headers.get('Origin');
  if(origin&&!ORIGINS.has(origin))return error(403,'Origin not permitted');
  if(!env.AUDIO_BUCKET)return error(503,'Listening audio storage unavailable');
  const secret=env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY;
  if(!secret)return error(503,'OpenAI speech service not configured');
  if(Number(request.headers.get('content-length')||0)>2048)return error(413,'Request too large');
  let body;try{body=await request.json()}catch{return error(400,'Invalid request')}
  const indices=[body.book,body.section,body.item,body.segment];
  if(indices.some(v=>!Number.isInteger(v)||v<0))return error(400,'Invalid index');
  const [book,section,item,segment]=indices;
  const line=SCRIPT_LINES[book]?.[section]?.[item]?.[segment];
  if(!line)return error(404,'Unknown script line');
  const voice=VOICES[line.speaker];
  if(!voice)return error(400,'Unsupported voice');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('v1\n'+voice+'\n'+line.text)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const key='listening/2026-10/'+hash+'.mp3';
  const headers={'Content-Type':'audio/mpeg','Cache-Control':'public,max-age=86400','X-Content-Type-Options':'nosniff'};
  const cached=await env.AUDIO_BUCKET.get(key);
  if(cached)return new Response(cached.body,{headers:{...headers,'X-Audio-Source':'r2'}});
  // No OpenAI calls are allowed without the daily quota binding.
  if(!env.LISTENING_RATE_LIMIT)return error(503,'Listening generation quota is not configured');
  const ip=request.headers.get('CF-Connecting-IP')||'unknown';
  const today=new Date().toISOString().slice(0,10);
  const rateKey='listening:tts:'+today+':'+ip;
  const used=Number(await env.LISTENING_RATE_LIMIT.get(rateKey)||0);
  if(used>=40)return error(429,'Daily audio generation limit reached');
  await env.LISTENING_RATE_LIMIT.put(rateKey,String(used+1),{expirationTtl:86400});
  const instructions=line.speaker==='boy'?'Speak this boy dialogue in a natural, clear adult masculine American English voice. Do not say the speaker label or add words.':line.speaker==='girl'?'Speak this girl dialogue in a natural, clear adult feminine American English voice. Do not say the speaker label or add words.':'Read this listening-test text clearly and naturally for English learners. Do not add words.';
  let result;try{result=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4o-mini-tts',voice,input:line.text,instructions,response_format:'mp3'})})}catch{return error(502,'OpenAI speech unavailable')}
  if(!result.ok)return error(502,'OpenAI speech unavailable');
  const data=await result.arrayBuffer();
  if(data.byteLength<100||data.byteLength>4000000)return error(502,'Invalid generated audio');
  await env.AUDIO_BUCKET.put(key,data,{httpMetadata:{contentType:'audio/mpeg',cacheControl:'public,max-age=86400'}});
  return new Response(data,{headers:{...headers,'X-Audio-Source':'generated'}});
}
export async function onRequestOptions({request}){const origin=request.headers.get('Origin');if(origin&&!ORIGINS.has(origin))return error(403,'Origin not permitted');return new Response(null,{status:204,headers:{Allow:'POST, OPTIONS'}})}
