const fetch = require('node-fetch');
const { S3Client, HeadObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const ALLOWED = new Set([
  'https://teachers.willenaenglish.com',
  'https://willenaenglish.com',
  'https://www.willenaenglish.com',
  'https://staging.willenaenglish.com',
  'http://localhost:8888',
  'http://localhost:9000'
]);
function cors(event){
  const origin=event.headers?.origin||event.headers?.Origin||'';
  return {
    'Access-Control-Allow-Origin':ALLOWED.has(origin)?origin:'https://teachers.willenaenglish.com',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type, Authorization',
    'Access-Control-Allow-Credentials':'true',
    'Cache-Control':'no-store'
  };
}
function safeKey(text){
  const safe=String(text||'').trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_\-]/g,'');
  return safe?safe+'.mp3':'';
}
function s3(){
  return new S3Client({region:'auto',endpoint:process.env.R2_ENDPOINT,forcePathStyle:true,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}});
}
async function openai(text){
  const resp=await fetch('https://api.openai.com/v1/audio/speech',{
    method:'POST',
    headers:{'Authorization':'Bearer '+process.env.OPENAI_API,'Content-Type':'application/json'},
    body:JSON.stringify({
      model:'gpt-4o-mini-tts',
      voice:'shimmer',
      input:text,
      instructions:'Read this English vocabulary item exactly as written. Warm, friendly, clear neutral American English for a child learning English. Do not add any other words or sounds.',
      response_format:'mp3'
    })
  });
  if(!resp.ok) throw new Error('OpenAI '+resp.status+': '+(await resp.text()).slice(0,300));
  return Buffer.from(await resp.arrayBuffer());
}
async function eleven(text){
  const voiceId=process.env.ELEVEN_LABS_DEFAULT_VOICE_ID;
  const payload={text,model_id:'eleven_multilingual_v2',voice_settings:{stability:1,similarity_boost:1,style:0,use_speaker_boost:false}};
  const url='https://api.elevenlabs.io/v1/text-to-speech/'+encodeURIComponent(voiceId);
  const resp=await fetch(url,{method:'POST',headers:{'xi-api-key':process.env.ELEVEN_LABS_API_KEY,'Content-Type':'application/json','Accept':'audio/mpeg'},body:JSON.stringify(payload)});
  if(!resp.ok) throw new Error('ElevenLabs '+resp.status+': '+(await resp.text()).slice(0,300));
  return Buffer.from(await resp.arrayBuffer());
}
exports.handler=async(event)=>{
  const headers=cors(event);
  if(event.httpMethod==='OPTIONS') return {statusCode:200,headers,body:''};
  if(event.httpMethod!=='POST') return {statusCode:405,headers,body:JSON.stringify({error:'Method not allowed'})};
  const origin=event.headers?.origin||event.headers?.Origin||'';
  if(!ALLOWED.has(origin)) return {statusCode:403,headers,body:JSON.stringify({error:'Forbidden origin'})};
  try{
    const body=JSON.parse(event.body||'{}');
    const text=String(body.text||'').trim();
    const provider=body.provider==='eleven'?'eleven':'openai';
    const overwrite=body.overwrite===true;
    if(!text) return {statusCode:400,headers,body:JSON.stringify({error:'Missing text'})};
    const key=safeKey(text);
    if(!key) return {statusCode:400,headers,body:JSON.stringify({error:'Invalid audio key'})};
    const bucket=process.env.R2_BUCKET_NAME||process.env.R2_BUCKET||process.env.R2_BUCKETNAME;
    const client=s3();
    let exists=false;
    try{await client.send(new HeadObjectCommand({Bucket:bucket,Key:key}));exists=true;}catch(e){}
    if(exists&&!overwrite) return {statusCode:409,headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({error:'Audio already exists',key})};
    const audio=provider==='eleven'?await eleven(text):await openai(text);
    await client.send(new PutObjectCommand({
      Bucket:bucket,Key:key,Body:audio,ContentType:'audio/mpeg',CacheControl:'public, max-age=300, must-revalidate',
      Metadata:{tts_provider:provider,tts_model:provider==='openai'?'gpt-4o-mini-tts':'eleven_multilingual_v2',tts_voice:provider==='openai'?'shimmer':'default'}
    }));
    return {statusCode:200,headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({success:true,text,provider,key,overwrote:exists})};
  }catch(e){
    return {statusCode:500,headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({error:e.message})};
  }
};