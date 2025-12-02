const { createClient } = require('@supabase/supabase-js');

// SECURITY: Set this to a strong secret and use it in your email links
const ADMIN_SECRET = process.env.ADMIN_APPROVAL_SECRET || 'YOUR_SECRET_HERE';

exports.handler = async (event) => {
  const { id, action, token } = event.queryStringParameters || {};
  if (!id || !action || !token) {
    return {
      statusCode: 400,
      body: 'Missing id, action, or token.'
    };
  }
  if (token !== ADMIN_SECRET) {
    return {
      statusCode: 403,
      body: 'Unauthorized.'
    };
  }
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  let approved = null;
  if (action === 'approve') approved = true;
  if (action === 'disapprove') approved = false;
  if (approved === null) {
    return {
      statusCode: 400,
      body: 'Invalid action.'
    };
  }
  // Update the user's approved status
  const { error } = await supabase
    .from('profiles')
    .update({ approved })
    .eq('id', id);
  if (error) {
    return {
      statusCode: 500,
      body: 'Database error: ' + error.message
    };
  }
  return {
    statusCode: 200,
    body: `User ${approved ? 'approved' : 'disapproved'} successfully.`
  };
};
