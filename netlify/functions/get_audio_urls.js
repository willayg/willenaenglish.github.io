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
    const rawWords = Array.isArray(body.words) ? body.words : [];
    if (!rawWords.length) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing words' }) };
    }

    const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const normalizeBaseName = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/g, '');
    const toAudioKey = (input) => {
      let s = String(input ?? '').trim();
      if (!s) return '';
      if (/^https?:\/\//i.test(s)) {
        try {
          const u = new URL(s);
          s = decodeURIComponent(u.pathname.split('/').pop() || '');
        } catch {}
      }
      s = String(s || '').trim();
      if (!s) return '';

      const mp3Match = s.match(/^(.*)\.mp3$/i);
      if (mp3Match) {
        const base = normalizeBaseName(mp3Match[1]);
        return base ? `${base}.mp3` : '';
      }

      const lower = s.toLowerCase();
      if (UUID_V4_RE.test(lower)) {
        return `sent_${lower}.mp3`;
      }
      const sentUuid = lower.match(/^sent_([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i);
      if (sentUuid) {
        return `sent_${sentUuid[1].toLowerCase()}.mp3`;
      }

      const base = normalizeBaseName(s);
      return base ? `${base}.mp3` : '';
    };

    const normalizeRequestEntry = (entry) => {
      if (typeof entry === 'string') {
        const token = entry;
        const key = toAudioKey(entry);
        return key ? { token, key } : null;
      }
      if (entry && typeof entry === 'object') {
        const audioKey = entry.audio_key || entry.audioKey || entry.key || entry.audio;
        const sentenceId = entry.sentence_id || entry.sentenceId || entry.sid;
        const id = entry.id || entry.word_id || entry.wordId;
        const eng = entry.eng || entry.word || entry.text || entry.value;

        let token = null;
        if (typeof id === 'string' && id.trim()) token = id.trim();
        else if (typeof sentenceId === 'string' && sentenceId.trim()) token = sentenceId.trim();
        else if (typeof eng === 'string' && eng.trim()) token = eng.trim();
        else if (typeof audioKey === 'string' && audioKey.trim()) token = audioKey.trim();

        let lookup = null;
        if (typeof audioKey === 'string' && audioKey.trim()) lookup = audioKey.trim();
        else if (typeof sentenceId === 'string' && sentenceId.trim()) lookup = `sent_${sentenceId.trim()}`;
        else if (typeof eng === 'string' && eng.trim()) lookup = eng.trim();
        else if (typeof token === 'string' && token.trim()) lookup = token.trim();

        const key = toAudioKey(lookup);
        if (!token || !key) return null;
        return { token, key };
      }
      return null;
    };

    const entries = rawWords.map(normalizeRequestEntry).filter(Boolean);
    if (!entries.length) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing words' }) };
    }

    const results = {};

    let idx = 0; const conc = Math.min(12, entries.length);
    async function worker() {
      while (idx < entries.length) {
        const i = idx++;
        const { token, key: Key } = entries[i];
        try {
          await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key }));
          // Always return a presigned URL to avoid misconfigured public bases
          const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key }), { expiresIn: 60 * 60 * 8 });
          results[token] = { exists: true, url };
        } catch (e) {
          results[token] = { exists: false };
        }
      }
    }
    await Promise.all(Array.from({ length: conc }, () => worker()));

    return { statusCode: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }, body: JSON.stringify({ results }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'get_audio_urls failed', message: err.message }) };
  }
};
