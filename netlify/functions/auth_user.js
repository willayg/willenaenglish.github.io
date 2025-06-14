// filepath: netlify/functions/auth_user.js
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { name, password } = JSON.parse(event.body);

  // Check if user exists
  const { data: existing } = await supabase
    .from('users')
    .select('id, name, password')
    .eq('name', name)
    .single();

  if (existing) {
    // Compare hashed password
    const valid = await bcrypt.compare(password, existing.password);
    if (valid) {
      return {
        statusCode: 200,
        body: JSON.stringify({ status: "login", user: { id: existing.id, name: existing.name } })
      };
    } else {
      return {
        statusCode: 200,
        body: JSON.stringify({ status: "name_taken" })
      };
    }
  }

  // Hash password before storing
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create new user
  const { data: created, error: insertError } = await supabase
    .from('users')
    .insert([{ name, password: hashedPassword, avatar: "🐱" }])
    .select('id, name')
    .single();

  if (insertError) {
    return {
      statusCode: 500,
      body: JSON.stringify({ status: "error", error: insertError.message })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ status: "created", user: created })
  };
};