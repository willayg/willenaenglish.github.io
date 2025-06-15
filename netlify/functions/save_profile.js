const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const data = JSON.parse(event.body);

  const profile = {
    id: data.id,
    name: data.name,
    avatar: data.avatar,
    Korean_name: data.Korean_name,
    email: data.email,
    is_willena_student: data.is_willena_student,
    class: data.class,
    theme: data.theme
  };

  // Upsert user profile (insert or update by name)
  const { error } = await supabase
    .from('users')
    .upsert([profile], { onConflict: ['id'] });

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