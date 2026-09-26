const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const BATCH_ID='shimmer-monosyllables-20260927-v1';
const MARKER_KEY='_batches/'+BATCH_ID+'.json';
async function streamToString(body){const chunks=[];for await(const chunk of body)chunks.push(Buffer.from(chunk));return Buffer.concat(chunks).toString('utf8');}
exports.handler=async(event)=>{
  if(event.httpMethod!=='GET') return {statusCode:405,body:'Method Not Allowed'};
  try{
    const bucket=process.env.R2_BUCKET_NAME||process.env.R2_BUCKET||process.env.R2_BUCKETNAME;
    const s3=new S3Client({region:'auto',endpoint:process.env.R2_ENDPOINT,forcePathStyle:true,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}});
    const out=await s3.send(new GetObjectCommand({Bucket:bucket,Key:MARKER_KEY}));
    const marker=JSON.parse(await streamToString(out.Body));
    return {statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({
      batch_id:marker.batch_id,state:marker.state,model:marker.model,voice:marker.voice,
      target_count:marker.target_count||0,completed_count:marker.completed_count||marker.completed?.length||0,
      failure_count:marker.failure_count||marker.failures?.length||0,failures:marker.failures||[],
      started_at:marker.started_at,updated_at:marker.updated_at,finished_at:marker.finished_at
    })};
  }catch(e){
    return {statusCode:404,headers:{'Content-Type':'application/json'},body:JSON.stringify({batch_id:BATCH_ID,state:'not_started',error:e.message})};
  }
};