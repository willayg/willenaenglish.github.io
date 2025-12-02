const { S3Client, HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

/*
POST body: { sentence_ids:["uuid",...], plain?:false }
Returns: { success:true, results:{ <id>:{ exists,true,url } | { exists:false } } }
If plain=true and R2_PUBLIC_BASE set, returns direct URLs instead of signed URLs.
*/
exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'POST, OPTIONS' };
  if (event.httpMethod === 'OPTIONS') return { statusCode:204, headers:cors, body:'' };
  if (event.httpMethod !== 'POST') return { statusCode:405, headers:cors, body: JSON.stringify({ error:'Method not allowed' }) };
  try {
    const body = JSON.parse(event.body||'{}');
    const ids = Array.isArray(body.sentence_ids) ? body.sentence_ids.filter(x=> typeof x === 'string' && x.length) : [];
    if(!ids.length) return { statusCode:400, headers:cors, body: JSON.stringify({ error:'No sentence_ids' }) };
    const plain = !!body.plain;
    const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
    const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
    const R2_ENDPOINT = process.env.R2_ENDPOINT;
    const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || process.env.R2_BUCKETNAME;
    const R2_PUBLIC_BASE = process.env.R2_PUBLIC_BASE || process.env.R2_PUBLIC_URL || '';
    if(!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET_NAME){
      return { statusCode:500, headers:cors, body: JSON.stringify({ error:'Missing R2 env vars' }) };
    }
    const s3 = new S3Client({ region:'auto', endpoint:R2_ENDPOINT, forcePathStyle:true, credentials:{ accessKeyId:R2_ACCESS_KEY_ID, secretAccessKey:R2_SECRET_ACCESS_KEY } });
    const results = {};
    let i=0; const conc = Math.min(8, ids.length);
    async function worker(){
      while(i<ids.length){
        const idx = i++;
        const id = ids[idx];
        const key = `sent_${id}.mp3`;
        try {
          await s3.send(new HeadObjectCommand({ Bucket:R2_BUCKET_NAME, Key:key }));
          let url = null;
          if (plain && R2_PUBLIC_BASE){
            url = R2_PUBLIC_BASE.replace(/\/$/,'') + '/' + key;
          } else {
            url = await getSignedUrl(s3, new GetObjectCommand({ Bucket:R2_BUCKET_NAME, Key:key }), { expiresIn: 60*60*6 });
          }
          results[id] = { exists:true, url, key };
        } catch(e){
          results[id] = { exists:false };
        }
      }
    }
    await Promise.all(Array.from({length: conc}, ()=>worker()));
    return { statusCode:200, headers:{ ...cors, 'Content-Type':'application/json' }, body: JSON.stringify({ success:true, results }) };
  } catch(e){
    return { statusCode:500, headers:cors, body: JSON.stringify({ error:'get_sentence_audio_urls failed', message:e.message }) };
  }
};
