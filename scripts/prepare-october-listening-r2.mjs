/**
 * Manual, isolated October listening audio preparation.
 * Run with existing R2 S3 credentials and the already-live listening TTS endpoint.
 * No Worker code or production deployment is involved.
 *
 * Required env: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 * Optional: R2_BUCKET_NAME (default: tts-audio), LISTENING_TTS_URL
 * Install repo dependencies first: npm ci
 * Run: node scripts/prepare-october-listening-r2.mjs
 */
import { createHash } from 'node:crypto';
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFile } from 'node:fs/promises';
const manifestText=await readFile(new URL('../functions/api/listening-tts-manifest.js',import.meta.url),'utf8');
const SCRIPT_LINES=JSON.parse(manifestText.replace(/^export const SCRIPT_LINES = /,'').trim().replace(/;$/,''));

for (const name of ['R2_ENDPOINT','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY']) {
  if (!process.env[name]) throw new Error('Missing environment variable '+name);
}
const bucket = process.env.R2_BUCKET_NAME || 'tts-audio';
const endpoint = process.env.LISTENING_TTS_URL || 'https://willenaenglish.com/api/listening-tts';
if (!endpoint.startsWith('https://')) throw new Error('An HTTPS listening endpoint is required');
const r2 = new S3Client({
  region:'auto', endpoint:process.env.R2_ENDPOINT, forcePathStyle:true,
  credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}
});
const voices={boy:'onyx',girl:'shimmer',narrator:'shimmer',number:'alloy'};
let done=0, skipped=0, generated=0;
const tasks=[];
for(let book=0;book<SCRIPT_LINES.length;book++)for(let section=0;section<SCRIPT_LINES[book].length;section++)
for(let item=0;item<SCRIPT_LINES[book][section].length;item++){
  const script=SCRIPT_LINES[book][section][item];
  const n=book===6&&section===1?item+5:item+1;
  tasks.push({book,section,item,segment:-1,line:{speaker:'number',text:'Number '+n+'.'}});
  for(let segment=0;segment<script.length;segment++)tasks.push({book,section,item,segment,line:script[segment]});
}
for(const task of tasks){
  const voice=voices[task.line.speaker];
  if(!voice)throw new Error('Unknown voice: '+task.line.speaker);
  const hash=createHash('sha256').update('v2-kidfriendly\n'+voice+'\n'+task.line.text).digest('hex');
  const key='listening/2026-10/'+hash+'.mp3';
  try{
    await r2.send(new HeadObjectCommand({Bucket:bucket,Key:key}));
    skipped++;done++;console.log(done+'/'+tasks.length+' already in R2: '+key);
    continue;
  }catch(e){
    if(!['NotFound','NoSuchKey','404'].includes(e?.name)&&e?.$metadata?.httpStatusCode!==404)throw e;
  }
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({book:task.book,section:task.section,item:task.item,segment:task.segment})});
  if(!response.ok)throw new Error('Audio generation failed at '+JSON.stringify(task)+': HTTP '+response.status+' '+(await response.text()).slice(0,220));
  const audio=new Uint8Array(await response.arrayBuffer());
  if(audio.byteLength<100)throw new Error('Audio too short for '+JSON.stringify(task));
  await r2.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:audio,ContentType:'audio/mpeg',CacheControl:'public,max-age=2592000'}));
  generated++;done++;console.log(done+'/'+tasks.length+' saved to R2: '+key);
}
console.log('Complete: '+skipped+' existed, '+generated+' newly saved; total '+done+'.');
