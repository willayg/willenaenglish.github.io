const fetch = require('node-fetch');

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
    const SUPABASE_URL = process.env.SUPABASE_URL;
    if (!SUPABASE_URL) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'SUPABASE_URL not configured' }) };
    }
    const body = JSON.parse(event.body || '{}');
    const words = Array.isArray(body.words) ? body.words : [];
    if (!words.length) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing words' }) };
    }

    const toSafe = (word) => String(word).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/g, '');
    const results = {};

    // Limit concurrency to avoid flooding
    const urls = words.map(w => ({ w, url: `${SUPABASE_URL}/storage/v1/object/public/audio/${toSafe(w)}.mp3` }));
    let idx = 0; const conc = Math.min(16, urls.length);
    async function worker() {
      while (idx < urls.length) {
        const i = idx++;
        const { w, url } = urls[i];
        try {
          const head = await fetch(url, { method: 'HEAD' });
          if (head.ok) results[w] = { exists: true, url };
          else results[w] = { exists: false };
        } catch {
          results[w] = { exists: false };
        }
      }
    }
    await Promise.all(Array.from({ length: conc }, () => worker()));

    return { statusCode: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }, body: JSON.stringify({ results }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};
