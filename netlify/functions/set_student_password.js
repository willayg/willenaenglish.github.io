/**
 * set_student_password.js
 * 
 * Sets a new password for a verified student.
 * This is used after identity verification to allow students
 * to create/reset their password.
 * 
 * Expects POST body: { student_id, password }
 * Returns: { success: true } or error
 */

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Lazy load modules to avoid import issues
    let createClient, bcrypt;
    try {
      const supabaseModule = await import('@supabase/supabase-js');
      createClient = supabaseModule.createClient;
      bcrypt = require('bcryptjs');
    } catch (importErr) {
      try {
        createClient = require('@supabase/supabase-js').createClient;
        bcrypt = require('bcryptjs');
      } catch (requireErr) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: 'Failed to load required modules' })
        };
      }
    }

    const { student_id, password } = JSON.parse(event.body);

    if (!student_id || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing student_id or password' })
      };
    }

    if (password.length < 6) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Password must be at least 6 characters' })
      };
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    // Prefer the Service ROLE key; include common fallbacks to match other functions
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY 
      || process.env.SUPABASE_SERVICE_KEY 
      || process.env.SUPABASE_KEY 
      || process.env.SUPABASE_SERVICE_ROLE 
      || process.env.SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Server configuration error',
          hasUrl: !!supabaseUrl,
          hasServiceKey: !!supabaseKey
        })
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // First verify the student exists
    const { data: student, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('id', student_id)
      .single();

    if (fetchError || !student) {
      console.error('Student not found:', student_id, fetchError);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Student not found' })
      };
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Update the user's password in auth.users via Supabase Admin API
    const { data: authData, error: authError } = await supabase.auth.admin.updateUserById(
      student_id,
      { password: password }
    );

    if (authError) {
      console.error('Failed to update auth password:', authError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Failed to update password' })
      };
    }

    // Also store password hash in profiles table (if your system uses it)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ password_hash })
      .eq('id', student_id);

    if (profileError) {
      console.warn('Failed to update profile password_hash:', profileError);
      // Not critical, auth password is already set
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Password updated successfully' })
    };

  } catch (err) {
    console.error('Error setting password:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};
