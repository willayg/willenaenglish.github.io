const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
    const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
    const R2_ENDPOINT = process.env.R2_ENDPOINT;
    const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || process.env.R2_BUCKETNAME;
    const R2_PUBLIC_BASE = process.env.R2_PUBLIC_BASE || `${(R2_ENDPOINT||'').replace(/\/$/, '')}/${R2_BUCKET_NAME}`;

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

    const parsed = JSON.parse(event.body || '{}');
    const { word, fileDataBase64 } = parsed;
    if (!word || !fileDataBase64) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing word or fileDataBase64' }) };
    }

    const safeWord = String(word).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/g, '');
    const buffer = Buffer.from(fileDataBase64, 'base64');
    const Key = `${safeWord}.mp3`;

    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key,
      Body: buffer,
      ContentType: 'audio/mpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    const url = `${R2_PUBLIC_BASE.replace(/\/$/, '')}/${Key}`;
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, path: Key, url }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'upload_audio failed', message: err.message }) };
  }
};
