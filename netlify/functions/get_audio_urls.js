const { S3Client, HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

exports.handler = async (event) => {
  // Get the origin from the request headers
  const origin = event.headers?.origin || event.headers?.Origin || '*';
  
  // Allowed origins for CORS with credentials
  const allowedOrigins = [
    'https://willenaenglish.com',
    'https://www.willenaenglish.com',
    'https://willenaenglish.netlify.app',
    'http://localhost:8888',
    'http://localhost:9000'
  ];
  
  // Use the request origin if it's in allowed list, otherwise use first allowed origin
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
  const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
  const R2_ENDPOINT = process.env.R2_ENDPOINT;
  const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || process.env.R2_BUCKETNAME;
  const R2_PUBLIC_BASE = process.env.R2_PUBLIC_BASE || process.env.R2_PUBLIC_URL || '';

  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET_NAME) {
    const missing = {
      R2_ACCESS_KEY_ID: !!R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: !!R2_SECRET_ACCESS_KEY,
      R2_ENDPOINT: !!R2_ENDPOINT,
      R2_BUCKET_NAME: !!R2_BUCKET_NAME,
    };
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Missing R2 environment variables', missing }) };
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });

  try {
    const body = JSON.parse(event.body || '{}');
    const words = Array.isArray(body.words) ? body.words : [];
    if (!words.length) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing words' }) };
    }
    const toKey = (word) => String(word).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/g, '') + '.mp3';
    const results = {};

    let idx = 0; const conc = Math.min(12, words.length);
    async function worker() {
      while (idx < words.length) {
        const i = idx++;
        const w = words[i];
        const Key = toKey(w);
        try {
          await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key }));
          // Always return a presigned URL to avoid misconfigured public bases
          const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key }), { expiresIn: 60 * 60 * 8 });
          results[w] = { exists: true, url };
        } catch (e) {
          results[w] = { exists: false };
        }
      }
    }
    await Promise.all(Array.from({ length: conc }, () => worker()));

    return { statusCode: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }, body: JSON.stringify({ results }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'get_audio_urls failed', message: err.message }) };
  }
};
