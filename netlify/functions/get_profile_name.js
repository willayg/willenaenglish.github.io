// netlify/functions/get_profile_name.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  try {
    const url = new URL(event.rawUrl || `http://localhost${event.path}${event.rawQuery ? '?' + event.rawQuery : ''}`);
    const user_id = url.searchParams.get('user_id');
    if (!user_id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing user_id' }) };
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.supabase_url;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.supabase_key;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data, error } = await supabase
      .from('profiles')
      .select('username, avatar')
      .eq('id', user_id)
      .single();
    if (error || !data) return { statusCode: 404, body: JSON.stringify({ error: error?.message || 'Not found' }) };
  return { statusCode: 200, body: JSON.stringify({ username: data.username, avatar: data.avatar || null }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
