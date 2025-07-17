// submit_feedback.js - Netlify function to handle feedback submission

const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON' })
    };
  }

  // Support both direct and nested data property
  const payload = body.data ? body.data : body;
  const { feedback, module, user_id, username, tool_state, page_url } = payload;

  if (!feedback) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing feedback text' })
    };
  }

  // Insert feedback into Supabase table
  const { data, error } = await supabase
    .from('feedback')
    .insert([
      {
        feedback,
        module,
        user_id,
        username,
        tool_state,
        page_url,
        status: 'new',
        created_at: new Date().toISOString()
      }
    ]);

  if (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, data })
  };
};
