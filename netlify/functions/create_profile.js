// create_profile.js - Netlify function to insert a new teacher profile into Supabase
const { supabase } = require('./profile_backend');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const { email, name, user_id } = JSON.parse(event.body);
    if (!email || !user_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing email or user_id' }) };
    }
    // Check if profile already exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user_id)
      .single();
    if (!existing) {
      // Insert new profile
      const { error } = await supabase
        .from('profiles')
        .insert([{ id: user_id, email, name, role: 'teacher', approved: false }]);
      if (error) {
        return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
      }
    }
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
