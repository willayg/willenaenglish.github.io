const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const BATCH_ID='shimmer-monosyllables-20260927-v2';
const MARKER_KEY='_batches/'+BATCH_ID+'.json';
const MODEL='gpt-4o-mini-tts';
const VOICE='shimmer';
const CHUNK_SIZE=12;
const INSTRUCTIONS='Pronounce this English vocabulary word once, clearly and naturally. Warm, friendly and encouraging tone for a child learning English. Neutral American English. Slightly slower than normal conversation, but do not exaggerate. Do not add any other words or sounds.';

const ALLOWED=new Set([
 'https://teachers.willenaenglish.com',
 'https://willenaenglish.com',
 'https://www.willenaenglish.com',
 'https://staging.willenaenglish.com',
 'https://students.willenaenglish.com'
]);
function cors(event){
 const origin=event.headers?.origin||event.headers?.Origin||'';
 return {
  'Access-Control-Allow-Origin':ALLOWED.has(origin)?origin:'https://teachers.willenaenglish.com',
  'Access-Control-Allow-Methods':'POST,GET,OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type, Authorization',
  'Access-Control-Allow-Credentials':'true',
  'Cache-Control':'no-store'
 };
}
function client(){
 if(!process.env.R2_ENDPOINT||!process.env.R2_ACCESS_KEY_ID||!process.env.R2_SECRET_ACCESS_KEY) throw new Error('Missing R2 credentials');
 return new S3Client({region:'auto',endpoint:process.env.R2_ENDPOINT,forcePathStyle:true,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}});
}
function bucket(){
 const b=process.env.R2_BUCKET_NAME||process.env.R2_BUCKET||process.env.R2_BUCKETNAME;
 if(!b) throw new Error('Missing R2 bucket');
 return b;
}
async function bodyToString(body){const chunks=[];for await(const c of body)chunks.push(Buffer.from(c));return Buffer.concat(chunks).toString('utf8');}
async function readMarker(s3,b){
 try{const x=await s3.send(new GetObjectCommand({Bucket:b,Key:MARKER_KEY}));return JSON.parse(await bodyToString(x.Body));}
 catch(e){return null;}
}
async function saveMarker(s3,b,m){
 m.updated_at=new Date().toISOString();
 await s3.send(new PutObjectCommand({Bucket:b,Key:MARKER_KEY,Body:Buffer.from(JSON.stringify(m,null,2)),ContentType:'application/json',CacheControl:'no-store'}));
}
function keyFor(w){return String(w).trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_\-]/g,'')+'.mp3';}

async function publishedWords(){
 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||process.env.SUPABASE_SERVICE_ROLE;
 if(!url||!key) throw new Error('Missing Supabase server credentials');
 const sb=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const rows=[];
 for(let from=0;;from+=1000){
  const {data,error}=await sb.from('lexical_entries').select('canonical_text,status').eq('status','published').range(from,from+999);
  if(error)throw error;
  rows.push(...(data||[]));
  if(!data||data.length<1000)break;
 }
 return [...new Set(rows.map(r=>String(r.canonical_text||'').trim()).filter(w=>/^[A-Za-z]+$/.test(w)&&w.length>=2))].sort((a,b)=>a.localeCompare(b));
}
async function classify(words){
 const api=process.env.OPENAI_API;
 if(!api)throw new Error('Missing OPENAI_API');
 const out=[];
 for(let i=0;i<words.length;i+=180){
  const chunk=words.slice(i,i+180);
  const resp=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Authorization':'Bearer '+api,'Content-Type':'application/json'},body:JSON.stringify({
   model:'gpt-4o-mini',temperature:0,response_format:{type:'json_object'},
   messages:[
    {role:'system',content:'You are a careful American English pronunciation lexicographer.'},
    {role:'user',content:'Return JSON exactly as {"words":["..."]}. From this list, include every ordinary English token pronounced as exactly ONE syllable in neutral American English. Include diphthongs. Include one-syllable homographs such as read, lead, live, wind, tear, close, use. Exclude abbreviations, obvious proper-name-only items, nonwords, and words normally two or more syllables. Preserve spelling exactly.\n\n'+JSON.stringify(chunk)}
   ]
  })});
  if(!resp.ok)throw new Error('Classification '+resp.status+': '+(await resp.text()).slice(0,500));
  const data=await resp.json();
  const parsed=JSON.parse(data?.choices?.[0]?.message?.content||'{}');
  const allowed=new Set(chunk);
  for(const w of parsed.words||[])if(allowed.has(w))out.push(w);
 }
 return [...new Set(out)].sort((a,b)=>a.localeCompare(b));
}
async function tts(word){
 const resp=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{'Authorization':'Bearer '+process.env.OPENAI_API,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,voice:VOICE,input:word,instructions:INSTRUCTIONS,response_format:'mp3'})});
 if(!resp.ok)throw new Error('TTS '+word+' '+resp.status+': '+(await resp.text()).slice(0,300));
 return Buffer.from(await resp.arrayBuffer());
}
function publicStatus(m){
 return {batch_id:m.batch_id,state:m.state,model:m.model,voice:m.voice,target_count:m.targets?.length||0,completed_count:m.completed?.length||0,failure_count:m.failures?.length||0,failures:m.failures||[],last_chunk:m.last_chunk||[],started_at:m.started_at,updated_at:m.updated_at,finished_at:m.finished_at};
}

exports.handler=async(event)=>{
 const headers=cors(event);
 if(event.httpMethod==='OPTIONS')return{statusCode:200,headers,body:''};
 if(event.httpMethod!=='GET'&&event.httpMethod!=='POST')return{statusCode:405,headers,body:'Method Not Allowed'};
 try{
  const s3=client(), b=bucket();
  let m=await readMarker(s3,b);
  if(event.httpMethod==='GET'){
   return{statusCode:200,headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(m?publicStatus(m):{batch_id:BATCH_ID,state:'not_started'})};
  }
  if(!m){
   m={batch_id:BATCH_ID,state:'preparing',model:MODEL,voice:VOICE,started_at:new Date().toISOString(),completed:[],failures:[],targets:[]};
   await saveMarker(s3,b,m);
   const words=await publishedWords();
   m.targets=await classify(words);
   m.state='ready';
   m.published_single_tokens=words.length;
   await saveMarker(s3,b,m);
  }
  if(m.state==='complete')return{statusCode:200,headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(publicStatus(m))};

  const done=new Set(m.completed||[]);
  const next=(m.targets||[]).filter(w=>!done.has(w)).slice(0,CHUNK_SIZE);
  m.state='running';m.last_chunk=[];
  for(const word of next){
   try{
    const audio=await tts(word);
    await s3.send(new PutObjectCommand({Bucket:b,Key:keyFor(word),Body:audio,ContentType:'audio/mpeg',CacheControl:'public, max-age=300, must-revalidate',Metadata:{tts_provider:'openai',tts_model:MODEL,tts_voice:VOICE,batch_id:BATCH_ID}}));
    m.completed.push(word);
    m.failures=(m.failures||[]).filter(f=>f.word!==word);
    m.last_chunk.push({word,status:'ok'});
   }catch(e){
    m.failures=(m.failures||[]).filter(f=>f.word!==word);
    m.failures.push({word,error:String(e.message||e).slice(0,500)});
    m.last_chunk.push({word,status:'failed',error:String(e.message||e).slice(0,200)});
   }
  }
  const remaining=(m.targets||[]).filter(w=>!(new Set(m.completed||[])).has(w));
  if(!remaining.length){
   m.state=m.failures.length?'complete_with_failures':'complete';
   m.finished_at=new Date().toISOString();
  }
  await saveMarker(s3,b,m);
  return{statusCode:200,headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(publicStatus(m))};
 }catch(e){
  return{statusCode:500,headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({batch_id:BATCH_ID,state:'error',error:String(e.message||e)})};
 }
};