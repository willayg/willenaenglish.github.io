// netlify/functions/update_profile_avatar.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }
    const body = JSON.parse(event.body || '{}');
    const { user_id, avatar } = body;
    if (!user_id || !avatar) return { statusCode: 400, body: JSON.stringify({ error: 'Missing user_id or avatar' }) };
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.supabase_url;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.supabase_key;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { error } = await supabase
      .from('profiles')
      .update({ avatar })
      .eq('id', user_id);
    if (error) return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
