const { createClient } = require('@supabase/supabase-js');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');

const ALLOWED = new Set([
  'https://teachers.willenaenglish.com',
  'https://willenaenglish.com',
  'https://www.willenaenglish.com',
  'https://staging.willenaenglish.com',
  'http://localhost:8888',
  'http://localhost:9000'
]);

function cors(event){
  const origin = event.headers?.origin || event.headers?.Origin || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED.has(origin) ? origin : 'https://teachers.willenaenglish.com',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Cache-Control': 'no-store'
  };
}
function safeKey(text){
  const safe = String(text||'').trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_\-]/g,'');
  return safe ? safe + '.mp3' : '';
}
exports.handler = async (event) => {
  const headers = cors(event);
  if(event.httpMethod==='OPTIONS') return {statusCode:200,headers,body:''};
  if(event.httpMethod!=='GET') return {statusCode:405,headers,body:JSON.stringify({error:'Method not allowed'})};
  try{
    const supabaseUrl=process.env.SUPABASE_URL;
    const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||process.env.SUPABASE_SERVICE_ROLE;
    const bucket=process.env.R2_BUCKET_NAME||process.env.R2_BUCKET||process.env.R2_BUCKETNAME;
    if(!supabaseUrl||!serviceKey||!bucket||!process.env.R2_ENDPOINT||!process.env.R2_ACCESS_KEY_ID||!process.env.R2_SECRET_ACCESS_KEY){
      return {statusCode:500,headers,body:JSON.stringify({error:'Missing server configuration'})};
    }
    const supabase=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
    const s3=new S3Client({region:'auto',endpoint:process.env.R2_ENDPOINT,forcePathStyle:true,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}});
    const rows=[];
    for(let from=0;;from+=1000){
      const {data,error}=await supabase.from('lexical_entries')
        .select('id,canonical_text,translation_ko,entry_type,part_of_speech,status,level_id')
        .eq('status','published')
        .order('canonical_text',{ascending:true})
        .range(from,from+999);
      if(error) throw error;
      rows.push(...(data||[]));
      if(!data||data.length<1000) break;
    }
    const candidates=rows
      .map(r=>({...r,audio_key:safeKey(r.canonical_text)}))
      .filter(r=>r.audio_key);
    let idx=0; const missing=[]; const existing=[]; const concurrency=Math.min(20,candidates.length);
    async function worker(){
      while(idx<candidates.length){
        const item=candidates[idx++];
        try{
          await s3.send(new HeadObjectCommand({Bucket:bucket,Key:item.audio_key}));
          existing.push(item);
        }catch(e){
          missing.push(item);
        }
      }
    }
    await Promise.all(Array.from({length:concurrency},()=>worker()));
    missing.sort((a,b)=>String(a.canonical_text).localeCompare(String(b.canonical_text)));
    return {statusCode:200,headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({
      scanned:candidates.length,
      existing_count:existing.length,
      missing_count:missing.length,
      missing
    })};
  }catch(e){
    return {statusCode:500,headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({error:e.message})};
  }
};