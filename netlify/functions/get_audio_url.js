const fetch = require('node-fetch');

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    if (!SUPABASE_URL) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'SUPABASE_URL not configured' }) };
    }
    const word = (event.queryStringParameters && event.queryStringParameters.word) || '';
    if (!word) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing word' }) };
    }
    const safeWord = String(word).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/g, '');
    const filePath = `${safeWord}.mp3`;
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/audio/${filePath}`;

    // Probe with HEAD to confirm existence
    try {
      const head = await fetch(publicUrl, { method: 'HEAD' });
      if (head.ok) {
        return { statusCode: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }, body: JSON.stringify({ exists: true, url: publicUrl }) };
      }
    } catch (_) {
      // ignore network errors, fall through to not found
    }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }, body: JSON.stringify({ exists: false }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};
