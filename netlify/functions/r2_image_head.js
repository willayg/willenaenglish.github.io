// Netlify Function: r2_image_head
// HEAD-like diagnostic for an R2 image object. Usage:
// /.netlify/functions/r2_image_head?key=words/<gameId>/w0-<hash>.jpg
// Returns { exists:true, key, size, contentType, lastModified } or { exists:false }

const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers:cors, body:'' };
  if (event.httpMethod !== 'GET') return { statusCode:405, headers:cors, body: JSON.stringify({ error:'Method not allowed' }) };
  const key = (event.queryStringParameters || {}).key;
  if (!key) return { statusCode:400, headers:cors, body: JSON.stringify({ error:'Missing key' }) };
  if (key.length > 300 || /\.\./.test(key)) return { statusCode:400, headers:cors, body: JSON.stringify({ error:'Invalid key' }) };
  const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
  const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
  const R2_ENDPOINT = process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '');
  const R2_BUCKET_NAME = process.env.R2_IMAGES_BUCKET_NAME || process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || process.env.R2_BUCKETNAME;
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET_NAME) {
    return { statusCode:500, headers:cors, body: JSON.stringify({ error:'Missing R2 env' }) };
  }
  const s3 = new S3Client({ region:'auto', endpoint:R2_ENDPOINT, forcePathStyle:true, credentials:{ accessKeyId:R2_ACCESS_KEY_ID, secretAccessKey:R2_SECRET_ACCESS_KEY } });
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket:R2_BUCKET_NAME, Key:key }));
    return { statusCode:200, headers:cors, body: JSON.stringify({ exists:true, key, size: head.ContentLength, contentType: head.ContentType, lastModified: head.LastModified }) };
  } catch (e) {
    return { statusCode:200, headers:cors, body: JSON.stringify({ exists:false, key, error: e.name }) };
  }
};