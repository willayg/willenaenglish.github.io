import { SCRIPT_LINES } from './listening-tts-manifest.js';
const ORIGINS=new Set(['https://teachers.willenaenglish.com','https://willenaenglish.com','https://www.willenaenglish.com']);
const VOICES={boy:'onyx',girl:'shimmer',narrator:'shimmer',number:'alloy'};
const error=(status,msg)=>new Response(JSON.stringify({error:msg}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function onRequestPost({request,env}){
  const origin=request.headers.get('Origin');
  if(origin&&!ORIGINS.has(origin))return error(403,'Origin not permitted');
  const secret=env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY;
  if(!secret)return error(503,'OpenAI speech service not configured');
  if(Number(request.headers.get('content-length')||0)>2048)return error(413,'Request too large');
  let body;try{body=await request.json()}catch{return error(400,'Invalid request')}
  const indices=[body.book,body.section,body.item,body.segment];
  if(indices.some((v,i)=>!Number.isInteger(v)||(i===3?v< -1:v<0)))return error(400,'Invalid index');
  const precache=body.precache===true;
  if(precache)return error(409,'Bulk preparation is handled separately; live playback is unchanged');
  const [book,section,item,segment]=indices;
  const scriptItem=SCRIPT_LINES[book]?.[section]?.[item];
  if(!scriptItem)return error(404,'Unknown script item');
  const number=section===1&&book===6?item+5:item+1;
  const line=segment===-1?{speaker:'number',text:'Number '+number+'.'}:scriptItem[segment];
  if(!line)return error(404,'Unknown script line');
  const voice=VOICES[line.speaker];
  if(!voice)return error(400,'Unsupported voice');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('v2-kidfriendly\n'+voice+'\n'+line.text)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const key='listening/2026-10/'+hash+'.mp3';
  const headers={'Content-Type':'audio/mpeg','Cache-Control':'public,max-age=86400','X-Content-Type-Options':'nosniff'};
  if(env.AUDIO_BUCKET){try{const cached=await env.AUDIO_BUCKET.get(key);if(cached)return precache?Response.json({status:'stored'}):new Response(cached.body,{headers:{...headers,'X-Audio-Source':'r2'}})}catch(e){console.warn('[listening-tts] R2 read failed',e?.name)}}
  const edgeCache=typeof caches!=='undefined'?caches.default:null;
  const cacheRequest=new Request(new URL('/_listening_cached_audio/'+hash+'.mp3',request.url).toString(),{method:'GET'});
  if(edgeCache&&!precache){try{const hit=await edgeCache.match(cacheRequest);if(hit)return hit}catch(e){console.warn('[listening-tts] Cache lookup failed',e?.name)}}
  // KV quota is optional; the fixed script allowlist prevents arbitrary input.
  const ip=request.headers.get('CF-Connecting-IP')||'unknown';
  const today=new Date().toISOString().slice(0,10);
  const rateKey='listening:tts:'+today+':'+ip;
  if(env.LISTENING_RATE_LIMIT){try{const used=Number(await env.LISTENING_RATE_LIMIT.get(rateKey)||0);if(used>=40)return error(429,'Daily audio generation limit reached');await env.LISTENING_RATE_LIMIT.put(rateKey,String(used+1),{expirationTtl:86400})}catch(e){console.warn('[listening-tts] Quota store unavailable',e?.name)}}
  const instructions=line.speaker==='number'?'Announce the question number clearly in a calm, neutral American English voice. Speak only the supplied words, with a small pause afterward.':line.speaker==='boy'?'Speak in a bright, warm, friendly American masculine voice suitable for an elementary-school listening test. Sound cheerful and encouraging, with natural conversational energy, clear articulation and a gentle smile in the voice. Keep a natural pace, not exaggerated or cartoonish. Speak only the supplied dialogue; do not say speaker labels or add words.':line.speaker==='girl'?'Speak in a bright, warm, friendly American feminine voice suitable for an elementary-school listening test. Sound cheerful and encouraging, with natural conversational energy, clear articulation and a gentle smile in the voice. Keep a natural pace, not exaggerated or cartoonish. Speak only the supplied dialogue; do not say speaker labels or add words.':'Read this listening-test text in a warm, upbeat, friendly American English voice for elementary-school learners. Use clear articulation, a lightly cheerful tone, and natural expression without rushing or becoming theatrical. Speak only the supplied text; do not add words.';
  let result;try{result=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4o-mini-tts',voice,input:line.text,instructions,response_format:'mp3'})})}catch{return error(502,'OpenAI speech unavailable')}
  if(!result.ok)return error(502,'OpenAI speech unavailable');
  const data=await result.arrayBuffer();
  if(data.byteLength<100||data.byteLength>4000000)return error(502,'Invalid generated audio');
  if(env.AUDIO_BUCKET){try{await env.AUDIO_BUCKET.put(key,data,{httpMetadata:{contentType:'audio/mpeg',cacheControl:'public,max-age=2592000'}})}catch(e){console.warn('[listening-tts] R2 write failed',e?.name);if(precache)return error(503,'R2 write failed')}}
  if(edgeCache){try{await edgeCache.put(cacheRequest,new Response(data.slice(0),{headers:{'Content-Type':'audio/mpeg','Cache-Control':'public,max-age=2592000'}}))}catch(e){console.warn('[listening-tts] Cache write failed',e?.name)}}
  if(precache)return Response.json({status:'generated'});
  return new Response(data,{headers:{...headers,'X-Audio-Source':'generated'}});
}
export async function onRequestOptions({request}){const origin=request.headers.get('Origin');if(origin&&!ORIGINS.has(origin))return error(403,'Origin not permitted');return new Response(null,{status:204,headers:{Allow:'POST, OPTIONS'}})}
