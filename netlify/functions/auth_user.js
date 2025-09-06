// filepath: netlify/functions/auth_user.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        status: "error",
        message: "Missing Supabase environment variables. Please check your Netlify function settings.",
      }),
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { name } = JSON.parse(event.body);

  // Check if user exists
  const { data: existing } = await supabase
    .from('users')
    .select('id, name')
    .eq('name', name)
    .single();

  if (existing) {
    return {
      statusCode: 200,
      body: JSON.stringify({ status: "login", user: { id: existing.id, name: existing.name } })
    };
  }

  // Create new user
  const { data: created, error: insertError } = await supabase
    .from('users')
    .insert([{ name, avatar: "🐱" }])
    .select('id, name')
    .single();

  if (insertError) {
    return {
      statusCode: 500,
      body: JSON.stringify({ status: "error", message: insertError.message })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ status: "created", user: created })
  };
};