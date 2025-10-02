// Netlify Function: image_proxy
// Provides a public proxy to fetch images stored in R2 when a public base URL isn't configured.
// Usage: /.netlify/functions/image_proxy?key=words/<gameId>/w3-<hash>.jpg
// Security: restrict allowed prefixes and basic length check. No directory traversal since keys are S3 object names.

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

function bad(status, msg){
  return { statusCode: status, headers: baseHeaders(), body: JSON.stringify({ error: msg }) };
}
function baseHeaders(extra){
  return Object.assign({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }, extra || {});
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: baseHeaders(), body: '' };
  if (event.httpMethod !== 'GET') return bad(405, 'Method not allowed');

  let { key } = event.queryStringParameters || {};
  if (!key) return bad(400, 'Missing key');
  if (key.length > 500) return bad(400, 'Key too long');
  // Normalization: strip leading legacy prefixes like images/ or public/ (possibly repeated)
  const originalKey = key;
  key = key.replace(/^(?:images\/)+/i, '').replace(/^(?:public\/)+/i, '');
  if (originalKey !== key) {
    console.log('[image_proxy] normalized legacy key', { originalKey, normalized: key });
  }
  if (!/^(cover|words)\//.test(key)) return bad(400, 'Disallowed key');
  if (/\.\./.test(key)) return bad(400, 'Invalid key');

  const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
  const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
  const R2_ENDPOINT = process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '');
  const R2_BUCKET_NAME = process.env.R2_IMAGES_BUCKET_NAME || process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || process.env.R2_BUCKETNAME;
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET_NAME) {
    return bad(500, 'Missing R2 env');
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }
  });

  try {
  console.log('[image_proxy] fetch key', key);
    const cmd = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key });
    const resp = await s3.send(cmd);
    const body = await streamToBuffer(resp.Body);
    const headers = baseHeaders({
      'Content-Type': resp.ContentType || 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable'
    });
    return { statusCode: 200, headers, body: body.toString('base64'), isBase64Encoded: true };
  } catch (e) {
    console.warn('[image_proxy] fetch failed', e?.message);
    return bad(404, 'Not found');
  }
};

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
