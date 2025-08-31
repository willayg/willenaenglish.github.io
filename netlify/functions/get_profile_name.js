// netlify/functions/get_profile_name.js
const { createClient } = require('@supabase/supabase-js');
const { jwtVerify, createRemoteJWKSet } = require('jose');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// JWKS endpoint used to verify Supabase JWTs
const PROJECT = SUPABASE_URL.replace('https://', '').split('.')[0];
const JWKS = createRemoteJWKSet(new URL(`https://${PROJECT}.supabase.co/auth/v1/keys`));

async function verifyUser(event) {
  const authHeader = event.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) throw new Error('Missing bearer token');
  const token = authHeader.slice(7);

  // Verify signature and get claims
  const { payload } = await jwtVerify(token, JWKS, { algorithms: ['RS256'] });
  return payload.sub; // this is the user id (uuid) in Supabase
}

exports.handler = async (event) => {
  try {
    const userId = await verifyUser(event);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase
      .from('profiles')
      .select('username, avatar')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return { statusCode: 404, body: JSON.stringify({ error: error?.message || 'Not found' }) };
    }

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: data.username, avatar: data.avatar || null }),
    };
  } catch (e) {
    return { statusCode: 401, body: JSON.stringify({ error: e.message }) };
  }
};
