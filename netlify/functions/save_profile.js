const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const data = JSON.parse(event.body);

  // Upsert user profile (insert or update by name)
  const { error } = await supabase
    .from('users')
    .upsert([data], { onConflict: ['name'] });

  if (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
};